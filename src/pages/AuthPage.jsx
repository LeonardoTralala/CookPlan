import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Logo } from "../components/Logo.jsx";
import { Toast } from "../components/Toast.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { usePlan } from "../hooks/usePlan.js";
import { SESSION_EXPIRED_FLAG } from "../lib/session.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Terjemahkan pesan error Supabase ke bahasa yang ramah pengguna.
function friendlyError(error) {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (msg.includes("email not confirmed")) return "Email belum dikonfirmasi. Cek kotak masuk kamu dulu.";
  if (msg.includes("already registered") || msg.includes("already been registered")) return "Email sudah terdaftar. Silakan masuk.";
  if (msg.includes("password should be at least")) return "Kata sandi minimal 6 karakter.";
  if (msg.includes("rate limit") || msg.includes("too many")) return "Terlalu banyak percobaan. Coba lagi sebentar lagi.";
  if (msg.includes("provider is not enabled")) return "Login Google belum diaktifkan di server. Hubungi admin.";
  return error?.message || "Terjadi kesalahan. Coba lagi.";
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isFullUser, loading: authLoading, isRecovery, signUp, signIn, signInWithGoogle, resetPassword, updatePassword, clearRecovery } = useAuth();
  const { showToast } = usePlan();

  // Halaman yang tadi dituju sebelum diarahkan ke login (dari ProtectedRoute).
  const redirectTo = location.state?.from || "/catalog";

  const [mode, setMode] = useState(isRecovery ? "update" : "login"); // 'login' | 'register' | 'forgot' | 'update'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Datang ke sini karena sesi berakhir di tengah pemakaian? Nilai awal notice
  // dibaca dari flag (read murni di initializer; flag dihapus di effect bawah).
  const [notice, setNotice] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_EXPIRED_FLAG)
        ? "Sesi kamu sudah berakhir. Silakan masuk lagi untuk melanjutkan."
        : "";
    } catch {
      return "";
    }
  });

  // Bila sesi recovery baru terdeteksi setelah mount (event PASSWORD_RECOVERY),
  // pindah ke form set kata sandi baru. Pola adjust-state-during-render agar
  // tidak memanggil setState di dalam useEffect.
  const [recoverySynced, setRecoverySynced] = useState(isRecovery);
  if (isRecovery && !recoverySynced) {
    setRecoverySynced(true);
    setMode("update");
  }

  // Sudah punya AKUN PENUH? Langsung arahkan ke aplikasi — kecuali sedang alur
  // recovery. Tamu (sesi anonim) sengaja TIDAK diarahkan: mereka datang ke sini
  // justru untuk daftar/masuk, jadi membiarkan halaman ini tampil (kalau tidak,
  // /generate ↔ /auth saling lempar dan layar berkedip).
  useEffect(() => {
    if (!authLoading && isFullUser && !isRecovery) navigate(redirectTo, { replace: true });
  }, [authLoading, isFullUser, isRecovery, navigate, redirectTo]);

  // Konsumsi flag sesi-berakhir sekali (pesan sudah dibaca ke notice di atas).
  useEffect(() => {
    try {
      sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
    } catch {
      // sessionStorage bisa tidak tersedia (private mode); abaikan.
    }
  }, []);

  function switchMode(next) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirm("");
    setShowPassword(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    // Set kata sandi baru (alur recovery) — tidak butuh email.
    if (mode === "update") {
      if (password.length < 6) return setError("Kata sandi minimal 6 karakter.");
      if (password !== confirm) return setError("Konfirmasi kata sandi tidak cocok.");
      setLoading(true);
      const { error: err } = await updatePassword(password);
      setLoading(false);
      if (err) return setError(friendlyError(err));
      clearRecovery();
      showToast("Kata sandi berhasil diperbarui!");
      navigate(redirectTo);
      return;
    }

    if (!EMAIL_RE.test(email)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }

    if (mode === "forgot") {
      setLoading(true);
      const { error: err } = await resetPassword(email);
      setLoading(false);
      if (err) return setError(friendlyError(err));
      setNotice("Tautan reset kata sandi sudah dikirim. Cek email kamu.");
      return;
    }

    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter.");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) return setError("Nama tidak boleh kosong.");
      if (password !== confirm) return setError("Konfirmasi kata sandi tidak cocok.");

      setLoading(true);
      const { data, error: err } = await signUp({ name: name.trim(), email, password });
      setLoading(false);
      if (err) return setError(friendlyError(err));

      // Bila konfirmasi email diaktifkan, belum ada sesi → minta cek email.
      if (!data.session) {
        setNotice("Akun dibuat! Cek email kamu untuk konfirmasi sebelum masuk.");
        switchMode("login");
        return;
      }
      showToast("Akun berhasil dibuat 🎉");
      navigate(redirectTo);
      return;
    }

    // mode === 'login'
    setLoading(true);
    const { error: err } = await signIn({ email, password });
    setLoading(false);
    if (err) return setError(friendlyError(err));
    showToast("Berhasil masuk!");
    navigate("/catalog");
  }

  async function handleGoogle() {
    setError("");
    const { error: err } = await signInWithGoogle();
    if (err) setError(friendlyError(err));
    // Sukses → browser akan redirect ke Google lalu kembali ke aplikasi.
  }

  const isForgot = mode === "forgot";
  const isRegister = mode === "register";
  const isUpdate = mode === "update";

  const heading = isUpdate
    ? "Atur kata sandi baru"
    : isForgot
      ? "Reset kata sandi"
      : isRegister
        ? "Buat akun CookPlan"
        : "Selamat datang kembali 👋";
  const subheading = isUpdate
    ? "Masukkan kata sandi baru untuk akunmu."
    : isForgot
      ? "Masukkan email akunmu, kami kirimkan tautan untuk mengatur ulang kata sandi."
      : isRegister
        ? "Gratis dan hanya butuh satu menit."
        : "Masuk untuk lanjut merencanakan masakanmu.";

  const inputWrap = "relative";
  const iconClass = "material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none";
  const inputClass = "w-full rounded-2xl bg-surface-container-low pl-12 pr-4 py-3.5 text-body-md text-on-surface placeholder:text-on-surface-variant/60 border border-transparent focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";

  return (
    <div className="min-h-screen flex bg-canvas-white font-sans text-on-surface antialiased">
      {/* Panel brand — desktop saja */}
      <aside className="relative hidden lg:flex lg:w-[44%] flex-col justify-between overflow-hidden bg-primary p-12 text-on-primary">
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-on-primary/10" aria-hidden="true" />
        <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-on-primary/5" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white">
            <Logo className="h-7 w-auto" />
          </div>
          <span className="text-xl font-bold">CookPlan</span>
        </div>

        <div className="relative">
          <h2 className="font-headline-lg text-headline-lg leading-tight">
            Rencanakan masakan,<br />hemat budget.
          </h2>
          <p className="mt-4 max-w-sm text-body-md text-on-primary-container/90">
            Susun menu mingguan, buat daftar belanja otomatis, dan masak makanan sehat dengan bahan lokal.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              ["calendar_month", "Rencana masak mingguan"],
              ["shopping_cart", "Daftar belanja otomatis"],
              ["savings", "Estimasi biaya transparan"],
            ].map(([icon, label]) => (
              <li key={icon} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-on-primary/15">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
                </span>
                <span className="text-body-md font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-label-sm text-on-primary-container/70">© 2026 CookPlan</p>
      </aside>

      {/* Area form */}
      <main className="flex flex-1 flex-col items-center justify-center px-margin-mobile py-10 md:px-margin-desktop">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo — mobile saja */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-auto" />
            <span className="text-xl font-bold">CookPlan</span>
          </div>

          {isForgot && (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="mb-4 inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
              Kembali masuk
            </button>
          )}

          <h1 className="font-headline-md text-headline-md">{heading}</h1>
          <p className="mt-1.5 text-body-md text-on-surface-variant">{subheading}</p>

          {/* Toggle Masuk / Daftar */}
          {!isForgot && !isUpdate && (
            <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-surface-container-low p-1" role="tablist" aria-label="Mode autentikasi">
              {[["login", "Masuk"], ["register", "Daftar"]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => switchMode(value)}
                  className={`rounded-full py-2.5 text-label-md font-semibold transition-colors cursor-pointer ${
                    mode === value ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Banner pesan */}
          <div aria-live="polite" aria-atomic="true">
            {error && (
              <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-error/10 px-4 py-3 text-label-md text-error">
                <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">error</span>
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-success-green/10 px-4 py-3 text-label-md text-on-surface">
                <span className="material-symbols-outlined fill text-[20px] shrink-0 text-success-green" aria-hidden="true">check_circle</span>
                <span>{notice}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {isRegister && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-label-md font-semibold">Nama lengkap</label>
                <div className={inputWrap}>
                  <span className={iconClass} aria-hidden="true">person</span>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama kamu"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {!isUpdate && (
              <div>
                <label htmlFor="email" className="mb-1.5 block text-label-md font-semibold">Email</label>
                <div className={inputWrap}>
                  <span className={iconClass} aria-hidden="true">mail</span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kamu@email.com"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {!isForgot && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-label-md font-semibold">
                    {isUpdate ? "Kata sandi baru" : "Kata sandi"}
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-label-sm font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Lupa kata sandi?
                    </button>
                  )}
                </div>
                <div className={inputWrap}>
                  <span className={iconClass} aria-hidden="true">lock</span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isRegister || isUpdate ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRegister || isUpdate ? "Minimal 6 karakter" : "Kata sandi"}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-on-surface-variant hover:text-primary cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {(isRegister || isUpdate) && (
              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-label-md font-semibold">Konfirmasi kata sandi</label>
                <div className={inputWrap}>
                  <span className={iconClass} aria-hidden="true">lock</span>
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Ulangi kata sandi"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-surface-tint disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {loading && (
                <span className="material-symbols-outlined animate-spin text-[20px]" aria-hidden="true">progress_activity</span>
              )}
              {isUpdate ? "Simpan kata sandi" : isForgot ? "Kirim tautan reset" : isRegister ? "Daftar" : "Masuk"}
            </button>
          </form>

          {!isForgot && !isUpdate && (
            <>
              <div className="my-6 flex items-center gap-3 text-label-sm text-on-surface-variant">
                <span className="h-px flex-1 bg-outline-variant" />
                atau
                <span className="h-px flex-1 bg-outline-variant" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-outline-variant bg-white py-3 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-low cursor-pointer"
              >
                <GoogleIcon />
                Lanjutkan dengan Google
              </button>

              <p className="mt-6 text-center text-label-md text-on-surface-variant">
                {isRegister ? "Sudah punya akun? " : "Belum punya akun? "}
                <button
                  type="button"
                  onClick={() => switchMode(isRegister ? "login" : "register")}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  {isRegister ? "Masuk" : "Daftar gratis"}
                </button>
              </p>
            </>
          )}
        </div>
      </main>

      <Toast />
    </div>
  );
}
