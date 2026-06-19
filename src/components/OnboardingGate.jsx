import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { getProfile } from "../services/profileService.js";
import { getCachedPersona, setCachedPersona } from "../utils/personaCache.js";

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

// Gate onboarding "sekali seumur hidup": user PENUH (bukan tamu) yang belum
// mengisi persona ("siapakah kamu") diarahkan ke /onboarding sebelum boleh
// memakai app. Begitu persona terisi (profiles.persona), gate tidak pernah
// muncul lagi. Tamu (anonim) & user belum login dilewati — akses mereka sudah
// diatur ProtectedRoute, dan tamu tak punya profil persisten untuk diisi.
//
// Dipakai sebagai layout route (membungkus <Outlet/>) DI DALAM ProtectedRoute,
// jadi saat render gate akses sudah tervalidasi. Persona di-cache per user agar
// tidak fetch ulang tiap pindah halaman. Bila profil gagal dimuat → fail-open
// (jangan kunci user keluar dari app karena error jaringan sesaat).
export function OnboardingGate() {
  const { user, isFullUser } = useAuth();
  const location = useLocation();
  const userId = user?.id ?? null;

  // Hasil fetch async saat cache miss: { uid, value } | { uid, error } | null.
  // Disimpan bersama uid supaya hasil milik user lama tidak salah dipakai setelah
  // ganti akun. Cache dibaca langsung saat render (di bawah), bukan disalin ke state
  // (hindari setState sinkron di dalam effect).
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    if (!isFullUser) return;
    if (getCachedPersona(userId) !== undefined) return; // cache cukup, tak perlu fetch
    getProfile()
      .then((p) => {
        if (!active) return;
        setCachedPersona(userId, p?.persona ?? "");
        setResult({ uid: userId, value: p?.persona ?? "" });
      })
      .catch(() => { if (active) setResult({ uid: userId, error: true }); });
    return () => { active = false; };
  }, [isFullUser, userId]);

  // Tamu/belum login: serahkan ke route anak (ProtectedRoute sudah validasi).
  if (!isFullUser) return <Outlet />;

  // Persona efektif: cache dulu (sinkron), lalu hasil fetch untuk user ini.
  // undefined = masih memuat.
  let persona;
  let errored = false;
  const cached = getCachedPersona(userId);
  if (cached !== undefined) {
    persona = cached;
  } else if (result && result.uid === userId) {
    if (result.error) errored = true;
    else persona = result.value;
  }

  // Profil gagal dimuat → jangan blokir app (hindari user terkunci di onboarding).
  if (errored) return <Outlet />;
  if (persona === undefined) return <Loader />;
  if (!persona) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
