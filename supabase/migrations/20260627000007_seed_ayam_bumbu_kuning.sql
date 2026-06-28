-- Seed: Resep Ayam Bumbu Kuning
do $$
declare _id integer;
begin
  insert into public.recipes (title, description, ready_in_minutes, calories, difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings, is_active)
  values (
    'Ayam Bumbu Kuning',
    'Ayam yang dimarinasi jeruk nipis lalu diungkep bersama bumbu kuning rempah — kunyit, kemiri, dan jahe — hingga empuk dan bumbu meresap sempurna.',
    60, 360, 'medium', 'nusantara',
    array['Ayam'],
    array['ayam', 'halal'],
    array[
      'Lumuri ayam dengan air jeruk nipis, diamkan 15 menit untuk menghilangkan bau amis.',
      'Blender atau ulek bawang merah, bawang putih, kemiri, kunyit, dan jahe hingga halus.',
      'Panaskan minyak, tumis bumbu halus bersama daun salam dan serai hingga harum.',
      'Masukkan potongan ayam ke dalam bumbu tumis, aduk hingga ayam berubah warna.',
      'Tambahkan air, garam, dan gula. Masak dengan api kecil hingga ayam empuk dan bumbu meresap.'
    ],
    'Ayam potong, jeruk nipis, bawang merah, bawang putih, kemiri, kunyit, jahe, daun salam, serai, garam, gula',
    4, true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Ayam potong',  1000, 'g',   'meat'),
    (_id, 'Jeruk nipis',     2, 'pcs', 'vegetables'),
    (_id, 'Bawang merah',    8, 'pcs', 'spices'),
    (_id, 'Bawang putih',    5, 'pcs', 'spices'),
    (_id, 'Kemiri',          4, 'pcs', 'spices'),
    (_id, 'Kunyit',          2, 'pcs', 'spices'),
    (_id, 'Jahe',            2, 'pcs', 'spices'),
    (_id, 'Daun salam',      3, 'pcs', 'spices'),
    (_id, 'Serai',           2, 'pcs', 'spices'),
    (_id, 'Minyak goreng',  30, 'ml',  'dry_goods'),
    (_id, 'Garam',        null, null,  'spices'),
    (_id, 'Gula',         null, null,  'dry_goods');
end;
$$;
