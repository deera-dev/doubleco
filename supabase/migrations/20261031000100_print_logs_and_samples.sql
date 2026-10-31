-- 1. Every printout leaves a mark, so it is clear what was already printed. Printing again is
--    always allowed; each print is one row.
create table public.print_logs (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('work_order_card', 'thp', 'deposit_recap', 'tailor_book')),
  -- Work order id, Saturday of the payroll week, or "<tailor id or all>|<from>|<to>".
  document_key text not null check (length(document_key) between 1 and 120),
  printed_at timestamptz not null default now(),
  printed_by uuid references public.profiles (id) default auth.uid()
);

create index print_logs_document_idx on public.print_logs (document_type, document_key, printed_at desc);

alter table public.print_logs enable row level security;
revoke all on public.print_logs from anon;
create policy print_logs_select_staff on public.print_logs
for select to authenticated using (public.is_staff());
create policy print_logs_insert_staff on public.print_logs
for insert to authenticated with check (public.is_staff());
grant select, insert on public.print_logs to authenticated;

-- 2. Tukang sampel: a tailor who also sews samples, paid per sample.
alter table public.tailors add column is_sample_maker boolean not null default false;

-- 3. Samples ride on payroll additions, so the transfer already counts them.
alter table public.payroll_additions
  add column quantity integer check (quantity > 0),
  add column sample_rate bigint check (sample_rate > 0),
  add constraint payroll_additions_sample check (
    (sample_rate is null) or (quantity is not null and amount = quantity * sample_rate)
  );

create or replace function public.set_payroll_samples(
  p_pay_on date,
  p_tailor_id uuid,
  p_high integer,
  p_low integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  period public.payroll_periods;
  line_id uuid;
  high_rate constant bigint := 100000;
  low_rate constant bigint := 50000;
begin
  perform public.require_role('production_head');
  if coalesce(p_high, 0) < 0 or coalesce(p_low, 0) < 0 or coalesce(p_high, 0) > 1000 or coalesce(p_low, 0) > 1000 then
    perform public.raise_app_error('INVALID_AMOUNT');
  end if;
  if not exists (select 1 from public.tailors where id = p_tailor_id) then
    perform public.raise_app_error('TAILOR_NOT_FOUND');
  end if;

  -- Refuses a locked week or a date that is not a Saturday.
  period := public.lock_open_payroll_period(p_pay_on);
  line_id := public.ensure_payroll_line(period.id, p_tailor_id);

  delete from public.payroll_additions where payroll_line_id = line_id and sample_rate is not null;
  if coalesce(p_high, 0) > 0 then
    insert into public.payroll_additions (payroll_line_id, kind, amount, notes, quantity, sample_rate)
    values (line_id, 'other', p_high * high_rate, 'Sampel 100rb', p_high, high_rate);
  end if;
  if coalesce(p_low, 0) > 0 then
    insert into public.payroll_additions (payroll_line_id, kind, amount, notes, quantity, sample_rate)
    values (line_id, 'other', p_low * low_rate, 'Sampel 50rb', p_low, low_rate);
  end if;

  perform public.prune_payroll_line(line_id);
  perform public.recompute_payroll_line(line_id);
  return line_id;
end;
$$;

grant execute on function public.set_payroll_samples(date, uuid, integer, integer) to authenticated;
