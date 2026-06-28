-- Seed: Resep Sambal Goreng Ati Ampela
do $$
declare _id integer;
begin
  insert into public.recipes (title, description, ready_in_minutes, calories, difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings, is_active)
  values (
    'Sambal Goreng Ati Ampela',
    'Ati dan ampela ayam direbus hingga empuk, lalu dimasak bersama kentang goreng dalam bumbu sambal harum berbumbu cabai, kemiri, dan rempah-rempah.',
    60, 310, 'medium', 'nusantara',
    array['Ayam'],
    array['ayam', 'halal'],
    array[
      'Rebus ati ampela dengan daun salam hingga matang dan empuk.',
      'Kupas dan potong dadu kentang, lalu goreng hingga matang.',
      'Potong-potong ati ampela, lalu goreng sebentar. Sisihkan.',
      'Haluskan bumbu (bawang, cabai, kemiri, jahe) lalu tumis dengan daun salam, daun jeruk, serai, dan lengkuas hingga harum.',
      'Masukkan kentang dan ati ampela, tambahkan garam, gula, dan sedikit air. Masak hingga bumbu meresap.'
    ],
    'Ati ampela, kentang, bawang merah, bawang putih, cabai merah, kemiri, jahe, daun salam, daun jeruk, serai, lengkuas, garam, gula',
    4, true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Ati ampela',    300, 'g',   'meat'),
    (_id, 'Kentang',       300, 'g',   'vegetables'),
    (_id, 'Bawang merah',    6, 'pcs', 'spices'),
    (_id, 'Bawang putih',    4, 'pcs', 'spices'),
    (_id, 'Cabai merah',     5, 'pcs', 'spices'),
    (_id, 'Kemiri',          3, 'pcs', 'spices'),
    (_id, 'Jahe',            1, 'pcs', 'spices'),
    (_id, 'Daun salam',      3, 'pcs', 'spices'),
    (_id, 'Daun jeruk',      3, 'pcs', 'spices'),
    (_id, 'Serai',           1, 'pcs', 'spices'),
    (_id, 'Lengkuas',        1, 'pcs', 'spices'),
    (_id, 'Garam',        null, null,  'spices'),
    (_id, 'Gula',         null, null,  'dry_goods'),
    (_id, 'Minyak goreng',  60, 'ml',  'dry_goods');
end;
$$;
