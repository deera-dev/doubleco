alter type public.app_role add value if not exists 'master';

create or replace function public.has_role(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_app_role()::text = 'master' or public.current_app_role() = any (roles),
    false
  )
$$;
