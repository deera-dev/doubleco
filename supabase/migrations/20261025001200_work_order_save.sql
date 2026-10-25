-- Sizes are planned on the WO itself so colours can be chosen later (at cutting time).
create table public.work_order_sizes (
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  size_id uuid not null references public.sizes (id),
  created_at timestamptz not null default now(),
  primary key (work_order_id, size_id)
);

alter table public.work_order_sizes enable row level security;
revoke all on public.work_order_sizes from anon;

create policy work_order_sizes_select_staff on public.work_order_sizes
for select to authenticated using (public.is_staff());

insert into public.work_order_sizes (work_order_id, size_id)
select distinct work_order_id, size_id from public.work_order_items
on conflict do nothing;

create or replace function public.create_work_order(
  p_product_id uuid,
  p_fabric_id uuid,
  p_cutter_id uuid,
  p_change_status public.change_status,
  p_size_ids uuid[],
  p_fabric_color_ids uuid[],
  p_number text default null,
  p_ordered_on date default null,
  p_pattern_id uuid default null,
  p_fabric_combination_id uuid default null,
  p_change_notes text default null,
  p_additional_info text default null,
  p_confirmed boolean default false,
  p_override_reason text default null,
  p_fabric_series_id uuid default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_number text;
  chosen_pattern uuid;
  warnings jsonb := '[]'::jsonb;
  created public.work_orders;
begin
  perform public.require_role('production_head');

  if not exists (select 1 from public.products where id = p_product_id and is_active and wage_category is not null) then
    perform public.raise_app_error('PRODUCT_CATEGORY_MISSING', jsonb_build_object('product_id', p_product_id));
  end if;

  if coalesce(cardinality(p_size_ids), 0) = 0 then
    perform public.raise_app_error('WORK_ORDER_SIZES_REQUIRED');
  end if;

  if p_fabric_combination_id is not null and p_fabric_combination_id = p_fabric_id then
    perform public.raise_app_error('FABRIC_COMBINATION_SAME');
  end if;

  chosen_pattern := coalesce(p_pattern_id, (select default_pattern_id from public.products where id = p_product_id));

  chosen_number := coalesce(nullif(trim(p_number), ''), public.suggest_work_order_number(p_product_id));
  if exists (select 1 from public.work_orders where lower(number) = lower(chosen_number)) then
    perform public.raise_app_error('WORK_ORDER_NUMBER_TAKEN', jsonb_build_object(
      'number', chosen_number,
      'suggestion', public.suggest_work_order_number(p_product_id)
    ));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('code', 'SIMILAR_WORK_ORDER_ACTIVE', 'work_order_number', wo.number)), '[]'::jsonb)
  into warnings
  from public.work_orders wo
  where wo.product_id = p_product_id
    and wo.fabric_id = p_fabric_id
    and wo.status not in ('done', 'cancelled')
    and exists (
      select 1 from public.work_order_sizes wos
      where wos.work_order_id = wo.id and wos.size_id = any (p_size_ids)
    );

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  insert into public.work_orders (
    number, ordered_on, product_id, pattern_id, fabric_id, fabric_series_id, fabric_combination_id, cutter_id,
    change_status, change_notes, additional_info
  )
  values (
    chosen_number, coalesce(p_ordered_on, public.app_today()), p_product_id, chosen_pattern,
    p_fabric_id, p_fabric_series_id, p_fabric_combination_id, p_cutter_id, p_change_status,
    nullif(trim(p_change_notes), ''), nullif(trim(p_additional_info), '')
  )
  returning * into created;

  insert into public.work_order_sizes (work_order_id, size_id)
  select distinct created.id, unnest(p_size_ids);

  insert into public.work_order_items (work_order_id, size_id, fabric_color_id)
  select created.id, size_id, fabric_color_id
  from (select distinct unnest(p_size_ids) as size_id) s
  cross join (select distinct unnest(coalesce(p_fabric_color_ids, '{}')) as fabric_color_id) c;

  return created;
end;
$$;

create or replace function public.add_work_order_items(p_work_order_id uuid, p_size_ids uuid[], p_fabric_color_ids uuid[])
returns setof public.work_order_items
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_role('production_head');
  if (select status from public.work_orders where id = p_work_order_id) in ('done', 'cancelled') then
    perform public.raise_app_error('WORK_ORDER_CLOSED');
  end if;

  insert into public.work_order_sizes (work_order_id, size_id)
  select distinct p_work_order_id, unnest(p_size_ids)
  on conflict do nothing;

  return query
  insert into public.work_order_items (work_order_id, size_id, fabric_color_id)
  select p_work_order_id, size_id, fabric_color_id
  from (select distinct unnest(p_size_ids) as size_id) s
  cross join (select distinct unnest(coalesce(p_fabric_color_ids, '{}')) as fabric_color_id) c
  on conflict (work_order_id, size_id, fabric_color_id) do nothing
  returning *;
end;
$$;

create or replace function public.ensure_master_labels(p_kind text, p_labels text[], p_parent_id uuid default null)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[] := '{}';
  found uuid;
  value text;
begin
  foreach value in array coalesce(p_labels, '{}') loop
    found := public.ensure_master_label(p_kind, value, p_parent_id);
    if not (found = any (ids)) then
      ids := ids || found;
    end if;
  end loop;
  return ids;
end;
$$;

-- One round trip for the WO form: resolves every typed label (adding missing master data) and creates or updates.
create or replace function public.save_work_order(
  p_work_order_id uuid,
  p jsonb,
  p_confirmed boolean default false,
  p_override_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_product uuid;
  resolved_fabric uuid;
  resolved_cutter uuid;
  resolved_pattern uuid;
  resolved_combination uuid;
  category text := nullif(p ->> 'category', '');
  fabric_code text := public.normalize_label(nullif(trim(p ->> 'fabricCode'), ''));
  resolved_status public.change_status := (p ->> 'changeStatus')::public.change_status;
  saved_id uuid := p_work_order_id;
begin
  perform public.require_role('production_head');

  if nullif(trim(p ->> 'combination'), '') is not null
     and public.label_key(p ->> 'combination') = public.label_key(p ->> 'fabric') then
    perform public.raise_app_error('FABRIC_COMBINATION_SAME');
  end if;

  resolved_product := public.ensure_master_label('product', p ->> 'product');
  if category is not null then
    update public.products set wage_category = category::public.wage_category
    where id = resolved_product and wage_category is null;
  end if;

  resolved_fabric := public.ensure_master_label('fabric', p ->> 'fabric');
  if fabric_code is not null then
    begin
      update public.fabrics set code = fabric_code where id = resolved_fabric and code is null;
    exception when unique_violation then
      perform public.raise_app_error('FABRIC_CODE_TAKEN');
    end;
  end if;

  resolved_cutter := public.ensure_master_label('cutter', p ->> 'cutter');
  if nullif(trim(p ->> 'pattern'), '') is not null then
    resolved_pattern := public.ensure_master_label('pattern', p ->> 'pattern');
  end if;
  if nullif(trim(p ->> 'combination'), '') is not null then
    resolved_combination := public.ensure_master_label('combination', p ->> 'combination');
  end if;

  if saved_id is null then
    select (public.create_work_order(
      resolved_product,
      resolved_fabric,
      resolved_cutter,
      resolved_status,
      public.ensure_master_labels('size', array(select jsonb_array_elements_text(coalesce(p -> 'sizes', '[]')))),
      public.ensure_master_labels('color', array(select jsonb_array_elements_text(coalesce(p -> 'colors', '[]'))), resolved_fabric),
      p ->> 'number',
      (p ->> 'orderedOn')::date,
      resolved_pattern,
      resolved_combination,
      p ->> 'changeNotes',
      p ->> 'additionalInfo',
      p_confirmed,
      p_override_reason
    )).id into saved_id;
    return saved_id;
  end if;

  update public.work_orders set
    number = trim(p ->> 'number'),
    ordered_on = (p ->> 'orderedOn')::date,
    product_id = resolved_product,
    fabric_id = resolved_fabric,
    cutter_id = resolved_cutter,
    pattern_id = resolved_pattern,
    fabric_combination_id = resolved_combination,
    change_status = resolved_status,
    change_notes = case when resolved_status = 'changed' then nullif(trim(p ->> 'changeNotes'), '') end,
    additional_info = nullif(trim(p ->> 'additionalInfo'), '')
  where id = saved_id;
  if not found then
    perform public.raise_app_error('NOT_FOUND');
  end if;
  return saved_id;
exception when unique_violation then
  if sqlerrm like '%work_orders_number_idx%' then
    perform public.raise_app_error('WORK_ORDER_NUMBER_TAKEN', jsonb_build_object('number', p ->> 'number'));
  end if;
  raise;
end;
$$;

create or replace function public.add_work_order_labels(p_work_order_id uuid, p_sizes text[], p_colors text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  wo_fabric uuid;
begin
  perform public.require_role('production_head');
  select fabric_id into wo_fabric from public.work_orders where id = p_work_order_id;
  if wo_fabric is null then
    perform public.raise_app_error('NOT_FOUND');
  end if;
  perform public.add_work_order_items(
    p_work_order_id,
    public.ensure_master_labels('size', p_sizes),
    public.ensure_master_labels('color', p_colors, wo_fabric)
  );
end;
$$;

grant execute on function
  public.create_work_order(uuid, uuid, uuid, public.change_status, uuid[], uuid[], text, date, uuid, uuid, text, text, boolean, text, uuid),
  public.save_work_order(uuid, jsonb, boolean, text),
  public.add_work_order_labels(uuid, text[], text[])
to authenticated;
