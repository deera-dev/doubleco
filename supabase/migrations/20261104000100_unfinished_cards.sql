-- Belum tuntas: a card handed in before it was 100% done. It is paid in full; the rest of the
-- work is checked the following week and the card is marked complete once it comes in.

-- 1. One flag the card lists can filter and count on.
alter table public.sewing_cards
  add column remaining_pending boolean
  generated always as (submitted_incomplete and remaining_delivered_on is null) stored;

create index sewing_cards_remaining_pending_idx on public.sewing_cards (status)
  where remaining_pending;

-- 2. Marking a card as not yet done no longer asks how much is left; a note stays optional.
create or replace function public.submit_sewing_card(
  p_number text,
  p_submitted_on date default null,
  p_incomplete boolean default false,
  p_remaining_notes text default null,
  p_confirmed boolean default false,
  p_override_reason text default null,
  p_tailor_id uuid default null
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
  if coalesce(p_tailor_id, card.tailor_id) is null then
    perform public.raise_app_error('TAILOR_REQUIRED', jsonb_build_object('number', card.number));
  end if;
  if p_tailor_id is not null and not exists (select 1 from public.tailors where id = p_tailor_id and status = 'active') then
    perform public.raise_app_error('TAILOR_NOT_ACTIVE', jsonb_build_object('tailor_id', p_tailor_id));
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
      tailor_id = coalesce(p_tailor_id, tailor_id),
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

