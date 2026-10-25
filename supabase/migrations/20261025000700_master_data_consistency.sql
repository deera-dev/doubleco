create function public.normalize_label(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(upper(regexp_replace(btrim(p_value), '\s+', ' ', 'g')), '')
$$;

create function public.normalize_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(btrim(p_value), '\s+', ' ', 'g'), '')
$$;

create function public.label_key(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(p_value), '[^a-z0-9]', '', 'g')
$$;

create function public.normalize_labels()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  column_name text;
  patch jsonb := '{}'::jsonb;
  current_row jsonb := to_jsonb(new);
begin
  foreach column_name in array tg_argv loop
    if left(column_name, 1) = '~' then
      patch := patch || jsonb_build_object(
        substr(column_name, 2), public.normalize_text(current_row ->> substr(column_name, 2))
      );
    else
      patch := patch || jsonb_build_object(column_name, public.normalize_label(current_row ->> column_name));
    end if;
  end loop;
  new := jsonb_populate_record(new, patch);
  return new;
end;
$$;

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  code text not null check (length(code) > 0),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger patterns_set_updated_at
before update on public.patterns
for each row execute function public.set_updated_at();

create trigger patterns_audit
after insert or update or delete on public.patterns
for each row execute function public.write_audit_log();

alter table public.patterns enable row level security;
revoke all on public.patterns from anon;

create policy patterns_select_staff on public.patterns
for select to authenticated using (public.is_staff());
create policy patterns_insert_production_head on public.patterns
for insert to authenticated with check (public.has_role('production_head'));
create policy patterns_update_production_head on public.patterns
for update to authenticated using (public.has_role('production_head')) with check (public.has_role('production_head'));
create policy patterns_delete_production_head on public.patterns
for delete to authenticated using (public.has_role('production_head'));

create trigger tailors_normalize before insert or update on public.tailors
for each row execute function public.normalize_labels('name', '~code');
create trigger cutters_normalize before insert or update on public.cutters
for each row execute function public.normalize_labels('name');
create trigger products_normalize before insert or update on public.products
for each row execute function public.normalize_labels('code', '~name');
create trigger fabrics_normalize before insert or update on public.fabrics
for each row execute function public.normalize_labels('name');
create trigger fabric_colors_normalize before insert or update on public.fabric_colors
for each row execute function public.normalize_labels('name');
create trigger sizes_normalize before insert or update on public.sizes
for each row execute function public.normalize_labels('name');
create trigger patterns_normalize before insert or update on public.patterns
for each row execute function public.normalize_labels('code', '~notes');

update public.tailors set name = name where name is distinct from public.normalize_label(name);
update public.cutters set name = name where name is distinct from public.normalize_label(name);
update public.products set code = code
where code is distinct from public.normalize_label(code) or name is distinct from public.normalize_text(name);
update public.fabrics set name = name where name is distinct from public.normalize_label(name);
update public.fabric_colors set name = name where name is distinct from public.normalize_label(name);
update public.sizes set name = name where name is distinct from public.normalize_label(name);

drop index public.cutters_name_live_idx;
drop index public.products_code_idx;
drop index public.fabrics_name_idx;
drop index public.fabric_colors_name_idx;
drop index public.sizes_name_idx;

create unique index cutters_name_key_idx on public.cutters (public.label_key(name)) where archived_at is null;
create unique index products_code_key_idx on public.products (public.label_key(code));
create unique index fabrics_name_key_idx on public.fabrics (public.label_key(name));
create unique index fabric_colors_name_key_idx on public.fabric_colors (fabric_id, public.label_key(name));
create unique index sizes_name_key_idx on public.sizes (public.label_key(name));
create unique index patterns_code_key_idx on public.patterns (public.label_key(code));

alter table public.products
  add column default_pattern_id uuid references public.patterns (id) on delete set null;

alter table public.work_orders
  add column pattern_id uuid references public.patterns (id),
  add column fabric_combination_id uuid references public.fabrics (id);

insert into public.patterns (code)
select distinct on (public.label_key(pattern_code)) pattern_code
from public.work_orders
where public.normalize_label(pattern_code) is not null
order by public.label_key(pattern_code), pattern_code;

update public.work_orders wo
set pattern_id = p.id
from public.patterns p
where public.label_key(wo.pattern_code) = public.label_key(p.code);

insert into public.fabrics (name)
select distinct on (public.label_key(wo.fabric_combination)) wo.fabric_combination
from public.work_orders wo
where public.normalize_label(wo.fabric_combination) is not null
  and not exists (
    select 1 from public.fabrics f where public.label_key(f.name) = public.label_key(wo.fabric_combination)
  )
order by public.label_key(wo.fabric_combination), wo.fabric_combination;

update public.work_orders wo
set fabric_combination_id = f.id
from public.fabrics f
where public.label_key(wo.fabric_combination) = public.label_key(f.name)
  and f.id <> wo.fabric_id;

alter table public.work_orders
  drop column pattern_code,
  drop column fabric_combination,
  add constraint work_orders_combination_differs check (fabric_combination_id is distinct from fabric_id);

drop function public.create_work_order(uuid, uuid, uuid, public.change_status, uuid[], uuid[], text, date, text, text, text, text, text, boolean, text);

create function public.create_work_order(
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
  p_override_reason text default null
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

  if coalesce(cardinality(p_size_ids), 0) = 0 or coalesce(cardinality(p_fabric_color_ids), 0) = 0 then
    perform public.raise_app_error('WORK_ORDER_ITEMS_REQUIRED');
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
      select 1 from public.work_order_items woi
      where woi.work_order_id = wo.id and woi.size_id = any (p_size_ids)
    );

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  insert into public.work_orders (
    number, ordered_on, product_id, pattern_id, fabric_id, fabric_combination_id, cutter_id,
    change_status, change_notes, additional_info
  )
  values (
    chosen_number, coalesce(p_ordered_on, public.app_today()), p_product_id, chosen_pattern,
    p_fabric_id, p_fabric_combination_id, p_cutter_id, p_change_status,
    nullif(trim(p_change_notes), ''), nullif(trim(p_additional_info), '')
  )
  returning * into created;

  insert into public.work_order_items (work_order_id, size_id, fabric_color_id)
  select created.id, size_id, fabric_color_id
  from (select distinct unnest(p_size_ids) as size_id) s
  cross join (select distinct unnest(p_fabric_color_ids) as fabric_color_id) c;

  return created;
end;
$$;

grant execute on function
  public.normalize_label(text),
  public.normalize_text(text),
  public.label_key(text),
  public.create_work_order(uuid, uuid, uuid, public.change_status, uuid[], uuid[], text, date, uuid, uuid, text, text, boolean, text)
to authenticated;
