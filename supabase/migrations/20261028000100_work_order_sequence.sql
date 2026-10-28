-- The WO list follows the product's running number, not when the WO was typed in:
-- W-121 stays above W-120 even when W-120 was created later. "_2" repeats sort above the
-- first WO of the same product.
alter table public.work_orders
  add column sequence_no numeric generated always as ((substring(number from '[0-9]+'))::numeric) stored,
  add column repeat_no integer generated always as (coalesce((substring(number from '_([0-9]+)$'))::integer, 1)) stored;

create index work_orders_sequence_idx on public.work_orders (sequence_no desc nulls last, repeat_no desc, created_at desc);
