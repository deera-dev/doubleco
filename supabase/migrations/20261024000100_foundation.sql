create extension if not exists pg_trgm with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;

create type public.app_role as enum ('production_head', 'finishing_head', 'warehouse', 'owner', 'cutter', 'tailor');
create type public.tailor_status as enum ('active', 'inactive', 'left');
create type public.payment_account_type as enum ('bank', 'ewallet');
create type public.wage_category as enum ('S', 'M', 'L');
create type public.change_status as enum ('changed', 'follow_sample');
create type public.work_order_status as enum ('draft', 'cutting', 'sewing', 'done', 'cancelled');
create type public.sewing_card_status as enum ('taken', 'submitted', 'paid', 'cancelled');
create type public.inspection_status as enum ('pending', 'in_repair', 'done');
create type public.deduction_decision as enum ('pending', 'deduct', 'waive');
create type public.cash_advance_entry_type as enum ('opening_balance', 'advance', 'repayment', 'write_off');
create type public.payroll_period_status as enum ('open', 'locked');
create type public.payroll_line_status as enum ('draft', 'paid');
create type public.payroll_addition_kind as enum ('thr', 'bonus', 'other');
create type public.import_source as enum ('tailor_data', 'weekly_deposit');
create type public.print_document_type as enum ('sewing_card', 'work_order_card', 'thp', 'transfer_list');

create function public.app_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.raise_app_error(code text, details jsonb default '{}'::jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = code, detail = details::text;
end;
$$;

create function public.require_confirmation(warnings jsonb, confirmed boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if jsonb_array_length(warnings) > 0 and not confirmed then
    perform public.raise_app_error('CONFIRMATION_REQUIRED', jsonb_build_object('warnings', warnings));
  end if;
end;
$$;
