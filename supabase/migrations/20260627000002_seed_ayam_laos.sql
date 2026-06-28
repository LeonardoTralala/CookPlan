-- =============================================================================
-- Seed: Resep Ayam Laos
-- =============================================================================

do $$
declare
  _id integer;
begin
  insert into public.recipes (
    title, description, ready_in_minutes, calories,
    difficulty, cuisine, badges, tags,
    instructions, ingredients_text, base_servings, is_active
  ) values (
    'Ayam Laos',
    'Ayam diungkep dengan bumbu rempah lengkap — bawang, kunyit, kemiri, jahe, dan ketumbar — lalu digoreng hingga kecokelatan. Sisa bumbu ungkep digoreng kering sebagai taburan.',
    60,
    370,
    'medium',
    'nusantara',
    array['Ayam'],
    array['ayam', 'halal'],
    array[
      'Blender atau ulek bawang merah, bawang putih, kunyit, kemiri, jahe, dan ketumbar hingga halus.',
      'Tumis bumbu halus bersama serai, daun salam, dan daun jeruk hingga matang. Masukkan ayam, aduk hingga berubah warna.',
      'Tambahkan air, lalu masak hingga ayam empuk dan air menyusut.',
      'Angkat ayam, lalu goreng dalam minyak panas hingga kuning kecokelatan. Sisihkan.',
      'Saring sisa bumbu ungkep, lalu goreng hingga kering dan berwarna kecokelatan. Taburkan di atas ayam goreng.'
    ],
    'Ayam potong, bawang merah, bawang putih, kunyit, kemiri, jahe, ketumbar, serai, daun salam, daun jeruk, laos (lengkuas)',
    4,
    true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Ayam potong',   1000, 'g',   'meat'),
    (_id, 'Bawang merah',     8, 'pcs', 'spices'),
    (_id, 'Bawang putih',     5, 'pcs', 'spices'),
    (_id, 'Kunyit',           2, 'pcs', 'spices'),
    (_id, 'Kemiri',           4, 'pcs', 'spices'),
    (_id, 'Jahe',             2, 'pcs', 'spices'),
    (_id, 'Ketumbar',         5, 'g',   'spices'),
    (_id, 'Laos (lengkuas)',  2, 'pcs', 'spices'),
    (_id, 'Serai',            2, 'pcs', 'spices'),
    (_id, 'Daun salam',       3, 'pcs', 'spices'),
    (_id, 'Daun jeruk',       4, 'pcs', 'spices'),
    (_id, 'Minyak goreng',   60, 'ml',  'dry_goods'),
    (_id, 'Garam',          null, null, 'spices'),
    (_id, 'Air',            null, null,  null);
end;
$$;
