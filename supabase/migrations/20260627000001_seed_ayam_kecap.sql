-- =============================================================================
-- Seed: Resep Ayam Kecap
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
    'Ayam Kecap',
    'Ayam goreng setengah matang yang dimasak dengan bumbu kecap manis, saus tiram, dan rempah-rempah pilihan hingga kuah menyusut dan bumbu meresap sempurna.',
    45,
    380,
    'medium',
    'nusantara',
    array['Ayam'],
    array['ayam', 'halal'],
    array[
      'Cuci bersih ayam, lalu lumuri dengan garam dan merica. Diamkan sekitar 15 menit.',
      'Goreng ayam dalam minyak panas hingga bagian luarnya kecokelatan (setengah matang), lalu angkat dan tiriskan.',
      'Panaskan sedikit minyak, tumis bawang putih, bawang merah, dan bawang bombay hingga harum dan layu.',
      'Masukkan ayam yang sudah digoreng ke dalam tumisan. Tambahkan kecap manis, saus tiram, kecap asin, gula, garam, dan merica. Aduk rata.',
      'Tuang air secukupnya, kecilkan api, dan masak hingga kuah menyusut dan bumbu meresap ke dalam daging ayam.'
    ],
    'Ayam potong, bawang putih, bawang merah, bawang bombay, kecap manis, saus tiram, kecap asin, gula, garam, merica',
    4,
    true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Ayam potong',  1000, 'g',   'meat'),
    (_id, 'Bawang putih',    5, 'pcs', 'spices'),
    (_id, 'Bawang merah',    8, 'pcs', 'spices'),
    (_id, 'Bawang bombay',   1, 'pcs', 'vegetables'),
    (_id, 'Kecap manis',    60, 'ml',  'dry_goods'),
    (_id, 'Saus tiram',     30, 'ml',  'dry_goods'),
    (_id, 'Kecap asin',     15, 'ml',  'dry_goods'),
    (_id, 'Gula pasir',     15, 'g',   'dry_goods'),
    (_id, 'Garam',        null, null,  'spices'),
    (_id, 'Merica bubuk', null, null,  'spices'),
    (_id, 'Minyak goreng',  60, 'ml',  'dry_goods');
end;
$$;
