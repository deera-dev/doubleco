create view public.tailor_advance_balances
with (security_invoker = true)
as
select
  t.id as tailor_id,
  t.code as tailor_code,
  t.name as tailor_name,
  t.status as tailor_status,
  coalesce(sum(e.amount) filter (where e.entry_type in ('opening_balance', 'advance')), 0)::bigint as total_borrowed,
  coalesce(sum(e.amount) filter (where e.entry_type = 'repayment'), 0)::bigint as total_repaid,
  coalesce(sum(e.amount) filter (where e.entry_type = 'write_off'), 0)::bigint as total_written_off,
  coalesce(sum(case when e.entry_type in ('opening_balance', 'advance') then e.amount else -e.amount end), 0)::bigint as balance
from public.tailors t
left join public.cash_advance_entries e on e.tailor_id = t.id
group by t.id;

create view public.outstanding_sewing_cards
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
join public.tailors t on t.id = sc.tailor_id
join public.work_order_items woi on woi.id = sc.work_order_item_id
join public.work_orders wo on wo.id = woi.work_order_id
join public.products p on p.id = wo.product_id
join public.sizes s on s.id = woi.size_id
join public.fabric_colors fc on fc.id = woi.fabric_color_id
where sc.status = 'taken'
   or sc.inspection_status = 'in_repair'
   or (sc.submitted_incomplete and sc.remaining_delivered_on is null);

create view public.weekly_deposit_grid
with (security_invoker = true)
as
select
  sc.submitted_on + ((6 - extract(isodow from sc.submitted_on)::integer + 7) % 7) as pay_on,
  sc.tailor_id,
  t.code as tailor_code,
  t.name as tailor_name,
  sc.wage_category,
  extract(isodow from sc.submitted_on)::smallint as weekday,
  sum(sc.quantity)::integer as quantity,
  sum(sc.wage_amount)::bigint as wage_amount
from public.sewing_cards sc
join public.tailors t on t.id = sc.tailor_id
where sc.status in ('submitted', 'paid')
group by 1, sc.tailor_id, t.code, t.name, sc.wage_category, 6;

create view public.work_order_progress
with (security_invoker = true)
as
select
  wo.id as work_order_id,
  wo.number,
  wo.status,
  coalesce(items.cut_quantity, 0) as cut_quantity,
  coalesce(cards.assigned_quantity, 0) as assigned_quantity,
  coalesce(cards.submitted_quantity, 0) as submitted_quantity,
  coalesce(checks.ok_quantity, 0) as ok_quantity,
  coalesce(checks.defective_quantity, 0) as defective_quantity
from public.work_orders wo
left join lateral (
  select sum(cut_quantity)::integer as cut_quantity
  from public.work_order_items where work_order_id = wo.id
) items on true
left join lateral (
  select
    sum(sc.quantity)::integer as assigned_quantity,
    (sum(sc.quantity) filter (where sc.status in ('submitted', 'paid')))::integer as submitted_quantity
  from public.sewing_cards sc
  join public.work_order_items woi on woi.id = sc.work_order_item_id
  where woi.work_order_id = wo.id and sc.status <> 'cancelled'
) cards on true
left join lateral (
  select sum(i.ok_quantity)::integer as ok_quantity, sum(i.defective_quantity)::integer as defective_quantity
  from public.inspections i
  join public.sewing_cards sc on sc.id = i.sewing_card_id
  join public.work_order_items woi on woi.id = sc.work_order_item_id
  where woi.work_order_id = wo.id
) checks on true;

create view public.thp_rows
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
join public.tailors t on t.id = sc.tailor_id
join public.work_order_items woi on woi.id = sc.work_order_item_id
join public.work_orders wo on wo.id = woi.work_order_id
join public.sizes s on s.id = woi.size_id
join public.fabric_colors fc on fc.id = woi.fabric_color_id
left join public.inspections i on i.sewing_card_id = sc.id
where sc.status <> 'cancelled'
group by wo.id, sc.id, t.name, t.code, s.name, fc.name;
