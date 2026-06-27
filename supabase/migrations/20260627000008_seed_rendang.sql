-- Seed: Resep Rendang
do $$
declare _id integer;
begin
  insert into public.recipes (title, description, ready_in_minutes, calories, difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings, is_active)
  values (
    'Rendang',
    'Masakan daging sapi khas Minang yang dimasak perlahan 2-3 jam dalam santan dan bumbu rempah lengkap hingga kuah mengental dan bumbu meresap ke dalam daging.',
    180, 460, 'hard', 'nusantara',
    array['Sapi', 'Khas Minang'],
    array['sapi', 'halal'],
    array[
      'Blender semua bumbu halus (bawang, cabai, kemiri, jahe, lengkuas, lada, ketumbar) hingga halus.',
      'Panaskan minyak, tumis bumbu halus bersama serai, daun jeruk, dan daun salam hingga harum dan matang.',
      'Masukkan potongan daging sapi, aduk hingga berubah warna.',
      'Tambahkan santan, air, gula merah, dan garam. Masak dengan api besar hingga mendidih.',
      'Kecilkan api dan lanjutkan memasak selama 2-3 jam hingga daging empuk dan kuah mengental.'
    ],
    'Daging sapi, santan, bawang merah, bawang putih, cabai merah, kemiri, jahe, lengkuas, ketumbar, lada, serai, daun jeruk, daun salam, gula merah, garam',
    4, true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Daging sapi',   500, 'g',   'meat'),
    (_id, 'Santan',        400, 'ml',  'dairy'),
    (_id, 'Bawang merah',   10, 'pcs', 'spices'),
    (_id, 'Bawang putih',    6, 'pcs', 'spices'),
    (_id, 'Cabai merah',     8, 'pcs', 'spices'),
    (_id, 'Kemiri',          4, 'pcs', 'spices'),
    (_id, 'Jahe',            2, 'pcs', 'spices'),
    (_id, 'Lengkuas',        2, 'pcs', 'spices'),
    (_id, 'Ketumbar',        5, 'g',   'spices'),
    (_id, 'Lada',         null, null,  'spices'),
    (_id, 'Serai',           2, 'pcs', 'spices'),
    (_id, 'Daun jeruk',      4, 'pcs', 'spices'),
    (_id, 'Daun salam',      3, 'pcs', 'spices'),
    (_id, 'Gula merah',     15, 'g',   'dry_goods'),
    (_id, 'Garam',        null, null,  'spices'),
    (_id, 'Minyak goreng',  30, 'ml',  'dry_goods');
end;
$$;
