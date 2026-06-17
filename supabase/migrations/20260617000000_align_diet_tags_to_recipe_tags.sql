-- =============================================================================
-- Migrasi: selaraskan diet_tags.value (kode mesin) ke recipes.tags
-- -----------------------------------------------------------------------------
-- Masalah: chip filter katalog (& Generate step 2) memakai diet_tags.value, tapi
-- value-nya ("serba-ayam", "tahu-tempe", dst) TIDAK sama dengan tag yang tersimpan
-- di recipes.tags ("ayam", "tahu", "tempe"). Pencocokan filter = exact membership,
-- jadi chip seperti "Serba Ayam" selalu 0 hasil padahal 20 resep ayam jelas ada.
--
-- Solusi: samakan `value` ke recipes.tags. `label` (yang DILIHAT user) dibiarkan —
-- user tetap melihat "Serba Ayam", "Serba Ikan", dst. Hanya kode di belakang layar
-- yang disinkronkan. Tidak ada profiles.diet_prefs tersimpan saat migrasi ini → aman.
--
-- Edge Function generate-plan & regenerate-day juga diubah agar memfilter pakai
-- kolom `tags` (bukan `diet` yang lebih miskin) — kolom `diet` jadi deprecated.
-- Idempoten sebisanya (on conflict do nothing untuk insert).
-- =============================================================================

-- 1) Fokus protein "serba-*" → kata tunggal sesuai recipes.tags.
update public.diet_tags set value = 'ayam'    where value = 'serba-ayam';
update public.diet_tags set value = 'ikan'    where value = 'serba-ikan';
update public.diet_tags set value = 'sapi'    where value = 'serba-sapi';
update public.diet_tags set value = 'kambing' where value = 'serba-kambing';
update public.diet_tags set value = 'telur'   where value = 'serba-telur';

-- 2) "Tahu & Tempe" dipecah jadi 2 chip — di resep tag-nya terpisah (tahu, tempe).
update public.diet_tags set value = 'tahu', label = 'Tahu' where value = 'tahu-tempe';
insert into public.diet_tags (value, label, sort_order, is_active) values
  ('tempe', 'Tempe', 17, true)
on conflict (value) do nothing;

-- 3) Tambah chip untuk tag yang sudah punya resep tapi belum ada chip-nya.
insert into public.diet_tags (value, label, sort_order, is_active) values
  ('daging', 'Aneka Daging', 18, true),
  ('udang',  'Udang',        19, true)
on conflict (value) do nothing;

-- 4) Nonaktifkan chip yang BELUM punya satu pun resep (hindari hasil nol untuk user).
--    Aktifkan lagi (is_active=true) begitu resep dengan tag tsb ditambahkan.
update public.diet_tags set is_active = false
where value in (
  'pedas','berkuah','tumisan','panggang',
  'rendah-karbo','rendah-kalori',
  'nusantara','masakan-jawa','masakan-padang'
);
