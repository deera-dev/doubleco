create function public.set_audit_reason(reason text)
returns void
language sql
set search_path = ''
as $$
  select set_config('app.audit_reason', coalesce(reason, ''), true);
$$;

create function public.next_document_number(p_prefix text, p_on_date date)
returns text
language plpgsql
set search_path = ''
as $$
declare
  next_value integer;
  month_key text := to_char(p_on_date, 'YYMM');
begin
  insert into public.document_counters as dc (prefix, period, last_value)
  values (p_prefix, month_key, 1)
  on conflict on constraint document_counters_prefix_period_key do update set last_value = dc.last_value + 1
  returning dc.last_value into next_value;
  return p_prefix || '-' || month_key || '-' || lpad(next_value::text, 4, '0');
end;
$$;

create function public.suggest_work_order_number(p_product_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  suffix integer := 1;
begin
  select 'WO_' || code into base from public.products where id = p_product_id;
  if base is null then
    perform public.raise_app_error('PRODUCT_NOT_FOUND');
  end if;
  candidate := base;
  while exists (select 1 from public.work_orders where lower(number) = lower(candidate)) loop
    suffix := suffix + 1;
    candidate := base || '_' || suffix;
  end loop;
  return candidate;
end;
$$;

create function public.refresh_work_order_status(p_work_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  total_cut integer;
  total_assigned integer;
  open_cards integer;
  next_status public.work_order_status;
begin
  if (select status from public.work_orders where id = p_work_order_id) = 'cancelled' then
    return;
  end if;

  select coalesce(sum(cut_quantity), 0) into total_cut
  from public.work_order_items where work_order_id = p_work_order_id;

  select coalesce(sum(sc.quantity), 0), count(*) filter (where sc.status = 'taken' or sc.inspection_status = 'in_repair'
         or (sc.submitted_incomplete and sc.remaining_delivered_on is null))
  into total_assigned, open_cards
  from public.sewing_cards sc
  join public.work_order_items woi on woi.id = sc.work_order_item_id
  where woi.work_order_id = p_work_order_id and sc.status <> 'cancelled';

  next_status := case
    when total_cut = 0 then 'draft'
    when total_assigned = 0 then 'cutting'
    when total_assigned < total_cut or open_cards > 0 then 'sewing'
    else 'done'
  end;

  update public.work_orders set status = next_status where id = p_work_order_id and status <> next_status;
end;
$$;

create function public.create_work_order(
  p_product_id uuid,
  p_fabric_id uuid,
  p_cutter_id uuid,
  p_change_status public.change_status,
  p_size_ids uuid[],
  p_fabric_color_ids uuid[],
  p_number text default null,
  p_ordered_on date default null,
  p_pattern_code text default null,
  p_fabric_combination text default null,
  p_change_notes text default null,
  p_additional_info text default null,
  p_sample_photo_public_id text default null,
  p_confirmed boolean default false,
  p_override_reason text default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_number text;
  warnings jsonb := '[]'::jsonb;
  created public.work_orders;
begin
  perform public.require_role('production_head');

  if not exists (select 1 from public.products where id = p_product_id and is_active and wage_category is not null) then
    perform public.raise_app_error('PRODUCT_CATEGORY_MISSING', jsonb_build_object('product_id', p_product_id));
  end if;

  if coalesce(cardinality(p_size_ids), 0) = 0 or coalesce(cardinality(p_fabric_color_ids), 0) = 0 then
    perform public.raise_app_error('WORK_ORDER_ITEMS_REQUIRED');
  end if;

  chosen_number := coalesce(nullif(trim(p_number), ''), public.suggest_work_order_number(p_product_id));
  if exists (select 1 from public.work_orders where lower(number) = lower(chosen_number)) then
    perform public.raise_app_error('WORK_ORDER_NUMBER_TAKEN', jsonb_build_object(
      'number', chosen_number,
      'suggestion', public.suggest_work_order_number(p_product_id)
    ));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('code', 'SIMILAR_WORK_ORDER_ACTIVE', 'work_order_number', wo.number)), '[]'::jsonb)
  into warnings
  from public.work_orders wo
  where wo.product_id = p_product_id
    and wo.fabric_id = p_fabric_id
    and wo.status not in ('done', 'cancelled')
    and exists (
      select 1 from public.work_order_items woi
      where woi.work_order_id = wo.id and woi.size_id = any (p_size_ids)
    );

  perform public.require_confirmation(warnings, p_confirmed);
  perform public.set_audit_reason(p_override_reason);

  insert into public.work_orders (
    number, ordered_on, product_id, pattern_code, fabric_id, fabric_combination, cutter_id,
    change_status, change_notes, additional_info, sample_photo_public_id
  )
  values (
    chosen_number, coalesce(p_ordered_on, public.app_today()), p_product_id, nullif(trim(p_pattern_code), ''),
    p_fabric_id, nullif(trim(p_fabric_combination), ''), p_cutter_id, p_change_status,
    nullif(trim(p_change_notes), ''), nullif(trim(p_additional_info), ''), p_sample_photo_public_id
  )
  returning * into created;

  insert into public.work_order_items (work_order_id, size_id, fabric_color_id)
  select created.id, size_id, fabric_color_id
  from (select distinct unnest(p_size_ids) as size_id) s
  cross join (select distinct unnest(p_fabric_color_ids) as fabric_color_id) c;

  return created;
end;
$$;

create function public.record_cut_results(p_items jsonb)
returns setof public.work_order_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry jsonb;
  item public.work_order_items;
  assigned integer;
  touched_work_orders uuid[] := '{}';
begin
  perform public.require_role('production_head');

  for entry in select * from jsonb_array_elements(p_items) loop
    select * into item from public.work_order_items where id = (entry ->> 'work_order_item_id')::uuid for update;
    if item.id is null then
      perform public.raise_app_error('WORK_ORDER_ITEM_NOT_FOUND', jsonb_build_object('work_order_item_id', entry ->> 'work_order_item_id'));
    end if;

    select coalesce(sum(quantity), 0) into assigned
    from public.sewing_cards
    where work_order_item_id = item.id and status <> 'cancelled';

    if (entry ->> 'cut_quantity')::integer < assigned then
      perform public.raise_app_error('CUT_BELOW_ASSIGNED', jsonb_build_object('work_order_item_id', item.id, 'assigned', assigned));
    end if;

    update public.work_order_items set cut_quantity = (entry ->> 'cut_quantity')::integer
    where id = item.id
    returning * into item;
    touched_work_orders := array_append(touched_work_orders, item.work_order_id);
    return next item;
  end loop;

  perform public.refresh_work_order_status(id) from unnest(touched_work_orders) as t(id) group by id;
end;
$$;

create function public.sewing_card_issue_warnings(p_work_order_item_id uuid, p_tailor_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(w), '[]'::jsonb)
  from (
    select jsonb_build_object('code', 'TAILOR_HAS_OPEN_CARD', 'tailor_id', tailor_id, 'card_number', number, 'taken_on', taken_on) as w
    from public.sewing_cards
    where tailor_id = p_tailor_id and status = 'taken'
    union all
    select jsonb_build_object('code', 'DUPLICATE_CARD', 'tailor_id', tailor_id, 'card_number', number, 'quantity', quantity)
    from public.sewing_cards
    where tailor_id = p_tailor_id and work_order_item_id = p_work_order_item_id and status in ('taken', 'submitted')
  ) found
$$;

create function public.issue_sewing_cards(
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
    if not exists (select 1 from public.tailors where id = (entry ->> 'tailor_id')::uuid and status = 'active') then
      perform public.raise_app_error('TAILOR_NOT_ACTIVE', jsonb_build_object('tailor_id', entry ->> 'tailor_id'));
    end if;
    warnings := warnings || public.sewing_card_issue_warnings(item.id, (entry ->> 'tailor_id')::uuid);
  end loop;

  select warnings || coalesce(jsonb_agg(jsonb_build_object('code', 'TAILOR_MULTIPLE_CARDS_IN_BATCH', 'tailor_id', tailor_id)), '[]'::jsonb)
  into warnings
  from (
    select value ->> 'tailor_id' as tailor_id
    from jsonb_array_elements(p_cards)
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
      public.next_document_number('KJ', taken), item.id, (entry ->> 'tailor_id')::uuid,
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

create function public.lock_sewing_card(p_number text)
returns public.sewing_cards
language plpgsql
set search_path = ''
as $$
declare
  card public.sewing_cards;
begin
  select * into card from public.sewing_cards where number = upper(trim(p_number)) for update;
  if card.id is null then
    perform public.raise_app_error('CARD_NOT_FOUND', jsonb_build_object('number', p_number));
  end if;
  return card;
end;
$$;

create function public.work_order_id_of_card(card public.sewing_cards)
returns uuid
language sql
stable
set search_path = ''
as $$
  select work_order_id from public.work_order_items where id = card.work_order_item_id
$$;

create function public.submit_sewing_card(
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
      'submitted_by', (select display_name from public.profiles where id = card.submitted_by)
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

create function public.deliver_card_remaining(p_number text, p_delivered_on date default null)
returns public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
begin
  perform public.require_role('production_head');
  card := public.lock_sewing_card(p_number);

  if not card.submitted_incomplete then
    perform public.raise_app_error('CARD_NOT_INCOMPLETE', jsonb_build_object('number', card.number));
  end if;
  if card.remaining_delivered_on is not null then
    perform public.raise_app_error('REMAINING_ALREADY_DELIVERED', jsonb_build_object(
      'number', card.number, 'delivered_on', card.remaining_delivered_on
    ));
  end if;

  update public.sewing_cards
  set remaining_delivered_on = coalesce(p_delivered_on, public.app_today())
  where id = card.id
  returning * into card;

  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;

create function public.cancel_sewing_card(p_number text, p_reason text)
returns public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
begin
  perform public.require_role('production_head');
  card := public.lock_sewing_card(p_number);

  if card.status <> 'taken' then
    perform public.raise_app_error('CARD_CANNOT_BE_CANCELLED', jsonb_build_object('number', card.number, 'status', card.status));
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;

  perform public.set_audit_reason(p_reason);
  update public.sewing_cards set status = 'cancelled', cancelled_reason = trim(p_reason)
  where id = card.id
  returning * into card;

  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;

create function public.record_card_print(p_numbers text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  perform public.require_role('production_head');
  update public.sewing_cards set print_count = print_count + 1
  where number = any (select upper(trim(n)) from unnest(p_numbers) n);
  get diagnostics updated = row_count;
  return updated;
end;
$$;

create function public.record_inspection(
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

  if p_defective_quantity > 0 then
    insert into public.deduction_proposals (inspection_id, tailor_id, quantity, amount)
    values (created.id, card.tailor_id, p_defective_quantity, p_defective_quantity * card.wage_rate);
  end if;

  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return created;
end;
$$;

create function public.refresh_inspection_status(p_sewing_card_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  card_quantity integer;
  finalized integer;
  last_repairable integer;
begin
  select quantity into card_quantity from public.sewing_cards where id = p_sewing_card_id;
  select coalesce(sum(ok_quantity + defective_quantity), 0) into finalized
  from public.inspections where sewing_card_id = p_sewing_card_id;
  select repairable_quantity into last_repairable
  from public.inspections where sewing_card_id = p_sewing_card_id
  order by round desc limit 1;

  update public.sewing_cards
  set inspection_status = case
    when finalized = card_quantity then 'done'
    when coalesce(last_repairable, 0) > 0 then 'in_repair'
    else 'pending'
  end::public.inspection_status
  where id = p_sewing_card_id;
end;
$$;

create function public.delete_last_inspection(p_number text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
  latest public.inspections;
  proposal public.deduction_proposals;
begin
  perform public.require_role('production_head', 'finishing_head');
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;
  card := public.lock_sewing_card(p_number);

  select * into latest from public.inspections where sewing_card_id = card.id order by round desc limit 1;
  if latest.id is null then
    perform public.raise_app_error('INSPECTION_NOT_FOUND', jsonb_build_object('number', card.number));
  end if;

  select * into proposal from public.deduction_proposals where inspection_id = latest.id for update;
  if proposal.payroll_line_id is not null and exists (
    select 1 from public.payroll_lines pl join public.payroll_periods pp on pp.id = pl.payroll_period_id
    where pl.id = proposal.payroll_line_id and pp.status = 'locked'
  ) then
    perform public.raise_app_error('DEDUCTION_ALREADY_APPLIED', jsonb_build_object('number', card.number));
  end if;

  perform public.set_audit_reason(p_reason);
  if proposal.id is not null then
    delete from public.deduction_proposals where id = proposal.id;
    if proposal.payroll_line_id is not null then
      perform public.recompute_payroll_line(proposal.payroll_line_id);
    end if;
  end if;
  delete from public.inspections where id = latest.id;
  perform public.refresh_inspection_status(card.id);
  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
end;
$$;

create function public.update_sewing_card(
  p_number text,
  p_quantity integer default null,
  p_tailor_id uuid default null,
  p_reason text default null
)
returns public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
begin
  perform public.require_role('production_head');
  card := public.lock_sewing_card(p_number);
  if card.status <> 'taken' then
    perform public.raise_app_error('CARD_NOT_EDITABLE', jsonb_build_object('number', card.number, 'status', card.status));
  end if;
  if p_tailor_id is not null and not exists (select 1 from public.tailors where id = p_tailor_id and status = 'active') then
    perform public.raise_app_error('TAILOR_NOT_ACTIVE', jsonb_build_object('tailor_id', p_tailor_id));
  end if;

  perform 1 from public.work_order_items where id = card.work_order_item_id for update;
  perform public.set_audit_reason(p_reason);
  update public.sewing_cards
  set quantity = coalesce(p_quantity, quantity),
      tailor_id = coalesce(p_tailor_id, tailor_id)
  where id = card.id
  returning * into card;

  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;

create function public.unsubmit_sewing_card(p_number text, p_reason text)
returns public.sewing_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  card public.sewing_cards;
  line_id uuid;
begin
  perform public.require_role('production_head');
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;
  card := public.lock_sewing_card(p_number);

  if card.status <> 'submitted' then
    perform public.raise_app_error('CARD_NOT_SUBMITTED', jsonb_build_object('number', card.number, 'status', card.status));
  end if;
  if exists (select 1 from public.inspections where sewing_card_id = card.id) then
    perform public.raise_app_error('CARD_ALREADY_INSPECTED', jsonb_build_object('number', card.number));
  end if;
  if card.payroll_line_id is not null and exists (
    select 1 from public.payroll_lines pl join public.payroll_periods pp on pp.id = pl.payroll_period_id
    where pl.id = card.payroll_line_id and pp.status = 'locked'
  ) then
    perform public.raise_app_error('PAYROLL_LOCKED', jsonb_build_object('number', card.number));
  end if;

  line_id := card.payroll_line_id;
  perform public.set_audit_reason(p_reason);
  update public.sewing_cards
  set status = 'taken', submitted_on = null, submitted_at = null, submitted_by = null,
      submitted_incomplete = false, remaining_notes = null, remaining_delivered_on = null,
      payroll_line_id = null
  where id = card.id
  returning * into card;

  if line_id is not null then
    perform public.recompute_payroll_line(line_id);
  end if;
  perform public.refresh_work_order_status(public.work_order_id_of_card(card));
  return card;
end;
$$;

create function public.add_work_order_items(p_work_order_id uuid, p_size_ids uuid[], p_fabric_color_ids uuid[])
returns setof public.work_order_items
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_role('production_head');
  if (select status from public.work_orders where id = p_work_order_id) in ('done', 'cancelled') then
    perform public.raise_app_error('WORK_ORDER_CLOSED');
  end if;

  return query
  insert into public.work_order_items (work_order_id, size_id, fabric_color_id)
  select p_work_order_id, size_id, fabric_color_id
  from (select distinct unnest(p_size_ids) as size_id) s
  cross join (select distinct unnest(p_fabric_color_ids) as fabric_color_id) c
  on conflict (work_order_id, size_id, fabric_color_id) do nothing
  returning *;
end;
$$;

create function public.remove_work_order_item(p_work_order_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  work_order uuid;
begin
  perform public.require_role('production_head');
  if exists (select 1 from public.sewing_cards where work_order_item_id = p_work_order_item_id) then
    perform public.raise_app_error('WORK_ORDER_ITEM_IN_USE');
  end if;
  delete from public.work_order_items where id = p_work_order_item_id returning work_order_id into work_order;
  if work_order is not null then
    perform public.refresh_work_order_status(work_order);
  end if;
end;
$$;

create function public.cancel_work_order(p_work_order_id uuid, p_reason text)
returns public.work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  wo public.work_orders;
begin
  perform public.require_role('production_head');
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;
  if exists (
    select 1 from public.sewing_cards sc
    join public.work_order_items woi on woi.id = sc.work_order_item_id
    where woi.work_order_id = p_work_order_id and sc.status <> 'cancelled'
  ) then
    perform public.raise_app_error('WORK_ORDER_HAS_CARDS');
  end if;
  perform public.set_audit_reason(p_reason);
  update public.work_orders set status = 'cancelled' where id = p_work_order_id returning * into wo;
  if wo.id is null then
    perform public.raise_app_error('WORK_ORDER_NOT_FOUND');
  end if;
  return wo;
end;
$$;

create function public.delete_work_order(p_work_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_role('production_head');
  if exists (
    select 1 from public.sewing_cards sc
    join public.work_order_items woi on woi.id = sc.work_order_item_id
    where woi.work_order_id = p_work_order_id
  ) then
    perform public.raise_app_error('WORK_ORDER_HAS_CARDS');
  end if;
  perform public.set_audit_reason(p_reason);
  delete from public.work_order_items where work_order_id = p_work_order_id;
  delete from public.work_orders where id = p_work_order_id;
end;
$$;

create function public.guard_work_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.product_id, new.fabric_id) is distinct from (old.product_id, old.fabric_id) and exists (
    select 1 from public.sewing_cards sc
    join public.work_order_items woi on woi.id = sc.work_order_item_id
    where woi.work_order_id = old.id
  ) then
    perform public.raise_app_error('WORK_ORDER_HAS_CARDS');
  end if;
  return new;
end;
$$;

create trigger work_orders_guard
before update of product_id, fabric_id on public.work_orders
for each row execute function public.guard_work_order();
