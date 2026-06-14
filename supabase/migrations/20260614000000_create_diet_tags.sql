-- =============================================================================
-- Migrasi: diet_tags (master taksonomi diet) + recipes.diet
-- -----------------------------------------------------------------------------
-- Memisahkan preferensi diet (controlled vocabulary) dari kolom recipes.tags yang
-- mencampur diet + bahan/kategori. diet_tags jadi sumber opsi diet dinamis di wizard
-- Generate Plan; recipes.diet menyimpan slug diet per resep (difilter Edge Function).
-- Fondasi MVP untuk admin-managed taxonomy (admin UI menyusul — lihat liam_docs Phase 10).
-- Tabel baru = RLS deny-all default, jadi policy dipasang di migrasi ini juga.
-- =============================================================================

-- 1) Tabel master diet_tags -----------------------------------------------------
create table if not exists public.diet_tags (
  id          bigint generated always as identity primary key,
  value       text not null unique,            -- slug PERMANEN (key) — jangan diubah
  label       text not null,                   -- teks tampilan (boleh diubah admin)
  description text,
  icon        text,                            -- nama material-symbol opsional
  sort_order  integer not null default 0,
  is_active   boolean not null default true,   -- soft hide tanpa delete
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.diet_tags is
  'Master taksonomi preferensi diet (controlled vocabulary). value = slug permanen.';
comment on column public.diet_tags.value is
  'Slug permanen, key di recipes.diet & input generate. JANGAN diubah setelah dipakai (cukup ubah label).';

-- Fungsi set_updated_at() sudah ada (migrasi profiles/recipes, search_path terkunci).
drop trigger if exists diet_tags_set_updated_at on public.diet_tags;
create trigger diet_tags_set_updated_at
  before update on public.diet_tags
  for each row execute function public.set_updated_at();

-- 2) RLS: read publik (hanya aktif), tulis admin --------------------------------
alter table public.diet_tags enable row level security;

drop policy if exists "diet_tags_read_public" on public.diet_tags;
create policy "diet_tags_read_public"
  on public.diet_tags for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "diet_tags_admin_write" on public.diet_tags;
create policy "diet_tags_admin_write"
  on public.diet_tags for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3) Seed vocabulary awal (selaras DIET_OPTIONS lama di wizard) ------------------
insert into public.diet_tags (value, label, sort_order) values
  ('vegetarian',     'Vegetarian',       1),
  ('vegan',          'Vegan',            2),
  ('halal',          'Halal',            3),
  ('tinggi-protein', 'Tinggi Protein',   4),
  ('hemat',          'Hemat Budget',     5),
  ('cepat',          'Cepat (< 30 mnt)', 6),
  ('bahan-lokal',    'Bahan Lokal',      7)
on conflict (value) do nothing;

-- 4) Kolom diet di recipes + GIN index ------------------------------------------
alter table public.recipes add column if not exists diet text[] not null default '{}';

comment on column public.recipes.diet is
  'Slug diet (dari diet_tags.value) yang berlaku untuk resep ini. Terpisah dari tags (bahan/kategori).';

-- Wajib untuk performa overlaps() saat katalog membesar (filter diet di Edge Function).
create index if not exists recipes_diet_gin on public.recipes using gin (diet);

-- 5) Backfill: salin slug diet yang valid dari tags lama -> diet -----------------
-- Hanya tag yang ada di vocabulary diet_tags yang dipindah; tag bahan (ayam, daging,
-- dst) ditinggal di kolom tags. Idempoten: aman dijalankan ulang.
update public.recipes r
set diet = coalesce((
  select array_agg(t order by t)
  from unnest(r.tags) as t
  where t in (select value from public.diet_tags)
), '{}');
