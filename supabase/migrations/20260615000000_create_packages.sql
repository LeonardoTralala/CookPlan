-- =============================================================================
-- Migrasi: packages + package_meals + saved_shopping_lists
-- -----------------------------------------------------------------------------
-- Fitur 2 (Phase 12): Paket "Belanja di Kami".
--   - packages       : paket menu fiks (periode + menu tetap) yang bahannya kami
--                      sediakan. Porsi bisa di-request saat checkout.
--   - package_meals  : menu fiks per hari paket, refer ke recipes katalog
--                      (bahan & harga ikut recipe_ingredients — single source).
--   - saved_shopping_lists : simpan snapshot daftar belanja milik user (notulen #13).
-- Harga paket DIHITUNG dari agregasi recipe_ingredients (bukan kolom statis) —
-- konsisten dengan daftar belanja. price_idr di packages cuma harga "tampilan/
-- marketing" opsional.
-- RLS: packages & package_meals = read publik (aktif), tulis admin. saved =
-- owner-only. Pola mengikuti recipes/diet_tags & weekly_plans yang sudah ada.
-- =============================================================================

-- 1) packages -------------------------------------------------------------------
create table if not exists public.packages (
  id            serial primary key,
  slug          text not null unique,            -- key permanen (jangan diubah)
  name          text not null,
  description   text,
  periode_days  integer not null default 3,      -- jumlah hari menu fiks
  meals_per_day integer not null default 3,
  base_servings integer not null default 2,      -- acuan skala harga saat porsi di-request
  price_idr     integer not null default 0,      -- harga tampilan opsional (marketing)
  image_url     text,
  badges        text[] not null default '{}',
  is_active     boolean not null default true,   -- soft hide
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.packages is
  'Paket menu fiks (periode + menu tetap) yang bahannya tersedia di supplier kami. Belanja di Kami.';
comment on column public.packages.price_idr is
  'Harga tampilan opsional. Harga sebenarnya dihitung dari agregasi recipe_ingredients menu paket.';

drop trigger if exists packages_set_updated_at on public.packages;
create trigger packages_set_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

-- 2) package_meals --------------------------------------------------------------
create table if not exists public.package_meals (
  id          serial primary key,
  package_id  integer not null references public.packages (id) on delete cascade,
  day_index   integer not null,                  -- 0-based (Hari 1 = 0)
  meal_type   text not null check (meal_type in ('breakfast','lunch','dinner')),
  recipe_id   integer not null references public.recipes (id) on delete restrict,
  created_at  timestamptz not null default now(),
  unique (package_id, day_index, meal_type)
);

comment on table public.package_meals is
  'Menu fiks per hari sebuah paket. Refer ke recipes katalog (bahan ikut recipe_ingredients).';

create index if not exists package_meals_package_id_idx on public.package_meals (package_id);

-- 3) saved_shopping_lists -------------------------------------------------------
create table if not exists public.saved_shopping_lists (
  id           serial primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  source_type  text not null default 'planner'
                 check (source_type in ('generate','package','planner')),
  source_ref   text,                             -- planId / packageId (opsional)
  items_json   jsonb not null default '[]',      -- snapshot item belanja
  total_idr    integer not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.saved_shopping_lists is
  'Snapshot daftar belanja yang disimpan user (notulen #13). Owner-only via RLS.';

create index if not exists saved_shopping_lists_user_idx
  on public.saved_shopping_lists (user_id, created_at desc);

-- 4) Row Level Security ---------------------------------------------------------
alter table public.packages            enable row level security;
alter table public.package_meals       enable row level security;
alter table public.saved_shopping_lists enable row level security;

-- packages: read publik (hanya aktif), tulis admin
drop policy if exists "packages_read_public" on public.packages;
create policy "packages_read_public"
  on public.packages for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "packages_admin_write" on public.packages;
create policy "packages_admin_write"
  on public.packages for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- package_meals: read publik, tulis admin
drop policy if exists "package_meals_read_public" on public.package_meals;
create policy "package_meals_read_public"
  on public.package_meals for select
  to anon, authenticated
  using (true);

drop policy if exists "package_meals_admin_write" on public.package_meals;
create policy "package_meals_admin_write"
  on public.package_meals for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- saved_shopping_lists: owner-only
drop policy if exists "saved_lists_owner" on public.saved_shopping_lists;
create policy "saved_lists_owner"
  on public.saved_shopping_lists for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 5) Seed 3 paket (pakai resep 1-6 yang punya bahan + harga lengkap) ------------
-- Idempoten via slug unik. Menu dipilih dari resep ber-ingredient & ber-harga.
insert into public.packages (slug, name, description, periode_days, meals_per_day, base_servings, price_idr, badges, sort_order)
values
  ('paket-hemat-3hari', 'Paket Hemat 3 Hari',
   'Menu rumahan hemat untuk 3 hari. Bahan lengkap kami siapkan, tinggal masak.',
   3, 3, 2, 0, array['Hemat','Populer'], 1),
  ('paket-sehat-3hari', 'Paket Sehat 3 Hari',
   'Menu bergizi seimbang dengan sayur & protein untuk 3 hari.',
   3, 3, 2, 0, array['Sehat','Sayur'], 2),
  ('paket-protein-3hari', 'Paket Protein 3 Hari',
   'Menu tinggi protein (ayam & ikan) untuk 3 hari penuh tenaga.',
   3, 3, 2, 0, array['Tinggi Protein'], 3)
on conflict (slug) do nothing;

-- Menu fiks tiap paket. recipe_id 1-6:
--   1 Gado-Gado, 2 Soto Ayam, 3 Tempe Bowl, 4 Mie Goreng, 5 Ikan Bakar, 6 Tumis Sayur
-- Variasi 2 resep/hari (foodprep): breakfast & dinner pakai resep sama, lunch beda.
-- Idempoten: hapus dulu menu paket lalu insert ulang (aman dijalankan berkali).
do $$
declare
  p_hemat  integer; p_sehat integer; p_protein integer;
begin
  select id into p_hemat   from public.packages where slug = 'paket-hemat-3hari';
  select id into p_sehat   from public.packages where slug = 'paket-sehat-3hari';
  select id into p_protein from public.packages where slug = 'paket-protein-3hari';

  delete from public.package_meals where package_id in (p_hemat, p_sehat, p_protein);

  -- Paket Hemat: Tempe Bowl(3), Mie Goreng(4), Gado-Gado(1)
  insert into public.package_meals (package_id, day_index, meal_type, recipe_id) values
    (p_hemat,0,'breakfast',3),(p_hemat,0,'lunch',4),(p_hemat,0,'dinner',3),
    (p_hemat,1,'breakfast',1),(p_hemat,1,'lunch',3),(p_hemat,1,'dinner',1),
    (p_hemat,2,'breakfast',4),(p_hemat,2,'lunch',1),(p_hemat,2,'dinner',4);

  -- Paket Sehat: Gado-Gado(1), Tumis Sayur(6), Tempe Bowl(3)
  insert into public.package_meals (package_id, day_index, meal_type, recipe_id) values
    (p_sehat,0,'breakfast',6),(p_sehat,0,'lunch',1),(p_sehat,0,'dinner',6),
    (p_sehat,1,'breakfast',3),(p_sehat,1,'lunch',6),(p_sehat,1,'dinner',3),
    (p_sehat,2,'breakfast',1),(p_sehat,2,'lunch',3),(p_sehat,2,'dinner',1);

  -- Paket Protein: Soto Ayam(2), Ikan Bakar(5)
  insert into public.package_meals (package_id, day_index, meal_type, recipe_id) values
    (p_protein,0,'breakfast',2),(p_protein,0,'lunch',5),(p_protein,0,'dinner',2),
    (p_protein,1,'breakfast',5),(p_protein,1,'lunch',2),(p_protein,1,'dinner',5),
    (p_protein,2,'breakfast',2),(p_protein,2,'lunch',5),(p_protein,2,'dinner',2);
end $$;
