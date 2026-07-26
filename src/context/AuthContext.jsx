import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { onSessionExpired } from "../lib/session.js";
import { AuthContext } from "./auth-context.js";
import { identifyUser, resetUser } from "../lib/posthog.js";

// URL tujuan redirect untuk OAuth & email (konfirmasi / reset password).
const SITE_URL = window.location.origin;

// Deteksi apakah halaman dibuka dari tautan reset password (alur recovery).
// Flow implicit Supabase menaruh "type=recovery" di hash URL.
function detectRecoveryFromUrl() {
  if (typeof window === "undefined") return false;
  return (
    (window.location.hash || "").includes("type=recovery") ||
    (window.location.search || "").includes("type=recovery")
  );
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // Lazy initializer membaca URL sebelum Supabase membersihkannya.
  const [isRecovery, setIsRecovery] = useState(detectRecoveryFromUrl);

  useEffect(() => {
    let active = true;

    // Pulihkan sesi yang tersimpan saat aplikasi pertama dimuat.
    supabase.auth.getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session ?? null);
          if (data.session?.user) {
            identifyUser(data.session.user.id, {
              email: data.session.user.email,
              is_anonymous: data.session.user.is_anonymous,
            });
          }
          setLoading(false);
        }
      })
      .catch(() => {
        // Jangan biarkan loading menggantung selamanya bila getSession gagal.
        if (active) setLoading(false);
      });

    // Pantau perubahan sesi (login, logout, refresh token, OAuth redirect).
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      if (newSession?.user) {
        identifyUser(newSession.user.id, {
          email: newSession.user.email,
          is_anonymous: newSession.user.is_anonymous,
        });
      } else if (event === "SIGNED_OUT" || !newSession) {
        resetUser();
      }
      setSession(newSession);
    });

    // Penanganan terpusat sesi berakhir. Saat app dibuka kembali, access token
    // (JWT) sering kedaluwarsa sesaat sementara refresh token masih valid;
    // Supabase otomatis me-refresh di latar belakang (autoRefreshToken: true).
    //
    // PENTING: JANGAN langsung panggil refreshSession() di sini — itu BALAPAN
    // dengan auto-refresh internal Supabase. Dua refresh memakai refresh token
    // yang sama → salah satunya dapat "refresh token already used" → user
    // ke-logout padahal sesinya sehat (bug login yang intermittent). Selain itu
    // banyak panggilan service yang gagal bersamaan bisa memicu handler ini
    // berkali-kali sekaligus. Maka alurnya dibuat aman:
    //   1) serialisasi (flag `recovering`) agar hanya satu pemulihan berjalan,
    //   2) cek getSession() dulu — kalau auto-refresh sudah memperbarui sesi
    //      (token belum kedaluwarsa), user tetap login, tidak jadi logout,
    //   3) baru bila token benar-benar mati, coba refresh SEKALI; gagal → signOut
    //      (session→null → ProtectedRoute arahkan ke /auth).
    let recovering = false;
    const unsubExpiry = onSessionExpired(async () => {
      if (recovering) return;
      recovering = true;
      try {
        const { data: { session: current } } = await supabase.auth.getSession();
        // Anggap sesi sehat bila access token masih > 5 detik dari kedaluwarsa
        // (buffer kecil agar tidak menyimpan token yang sebentar lagi basi).
        const stillValid =
          current?.expires_at && current.expires_at * 1000 > Date.now() + 5000;
        if (stillValid) {
          if (active) setSession(current);
          return;
        }
        // Tidak ada sesi / token sudah kedaluwarsa → coba refresh sekali.
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data?.session) {
          if (active) setSession(data.session);
          return;
        }
        // Refresh gagal (refresh token mati/dicabut) → baru paksa logout.
        await supabase.auth.signOut();
      } catch {
        // Bila pemulihan gagal tak terduga, paksa logout agar UI konsisten.
        await supabase.auth.signOut().catch(() => {});
      } finally {
        recovering = false;
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      unsubExpiry();
    };
  }, []);

  // Daftar akun baru. Nama disimpan ke user metadata (dipakai mengisi profiles).
  const signUp = useCallback(({ name, email, password }) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: name, full_name: name },
        emailRedirectTo: `${SITE_URL}/auth`,
      },
    }),
  []);

  const signIn = useCallback(({ email, password }) =>
    supabase.auth.signInWithPassword({ email, password }),
  []);

  // Sesi tamu (anonymous) untuk mencoba fitur generate tanpa daftar. Membuat
  // user asli di auth.users (is_anonymous=true) sehingga Edge Function & RLS
  // jalan apa adanya; limit percobaan ditegakkan server-side.
  const signInAnonymously = useCallback(() => supabase.auth.signInAnonymously(), []);

  // Mendarat di /auth/callback (rute publik) — bukan langsung ke rute
  // terproteksi — agar Supabase sempat menukar "?code" jadi sesi sebelum
  // diarahkan ke aplikasi. Lihat src/pages/AuthCallback.jsx.
  const signInWithGoogle = useCallback(() =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    }),
  []);

  const resetPassword = useCallback((email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth` }),
  []);

  // Set kata sandi baru saat user kembali dari tautan reset (sesi recovery aktif).
  const updatePassword = useCallback((password) =>
    supabase.auth.updateUser({ password }),
  []);

  const clearRecovery = useCallback(() => setIsRecovery(false), []);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  // Kirim ulang email konfirmasi pendaftaran (untuk akun yang belum verifikasi).
  const resendVerification = useCallback((email) =>
    supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${SITE_URL}/auth` },
    }),
  []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    // Tamu = sesi anonim. isFullUser = sudah punya akun nyata (bukan tamu).
    isAnonymous: Boolean(session?.user?.is_anonymous),
    isFullUser: Boolean(session) && !session?.user?.is_anonymous,
    loading,
    isRecovery,
    signUp,
    signIn,
    signInAnonymously,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    clearRecovery,
    signOut,
    resendVerification,
  }), [session, loading, isRecovery, signUp, signIn, signInAnonymously, signInWithGoogle, resetPassword, updatePassword, clearRecovery, signOut, resendVerification]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
