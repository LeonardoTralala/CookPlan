import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

// Halaman tujuan redirect setelah login OAuth (Google). Rute ini PUBLIK dan
// sengaja TIDAK diproteksi: saat browser kembali dari Google, URL membawa
// "?code=..." yang masih perlu ditukar Supabase (detectSessionInUrl) menjadi
// sesi. Bila kita mendarat langsung di rute terproteksi seperti /catalog,
// ProtectedRoute akan melempar ke /auth dan membuang "?code" sebelum pertukaran
// selesai — sehingga login gagal. Di sini kita cukup menunggu sesi siap, lalu
// arahkan ke aplikasi.
export default function AuthCallback() {
  const { loading, isFullUser } = useAuth();
  // Batas waktu agar tidak memutar loader selamanya bila pertukaran kode gagal
  // (mis. code verifier PKCE hilang). Setelah itu kembalikan ke /auth.
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  // Sesi penuh sudah terbentuk → masuk aplikasi.
  if (!loading && isFullUser) return <Navigate to="/catalog" replace />;

  // Pertukaran kode tak kunjung menghasilkan sesi penuh → balik ke login.
  if (timedOut && !isFullUser) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-white">
      <span className="material-symbols-outlined animate-spin text-3xl text-primary" aria-hidden="true">
        progress_activity
      </span>
      <span className="sr-only">Menyelesaikan proses masuk…</span>
    </div>
  );
}
