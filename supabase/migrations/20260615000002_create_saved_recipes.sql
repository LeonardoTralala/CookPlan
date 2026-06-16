-- =============================================================================
-- Migrasi: saved_recipes (resep yang disimpan/difavoritkan pengguna)
-- -----------------------------------------------------------------------------
-- Relasi many-to-many user <-> recipe. Dipakai di halaman Profil ("Resep
-- Tersimpan") dan tombol simpan di katalog. PK gabungan (user_id, recipe_id)
-- mencegah duplikat sekaligus menjadi index untuk query "resep tersimpan saya".
-- =============================================================================

create table if not exists public.saved_recipes (
  user_id    uuid    not null references public.profiles (id) on delete cascade,
  recipe_id  integer not null references public.recipes (id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

comment on table public.saved_recipes is
  'Resep yang disimpan pengguna. PK gabungan (user_id, recipe_id) anti-duplikat.';

-- Index untuk lookup balik (berapa user menyimpan resep tertentu / cleanup).
create index if not exists saved_recipes_recipe_id_idx
  on public.saved_recipes (recipe_id);

-- Row Level Security: tabel baru = deny-all by default, jadi policy WAJIB di sini.
alter table public.saved_recipes enable row level security;

drop policy if exists "saved_recipes_owner" on public.saved_recipes;
create policy "saved_recipes_owner"
  on public.saved_recipes for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
