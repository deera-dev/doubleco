create extension if not exists pgcrypto with schema extensions;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived_username text := lower(trim(coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1)
  )));
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    derived_username,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), derived_username)
  );
  return new;
end;
$$;

create table public.account_activations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  failed_attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index account_activations_one_open_idx on public.account_activations (profile_id) where used_at is null;

alter table public.account_activations enable row level security;
revoke all on public.account_activations from anon, authenticated;

create function public.create_activation_code(p_username text, p_valid_days integer default 7)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
begin
  select id into target from public.profiles where username = lower(trim(p_username));
  if target is null then
    perform public.raise_app_error('PROFILE_NOT_FOUND', jsonb_build_object('username', p_username));
  end if;

  delete from public.account_activations where profile_id = target and used_at is null;
  insert into public.account_activations (profile_id, code_hash, expires_at)
  values (target, extensions.crypt(code, extensions.gen_salt('bf')), now() + make_interval(days => p_valid_days));
  return code;
end;
$$;

create function public.consume_activation_code(p_username text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  activation public.account_activations;
begin
  select a.* into activation
  from public.account_activations a
  join public.profiles p on p.id = a.profile_id
  where p.username = lower(trim(p_username)) and a.used_at is null and p.is_active
  for update of a;

  if activation.id is null or activation.expires_at < now() or activation.failed_attempts >= 5 then
    perform public.raise_app_error('ACTIVATION_INVALID');
  end if;

  if activation.code_hash <> extensions.crypt(upper(trim(p_code)), activation.code_hash) then
    update public.account_activations set failed_attempts = failed_attempts + 1 where id = activation.id;
    return null;
  end if;

  update public.account_activations set used_at = now() where id = activation.id;
  return activation.profile_id;
end;
$$;

revoke execute on function public.create_activation_code(text, integer), public.consume_activation_code(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_activation_code(text, text) to service_role;
