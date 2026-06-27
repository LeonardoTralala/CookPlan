-- Seed: Resep Opor Ayam
do $$
declare _id integer;
begin
  insert into public.recipes (title, description, ready_in_minutes, calories, difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings, is_active)
  values (
    'Opor Ayam',
    'Ayam dimasak dalam kuah santan kuning berbumbu kemiri, kunyit, dan ketumbar. Dibuat dua tahap santan — encer untuk mengungkep, kental untuk mematangkan kuah.',
    75, 400, 'medium', 'nusantara',
    array['Ayam', 'Berkuah'],
    array['ayam', 'halal', 'berkuah'],
    array[
      'Panaskan minyak, tumis bumbu halus (bawang, kemiri, kunyit, ketumbar, merica) bersama daun salam, lengkuas, jahe, dan serai hingga harum.',
      'Tambahkan potongan ayam, aduk hingga berubah warna.',
      'Tuangkan santan encer, bumbui dengan garam, merica, dan gula merah.',
      'Masak hingga santan sedikit meresap ke dalam ayam.',
      'Masukkan santan kental. Masak sambil diaduk perlahan hingga kuah mengental dan matang.'
    ],
    'Ayam potong, santan encer, santan kental, bawang merah, bawang putih, kemiri, kunyit, ketumbar, merica, daun salam, lengkuas, jahe, serai, garam, gula merah',
    4, true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Ayam potong',   1000, 'g',   'meat'),
    (_id, 'Santan encer',   400, 'ml',  'dairy'),
    (_id, 'Santan kental',  200, 'ml',  'dairy'),
    (_id, 'Bawang merah',     8, 'pcs', 'spices'),
    (_id, 'Bawang putih',     5, 'pcs', 'spices'),
    (_id, 'Kemiri',           4, 'pcs', 'spices'),
    (_id, 'Kunyit',           2, 'pcs', 'spices'),
    (_id, 'Ketumbar',         5, 'g',   'spices'),
    (_id, 'Daun salam',       3, 'pcs', 'spices'),
    (_id, 'Lengkuas',         2, 'pcs', 'spices'),
    (_id, 'Jahe',             2, 'pcs', 'spices'),
    (_id, 'Serai',            2, 'pcs', 'spices'),
    (_id, 'Gula merah',      10, 'g',   'dry_goods'),
    (_id, 'Garam',         null, null,  'spices'),
    (_id, 'Merica bubuk',  null, null,  'spices'),
    (_id, 'Minyak goreng',   30, 'ml',  'dry_goods');
end;
$$;
