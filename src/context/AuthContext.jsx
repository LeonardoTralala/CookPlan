import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { onSessionExpired } from "../lib/session.js";
import { AuthContext } from "./auth-context.js";

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
      setSession(newSession);
    });

    // Penanganan terpusat sesi berakhir: paksa signOut agar session→null,
    // sehingga ProtectedRoute mengarahkan ke /auth (sekali pintu keluar).
    const unsubExpiry = onSessionExpired(() => {
      supabase.auth.signOut().catch(() => {
        // Bila signOut gagal, biarkan — storage lokal akan dibersihkan & UI
        // tetap mengandalkan redirect dari status sesi.
      });
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

  const signInWithGoogle = useCallback(() =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE_URL}/catalog` },
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
