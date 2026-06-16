-- =============================================================================
-- Migrasi: kolom preferensi diet pada public.profiles
-- -----------------------------------------------------------------------------
-- Menyimpan preferensi diet pengguna sebagai array slug yang cocok dengan
-- diet_tags.value (mis. {'halal','vegetarian'}). Dipakai halaman Profil (panel
-- Preferensi) untuk persistensi, lalu di-prefill oleh wizard generate-plan
-- supaya pengaturan profil benar-benar menyetir hasil AI.
--
-- Tidak ada policy baru: profiles sudah RLS owner-only (profiles_select_own /
-- profiles_update_own dari migrasi sebelumnya) yang otomatis mencakup kolom ini.
-- Default '{}' (array kosong, NOT NULL) supaya UI tak perlu menangani NULL.
-- =============================================================================

alter table public.profiles
  add column if not exists diet_prefs text[] not null default '{}';

comment on column public.profiles.diet_prefs is
  'Preferensi diet pengguna; array slug yang cocok dengan diet_tags.value.';
