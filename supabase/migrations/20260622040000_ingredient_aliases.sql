-- =============================================================================
-- Migrasi: tabel alias bahan (sinonim → master kanonik)
-- -----------------------------------------------------------------------------
-- Parser + validasi mencegah JUNK masuk master, tapi belum mencegah duplikat
-- SEMANTIK ("santan instant" vs "santan instan", "Tempe Segar" vs "tempe").
-- ingredient_aliases memetakan varian nama (ternormalisasi) → satu master, dipakai
-- saat resolve di entri resep & diisi oleh kanonikalisasi. Ini yang membuat dedup
-- tahan banting untuk impor berikutnya.
-- =============================================================================

create table if not exists public.ingredient_aliases (
  alias         text primary key,                 -- lower(trim) varian nama
  ingredient_id integer not null references public.ingredients (id) on delete cascade,
  created_at    timestamptz not null default now()
);
comment on table public.ingredient_aliases is
  'Sinonim nama bahan → master kanonik. alias selalu lower(trim). Dipakai resolve entri resep.';
create index if not exists ingredient_aliases_ingredient_id_idx
  on public.ingredient_aliases (ingredient_id);

-- RLS: baca publik (resolve di klien), tulis admin.
alter table public.ingredient_aliases enable row level security;

drop policy if exists "ingredient_aliases_read_public" on public.ingredient_aliases;
create policy "ingredient_aliases_read_public" on public.ingredient_aliases
  for select to anon, authenticated using (true);

drop policy if exists "ingredient_aliases_admin_write" on public.ingredient_aliases;
create policy "ingredient_aliases_admin_write" on public.ingredient_aliases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
