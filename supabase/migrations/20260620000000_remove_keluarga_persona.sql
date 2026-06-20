-- =============================================================================
-- Migrasi: hapus opsi persona 'keluarga' dari profiles.persona
-- -----------------------------------------------------------------------------
-- Persona ("siapakah kamu?") disederhanakan menjadi: mahasiswa, pekerja,
-- ibu_rumah_tangga, lainnya. Opsi 'keluarga' (Berkeluarga) dihilangkan karena
-- tumpang tindih dengan ibu_rumah_tangga; tidak ada opsi baru ditambahkan.
--
-- Slug WAJIB selaras dengan VALID_PERSONA di
-- supabase/functions/_shared/validate.ts, PERSONA_HINT_ID di
-- supabase/functions/_shared/prompt.ts, dan PERSONA_OPTIONS di
-- src/utils/persona.js.
--
-- Remap baris lama yang memakai 'keluarga' → 'lainnya' supaya tidak melanggar
-- CHECK baru (saat migrasi ini ditulis tidak ada baris 'keluarga' di produksi,
-- tapi remap dijaga agar idempoten & aman di env lain).
-- =============================================================================

update public.profiles set persona = 'lainnya' where persona = 'keluarga';

alter table public.profiles
  drop constraint if exists profiles_persona_check;

alter table public.profiles
  add constraint profiles_persona_check
    check (persona in ('mahasiswa', 'pekerja', 'ibu_rumah_tangga', 'lainnya'));

comment on column public.profiles.persona is
  'Persona/identitas pengguna ("siapakah kamu"): mahasiswa | pekerja | ibu_rumah_tangga | lainnya. Di-prefill ke wizard generate-plan & diteruskan ke AI.';
