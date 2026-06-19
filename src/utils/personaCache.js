// Cache ringan status persona per user untuk OnboardingGate, supaya gate tidak
// perlu fetch profil tiap kali pindah halaman (hindari flicker / redirect loop).
// BUKAN sumber kebenaran — hanya optimasi; sumber kebenaran tetap
// profiles.persona via getProfile(). Di-set setelah fetch pertama, lalu diperbarui
// oleh halaman Onboarding & Edit Profil agar konsisten dalam satu sesi.

let _userId = null;
let _value; // undefined = belum dimuat; "" = belum diisi; slug = sudah diisi

// Nilai persona ter-cache untuk user ini, atau undefined bila belum dimuat /
// milik user lain (mis. setelah ganti akun) sehingga pemanggil tahu harus fetch.
export function getCachedPersona(userId) {
  if (userId && userId === _userId) return _value;
  return undefined;
}

export function setCachedPersona(userId, value) {
  _userId = userId ?? null;
  _value = value ?? "";
}
