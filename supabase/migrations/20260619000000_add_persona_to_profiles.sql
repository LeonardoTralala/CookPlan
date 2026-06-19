-- =============================================================================
-- Migrasi: kolom persona ("siapakah kamu?") pada public.profiles
-- -----------------------------------------------------------------------------
-- Menyimpan identitas pengguna sebagai satu slug stabil (mahasiswa, pekerja,
-- ibu_rumah_tangga, keluarga, lainnya). Dipakai halaman Profil (modal Edit
-- Profil) untuk persistensi, lalu di-prefill oleh wizard generate-plan dan
-- diteruskan ke AI supaya menu lebih relevan dengan situasi pengguna
-- (mahasiswa → hemat & cepat; ibu rumah tangga → porsi keluarga, dst).
--
-- Tidak ada policy baru: profiles sudah RLS owner-only (profiles_select_own /
-- profiles_update_own) yang otomatis mencakup kolom ini. NULL = belum diisi.
-- CHECK membatasi nilai ke himpunan dikenal (NULL lolos check → "belum diisi").
-- Slug WAJIB selaras dengan VALID_PERSONA di
-- supabase/functions/_shared/validate.ts dan PERSONA_OPTIONS di
-- src/utils/persona.js.
-- =============================================================================

alter table public.profiles
  add column if not exists persona text
    check (persona in ('mahasiswa', 'pekerja', 'ibu_rumah_tangga', 'keluarga', 'lainnya'));

comment on column public.profiles.persona is
  'Persona/identitas pengguna ("siapakah kamu"): mahasiswa | pekerja | ibu_rumah_tangga | keluarga | lainnya. Di-prefill ke wizard generate-plan & diteruskan ke AI.';
