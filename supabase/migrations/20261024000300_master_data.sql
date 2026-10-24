create table public.tailors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = trim(code) and length(code) > 0),
  name text not null check (length(trim(name)) > 0),
  phone text,
  status public.tailor_status not null default 'active',
  left_on date,
  notes text,
  profile_id uuid unique references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tailors_left_on_matches_status check ((status = 'left') = (left_on is not null))
);

create index tailors_name_trgm_idx on public.tailors using gin (lower(name) extensions.gin_trgm_ops);

create trigger tailors_set_updated_at
before update on public.tailors
for each row execute function public.set_updated_at();

create function public.guard_tailor_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'left' and old.status <> 'left'
     and coalesce(current_setting('app.tailor_leaving', true), '') <> 'on' then
    perform public.raise_app_error('USE_MARK_TAILOR_LEFT');
  end if;
  if new.status <> 'left' then
    new.left_on := null;
  end if;
  return new;
end;
$$;

create trigger tailors_guard_status
before update of status on public.tailors
for each row execute function public.guard_tailor_status();

create table public.tailor_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  tailor_id uuid not null references public.tailors (id),
  account_type public.payment_account_type not null,
  provider text not null check (length(trim(provider)) > 0),
  account_number text not null check (account_number ~ '^[0-9]+$'),
  account_holder text not null check (length(trim(account_holder)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint tailor_payment_accounts_deactivation check (is_active = (deactivated_at is null))
);

create unique index tailor_payment_accounts_one_active_idx on public.tailor_payment_accounts (tailor_id) where is_active;
create index tailor_payment_accounts_number_idx on public.tailor_payment_accounts (account_number);

create table public.cutters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cutters_name_idx on public.cutters (lower(name));

create trigger cutters_set_updated_at
before update on public.cutters
for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code = trim(code) and length(code) > 0),
  name text,
  wage_category public.wage_category,
  sample_photo_public_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index products_code_idx on public.products (lower(code));

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table public.fabrics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index fabrics_name_idx on public.fabrics (lower(name));

create trigger fabrics_set_updated_at
before update on public.fabrics
for each row execute function public.set_updated_at();

create table public.fabric_colors (
  id uuid primary key default gen_random_uuid(),
  fabric_id uuid not null references public.fabrics (id),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index fabric_colors_name_idx on public.fabric_colors (fabric_id, lower(name));

create trigger fabric_colors_set_updated_at
before update on public.fabric_colors
for each row execute function public.set_updated_at();

create table public.sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sizes_name_idx on public.sizes (lower(name));

create trigger sizes_set_updated_at
before update on public.sizes
for each row execute function public.set_updated_at();

create table public.wage_rates (
  id uuid primary key default gen_random_uuid(),
  wage_category public.wage_category not null,
  amount bigint not null check (amount > 0),
  effective_from date not null,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (wage_category, effective_from)
);

create function public.wage_rate_on(category public.wage_category, on_date date)
returns bigint
language sql
stable
set search_path = ''
as $$
  select amount
  from public.wage_rates
  where wage_category = category and effective_from <= on_date
  order by effective_from desc
  limit 1
$$;

create table public.print_settings (
  id uuid primary key default gen_random_uuid(),
  document_type public.print_document_type not null unique,
  offset_top_mm numeric(4, 1) not null default 0 check (offset_top_mm between -20 and 20),
  offset_left_mm numeric(4, 1) not null default 0 check (offset_left_mm between -20 and 20),
  updated_at timestamptz not null default now()
);

create trigger print_settings_set_updated_at
before update on public.print_settings
for each row execute function public.set_updated_at();

insert into public.wage_rates (wage_category, amount, effective_from, created_by) values
  ('S', 20000, '2026-01-01', null),
  ('M', 25000, '2026-01-01', null),
  ('L', 30000, '2026-01-01', null);

insert into public.print_settings (document_type) values
  ('sewing_card'), ('work_order_card'), ('thp'), ('transfer_list');

create function public.find_similar_tailors(search_name text)
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
  )
  select *
  from candidates
  where edit_distance <= case when length(trim(search_name)) >= 5 then 2 else 1 end
     or similarity >= 0.4
  order by edit_distance, similarity desc
  limit 10
$$;

create function public.find_account_number_owners(search_number text)
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
$$;
