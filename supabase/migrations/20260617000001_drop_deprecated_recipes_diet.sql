-- =============================================================================
-- Migrasi: buang kolom deprecated recipes.diet + benahi index
-- -----------------------------------------------------------------------------
-- Setelah `20260617000000_align_diet_tags_to_recipe_tags`, filter preferensi
-- (katalog + Edge Function generate-plan/regenerate-day) sepenuhnya pakai kolom
-- `recipes.tags`. Kolom `recipes.diet` jadi redundan: datanya subset penuh dari
-- `tags` (cuma 7 slug dasar), jadi drop = NOL kehilangan informasi.
--
-- Sekalian benahi index: GIN index lama ada di `diet` (sekarang mati), sedangkan
-- `tags` (kolom yang kini difilter via overlaps) belum punya index. Pindahkan.
-- =============================================================================

-- 1) Index untuk kolom yang sekarang difilter katalog & Edge Function.
create index if not exists recipes_tags_gin on public.recipes using gin (tags);

-- 2) Buang index mati (di kolom diet) + kolom redundan.
drop index if exists recipes_diet_gin;
alter table public.recipes drop column if exists diet;

-- 3) Perbarui komentar yang sudah usang (dulu menyebut recipes.diet).
comment on column public.diet_tags.value is
  'Slug permanen; HARUS cocok dengan recipes.tags & input generate. JANGAN diubah setelah dipakai (cukup ubah label).';
