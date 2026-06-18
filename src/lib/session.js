// Penanganan TERPUSAT untuk sesi yang berakhir di tengah pemakaian.
//
// Saat token kedaluwarsa, panggilan API (Edge Function / query DB) bisa menolak
// dengan error auth (401/403, "JWT expired", atau service kita melempar
// "Belum login."). Tanpa penanganan terpusat, tiap halaman cuma menampilkan
// error generik dan user terjebak di layar yang "selalu gagal".
//
// Pola: deteksi error auth di satu tempat → picu `notifySessionExpired()` →
// AuthContext melakukan signOut → ProtectedRoute otomatis mengarahkan ke /auth,
// dan AuthPage menampilkan pesan "sesi berakhir" (lewat flag di bawah).

const EVENT = "cookplan:session-expired";

// Flag dibaca AuthPage untuk menampilkan banner "sesi berakhir" setelah redirect.
export const SESSION_EXPIRED_FLAG = "cookplan:sessionExpired";

// Apakah error ini menandakan masalah auth/sesi (bukan error biasa)?
export function isAuthError(err) {
  if (!err) return false;
  const status = err.status ?? err.statusCode ?? err.code;
  if (status === 401 || status === 403) return true;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes("belum login") ||
    msg.includes("jwt") ||
    msg.includes("unauthorized") ||
    msg.includes("not authenticated") ||
    msg.includes("auth session missing") ||
    msg.includes("invalid token") ||
    (msg.includes("session") && msg.includes("expired"))
  );
}

// Umumkan bahwa sesi berakhir. Idempoten secara praktis: flag + event sekali picu.
export function notifySessionExpired() {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_FLAG, "1");
  } catch {
    // sessionStorage bisa tidak tersedia (private mode); abaikan, redirect tetap jalan.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

// Langganan event sesi-berakhir (dipakai AuthContext). Return fungsi unsubscribe.
export function onSessionExpired(handler) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

// Helper untuk service layer: bila `err` adalah error auth, picu alur sesi-berakhir.
// Tidak menelan error — pemanggil tetap dapat menutup loading/state-nya sendiri.
export function reportIfAuthError(err) {
  if (isAuthError(err)) notifySessionExpired();
}
