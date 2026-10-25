create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_by uuid references public.profiles (id) default auth.uid(),
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create trigger app_settings_audit
after insert or update or delete on public.app_settings
for each row execute function public.write_audit_log();

insert into public.app_settings (key, value, updated_by)
values ('employee_inactive_retention_days', '90'::jsonb, null);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon;

create policy app_settings_select_staff on public.app_settings
for select to authenticated
using (public.is_staff());

create policy app_settings_update_production_head on public.app_settings
for update to authenticated
using (public.has_role('production_head'))
with check (public.has_role('production_head'));

create function public.employee_retention_days()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'employee_inactive_retention_days'), 90)
$$;

drop function public.mark_tailor_left(uuid, date, text, boolean, text);
drop trigger tailors_guard_status on public.tailors;
drop function public.guard_tailor_status();
drop view public.employees;

update public.tailors set status = 'inactive', left_on = null where status = 'left';

alter table public.tailors drop constraint tailors_left_on_matches_status;
alter table public.tailors drop column left_on;
alter table public.tailors
  add column inactive_since timestamptz,
  add column archived_at timestamptz,
  add constraint tailors_status_active_inactive check (status in ('active', 'inactive')),
  add constraint tailors_inactive_since_matches_status check ((status = 'inactive') = (inactive_since is not null));

alter table public.tailors drop constraint tailors_code_key;
create unique index tailors_code_live_idx on public.tailors (code) where archived_at is null;

alter table public.cutters
  add column inactive_since timestamptz,
  add column archived_at timestamptz;

update public.tailors set inactive_since = now() where status = 'inactive';
update public.cutters set inactive_since = now() where not is_active;

alter table public.cutters
  add constraint cutters_inactive_since_matches_status check (is_active = (inactive_since is null));

drop index public.cutters_name_idx;
create unique index cutters_name_live_idx on public.cutters (lower(name)) where archived_at is null;

create function public.track_tailor_inactive_since()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'inactive' and (tg_op = 'INSERT' or old.status <> 'inactive') then
    new.inactive_since := now();
  elsif new.status = 'active' then
    new.inactive_since := null;
  end if;
  return new;
end;
$$;

create trigger tailors_track_inactive_since
before insert or update of status on public.tailors
for each row execute function public.track_tailor_inactive_since();

create function public.track_cutter_inactive_since()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.is_active and (tg_op = 'INSERT' or old.is_active) then
    new.inactive_since := now();
  elsif new.is_active then
    new.inactive_since := null;
  end if;
  return new;
end;
$$;

create trigger cutters_track_inactive_since
before insert or update of is_active on public.cutters
for each row execute function public.track_cutter_inactive_since();

create or replace function public.find_similar_tailors(search_name text)
returns table (id uuid, code text, name text, edit_distance integer, similarity real)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select
      t.id,
      t.code,
      t.name,
      extensions.levenshtein(lower(t.name), lower(trim(search_name))) as edit_distance,
      extensions.similarity(lower(t.name), lower(trim(search_name))) as similarity
    from public.tailors t
    where t.archived_at is null
  )
  select *
  from candidates
  where edit_distance <= case when length(trim(search_name)) >= 5 then 2 else 1 end
     or similarity >= 0.4
  order by edit_distance, similarity desc
  limit 10
$$;

create or replace function public.find_account_number_owners(search_number text)
returns table (tailor_id uuid, tailor_code text, tailor_name text, account_holder text, is_active boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.code, t.name, a.account_holder, a.is_active
  from public.tailor_payment_accounts a
  join public.tailors t on t.id = a.tailor_id
  where a.account_number = regexp_replace(search_number, '[^0-9]', '', 'g')
    and t.archived_at is null
$$;

create or replace function public.save_tailor(
  p_code text,
  p_name text,
  p_tailor_id uuid default null,
  p_phone text default null,
  p_notes text default null,
  p_account jsonb default null,
  p_confirmed boolean default false,
  p_override_reason text default null
)
returns public.tailors
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.tailors;
  warnings jsonb := '[]'::jsonb;
  account_number text := regexp_replace(coalesce(p_account ->> 'account_number', ''), '[^0-9]', '', 'g');
  current_account public.tailor_payment_accounts;
begin
  perform public.require_role('production_head');

  if length(trim(coalesce(p_code, ''))) = 0 or length(trim(coalesce(p_name, ''))) = 0 then
    perform public.raise_app_error('INVALID_INPUT');
  end if;

  if exists (
    select 1 from public.tailors
    where code = trim(p_code) and id is distinct from p_tailor_id and archived_at is null
  ) then
    perform public.raise_app_error('TAILOR_CODE_TAKEN', jsonb_build_object(
      'code', trim(p_code),
      'name', (select name from public.tailors where code = trim(p_code) and archived_at is null)
    ));
  end if;

  select warnings || coalesce(jsonb_agg(jsonb_build_object('code', 'SIMILAR_TAILOR_NAME', 'name', s.name, 'tailor_code', s.code)), '[]'::jsonb)
  into warnings
  from public.find_similar_tailors(p_name) s
  where s.id is distinct from p_tailor_id;

  if p_account is not null and account_number <> '' then
    select warnings || coalesce(jsonb_agg(jsonb_build_object(
      'code', 'ACCOUNT_NUMBER_USED', 'name', o.tailor_name, 'tailor_code', o.tailor_code
    )), '[]'::jsonb)
    into warnings
    from public.find_account_number_owners(account_number) o
    where o.tailor_id is distinct from p_tailor_id and o.is_active;
  end if;

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  if p_tailor_id is null then
    insert into public.tailors (code, name, phone, notes)
    values (trim(p_code), trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_notes), ''))
    returning * into saved;
  else
    update public.tailors
    set code = trim(p_code), name = trim(p_name),
        phone = nullif(trim(p_phone), ''), notes = nullif(trim(p_notes), '')
    where id = p_tailor_id
    returning * into saved;
    if saved.id is null then
      perform public.raise_app_error('TAILOR_NOT_FOUND');
    end if;
  end if;

  select * into current_account
  from public.tailor_payment_accounts
  where tailor_id = saved.id and is_active;

  if p_account is null or account_number = '' then
    if current_account.id is not null and p_account is not null then
      update public.tailor_payment_accounts set is_active = false, deactivated_at = now()
      where id = current_account.id;
    end if;
  elsif current_account.id is null
     or (current_account.account_type::text, current_account.provider, current_account.account_number, current_account.account_holder)
        is distinct from (p_account ->> 'account_type', trim(p_account ->> 'provider'), account_number, trim(p_account ->> 'account_holder')) then
    if current_account.id is not null then
      update public.tailor_payment_accounts set is_active = false, deactivated_at = now()
      where id = current_account.id;
    end if;
    insert into public.tailor_payment_accounts (tailor_id, account_type, provider, account_number, account_holder)
    values (
      saved.id,
      (p_account ->> 'account_type')::public.payment_account_type,
      trim(p_account ->> 'provider'),
      account_number,
      trim(p_account ->> 'account_holder')
    );
  end if;

  return saved;
end;
$$;

create function public.purge_inactive_employees()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  retention integer := public.employee_retention_days();
  cutoff timestamptz := now() - make_interval(days => public.employee_retention_days());
  candidate record;
  balance bigint;
  deleted integer := 0;
  archived integer := 0;
begin
  perform public.require_role('production_head');
  perform public.set_audit_reason(format('Dihapus otomatis setelah %s hari tidak aktif', retention));

  for candidate in
    select id from public.tailors
    where status = 'inactive' and archived_at is null and inactive_since <= cutoff
    for update
  loop
    if exists (select 1 from public.sewing_cards where tailor_id = candidate.id)
       or exists (select 1 from public.cash_advance_entries where tailor_id = candidate.id)
       or exists (select 1 from public.payroll_lines where tailor_id = candidate.id)
       or exists (select 1 from public.deduction_proposals where tailor_id = candidate.id)
       or exists (select 1 from public.legacy_wage_records where tailor_id = candidate.id)
       or exists (select 1 from public.legacy_deposit_records where tailor_id = candidate.id) then
      balance := public.tailor_advance_balance(candidate.id);
      if balance > 0 then
        insert into public.cash_advance_entries (tailor_id, entry_type, amount, entry_on, notes)
        values (candidate.id, 'write_off', balance, public.app_today(),
                format('Kerugian: tidak aktif lebih dari %s hari', retention));
      end if;
      update public.tailors set archived_at = now() where id = candidate.id;
      archived := archived + 1;
    else
      delete from public.tailor_payment_accounts where tailor_id = candidate.id;
      delete from public.tailors where id = candidate.id;
      deleted := deleted + 1;
    end if;
  end loop;

  for candidate in
    select id from public.cutters
    where not is_active and archived_at is null and inactive_since <= cutoff
    for update
  loop
    if exists (select 1 from public.work_orders where cutter_id = candidate.id) then
      update public.cutters set archived_at = now() where id = candidate.id;
      archived := archived + 1;
    else
      delete from public.cutters where id = candidate.id;
      deleted := deleted + 1;
    end if;
  end loop;

  return jsonb_build_object('deleted', deleted, 'archived', archived);
end;
$$;

create view public.employees
with (security_invoker = true)
as
select
  'tailor'::text as employee_type,
  t.id,
  t.code,
  t.name,
  t.phone,
  t.status::text as status,
  t.status = 'active' as is_active,
  t.inactive_since,
  t.created_at
from public.tailors t
where t.archived_at is null
union all
select
  'cutter'::text,
  c.id,
  null,
  c.name,
  null,
  case when c.is_active then 'active' else 'inactive' end,
  c.is_active,
  c.inactive_since,
  c.created_at
from public.cutters c
where c.archived_at is null;

revoke all on public.employees from anon;

grant execute on function public.employee_retention_days(), public.purge_inactive_employees()
  to authenticated;
