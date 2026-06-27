-- =============================================================================
-- Seed: Resep Soto Ayam
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
    'Soto Ayam',
    'Sup ayam berkuah bening khas nusantara dengan bumbu rempah kunyit dan kemiri. Disajikan dengan soun, tauge, telur rebus, suwiran ayam, bawang goreng, dan seledri.',
    60,
    300,
    'medium',
    'nusantara',
    array['Ayam', 'Berkuah'],
    array['ayam', 'halal', 'berkuah'],
    array[
      'Rebus ayam dalam air hingga setengah matang. Angkat ayam, sisihkan kaldunya.',
      'Haluskan bumbu (bawang merah, bawang putih, kemiri, kunyit, jahe), lalu tumis bersama serai, daun jeruk, daun salam, dan lengkuas hingga harum.',
      'Masukkan bumbu tumis ke dalam kaldu ayam, lalu rebus ayam kembali hingga matang. Bumbui dengan garam dan merica.',
      'Angkat ayam, biarkan dingin, lalu suwir-suwir dagingnya.',
      'Tata soun, tauge, telur rebus, dan suwiran ayam di mangkuk. Siram dengan kuah panas, taburi bawang goreng dan seledri.'
    ],
    'Ayam potong, bawang merah, bawang putih, kemiri, kunyit, jahe, serai, daun jeruk, daun salam, lengkuas, soun, tauge, telur rebus, bawang goreng, seledri',
    4,
    true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Ayam potong',   1000, 'g',   'meat'),
    (_id, 'Bawang merah',     8, 'pcs', 'spices'),
    (_id, 'Bawang putih',     5, 'pcs', 'spices'),
    (_id, 'Kemiri',           4, 'pcs', 'spices'),
    (_id, 'Kunyit',           2, 'pcs', 'spices'),
    (_id, 'Jahe',             2, 'pcs', 'spices'),
    (_id, 'Serai',            2, 'pcs', 'spices'),
    (_id, 'Daun jeruk',       4, 'pcs', 'spices'),
    (_id, 'Daun salam',       3, 'pcs', 'spices'),
    (_id, 'Lengkuas',         2, 'pcs', 'spices'),
    (_id, 'Soun',           100, 'g',   'dry_goods'),
    (_id, 'Tauge',          100, 'g',   'vegetables'),
    (_id, 'Telur rebus',      4, 'pcs', null),
    (_id, 'Bawang goreng', null, null,  'dry_goods'),
    (_id, 'Seledri',       null, null,  'vegetables'),
    (_id, 'Garam',         null, null,  'spices'),
    (_id, 'Merica bubuk',  null, null,  'spices');
end;
$$;
