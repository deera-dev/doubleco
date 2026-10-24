create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  pay_on date not null unique,
  status public.payroll_period_status not null default 'open',
  locked_at timestamptz,
  locked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint payroll_periods_pay_on_saturday check (extract(isodow from pay_on) = 6),
  constraint payroll_periods_week check (starts_on = pay_on - 5),
  constraint payroll_periods_lock check ((status = 'locked') = (locked_at is not null))
);

create table public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods (id),
  tailor_id uuid not null references public.tailors (id),
  gross_wage bigint not null default 0 check (gross_wage >= 0),
  advance_repayment bigint not null default 0 check (advance_repayment >= 0),
  deduction_total bigint not null default 0 check (deduction_total >= 0),
  addition_total bigint not null default 0 check (addition_total >= 0),
  new_advance_total bigint not null default 0 check (new_advance_total >= 0),
  transfer_amount bigint generated always as (
    gross_wage - advance_repayment - deduction_total + addition_total + new_advance_total
  ) stored,
  account_provider text,
  account_number text,
  account_holder text,
  status public.payroll_line_status not null default 'draft',
  paid_at timestamptz,
  paid_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, tailor_id),
  constraint payroll_lines_paid check ((status = 'paid') = (paid_at is not null))
);

create trigger payroll_lines_set_updated_at
before update on public.payroll_lines
for each row execute function public.set_updated_at();

create table public.payroll_additions (
  id uuid primary key default gen_random_uuid(),
  payroll_line_id uuid not null references public.payroll_lines (id),
  kind public.payroll_addition_kind not null,
  amount bigint not null check (amount > 0),
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null check (number = trim(number) and length(number) > 0),
  ordered_on date not null default public.app_today(),
  product_id uuid not null references public.products (id),
  pattern_code text,
  fabric_id uuid not null references public.fabrics (id),
  fabric_combination text,
  cutter_id uuid not null references public.cutters (id),
  change_status public.change_status not null,
  change_notes text,
  additional_info text,
  sample_photo_public_id text,
  status public.work_order_status not null default 'draft',
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_orders_change_notes check (change_status = 'follow_sample' or length(trim(coalesce(change_notes, ''))) > 0)
);

create unique index work_orders_number_idx on public.work_orders (lower(number));

create trigger work_orders_set_updated_at
before update on public.work_orders
for each row execute function public.set_updated_at();

create table public.work_order_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id),
  size_id uuid not null references public.sizes (id),
  fabric_color_id uuid not null references public.fabric_colors (id),
  cut_quantity integer check (cut_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_order_id, size_id, fabric_color_id)
);

create trigger work_order_items_set_updated_at
before update on public.work_order_items
for each row execute function public.set_updated_at();

create function public.check_work_order_item_color()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.work_orders wo
    join public.fabric_colors fc on fc.fabric_id = wo.fabric_id
    where wo.id = new.work_order_id and fc.id = new.fabric_color_id
  ) then
    perform public.raise_app_error('COLOR_NOT_IN_FABRIC', jsonb_build_object('fabric_color_id', new.fabric_color_id));
  end if;
  return new;
end;
$$;

create trigger work_order_items_check_color
before insert or update of fabric_color_id, work_order_id on public.work_order_items
for each row execute function public.check_work_order_item_color();

create table public.document_counters (
  id uuid primary key default gen_random_uuid(),
  prefix text not null,
  period text not null,
  last_value integer not null default 0,
  unique (prefix, period)
);

create table public.sewing_cards (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  work_order_item_id uuid not null references public.work_order_items (id),
  tailor_id uuid not null references public.tailors (id),
  quantity integer not null check (quantity > 0),
  taken_on date not null,
  wage_category public.wage_category not null,
  wage_rate bigint not null check (wage_rate > 0),
  wage_amount bigint generated always as (quantity * wage_rate) stored,
  status public.sewing_card_status not null default 'taken',
  submitted_on date,
  submitted_at timestamptz,
  submitted_by uuid references public.profiles (id),
  submitted_incomplete boolean not null default false,
  remaining_notes text,
  remaining_delivered_on date,
  inspection_status public.inspection_status not null default 'pending',
  collected_at timestamptz,
  collected_by uuid references public.profiles (id),
  payroll_line_id uuid references public.payroll_lines (id),
  warning_override_reason text,
  cancelled_reason text,
  print_count integer not null default 0,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sewing_cards_submission check ((status in ('submitted', 'paid')) = (submitted_on is not null)),
  constraint sewing_cards_paid check ((status = 'paid') <= (payroll_line_id is not null)),
  constraint sewing_cards_remaining check (submitted_incomplete or remaining_delivered_on is null)
);

create index sewing_cards_tailor_idx on public.sewing_cards (tailor_id, status);
create index sewing_cards_item_idx on public.sewing_cards (work_order_item_id);
create index sewing_cards_payroll_line_idx on public.sewing_cards (payroll_line_id);

create trigger sewing_cards_set_updated_at
before update on public.sewing_cards
for each row execute function public.set_updated_at();

create function public.guard_sewing_card()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  available integer;
begin
  if tg_op = 'UPDATE' and old.status = 'paid'
     and (new.quantity, new.wage_rate, new.tailor_id, new.work_order_item_id)
         is distinct from (old.quantity, old.wage_rate, old.tailor_id, old.work_order_item_id) then
    perform public.raise_app_error('CARD_ALREADY_PAID', jsonb_build_object('number', old.number));
  end if;

  if new.status <> 'cancelled' then
    select woi.cut_quantity - coalesce(sum(sc.quantity), 0)
    into available
    from public.work_order_items woi
    left join public.sewing_cards sc
      on sc.work_order_item_id = woi.id and sc.status <> 'cancelled' and sc.id <> new.id
    where woi.id = new.work_order_item_id
    group by woi.cut_quantity;

    if available is null or new.quantity > available then
      perform public.raise_app_error('QUANTITY_EXCEEDS_CUT', jsonb_build_object('available', coalesce(available, 0)));
    end if;
  end if;
  return new;
end;
$$;

create trigger sewing_cards_guard
before insert or update on public.sewing_cards
for each row execute function public.guard_sewing_card();

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  sewing_card_id uuid not null references public.sewing_cards (id),
  round smallint not null check (round > 0),
  inspected_on date not null,
  ok_quantity integer not null default 0 check (ok_quantity >= 0),
  repairable_quantity integer not null default 0 check (repairable_quantity >= 0),
  defective_quantity integer not null default 0 check (defective_quantity >= 0),
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (sewing_card_id, round),
  constraint inspections_not_empty check (ok_quantity + repairable_quantity + defective_quantity > 0)
);

create table public.deduction_proposals (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null unique references public.inspections (id),
  tailor_id uuid not null references public.tailors (id),
  quantity integer not null check (quantity > 0),
  amount bigint not null check (amount > 0),
  decision public.deduction_decision not null default 'pending',
  decision_notes text,
  decided_at timestamptz,
  decided_by uuid references public.profiles (id),
  payroll_line_id uuid references public.payroll_lines (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deduction_proposals_applied check (payroll_line_id is null or decision = 'deduct')
);

create trigger deduction_proposals_set_updated_at
before update on public.deduction_proposals
for each row execute function public.set_updated_at();

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source public.import_source not null,
  file_name text not null,
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index import_batches_sha_idx on public.import_batches (file_sha256);

create table public.cash_advance_entries (
  id uuid primary key default gen_random_uuid(),
  tailor_id uuid not null references public.tailors (id),
  entry_type public.cash_advance_entry_type not null,
  amount bigint not null check (amount > 0),
  entry_on date not null,
  payroll_line_id uuid references public.payroll_lines (id),
  notes text,
  import_batch_id uuid references public.import_batches (id),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index cash_advance_entries_tailor_idx on public.cash_advance_entries (tailor_id, entry_on);
create index cash_advance_entries_payroll_line_idx on public.cash_advance_entries (payroll_line_id);

create function public.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.raise_app_error('IMMUTABLE_RECORD', jsonb_build_object('table', tg_table_name));
  return null;
end;
$$;

create function public.guard_cash_advance_entry_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.tailor_id, new.entry_type, new.amount, new.entry_on, new.import_batch_id)
     is distinct from (old.tailor_id, old.entry_type, old.amount, old.entry_on, old.import_batch_id)
     or (old.payroll_line_id is not null and new.payroll_line_id is distinct from old.payroll_line_id) then
    perform public.raise_app_error('IMMUTABLE_RECORD', jsonb_build_object('table', tg_table_name));
  end if;
  return new;
end;
$$;

create trigger cash_advance_entries_no_delete
before delete on public.cash_advance_entries
for each row execute function public.forbid_mutation();

create trigger cash_advance_entries_guard_update
before update on public.cash_advance_entries
for each row execute function public.guard_cash_advance_entry_update();

create table public.legacy_wage_records (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches (id),
  tailor_id uuid not null references public.tailors (id),
  pay_on date not null,
  wage bigint not null check (wage >= 0),
  created_at timestamptz not null default now(),
  unique (tailor_id, pay_on)
);

create table public.legacy_deposit_records (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches (id),
  tailor_id uuid not null references public.tailors (id),
  pay_on date not null check (extract(isodow from pay_on) = 6),
  weekday smallint not null check (weekday between 1 and 6),
  wage_category public.wage_category not null,
  quantity integer not null check (quantity > 0),
  unit_rate bigint not null check (unit_rate > 0),
  created_at timestamptz not null default now(),
  unique (tailor_id, pay_on, weekday, wage_category)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  reason text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index audit_logs_record_idx on public.audit_logs (table_name, record_id);

create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function public.forbid_mutation();

create table public.idempotency_keys (
  key uuid primary key,
  profile_id uuid not null references public.profiles (id) default auth.uid(),
  operation text not null,
  response jsonb,
  created_at timestamptz not null default now()
);

create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, reason, actor_id)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    nullif(current_setting('app.audit_reason', true), ''),
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  audited text;
begin
  foreach audited in array array[
    'tailors', 'tailor_payment_accounts', 'products', 'wage_rates', 'work_orders', 'work_order_items',
    'sewing_cards', 'inspections', 'deduction_proposals', 'cash_advance_entries',
    'payroll_periods', 'payroll_lines', 'payroll_additions'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      audited || '_audit', audited
    );
  end loop;
end;
$$;
