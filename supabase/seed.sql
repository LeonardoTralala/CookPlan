-- =============================================================================
-- Seed: 6 resep awal (dari src/utils/mockRecipes.js) ke recipes + recipe_ingredients
-- -----------------------------------------------------------------------------
-- Dijalankan otomatis saat `supabase db reset`. Idempoten: truncate dulu agar
-- reset selalu menghasilkan state bersih. Harga & takaran mengikuti porsi dasar 2.
-- =============================================================================

truncate table public.recipe_ingredients restart identity cascade;
truncate table public.recipes restart identity cascade;

-- ---------------------------------------------------------------------------
-- Recipe 1: Gado-Gado Segar
-- ---------------------------------------------------------------------------
insert into public.recipes
  (id, title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
overriding system value
values
  (1, 'Gado-Gado Segar',
   'Salad khas Indonesia berisi sayuran rebus, telur, tahu, tempe, disiram dengan saus kacang gurih manis yang melimpah dan taburan kerupuk renyah.',
   25, 320, 30000,
   'https://commons.wikimedia.org/wiki/Special:FilePath/Gado-gado.jpg?width=800',
   'easy', 'nusantara',
   array['Vegetarian','Hemat Budget','Bahan Lokal'],
   array['vegetarian','halal','hemat'],
   array[
     'Potong tahu dan tempe kotak-kotak, lalu goreng hingga kecokelatan dan tiriskan.',
     'Rebus bayam dan tauge secara terpisah hingga matang layu, lalu tiriskan.',
     'Goreng kacang tanah hingga kecokelatan. Haluskan kacang goreng bersama bawang putih, cabai rawit, gula merah, dan garam. Tambahkan sedikit air hangat dan air asam jawa hingga mengental.',
     'Susun sayuran rebus, tempe, tahu, dan irisan telur rebus di atas piring saji.',
     'Siram dengan saus kacang hangat dan sajikan dengan taburan bawang goreng serta kerupuk.'
   ],
   'kacang tanah, tahu putih, tempe, bayam, tauge, telur rebus, gula merah, bawang putih, cabai rawit',
   2);

insert into public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr) values
  (1, 'Kacang Tanah', 150, 'g', 'dry_goods', 8000),
  (1, 'Tahu Putih', 2, 'pcs', 'dry_goods', 5000),
  (1, 'Tempe', 150, 'g', 'dry_goods', 5000),
  (1, 'Bayam', 1, 'ikat', 'vegetables', 3000),
  (1, 'Tauge', 100, 'g', 'vegetables', 3000),
  (1, 'Telur Rebus', 2, 'pcs', 'dairy', 6000),
  (1, 'Gula Merah', 50, 'g', 'spices', 3000),
  (1, 'Bawang Putih', 2, 'siung', 'spices', 1500),
  (1, 'Cabai Rawit', 3, 'pcs', 'spices', 2000);

-- ---------------------------------------------------------------------------
-- Recipe 2: Soto Ayam Kampung
-- ---------------------------------------------------------------------------
insert into public.recipes
  (id, title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
overriding system value
values
  (2, 'Soto Ayam Kampung',
   'Sup ayam tradisional berkuah kuning bening yang hangat dan aromatik, disajikan dengan suwiran ayam kampung, soun, kol, telur rebus, koya, dan perasan jeruk nipis.',
   45, 410, 40000,
   'https://commons.wikimedia.org/wiki/Special:FilePath/Soto_ayam.JPG?width=800',
   'medium', 'nusantara',
   array['Bahan Lokal','Hemat Budget'],
   array['halal','bahan-lokal'],
   array[
     'Rebus ayam kampung dalam air mendidih bersama serai dan daun jeruk hingga empuk. Angkat ayam, tiriskan, dan suwir-suwir dagingnya. Jangan buang air kaldu rebusannya.',
     'Haluskan bawang merah, bawang putih, kunyit, jahe, kemiri, ketumbar, dan merica.',
     'Tumis bumbu halus hingga harum dan matang, lalu masukkan ke dalam panci berisi kaldu ayam hangat.',
     'Didihkan kuah soto dengan api kecil agar bumbu meresap sempurna. Tambahkan garam dan gula secukupnya.',
     'Seduh soun dan tauge dengan air panas, lalu iris kol tipis-tipis.',
     'Tata soun, kol, tauge, suwiran ayam, dan irisan telur rebus di dalam mangkok.',
     'Siram dengan kuah soto panas. Sajikan dengan bawang goreng, daun seledri, koya, dan jeruk nipis.'
   ],
   'daging ayam kampung, kol, soun, tauge, telur rebus, kunyit, serai, daun jeruk, bawang merah, bawang putih',
   2);

insert into public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr) values
  (2, 'Daging Ayam Kampung', 350, 'g', 'meat', 25000),
  (2, 'Kol', 100, 'g', 'vegetables', 3000),
  (2, 'Soun', 50, 'g', 'dry_goods', 4000),
  (2, 'Tauge', 50, 'g', 'vegetables', 2000),
  (2, 'Telur Rebus', 2, 'pcs', 'dairy', 6000),
  (2, 'Kunyit', 2, 'ruas', 'spices', 2000),
  (2, 'Serai', 2, 'batang', 'spices', 2000),
  (2, 'Daun Jeruk', 4, 'lembar', 'spices', 1000),
  (2, 'Bawang Merah', 6, 'siung', 'spices', 3000),
  (2, 'Bawang Putih', 4, 'siung', 'spices', 2000);

-- ---------------------------------------------------------------------------
-- Recipe 3: Tempe Bowl Sehat
-- ---------------------------------------------------------------------------
insert into public.recipes
  (id, title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
overriding system value
values
  (3, 'Tempe Bowl Sehat',
   'Menu sehat minimalis modern yang memadukan nasi merah hangat, tempe panggang bumbu wijen, irisan alpukat mentega, edamame manis, dan wortel iris.',
   20, 350, 25000,
   'https://commons.wikimedia.org/wiki/Special:FilePath/Tempe_and_tahu_goreng.JPG?width=800',
   'easy', 'asia',
   array['Vegetarian','Cepat','Hemat Budget'],
   array['vegetarian','halal','cepat','tinggi-protein'],
   array[
     'Potong tempe berbentuk kubus tebal. Rendam dalam campuran kecap asin, minyak wijen, dan sedikit bawang putih bubuk selama 5 menit.',
     'Panggang tempe di atas wajan anti lengket (pan) hingga kecokelatan di seluruh sisi tanpa minyak berlebih.',
     'Rebus edamame kupas dan wortel yang telah diiris tipis korek api hingga setengah matang, lalu tiriskan.',
     'Siapkan mangkuk saji, tata nasi merah di bagian dasar mangkuk.',
     'Susun tempe panggang, edamame rebus, irisan wortel, dan irisan alpukat segar di atas nasi merah secara teratur.',
     'Taburkan biji wijen di atas tempe dan alpukat. Siap disajikan hangat.'
   ],
   'tempe segar, nasi merah, alpukat mentega, edamame kupas, wortel, minyak wijen, kecap asin, biji wijen',
   2);

insert into public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr) values
  (3, 'Tempe Segar', 150, 'g', 'dry_goods', 5000),
  (3, 'Nasi Merah', 200, 'g', 'dry_goods', 6000),
  (3, 'Alpukat Mentega', 0.5, 'pcs', 'vegetables', 8000),
  (3, 'Edamame Kupas', 50, 'g', 'vegetables', 5000),
  (3, 'Wortel', 50, 'g', 'vegetables', 2000),
  (3, 'Minyak Wijen', 1, 'sdm', 'spices', 3000),
  (3, 'Kecap Asin', 2, 'sdm', 'spices', 2000),
  (3, 'Biji Wijen', 1, 'sdt', 'spices', 3000);

-- ---------------------------------------------------------------------------
-- Recipe 4: Mie Goreng Jawa
-- ---------------------------------------------------------------------------
insert into public.recipes
  (id, title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
overriding system value
values
  (4, 'Mie Goreng Jawa',
   'Mie kuning tradisional yang ditumis gurih dengan racikan bumbu kemiri khas Jawa, dilengkapi kol segar, sawi hijau, suwiran ayam, bakso sapi, dan telur dadar iris.',
   15, 480, 28000,
   'https://commons.wikimedia.org/wiki/Special:FilePath/Mie_goreng.jpg?width=800',
   'easy', 'nusantara',
   array['Cepat','Hemat Budget'],
   array['halal','cepat'],
   array[
     'Haluskan bawang merah, bawang putih, kemiri, merica bubuk, dan garam.',
     'Tumis bumbu halus hingga tercium aroma wangi di wajan.',
     'Masukkan telur ayam, orak-arik kasar di wajan bersama bumbu. Tambahkan irisan bakso sapi.',
     'Masukkan irisan kol dan sawi hijau, tumis sebentar hingga sayuran agak layu.',
     'Masukkan mie kuning basah, tuangkan kecap manis, kaldu jamur secukupnya.',
     'Aduk cepat mie dengan api besar agar bumbu merata dan meresap sempurna. Angkat.',
     'Sajikan mie goreng Jawa hangat dengan taburan bawang goreng dan acar timun.'
   ],
   'mie basah kuning, kol, sawi hijau, bakso sapi, telur ayam, kecap manis, kemiri, bawang merah, bawang putih',
   2);

insert into public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr) values
  (4, 'Mie Basah Kuning', 200, 'g', 'dry_goods', 5000),
  (4, 'Kol', 50, 'g', 'vegetables', 2000),
  (4, 'Sawi Hijau', 50, 'g', 'vegetables', 2000),
  (4, 'Bakso Sapi', 4, 'pcs', 'meat', 8000),
  (4, 'Telur Ayam', 1, 'pcs', 'dairy', 3000),
  (4, 'Kecap Manis', 3, 'sdm', 'spices', 3000),
  (4, 'Kemiri', 2, 'butir', 'spices', 2000),
  (4, 'Bawang Merah', 4, 'siung', 'spices', 2000),
  (4, 'Bawang Putih', 2, 'siung', 'spices', 1500);

-- ---------------------------------------------------------------------------
-- Recipe 5: Ikan Bakar Bali
-- ---------------------------------------------------------------------------
insert into public.recipes
  (id, title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
overriding system value
values
  (5, 'Ikan Bakar Bali',
   'Ikan laut segar panggang yang dilumuri bumbu khas Bali (Base Gede) yang kaya rempah eksotis, disajikan lengkap dengan sambal matah segar beraroma serai dan daun jeruk.',
   40, 290, 48000,
   'https://commons.wikimedia.org/wiki/Special:FilePath/Ikan_kakap_bakar_madu.JPG?width=800',
   'medium', 'nusantara',
   array['Bahan Lokal'],
   array['halal','bahan-lokal','tinggi-protein'],
   array[
     'Bersihkan ikan, kerat-kerat badannya, lalu lumuri dengan perasan air jeruk nipis dan garam. Diamkan 10 menit.',
     'Haluskan cabai merah, bawang putih, kunyit, jahe, kemiri, dan terasi. Tumis bumbu halus bersama serai geprek hingga matang harum, sisihkan sebagian untuk bumbu olesan ikan.',
     'Bakar/panggang ikan di atas alat pemanggang sambil diolesi bumbu tumis kelapa secara berulang hingga matang merata di kedua sisi.',
     'Untuk Sambal Matah: Iris tipis bawang merah, cabai rawit, serai bagian dalam, dan daun jeruk. Campurkan di mangkuk bersama garam, sedikit terasi, dan perasan jeruk limau. Siram dengan minyak kelapa super panas.',
     'Sajikan ikan bakar Bali hangat dengan siraman sambal matah segar di atasnya.'
   ],
   'ikan nila/kerapu, cabai merah keriting, bawang merah, bawang putih, serai, daun jeruk purut, terasi bakar, minyak kelapa, jeruk nipis',
   2);

insert into public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr) values
  (5, 'Ikan Nila/Kerapu', 400, 'g', 'meat', 35000),
  (5, 'Cabai Merah Keriting', 5, 'pcs', 'spices', 5000),
  (5, 'Bawang Merah', 8, 'siung', 'spices', 3000),
  (5, 'Bawang Putih', 3, 'siung', 'spices', 2000),
  (5, 'Serai', 3, 'batang', 'spices', 2000),
  (5, 'Daun Jeruk Purut', 4, 'lembar', 'spices', 1000),
  (5, 'Terasi Bakar', 1, 'sdt', 'spices', 2000),
  (5, 'Minyak Kelapa', 3, 'sdm', 'spices', 4000),
  (5, 'Jeruk Nipis', 1, 'pcs', 'spices', 2500);

-- ---------------------------------------------------------------------------
-- Recipe 6: Tumis Sayur Pelangi
-- ---------------------------------------------------------------------------
insert into public.recipes
  (id, title, description, ready_in_minutes, calories, price_idr, image_url,
   difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings)
overriding system value
values
  (6, 'Tumis Sayur Pelangi',
   'Sajian tumisan sayuran warna-warni yang sehat, renyah, dan berprotein tinggi, berisi wortel, jagung muda, brokoli, kembang kol, tauge besar, dan tahu sutra goreng.',
   15, 180, 22000,
   'https://commons.wikimedia.org/wiki/Special:FilePath/Tumis_kangkung.JPG?width=800',
   'easy', 'nusantara',
   array['Vegetarian','Cepat','Hemat Budget','Bahan Lokal'],
   array['vegetarian','vegan','halal','cepat','hemat','bahan-lokal'],
   array[
     'Potong tahu sutra menjadi kotak-kotak, lalu goreng sebentar hingga berkulit luar. Sisihkan.',
     'Potong brokoli per kuntum kecil, iris tipis wortel secara serong, dan potong jagung muda memanjang.',
     'Tumis cincangan bawang putih hingga harum kekuningan.',
     'Masukkan wortel dan jagung muda terlebih dahulu bersama sedikit air karena teksturnya keras. Masak hingga setengah matang.',
     'Masukkan brokoli dan tahu goreng. Tambahkan saus tiram vegetarian, garam, merica, dan sedikit gula.',
     'Aduk cepat dengan api sedang hingga brokoli berubah warna hijau segar tapi teksturnya masih renyah.',
     'Sesaat sebelum diangkat, tuangkan minyak wijen untuk aroma harum khas oriental. Sajikan hangat.'
   ],
   'brokoli, wortel, jagung muda, tahu sutra, bawang putih, saus tiram vegetarian, minyak wijen',
   2);

insert into public.recipe_ingredients (recipe_id, name, amount, unit, category, price_idr) values
  (6, 'Brokoli', 100, 'g', 'vegetables', 5000),
  (6, 'Wortel', 80, 'g', 'vegetables', 3000),
  (6, 'Jagung Muda', 50, 'g', 'vegetables', 3000),
  (6, 'Tahu Sutra', 1, 'pcs', 'dry_goods', 4000),
  (6, 'Bawang Putih', 3, 'siung', 'spices', 2000),
  (6, 'Saus Tiram Vegetarian', 2, 'sdm', 'spices', 4000),
  (6, 'Minyak Wijen', 1, 'sdt', 'spices', 2000);

-- Reset sequence agar insert berikutnya (resep baru manual) tidak bentrok id.
select setval('public.recipes_id_seq', (select max(id) from public.recipes));

-- =============================================================================
-- Seed: ai_providers (config awal)
-- -----------------------------------------------------------------------------
-- API key di-seed PLACEHOLDER untuk local dev. Ganti via Admin UI (/admin/ai)
-- atau update manual sebelum generate. JANGAN commit key asli ke git.
-- =============================================================================
truncate table public.ai_providers restart identity cascade;

insert into public.ai_providers
  (label, base_url, api_key, model, temperature, max_tokens,
   supports_json_mode, is_reasoning, is_active, is_fallback, estimated_latency_seconds, notes)
values
  -- PRIMARY: Opus (apc)
  ('Claude Opus 4.6 (9router)',
   'https://9router.dubeli.com/v1', 'REPLACE_ME_9ROUTER_KEY',
   'apc/claude-opus-4.6', 0.70, 4096,
   true, true, true, false, 45,
   'Primary. Opus 4.6 via 9router (apc). Kuat, agak lambat (~45-60s). Ganti api_key via /admin/ai.'),
  -- FALLBACK: Sonnet (kr)
  ('Claude Sonnet 4.5 Thinking (9router)',
   'https://9router.dubeli.com/v1', 'REPLACE_ME_9ROUTER_KEY',
   'kr/claude-sonnet-4.5-thinking', 0.70, 4096,
   true, true, false, true, 25,
   'Fallback. Sonnet 4.5 thinking via 9router (kr). Lebih gesit dari opus.'),
  -- CADANGAN: Gemini
  ('Gemini 2.0 Flash',
   'https://generativelanguage.googleapis.com/v1beta/openai', 'REPLACE_ME_GEMINI_KEY',
   'gemini-2.0-flash', 0.70, 4096,
   true, false, false, false, 5,
   'Cadangan. Isi GEMINI key asli kalau mau dipakai. Cepat & murah.');
