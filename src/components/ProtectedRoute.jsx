import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

function Loader() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <span className="material-symbols-outlined animate-spin text-3xl text-primary" aria-hidden="true">
        progress_activity
      </span>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}

// Fallback saat sesi tamu gagal dibuat (mis. "Anonymous sign-ins" belum
// diaktifkan di dashboard Supabase). Tanpa ini, halaman cuma memutar loader
// selamanya. Tampilkan pesan + ajakan masuk/daftar, plus opsi coba lagi.
function GuestError({ message, onRetry }) {
  return (
    <div className="max-w-md mx-auto px-5 py-20 text-center">
      <span className="material-symbols-outlined text-5xl text-error mb-4">lock</span>
      <h1 className="font-headline-md text-headline-md text-on-surface mb-2">
        Mode coba tanpa daftar belum aktif
      </h1>
      <p className="text-on-surface-variant text-sm mb-2">
        Tidak bisa membuat sesi tamu sekarang. Silakan masuk atau daftar untuk lanjut.
      </p>
      {message && (
        <p className="text-on-surface-variant/70 text-xs mb-6">Detail: {message}</p>
      )}
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button
          onClick={onRetry}
          className="px-6 py-3 border border-primary text-primary rounded-full font-semibold text-sm hover:bg-primary/5 active:scale-95 transition cursor-pointer"
        >
          Coba lagi
        </button>
        <Link
          to="/auth"
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer"
        >
          Masuk / Daftar
        </Link>
      </div>
    </div>
  );
}

// Route layout yang mengatur akses.
//
// allowAnonymous=false (default): wajib akun penuh. Tamu (sesi anonim) maupun
//   yang belum login diarahkan ke /auth. Lokasi tujuan dibawa lewat state agar
//   setelah login user dikembalikan ke halaman yang tadi dia tuju.
//
// allowAnonymous=true (halaman generate): tamu boleh masuk. Bila belum ada sesi
//   sama sekali, buat sesi anonim diam-diam supaya tamu bisa langsung mencoba
//   generate (limit ditegakkan server-side).
export function ProtectedRoute({ allowAnonymous = false }) {
  const { isAuthenticated, isAnonymous, loading, signInAnonymously } = useAuth();
  const location = useLocation();
  // Cegah pemanggilan ganda signInAnonymously (StrictMode / re-render).
  const anonStarted = useRef(false);
  const [anonError, setAnonError] = useState(null);
  // Dinaikkan saat user menekan "Coba lagi" agar effect dijalankan ulang.
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (allowAnonymous && !loading && !isAuthenticated && !anonStarted.current) {
      anonStarted.current = true;
      signInAnonymously()
        .then(({ error }) => {
          // supabase mengembalikan { data, error } — error TIDAK dilempar,
          // jadi harus diperiksa manual (mis. anonymous sign-ins disabled).
          if (error) {
            console.error("signInAnonymously gagal:", error);
            setAnonError(error.message || "Gagal membuat sesi tamu.");
            anonStarted.current = false;
          }
        })
        .catch((err) => {
          console.error("signInAnonymously error:", err);
          setAnonError(err?.message || "Gagal membuat sesi tamu.");
          anonStarted.current = false;
        });
    }
  }, [allowAnonymous, loading, isAuthenticated, signInAnonymously, retry]);

  if (loading) return <Loader />;

  if (allowAnonymous) {
    if (isAuthenticated) return <Outlet />;
    if (anonError) {
      return (
        <GuestError
          message={anonError}
          onRetry={() => {
            setAnonError(null);
            setRetry((n) => n + 1);
          }}
        />
      );
    }
    // Selagi sesi tamu dibuat, tampilkan loader sampai sesi siap.
    return <Loader />;
  }

  // Halaman butuh akun penuh: tamu pun diarahkan untuk daftar/masuk.
  if (!isAuthenticated || isAnonymous) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
