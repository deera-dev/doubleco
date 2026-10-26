-- One bundle is one card, so a cancelled card takes its pcs out of the cut result, and a
-- corrected quantity corrects it. Before, the difference stayed as "sisa" to hand out again,
-- from the time cards were split by hand.

create or replace function public.cancel_sewing_card(p_number text, p_reason text)
returns public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
  previous_line uuid;
begin
  perform public.require_role('production_head');
  card := public.lock_sewing_card(p_number);
  perform public.require_card_correctable(card);
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;
  if exists (select 1 from public.inspections where sewing_card_id = card.id) then
    perform public.raise_app_error('CARD_ALREADY_INSPECTED', jsonb_build_object('number', card.number));
  end if;

  perform public.set_audit_reason(p_reason);
  previous_line := card.payroll_line_id;
  update public.sewing_cards
  set status = 'cancelled', cancelled_reason = trim(p_reason), payroll_line_id = null,
      submitted_on = null, submitted_at = null, submitted_by = null,
      submitted_incomplete = false, remaining_notes = null, remaining_delivered_on = null
  where id = card.id
  returning * into card;

  update public.work_order_items
  set cut_quantity = nullif(cut_quantity - card.quantity, 0)
  where id = card.work_order_item_id;

  perform public.prune_payroll_line(previous_line);
  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;

create or replace function public.update_sewing_card(
  p_number text,
  p_quantity integer default null,
  p_tailor_id uuid default null,
  p_reason text default null
)
returns public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
  previous_line uuid;
  tailor_changed boolean;
begin
  perform public.require_role('production_head');
  card := public.lock_sewing_card(p_number);
  perform public.require_card_correctable(card);
  if p_tailor_id is not null and not exists (select 1 from public.tailors where id = p_tailor_id and status = 'active') then
    perform public.raise_app_error('TAILOR_NOT_ACTIVE', jsonb_build_object('tailor_id', p_tailor_id));
  end if;

  tailor_changed := p_tailor_id is not null and p_tailor_id is distinct from card.tailor_id;
  if card.status = 'submitted' and tailor_changed
     and exists (select 1 from public.inspections where sewing_card_id = card.id) then
    perform public.raise_app_error('CARD_ALREADY_INSPECTED', jsonb_build_object('number', card.number));
  end if;

  perform 1 from public.work_order_items where id = card.work_order_item_id for update;
  -- The card is the bundle: a corrected quantity corrects the cut result with it.
  if p_quantity is not null and p_quantity <> card.quantity then
    update public.work_order_items
    set cut_quantity = coalesce(cut_quantity, 0) + p_quantity - card.quantity
    where id = card.work_order_item_id;
  end if;
  perform public.set_audit_reason(p_reason);
  previous_line := card.payroll_line_id;
  update public.sewing_cards
  set quantity = coalesce(p_quantity, quantity),
      tailor_id = coalesce(p_tailor_id, tailor_id),
      -- Another tailor: the card leaves the old payroll line and joins the new tailor's on the next rekap.
      payroll_line_id = case when tailor_changed then null else payroll_line_id end
  where id = card.id
  returning * into card;

  if tailor_changed then
    perform public.prune_payroll_line(previous_line);
  elsif previous_line is not null then
    perform public.recompute_payroll_line(previous_line);
  end if;
  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;


-- Repair WOs whose cards were cancelled before this fix: the cut result is what the live cards hold.
update public.work_order_items woi
set cut_quantity = nullif(live.quantity, 0)
from (
  select woi2.id, coalesce(sum(sc.quantity) filter (where sc.status <> 'cancelled'), 0)::integer as quantity
  from public.work_order_items woi2
  join public.sewing_cards sc on sc.work_order_item_id = woi2.id
  group by woi2.id
  having count(*) filter (where sc.status = 'cancelled') > 0
) live
where woi.id = live.id and woi.cut_quantity is distinct from nullif(live.quantity, 0);

select public.refresh_work_order_status(id) from public.work_orders where status <> 'cancelled';
