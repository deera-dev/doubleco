create function public.ensure_master_label(p_kind text, p_label text, p_parent_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text := public.normalize_label(p_label);
  key text := public.label_key(p_label);
  found uuid;
begin
  perform public.require_role('production_head');

  if clean is null or coalesce(key, '') = '' then
    perform public.raise_app_error('LABEL_REQUIRED', jsonb_build_object('kind', p_kind));
  end if;

  case p_kind
    when 'product' then
      select id into found from public.products where public.label_key(code) = key;
      if found is null then
        insert into public.products (code) values (clean) returning id into found;
      else
        update public.products set is_active = true where id = found and not is_active;
      end if;
    when 'fabric' then
      select id into found from public.fabrics where public.label_key(name) = key;
      if found is null then
        insert into public.fabrics (name) values (clean) returning id into found;
      else
        update public.fabrics set is_active = true where id = found and not is_active;
      end if;
    when 'cutter' then
      select id into found from public.cutters where public.label_key(name) = key and archived_at is null;
      if found is null then
        insert into public.cutters (name) values (clean) returning id into found;
      else
        update public.cutters set is_active = true, inactive_since = null where id = found and not is_active;
      end if;
    when 'pattern' then
      select id into found from public.patterns where public.label_key(code) = key;
      if found is null then
        insert into public.patterns (code) values (clean) returning id into found;
      else
        update public.patterns set is_active = true where id = found and not is_active;
      end if;
    when 'size' then
      select id into found from public.sizes where public.label_key(name) = key;
      if found is null then
        insert into public.sizes (name, sort_order)
        values (clean, coalesce((select max(sort_order) from public.sizes), -10) + 10)
        returning id into found;
      else
        update public.sizes set is_active = true where id = found and not is_active;
      end if;
    when 'color' then
      if p_parent_id is null then
        perform public.raise_app_error('LABEL_REQUIRED', jsonb_build_object('kind', 'fabric'));
      end if;
      select id into found from public.fabric_colors
      where fabric_id = p_parent_id and public.label_key(name) = key;
      if found is null then
        insert into public.fabric_colors (fabric_id, name) values (p_parent_id, clean) returning id into found;
      else
        update public.fabric_colors set is_active = true where id = found and not is_active;
      end if;
    else
      perform public.raise_app_error('INVALID_INPUT', jsonb_build_object('kind', p_kind));
  end case;

  return found;
end;
$$;

create function public.suggest_work_order_number_for_label(p_label text)
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
  select 'WO_' || code into base from public.products where public.label_key(code) = public.label_key(p_label);
  base := coalesce(base, 'WO_' || public.normalize_label(p_label));
  if base is null then
    return null;
  end if;
  candidate := base;
  while exists (select 1 from public.work_orders where lower(number) = lower(candidate)) loop
    suffix := suffix + 1;
    candidate := base || '_' || suffix;
  end loop;
  return candidate;
end;
$$;

grant execute on function
  public.ensure_master_label(text, text, uuid),
  public.suggest_work_order_number_for_label(text)
to authenticated;
