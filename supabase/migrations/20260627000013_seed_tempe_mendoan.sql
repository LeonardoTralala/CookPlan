-- Seed: Resep Tempe Mendoan
do $$
declare _id integer;
begin
  insert into public.recipes (title, description, ready_in_minutes, calories, difficulty, cuisine, badges, tags, instructions, ingredients_text, base_servings, is_active)
  values (
    'Tempe Mendoan',
    'Tempe iris tipis dicelup adonan tepung berbumbu dengan irisan daun bawang, lalu digoreng sebentar hingga kulitnya renyah tipis dan bagian dalam tetap lembut.',
    20, 210, 'easy', 'nusantara',
    array['Gorengan', 'Tempe'],
    array['halal', 'tempe'],
    array[
      'Iris tipis tempe.',
      'Campur tepung serbaguna, tepung beras, irisan daun bawang, dan air. Aduk hingga adonan tidak terlalu kental atau encer.',
      'Celupkan irisan tempe ke dalam adonan.',
      'Goreng dalam minyak panas sebentar saja (tidak terlalu kering) hingga berwarna kuning keemasan.'
    ],
    'Tempe, tepung serbaguna, tepung beras, daun bawang, garam, minyak goreng',
    4, true
  )
  returning id into _id;

  insert into public.recipe_ingredients (recipe_id, name, amount, unit, category) values
    (_id, 'Tempe',            400, 'g',  'dry_goods'),
    (_id, 'Tepung serbaguna', 150, 'g',  'dry_goods'),
    (_id, 'Tepung beras',      50, 'g',  'dry_goods'),
    (_id, 'Daun bawang',        3, 'pcs','vegetables'),
    (_id, 'Garam',           null, null, 'spices'),
    (_id, 'Minyak goreng',   null, null, 'dry_goods');
end;
$$;
