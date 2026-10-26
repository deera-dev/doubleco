-- Removes a WO with everything made from it (cards, inspections, deduction proposals), for WOs
-- created by mistake. Money already paid out is never touched: a card in a locked payroll blocks it.
create or replace function public.force_delete_work_order(p_work_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched_lines uuid[];
  line_id uuid;
begin
  perform public.require_role('production_head');
  if length(trim(coalesce(p_reason, ''))) = 0 then
    perform public.raise_app_error('REASON_REQUIRED');
  end if;
  perform 1 from public.work_orders where id = p_work_order_id for update;
  if not found then
    perform public.raise_app_error('NOT_FOUND');
  end if;

  if exists (
    select 1
    from public.sewing_cards sc
    join public.work_order_items woi on woi.id = sc.work_order_item_id
    left join public.payroll_lines pl on pl.id = sc.payroll_line_id
    left join public.payroll_periods pp on pp.id = pl.payroll_period_id
    where woi.work_order_id = p_work_order_id
      and (sc.status = 'paid' or pp.status = 'locked')
  ) then
    perform public.raise_app_error('WORK_ORDER_HAS_PAID_CARDS');
  end if;

  perform public.set_audit_reason(p_reason);

  select coalesce(array_agg(distinct line), '{}') into touched_lines
  from (
    select sc.payroll_line_id as line
    from public.sewing_cards sc
    join public.work_order_items woi on woi.id = sc.work_order_item_id
    where woi.work_order_id = p_work_order_id and sc.payroll_line_id is not null
    union
    select dp.payroll_line_id
    from public.deduction_proposals dp
    join public.inspections i on i.id = dp.inspection_id
    join public.sewing_cards sc on sc.id = i.sewing_card_id
    join public.work_order_items woi on woi.id = sc.work_order_item_id
    where woi.work_order_id = p_work_order_id and dp.payroll_line_id is not null
  ) lines;

  delete from public.deduction_proposals dp
  using public.inspections i, public.sewing_cards sc, public.work_order_items woi
  where dp.inspection_id = i.id and i.sewing_card_id = sc.id and sc.work_order_item_id = woi.id
    and woi.work_order_id = p_work_order_id;

  delete from public.inspections i
  using public.sewing_cards sc, public.work_order_items woi
  where i.sewing_card_id = sc.id and sc.work_order_item_id = woi.id and woi.work_order_id = p_work_order_id;

  delete from public.sewing_cards sc
  using public.work_order_items woi
  where sc.work_order_item_id = woi.id and woi.work_order_id = p_work_order_id;

  delete from public.work_order_items where work_order_id = p_work_order_id;
  delete from public.work_orders where id = p_work_order_id;

  foreach line_id in array touched_lines loop
    perform public.recompute_payroll_line(line_id);
  end loop;

  -- An open payroll line left with nothing to pay would show the tailor at Rp 0.
  delete from public.payroll_lines pl
  where pl.id = any (touched_lines)
    and pl.gross_wage = 0 and pl.deduction_total = 0 and pl.addition_total = 0 and pl.new_advance_total = 0
    and not exists (select 1 from public.sewing_cards where payroll_line_id = pl.id)
    and not exists (select 1 from public.cash_advance_entries where payroll_line_id = pl.id);
end;
$$;

grant execute on function public.force_delete_work_order(uuid, text) to authenticated;
