import { useState, useEffect, Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo.jsx';
import { Modal } from './Modal.jsx';
import { RouteFallback } from './RouteFallback.jsx';
import { usePlan } from '../hooks/usePlan.js';
import { useAuth } from '../hooks/useAuth.js';
import { checkIsAdmin } from '../services/adminService.js';
import { FeedbackButton } from './FeedbackButton.jsx';
import { PageOnboarding } from './PageOnboarding.jsx';

// Onboarding Steps per Page
const ONBOARDING_STEPS = {
  '/generate': [
    {
      title: 'Atur Durasi Menu',
      description: 'Gunakan tombol tambah/kurang di sini untuk mengatur berapa hari rencana masak yang ingin disusun oleh AI (1-7 hari).',
      targetSelector: '#generate-periode-field'
    },
    {
      title: 'Bahan di Kulkas (Opsional)',
      description: 'Ketik dan masukkan bahan makanan yang tersisa di rumahmu agar AI memprioritaskan resep dengan bahan-bahan ini!',
      targetSelector: '#generate-pantry-field'
    },
    {
      title: 'Mulai Susun Menu AI',
      description: 'Klik tombol ini jika semua opsi sudah sesuai. AI CookPlan akan segera merancang rencana makan mingguanmu.',
      targetSelector: '#generate-submit-btn'
    }
  ],
  '/catalog': [
    {
      title: 'Cari Resep Sehat',
      description: 'Ketik bahan atau nama masakan di kolom pencarian ini untuk menemukan menu favoritmu secara instan.',
      targetSelector: '#catalog-search-input'
    },
    {
      title: 'Filter Kategori Diet',
      description: 'Pilih kategori diet (seperti Tinggi Protein, Rendah Kalori, Vegetarian) untuk menyaring resep sesuai preferensimu.',
      targetSelector: '#catalog-filter-chips'
    },
    {
      title: 'Jelajahi Resep',
      description: 'Klik kartu resep mana saja untuk melihat info gizi detail, bahan-bahan, dan langkah memasak yang praktis.',
      targetSelector: '#catalog-recipe-grid'
    }
  ],
  '/planner': [
    {
      title: 'Rencana Masak Mingguan',
      description: 'Di sini kamu bisa melihat jadwal makan sarapan, makan siang, dan makan malam yang sudah kamu jadwalkan.',
      targetSelector: '#planner-grid-container'
    },
    {
      title: 'Bantuan AI CookPlan',
      description: 'Jika rencanamu masih kosong, klik tombol ini untuk membiarkan AI merancang menu mingguanmu dalam sekejap.',
      targetSelector: '#planner-ai-btn'
    },
    {
      title: 'Buat Daftar Belanjaan',
      description: 'Setelah merancang menu, klik tombol ini untuk secara otomatis merangkum semua kebutuhan bahan masakanmu.',
      targetSelector: '#planner-shopping-btn'
    }
  ],
  '/shopping': [
    {
      title: 'Pilihan Metode Belanja',
      description: 'Pilih "Belanja Sendiri" untuk checklist mandiri di pasar, atau pesan "Belanja di Kami" untuk memesan paket bahan segar langsung.',
      targetSelector: '#shopping-tab-switcher'
    },
    {
      title: 'Checklist Kebutuhan Bahan',
      description: 'Centang bahan belanjaan yang sudah kamu ambil/beli di toko, atau hapus bahan yang tidak kamu butuhkan.',
      targetSelector: '#shopping-ingredient-list'
    },
    {
      title: 'Simpan Daftar Belanja',
      description: 'Klik tombol ini untuk menyimpan daftar belanjaanmu agar bisa diakses kembali kapan saja dengan mudah.',
      targetSelector: '#shopping-save-btn'
    }
  ]
};

// Navigasi aplikasi (setelah login). Desktop: top-nav. Mobile: bottom-nav.
// Item dibatasi maks 5 (rule bottom-nav-limit di UI/UX review).
const NAV_ITEMS = [
  { to: '/generate', icon: 'auto_awesome', label: 'Generate' },
  { to: '/catalog', icon: 'menu_book', label: 'Katalog' },
  { to: '/planner', icon: 'calendar_month', label: 'Rencana' },
  { to: '/shopping', icon: 'shopping_cart', label: 'Belanja' },
  { to: '/profile', icon: 'person', label: 'Profil' },
];

export function AppShell({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { plannedCount } = usePlan();
  const { signOut, isAnonymous } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  // Konfirmasi sebelum keluar: tombol Keluar ada di zona jempol (mobile),
  // cegah logout tak sengaja (audit UX destructive-nav).
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [triggerTour, setTriggerTour] = useState(false);
  const steps = ONBOARDING_STEPS[pathname];

  // Tamu (anonymous): hanya tab Generate yang relevan; tab lain butuh akun penuh.
  const navItems = isAnonymous ? NAV_ITEMS.filter((i) => i.to === '/generate') : NAV_ITEMS;

  // Entry point Admin di header — hanya tampil untuk admin (gerbang asli RLS).
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (isAnonymous) return;
    let active = true;
    checkIsAdmin().then((ok) => { if (active) setIsAdmin(ok); });
    return () => { active = false; };
  }, [isAnonymous]);
  const onAdmin = pathname.startsWith('/admin');

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      setConfirmOpen(false);
      navigate('/');
    } catch (err) {
      // Biarkan user tetap di halaman saat ini bila signOut gagal — supaya
      // session yang masih aktif tidak ke-redirect ke landing dengan keadaan
      // tergantung. Console untuk debug, tombol auto-pulih via finally.
      console.error('Sign out gagal:', err);
    } finally {
      setSigningOut(false);
    }
  };

  const isActive = (to) => pathname === to || pathname.startsWith(to + '/');

  return (
    <div className="min-h-dvh flex flex-col bg-canvas-white text-on-surface antialiased">
      {/* Top nav (desktop) */}
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-canvas-white/95 backdrop-blur-md">
        <nav className="max-w-container-max mx-auto flex items-center justify-between px-margin-mobile md:px-margin-desktop py-3">
          <Link to="/generate" className="flex items-center gap-2 select-none">
            <Logo className="h-9 w-auto" />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isActive(item.to)
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{item.icon}</span>
                {item.label}
                {item.to === '/shopping' && plannedCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-error text-white text-[10px] font-bold">
                    {plannedCount}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Tombol Panduan (Help Tour) */}
            {steps && (
              <button
                onClick={() => setTriggerTour(true)}
                aria-label="Panduan Pengguna"
                className="inline-flex items-center justify-center w-11 h-11 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">help</span>
              </button>
            )}

            {/* Tombol Beri Masukan */}
            {!isAnonymous && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('trigger-feedback-modal'))}
                aria-label="Beri Masukan &amp; Saran"
                title="Beri Masukan &amp; Saran"
                className="inline-flex items-center justify-center w-11 h-11 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">rate_review</span>
              </button>
            )}

            {isAnonymous ? (
              // Tamu: arahkan untuk daftar / masuk alih-alih keluar.
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold hover:shadow-md active:scale-95 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person_add</span>
                Daftar / Masuk
              </Link>
            ) : (
              <div className="flex items-center gap-1">
                {/* Admin: pintu masuk panel (desktop pill, mobile ikon) */}
                {isAdmin && (
                  <>
                    <Link
                      to="/admin"
                      className={`hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                        onAdmin ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">admin_panel_settings</span>
                      Admin
                    </Link>
                    <Link
                      to="/admin"
                      aria-label="Panel Admin"
                      className={`md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full transition-colors ${
                        onAdmin ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>
                    </Link>
                  </>
                )}

                <button
                  onClick={() => setConfirmOpen(true)}
                  className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
                  Keluar
                </button>

                {/* Mobile: hanya logout di header (nav utama di bottom) */}
                <button
                  onClick={() => setConfirmOpen(true)}
                  aria-label="Keluar"
                  className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">logout</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className={`flex-grow outline-none ${isAnonymous ? '' : 'pb-20 md:pb-0'}`}>
        <Suspense fallback={<RouteFallback variant="content" />}>
          {children}
        </Suspense>
      </main>

      {/* Bottom nav (mobile) — tamu hanya punya Generate, jadi disembunyikan. */}
      {!isAnonymous && (
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-canvas-white/95 backdrop-blur-md border-t border-outline-variant/30 pb-safe-2"
        aria-label="Navigasi utama"
      >
        <div className="grid grid-cols-5">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 transition-colors ${
                isActive(item.to) ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] ${isActive(item.to) ? 'fill' : ''}`}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-semibold">{item.label}</span>
              {item.to === '/shopping' && plannedCount > 0 && (
                <span className="absolute top-1 right-[22%] inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-error text-white text-[9px] font-bold">
                  {plannedCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
      )}

      {/* Konfirmasi keluar */}
      <Modal isOpen={confirmOpen} onClose={() => !signingOut && setConfirmOpen(false)}>
        <div className="w-full max-w-sm bg-canvas-white rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col items-center text-center gap-1">
            <span className="material-symbols-outlined text-error text-[32px] mb-1" aria-hidden="true">logout</span>
            <h2 className="text-lg font-bold text-on-surface">Keluar dari akun?</h2>
            <p className="text-sm text-on-surface-variant">
              Kamu perlu masuk lagi untuk mengakses rencana menumu.
            </p>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={signingOut}
              className="flex-1 min-h-11 rounded-full text-sm font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-60"
            >
              Batal
            </button>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex-1 min-h-11 rounded-full text-sm font-semibold text-white bg-error hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
            >
              {signingOut ? 'Keluar…' : 'Keluar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* FAB masukan (global) */}
      {!isAnonymous && <FeedbackButton />}

      {/* Onboarding Tour */}
      {steps && (
        <PageOnboarding
          steps={steps}
          pageKey={pathname}
          triggerRun={triggerTour}
          onComplete={() => setTriggerTour(false)}
        />
      )}
    </div>
  );
}
