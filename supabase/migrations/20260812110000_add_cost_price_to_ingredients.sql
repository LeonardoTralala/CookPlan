-- =============================================================================
-- Migrasi: Tambahkan kolom cost_price_per_base (Harga Dasar / Modal) ke public.ingredients
-- -----------------------------------------------------------------------------
-- Memungkinkan admin memantau harga dasar (modal) vs harga jual (price_per_base)
-- serta menghitung margin keuntungan (Nominal & Persentase) di Master Bahan.
-- =============================================================================

alter table public.ingredients
  add column if not exists cost_price_per_base numeric;

comment on column public.ingredients.cost_price_per_base is
  'Harga dasar / modal per 1 base_unit (g/ml/pcs). Digunakan untuk perhitungan margin.';

-- Inisialisasi data awal: jika cost_price_per_base belum diisi, set perkiraan awal
-- dari price_per_base / 1.3 (markup 30%) agar admin memiliki baseline awal.
update public.ingredients
  set cost_price_per_base = round((price_per_base / 1.3)::numeric, 4)
  where price_per_base is not null and cost_price_per_base is null;
