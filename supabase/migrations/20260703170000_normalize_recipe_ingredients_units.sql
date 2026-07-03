-- SQL Perbaikan Satuan dan Normalisasi Recipe Ingredients
BEGIN;

-- 1. Standardize mass units (gram, gr -> g) in recipe_ingredients
UPDATE public.recipe_ingredients SET unit = 'g' WHERE unit IN ('gram', 'gr');

-- 2. Standardize count units (biji -> buah) in recipe_ingredients
UPDATE public.recipe_ingredients SET unit = 'buah' WHERE unit = 'biji';

-- 3. Normalize colloquial cup/glass units (gelas -> ml) in recipe_ingredients
UPDATE public.recipe_ingredients SET amount = 120.0, unit = 'ml' WHERE id = 1144; -- was 0.5 gelas air
UPDATE public.recipe_ingredients SET amount = 480.0, unit = 'ml' WHERE id = 1952; -- was 2.0 gelas santan
UPDATE public.recipe_ingredients SET amount = 240.0, unit = 'ml' WHERE id = 854;  -- was 1.0 gelas air

-- 4. Fix mismatched/unconvertible recipe ingredients by updating their units/ids
-- `ikan kembung` id 590: change unit to 'ekor' to match override
UPDATE public.recipe_ingredients SET unit = 'ekor' WHERE id = 590;
-- `kacang panjang` id 1223: change unit to 'buah' to match override
UPDATE public.recipe_ingredients SET unit = 'buah' WHERE id = 1223;
-- `kemangi` id 1281: change unit to 'pcs'
UPDATE public.recipe_ingredients SET unit = 'pcs' WHERE id = 1281;
-- `pete` id 1484: change unit to 'papan' to match override
UPDATE public.recipe_ingredients SET unit = 'papan' WHERE id = 1484;
-- `iris lengkuas` id 1904, 2100: consolidate mapping to standard lengkuas (id 591)
UPDATE public.recipe_ingredients SET ingredient_id = 591 WHERE id IN (1904, 2100);
-- `kayumanis` id 1957: change amount to 3.0, unit to 'cm'
UPDATE public.recipe_ingredients SET amount = 3.0, unit = 'cm' WHERE id = 1957;

-- 5. Add necessary unit overrides in ingredient_unit_overrides
-- `Daun Pandan` (1263): lembar -> 2g
INSERT INTO public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
VALUES (1263, 'lembar', 2)
ON CONFLICT (ingredient_id, unit) DO UPDATE SET factor_to_base = EXCLUDED.factor_to_base;

-- `kaldu bubuk` (500): sdt -> 4g
INSERT INTO public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
VALUES (500, 'sdt', 4)
ON CONFLICT (ingredient_id, unit) DO UPDATE SET factor_to_base = EXCLUDED.factor_to_base;

-- `Asem Kandis` (64): buah -> 3g
INSERT INTO public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
VALUES (64, 'buah', 3)
ON CONFLICT (ingredient_id, unit) DO UPDATE SET factor_to_base = EXCLUDED.factor_to_base;

-- `tusuk sate` (1113): buah -> 2g
INSERT INTO public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
VALUES (1113, 'buah', 2)
ON CONFLICT (ingredient_id, unit) DO UPDATE SET factor_to_base = EXCLUDED.factor_to_base;

-- `Terasi` (1024): sdt -> 4g
INSERT INTO public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
VALUES (1024, 'sdt', 4)
ON CONFLICT (ingredient_id, unit) DO UPDATE SET factor_to_base = EXCLUDED.factor_to_base;

-- `bh cabe kecil` (165): buah -> 1.5g
INSERT INTO public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
VALUES (165, 'buah', 1.5)
ON CONFLICT (ingredient_id, unit) DO UPDATE SET factor_to_base = EXCLUDED.factor_to_base;

-- `Kapulaga Arab` (508): butir -> 0.2g
INSERT INTO public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
VALUES (508, 'butir', 0.2)
ON CONFLICT (ingredient_id, unit) DO UPDATE SET factor_to_base = EXCLUDED.factor_to_base;

-- `tomat` (1029): g -> 0.01 (100g per tomato) and gram -> 0.01
INSERT INTO public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
VALUES (1029, 'g', 0.01)
ON CONFLICT (ingredient_id, unit) DO UPDATE SET factor_to_base = EXCLUDED.factor_to_base;
INSERT INTO public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
VALUES (1029, 'gram', 0.01)
ON CONFLICT (ingredient_id, unit) DO UPDATE SET factor_to_base = EXCLUDED.factor_to_base;

-- 6. Fix zero quantities in recipe_ingredients
UPDATE public.recipe_ingredients SET amount = 30.0, unit = 'ml' WHERE id = 2609; -- Minyak goreng in Rawon
UPDATE public.recipe_ingredients SET amount = 20.0, unit = 'g' WHERE id = 351;  -- Kerupuk udang in Soto Ayam
UPDATE public.recipe_ingredients SET amount = 20.0, unit = 'g' WHERE id = 356;  -- Kerupuk in Soto Ayam

COMMIT;
