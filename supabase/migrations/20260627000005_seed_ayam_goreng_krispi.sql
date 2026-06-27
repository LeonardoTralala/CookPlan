-- =============================================================================
-- Seed: Resep Ayam Goreng Krispi
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
    'Ayam Goreng Krispi',
    'Ayam potong dicelup susu cair lalu dibalut tepung serbaguna berbumbu paprika hingga merata, digoreng dalam minyak panas bertahap hingga renyah dan kecokelatan.',
    50,
    430,
    'easy',
    'nusantara',
    array['Ayam', 'Krispi'],
    array['ayam', 'halal'],
    array[
      'Campurkan tepung serbaguna, bubuk paprika, garam, dan merica dalam kantong plastik, kocok hingga rata.',
      'Celupkan potongan ayam ke dalam susu cair, lalu masukkan ke dalam kantong plastik berisi tepung. Kocok hingga ayam terlapisi tepung rata.',
      'Keluarkan ayam dan biarkan sejenak sebelum digoreng.',
      'Goreng dalam minyak yang sangat panas. Setelah kecokelatan, kecilkan api, tutup wajan, dan masak sekitar 30 menit. Buka tutup, besarkan api, dan goreng hingga renyah.'
    ],
    'Ayam potong, tepung serbaguna, bubuk paprika, susu cair, garam, merica',
    4,
    true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Ayam potong',      1000, 'g',  'meat'),
    (_id, 'Tepung serbaguna',  200, 'g',  'dry_goods'),
    (_id, 'Susu cair',         200, 'ml', 'dairy'),
    (_id, 'Bubuk paprika',       5, 'g',  'spices'),
    (_id, 'Garam',            null, null, 'spices'),
    (_id, 'Merica bubuk',     null, null, 'spices'),
    (_id, 'Minyak goreng',    null, null, 'dry_goods');
end;
$$;
