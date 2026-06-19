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

// Apakah error ini menandakan masalah AUTENTIKASI/SESI (sesi habis) — sehingga
// pantas memicu logout — dan BUKAN sekadar penolakan OTORISASI/kuota?
//
// Penting: status 403 SENGAJA tidak lagi dianggap auth secara membabi buta.
// PostgREST memakai 403 untuk pelanggaran RLS, dan Edge Function bisa memakai
// 403/pesan tertentu untuk "akses ditolak" atau kuota harian habis. Dulu semua
// itu salah dianggap "sesi berakhir" → user ke-logout padahal sesinya sehat.
// Sekarang hanya 401 (belum terautentikasi) atau pesan yang jelas-jelas soal
// sesi/token yang dianggap auth error.
export function isAuthError(err) {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();

  // 1) Pengecualian eksplisit: ini OTORISASI/kuota, bukan sesi habis → jangan
  //    pernah logout meskipun statusnya 403.
  const NON_AUTH = [
    "row-level security",
    "permission denied",
    "insufficient_privilege",
    "forbidden",
    "quota",
    "rate limit",
    "rate-limit",
    "too many",
    "batas harian",
    "limit harian",
    "limit tercapai",
    "kuota",
  ];
  if (NON_AUTH.some((s) => msg.includes(s))) return false;

  // 2) Sinyal sesi/token dari pesan error (paling andal lintas status).
  const AUTH_MSG = [
    "belum login",
    "jwt",
    "unauthorized",
    "not authenticated",
    "auth session missing",
    "invalid token",
    "token expired",
    "refresh token",
  ];
  if (AUTH_MSG.some((s) => msg.includes(s))) return true;
  if (msg.includes("session") && msg.includes("expired")) return true;

  // 3) Status 401 = belum terautentikasi → sesi bermasalah. 403 TIDAK dipakai
  //    di sini karena ambigu (lihat catatan di atas); kalau memang soal sesi,
  //    biasanya sudah tertangkap oleh sinyal pesan di langkah 2.
  const status = err.status ?? err.statusCode ?? err.code;
  if (status === 401) return true;

  return false;
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
