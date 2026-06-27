-- =============================================================================
-- Seed: Resep Rawon
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
    'Rawon',
    'Sup daging sapi berkuah hitam pekat khas Jawa Timur dengan cita rasa kluwek yang khas. Daging dimasak perlahan dalam kaldu berbumbu hingga empuk dan bumbu meresap sempurna.',
    90,
    350,
    'hard',
    'nusantara',
    array['Sapi', 'Berkuah'],
    array['sapi', 'halal', 'berkuah'],
    array[
      'Pecahkan kluwek, ambil isinya, dan rendam dalam air hangat selama 15-20 menit.',
      'Rebus daging sapi hingga setengah matang. Sisihkan kaldunya.',
      'Haluskan bumbu (bawang merah, bawang putih, kunyit, kemiri, ketumbar) termasuk kluwek yang sudah direndam. Tumis bumbu halus dalam minyak panas hingga harum.',
      'Masukkan daging, asam jawa, serai, lengkuas, daun bawang, dan daun jeruk ke dalam tumisan. Tuang kaldu sedikit demi sedikit sambil diaduk, masak hingga bumbu meresap dan daging empuk.'
    ],
    'Daging sapi, kluwek, bawang merah, bawang putih, kunyit, kemiri, ketumbar, asam jawa, serai, lengkuas, daun bawang, daun jeruk',
    4,
    true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Daging sapi',  500, 'g',   'meat'),
    (_id, 'Kluwek',         4, 'pcs', 'spices'),
    (_id, 'Bawang merah',   8, 'pcs', 'spices'),
    (_id, 'Bawang putih',   5, 'pcs', 'spices'),
    (_id, 'Kunyit',         2, 'pcs', 'spices'),
    (_id, 'Kemiri',         4, 'pcs', 'spices'),
    (_id, 'Ketumbar',       5, 'g',   'spices'),
    (_id, 'Asam jawa',     10, 'g',   'spices'),
    (_id, 'Serai',          2, 'pcs', 'spices'),
    (_id, 'Lengkuas',       2, 'pcs', 'spices'),
    (_id, 'Daun bawang',    2, 'pcs', 'vegetables'),
    (_id, 'Daun jeruk',     4, 'pcs', 'spices'),
    (_id, 'Minyak goreng', 30, 'ml',  'dry_goods'),
    (_id, 'Garam',        null, null, 'spices');
end;
$$;
