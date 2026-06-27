-- =============================================================================
-- Migrasi: lengkapi 7 resep kosong (bahan + langkah) dari bank resep CSV Cookpad
-- -----------------------------------------------------------------------------
-- 7 resep ini punya judul tapi 0 bahan & 0 langkah. Diisi dari padanan terdekat
-- di Indonesian_Food_Recipes.csv (dipilih manual). Bahan: name dibersihkan via
-- parseIngredient.js + cleaner, raw_text = teks asli (provenance). ingredient_id
-- di-link by name/alias agar trigger harga menghitung otomatis (TIDAK menulis
-- harga manual; harga = nilai turunan). Idempoten: hapus bahan lama dulu.
-- Bakwan jagung (id 192): sumber CSV "Bakwan Jagung Udang" (loves 49), UDANG DIBUANG
-- agar jadi bakwan jagung polos (dish standar tanpa seafood).
-- =============================================================================

delete from public.recipe_ingredients where recipe_id in (181, 182, 183, 186, 188, 192, 193, 201);

-- [181] sumber CSV: Capcay Sayuran Tahu
update public.recipes set
  instructions = array[
    'Haluskan bahan-bahan bumbu halus',
    'Panaskan minyak, tumis bumbu halus sampai harum. Beri air, gula, garam dan kaldu jamur, tunggu sampai mendidih.',
    'Masukkan wortel dan jagung muda, tunggu sampai empuk yg diinginkan, kemudian masukkan pokcoy, daun bawang dan tahu.',
    'Masak sampai pokcoy layu.',
    'Icipi. Koreksi rasa. Angkan dan sajikan.'
  ],
  ingredients_text = 'pokcoy, wortel, jagung muda, tahu, daun bawang, kaldu jamur Totole, Gula garam, Minyak, Air, bawang putih, bawang merah, kemiri, merica'
where id = 181;

insert into public.recipe_ingredients (recipe_id, name, amount, unit, raw_text) values
  (181, 'pokcoy', null, null, '2 bonggol pokcoy (potong sesuai selera)'),
  (181, 'wortel', 1, 'buah', '1 buah wortel (iris tipis)'),
  (181, 'jagung muda', 4, 'buah', '4 buah jagung muda (iris tipis)'),
  (181, 'tahu', 3, 'buah', '3 buah tahu (potong dadu)'),
  (181, 'daun bawang', 1, 'batang', '1 batang daun bawang (iris)'),
  (181, 'kaldu jamur Totole', 0.5, 'sdt', '1/2 sdt kaldu jamur Totole'),
  (181, 'Gula garam', null, null, 'secukupnya Gula garam'),
  (181, 'Minyak', null, null, 'Minyak secukupnya untuk menumis'),
  (181, 'Air', null, null, 'secukupnya Air'),
  (181, 'bawang putih', 4, 'siung', '4 siung bawang putih'),
  (181, 'bawang merah', 3, 'siung', '3 siung bawang merah'),
  (181, 'kemiri', 1, 'butir', '1 butir kemiri'),
  (181, 'merica', 0.5, 'sdt', '1/2 sdt merica');

-- [182] sumber CSV: Tumis wortel, buncis, jagung dan telur
update public.recipes set
  instructions = array[
    'Iris wortel kotak2 kecil, dan buncis iris kecil. Kemudian jagung ambil bijinya saja.',
    'Panaskan air, tunggu hingga mendidih. Masukan semua sayuran yang telah d siapkan. Tunggu hingga setengah matang. Angkat',
    'Iris tipis bawang merah, bawang putih dan cabai',
    'Panaskan minyak, goreng bawang hingga wangi lalu masukan telur orak-arik. Tambahkan garam sedikit. Lalu masukan sayuran yang sudsh d rebus setengah matang tadi. Tambahkan ladaku, gula, penyedap rasa. Tes rasa.'
  ],
  ingredients_text = 'wortel, telur, buncis, jagung, bawang merah, bawang putih, cabai keriting, garam, penyedap rasa, gula, ladaku'
where id = 182;

insert into public.recipe_ingredients (recipe_id, name, amount, unit, raw_text) values
  (182, 'wortel', 2, 'buah', '2 buah wortel'),
  (182, 'telur', 1, 'butir', '1 butir telur'),
  (182, 'buncis', 15, 'batang', '15 batang buncis'),
  (182, 'jagung', 1, 'buah', '1 buah jagung'),
  (182, 'bawang merah', 2, 'buah', '2 buah bawang merah'),
  (182, 'bawang putih', 2, 'buah', '2 buah bawang putih'),
  (182, 'cabai keriting', 2, 'buah', '2 buah cabai keriting'),
  (182, 'garam, penyedap rasa, gula, ladaku', null, null, 'Secukupnya garam, penyedap rasa, gula, ladaku');

-- [183] sumber CSV: Sayur asem sambal tempe praktis
update public.recipes set
  instructions = array[
    'Siapkan air mendidih dlm panci',
    'Masukkan asam daun salam, lengkuas',
    'Masukkan bahan yg diiris setelah itu masukkan tempe/bongkrek dan cabe rawit,besar,bawang merah utuh',
    'Terakhir masukkan sayurnya kacang panjang,jagung mda,daun melinjo,labu siam,kedelai beri garam penyedap icip rasa',
    'Setelah matang ambil tempe dan cabe utuhnya tiriskan',
    'Buat sambal trasi dan penyet tempenya hidangkan dg sayur asamnya....rasanya.....segar...praktis nga ribet masaknya, sehat tanpa minyak'
  ],
  ingredients_text = 'kacang panjang, jagung muda, asam jawa, Daun melinjo, tempe, cabe rawit, bawang merah, cabe merah besar, bawang putih, daun salam, lengkuas, garam,penyedap'
where id = 183;

insert into public.recipe_ingredients (recipe_id, name, amount, unit, raw_text) values
  (183, 'kacang panjang', 2, 'buah', '2 kacang panjang dipotong uk 1 ruas'),
  (183, 'jagung muda', 3, 'buah', '3 bh jagung muda diiris blt'),
  (183, 'asam jawa', 3, 'buah', '3 bh asam segar/asam jawa'),
  (183, 'Daun melinjo', null, null, 'Daun melinjo, labu siam di potong", kedelai matang'),
  (183, 'tempe', 1, null, '1 petak tempe di potong 4 bag kotak besar, bisa ditambah bongkrek'),
  (183, 'cabe rawit', 10, 'buah', '10 bh cabe rawit utuh'),
  (183, 'bawang merah', 2, 'siung', '2 siung bawang merah utuh'),
  (183, 'cabe merah besar', 2, 'buah', '2 bh cabe merah besar utuh'),
  (183, 'bawang putih', 4, 'siung', '4 siung bawang putih'),
  (183, 'bawang merah', 6, 'siung', '6 siung bawang merah'),
  (183, 'cabe merah besar', 1, 'buah', '1 bh cabe merah besar'),
  (183, 'daun salam', 2, 'lembar', '2 lbr daun salam'),
  (183, 'lengkuas', 1, 'buah', '1 bh lengkuas di keprek'),
  (183, 'garam,penyedap', null, null, 'garam,penyedap');

-- [186] sumber CSV: Sayur Bayam Tahu
update public.recipes set
  instructions = array[
    'Bersihkan tauge, potong tahu, bersihkan bayam',
    'Didihkan air, tambahkan bawang merah, bawang putih dan temukunci',
    'Masukkan jagung pipil, tunggu hingga agak lunak lalu masukkan tahu.',
    'Masukkan tauge, tunggu beberapa menit. Tambahkan gula dan garam. Koreksi rasa',
    'Pastikan bayam dimasukkan terakhir dan tidak dimasak terlalu lama. Masakan siap dihidangkan :)'
  ],
  ingredients_text = 'bayam, tahu, Tauge, Jagung, bawang merah, bawang putih, Gula, Temukunci'
where id = 186;

insert into public.recipe_ingredients (recipe_id, name, amount, unit, raw_text) values
  (186, 'bayam', 1, 'ikat', '1 ikat bayam'),
  (186, 'tahu', 2, 'buah', '2 buah tahu'),
  (186, 'Tauge', null, null, 'secukupnya Tauge'),
  (186, 'Jagung', null, null, 'Pipilan Jagung'),
  (186, 'bawang merah', 3, 'siung', '3 siung bawang merah, iris tipis'),
  (186, 'bawang putih', 2, 'siung', '2 siung bawang putih, iris tipis'),
  (186, 'Gula', null, null, 'secukupnya Gula dan garam'),
  (186, 'Temukunci', null, null, 'secukupnya Temukunci');

-- [188] sumber CSV: Tumis Buncis Tempe Kecap
update public.recipes set
  instructions = array[
    'Tempe digoreng cukup coklat keemasan, ditiriskan.',
    'Bwg2an, lengkuas, cabe, daun salam ditumis sampai harum. Ditambahkan air mineral, garam dan gula. Tempe dimasukkan, diaduk rata. Buncis dimasukkan, ditambah saus tiram dan kecap. Diaduk terus sampai matang, warna kecap merata sambil dikoreksi rasa. Bila sudah cukup kering/air habis, api dimatikan, disajikan.'
  ],
  ingredients_text = 'Buncis, Tempe, Cabe merah keriting, Bawang merah, Bawang putih, Lengkuas, Daun salam, Kecap manis, Saus tiram, Air mineral, Garam, Minyak goreng'
where id = 188;

insert into public.recipe_ingredients (recipe_id, name, amount, unit, raw_text) values
  (188, 'Buncis', 200, 'gr', '200 gr Buncis dipotong menyerong'),
  (188, 'Tempe', 250, 'gr', '250 gr (1 papan) Tempe diiris persegi panjang kecil'),
  (188, 'Cabe merah keriting', 3, 'buah', '3 buah Cabe merah keriting diiris menyerong'),
  (188, 'Bawang merah', 6, 'siung', '6 siung Bawang merah diiris2'),
  (188, 'Bawang putih', 5, 'siung', '5 siung Bawang putih diiris2'),
  (188, 'Lengkuas', 3, 'cm', '3 cm Lengkuas diiris tipis/digeprek'),
  (188, 'Daun salam', 1, 'lembar', '1 lembar Daun salam lebar'),
  (188, 'Kecap manis', 3, 'sdm', '3 sdm Kecap manis'),
  (188, 'Saus tiram', 1, 'sdt', '1 sdt Saus tiram'),
  (188, 'Air mineral', null, 'ml', '100 ml (secukupnya) Air mineral'),
  (188, 'Garam', null, null, 'Secukupnya Garam dan Gula'),
  (188, 'Minyak goreng', null, null, 'Secukupnya Minyak goreng utk menggoreng dan menumis');

-- [193] sumber CSV: Mendol Tempe / Menjeng Tempe / Perkedel Tempe
update public.recipes set
  instructions = array[
    'Haluskan semua bumbu, kemudian tambahkan garam dan gula',
    'Ulek tempe lalu campur dengan bumbu kemudian aduk hingga merata',
    'Bentuk tempe menjadi bulatan lonjong',
    'Panaskan minyak, kemudian goreng tempe dengan api kecil tunggu hingga bewarna kecoklatan',
    'Tiriskan, siap disajikan'
  ],
  ingredients_text = 'tempe, bawang putih, cabai rawit, bawang merah, merica, daun bawang, daun jeruk purut, daun seledri, kencur, garam, gula',
  cuisine = coalesce(cuisine, 'nusantara')
where id = 193;

insert into public.recipe_ingredients (recipe_id, name, amount, unit, raw_text) values
  (193, 'tempe', 2, 'buah', '2 buah tempe'),
  (193, 'bawang putih', 5, 'siung', '5 siung bawang putih'),
  (193, 'cabai rawit', null, null, 'cabai rawit'),
  (193, 'bawang merah', 6, 'buah', '6 buah bawang merah'),
  (193, 'merica', null, null, 'merica'),
  (193, 'daun bawang', 2, 'batang', '2 batang daun bawang'),
  (193, 'daun jeruk purut', 2, 'buah', '2 buah daun jeruk purut'),
  (193, 'daun seledri', null, null, 'daun seledri'),
  (193, 'kencur', 2, 'cm', '2 cm kencur'),
  (193, 'garam, gula', null, null, 'secukupnya garam, gula');

-- [201] sumber CSV: Balado Telur Dg Tahu
update public.recipes set
  instructions = array[
    'Tumis Bumbu Yg Sudah Di Ulek, Setelah Harum (Matang) Tambahkan Air Secukupnya, Setelah Mendidih Tambahkan Telur n Tahu Biarkan Lagi Hingga Mendidih Setelah Mendidih Tambahkan Garam n Gula Pasir Secukupnya, Koreksi Rasa Jika Sudah Pas Matikan Kompor...'
  ],
  ingredients_text = 'Telur Rebus, Tahu Putih, Bawang Merah, Bawang Putih, Cabe Merah Besar, Cabe Rawit Merah, Kemiri, Air, Garam, Gula Pasir',
  cuisine = coalesce(cuisine, 'nusantara')
where id = 201;

insert into public.recipe_ingredients (recipe_id, name, amount, unit, raw_text) values
  (201, 'Telur Rebus', 5, 'butir', '5 Telur Rebus Yg Sudah Di Goreng Hgg BerKulit'),
  (201, 'Tahu Putih', 3, null, '3 Tahu Putih Yg Sudah Di Goreng'),
  (201, 'Bawang Merah', 7, 'siung', '7 Siung Bawang Merah'),
  (201, 'Bawang Putih', 5, 'siung', '5 Siung Bawang Putih'),
  (201, 'Cabe Merah Besar', 9, 'buah', '9 Cabe Merah Besar'),
  (201, 'Cabe Rawit Merah', 3, 'buah', '3 Cabe Rawit Merah'),
  (201, 'Kemiri', 3, 'butir', '3 Butir Kemiri'),
  (201, 'Air', null, null, 'secukupnya Air'),
  (201, 'Garam', null, null, 'secukupnya Garam Halus'),
  (201, 'Gula Pasir', null, null, 'secukupnya Gula Pasir');

-- [192] sumber CSV: Bakwan Jagung Udang (udang dibuang -> bakwan jagung polos)
update public.recipes set
  instructions = array[
    'Dalam wadah bersih, campur semua bahan jadi satu.',
    'Tambahkan air secukupnya. Aduk rata lalu goreng sampai kuning kecoklatan. Angkat tiriskan.',
    'Hidangkan dengan rawit hijau.'
  ],
  ingredients_text = 'jagung manis, telur, tepung terigu, tepung beras, daun bawang, Air, ketumbar, bawang merah, bawang putih, gula, lada, garam',
  cuisine = coalesce(cuisine, 'nusantara')
where id = 192;

insert into public.recipe_ingredients (recipe_id, name, amount, unit, raw_text) values
  (192, 'jagung manis', 2, null, '2 bonggol jagung manis di pipil'),
  (192, 'telur', 1, 'butir', '1 butir telur'),
  (192, 'tepung terigu', 6, 'sdm', '6 sdm tepung terigu'),
  (192, 'tepung beras', 2, 'sdm', '2 sdm tepung beras'),
  (192, 'daun bawang', 2, 'batang', '2 batang daun bawang'),
  (192, 'Air', null, null, 'secukupnya Air'),
  (192, 'ketumbar', 1.5, 'sdt', '1.5 sdt ketumbar haluskan'),
  (192, 'bawang merah', 6, 'siung', '6 siung bawang merah di iris'),
  (192, 'bawang putih', 3, 'siung', '3 siung bawang putih haluskan'),
  (192, 'gula, lada, garam', null, null, 'secukupnya gula, lada dan garam');

-- Link ke master bahan (nama persis, lalu alias) -> trigger hitung harga.
update public.recipe_ingredients ri set ingredient_id = coalesce(
    (select i.id from public.ingredients i
       where lower(trim(i.name)) = lower(trim(ri.name)) order by i.id limit 1),
    (select a.ingredient_id from public.ingredient_aliases a
       where a.alias = lower(trim(ri.name)) limit 1)
  )
  where ri.recipe_id in (181, 182, 183, 186, 188, 192, 193, 201) and ri.ingredient_id is null;
