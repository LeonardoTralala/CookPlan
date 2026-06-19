// Persona pengguna ("siapakah kamu?"). Atribut identitas yang disimpan di profil
// (profiles.persona) DAN diteruskan ke AI generate-plan supaya menu lebih relevan
// dengan situasi pengguna (mahasiswa → hemat & cepat; ibu rumah tangga → porsi
// keluarga, dst).
//
// `value` = slug stabil yang disimpan di DB & divalidasi server. WAJIB selaras
// dengan:
//   - CHECK constraint di migrasi 20260619000000_add_persona_to_profiles.sql
//   - VALID_PERSONA di supabase/functions/_shared/validate.ts
//   - PERSONA_HINT_ID di supabase/functions/_shared/prompt.ts
export const PERSONA_OPTIONS = [
  { value: 'mahasiswa', label: 'Mahasiswa / Anak Kos', icon: 'school' },
  { value: 'pekerja', label: 'Pekerja Kantoran', icon: 'work' },
  { value: 'ibu_rumah_tangga', label: 'Ibu Rumah Tangga', icon: 'home' },
  { value: 'keluarga', label: 'Berkeluarga', icon: 'family_restroom' },
  { value: 'lainnya', label: 'Lainnya', icon: 'person' },
];

// Label tampilan untuk sebuah slug persona; "" bila tidak dikenal / belum diisi.
export function personaLabel(value) {
  return PERSONA_OPTIONS.find((p) => p.value === value)?.label ?? '';
}
