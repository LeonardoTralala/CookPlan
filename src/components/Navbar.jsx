import { Link } from 'react-router-dom';
import { Logo } from "./Logo.jsx";
import { useAuth } from "../hooks/useAuth.js";

// Navbar landing: logo + CTA masuk ke aplikasi (mengarah ke /generate; pengguna
// yang belum login akan diminta login lebih dulu).
export function Navbar() {
  const { user } = useAuth();
  const isLoggedIn = !!user;

  return (
    <header className="w-full sticky top-0 z-50 border-b border-outline-variant/30 backdrop-blur-md bg-canvas-white/95">
      <nav className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
        <Link to="/" className="flex items-center gap-3 cursor-pointer select-none">
          <Logo className="h-11 w-auto" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/subscription"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-on-surface-variant hover:text-primary transition px-3 py-2 rounded-full hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[18px] text-amber-500">workspace_premium</span>
            <span>Paket &amp; Harga</span>
          </Link>

          <Link
            to={isLoggedIn ? "/planner" : "/generate"}
            className="inline-flex items-center min-h-11 px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-semibold hover:bg-surface-tint active:scale-95 transition cursor-pointer"
          >
            {isLoggedIn ? "Ke Aplikasi" : "Mulai Sekarang"}
          </Link>
        </div>
      </nav>
    </header>
  );
}
