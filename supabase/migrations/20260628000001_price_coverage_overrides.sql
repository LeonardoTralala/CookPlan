-- =============================================================================
-- Migrasi: tambah konversi satuan + harga asumsi pasar (coverage harga)
-- -----------------------------------------------------------------------------
-- Gap coverage terbesar BUKAN harga hilang, tapi konversi satuan: bahan mass-based
-- (base_unit 'g') yang diukur sdm/sdt/buah tidak terkonversi otomatis (global
-- unit_conversions hanya untuk dimensi yang sama). Override per-bahan menjembatani.
-- Faktor = gram/pcs per 1 satuan resep (konversi kuliner standar). Harga = asumsi
-- pasar (disetujui user) untuk master kanonik yang belum berharga.
-- Trigger overrides/ingredients auto-recompute recipe_ingredients.price_idr + total.
-- Idempoten (ON CONFLICT / guard price_per_base is null). Dampak: coverage baris
-- 53.9%->57.2%, resep fully-priced 55->80 (dari 148 aktif).
-- =============================================================================

insert into public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base) values
  (434, 'sdm', 13), (434, 'sdt', 4),                    -- gula pasir (g): 1 sdm~13 g, 1 sdt~4 g
  (414, 'sdm', 18), (414, 'sdt', 6), (414, 'ml', 1.2),  -- garam (g): 1 sdm~18 g, 1 sdt~6 g
  (1060, 'buah', 100), (1060, 'batang', 100),           -- wortel (g): 1 buah/batang ~100 g
  (430, 'sdm', 15), (430, 'buah', 45),                  -- gula merah (g): 1 sdm~15 g, 1 buah~45 g
  (591, 'buah', 25),                                    -- lengkuas (g): 1 buah/ruas ~25 g
  (364, 'lembar', 1)                                    -- daun bawang (pcs): 1 lembar = 1 pcs
on conflict (ingredient_id, unit) do update set factor_to_base = excluded.factor_to_base;

-- Harga asumsi pasar (master kanonik tanpa harga). Guard: hanya isi bila masih null.
update public.ingredients set price_per_base = 500
  where id = 288 and price_per_base is null;            -- cabe merah besar: Rp500/buah

-- Ronde 2: 6 override "bersih" tambahan (join by-nama, anti salah-id). Konversi kuliner.
insert into public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
select i.id, v.unit, v.factor
from (values
  ('bawang merah',        'sdm',     10.0),  -- 1 sdm ~10 g
  ('bawang merah goreng', 'sdm',      8.0),  -- 1 sdm ~8 g
  ('asam jawa',           'buah',    15.0),  -- 1 buah ~15 g
  ('tempe',               'buah',   125.0),  -- 1 buah ~125 g
  ('Seledri',             'batang',   1.0),  -- 1 batang = 1 pcs
  ('santan',              'bungkus', 65.0)   -- 1 bungkus ~65 ml
) as v(name, unit, factor)
join public.ingredients i on lower(trim(i.name)) = lower(trim(v.name))
on conflict (ingredient_id, unit) do update set factor_to_base = excluded.factor_to_base;

-- Ronde 3: override pcs->gram bumbu (1 pcs = 1 biji/siung alami). Mirror konvensi
-- siung/ruas/lembar; men-unblock baris satuan 'pcs' di resep yg di-seed belakangan.
insert into public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base) values
  (122, 'pcs', 5),  (122, 'buah', 5),   -- bawang putih: 1 siung ~5 g
  (108, 'pcs', 10),                     -- bawang merah: 1 butir ~10 g
  (904, 'pcs', 20),                     -- serai: 1 batang ~20 g
  (388, 'pcs', 0.5),                    -- daun salam: 1 lembar ~0.5 g
  (455, 'pcs', 15),                     -- jahe: 1 ruas ~15 g
  (591, 'pcs', 25),                     -- lengkuas: 1 ruas ~25 g
  (377, 'pcs', 0.5),                    -- daun jeruk: 1 lembar ~0.5 g
  (574, 'pcs', 10)                      -- kunyit: 1 ruas ~10 g
on conflict (ingredient_id, unit) do update set factor_to_base = excluded.factor_to_base;
