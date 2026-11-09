-- CMT luar: outside sewing workshops that take sewing cards too. Each CMT has its own S/M/L price
-- per pcs; a card it sews takes that price for the card's category. CMT cards stay outside the
-- Saturday payroll and show on the THP.

-- 1. The CMT list (Master Data).
create table if not exists public.cmt_vendors (
  id uuid primary key default gen_random_uuid(),
  code text not null check (length(code) between 1 and 20),
  name text not null check (length(name) between 1 and 60),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cmt_vendors
  add column if not exists rate_s bigint not null default 0 check (rate_s >= 0),
  add column if not exists rate_m bigint not null default 0 check (rate_m >= 0),
  add column if not exists rate_l bigint not null default 0 check (rate_l >= 0);

-- The CMT's price per pcs for a card category.
create or replace function public.cmt_rate_for(p_cmt_vendor_id uuid, p_category public.wage_category)
returns bigint
language sql
stable
set search_path = ''
as $$
  select case p_category when 'S' then rate_s when 'M' then rate_m else rate_l end
  from public.cmt_vendors where id = p_cmt_vendor_id
$$;

create unique index if not exists cmt_vendors_code_key_idx on public.cmt_vendors (public.label_key(code));

drop trigger if exists cmt_vendors_set_updated_at on public.cmt_vendors;
create trigger cmt_vendors_set_updated_at
before update on public.cmt_vendors
for each row execute function public.set_updated_at();

drop trigger if exists cmt_vendors_audit on public.cmt_vendors;
create trigger cmt_vendors_audit
after insert or update or delete on public.cmt_vendors
for each row execute function public.write_audit_log();

drop trigger if exists cmt_vendors_normalize on public.cmt_vendors;
create trigger cmt_vendors_normalize before insert or update on public.cmt_vendors
for each row execute function public.normalize_labels('name', 'code');

alter table public.cmt_vendors enable row level security;
revoke all on public.cmt_vendors from anon;

drop policy if exists cmt_vendors_select_staff on public.cmt_vendors;
create policy cmt_vendors_select_staff on public.cmt_vendors
for select to authenticated using (public.is_staff());
drop policy if exists cmt_vendors_insert_production_head on public.cmt_vendors;
create policy cmt_vendors_insert_production_head on public.cmt_vendors
for insert to authenticated with check (public.has_role('production_head'));
drop policy if exists cmt_vendors_update_production_head on public.cmt_vendors;
create policy cmt_vendors_update_production_head on public.cmt_vendors
for update to authenticated using (public.has_role('production_head')) with check (public.has_role('production_head'));
drop policy if exists cmt_vendors_delete_production_head on public.cmt_vendors;
create policy cmt_vendors_delete_production_head on public.cmt_vendors
for delete to authenticated using (public.has_role('production_head'));

grant select, insert, update, delete on public.cmt_vendors to authenticated;

-- 2. No price per WO: the price comes from the CMT's S/M/L list (an earlier draft had one).
drop function if exists public.set_work_order_cmt_rate(uuid, bigint);
alter table public.work_orders drop column if exists cmt_rate;

-- 3. A card is sewn by a tailor or by a CMT, never both.
alter table public.sewing_cards
  add column if not exists cmt_vendor_id uuid references public.cmt_vendors (id),
  -- The CMT price per pcs when the card was handed to the CMT, so later price changes keep history.
  add column if not exists cmt_rate bigint;

alter table public.sewing_cards drop constraint if exists sewing_cards_one_maker;
alter table public.sewing_cards
  add constraint sewing_cards_one_maker check (tailor_id is null or cmt_vendor_id is null);

-- A handed-in card needs whoever sewed it: a tailor or a CMT.
alter table public.sewing_cards drop constraint if exists sewing_cards_tailor_on_submit;
alter table public.sewing_cards
  add constraint sewing_cards_tailor_on_submit
  check (status in ('taken', 'cancelled') or tailor_id is not null or cmt_vendor_id is not null);

create index if not exists sewing_cards_cmt_vendor_idx on public.sewing_cards (cmt_vendor_id)
  where cmt_vendor_id is not null;

-- 4. Setor: the card is handed in by a tailor or by a CMT.
drop function if exists public.submit_sewing_card(text, date, boolean, text, boolean, text, uuid);

create or replace function public.submit_sewing_card(
  p_number text,
  p_submitted_on date default null,
  p_incomplete boolean default false,
  p_remaining_notes text default null,
  p_confirmed boolean default false,
  p_override_reason text default null,
  p_tailor_id uuid default null,
  p_cmt_vendor_id uuid default null
)
returns public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
  submitted date := coalesce(p_submitted_on, public.app_today());
  warnings jsonb := '[]'::jsonb;
begin
  perform public.require_role('production_head');
  card := public.lock_sewing_card(p_number);

  if card.status = 'cancelled' then
    perform public.raise_app_error('CARD_CANCELLED', jsonb_build_object('number', card.number));
  end if;
  if card.status in ('submitted', 'paid') then
    perform public.raise_app_error('CARD_ALREADY_SUBMITTED', jsonb_build_object(
      'number', card.number,
      'submitted_on', card.submitted_on,
      'submitted_at', card.submitted_at,
      'submitted_by', public.visible_display_name(card.submitted_by)
    ));
  end if;
  if p_cmt_vendor_id is not null then
    if not exists (select 1 from public.cmt_vendors where id = p_cmt_vendor_id and is_active) then
      perform public.raise_app_error('CMT_NOT_ACTIVE', jsonb_build_object('cmt_vendor_id', p_cmt_vendor_id));
    end if;
  else
    if coalesce(p_tailor_id, card.tailor_id) is null then
      perform public.raise_app_error('TAILOR_REQUIRED', jsonb_build_object('number', card.number));
    end if;
    if p_tailor_id is not null and not exists (select 1 from public.tailors where id = p_tailor_id and status = 'active') then
      perform public.raise_app_error('TAILOR_NOT_ACTIVE', jsonb_build_object('tailor_id', p_tailor_id));
    end if;
  end if;
  if submitted < card.taken_on then
    perform public.raise_app_error('SUBMITTED_BEFORE_TAKEN', jsonb_build_object('taken_on', card.taken_on));
  end if;
  if extract(isodow from submitted) = 7 then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'SUNDAY_IS_HOLIDAY', 'on', submitted));
  end if;

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  update public.sewing_cards
  set status = 'submitted',
      tailor_id = case when p_cmt_vendor_id is not null then null else coalesce(p_tailor_id, tailor_id) end,
      cmt_vendor_id = p_cmt_vendor_id,
      cmt_rate = case when p_cmt_vendor_id is not null
        then public.cmt_rate_for(p_cmt_vendor_id, wage_category) end,
      submitted_on = submitted,
      submitted_at = now(),
      submitted_by = auth.uid(),
      submitted_incomplete = p_incomplete,
      remaining_notes = case when p_incomplete then nullif(trim(coalesce(p_remaining_notes, '')), '') end
  where id = card.id
  returning * into card;

  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;

grant execute on function public.submit_sewing_card(text, date, boolean, text, boolean, text, uuid, uuid) to authenticated;

-- 5. Correcting a card can move it between a tailor and a CMT.
drop function if exists public.update_sewing_card(text, integer, uuid, text);

create or replace function public.update_sewing_card(
  p_number text,
  p_quantity integer default null,
  p_tailor_id uuid default null,
  p_reason text default null,
  p_cmt_vendor_id uuid default null
)
returns public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
  previous_line uuid;
  maker_changed boolean;
begin
  perform public.require_role('production_head');
  card := public.lock_sewing_card(p_number);
  perform public.require_card_correctable(card);
  if p_tailor_id is not null and p_cmt_vendor_id is not null then
    perform public.raise_app_error('INVALID_INPUT');
  end if;
  if p_tailor_id is not null and not exists (select 1 from public.tailors where id = p_tailor_id and status = 'active') then
    perform public.raise_app_error('TAILOR_NOT_ACTIVE', jsonb_build_object('tailor_id', p_tailor_id));
  end if;
  if p_cmt_vendor_id is not null and not exists (select 1 from public.cmt_vendors where id = p_cmt_vendor_id and is_active) then
    perform public.raise_app_error('CMT_NOT_ACTIVE', jsonb_build_object('cmt_vendor_id', p_cmt_vendor_id));
  end if;

  maker_changed := (p_tailor_id is not null and p_tailor_id is distinct from card.tailor_id)
    or (p_cmt_vendor_id is not null and p_cmt_vendor_id is distinct from card.cmt_vendor_id);
  if card.status = 'submitted' and maker_changed
     and exists (select 1 from public.inspections where sewing_card_id = card.id) then
    perform public.raise_app_error('CARD_ALREADY_INSPECTED', jsonb_build_object('number', card.number));
  end if;

  perform 1 from public.work_order_items where id = card.work_order_item_id for update;
  perform public.set_audit_reason(p_reason);
  previous_line := card.payroll_line_id;
  update public.sewing_cards
  set quantity = coalesce(p_quantity, quantity),
      tailor_id = case
        when p_cmt_vendor_id is not null then null
        else coalesce(p_tailor_id, tailor_id)
      end,
      cmt_vendor_id = case
        when p_tailor_id is not null then null
        else coalesce(p_cmt_vendor_id, cmt_vendor_id)
      end,
      cmt_rate = case
        when p_tailor_id is not null then null
        when p_cmt_vendor_id is not null then public.cmt_rate_for(p_cmt_vendor_id, wage_category)
        else cmt_rate
      end,
      -- Another maker: the card leaves the old payroll line; a tailor's joins on the next rekap.
      payroll_line_id = case when maker_changed then null else payroll_line_id end
  where id = card.id
  returning * into card;

  if maker_changed then
    perform public.prune_payroll_line(previous_line);
  elsif previous_line is not null then
    perform public.recompute_payroll_line(previous_line);
  end if;
  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;

grant execute on function public.update_sewing_card(text, integer, uuid, text, uuid) to authenticated;

-- 6. CMT cards never enter the Saturday payroll.
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
      and tailor_id is not null and cmt_vendor_id is null
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
    where tailor_id = eligible_tailor and status = 'submitted' and payroll_line_id is null
      and submitted_on <= p_pay_on and cmt_vendor_id is null;

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

-- 7. A defect on a CMT card is not a tailor's potongan: no deduction proposal for it.
create or replace function public.record_inspection(
  p_number text,
  p_ok_quantity integer,
  p_repairable_quantity integer,
  p_defective_quantity integer,
  p_notes text default null,
  p_inspected_on date default null
)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
  finalized integer;
  next_round smallint;
  created public.inspections;
begin
  perform public.require_role('production_head', 'finishing_head');
  card := public.lock_sewing_card(p_number);

  if card.status not in ('submitted', 'paid') then
    perform public.raise_app_error('CARD_NOT_SUBMITTED', jsonb_build_object('number', card.number, 'status', card.status));
  end if;
  if card.inspection_status = 'done' then
    perform public.raise_app_error('INSPECTION_ALREADY_DONE', jsonb_build_object('number', card.number));
  end if;

  select coalesce(sum(ok_quantity + defective_quantity), 0), coalesce(max(round), 0) + 1
  into finalized, next_round
  from public.inspections where sewing_card_id = card.id;

  if p_ok_quantity + p_repairable_quantity + p_defective_quantity > card.quantity - finalized then
    perform public.raise_app_error('INSPECTION_EXCEEDS_QUANTITY', jsonb_build_object('available', card.quantity - finalized));
  end if;

  insert into public.inspections (
    sewing_card_id, round, inspected_on, ok_quantity, repairable_quantity, defective_quantity, notes
  )
  values (
    card.id, next_round, coalesce(p_inspected_on, public.app_today()),
    p_ok_quantity, p_repairable_quantity, p_defective_quantity, nullif(trim(p_notes), '')
  )
  returning * into created;

  perform public.refresh_inspection_status(card.id);

  if p_defective_quantity > 0 and card.tailor_id is not null then
    insert into public.deduction_proposals (inspection_id, tailor_id, quantity, amount)
    values (created.id, card.tailor_id, p_defective_quantity, p_defective_quantity * card.wage_rate);
  end if;

  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return created;
end;
$$;
