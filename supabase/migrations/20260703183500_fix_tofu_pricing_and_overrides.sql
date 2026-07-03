-- =============================================================================
-- Migrasi: Memperbaiki Harga Tahu dan Konversi Satuan Tahu Putih Kotak Besar
-- -----------------------------------------------------------------------------
-- Menghapus override 'buah' pada tahu putih kotak besar (id 947) agar menggunakan
-- konversi global (1 buah = 1 pcs).
-- Mengoreksi override 'bungkus' pada tahu putih kotak besar (id 947) dari 100 menjadi 4.
-- Menyelaraskan pemetaan beberapa bahan tahu ke ID bahan yang lebih sesuai.
-- =============================================================================

BEGIN;

-- 1. Hapus override unit 'buah' untuk tahu putih kotak besar (id 947)
-- Hal ini dilakukan agar satuan 'buah' menggunakan konversi global default (factor = 1)
DELETE FROM public.ingredient_unit_overrides
WHERE ingredient_id = 947 AND unit = 'buah';

-- 2. Koreksi override unit 'bungkus' untuk tahu putih kotak besar (id 947) menjadi 4
-- Karena 1 bungkus tahu putih biasanya berisi sekitar 4-5 buah/pcs, bukan 100
UPDATE public.ingredient_unit_overrides
SET factor_to_base = 4
WHERE ingredient_id = 947 AND unit = 'bungkus';

-- 3. Selaraskan pemetaan bahan resep agar lebih akurat secara semantik
-- Tahu Gejrot Cirebon (resep 71): tahu pong/tahu sumedang lebih cocok dipetakan ke Tahu Kulit (id 941)
UPDATE public.recipe_ingredients
SET ingredient_id = 941
WHERE id = 954;

-- Semur Kecap Telur Tahu (resep 93): tahu kuning lebih cocok dipetakan ke bh tahu kuning (id 189)
UPDATE public.recipe_ingredients
SET ingredient_id = 189
WHERE id = 1149;

-- Tahu aci (resep 57): tahu bandung/tahu kuning lebih cocok dipetakan ke bh tahu kuning (id 189)
UPDATE public.recipe_ingredients
SET ingredient_id = 189
WHERE id = 791;

COMMIT;
