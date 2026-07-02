-- SQL Pembersihan & Relink Bahan Resep (Production Grade - Full DeepSeek)
BEGIN;
UPDATE public.recipe_ingredients SET name = 'tepung bumbu serbaguna', ingredient_id = 1155 WHERE id = 163;
DELETE FROM public.recipe_ingredients WHERE id = 175;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'kulit puff pastry instan', 'dry_goods', 'pcs', 12000, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'kulit puff pastry instan');
UPDATE public.recipe_ingredients
SET name = 'kulit puff pastry instan', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'kulit puff pastry instan')
WHERE id = 370;
UPDATE public.recipe_ingredients SET name = 'daun bawang', ingredient_id = 364 WHERE id = 156;
UPDATE public.recipe_ingredients SET name = 'bawang putih', ingredient_id = 122 WHERE id = 165;
UPDATE public.recipe_ingredients SET name = 'saus sambal', ingredient_id = 737 WHERE id = 167;
UPDATE public.recipe_ingredients SET name = 'air lemon', ingredient_id = 1340 WHERE id = 173;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 608;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'tepung roti', 'dry_goods', 'g', 30, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'tepung roti');
UPDATE public.recipe_ingredients
SET name = 'tepung roti', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'tepung roti')
WHERE id = 222;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 259;
UPDATE public.recipe_ingredients SET name = 'tepung maizena', ingredient_id = 1015 WHERE id = 260;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 263;
UPDATE public.recipe_ingredients SET name = 'kaldu ayam', ingredient_id = 500 WHERE id = 269;
UPDATE public.recipe_ingredients SET name = 'kaldu ayam', ingredient_id = 500 WHERE id = 280;
UPDATE public.recipe_ingredients SET name = 'cabai rawit', ingredient_id = 266 WHERE id = 290;
UPDATE public.recipe_ingredients SET name = 'cabai keriting', ingredient_id = 1253 WHERE id = 291;
UPDATE public.recipe_ingredients SET name = 'cabai merah', ingredient_id = 262 WHERE id = 307;
UPDATE public.recipe_ingredients SET name = 'kacang tanah', ingredient_id = 496 WHERE id = 309;
UPDATE public.recipe_ingredients SET name = 'kaldu bubuk', ingredient_id = 500 WHERE id = 336;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 337;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'cabai bubuk', 'spices', 'g', 100, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'cabai bubuk');
UPDATE public.recipe_ingredients
SET name = 'cabai bubuk', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'cabai bubuk')
WHERE id = 374;
UPDATE public.recipe_ingredients SET name = 'lada bubuk', ingredient_id = 628 WHERE id = 391;
UPDATE public.recipe_ingredients SET name = 'cabai rawit', ingredient_id = 266 WHERE id = 421;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'kaldu jamur bubuk', 'dry_goods', 'g', 100, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'kaldu jamur bubuk');
UPDATE public.recipe_ingredients
SET name = 'kaldu jamur bubuk', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'kaldu jamur bubuk')
WHERE id = 506;
UPDATE public.recipe_ingredients SET name = 'gula pasir', ingredient_id = 434 WHERE id = 541;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'tuna kaleng', 'meat', 'g', 130, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'tuna kaleng');
UPDATE public.recipe_ingredients
SET name = 'tuna kaleng', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'tuna kaleng')
WHERE id = 548;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'oregano', 'spices', 'g', 300, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'oregano');
UPDATE public.recipe_ingredients
SET name = 'oregano', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'oregano')
WHERE id = 552;
UPDATE public.recipe_ingredients SET name = 'keju mozzarella', ingredient_id = 1125 WHERE id = 553;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'mixed sayuran beku', 'vegetables', 'g', 30, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'mixed sayuran beku');
UPDATE public.recipe_ingredients
SET name = 'sayuran beku campur', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'mixed sayuran beku')
WHERE id = 1101;
UPDATE public.recipe_ingredients SET name = 'minyak goreng', ingredient_id = 637 WHERE id = 944;
UPDATE public.recipe_ingredients SET name = 'gula pasir', ingredient_id = 434 WHERE id = 972;
UPDATE public.recipe_ingredients SET name = 'kaldu bubuk', ingredient_id = 500 WHERE id = 1093;
UPDATE public.recipe_ingredients SET name = 'lada bubuk', ingredient_id = 628 WHERE id = 821;
UPDATE public.recipe_ingredients SET name = 'lada bubuk', ingredient_id = 628 WHERE id = 825;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'merica bubuk', 'spices', 'g', 100, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'merica bubuk');
UPDATE public.recipe_ingredients
SET name = 'merica bubuk', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'merica bubuk')
WHERE id = 1104;
UPDATE public.recipe_ingredients SET name = 'merica bubuk', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'merica bubuk') WHERE id = 1070;
UPDATE public.recipe_ingredients SET name = 'kaldu jamur', ingredient_id = 500 WHERE id = 1099;
UPDATE public.recipe_ingredients SET name = 'merica bubuk', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'merica bubuk') WHERE id = 876;
UPDATE public.recipe_ingredients SET name = 'kaldu bubuk', ingredient_id = 500 WHERE id = 1138;
UPDATE public.recipe_ingredients SET name = 'lada bubuk', ingredient_id = 628 WHERE id = 1268;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'penyedap rasa', 'spices', 'g', 40, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'penyedap rasa');
UPDATE public.recipe_ingredients
SET name = 'penyedap rasa', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'penyedap rasa')
WHERE id = 1180;
UPDATE public.recipe_ingredients SET name = 'kecap asin', ingredient_id = 521 WHERE id = 1022;
UPDATE public.recipe_ingredients SET name = 'merica bubuk', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'merica bubuk') WHERE id = 1062;
UPDATE public.recipe_ingredients SET name = 'lada bubuk', ingredient_id = 628 WHERE id = 1472;
UPDATE public.recipe_ingredients SET name = 'merica bubuk', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'merica bubuk') WHERE id = 1386;
UPDATE public.recipe_ingredients SET name = 'air', ingredient_id = 50 WHERE id = 1334;
UPDATE public.recipe_ingredients SET name = 'lada', ingredient_id = 628 WHERE id = 1531;
UPDATE public.recipe_ingredients SET name = 'penyedap rasa', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'penyedap rasa') WHERE id = 102;
UPDATE public.recipe_ingredients SET name = 'penyedap rasa', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'penyedap rasa') WHERE id = 1811;
UPDATE public.recipe_ingredients SET name = 'kaldu bubuk', ingredient_id = 500 WHERE id = 1550;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'kaldu bubuk rasa ayam', 'dry_goods', 'g', 60, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'kaldu bubuk rasa ayam');
UPDATE public.recipe_ingredients
SET name = 'kaldu bubuk ayam', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'kaldu bubuk rasa ayam')
WHERE id = 1396;
UPDATE public.recipe_ingredients SET name = 'kecap manis', ingredient_id = 527 WHERE id = 1804;
UPDATE public.recipe_ingredients SET name = 'kecap manis', ingredient_id = 527 WHERE id = 1799;
UPDATE public.recipe_ingredients SET name = 'daun pandan', ingredient_id = 1263 WHERE id = 135;
DELETE FROM public.recipe_ingredients WHERE id = 1332;
UPDATE public.recipe_ingredients SET name = 'air', ingredient_id = 50 WHERE id = 138;
UPDATE public.recipe_ingredients SET name = 'asam jawa', ingredient_id = 1227 WHERE id = 475;
UPDATE public.recipe_ingredients SET name = 'ayam', ingredient_id = 65 WHERE id = 235;
UPDATE public.recipe_ingredients SET name = 'bawang merah', ingredient_id = 108 WHERE id = 1702;
UPDATE public.recipe_ingredients SET name = 'bawang bombay', ingredient_id = 94 WHERE id = 224;
DELETE FROM public.recipe_ingredients WHERE id = 560;
UPDATE public.recipe_ingredients SET name = 'buncis', ingredient_id = 1208 WHERE id = 2082;
UPDATE public.recipe_ingredients SET name = 'bawang putih', ingredient_id = 122 WHERE id = 149;
UPDATE public.recipe_ingredients SET name = 'bawang merah', ingredient_id = 108 WHERE id = 1990;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'cabai rawit hijau', 'vegetables', 'pcs', 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'cabai rawit hijau');
UPDATE public.recipe_ingredients
SET name = 'cabai rawit hijau', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'cabai rawit hijau')
WHERE id = 1701;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'cabai rawit merah', 'vegetables', 'pcs', 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'cabai rawit merah');
UPDATE public.recipe_ingredients
SET name = 'cabai rawit merah', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'cabai rawit merah')
WHERE id = 1700;
UPDATE public.recipe_ingredients SET name = 'cabai rawit', ingredient_id = 266 WHERE id = 533;
UPDATE public.recipe_ingredients SET name = 'cabai rawit', ingredient_id = 266 WHERE id = 476;
UPDATE public.recipe_ingredients SET name = 'daging kambing', ingredient_id = 342 WHERE id = 1671;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 234;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'daun peterseli', 'vegetables', 'g', 20, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'daun peterseli');
UPDATE public.recipe_ingredients
SET name = 'daun peterseli', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'daun peterseli')
WHERE id = 1897;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'fillet ayam', 'meat', 'g', 45, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'fillet ayam');
UPDATE public.recipe_ingredients
SET name = 'fillet ayam', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'fillet ayam')
WHERE id = 253;
UPDATE public.recipe_ingredients SET name = 'daging kambing', ingredient_id = 342 WHERE id = 1951;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 115;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'ikan gurame', 'meat', 'g', 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'ikan gurame');
UPDATE public.recipe_ingredients
SET name = 'ikan gurame', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'ikan gurame')
WHERE id = 521;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'ikan tenggiri', 'meat', 'pcs', 15000, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'ikan tenggiri');
UPDATE public.recipe_ingredients
SET name = 'ikan tenggiri', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'ikan tenggiri')
WHERE id = 379;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'jengkol', 'vegetables', 'pcs', 2000, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'jengkol');
UPDATE public.recipe_ingredients
SET name = 'jengkol', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'jengkol')
WHERE id = 503;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'jeruk limo', 'vegetables', 'pcs', 2000, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'jeruk limo');
UPDATE public.recipe_ingredients
SET name = 'jeruk limo', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'jeruk limo')
WHERE id = 116;
UPDATE public.recipe_ingredients SET name = 'jeruk nipis', ingredient_id = 484 WHERE id = 380;
UPDATE public.recipe_ingredients SET name = 'jeruk nipis', ingredient_id = 484 WHERE id = 522;
UPDATE public.recipe_ingredients SET name = 'jeruk nipis', ingredient_id = 484 WHERE id = 504;
UPDATE public.recipe_ingredients SET name = 'kaldu bubuk', ingredient_id = 500 WHERE id = 137;
UPDATE public.recipe_ingredients SET name = 'kapulaga', ingredient_id = 506 WHERE id = 1677;
UPDATE public.recipe_ingredients SET name = 'kapulaga', ingredient_id = 506 WHERE id = 2153;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 1152;
UPDATE public.recipe_ingredients SET name = 'kecap manis', ingredient_id = 527 WHERE id = 257;
UPDATE public.recipe_ingredients SET name = 'terasi', ingredient_id = 1024 WHERE id = 243;
UPDATE public.recipe_ingredients SET name = 'bunga lawang', ingredient_id = 255 WHERE id = 2152;
UPDATE public.recipe_ingredients SET name = 'daun jeruk', ingredient_id = 377 WHERE id = 395;
UPDATE public.recipe_ingredients SET name = 'daun jeruk', ingredient_id = 377 WHERE id = 419;
UPDATE public.recipe_ingredients SET name = 'daun kunyit', ingredient_id = 383 WHERE id = 420;
DELETE FROM public.recipe_ingredients WHERE id = 1922;
UPDATE public.recipe_ingredients SET name = 'paprika merah', ingredient_id = 677 WHERE id = 2070;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'salmon fillet', 'meat', 'g', 250, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'salmon fillet');
UPDATE public.recipe_ingredients
SET name = 'salmon fillet', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'salmon fillet')
WHERE id = 599;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'santan instan', 'dry_goods', 'ml', 30, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'santan instan');
UPDATE public.recipe_ingredients
SET name = 'santan instan', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'santan instan')
WHERE id = 422;
UPDATE public.recipe_ingredients SET name = 'air', ingredient_id = 50 WHERE id = 267;
UPDATE public.recipe_ingredients SET name = 'tepung panir', ingredient_id = 1018 WHERE id = 915;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 178;
UPDATE public.recipe_ingredients SET name = 'jamur kuping', ingredient_id = 1233 WHERE id = 2068;
UPDATE public.recipe_ingredients SET name = 'merica', ingredient_id = 628 WHERE id = 84;
UPDATE public.recipe_ingredients SET name = 'tepung panir', ingredient_id = 1018 WHERE id = 369;
UPDATE public.recipe_ingredients SET name = 'kunyit', ingredient_id = 574 WHERE id = 342;
UPDATE public.recipe_ingredients SET name = 'beras', ingredient_id = 1360 WHERE id = 1670;
UPDATE public.recipe_ingredients SET name = 'daun bawang', ingredient_id = 364 WHERE id = 2071;
UPDATE public.recipe_ingredients SET name = 'telur ayam', ingredient_id = 972 WHERE id = 378;
DELETE FROM public.recipe_ingredients WHERE id = 532;
UPDATE public.recipe_ingredients SET name = 'tepung maizena', ingredient_id = 1015 WHERE id = 2262;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'timun', 'vegetables', 'pcs', 4000, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'timun');
UPDATE public.recipe_ingredients
SET name = 'timun', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'timun')
WHERE id = 1824;
UPDATE public.recipe_ingredients SET name = 'tomat', ingredient_id = 1029 WHERE id = 550;
UPDATE public.recipe_ingredients SET name = 'telur', ingredient_id = 972 WHERE id = 1390;
UPDATE public.recipe_ingredients SET name = 'bawang goreng', ingredient_id = 107 WHERE id = 2478;
UPDATE public.recipe_ingredients SET name = 'minyak goreng', ingredient_id = 637 WHERE id = 86;
UPDATE public.recipe_ingredients SET name = 'minyak goreng', ingredient_id = 637 WHERE id = 139;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'ikan gurami', 'meat', 'pcs', 25000, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'ikan gurami');
UPDATE public.recipe_ingredients
SET name = 'ikan gurami', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'ikan gurami')
WHERE id = 478;
UPDATE public.recipe_ingredients SET name = 'cabai rawit', ingredient_id = 266 WHERE id = 398;
UPDATE public.recipe_ingredients SET name = 'jeruk limau', ingredient_id = 479 WHERE id = 401;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 2486;
DELETE FROM public.recipe_ingredients WHERE id = 450;
DELETE FROM public.recipe_ingredients WHERE id = 585;
UPDATE public.recipe_ingredients SET name = 'cabai merah keriting', ingredient_id = 264 WHERE id = 534;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'bawang bombai', 'vegetables', 'pcs', 1500, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'bawang bombai');
UPDATE public.recipe_ingredients
SET name = 'bawang bombai', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'bawang bombai')
WHERE id = 848;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'cuka', 'dry_goods', 'ml', 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'cuka');
UPDATE public.recipe_ingredients
SET name = 'cuka', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'cuka')
WHERE id = 1827;
UPDATE public.recipe_ingredients SET name = 'minyak samin', ingredient_id = 643 WHERE id = 1878;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'kismis', 'dry_goods', 'g', 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'kismis');
UPDATE public.recipe_ingredients
SET name = 'kismis', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'kismis')
WHERE id = 1895;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'kaldu bubuk sapi', 'spices', 'g', 300, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'kaldu bubuk sapi');
UPDATE public.recipe_ingredients
SET name = 'kaldu bubuk sapi', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'kaldu bubuk sapi')
WHERE id = 1906;
UPDATE public.recipe_ingredients SET name = 'santan instan', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'santan instan') WHERE id = 1908;
UPDATE public.recipe_ingredients SET name = 'minyak sayur', ingredient_id = 645 WHERE id = 1909;
UPDATE public.recipe_ingredients SET name = 'bawang goreng', ingredient_id = 107 WHERE id = 1910;
UPDATE public.recipe_ingredients SET name = 'kecap manis', ingredient_id = 527 WHERE id = 1920;
DELETE FROM public.recipe_ingredients WHERE id = 2123;
UPDATE public.recipe_ingredients SET name = 'kecap manis', ingredient_id = 527 WHERE id = 1925;
UPDATE public.recipe_ingredients SET name = 'gula pasir', ingredient_id = 434 WHERE id = 1961;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'wijen', 'dry_goods', 'g', 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'wijen');
UPDATE public.recipe_ingredients
SET name = 'wijen', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'wijen')
WHERE id = 2078;
UPDATE public.recipe_ingredients SET name = 'gula pasir', ingredient_id = 434 WHERE id = 2104;
UPDATE public.recipe_ingredients SET name = 'gula pasir', ingredient_id = 434 WHERE id = 2184;
UPDATE public.recipe_ingredients SET name = 'bawang goreng', ingredient_id = 107 WHERE id = 2220;
UPDATE public.recipe_ingredients SET name = 'garam', ingredient_id = 414 WHERE id = 806;
UPDATE public.recipe_ingredients SET name = 'penyedap rasa', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'penyedap rasa') WHERE id = 364;
UPDATE public.recipe_ingredients SET name = 'penyedap rasa', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'penyedap rasa') WHERE id = 195;
UPDATE public.recipe_ingredients SET name = 'gula pasir', ingredient_id = 434 WHERE id = 1568;
UPDATE public.recipe_ingredients SET name = 'penyedap rasa', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'penyedap rasa') WHERE id = 1318;
UPDATE public.recipe_ingredients SET name = 'gula pasir', ingredient_id = 434 WHERE id = 1317;
DELETE FROM public.recipe_ingredients WHERE id = 1993;
UPDATE public.recipe_ingredients SET name = 'bawang bombay', ingredient_id = 94 WHERE id = 2069;
UPDATE public.recipe_ingredients SET name = 'minyak goreng', ingredient_id = 637 WHERE id = 2266;
UPDATE public.recipe_ingredients SET name = 'gula pasir', ingredient_id = 434 WHERE id = 2216;
UPDATE public.recipe_ingredients SET name = 'kecap manis', ingredient_id = 527 WHERE id = 2260;
UPDATE public.recipe_ingredients SET name = 'kaldu jamur', ingredient_id = 500 WHERE id = 121;
UPDATE public.recipe_ingredients SET name = 'minyak goreng', ingredient_id = 637 WHERE id = 164;
-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT 'kacang tanah goreng', 'dry_goods', 'g', 30, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = 'kacang tanah goreng');
UPDATE public.recipe_ingredients
SET name = 'kacang tanah goreng', ingredient_id = (SELECT id FROM public.ingredients WHERE name = 'kacang tanah goreng')
WHERE id = 285;
UPDATE public.recipe_ingredients SET name = 'soun', ingredient_id = 932 WHERE id = 348;
DELETE FROM public.recipe_ingredients WHERE id = 350;
UPDATE public.recipe_ingredients SET name = 'wortel', ingredient_id = 1060 WHERE id = 365;
DELETE FROM public.recipe_ingredients WHERE id = 357;
DELETE FROM public.recipe_ingredients WHERE id = 1112;
COMMIT;
