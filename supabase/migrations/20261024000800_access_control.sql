do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'tailors', 'tailor_payment_accounts', 'cutters', 'products', 'fabrics', 'fabric_colors', 'sizes',
    'wage_rates', 'print_settings', 'payroll_periods', 'payroll_lines', 'payroll_additions', 'work_orders',
    'work_order_items', 'document_counters', 'sewing_cards', 'inspections', 'deduction_proposals',
    'import_batches', 'cash_advance_entries', 'legacy_wage_records', 'legacy_deposit_records',
    'audit_logs', 'idempotency_keys'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end;
$$;

revoke all on public.tailor_advance_balances, public.outstanding_sewing_cards, public.weekly_deposit_grid,
  public.work_order_progress, public.thp_rows from anon;

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.has_role('production_head', 'owner'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tailors', 'tailor_payment_accounts', 'cutters', 'products', 'fabrics', 'fabric_colors', 'sizes',
    'wage_rates', 'print_settings', 'payroll_periods', 'payroll_lines', 'payroll_additions', 'work_orders',
    'work_order_items', 'sewing_cards', 'inspections', 'deduction_proposals', 'import_batches',
    'cash_advance_entries', 'legacy_wage_records', 'legacy_deposit_records'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_staff())',
      table_name || '_select_staff', table_name
    );
  end loop;

  foreach table_name in array array['tailors', 'tailor_payment_accounts', 'cutters', 'products', 'fabrics', 'fabric_colors', 'sizes', 'print_settings', 'work_orders'] loop
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_role(''production_head'')) with check (public.has_role(''production_head''))',
      table_name || '_update_production_head', table_name
    );
  end loop;

  foreach table_name in array array['tailors', 'tailor_payment_accounts', 'cutters', 'products', 'fabrics', 'fabric_colors', 'sizes', 'wage_rates'] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_role(''production_head''))',
      table_name || '_insert_production_head', table_name
    );
  end loop;
end;
$$;

create policy tailors_select_self on public.tailors
for select to authenticated
using (profile_id = auth.uid());

create policy audit_logs_select on public.audit_logs
for select to authenticated
using (public.has_role('production_head', 'owner'));

create policy idempotency_keys_own on public.idempotency_keys
for all to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.app_today(),
  public.current_app_role(),
  public.has_role(public.app_role[]),
  public.is_staff(),
  public.wage_rate_on(public.wage_category, date),
  public.tailor_advance_balance(uuid),
  public.find_similar_tailors(text),
  public.find_account_number_owners(text),
  public.suggest_work_order_number(uuid),
  public.create_work_order(uuid, uuid, uuid, public.change_status, uuid[], uuid[], text, date, text, text, text, text, text, boolean, text),
  public.record_cut_result(uuid, integer),
  public.issue_sewing_card(uuid, uuid, integer, date, boolean, text),
  public.submit_sewing_card(text, date, boolean, text, boolean, text),
  public.deliver_card_remaining(text, date),
  public.cancel_sewing_card(text, text),
  public.record_card_print(text[]),
  public.mark_card_collected(text),
  public.record_inspection(text, integer, integer, integer, text, date),
  public.decide_deduction(uuid, public.deduction_decision, text),
  public.record_cash_advance(uuid, bigint, date, text, boolean, text),
  public.record_manual_repayment(uuid, bigint, date, text, boolean, text),
  public.mark_tailor_left(uuid, date, text, boolean, text),
  public.build_payroll(date),
  public.set_payroll_repayment(uuid, bigint, boolean, text),
  public.add_payroll_addition(date, uuid, public.payroll_addition_kind, bigint, text),
  public.remove_payroll_addition(uuid, text),
  public.lock_payroll(date, boolean, text),
  public.mark_payroll_line_paid(uuid)
to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;
