-- =============================================================================
-- Migrasi: Sistem harga bahan ternormalisasi (single source of truth)
-- -----------------------------------------------------------------------------
-- Sebelumnya harga ditempel per (resep,bahan) + total resep manual → dua sumber
-- kebenaran & tak seragam lintas resep. Sekarang:
--   - public.ingredients          : master bahan, harga SEKALI di satuan dasar (g/ml/pcs)
--   - public.unit_conversions     : konversi satuan global (kg/sdm/sdt/gelas → dasar)
--   - public.ingredient_unit_overrides : jembatan hitung↔berat per-bahan (siung→g, dll)
-- recipe_ingredients.price_idr & recipes.price_idr jadi nilai TERHITUNG (trigger),
-- sehingga read-path hilir (katalog, shopping list, planner) tak berubah.
-- =============================================================================

-- 1) Tabel master bahan --------------------------------------------------------
create table if not exists public.ingredients (
  id             serial primary key,
  name           text not null,
  category       text check (category in ('vegetables','meat','dairy','spices','dry_goods')),
  base_unit      text not null default 'g' check (base_unit in ('g','ml','pcs')),
  price_per_base numeric,                  -- harga per 1 satuan dasar (NULL = belum berharga)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.ingredients is
  'Master bahan: sumber kebenaran harga. price_per_base = harga per 1 base_unit (g/ml/pcs).';
create unique index if not exists ingredients_name_unique on public.ingredients (lower(trim(name)));

drop trigger if exists ingredients_set_updated_at on public.ingredients;
create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function public.set_updated_at();

-- 2) Tabel konversi satuan global ---------------------------------------------
create table if not exists public.unit_conversions (
  unit           text primary key,         -- ejaan satuan (lowercase) seperti tertulis di resep
  dimension      text not null check (dimension in ('mass','volume','count')),
  to_base_factor numeric not null          -- faktor ke sub-satuan dasar dimensi (g / ml / pcs)
);
comment on table public.unit_conversions is
  'Konversi satuan universal (fisika). mass→gram, volume→ml, count→pcs.';

insert into public.unit_conversions (unit, dimension, to_base_factor) values
  ('g','mass',1), ('gr','mass',1), ('gram','mass',1), ('ons','mass',100), ('kg','mass',1000), ('kilo','mass',1000),
  ('ml','volume',1), ('cc','volume',1), ('sdt','volume',5), ('sdm','volume',15), ('gelas','volume',240),
  ('liter','volume',1000), ('ltr','volume',1000),
  ('pcs','count',1), ('buah','count',1), ('butir','count',1), ('biji','count',1)
on conflict (unit) do update set dimension = excluded.dimension, to_base_factor = excluded.to_base_factor;

-- 3) Override hitung↔berat per-bahan ------------------------------------------
create table if not exists public.ingredient_unit_overrides (
  ingredient_id  integer not null references public.ingredients (id) on delete cascade,
  unit           text not null,            -- satuan resep (lowercase), mis. 'siung'
  factor_to_base numeric not null,         -- amount × factor = kuantitas di base_unit bahan
  primary key (ingredient_id, unit)
);
comment on table public.ingredient_unit_overrides is
  'Jembatan satuan hitung↔berat khusus bahan (mis. 1 siung bawang = 8 g).';

-- 4) FK di recipe_ingredients --------------------------------------------------
alter table public.recipe_ingredients
  add column if not exists ingredient_id integer references public.ingredients (id) on delete set null;
create index if not exists recipe_ingredients_ingredient_id_idx
  on public.recipe_ingredients (ingredient_id);

-- 5) Fungsi resolusi & rekomputasi --------------------------------------------
create or replace function public.resolve_ingredient_cost(p_amount numeric, p_unit text, p_ingredient_id integer)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  v_base text; v_price numeric; v_factor numeric; v_norm text; v_base_dim text;
begin
  if p_ingredient_id is null or p_amount is null then return null; end if;
  select base_unit, price_per_base into v_base, v_price from public.ingredients where id = p_ingredient_id;
  if v_price is null then return null; end if;
  v_norm := lower(trim(p_unit));
  v_base_dim := case v_base when 'g' then 'mass' when 'ml' then 'volume' when 'pcs' then 'count' end;
  -- (1) override per-bahan
  select factor_to_base into v_factor from public.ingredient_unit_overrides
    where ingredient_id = p_ingredient_id and unit = v_norm;
  -- (2) satuan resep = satuan dasar
  if v_factor is null and v_norm = v_base then v_factor := 1; end if;
  -- (3) konversi global bila sedimensi dengan base_unit
  if v_factor is null then
    select to_base_factor into v_factor from public.unit_conversions
      where unit = v_norm and dimension = v_base_dim;
  end if;
  if v_factor is null then return null; end if;   -- tak terhitung → "perlu data"
  return round(p_amount * v_factor * v_price);
end $$;

create or replace function public.recompute_recipe_total(p_recipe_id integer)
returns void language sql security definer set search_path = '' as $$
  update public.recipes set price_idr = (
    select coalesce(sum(price_idr), 0)::int from public.recipe_ingredients where recipe_id = p_recipe_id
  ) where id = p_recipe_id;
$$;

create or replace function public.recompute_costs_for_ingredient(p_ingredient_id integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.recipe_ingredients
    set price_idr = public.resolve_ingredient_cost(amount, unit, ingredient_id)
    where ingredient_id = p_ingredient_id;
  -- total resep diperbarui oleh trigger AFTER pada recipe_ingredients.
end $$;

-- 6) Backfill (sekali jalan) ---------------------------------------------------
-- 6a) Buat master dari nama unik; base_unit = dimensi satuan modal; nama = casing terbanyak.
with stats as (
  select lower(trim(name)) as key,
         trim(mode() within group (order by name)) as display_name,
         mode() within group (order by unit) filter (where unit is not null) as modal_unit,
         mode() within group (order by category) filter (where category is not null) as modal_cat
  from public.recipe_ingredients
  where name is not null and trim(name) <> ''
  group by lower(trim(name))
)
insert into public.ingredients (name, category, base_unit)
select s.display_name, s.modal_cat,
       coalesce(
         (select case uc.dimension when 'mass' then 'g' when 'volume' then 'ml' when 'count' then 'pcs' end
            from public.unit_conversions uc where uc.unit = lower(trim(s.modal_unit))),
         'g')
from stats s;

-- 6b) Hubungkan recipe_ingredients ke master.
update public.recipe_ingredients ri
  set ingredient_id = i.id
  from public.ingredients i
  where lower(trim(ri.name)) = lower(trim(i.name));

-- 6c) Turunkan price_per_base dari baris yang sudah berharga (jaga 6 resep seed).
with priced as (
  select ri.ingredient_id,
         ri.price_idr / nullif(
           ri.amount * coalesce(
             (select uc.to_base_factor from public.unit_conversions uc
                where uc.unit = lower(trim(ri.unit))
                  and uc.dimension = case i.base_unit when 'g' then 'mass' when 'ml' then 'volume' else 'count' end),
             case when lower(trim(ri.unit)) = i.base_unit then 1 end), 0) as per_base
  from public.recipe_ingredients ri
  join public.ingredients i on i.id = ri.ingredient_id
  where ri.price_idr is not null and ri.amount is not null and ri.amount > 0
)
update public.ingredients i
  set price_per_base = round(sub.avg_per_base, 4)
  from (select ingredient_id, avg(per_base) as avg_per_base from priced where per_base is not null group by ingredient_id) sub
  where i.id = sub.ingredient_id;

-- 6d) Hitung ulang semua biaya bahan + total resep (sebelum trigger dipasang).
update public.recipe_ingredients
  set price_idr = public.resolve_ingredient_cost(amount, unit, ingredient_id);
do $$ declare r record; begin
  for r in select id from public.recipes loop perform public.recompute_recipe_total(r.id); end loop;
end $$;

-- 7) Trigger (dipasang setelah backfill) --------------------------------------
create or replace function public.ri_before_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.price_idr := public.resolve_ingredient_cost(new.amount, new.unit, new.ingredient_id);
  return new;
end $$;
drop trigger if exists recipe_ingredients_set_price on public.recipe_ingredients;
create trigger recipe_ingredients_set_price
  before insert or update on public.recipe_ingredients
  for each row execute function public.ri_before_change();

create or replace function public.ri_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_recipe_total(old.recipe_id);
    return old;
  end if;
  perform public.recompute_recipe_total(new.recipe_id);
  if tg_op = 'UPDATE' and new.recipe_id is distinct from old.recipe_id then
    perform public.recompute_recipe_total(old.recipe_id);
  end if;
  return new;
end $$;
drop trigger if exists recipe_ingredients_recompute_total on public.recipe_ingredients;
create trigger recipe_ingredients_recompute_total
  after insert or update or delete on public.recipe_ingredients
  for each row execute function public.ri_after_change();

create or replace function public.ingredients_after_price_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.recompute_costs_for_ingredient(new.id);
  return new;
end $$;
drop trigger if exists ingredients_recompute on public.ingredients;
create trigger ingredients_recompute
  after update of price_per_base, base_unit on public.ingredients
  for each row execute function public.ingredients_after_price_change();

create or replace function public.overrides_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.recompute_costs_for_ingredient(coalesce(new.ingredient_id, old.ingredient_id));
  return coalesce(new, old);
end $$;
drop trigger if exists overrides_recompute on public.ingredient_unit_overrides;
create trigger overrides_recompute
  after insert or update or delete on public.ingredient_unit_overrides
  for each row execute function public.overrides_after_change();

-- 8) RLS: read publik, write admin --------------------------------------------
alter table public.ingredients               enable row level security;
alter table public.unit_conversions          enable row level security;
alter table public.ingredient_unit_overrides enable row level security;

drop policy if exists "ingredients_read_public" on public.ingredients;
create policy "ingredients_read_public" on public.ingredients for select to anon, authenticated using (true);
drop policy if exists "ingredients_admin_write" on public.ingredients;
create policy "ingredients_admin_write" on public.ingredients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "unit_conversions_read_public" on public.unit_conversions;
create policy "unit_conversions_read_public" on public.unit_conversions for select to anon, authenticated using (true);
drop policy if exists "unit_conversions_admin_write" on public.unit_conversions;
create policy "unit_conversions_admin_write" on public.unit_conversions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ingredient_overrides_read_public" on public.ingredient_unit_overrides;
create policy "ingredient_overrides_read_public" on public.ingredient_unit_overrides for select to anon, authenticated using (true);
drop policy if exists "ingredient_overrides_admin_write" on public.ingredient_unit_overrides;
create policy "ingredient_overrides_admin_write" on public.ingredient_unit_overrides for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 9) Cabut EXECUTE publik dari fungsi internal (dipakai trigger/migration saja).
-- Trigger tetap jalan tanpa grant; ini mencegah pemanggilan RPC liar yang bypass RLS.
revoke execute on function public.resolve_ingredient_cost(numeric, text, integer) from public, anon, authenticated;
revoke execute on function public.recompute_recipe_total(integer)             from public, anon, authenticated;
revoke execute on function public.recompute_costs_for_ingredient(integer)     from public, anon, authenticated;
revoke execute on function public.ri_before_change()                          from public, anon, authenticated;
revoke execute on function public.ri_after_change()                           from public, anon, authenticated;
revoke execute on function public.ingredients_after_price_change()            from public, anon, authenticated;
revoke execute on function public.overrides_after_change()                    from public, anon, authenticated;
