-- =============================================================================
-- Seed: Resep Bakwan Goreng
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
    'Bakwan Goreng',
    'Gorengan sayuran klasik dari adonan tepung terigu dan beras berbumbu, diisi wortel, kol, tauge, dan daun bawang, lalu digoreng hingga kuning keemasan dan renyah.',
    30,
    250,
    'easy',
    'nusantara',
    array['Gorengan'],
    array['halal', 'telur'],
    array[
      'Haluskan bawang putih, ketumbar, merica, garam, dan kaldu bubuk.',
      'Campur tepung terigu dan tepung beras. Masukkan bumbu halus dan telur. Tuang air es sedikit demi sedikit sambil diaduk hingga adonan licin.',
      'Masukkan wortel, kol, tauge, dan daun bawang ke dalam adonan. Aduk rata.',
      'Panaskan minyak dalam jumlah banyak. Ambil satu sendok sayur adonan, goreng dalam minyak panas hingga kuning keemasan dan renyah.',
      'Angkat dan tiriskan di atas kertas penyerap minyak.'
    ],
    'Tepung terigu, tepung beras, wortel, kol, tauge, telur, daun bawang, bawang putih, ketumbar, merica, garam, kaldu bubuk, air es',
    4,
    true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Tepung terigu',  200, 'g',   'dry_goods'),
    (_id, 'Tepung beras',    50, 'g',   'dry_goods'),
    (_id, 'Wortel',         150, 'g',   'vegetables'),
    (_id, 'Kol',            150, 'g',   'vegetables'),
    (_id, 'Tauge',          100, 'g',   'vegetables'),
    (_id, 'Telur',            2, 'pcs', null),
    (_id, 'Daun bawang',      2, 'pcs', 'vegetables'),
    (_id, 'Bawang putih',     4, 'pcs', 'spices'),
    (_id, 'Ketumbar',         5, 'g',   'spices'),
    (_id, 'Kaldu bubuk',   null, null,  'dry_goods'),
    (_id, 'Garam',         null, null,  'spices'),
    (_id, 'Merica bubuk',  null, null,  'spices'),
    (_id, 'Air es',         200, 'ml',  null),
    (_id, 'Minyak goreng', null, null,  'dry_goods');
end;
$$;
