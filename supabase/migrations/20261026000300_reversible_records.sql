-- Test runs and wrong inputs must be undoable: a paid mark can be taken back, a locked payroll can
-- be reopened even after payments were marked, and any kasbon entry can be deleted once the payroll
-- it belongs to is open.

create or replace function public.unmark_payroll_line_paid(p_payroll_line_id uuid, p_reason text)
returns public.payroll_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  line public.payroll_lines;
begin
  perform public.require_role('production_head', 'owner');
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;
  select * into line from public.payroll_lines where id = p_payroll_line_id for update;
  if line.id is null then
    perform public.raise_app_error('PAYROLL_LINE_NOT_FOUND');
  end if;
  if line.status <> 'paid' then
    perform public.raise_app_error('PAYROLL_LINE_NOT_PAID');
  end if;

  perform public.set_audit_reason(p_reason);
  update public.payroll_lines set status = 'draft', paid_at = null, paid_by = null
  where id = line.id
  returning * into line;
  return line;
end;
$$;

grant execute on function public.unmark_payroll_line_paid(uuid, text) to authenticated;

create or replace function public.unlock_payroll(p_pay_on date, p_reason text)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  period public.payroll_periods;
begin
  perform public.require_role('production_head', 'owner');
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;

  select * into period from public.payroll_periods where pay_on = p_pay_on for update;
  if period.id is null or period.status <> 'locked' then
    perform public.raise_app_error('PAYROLL_NOT_LOCKED', jsonb_build_object('pay_on', p_pay_on));
  end if;

  perform public.set_audit_reason(p_reason);
  perform set_config('app.payroll_unlocking', 'on', true);

  -- Reopening takes back the paid marks too; they are set again after the next lock.
  update public.payroll_lines set status = 'draft', paid_at = null, paid_by = null
  where payroll_period_id = period.id and status = 'paid';

  delete from public.cash_advance_entries e
  using public.payroll_lines pl
  where pl.id = e.payroll_line_id and pl.payroll_period_id = period.id and e.entry_type = 'repayment';

  update public.sewing_cards sc set status = 'submitted'
  from public.payroll_lines pl
  where pl.id = sc.payroll_line_id and pl.payroll_period_id = period.id;

  update public.payroll_lines
  set account_provider = null, account_number = null, account_holder = null
  where payroll_period_id = period.id;

  update public.payroll_periods set status = 'open', locked_at = null, locked_by = null
  where id = period.id
  returning * into period;

  perform set_config('app.payroll_unlocking', '', true);
  return period;
end;
$$;

create or replace function public.delete_cash_advance_entry(p_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.cash_advance_entries;
  locked_pay_on date;
begin
  perform public.require_role('production_head');
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;
  select * into entry from public.cash_advance_entries where id = p_entry_id for update;
  if entry.id is null then
    perform public.raise_app_error('CASH_ADVANCE_ENTRY_NOT_FOUND');
  end if;

  select pp.pay_on into locked_pay_on
  from public.payroll_lines pl
  join public.payroll_periods pp on pp.id = pl.payroll_period_id
  where pl.id = entry.payroll_line_id and pp.status = 'locked';
  if locked_pay_on is not null then
    perform public.raise_app_error('ENTRY_IN_LOCKED_PAYROLL', jsonb_build_object('pay_on', locked_pay_on));
  end if;

  perform public.set_audit_reason(p_reason);
  delete from public.cash_advance_entries where id = entry.id;
  if entry.payroll_line_id is not null then
    perform public.recompute_payroll_line(entry.payroll_line_id);
  end if;
end;
$$;
