import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { checkIsAdmin } from '../services/adminService.js';

// Tab sub-navigasi area admin. Urutan = urutan tampil di bar.
const ADMIN_TABS = [
  { to: '/admin', end: true, icon: 'dashboard', label: 'Dashboard' },
  { to: '/admin/recipes', icon: 'restaurant_menu', label: 'Resep' },
  { to: '/admin/ingredients', icon: 'inventory_2', label: 'Bahan' },
  { to: '/admin/packages', icon: 'shopping_bag', label: 'Paket' },
  { to: '/admin/orders', icon: 'receipt_long', label: 'Pesanan' },
  { to: '/admin/ai', icon: 'settings_suggest', label: 'Provider AI' },
];

// Kerangka area admin: sub-nav tab bersama di atas tiap halaman admin agar
// antar-tool saling terhubung (tak perlu balik ke Profil). Tab hanya tampil
// untuk admin; gating konten sebenarnya tetap di tiap halaman + RLS server.
export function AdminLayout({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => { if (active) setIsAdmin(ok); });
    return () => { active = false; };
  }, []);

  return (
    <>
      {isAdmin && (
        <div className="border-b border-outline-variant/40 bg-surface-container-lowest">
          <nav aria-label="Navigasi admin" className="max-w-3xl mx-auto px-5 md:px-10">
            <div className="flex gap-1 overflow-x-auto hide-scrollbar -mb-px">
              {ADMIN_TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3.5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-on-surface-variant hover:text-primary'
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      )}
      {children}
    </>
  );
}
