-- Kasbon is normally paid out together with the Saturday wage (it adds to the transfer). Some
-- are handed over directly instead (cash, or transferred right away, like those already paid
-- last week before the app). Those still count as debt to repay, but never join a transfer.
alter table public.cash_advance_entries add column given_on date;

create or replace function public.set_advance_given(p_entry_id uuid, p_given boolean)
returns public.cash_advance_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.cash_advance_entries;
  previous_line uuid;
begin
  perform public.require_role('production_head');
  select * into entry from public.cash_advance_entries where id = p_entry_id for update;
  if entry.id is null then
    perform public.raise_app_error('CASH_ADVANCE_ENTRY_NOT_FOUND');
  end if;
  if entry.entry_type <> 'advance' then
    perform public.raise_app_error('INVALID_AMOUNT');
  end if;
  if entry.payroll_line_id is not null and exists (
    select 1 from public.payroll_lines pl join public.payroll_periods pp on pp.id = pl.payroll_period_id
    where pl.id = entry.payroll_line_id and pp.status = 'locked'
  ) then
    perform public.raise_app_error('ENTRY_IN_LOCKED_PAYROLL', jsonb_build_object(
      'pay_on', (select pp.pay_on from public.payroll_lines pl
                 join public.payroll_periods pp on pp.id = pl.payroll_period_id
                 where pl.id = entry.payroll_line_id)
    ));
  end if;

  previous_line := entry.payroll_line_id;
  update public.cash_advance_entries
  set given_on = case when p_given then coalesce(given_on, entry_on) else null end,
      -- Given directly: out of the open payroll. Back to "with the wage": the next rekap picks it up.
      payroll_line_id = case when p_given then null else payroll_line_id end
  where id = entry.id
  returning * into entry;

  if p_given and previous_line is not null then
    perform public.prune_payroll_line(previous_line);
  end if;
  return entry;
end;
$$;

grant execute on function public.set_advance_given(uuid, boolean) to authenticated;

-- Same as before, except kasbon handed over directly stays out of the transfer.
create or replace function public.build_payroll(p_pay_on date)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  period public.payroll_periods;
  eligible_tailor uuid;
  line_id uuid;
begin
  perform public.require_role('production_head');
  period := public.lock_open_payroll_period(p_pay_on);

  for eligible_tailor in
    select tailor_id from public.sewing_cards
    where status = 'submitted' and payroll_line_id is null and submitted_on <= p_pay_on
    union
    select tailor_id from public.deduction_proposals
    where decision = 'deduct' and payroll_line_id is null
    union
    select tailor_id from public.cash_advance_entries
    where entry_type = 'advance' and payroll_line_id is null and import_batch_id is null
      and given_on is null and entry_on <= p_pay_on
  loop
    line_id := public.ensure_payroll_line(period.id, eligible_tailor);

    update public.sewing_cards set payroll_line_id = line_id
    where tailor_id = eligible_tailor and status = 'submitted' and payroll_line_id is null and submitted_on <= p_pay_on;

    update public.deduction_proposals set payroll_line_id = line_id
    where tailor_id = eligible_tailor and decision = 'deduct' and payroll_line_id is null;

    update public.cash_advance_entries set payroll_line_id = line_id
    where tailor_id = eligible_tailor and entry_type = 'advance' and payroll_line_id is null
      and import_batch_id is null and given_on is null and entry_on <= p_pay_on;
  end loop;

  perform public.recompute_payroll_line(id) from public.payroll_lines where payroll_period_id = period.id;
  return period;
end;
$$;
