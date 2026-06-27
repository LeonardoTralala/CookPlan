-- Seed: Resep Mie Goreng Jawa
do $$
declare _id integer;
begin
  insert into public.recipes (title, description, ready_in_minutes, calories, difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings, is_active)
  values (
    'Mie Goreng Jawa',
    'Mie kuning goreng khas Jawa dengan potongan ayam, sayuran segar, dan perpaduan kecap manis serta air asam jawa yang memberikan cita rasa gurih dan sedikit asam.',
    30, 380, 'easy', 'nusantara',
    array['Mie', 'Ayam'],
    array['ayam', 'halal'],
    array[
      'Rebus mie hingga matang, angkat dan tiriskan.',
      'Tumis bawang putih dan bawang bombay hingga harum. Masukkan daging ayam, masak hingga berubah warna.',
      'Tambahkan wortel, kol, dan daun bawang. Masak hingga layu.',
      'Masukkan mie yang sudah direbus, kecap manis, air asam jawa, garam, dan merica. Aduk rata hingga semua tercampur.',
      'Sajikan dengan taburan bawang goreng dan seledri.'
    ],
    'Mie kuning, ayam potong, bawang putih, bawang bombay, wortel, kol, daun bawang, kecap manis, air asam jawa, garam, merica, bawang goreng, seledri',
    2, true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Mie kuning',     200, 'g',   'dry_goods'),
    (_id, 'Ayam potong',    200, 'g',   'meat'),
    (_id, 'Bawang putih',     4, 'pcs', 'spices'),
    (_id, 'Bawang bombay',    1, 'pcs', 'vegetables'),
    (_id, 'Wortel',         100, 'g',   'vegetables'),
    (_id, 'Kol',            100, 'g',   'vegetables'),
    (_id, 'Daun bawang',      2, 'pcs', 'vegetables'),
    (_id, 'Kecap manis',     30, 'ml',  'dry_goods'),
    (_id, 'Air asam jawa', null, null,  'spices'),
    (_id, 'Bawang goreng', null, null,  'dry_goods'),
    (_id, 'Seledri',       null, null,  'vegetables'),
    (_id, 'Garam',         null, null,  'spices'),
    (_id, 'Merica bubuk',  null, null,  'spices'),
    (_id, 'Minyak goreng',   30, 'ml',  'dry_goods');
end;
$$;
