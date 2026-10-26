-- A card handed in under the wrong tailor or with the wrong quantity can be corrected (or
-- cancelled) until its payroll week is locked. Inspected cards keep their tailor: delete the
-- inspection first, since its potongan belongs to that tailor.

-- Recompute a payroll line after a card left it, and drop it when nothing is left to pay.
create or replace function public.prune_payroll_line(p_payroll_line_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_payroll_line_id is null then
    return;
  end if;
  perform public.recompute_payroll_line(p_payroll_line_id);
  delete from public.payroll_lines pl
  where pl.id = p_payroll_line_id
    and pl.status = 'draft'
    and pl.gross_wage = 0 and pl.deduction_total = 0 and pl.addition_total = 0 and pl.new_advance_total = 0
    and not exists (select 1 from public.sewing_cards where payroll_line_id = pl.id)
    and not exists (select 1 from public.cash_advance_entries where payroll_line_id = pl.id)
    and not exists (select 1 from public.deduction_proposals where payroll_line_id = pl.id)
    and not exists (select 1 from public.payroll_additions where payroll_line_id = pl.id)
    and exists (
      select 1 from public.payroll_periods pp where pp.id = pl.payroll_period_id and pp.status = 'open'
    );
end;
$$;

-- Submitted cards can change only while their payroll week is open.
create or replace function public.require_card_correctable(card public.sewing_cards)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if card.status = 'paid' or (card.payroll_line_id is not null and exists (
    select 1 from public.payroll_lines pl join public.payroll_periods pp on pp.id = pl.payroll_period_id
    where pl.id = card.payroll_line_id and pp.status = 'locked'
  )) then
    perform public.raise_app_error('PAYROLL_LOCKED', jsonb_build_object(
      'number', card.number,
      'pay_on', (
        select pp.pay_on from public.payroll_lines pl
        join public.payroll_periods pp on pp.id = pl.payroll_period_id
        where pl.id = card.payroll_line_id
      )
    ));
  end if;
  if card.status not in ('taken', 'submitted') then
    perform public.raise_app_error('CARD_NOT_EDITABLE', jsonb_build_object('number', card.number, 'status', card.status));
  end if;
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

  perform public.prune_payroll_line(previous_line);
  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;

create or replace function public.unsubmit_sewing_card(p_number text, p_reason text)
returns public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
  line_id uuid;
begin
  perform public.require_role('production_head');
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;
  card := public.lock_sewing_card(p_number);
  perform public.require_card_correctable(card);

  if card.status <> 'submitted' then
    perform public.raise_app_error('CARD_NOT_SUBMITTED', jsonb_build_object('number', card.number, 'status', card.status));
  end if;
  if exists (select 1 from public.inspections where sewing_card_id = card.id) then
    perform public.raise_app_error('CARD_ALREADY_INSPECTED', jsonb_build_object('number', card.number));
  end if;

  line_id := card.payroll_line_id;
  perform public.set_audit_reason(p_reason);
  update public.sewing_cards
  set status = 'taken', submitted_on = null, submitted_at = null, submitted_by = null,
      submitted_incomplete = false, remaining_notes = null, remaining_delivered_on = null,
      payroll_line_id = null
  where id = card.id
  returning * into card;

  perform public.prune_payroll_line(line_id);
  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;
