import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo.jsx';
import { usePlan } from '../hooks/usePlan.js';
import { useAuth } from '../hooks/useAuth.js';

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

  // Tamu (anonymous): hanya tab Generate yang relevan; tab lain butuh akun penuh.
  const navItems = isAnonymous ? NAV_ITEMS.filter((i) => i.to === '/generate') : NAV_ITEMS;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
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
            <>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-on-surface-variant hover:text-error transition-colors cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
                Keluar
              </button>

              {/* Mobile: hanya logout di header (nav utama di bottom) */}
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Keluar"
                className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-on-surface-variant hover:text-error transition-colors cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined" aria-hidden="true">logout</span>
              </button>
            </>
          )}
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className={`flex-grow outline-none ${isAnonymous ? '' : 'pb-20 md:pb-0'}`}>
        {children}
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
    </div>
  );
}
