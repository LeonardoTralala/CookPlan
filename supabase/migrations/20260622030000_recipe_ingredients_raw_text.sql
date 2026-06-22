-- =============================================================================
-- Migrasi: kolom provenance recipe_ingredients.raw_text
-- -----------------------------------------------------------------------------
-- Banyak baris bahan resep berasal dari scraping (free-text), mis.
-- "100 ml air", "10 siung bawang merah, iris rajang", "Secukupnya air".
-- Recovery memecahnya jadi amount/unit/nama bersih lewat parser tunggal
-- (src/utils/parseIngredient.js). Sebelum nama ditimpa, simpan teks aslinya di
-- raw_text agar proses bisa ditelusuri & dibalik.
-- =============================================================================

alter table public.recipe_ingredients
  add column if not exists raw_text text;

comment on column public.recipe_ingredients.raw_text is
  'Teks bahan asli (sebelum normalisasi parser). NULL = input terstruktur langsung dari admin.';

-- Snapshot sekali jalan: isi raw_text dari name untuk baris yang belum punya.
-- Idempoten (where raw_text is null) & aman di env kosong/seed.
update public.recipe_ingredients
  set raw_text = name
  where raw_text is null;
