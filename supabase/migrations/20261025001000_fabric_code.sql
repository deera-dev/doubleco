alter table public.fabrics add column code text check (code is null or length(code) > 0);

drop trigger fabrics_normalize on public.fabrics;
create trigger fabrics_normalize before insert or update on public.fabrics
for each row execute function public.normalize_labels('name', 'code');

create unique index fabrics_code_key_idx on public.fabrics (public.label_key(code)) where code is not null;

do $$
declare
  candidate record;
begin
  for candidate in
    select distinct on (wo.fabric_id)
      wo.fabric_id,
      public.normalize_label(substring(p.code from '\s(\S+)$')) as code
    from public.work_orders wo
    join public.products p on p.id = wo.product_id
    where substring(p.code from '\s(\S+)$') is not null
    group by wo.fabric_id, 2
    order by wo.fabric_id, count(*) desc, 2
  loop
    begin
      update public.fabrics set code = candidate.code where id = candidate.fabric_id and code is null;
    exception when unique_violation then
      null;
    end;
  end loop;
end;
$$;

comment on column public.fabrics.code is 'Kode bahan untuk kode produk, mis. BLS pada W-133 BLS';
