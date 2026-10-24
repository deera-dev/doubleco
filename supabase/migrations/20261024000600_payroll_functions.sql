create function public.tailor_advance_balance(p_tailor_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(case when entry_type in ('opening_balance', 'advance') then amount else -amount end), 0)::bigint
  from public.cash_advance_entries
  where tailor_id = p_tailor_id
$$;

create function public.record_cash_advance(
  p_tailor_id uuid,
  p_amount bigint,
  p_entry_on date default null,
  p_notes text default null,
  p_confirmed boolean default false,
  p_override_reason text default null
)
returns public.cash_advance_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_date date := coalesce(p_entry_on, public.app_today());
  warnings jsonb;
  created public.cash_advance_entries;
begin
  perform public.require_role('production_head');

  if not exists (select 1 from public.tailors where id = p_tailor_id and status = 'active') then
    perform public.raise_app_error('TAILOR_NOT_ACTIVE', jsonb_build_object('tailor_id', p_tailor_id));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('code', 'DUPLICATE_CASH_ADVANCE', 'entry_id', id, 'created_at', created_at)), '[]'::jsonb)
  into warnings
  from public.cash_advance_entries
  where tailor_id = p_tailor_id and entry_type = 'advance' and amount = p_amount and entry_on = entry_date;

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  insert into public.cash_advance_entries (tailor_id, entry_type, amount, entry_on, notes)
  values (p_tailor_id, 'advance', p_amount, entry_date, nullif(trim(p_notes), ''))
  returning * into created;
  return created;
end;
$$;

create function public.record_manual_repayment(
  p_tailor_id uuid,
  p_amount bigint,
  p_entry_on date default null,
  p_notes text default null,
  p_confirmed boolean default false,
  p_override_reason text default null
)
returns public.cash_advance_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  balance bigint := public.tailor_advance_balance(p_tailor_id);
  warnings jsonb := '[]'::jsonb;
  created public.cash_advance_entries;
begin
  perform public.require_role('production_head');

  if not exists (select 1 from public.tailors where id = p_tailor_id) then
    perform public.raise_app_error('TAILOR_NOT_FOUND');
  end if;

  if balance - p_amount < 0 then
    warnings := jsonb_build_array(jsonb_build_object('code', 'ADVANCE_BALANCE_NEGATIVE', 'balance', balance, 'after', balance - p_amount));
  end if;

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  insert into public.cash_advance_entries (tailor_id, entry_type, amount, entry_on, notes)
  values (p_tailor_id, 'repayment', p_amount, coalesce(p_entry_on, public.app_today()), nullif(trim(p_notes), ''))
  returning * into created;
  return created;
end;
$$;

create function public.mark_tailor_left(
  p_tailor_id uuid,
  p_left_on date default null,
  p_notes text default null,
  p_confirmed boolean default false,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  left_date date := coalesce(p_left_on, public.app_today());
  balance bigint;
  warnings jsonb;
begin
  perform public.require_role('production_head');

  perform 1 from public.tailors where id = p_tailor_id and status <> 'left' for update;
  if not found then
    perform public.raise_app_error('TAILOR_NOT_ACTIVE', jsonb_build_object('tailor_id', p_tailor_id));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('code', 'TAILOR_HAS_OPEN_CARD', 'card_number', number, 'status', status)), '[]'::jsonb)
  into warnings
  from public.sewing_cards
  where tailor_id = p_tailor_id
    and (status = 'taken' or inspection_status = 'in_repair' or (submitted_incomplete and remaining_delivered_on is null));

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(coalesce(p_override_reason, p_notes));

  perform set_config('app.tailor_leaving', 'on', true);
  update public.tailors set status = 'left', left_on = left_date where id = p_tailor_id;
  perform set_config('app.tailor_leaving', '', true);

  balance := public.tailor_advance_balance(p_tailor_id);
  if balance > 0 then
    insert into public.cash_advance_entries (tailor_id, entry_type, amount, entry_on, notes)
    values (p_tailor_id, 'write_off', balance, left_date, coalesce(nullif(trim(p_notes), ''), 'Kerugian: penjahit keluar'));
  end if;

  return jsonb_build_object('written_off', greatest(balance, 0));
end;
$$;

create function public.decide_deduction(
  p_deduction_proposal_id uuid,
  p_decision public.deduction_decision,
  p_notes text default null
)
returns public.deduction_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.deduction_proposals;
  previous_line uuid;
begin
  perform public.require_role('production_head', 'owner');

  if p_decision = 'pending' then
    perform public.raise_app_error('INVALID_DECISION');
  end if;

  select * into proposal from public.deduction_proposals where id = p_deduction_proposal_id for update;
  if proposal.id is null then
    perform public.raise_app_error('DEDUCTION_NOT_FOUND');
  end if;

  if proposal.payroll_line_id is not null and exists (
    select 1 from public.payroll_lines pl
    join public.payroll_periods pp on pp.id = pl.payroll_period_id
    where pl.id = proposal.payroll_line_id and pp.status = 'locked'
  ) then
    perform public.raise_app_error('DEDUCTION_ALREADY_APPLIED', jsonb_build_object('payroll_line_id', proposal.payroll_line_id));
  end if;

  previous_line := proposal.payroll_line_id;
  perform public.set_audit_reason(p_notes);

  update public.deduction_proposals
  set decision = p_decision,
      decision_notes = nullif(trim(p_notes), ''),
      decided_at = now(),
      decided_by = auth.uid(),
      payroll_line_id = case when p_decision = 'deduct' then payroll_line_id end
  where id = proposal.id
  returning * into proposal;

  if previous_line is not null then
    perform public.recompute_payroll_line(previous_line);
  end if;
  return proposal;
end;
$$;

create function public.recompute_payroll_line(p_payroll_line_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.payroll_lines pl
  set gross_wage = (select coalesce(sum(wage_amount), 0) from public.sewing_cards where payroll_line_id = pl.id),
      deduction_total = (select coalesce(sum(amount), 0) from public.deduction_proposals where payroll_line_id = pl.id),
      addition_total = (select coalesce(sum(amount), 0) from public.payroll_additions where payroll_line_id = pl.id),
      new_advance_total = (
        select coalesce(sum(amount), 0) from public.cash_advance_entries
        where payroll_line_id = pl.id and entry_type = 'advance'
      )
  where pl.id = p_payroll_line_id;
end;
$$;

create function public.lock_open_payroll_period(p_pay_on date)
returns public.payroll_periods
language plpgsql
set search_path = ''
as $$
declare
  period public.payroll_periods;
begin
  if extract(isodow from p_pay_on) <> 6 then
    perform public.raise_app_error('PAY_DATE_NOT_SATURDAY', jsonb_build_object('pay_on', p_pay_on));
  end if;

  insert into public.payroll_periods (starts_on, pay_on)
  values (p_pay_on - 5, p_pay_on)
  on conflict (pay_on) do nothing;

  select * into period from public.payroll_periods where pay_on = p_pay_on for update;
  if period.status = 'locked' then
    perform public.raise_app_error('PAYROLL_LOCKED', jsonb_build_object('pay_on', p_pay_on, 'locked_at', period.locked_at));
  end if;
  return period;
end;
$$;

create function public.ensure_payroll_line(p_payroll_period_id uuid, p_tailor_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  line_id uuid;
  balance bigint;
  previous_repayment bigint;
begin
  select id into line_id from public.payroll_lines
  where payroll_period_id = p_payroll_period_id and tailor_id = p_tailor_id;
  if line_id is not null then
    return line_id;
  end if;

  balance := public.tailor_advance_balance(p_tailor_id);
  select pl.advance_repayment into previous_repayment
  from public.payroll_lines pl
  join public.payroll_periods pp on pp.id = pl.payroll_period_id
  where pl.tailor_id = p_tailor_id and pp.status = 'locked'
  order by pp.pay_on desc
  limit 1;

  insert into public.payroll_lines (payroll_period_id, tailor_id, advance_repayment)
  values (p_payroll_period_id, p_tailor_id, greatest(least(coalesce(previous_repayment, 0), balance), 0))
  returning id into line_id;
  return line_id;
end;
$$;

create function public.build_payroll(p_pay_on date)
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
    where entry_type = 'advance' and payroll_line_id is null and import_batch_id is null and entry_on <= p_pay_on
  loop
    line_id := public.ensure_payroll_line(period.id, eligible_tailor);

    update public.sewing_cards set payroll_line_id = line_id
    where tailor_id = eligible_tailor and status = 'submitted' and payroll_line_id is null and submitted_on <= p_pay_on;

    update public.deduction_proposals set payroll_line_id = line_id
    where tailor_id = eligible_tailor and decision = 'deduct' and payroll_line_id is null;

    update public.cash_advance_entries set payroll_line_id = line_id
    where tailor_id = eligible_tailor and entry_type = 'advance' and payroll_line_id is null
      and import_batch_id is null and entry_on <= p_pay_on;
  end loop;

  perform public.recompute_payroll_line(id) from public.payroll_lines where payroll_period_id = period.id;
  return period;
end;
$$;

create function public.require_open_payroll_line(p_payroll_line_id uuid)
returns public.payroll_lines
language plpgsql
set search_path = ''
as $$
declare
  line public.payroll_lines;
begin
  select pl.* into line
  from public.payroll_lines pl
  where pl.id = p_payroll_line_id
  for update;
  if line.id is null then
    perform public.raise_app_error('PAYROLL_LINE_NOT_FOUND');
  end if;
  if (select status from public.payroll_periods where id = line.payroll_period_id) = 'locked' then
    perform public.raise_app_error('PAYROLL_LOCKED');
  end if;
  return line;
end;
$$;

create function public.set_payroll_repayment(
  p_payroll_line_id uuid,
  p_amount bigint,
  p_confirmed boolean default false,
  p_override_reason text default null
)
returns public.payroll_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  line public.payroll_lines;
  balance bigint;
  warnings jsonb := '[]'::jsonb;
  resulting_transfer bigint;
begin
  perform public.require_role('production_head');
  if p_amount < 0 then
    perform public.raise_app_error('INVALID_AMOUNT');
  end if;

  line := public.require_open_payroll_line(p_payroll_line_id);
  balance := public.tailor_advance_balance(line.tailor_id);
  resulting_transfer := line.transfer_amount + line.advance_repayment - p_amount;

  if balance - p_amount < 0 then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'ADVANCE_BALANCE_NEGATIVE', 'balance', balance, 'after', balance - p_amount));
  end if;
  if resulting_transfer < 0 then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'TRANSFER_NEGATIVE', 'transfer_amount', resulting_transfer));
  end if;

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  update public.payroll_lines set advance_repayment = p_amount where id = line.id returning * into line;
  return line;
end;
$$;

create function public.add_payroll_addition(
  p_pay_on date,
  p_tailor_id uuid,
  p_kind public.payroll_addition_kind,
  p_amount bigint,
  p_notes text default null
)
returns public.payroll_additions
language plpgsql
security definer
set search_path = ''
as $$
declare
  period public.payroll_periods;
  line_id uuid;
  created public.payroll_additions;
begin
  perform public.require_role('production_head');
  period := public.lock_open_payroll_period(p_pay_on);
  line_id := public.ensure_payroll_line(period.id, p_tailor_id);

  insert into public.payroll_additions (payroll_line_id, kind, amount, notes)
  values (line_id, p_kind, p_amount, nullif(trim(p_notes), ''))
  returning * into created;

  perform public.recompute_payroll_line(line_id);
  return created;
end;
$$;

create function public.remove_payroll_addition(p_payroll_addition_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  addition public.payroll_additions;
begin
  perform public.require_role('production_head');
  select * into addition from public.payroll_additions where id = p_payroll_addition_id;
  if addition.id is null then
    perform public.raise_app_error('PAYROLL_ADDITION_NOT_FOUND');
  end if;
  perform public.require_open_payroll_line(addition.payroll_line_id);
  perform public.set_audit_reason(p_reason);
  delete from public.payroll_additions where id = addition.id;
  perform public.recompute_payroll_line(addition.payroll_line_id);
end;
$$;

create function public.lock_payroll(
  p_pay_on date,
  p_confirmed boolean default false,
  p_override_reason text default null
)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  period public.payroll_periods;
  warnings jsonb;
begin
  perform public.require_role('production_head');
  period := public.build_payroll(p_pay_on);

  select coalesce(jsonb_agg(w), '[]'::jsonb) into warnings
  from (
    select jsonb_build_object('code', 'MISSING_PAYMENT_ACCOUNT', 'tailor_id', pl.tailor_id) as w
    from public.payroll_lines pl
    where pl.payroll_period_id = period.id and pl.transfer_amount > 0
      and not exists (select 1 from public.tailor_payment_accounts a where a.tailor_id = pl.tailor_id and a.is_active)
    union all
    select jsonb_build_object('code', 'TRANSFER_NEGATIVE', 'tailor_id', pl.tailor_id, 'transfer_amount', pl.transfer_amount)
    from public.payroll_lines pl
    where pl.payroll_period_id = period.id and pl.transfer_amount < 0
  ) found;

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  update public.payroll_lines pl
  set account_provider = a.provider,
      account_number = a.account_number,
      account_holder = a.account_holder
  from public.tailor_payment_accounts a
  where pl.payroll_period_id = period.id and a.tailor_id = pl.tailor_id and a.is_active;

  insert into public.cash_advance_entries (tailor_id, entry_type, amount, entry_on, payroll_line_id, notes)
  select tailor_id, 'repayment', advance_repayment, period.pay_on, id, 'Cicilan gajian'
  from public.payroll_lines
  where payroll_period_id = period.id and advance_repayment > 0;

  update public.sewing_cards sc set status = 'paid'
  from public.payroll_lines pl
  where pl.id = sc.payroll_line_id and pl.payroll_period_id = period.id;

  update public.payroll_periods set status = 'locked', locked_at = now(), locked_by = auth.uid()
  where id = period.id
  returning * into period;
  return period;
end;
$$;

create function public.mark_payroll_line_paid(p_payroll_line_id uuid)
returns public.payroll_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  line public.payroll_lines;
begin
  perform public.require_role('production_head');
  select * into line from public.payroll_lines where id = p_payroll_line_id for update;
  if line.id is null then
    perform public.raise_app_error('PAYROLL_LINE_NOT_FOUND');
  end if;
  if (select status from public.payroll_periods where id = line.payroll_period_id) <> 'locked' then
    perform public.raise_app_error('PAYROLL_NOT_LOCKED');
  end if;
  if line.status = 'paid' then
    perform public.raise_app_error('PAYROLL_LINE_ALREADY_PAID', jsonb_build_object(
      'paid_at', line.paid_at,
      'paid_by', (select display_name from public.profiles where id = line.paid_by)
    ));
  end if;

  update public.payroll_lines set status = 'paid', paid_at = now(), paid_by = auth.uid()
  where id = line.id
  returning * into line;
  return line;
end;
$$;

create function public.update_cash_advance_entry(
  p_entry_id uuid,
  p_amount bigint,
  p_entry_on date,
  p_notes text default null,
  p_reason text default null
)
returns public.cash_advance_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.cash_advance_entries;
begin
  perform public.require_role('production_head');
  select * into entry from public.cash_advance_entries where id = p_entry_id for update;
  if entry.id is null then
    perform public.raise_app_error('CASH_ADVANCE_ENTRY_NOT_FOUND');
  end if;
  if entry.entry_type = 'write_off' or (entry.entry_type = 'repayment' and entry.payroll_line_id is not null) then
    perform public.raise_app_error('IMMUTABLE_RECORD', jsonb_build_object('entry_type', entry.entry_type));
  end if;

  perform public.set_audit_reason(p_reason);
  update public.cash_advance_entries
  set amount = p_amount, entry_on = p_entry_on, notes = nullif(trim(p_notes), '')
  where id = entry.id
  returning * into entry;

  if entry.payroll_line_id is not null then
    perform public.recompute_payroll_line(entry.payroll_line_id);
  end if;
  return entry;
end;
$$;

create function public.delete_cash_advance_entry(p_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.cash_advance_entries;
begin
  perform public.require_role('production_head');
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;
  select * into entry from public.cash_advance_entries where id = p_entry_id for update;
  if entry.id is null then
    perform public.raise_app_error('CASH_ADVANCE_ENTRY_NOT_FOUND');
  end if;
  if entry.entry_type = 'write_off' or (entry.entry_type = 'repayment' and entry.payroll_line_id is not null) then
    perform public.raise_app_error('IMMUTABLE_RECORD', jsonb_build_object('entry_type', entry.entry_type));
  end if;

  perform public.set_audit_reason(p_reason);
  delete from public.cash_advance_entries where id = entry.id;
  if entry.payroll_line_id is not null then
    perform public.recompute_payroll_line(entry.payroll_line_id);
  end if;
end;
$$;

create function public.unlock_payroll(p_pay_on date, p_reason text)
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
  if exists (select 1 from public.payroll_lines where payroll_period_id = period.id and status = 'paid') then
    perform public.raise_app_error('PAYROLL_HAS_PAID_LINES', jsonb_build_object('pay_on', p_pay_on));
  end if;

  perform public.set_audit_reason(p_reason);
  perform set_config('app.payroll_unlocking', 'on', true);

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
