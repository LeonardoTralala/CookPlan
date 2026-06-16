-- =============================================================================
-- Migrasi: Perbaiki image_url resep + tambah resep Indonesia populer
-- -----------------------------------------------------------------------------
-- 1) Update 6 resep seed awal → ganti URL lh3.googleusercontent (rawan expire)
--    ke Pexels CDN yang lebih stabil.
-- 2) Update resep manapun yang image_url-nya NULL dengan gambar generik makanan.
-- 3) Insert resep-resep Indonesia populer yang belum ada di katalog.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Perbaiki URL gambar 6 resep awal (ganti googleusercontent → Pexels)
-- ---------------------------------------------------------------------------
UPDATE public.recipes SET image_url =
  'https://images.pexels.com/photos/5833352/pexels-photo-5833352.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE title = 'Gado-Gado Segar';

UPDATE public.recipes SET image_url =
  'https://images.pexels.com/photos/7627386/pexels-photo-7627386.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE title = 'Soto Ayam Kampung';

UPDATE public.recipes SET image_url =
  'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE title = 'Tempe Bowl Sehat';

UPDATE public.recipes SET image_url =
  'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE title = 'Mie Goreng Jawa';

UPDATE public.recipes SET image_url =
  'https://images.pexels.com/photos/3296279/pexels-photo-3296279.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE title = 'Ikan Bakar Bali';

UPDATE public.recipes SET image_url =
  'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE title = 'Tumis Sayur Pelangi';

-- ---------------------------------------------------------------------------
-- 2. Fallback: resep manapun yang masih NULL → gambar makanan umum
-- ---------------------------------------------------------------------------
UPDATE public.recipes
SET image_url = 'https://images.pexels.com/photos/1640776/pexels-photo-1640776.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE image_url IS NULL OR image_url = '';

-- ---------------------------------------------------------------------------
-- 3. Tambah resep Indonesia populer dengan gambar Pexels
-- ---------------------------------------------------------------------------

-- Recipe 7: Rendang Daging Sapi
INSERT INTO public.recipes
  (title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
VALUES
  ('Rendang Daging Sapi',
   'Masakan khas Minang paling ikonik — daging sapi dimasak perlahan dalam santan dan rempah kaya hingga kering kecokelatan dan bumbu meresap sempurna. Makin lama disimpan makin enak.',
   120, 520, 55000,
   'https://images.pexels.com/photos/9609841/pexels-photo-9609841.jpeg?auto=compress&cs=tinysrgb&w=800',
   'hard', 'nusantara',
   array['Bahan Lokal'],
   array['halal','bahan-lokal','tinggi-protein'],
   array[
     'Haluskan bumbu: bawang merah, bawang putih, cabai merah, jahe, lengkuas, kemiri, kunyit, dan ketumbar.',
     'Tumis bumbu halus bersama serai geprek dan daun jeruk hingga harum dan berubah warna.',
     'Masukkan potongan daging sapi, aduk hingga daging berubah warna dan terlumuri bumbu.',
     'Tuangkan santan kental, masak dengan api sedang sambil diaduk sesekali agar santan tidak pecah.',
     'Kecilkan api, terus masak sambil sesekali diaduk hingga santan menyusut dan daging berwarna cokelat tua, sekitar 1,5–2 jam.',
     'Sajikan rendang sapi dengan nasi putih panas dan lalapan daun singkong rebus.'
   ],
   'daging sapi, santan kental, bawang merah, bawang putih, cabai merah, jahe, lengkuas, kemiri, serai, daun jeruk',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr)
SELECT r.id, ing.name, ing.amount, ing.unit, ing.category, ing.price_idr
FROM public.recipes r,
  (VALUES
    ('Daging Sapi Has Dalam', 400, 'g',    'meat',      35000),
    ('Santan Kental',         400, 'ml',   'dairy',     8000),
    ('Bawang Merah',          10,  'siung','spices',    3000),
    ('Bawang Putih',          5,   'siung','spices',    2000),
    ('Cabai Merah Keriting',  8,   'pcs',  'spices',    5000),
    ('Jahe',                  2,   'ruas', 'spices',    2000),
    ('Lengkuas',              2,   'ruas', 'spices',    2000),
    ('Kemiri',                4,   'butir','spices',    2000),
    ('Serai',                 3,   'batang','spices',   2000),
    ('Daun Jeruk',            6,   'lembar','spices',   1000)
  ) AS ing(name, amount, unit, category, price_idr)
WHERE r.title = 'Rendang Daging Sapi';

-- Recipe 8: Bakso Sapi Kuah
INSERT INTO public.recipes
  (title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
VALUES
  ('Bakso Sapi Kuah',
   'Bola daging sapi kenyal dan lembut dalam kuah kaldu sapi bening yang gurih dan hangat, disajikan dengan mie kuning, soun, tahu goreng, pangsit rebus, dan taburan bawang goreng.',
   60, 450, 35000,
   'https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg?auto=compress&cs=tinysrgb&w=800',
   'medium', 'nusantara',
   array['Bahan Lokal', 'Hemat Budget'],
   array['halal','bahan-lokal'],
   array[
     'Haluskan daging giling bersama bawang putih, garam, merica, dan es batu hingga tercampur rata dan kalis.',
     'Bentuk adonan menjadi bola-bola menggunakan tangan dan sendok, langsung masukkan ke air mendidih.',
     'Rebus bakso hingga mengapung, angkat dan sisihkan. Jangan buang air rebusannya — itu jadi kaldu dasar.',
     'Buat kuah: didihkan kaldu sapi, tambahkan bawang putih goreng, garam, merica, dan penyedap.',
     'Seduh mie dan soun dengan air panas. Goreng tahu hingga kecokelatan, tiriskan.',
     'Tata mie, soun, tahu goreng, dan bakso dalam mangkuk saji.',
     'Siram dengan kuah panas. Tambahkan bawang goreng, seledri, dan sambal sesuai selera.'
   ],
   'daging sapi giling, mie kuning, soun, tahu goreng, bawang putih, merica, seledri',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr)
SELECT r.id, ing.name, ing.amount, ing.unit, ing.category, ing.price_idr
FROM public.recipes r,
  (VALUES
    ('Daging Sapi Giling',  300, 'g',     'meat',      20000),
    ('Mie Kuning Basah',    150, 'g',     'dry_goods', 4000),
    ('Soun',                50,  'g',     'dry_goods', 3000),
    ('Tahu Kuning',         2,   'pcs',   'dry_goods', 4000),
    ('Bawang Putih',        5,   'siung', 'spices',    2000),
    ('Merica Bubuk',        1,   'sdt',   'spices',    2000),
    ('Es Batu',             100, 'g',     'spices',    0),
    ('Daun Seledri',        3,   'tangkai','spices',   1000)
  ) AS ing(name, amount, unit, category, price_idr)
WHERE r.title = 'Bakso Sapi Kuah';

-- Recipe 9: Nasi Uduk Betawi
INSERT INTO public.recipes
  (title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
VALUES
  ('Nasi Uduk Betawi',
   'Nasi pulen beraroma wangi khas Betawi yang dimasak dalam santan encer bersama serai, daun salam, dan daun pandan. Disajikan dengan ayam goreng kremes, tempe orek, telur balado, sambal kacang, dan emping.',
   40, 530, 32000,
   'https://images.pexels.com/photos/6896379/pexels-photo-6896379.jpeg?auto=compress&cs=tinysrgb&w=800',
   'medium', 'nusantara',
   array['Bahan Lokal', 'Hemat Budget'],
   array['halal','bahan-lokal'],
   array[
     'Cuci bersih beras, lalu tiriskan. Masak beras dengan santan encer bersama serai geprek, daun salam, daun pandan, dan garam secukupnya.',
     'Setelah santan terserap setengah, kukus nasi hingga matang sempurna dan pulen sekitar 20 menit.',
     'Goreng ayam yang sudah dibumbui (bawang putih, kunyit, garam) hingga kecokelatan dan renyah.',
     'Goreng tempe yang sudah dipotong korek api bersama kecap manis, gula merah, dan cabai rawit — jadikan tempe orek manis pedas.',
     'Goreng telur rebus dalam minyak panas sebentar, lalu masak bersama bumbu balado (cabai, tomat, bawang).',
     'Sajikan nasi uduk hangat bersama ayam goreng, tempe orek, telur balado, dan sambal kacang. Taburi bawang goreng.'
   ],
   'beras, santan encer, serai, daun salam, daun pandan, ayam, tempe, telur, kecap manis, gula merah, cabai',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr)
SELECT r.id, ing.name, ing.amount, ing.unit, ing.category, ing.price_idr
FROM public.recipes r,
  (VALUES
    ('Beras Putih',      300, 'g',     'dry_goods', 6000),
    ('Santan Encer',     350, 'ml',    'dairy',     6000),
    ('Ayam Potong',      200, 'g',     'meat',      15000),
    ('Tempe',            100, 'g',     'dry_goods', 4000),
    ('Telur Ayam',       2,   'pcs',   'dairy',     6000),
    ('Serai',            2,   'batang','spices',    2000),
    ('Daun Salam',       3,   'lembar','spices',    500),
    ('Daun Pandan',      2,   'lembar','spices',    500),
    ('Kecap Manis',      2,   'sdm',   'spices',    2000),
    ('Gula Merah',       20,  'g',     'spices',    2000)
  ) AS ing(name, amount, unit, category, price_idr)
WHERE r.title = 'Nasi Uduk Betawi';

-- Recipe 10: Sate Ayam Madura
INSERT INTO public.recipes
  (title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
VALUES
  ('Sate Ayam Madura',
   'Tusuk sate ayam empuk berbumbu kecap legit khas Madura yang dipanggang di atas arang sampai harum kecokelatan, disantap bersama saus kacang pedas manis, irisan bawang merah, dan lontong.',
   35, 380, 38000,
   'https://images.pexels.com/photos/6542674/pexels-photo-6542674.jpeg?auto=compress&cs=tinysrgb&w=800',
   'medium', 'nusantara',
   array['Bahan Lokal'],
   array['halal','bahan-lokal','tinggi-protein'],
   array[
     'Potong dada ayam menjadi kubus 2cm, tusuk 4-5 potong per tusuk sate.',
     'Buat bumbu olesan: campurkan kecap manis, minyak goreng, air perasan jeruk limau, dan bawang putih halus.',
     'Olesi sate dengan bumbu kecap, diamkan minimal 15 menit agar meresap.',
     'Panggang sate di atas arang atau wajan grill sambil sesekali dioles bumbu hingga matang kecokelatan di semua sisi.',
     'Buat saus kacang: haluskan kacang tanah goreng, cabai rawit, bawang putih, gula merah, dan garam. Encerkan dengan santan hangat.',
     'Sajikan sate panas bersama saus kacang, irisan bawang merah, cabai rawit, dan lontong atau nasi.'
   ],
   'dada ayam, kecap manis, kacang tanah, cabai rawit, bawang merah, bawang putih, gula merah, santan, jeruk limau',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr)
SELECT r.id, ing.name, ing.amount, ing.unit, ing.category, ing.price_idr
FROM public.recipes r,
  (VALUES
    ('Dada Ayam',           350, 'g',     'meat',      22000),
    ('Kecap Manis',         4,   'sdm',   'spices',    3000),
    ('Kacang Tanah Goreng', 100, 'g',     'dry_goods', 6000),
    ('Cabai Rawit',         5,   'pcs',   'spices',    2000),
    ('Bawang Merah',        5,   'siung', 'spices',    2500),
    ('Bawang Putih',        3,   'siung', 'spices',    2000),
    ('Gula Merah',          30,  'g',     'spices',    2000),
    ('Santan',              100, 'ml',    'dairy',     4000),
    ('Jeruk Limau',         2,   'pcs',   'spices',    2000)
  ) AS ing(name, amount, unit, category, price_idr)
WHERE r.title = 'Sate Ayam Madura';

-- Recipe 11: Ayam Goreng Kremes
INSERT INTO public.recipes
  (title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
VALUES
  ('Ayam Goreng Kremes',
   'Ayam goreng Jawa berkulit renyah dan luar biasa gurih, dibalut dengan kremes (remahan bumbu goreng) yang sangat garing. Disajikan bersama sambal terasi, lalapan, dan nasi pulen.',
   45, 560, 40000,
   'https://images.pexels.com/photos/60616/fried-chicken-bird-chicken-fast-food-60616.jpeg?auto=compress&cs=tinysrgb&w=800',
   'medium', 'nusantara',
   array['Bahan Lokal'],
   array['halal','bahan-lokal','tinggi-protein'],
   array[
     'Lumuri potongan ayam dengan bumbu halus (bawang putih, kunyit, kemiri, ketumbar, garam) dan air jeruk nipis. Diamkan 30 menit.',
     'Ungkep ayam berbumbu bersama santan, serai, dan daun salam dengan api kecil hingga santan terserap dan ayam setengah matang.',
     'Angkat ayam, tiriskan. Kumpulkan sisa santan berbumbu — ini akan menjadi bahan kremes.',
     'Tambahkan tepung beras ke sisa santan berbumbu, aduk hingga kental. Goreng dalam minyak panas dengan cara menyendokkan adonan encer untuk membentuk kremes.',
     'Goreng ayam ungkep dalam minyak panas hingga kulit kecokelatan dan renyah.',
     'Sajikan ayam goreng bersama kremes renyah, sambal terasi, lalapan mentimun dan selada, serta nasi putih.'
   ],
   'ayam kampung, santan, kunyit, kemiri, ketumbar, bawang putih, serai, daun salam, tepung beras, jeruk nipis',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr)
SELECT r.id, ing.name, ing.amount, ing.unit, ing.category, ing.price_idr
FROM public.recipes r,
  (VALUES
    ('Ayam Kampung Potong',  500, 'g',     'meat',      28000),
    ('Santan Encer',         200, 'ml',    'dairy',     5000),
    ('Kunyit',               2,   'ruas',  'spices',    2000),
    ('Kemiri',               3,   'butir', 'spices',    2000),
    ('Ketumbar',             1,   'sdt',   'spices',    2000),
    ('Bawang Putih',         5,   'siung', 'spices',    2000),
    ('Serai',                2,   'batang','spices',    2000),
    ('Daun Salam',           3,   'lembar','spices',    500),
    ('Tepung Beras',         3,   'sdm',   'dry_goods', 2000),
    ('Jeruk Nipis',          1,   'pcs',   'spices',    2500)
  ) AS ing(name, amount, unit, category, price_idr)
WHERE r.title = 'Ayam Goreng Kremes';

-- Recipe 12: Sayur Asem Segar
INSERT INTO public.recipes
  (title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
VALUES
  ('Sayur Asem Segar',
   'Sup sayuran bening segar yang asam segar dari asam jawa, berisi jagung manis, kacang panjang, buncis, melinjo, labu siam, dan daun melinjo — menyegarkan dan menyehatkan.',
   30, 140, 18000,
   'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=800',
   'easy', 'nusantara',
   array['Vegetarian', 'Cepat', 'Hemat Budget', 'Bahan Lokal'],
   array['vegetarian','vegan','halal','cepat','hemat','bahan-lokal'],
   array[
     'Didihkan 1 liter air, masukkan bawang merah iris, bawang putih geprek, cabai hijau, dan daun salam.',
     'Masukkan jagung manis yang sudah dipotong-potong dan kacang tanah. Rebus 10 menit.',
     'Tambahkan labu siam yang sudah dipotong kotak, buncis, dan kacang panjang. Masak 5 menit lagi.',
     'Masukkan air asam jawa, gula merah, dan garam. Cicipi, sesuaikan keseimbangan asam-manis-gurihnya.',
     'Terakhir, masukkan melinjo dan daun melinjo. Masak sebentar hingga semua bahan matang tapi masih segar.',
     'Angkat dari api. Sajikan sayur asem hangat dengan nasi putih dan lauk pauk.'
   ],
   'jagung manis, kacang panjang, buncis, labu siam, melinjo, daun melinjo, asam jawa, gula merah, bawang merah',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr)
SELECT r.id, ing.name, ing.amount, ing.unit, ing.category, ing.price_idr
FROM public.recipes r,
  (VALUES
    ('Jagung Manis',     1,   'pcs',   'vegetables', 5000),
    ('Kacang Panjang',   100, 'g',     'vegetables', 3000),
    ('Buncis',           80,  'g',     'vegetables', 3000),
    ('Labu Siam',        100, 'g',     'vegetables', 3000),
    ('Melinjo',          50,  'g',     'vegetables', 4000),
    ('Asam Jawa',        20,  'g',     'spices',     2000),
    ('Gula Merah',       15,  'g',     'spices',     1500),
    ('Bawang Merah',     5,   'siung', 'spices',     2500),
    ('Bawang Putih',     2,   'siung', 'spices',     1500),
    ('Cabai Hijau',      2,   'pcs',   'spices',     2000)
  ) AS ing(name, amount, unit, category, price_idr)
WHERE r.title = 'Sayur Asem Segar';

-- Recipe 13: Bubur Ayam Spesial
INSERT INTO public.recipes
  (title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
VALUES
  ('Bubur Ayam Spesial',
   'Bubur beras putih lembut dan gurih, disajikan dengan suwiran ayam kuning berbumbu, cakue renyah, kerupuk, bawang goreng, daun seledri, dan kuah kaldu ayam panas nan aromatik.',
   45, 390, 28000,
   'https://images.pexels.com/photos/8697543/pexels-photo-8697543.jpeg?auto=compress&cs=tinysrgb&w=800',
   'easy', 'nusantara',
   array['Hemat Budget', 'Bahan Lokal'],
   array['halal','bahan-lokal','hemat'],
   array[
     'Rebus dada ayam dengan serai, jahe, dan garam hingga empuk. Angkat ayam, suwir halus. Simpan kaldu untuk kuah.',
     'Masak beras dalam 4x volume air (1:4) dengan api kecil sambil sesekali diaduk hingga menjadi bubur yang pulen dan lembut, sekitar 30 menit.',
     'Tumis bumbu kuning (bawang putih, kunyit, kemiri, jahe) hingga harum. Masukkan suwiran ayam, aduk rata hingga ayam berbumbu kekuningan.',
     'Panaskan kembali kaldu ayam, tambahkan garam dan merica secukupnya untuk kuah siram.',
     'Tuang bubur ke dalam mangkuk, beri suwiran ayam berbumbu di atasnya.',
     'Siram dengan kuah kaldu panas. Tambahkan bawang goreng, irisan seledri, kerupuk, dan sambal kecap sesuai selera.'
   ],
   'beras putih, dada ayam, serai, jahe, kunyit, kemiri, bawang putih, bawang goreng, seledri, kerupuk',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr)
SELECT r.id, ing.name, ing.amount, ing.unit, ing.category, ing.price_idr
FROM public.recipes r,
  (VALUES
    ('Beras Putih',   200, 'g',     'dry_goods', 4000),
    ('Dada Ayam',     250, 'g',     'meat',      15000),
    ('Kunyit',        1,   'ruas',  'spices',    1500),
    ('Kemiri',        2,   'butir', 'spices',    1500),
    ('Bawang Putih',  4,   'siung', 'spices',    2000),
    ('Serai',         1,   'batang','spices',    1500),
    ('Jahe',          1,   'ruas',  'spices',    1500),
    ('Daun Seledri',  3,   'tangkai','spices',   1000),
    ('Kerupuk',       4,   'pcs',   'dry_goods', 2000),
    ('Bawang Goreng', 2,   'sdm',   'spices',    2000)
  ) AS ing(name, amount, unit, category, price_idr)
WHERE r.title = 'Bubur Ayam Spesial';

-- Recipe 14: Cap Cay Kuah
INSERT INTO public.recipes
  (title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
VALUES
  ('Cap Cay Kuah',
   'Tumisan sayuran segar beragam warna — kol, wortel, bakso, udang, sosis, dan jamur — dalam kuah gurih kental saus tiram yang lezat, cocok sebagai lauk nasi sehari-hari.',
   20, 220, 25000,
   'https://images.pexels.com/photos/3590401/pexels-photo-3590401.jpeg?auto=compress&cs=tinysrgb&w=800',
   'easy', 'asia',
   array['Cepat', 'Hemat Budget'],
   array['halal','cepat','hemat'],
   array[
     'Siapkan semua sayuran: potong kol, iris wortel serong, potong buncis 3cm, dan siangi sawi hijau.',
     'Tumis bawang putih dan bawang bombay cincang hingga harum dan layu.',
     'Masukkan udang, bakso iris, dan sosis. Tumis hingga udang berubah warna.',
     'Masukkan wortel, buncis, dan kol. Tambahkan sedikit air kaldu dan masak 3 menit.',
     'Masukkan jamur, sawi hijau, dan saus tiram, kecap asin, gula, garam, merica. Aduk rata.',
     'Buat larutan tepung maizena dengan sedikit air, tuangkan ke cap cay untuk mengentalkan kuah.',
     'Masak hingga kuah mengental. Angkat dan sajikan segera bersama nasi putih.'
   ],
   'kol, wortel, buncis, sawi hijau, udang, bakso, sosis, jamur, bawang putih, bawang bombay, saus tiram, maizena',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr)
SELECT r.id, ing.name, ing.amount, ing.unit, ing.category, ing.price_idr
FROM public.recipes r,
  (VALUES
    ('Kol',              100, 'g',     'vegetables', 2000),
    ('Wortel',           80,  'g',     'vegetables', 3000),
    ('Buncis',           80,  'g',     'vegetables', 3000),
    ('Sawi Hijau',       100, 'g',     'vegetables', 2500),
    ('Udang Kupas',      100, 'g',     'meat',       12000),
    ('Bakso Sapi',       4,   'pcs',   'meat',       4000),
    ('Sosis Ayam',       2,   'pcs',   'meat',       5000),
    ('Jamur Merang',     50,  'g',     'vegetables', 4000),
    ('Bawang Putih',     3,   'siung', 'spices',     2000),
    ('Saus Tiram',       2,   'sdm',   'spices',     3000),
    ('Tepung Maizena',   1,   'sdm',   'dry_goods',  1500)
  ) AS ing(name, amount, unit, category, price_idr)
WHERE r.title = 'Cap Cay Kuah';

-- Recipe 15: Pecel Ayam Kampung
INSERT INTO public.recipes
  (title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
VALUES
  ('Pecel Ayam Kampung',
   'Ayam kampung dibakar/digoreng berbumbu dan disajikan dengan siraman bumbu pecel kacang pedas manis yang khas, lengkap dengan lalapan timun, kemangi, dan terong muda.',
   40, 480, 35000,
   'https://images.pexels.com/photos/6542693/pexels-photo-6542693.jpeg?auto=compress&cs=tinysrgb&w=800',
   'medium', 'nusantara',
   array['Bahan Lokal'],
   array['halal','bahan-lokal','tinggi-protein'],
   array[
     'Lumuri ayam dengan bumbu halus (bawang merah, bawang putih, kunyit, garam, ketumbar) dan jeruk nipis. Diamkan 20 menit.',
     'Bakar atau goreng ayam hingga matang kecokelatan dan matang merata di semua sisi.',
     'Buat bumbu pecel: haluskan kacang tanah goreng, cabai rawit, cabai keriting, kencur, gula merah, garam, dan daun jeruk.',
     'Larutkan bumbu pecel dengan sedikit air hangat hingga kekentalan yang pas — tidak terlalu encer.',
     'Sajikan ayam bakar/goreng bersama bumbu pecel, lalapan (timun, kemangi, terong muda, kol), dan nasi putih.',
     'Beri perasan jeruk limau dan sambal terasi di sisi piring untuk pelengkap.'
   ],
   'ayam kampung, kacang tanah, cabai rawit, cabai keriting, kencur, gula merah, daun jeruk, timun, kemangi, terong',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr)
SELECT r.id, ing.name, ing.amount, ing.unit, ing.category, ing.price_idr
FROM public.recipes r,
  (VALUES
    ('Ayam Kampung',        400, 'g',     'meat',      25000),
    ('Kacang Tanah Goreng', 120, 'g',     'dry_goods', 7000),
    ('Cabai Rawit',         6,   'pcs',   'spices',    3000),
    ('Cabai Keriting',      4,   'pcs',   'spices',    2000),
    ('Kencur',              2,   'ruas',  'spices',    1500),
    ('Gula Merah',          30,  'g',     'spices',    2000),
    ('Daun Jeruk',          3,   'lembar','spices',    500),
    ('Mentimun',            1,   'pcs',   'vegetables', 3000),
    ('Kemangi',             1,   'ikat',  'vegetables', 2000),
    ('Terong Ungu Muda',    1,   'pcs',   'vegetables', 3000)
  ) AS ing(name, amount, unit, category, price_idr)
WHERE r.title = 'Pecel Ayam Kampung';

-- ---------------------------------------------------------------------------
-- Reset sequence
-- ---------------------------------------------------------------------------
SELECT setval('public.recipes_id_seq', (SELECT max(id) FROM public.recipes));
