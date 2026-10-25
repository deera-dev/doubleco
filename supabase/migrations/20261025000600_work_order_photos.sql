insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('work-order-photos', 'work-order-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on column public.work_orders.sample_photo_public_id is 'Path foto sampel di bucket storage work-order-photos';

create function public.assert_work_order_photo_editable(p_work_order_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_status public.work_order_status;
begin
  perform public.require_role('production_head');

  select status into current_status from public.work_orders where id = p_work_order_id;
  if not found then
    perform public.raise_app_error('WORK_ORDER_NOT_FOUND');
  end if;
  if current_status = 'cancelled' then
    perform public.raise_app_error('WORK_ORDER_CLOSED');
  end if;
end;
$$;

create function public.set_work_order_photo(p_work_order_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_path text;
begin
  perform public.assert_work_order_photo_editable(p_work_order_id);

  if p_path is not null and p_path not like p_work_order_id::text || '/%' then
    perform public.raise_app_error('WORK_ORDER_PHOTO_INVALID');
  end if;

  select sample_photo_public_id into previous_path
  from public.work_orders
  where id = p_work_order_id
  for update;

  update public.work_orders set sample_photo_public_id = p_path where id = p_work_order_id;

  return previous_path;
end;
$$;

grant execute on function
  public.assert_work_order_photo_editable(uuid),
  public.set_work_order_photo(uuid, text)
to authenticated;
