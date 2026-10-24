create function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role()::text = 'master', false)
$$;

create function public.visible_display_name(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.role::text = 'master' and not public.is_master() then 'Sistem'
    else p.display_name
  end
  from public.profiles p
  where p.id = p_profile_id
$$;

create function public.visible_profile_id(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.role::text = 'master' and not public.is_master() then null
    else p.id
  end
  from public.profiles p
  where p.id = p_profile_id
$$;

drop policy profiles_select on public.profiles;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_master()
  or (public.has_role('production_head', 'owner') and role::text is distinct from 'master')
);

create or replace view public.audit_logs_visible
with (security_invoker = true)
as
select
  a.id,
  a.table_name,
  a.record_id,
  a.action,
  a.old_data,
  a.new_data,
  a.reason,
  public.visible_profile_id(a.actor_id) as actor_id,
  public.visible_display_name(a.actor_id) as actor_name,
  a.created_at
from public.audit_logs a;

revoke all on public.audit_logs_visible from anon;

create or replace function public.submit_sewing_card(
  p_number text,
  p_submitted_on date default null,
  p_incomplete boolean default false,
  p_remaining_notes text default null,
  p_confirmed boolean default false,
  p_override_reason text default null
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
  if submitted < card.taken_on then
    perform public.raise_app_error('SUBMITTED_BEFORE_TAKEN', jsonb_build_object('taken_on', card.taken_on));
  end if;
  if p_incomplete and length(trim(coalesce(p_remaining_notes, ''))) = 0 then
    perform public.raise_app_error('REMAINING_NOTES_REQUIRED');
  end if;

  if extract(isodow from submitted) = 7 then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'SUNDAY_IS_HOLIDAY', 'on', submitted));
  end if;

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  update public.sewing_cards
  set status = 'submitted',
      submitted_on = submitted,
      submitted_at = now(),
      submitted_by = auth.uid(),
      submitted_incomplete = p_incomplete,
      remaining_notes = case when p_incomplete then trim(p_remaining_notes) end
  where id = card.id
  returning * into card;

  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;

create or replace function public.mark_payroll_line_paid(p_payroll_line_id uuid)
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
      'paid_by', public.visible_display_name(line.paid_by)
    ));
  end if;

  update public.payroll_lines set status = 'paid', paid_at = now(), paid_by = auth.uid()
  where id = line.id
  returning * into line;
  return line;
end;
$$;

grant execute on function public.is_master(), public.visible_display_name(uuid), public.visible_profile_id(uuid)
  to authenticated;
