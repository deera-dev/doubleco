create function public.save_tailor(
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
    where code = trim(p_code) and id is distinct from p_tailor_id
  ) then
    perform public.raise_app_error('TAILOR_CODE_TAKEN', jsonb_build_object(
      'code', trim(p_code),
      'name', (select name from public.tailors where code = trim(p_code))
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

grant execute on function public.save_tailor(text, text, uuid, text, text, jsonb, boolean, text) to authenticated;
