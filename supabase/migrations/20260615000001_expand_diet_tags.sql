-- =============================================================================
-- Migrasi: perluas taksonomi diet_tags + nonaktifkan "Hemat Budget"
-- -----------------------------------------------------------------------------
-- Notulen #6: preferensi diet ditambah yang "logikanya pasti" (full ayam, ikan,
-- sapi, dsb), dan "Hemat Budget" dihapus dari pilihan (budget sudah jadi parameter
-- terpisah, jadi diet "hemat" membingungkan).
-- Slug ini juga masuk ke prompt generate-plan → AI menghormatinya saat memilih
-- resep dari bank (mis. "serba-ayam" → AI prioritaskan menu ayam). Filter
-- recipes.diet tetap jalan untuk slug yang sudah di-tag; sisanya fallback all-active.
-- Idempoten (on conflict do nothing).
-- =============================================================================

-- 1) Nonaktifkan "Hemat Budget" (jangan dihapus — bisa dipakai data lama).
update public.diet_tags set is_active = false where value = 'hemat';

-- 2) Tambah preferensi baru: fokus protein + gaya masak + cuisine.
insert into public.diet_tags (value, label, sort_order, is_active) values
  -- Fokus protein utama
  ('serba-ayam',    'Serba Ayam',      10, true),
  ('serba-ikan',    'Serba Ikan',      11, true),
  ('serba-sapi',    'Serba Sapi',      12, true),
  ('serba-kambing', 'Serba Kambing',   13, true),
  ('seafood',       'Seafood',         14, true),
  ('serba-telur',   'Serba Telur',     15, true),
  ('tahu-tempe',    'Tahu & Tempe',    16, true),
  -- Gaya masak / rasa
  ('pedas',         'Pedas',           20, true),
  ('berkuah',       'Berkuah',         21, true),
  ('tumisan',       'Tumisan',         22, true),
  ('panggang',      'Panggang/Bakar',  23, true),
  ('rendah-karbo',  'Rendah Karbo',    24, true),
  ('rendah-kalori', 'Rendah Kalori',   25, true),
  -- Cuisine nusantara
  ('nusantara',     'Nusantara',       30, true),
  ('masakan-jawa',  'Masakan Jawa',    31, true),
  ('masakan-padang','Masakan Padang',  32, true)
on conflict (value) do nothing;
