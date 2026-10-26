-- Hasil potong is now counted in iketan (bundles) per size; colours are no longer used.
-- A size without colour is one work_order_item, and each bundle becomes one sewing card.
alter table public.work_order_items alter column fabric_color_id drop not null;

create unique index work_order_items_size_only_idx
  on public.work_order_items (work_order_id, size_id)
  where fabric_color_id is null;

create or replace function public.check_work_order_item_color()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fabric_color_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.work_orders wo
    join public.fabric_colors fc on fc.fabric_id = wo.fabric_id
    where wo.id = new.work_order_id and fc.id = new.fabric_color_id
  ) then
    perform public.raise_app_error('COLOR_NOT_IN_FABRIC', jsonb_build_object('fabric_color_id', new.fabric_color_id));
  end if;
  return new;
end;
$$;

-- Records the bundles that came back from cutting and issues one card per bundle, in one call.
create or replace function public.record_bundles(
  p_work_order_id uuid,
  p_bundles jsonb,
  p_taken_on date default null
)
returns setof public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  wo public.work_orders;
  bundle jsonb;
  bundle_size uuid;
  bundle_item uuid;
  cards jsonb := '[]'::jsonb;
begin
  perform public.require_role('production_head');

  select * into wo from public.work_orders where id = p_work_order_id for update;
  if wo.id is null then
    perform public.raise_app_error('NOT_FOUND');
  end if;
  if wo.status in ('done', 'cancelled') then
    perform public.raise_app_error('WORK_ORDER_CLOSED');
  end if;
  if coalesce(jsonb_array_length(p_bundles), 0) = 0 then
    perform public.raise_app_error('CARDS_REQUIRED');
  end if;

  for bundle in select * from jsonb_array_elements(p_bundles) loop
    if coalesce((bundle ->> 'quantity')::integer, 0) <= 0 then
      perform public.raise_app_error('INVALID_AMOUNT');
    end if;
    bundle_size := public.ensure_master_label('size', bundle ->> 'size');

    insert into public.work_order_sizes (work_order_id, size_id)
    values (wo.id, bundle_size)
    on conflict do nothing;

    select woi.id into bundle_item from public.work_order_items woi
    where woi.work_order_id = wo.id and woi.size_id = bundle_size and woi.fabric_color_id is null;
    if bundle_item is null then
      insert into public.work_order_items (work_order_id, size_id, cut_quantity)
      values (wo.id, bundle_size, (bundle ->> 'quantity')::integer)
      returning id into bundle_item;
    else
      update public.work_order_items
      set cut_quantity = coalesce(cut_quantity, 0) + (bundle ->> 'quantity')::integer
      where id = bundle_item;
    end if;

    cards := cards || jsonb_build_array(jsonb_build_object(
      'work_order_item_id', bundle_item,
      'quantity', (bundle ->> 'quantity')::integer
    ));
  end loop;

  return query select * from public.issue_sewing_cards(cards, p_taken_on);
end;
$$;

grant execute on function public.record_bundles(uuid, jsonb, date) to authenticated;

-- Colour-less items must still show in the reports.
create or replace view public.outstanding_sewing_cards
with (security_invoker = true)
as
select
  sc.id,
  sc.number,
  sc.tailor_id,
  t.code as tailor_code,
  t.name as tailor_name,
  wo.number as work_order_number,
  p.code as product_code,
  s.name as size_name,
  fc.name as color_name,
  sc.quantity,
  sc.taken_on,
  sc.status,
  sc.inspection_status,
  sc.submitted_incomplete and sc.remaining_delivered_on is null as remaining_pending,
  public.app_today() - sc.taken_on as age_days
from public.sewing_cards sc
left join public.tailors t on t.id = sc.tailor_id
join public.work_order_items woi on woi.id = sc.work_order_item_id
join public.work_orders wo on wo.id = woi.work_order_id
join public.products p on p.id = wo.product_id
join public.sizes s on s.id = woi.size_id
left join public.fabric_colors fc on fc.id = woi.fabric_color_id
where sc.status = 'taken'
   or sc.inspection_status = 'in_repair'
   or (sc.submitted_incomplete and sc.remaining_delivered_on is null);

create or replace view public.thp_rows
with (security_invoker = true)
as
select
  wo.id as work_order_id,
  wo.number as work_order_number,
  sc.id as sewing_card_id,
  sc.number as card_number,
  t.name as tailor_name,
  t.code as tailor_code,
  s.name as size_name,
  fc.name as color_name,
  sc.quantity,
  sc.taken_on,
  sc.submitted_on,
  sc.inspection_status,
  coalesce(sum(i.ok_quantity), 0)::integer as ok_quantity,
  coalesce(sum(i.defective_quantity), 0)::integer as defective_quantity,
  string_agg(i.notes, '; ' order by i.round) as inspection_notes
from public.sewing_cards sc
left join public.tailors t on t.id = sc.tailor_id
join public.work_order_items woi on woi.id = sc.work_order_item_id
join public.work_orders wo on wo.id = woi.work_order_id
join public.sizes s on s.id = woi.size_id
left join public.fabric_colors fc on fc.id = woi.fabric_color_id
left join public.inspections i on i.sewing_card_id = sc.id
where sc.status <> 'cancelled'
group by wo.id, sc.id, t.name, t.code, s.name, fc.name;
