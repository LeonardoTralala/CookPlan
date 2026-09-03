import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkIsAdmin, getAdminStats } from '../../services/adminService.js';
import { getAdminSalesAnalytics, formatMonthLabel } from '../../services/adminAnalyticsService.js';
import { formatRupiah, CATEGORY_FALLBACK } from '../../utils/buildShoppingList.js';
import { usePlan } from '../../hooks/usePlan.js';

// Kartu tool navigasi admin. statKey -> ambil angka dari getAdminStats (null = tanpa angka).
const TOOLS = [
  { to: '/admin/recipes', icon: 'restaurant_menu', title: 'Kelola Resep', desc: 'Bank resep: harga, foto, bahan, dan langkah memasak.', statKey: 'recipes', unit: 'resep' },
  { to: '/admin/ingredients', icon: 'inventory_2', title: 'Master Bahan', desc: 'Harga & satuan dasar bahan — sumber harga resep.', statKey: 'ingredients', unit: 'bahan' },
  { to: '/admin/packages', icon: 'shopping_bag', title: 'Kelola Paket', desc: 'Paket "Belanja di Kami" beserta menu fiksnya.', statKey: 'packages', unit: 'paket' },
  { to: '/admin/orders', icon: 'receipt_long', title: 'Pesanan Masuk', desc: 'Lacak pesanan WhatsApp & ubah status pengiriman.', statKey: 'ordersActive', unit: 'perlu diproses' },
  { to: '/admin/feedback', icon: 'feedback', title: 'Masukan Pengguna', desc: 'Baca umpan balik & rating pengguna untuk evaluasi.', statKey: 'feedback', unit: 'masukan' },
  { to: '/admin/subscriptions', icon: 'workspace_premium', title: 'Langganan CookPass', desc: 'Verifikasi & aktifkan paket berlangganan pengguna.', statKey: 'subscriptionsPending', unit: 'perlu disetujui' },
  { to: '/admin/ai', icon: 'settings_suggest', title: 'Provider AI', desc: 'Konfigurasi penyedia model AI untuk generate plan.', statKey: null },
];

const CATEGORY_CHIPS = [
  { id: 'all', label: 'Semua Kategori', icon: 'apps' },
  { id: 'meat', label: 'Protein', icon: 'set_meal' },
  { id: 'vegetables', label: 'Sayuran', icon: 'eco' },
  { id: 'dry_goods', label: 'Bahan Pokok', icon: 'grocery' },
  { id: 'spices', label: 'Bumbu & Rempah', icon: 'restaurant' },
  { id: 'dairy', label: 'Telur & Susu', icon: 'egg' },
];

export function AdminDashboard() {
  const navigate = useNavigate();
  const { showToast } = usePlan();
  const [allowed, setAllowed] = useState(null); // null = checking
  const [stats, setStats] = useState(null);

  // State analitik penjualan
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Filter akumulasi bahan
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [hideStaples, setHideStaples] = useState(true);

  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => {
      if (!active) return;
      setAllowed(ok);
      if (ok) {
        // Muat data jumlah umum
        getAdminStats()
          .then((s) => { if (active) setStats(s); })
          .catch((e) => { if (active) showToast(e.message, { variant: 'error' }); });

        // Muat data analitik penjualan & bahan
        setLoadingAnalytics(true);
        getAdminSalesAnalytics()
          .then((res) => {
            if (!active) return;
            setAnalytics(res);
          })
          .catch((err) => {
            if (active) showToast('Gagal memuat analitik: ' + err.message, { variant: 'error' });
          })
          .finally(() => {
            if (active) setLoadingAnalytics(false);
          });
      }
    });
    return () => { active = false; };
  }, [showToast]);

  // Statistik untuk periode yang dipilih
  const currentStats = useMemo(() => {
    if (!analytics) return null;
    if (selectedMonth === 'all') return analytics.allStats;
    return analytics.byMonth?.[selectedMonth] ?? analytics.allStats;
  }, [analytics, selectedMonth]);

  // Filter daftar akumulasi bahan
  const filteredIngredients = useMemo(() => {
    if (!currentStats?.accumulatedIngredients) return [];
    let list = currentStats.accumulatedIngredients;

    // Filter bahan pokok dasar (air, garam secukupnya, dll)
    if (hideStaples) {
      list = list.filter((it) => !it.isStaple);
    }

    // Filter kategori
    if (selectedCat !== 'all') {
      list = list.filter((it) => it.category === selectedCat);
    }

    // Filter teks pencarian
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((it) => it.name.toLowerCase().includes(q));
    }

    return list;
  }, [currentStats, hideStaples, selectedCat, searchQuery]);

  if (allowed === null) {
    return (
      <div className="flex justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-4">lock</span>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Khusus Admin</h1>
        <p className="text-on-surface-variant text-sm mb-6">Halaman ini hanya untuk admin CookPlan.</p>
        <button
          onClick={() => navigate('/generate')}
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-12 space-y-8">
      {/* Header Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-outline-variant/60 pb-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2.5">
            <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
            Panel Admin & Analisis
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Pantau pertumbuhan penjualan paket belanja, logistik pasokan bahan, dan manajemen operasional.
          </p>
        </div>

        {/* Filter Periode Bulan */}
        <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant p-1.5 rounded-2xl">
          <span className="material-symbols-outlined text-on-surface-variant text-xl ml-2">calendar_month</span>
          <select
            aria-label="Pilih Periode Bulan"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-sm font-semibold text-on-surface pr-3 py-1 outline-none cursor-pointer"
          >
            <option value="all">Semua Periode</option>
            {analytics?.availableMonths?.map((mKey) => (
              <option key={mKey} value={mKey}>
                {formatMonthLabel(mKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bagian Analitik Penjualan */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">monitoring</span>
            Performa Penjualan — {formatMonthLabel(selectedMonth)}
          </h2>
          {loadingAnalytics && (
            <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              Memuat data...
            </span>
          )}
        </div>

        {/* 4 Kartu KPI Ringkasan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-outline-variant bg-white p-4.5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-on-surface-variant">Penjualan Paket</span>
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">payments</span>
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-on-surface">
                {currentStats ? formatRupiah(currentStats.subtotalRevenue) : '—'}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Nilai bersih produk bahan</p>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-white p-4.5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-on-surface-variant">Pesanan Selesai</span>
              <span className="w-8 h-8 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">local_shipping</span>
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-on-surface">
                {currentStats ? `${currentStats.orderCount} Pesanan` : '—'}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {currentStats && currentStats.orderCount > 0
                  ? `Rata-rata: ${formatRupiah(currentStats.averageOrderValue)} / order`
                  : 'Belum ada transaksi'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-white p-4.5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-on-surface-variant">Total Kas (+ Ongkir)</span>
              <span className="w-8 h-8 rounded-lg bg-tertiary/15 text-tertiary flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-on-surface">
                {currentStats ? formatRupiah(currentStats.grandTotal) : '—'}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Ongkir: {currentStats ? formatRupiah(currentStats.totalDeliveryFee) : '—'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-white p-4.5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-on-surface-variant">Komoditas Bahan</span>
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">kitchen</span>
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-on-surface">
                {currentStats ? `${currentStats.accumulatedIngredients.length} Jenis` : '—'}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Bahan mentah terdistribusi</p>
            </div>
          </div>
        </div>

        {/* Breakdown Paket Terjual */}
        <div className="rounded-2xl border border-outline-variant bg-white p-5 space-y-4 shadow-xs">
          <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">pie_chart</span>
            Distribusi Paket Terjual
          </h3>

          {!currentStats?.packagesBreakdown?.length ? (
            <p className="text-xs text-on-surface-variant py-3 text-center">Tidak ada paket terjual pada periode ini.</p>
          ) : (
            <div className="space-y-3.5">
              {currentStats.packagesBreakdown.map((pkg) => (
                <div key={pkg.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                      {pkg.name}
                    </span>
                    <span className="text-on-surface-variant">
                      <strong className="text-on-surface">{pkg.count} box</strong> ({formatRupiah(pkg.revenue)}) · {pkg.percent}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pkg.percent, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bagian Akumulasi Bahan Terjual */}
      <section className="rounded-3xl border border-outline-variant bg-white p-5 md:p-7 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">inventory</span>
              Akumulasi Bahan Terjual
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Estimasi total kuantitas bahan makanan segar & bumbu yang dipasok untuk memenuhi paket pelanggan.
            </p>
          </div>

          {/* Toggle Sembunyikan Bumbu Dasar / Air */}
          <label className="inline-flex items-center gap-2 text-xs font-medium text-on-surface-variant cursor-pointer self-start sm:self-auto bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/60">
            <input
              type="checkbox"
              checked={hideStaples}
              onChange={(e) => setHideStaples(e.target.checked)}
              className="rounded accent-primary cursor-pointer"
            />
            Sembunyikan air & bumbu dapur dasar
          </label>
        </div>

        {/* Filter Bar Bahan */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Kolom Pencarian */}
          <div className="relative flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Cari nama bahan (cth: Ayam, Kentang...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          {/* Chip Kategori */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORY_CHIPS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCat(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCat === cat.id
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabel / Daftar Bahan */}
        <div className="rounded-2xl border border-outline-variant/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container text-on-surface-variant font-semibold border-b border-outline-variant/60">
                <tr>
                  <th className="py-3 px-4">Nama Bahan</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Akumulasi Kuantitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40 bg-white">
                {filteredIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-on-surface-variant text-xs">
                      Tidak ada bahan yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredIngredients.map((item, idx) => {
                    const meta = item.categoryMeta || CATEGORY_FALLBACK;
                    return (
                      <tr key={`${item.name}-${item.unit}-${idx}`} className="hover:bg-surface-container-lowest/70 transition-colors">
                        <td className="py-3 px-4 font-medium text-on-surface">
                          {item.name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md">
                            <span className="material-symbols-outlined text-[13px]">{meta.icon}</span>
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-primary text-sm">
                          {item.readableAmount}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Bagian Alat & Menu Operasional Admin */}
      <section className="space-y-4 pt-2">
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">handyman</span>
          Manajemen Konten & Menu Admin
        </h2>

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
                  <h3 className="font-semibold text-on-surface group-hover:text-primary transition-colors">{t.title}</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">{t.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
