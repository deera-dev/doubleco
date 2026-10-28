-- Old data: part of a WO was already paid last week (outside the app), the rest is paid this
-- week, but every handed-in card lands in the current week. Cards can be moved to another
-- open payroll week; that week is then locked and marked paid as the record of the old payment.
create or replace function public.move_cards_to_payroll_week(
  p_numbers text[],
  p_pay_on date,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
  card_number text;
  period public.payroll_periods;
  target_line uuid;
  previous_line uuid;
  moved integer := 0;
begin
  perform public.require_role('production_head');
  if coalesce(array_length(p_numbers, 1), 0) = 0 then
    perform public.raise_app_error('CARDS_REQUIRED');
  end if;

  -- Refuses a locked week or a date that is not a Saturday.
  period := public.lock_open_payroll_period(p_pay_on);
  perform public.set_audit_reason(coalesce(nullif(trim(p_reason), ''), 'Pindah minggu gajian'));

  foreach card_number in array p_numbers loop
    card := public.lock_sewing_card(card_number);
    perform public.require_card_correctable(card);
    if card.status <> 'submitted' or card.tailor_id is null then
      perform public.raise_app_error('CARD_NOT_SUBMITTED', jsonb_build_object('number', card.number, 'status', card.status));
    end if;

    target_line := public.ensure_payroll_line(period.id, card.tailor_id);
    if card.payroll_line_id is distinct from target_line then
      previous_line := card.payroll_line_id;
      update public.sewing_cards
      -- A card cannot be paid in a week before it was handed in.
      set payroll_line_id = target_line, submitted_on = least(submitted_on, p_pay_on)
      where id = card.id;
      perform public.recompute_payroll_line(target_line);
      perform public.prune_payroll_line(previous_line);
      moved := moved + 1;
    end if;
  end loop;
  return moved;
end;
$$;

grant execute on function public.move_cards_to_payroll_week(text[], date, text) to authenticated;
