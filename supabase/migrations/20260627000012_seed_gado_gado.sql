-- Seed: Resep Gado-Gado
do $$
declare _id integer;
begin
  insert into public.recipes (title, description, ready_in_minutes, calories, difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings, is_active)
  values (
    'Gado-Gado',
    'Salad sayuran rebus khas Indonesia dengan tahu, tempe, dan telur, disiram bumbu kacang gurih yang dipadukan dengan kecap manis dan asam jawa.',
    45, 350, 'medium', 'nusantara',
    array['Vegetarian', 'Kacang'],
    array['halal', 'tahu', 'tempe'],
    array[
      'Rebus semua sayuran (kentang, kol, wortel, kacang panjang, tauge) hingga matang.',
      'Goreng tahu dan tempe hingga matang.',
      'Goreng kacang tanah, lalu haluskan dengan bawang putih, gula merah, dan daun jeruk.',
      'Tambahkan air asam jawa dan kecap manis ke dalam bumbu kacang halus, aduk rata.',
      'Tata sayuran, tahu, tempe, dan telur di piring. Siram dengan bumbu kacang dan taburi bawang goreng.'
    ],
    'Kentang, kol, wortel, kacang panjang, tauge, tahu, tempe, telur, selada, kacang tanah, bawang putih, gula merah, daun jeruk, asam jawa, kecap manis, bawang goreng',
    4, true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Kentang',        200, 'g',   'vegetables'),
    (_id, 'Kol',            150, 'g',   'vegetables'),
    (_id, 'Wortel',         150, 'g',   'vegetables'),
    (_id, 'Kacang panjang', 100, 'g',   'vegetables'),
    (_id, 'Tauge',          100, 'g',   'vegetables'),
    (_id, 'Tahu coklat',    200, 'g',   'dry_goods'),
    (_id, 'Tempe',          200, 'g',   'dry_goods'),
    (_id, 'Telur',            4, 'pcs', null),
    (_id, 'Selada',         100, 'g',   'vegetables'),
    (_id, 'Kacang tanah',   200, 'g',   'dry_goods'),
    (_id, 'Bawang putih',     3, 'pcs', 'spices'),
    (_id, 'Gula merah',      20, 'g',   'dry_goods'),
    (_id, 'Daun jeruk',       2, 'pcs', 'spices'),
    (_id, 'Asam jawa',       10, 'g',   'spices'),
    (_id, 'Kecap manis',     30, 'ml',  'dry_goods'),
    (_id, 'Bawang goreng', null, null,  'dry_goods'),
    (_id, 'Minyak goreng',   60, 'ml',  'dry_goods');
end;
$$;
