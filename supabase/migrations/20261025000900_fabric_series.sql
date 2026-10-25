create type public.fabric_kind as enum ('motif', 'plain');

alter table public.fabrics add column kind public.fabric_kind not null default 'motif';

update public.fabrics f
set kind = 'plain'
where exists (select 1 from public.work_orders wo where wo.fabric_combination_id = f.id)
  and not exists (select 1 from public.work_orders wo where wo.fabric_id = f.id);

create table public.fabric_series (
  id uuid primary key default gen_random_uuid(),
  fabric_id uuid not null references public.fabrics (id) on delete cascade,
  name text not null check (length(name) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index fabric_series_name_key_idx on public.fabric_series (fabric_id, public.label_key(name));

create trigger fabric_series_set_updated_at
before update on public.fabric_series
for each row execute function public.set_updated_at();

create trigger fabric_series_normalize before insert or update on public.fabric_series
for each row execute function public.normalize_labels('name');

alter table public.fabric_series enable row level security;
revoke all on public.fabric_series from anon;

create policy fabric_series_select_staff on public.fabric_series
for select to authenticated using (public.is_staff());
create policy fabric_series_insert_production_head on public.fabric_series
for insert to authenticated with check (public.has_role('production_head'));
create policy fabric_series_update_production_head on public.fabric_series
for update to authenticated using (public.has_role('production_head')) with check (public.has_role('production_head'));
create policy fabric_series_delete_production_head on public.fabric_series
for delete to authenticated using (public.has_role('production_head'));

insert into public.fabric_series (fabric_id, name)
select id, 'SERI 1' from public.fabrics;

alter table public.fabric_colors
  add column series_id uuid references public.fabric_series (id) on delete cascade;

update public.fabric_colors fc
set series_id = s.id
from public.fabric_series s
where s.fabric_id = fc.fabric_id;

alter table public.fabric_colors alter column series_id set not null;

drop index public.fabric_colors_name_key_idx;
create unique index fabric_colors_name_key_idx on public.fabric_colors (series_id, public.label_key(name));

create function public.sync_fabric_color_fabric()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.series_id is null and new.fabric_id is not null then
    select id into new.series_id
    from public.fabric_series
    where fabric_id = new.fabric_id
    order by created_at, name
    limit 1;
    if new.series_id is null then
      insert into public.fabric_series (fabric_id, name) values (new.fabric_id, 'SERI 1')
      returning id into new.series_id;
    end if;
  end if;
  select fabric_id into new.fabric_id from public.fabric_series where id = new.series_id;
  return new;
end;
$$;

create trigger fabric_colors_sync_fabric
before insert or update of series_id, fabric_id on public.fabric_colors
for each row execute function public.sync_fabric_color_fabric();

alter table public.work_orders
  add column fabric_series_id uuid references public.fabric_series (id);

update public.work_orders wo
set fabric_series_id = s.id
from public.fabric_series s
where s.fabric_id = wo.fabric_id;

alter table public.work_orders alter column fabric_series_id set not null;

create or replace function public.check_work_order_item_color()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.work_orders wo
    join public.fabric_colors fc on fc.series_id = wo.fabric_series_id
    where wo.id = new.work_order_id and fc.id = new.fabric_color_id
  ) then
    perform public.raise_app_error('COLOR_NOT_IN_FABRIC', jsonb_build_object('fabric_color_id', new.fabric_color_id));
  end if;
  return new;
end;
$$;

create function public.guard_work_order_fabric()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.fabric_series where id = new.fabric_series_id and fabric_id = new.fabric_id
  ) then
    perform public.raise_app_error('SERIES_NOT_IN_FABRIC');
  end if;
  if tg_op = 'UPDATE'
     and (new.fabric_id, new.fabric_series_id) is distinct from (old.fabric_id, old.fabric_series_id)
     and exists (select 1 from public.work_order_items where work_order_id = new.id) then
    perform public.raise_app_error('WORK_ORDER_FABRIC_LOCKED');
  end if;
  return new;
end;
$$;

create trigger work_orders_guard_fabric
before insert or update of fabric_id, fabric_series_id on public.work_orders
for each row execute function public.guard_work_order_fabric();

drop function public.create_work_order(uuid, uuid, uuid, public.change_status, uuid[], uuid[], text, date, uuid, uuid, text, text, boolean, text);

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
  chosen_series uuid;
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

  chosen_series := coalesce(
    p_fabric_series_id,
    (select id from public.fabric_series where fabric_id = p_fabric_id order by created_at, name limit 1)
  );
  if chosen_series is null then
    perform public.raise_app_error('SERIES_REQUIRED');
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
    number, ordered_on, product_id, pattern_id, fabric_id, fabric_series_id, fabric_combination_id, cutter_id,
    change_status, change_notes, additional_info
  )
  values (
    chosen_number, coalesce(p_ordered_on, public.app_today()), p_product_id, chosen_pattern,
    p_fabric_id, chosen_series, p_fabric_combination_id, p_cutter_id, p_change_status,
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

create or replace function public.ensure_master_label(p_kind text, p_label text, p_parent_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text := public.normalize_label(p_label);
  key text := public.label_key(p_label);
  found uuid;
begin
  perform public.require_role('production_head');

  if clean is null or coalesce(key, '') = '' then
    perform public.raise_app_error('LABEL_REQUIRED', jsonb_build_object('kind', p_kind));
  end if;
  if p_kind in ('series', 'color') and p_parent_id is null then
    perform public.raise_app_error('LABEL_REQUIRED', jsonb_build_object('kind', p_kind));
  end if;

  case p_kind
    when 'product' then
      select id into found from public.products where public.label_key(code) = key;
      if found is null then
        insert into public.products (code) values (clean) returning id into found;
      else
        update public.products set is_active = true where id = found and not is_active;
      end if;
    when 'fabric', 'combination' then
      select id into found from public.fabrics where public.label_key(name) = key;
      if found is null then
        insert into public.fabrics (name, kind)
        values (clean, case when p_kind = 'combination' then 'plain' else 'motif' end::public.fabric_kind)
        returning id into found;
      else
        update public.fabrics set is_active = true where id = found and not is_active;
      end if;
    when 'series' then
      select id into found from public.fabric_series where fabric_id = p_parent_id and public.label_key(name) = key;
      if found is null then
        insert into public.fabric_series (fabric_id, name) values (p_parent_id, clean) returning id into found;
      else
        update public.fabric_series set is_active = true where id = found and not is_active;
      end if;
    when 'cutter' then
      select id into found from public.cutters where public.label_key(name) = key and archived_at is null;
      if found is null then
        insert into public.cutters (name) values (clean) returning id into found;
      else
        update public.cutters set is_active = true, inactive_since = null where id = found and not is_active;
      end if;
    when 'pattern' then
      select id into found from public.patterns where public.label_key(code) = key;
      if found is null then
        insert into public.patterns (code) values (clean) returning id into found;
      else
        update public.patterns set is_active = true where id = found and not is_active;
      end if;
    when 'size' then
      select id into found from public.sizes where public.label_key(name) = key;
      if found is null then
        insert into public.sizes (name, sort_order)
        values (clean, coalesce((select max(sort_order) from public.sizes), -10) + 10)
        returning id into found;
      else
        update public.sizes set is_active = true where id = found and not is_active;
      end if;
    when 'color' then
      select id into found from public.fabric_colors
      where series_id = p_parent_id and public.label_key(name) = key;
      if found is null then
        insert into public.fabric_colors (series_id, name) values (p_parent_id, clean) returning id into found;
      else
        update public.fabric_colors set is_active = true where id = found and not is_active;
      end if;
    else
      perform public.raise_app_error('INVALID_INPUT', jsonb_build_object('kind', p_kind));
  end case;

  return found;
end;
$$;

grant execute on function
  public.create_work_order(uuid, uuid, uuid, public.change_status, uuid[], uuid[], text, date, uuid, uuid, text, text, boolean, text, uuid)
to authenticated;
