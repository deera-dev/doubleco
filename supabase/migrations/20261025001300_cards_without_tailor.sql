-- Cards are cut and printed before anyone knows who will sew them: the tailor writes their name on
-- the card, and the production head records the tailor when the card comes back (setoran).
alter table public.sewing_cards alter column tailor_id drop not null;

alter table public.sewing_cards
  add constraint sewing_cards_tailor_on_submit
  check (status in ('taken', 'cancelled') or tailor_id is not null);

create or replace function public.issue_sewing_cards(
  p_cards jsonb,
  p_taken_on date default null,
  p_confirmed boolean default false,
  p_override_reason text default null
)
returns setof public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken date := coalesce(p_taken_on, public.app_today());
  entry jsonb;
  item public.work_order_items;
  wo public.work_orders;
  category public.wage_category;
  rate bigint;
  tailor uuid;
  warnings jsonb := '[]'::jsonb;
  created public.sewing_cards;
  touched_work_orders uuid[] := '{}';
begin
  perform public.require_role('production_head');

  if coalesce(jsonb_array_length(p_cards), 0) = 0 then
    perform public.raise_app_error('CARDS_REQUIRED');
  end if;

  for entry in select * from jsonb_array_elements(p_cards) loop
    select * into item from public.work_order_items where id = (entry ->> 'work_order_item_id')::uuid for update;
    if item.id is null then
      perform public.raise_app_error('WORK_ORDER_ITEM_NOT_FOUND', jsonb_build_object('work_order_item_id', entry ->> 'work_order_item_id'));
    end if;
    select * into wo from public.work_orders where id = item.work_order_id;
    if wo.status = 'cancelled' then
      perform public.raise_app_error('WORK_ORDER_CANCELLED', jsonb_build_object('number', wo.number));
    end if;
    if item.cut_quantity is null then
      perform public.raise_app_error('NOT_CUT_YET', jsonb_build_object('work_order_item_id', item.id));
    end if;
    tailor := nullif(entry ->> 'tailor_id', '')::uuid;
    if tailor is not null then
      if not exists (select 1 from public.tailors where id = tailor and status = 'active') then
        perform public.raise_app_error('TAILOR_NOT_ACTIVE', jsonb_build_object('tailor_id', tailor));
      end if;
      warnings := warnings || public.sewing_card_issue_warnings(item.id, tailor);
    end if;
  end loop;

  select warnings || coalesce(jsonb_agg(jsonb_build_object('code', 'TAILOR_MULTIPLE_CARDS_IN_BATCH', 'tailor_id', tailor_id)), '[]'::jsonb)
  into warnings
  from (
    select value ->> 'tailor_id' as tailor_id
    from jsonb_array_elements(p_cards)
    where nullif(value ->> 'tailor_id', '') is not null
    group by 1
    having count(*) > 1
  ) repeated;

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  for entry in select * from jsonb_array_elements(p_cards) loop
    select woi.* into item from public.work_order_items woi where woi.id = (entry ->> 'work_order_item_id')::uuid;
    select p.wage_category into category
    from public.work_orders w join public.products p on p.id = w.product_id
    where w.id = item.work_order_id;
    if category is null then
      perform public.raise_app_error('PRODUCT_CATEGORY_MISSING', jsonb_build_object('work_order_id', item.work_order_id));
    end if;
    rate := public.wage_rate_on(category, taken);
    if rate is null then
      perform public.raise_app_error('WAGE_RATE_MISSING', jsonb_build_object('wage_category', category, 'on', taken));
    end if;

    insert into public.sewing_cards (
      number, work_order_item_id, tailor_id, quantity, taken_on, wage_category, wage_rate, warning_override_reason
    )
    values (
      public.next_document_number('KJ', taken), item.id, nullif(entry ->> 'tailor_id', '')::uuid,
      (entry ->> 'quantity')::integer, taken, category, rate,
      case when jsonb_array_length(warnings) > 0 then p_override_reason end
    )
    returning * into created;
    touched_work_orders := array_append(touched_work_orders, item.work_order_id);
    return next created;
  end loop;

  perform public.refresh_work_order_status(id) from unnest(touched_work_orders) as t(id) group by id;
end;
$$;

drop function public.submit_sewing_card(text, date, boolean, text, boolean, text);

create function public.submit_sewing_card(
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
      tailor_id = coalesce(p_tailor_id, tailor_id),
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

grant execute on function public.submit_sewing_card(text, date, boolean, text, boolean, text, uuid) to authenticated;

create or replace view public.outstanding_sewing_cards
with (security_invoker = true)
as
select
  sc.id,
  sc.number,
  sc.tailor_id,
  t.code as tailor_code,
  t.name as tailor_name,
  wo.number as work_order_number,
  p.code as product_code,
  s.name as size_name,
  fc.name as color_name,
  sc.quantity,
  sc.taken_on,
  sc.status,
  sc.inspection_status,
  sc.submitted_incomplete and sc.remaining_delivered_on is null as remaining_pending,
  public.app_today() - sc.taken_on as age_days
from public.sewing_cards sc
left join public.tailors t on t.id = sc.tailor_id
join public.work_order_items woi on woi.id = sc.work_order_item_id
join public.work_orders wo on wo.id = woi.work_order_id
join public.products p on p.id = wo.product_id
join public.sizes s on s.id = woi.size_id
join public.fabric_colors fc on fc.id = woi.fabric_color_id
where sc.status = 'taken'
   or sc.inspection_status = 'in_repair'
   or (sc.submitted_incomplete and sc.remaining_delivered_on is null);
