import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkIsAdmin, getAdminStats } from '../../services/adminService.js';
import { usePlan } from '../../hooks/usePlan.js';

// Kartu tool admin. statKey → ambil angka dari getAdminStats (null = tanpa angka).
const TOOLS = [
  { to: '/admin/recipes', icon: 'restaurant_menu', title: 'Kelola Resep', desc: 'Bank resep: harga, foto, bahan, dan langkah memasak.', statKey: 'recipes', unit: 'resep' },
  { to: '/admin/ingredients', icon: 'inventory_2', title: 'Master Bahan', desc: 'Harga & satuan dasar bahan — sumber harga resep.', statKey: 'ingredients', unit: 'bahan' },
  { to: '/admin/packages', icon: 'shopping_bag', title: 'Kelola Paket', desc: 'Paket "Belanja di Kami" beserta menu fiksnya.', statKey: 'packages', unit: 'paket' },
  { to: '/admin/orders', icon: 'receipt_long', title: 'Pesanan Masuk', desc: 'Lacak pesanan WhatsApp & ubah status pengiriman.', statKey: 'ordersActive', unit: 'perlu diproses' },
  { to: '/admin/feedback', icon: 'feedback', title: 'Masukan Pengguna', desc: 'Baca umpan balik & rating pengguna untuk evaluasi.', statKey: 'feedback', unit: 'masukan' },
  { to: '/admin/ai', icon: 'settings_suggest', title: 'Provider AI', desc: 'Konfigurasi penyedia model AI untuk generate plan.', statKey: null },
];

// Hub area admin: satu pintu masuk berisi kartu ke tiap tool + ringkasan jumlah.
export function AdminDashboard() {
  const navigate = useNavigate();
  const { showToast } = usePlan();
  const [allowed, setAllowed] = useState(null); // null=checking
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => {
      if (!active) return;
      setAllowed(ok);
      if (ok) {
        getAdminStats()
          .then((s) => { if (active) setStats(s); })
          .catch((e) => { if (active) showToast(e.message, { variant: 'error' }); });
      }
    });
    return () => { active = false; };
  }, [showToast]);

  if (allowed === null) {
    return <div className="flex justify-center py-24"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>;
  }
  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-4">lock</span>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Khusus Admin</h1>
        <p className="text-on-surface-variant text-sm mb-6">Halaman ini hanya untuk admin CookPlan.</p>
        <button onClick={() => navigate('/generate')} className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer">Kembali</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
          Panel Admin
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">Kelola konten & konfigurasi CookPlan dari satu tempat.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TOOLS.map((t) => {
          const count = t.statKey ? stats?.[t.statKey] : null;
          return (
            <Link
              key={t.to}
              to={t.to}
              className="group rounded-2xl border border-outline-variant bg-white p-5 hover:border-primary/50 hover:shadow-sm transition-all flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined">{t.icon}</span>
                </span>
                {t.statKey != null && (
                  <span className="text-right">
                    <span className="block text-xl font-bold text-on-surface leading-none">
                      {count == null ? '—' : count}
                    </span>
                    <span className="block text-[11px] text-on-surface-variant">{t.unit}</span>
                  </span>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-on-surface group-hover:text-primary transition-colors">{t.title}</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">{t.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
