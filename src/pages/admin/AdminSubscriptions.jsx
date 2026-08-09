import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal.jsx';
import { checkIsAdmin } from '../../services/adminService.js';
import { getAdminSubscriptions, updateSubscriptionStatus } from '../../services/subscriptionService.js';
import { usePlan } from '../../hooks/usePlan.js';

const SUBS_STATUSES = [
  { value: 'pending', label: 'Pending', tone: 'warning', icon: 'hourglass_empty' },
  { value: 'active', label: 'Aktif', tone: 'success', icon: 'check_circle' },
  { value: 'expired', label: 'Expired', tone: 'neutral', icon: 'history' },
  { value: 'cancelled', label: 'Dibatalkan', tone: 'error', icon: 'cancel' },
];

const TONE_CLS = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  neutral: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
  error: 'bg-rose-50 text-rose-700 border-rose-200',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

const addDays = (dateStr, days) => {
  const d = new Date(dateStr || Date.now());
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export function AdminSubscriptions() {
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [allowed, setAllowed] = useState(null); // null = checking
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | status
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Modal State untuk Aktivasi / Edit Tanggal
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [startDate, setStartDate] = useState(getTodayString());

  // Tanggal berakhir otomatis 30 hari dari startDate
  const calculatedEndDate = useMemo(() => {
    return addDays(startDate, 30);
  }, [startDate]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSubscriptions(await getAdminSubscriptions());
    } catch (e) {
      showToast(e.message || 'Gagal memuat langganan.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => {
      if (!active) return;
      setAllowed(ok);
      if (ok) refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  // Ringkasan Statistik
  const stats = useMemo(() => {
    let activeCount = 0;
    let pendingCount = 0;
    let expiredCount = 0;
    let totalRevenue = 0;

    for (const sub of subscriptions) {
      if (sub.status === 'active') {
        activeCount++;
        totalRevenue += sub.tier === 'pro' ? 29000 : 11000;
      } else if (sub.status === 'pending') {
        pendingCount++;
      } else if (sub.status === 'expired') {
        expiredCount++;
      }
    }
    return { activeCount, pendingCount, expiredCount, totalRevenue, total: subscriptions.length };
  }, [subscriptions]);

  const counts = useMemo(() => {
    const c = { all: subscriptions.length };
    for (const s of SUBS_STATUSES) c[s.value] = 0;
    for (const sub of subscriptions) {
      if (sub.status in c) c[sub.status] += 1;
    }
    return c;
  }, [subscriptions]);

  const filtered = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchFilter = filter === 'all' || sub.status === filter;
      const q = search.toLowerCase().trim();
      const userName = (sub.user?.full_name || sub.user?.username || '').toLowerCase();
      const userEmail = (sub.user?.email || '').toLowerCase();
      const subId = String(sub.id).toLowerCase();
      const matchSearch = !q || userName.includes(q) || userEmail.includes(q) || subId.includes(q);
      return matchFilter && matchSearch;
    });
  }, [subscriptions, filter, search]);

  const handleOpenActivateModal = (sub) => {
    setActiveModalItem(sub);
    setStartDate(sub.start_date || getTodayString());
  };

  const handleConfirmActivate = async () => {
    if (!activeModalItem) return;
    const sub = activeModalItem;
    setBusyId(sub.id);

    const updates = {
      status: 'active',
      start_date: startDate,
      end_date: calculatedEndDate,
    };

    try {
      await updateSubscriptionStatus(sub.id, updates);
      showToast(`Langganan #${sub.id} berhasil diaktifkan!`);
      setActiveModalItem(null);
      refresh();
    } catch (err) {
      showToast(err.message || 'Gagal mengaktifkan langganan.', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelSub = async (sub) => {
    setBusyId(sub.id);
    try {
      await updateSubscriptionStatus(sub.id, { status: 'cancelled' });
      showToast(`Langganan #${sub.id} dibatalkan.`);
      refresh();
    } catch (err) {
      showToast(err.message || 'Gagal membatalkan langganan.', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleExtend30Days = async (sub) => {
    setBusyId(sub.id);
    const currentEnd = sub.end_date || getTodayString();
    const newEnd = addDays(currentEnd, 30);
    try {
      await updateSubscriptionStatus(sub.id, {
        status: 'active',
        end_date: newEnd,
      });
      showToast(`Langganan #${sub.id} diperpanjang hingga ${fmtDate(newEnd)}!`);
      refresh();
    } catch (err) {
      showToast(err.message || 'Gagal memperpanjang langganan.', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

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

  const chips = [{ value: 'all', label: 'Semua' }, ...SUBS_STATUSES];

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl">workspace_premium</span>
            Kelola Langganan CookPass
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Verifikasi pembayaran via WhatsApp & atur masa aktif paket berlangganan pengguna.
          </p>
        </div>
        <button
          onClick={refresh}
          aria-label="Muat ulang"
          className="px-3.5 py-2.5 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low cursor-pointer inline-flex items-center gap-1.5 shrink-0 transition"
        >
          <span className="material-symbols-outlined text-[20px]">refresh</span>
          <span className="hidden sm:inline text-xs font-semibold">Muat Ulang</span>
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-outline-variant/60 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Perlu Persetujuan
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-amber-600">{stats.pendingCount}</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">hourglass_empty</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-outline-variant/60 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Member Aktif</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-emerald-600">{stats.activeCount}</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-outline-variant/60 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Total Pendaftaran
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-on-surface">{stats.total}</span>
            <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">workspace_premium</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-outline-variant/60 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">MRR Estimasi</span>
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-primary">Rp {stats.totalRevenue.toLocaleString('id-ID')}</span>
            <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">payments</span>
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {chips.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                filter === c.value
                  ? 'bg-primary text-on-primary border-primary shadow-sm'
                  : 'bg-white text-on-surface-variant border-outline-variant hover:border-primary/50'
              }`}
            >
              {c.label}
              <span className={`ml-1.5 text-xs ${filter === c.value ? 'text-on-primary/80' : 'text-outline'}`}>
                {counts[c.value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama pengguna, email, atau ID langganan..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-outline-variant rounded-2xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant bg-white rounded-3xl border border-outline-variant/60">
          <span className="material-symbols-outlined text-5xl text-primary mb-3">workspace_premium</span>
          <p className="text-sm font-medium">Belum ada data berlangganan{filter !== 'all' ? ' di status ini' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => {
            const statusObj = SUBS_STATUSES.find((s) => s.value === sub.status) || {
              label: sub.status,
              tone: 'neutral',
              icon: 'help',
            };
            const isBusy = busyId === sub.id;

            return (
              <div
                key={sub.id}
                className="rounded-2xl border border-outline-variant/70 bg-white p-5 space-y-4 hover:border-primary/40 transition-all shadow-sm"
              >
                {/* Header Sub */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/40 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-on-surface text-base">
                        {sub.tier === 'pro' ? 'CookPass Pro' : 'CookPass Lite'}
                      </span>
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                          TONE_CLS[statusObj.tone]
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">{statusObj.icon}</span>
                        {statusObj.label}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Subs ID: <span className="font-mono font-medium text-on-surface">SUB-{sub.id}</span> · Dibuat:{' '}
                      {fmtDate(sub.created_at)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-on-surface-variant block">Harga Paket</span>
                    <span className="font-bold text-primary text-base">
                      {sub.tier === 'pro' ? 'Rp 29.000 / bln' : 'Rp 11.000 / bln'}
                    </span>
                  </div>
                </div>

                {/* User Info & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30">
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                      Pengguna
                    </span>
                    <span className="font-medium text-on-surface">
                      {sub.user?.full_name || sub.user?.username || 'Tanpa Nama'}
                    </span>
                    {sub.user?.email && <span className="block text-xs text-on-surface-variant">{sub.user.email}</span>}
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                      Masa Aktif (30 Hari)
                    </span>
                    {sub.status === 'active' || sub.start_date ? (
                      <span className="font-medium text-on-surface text-xs sm:text-sm">
                        {fmtDate(sub.start_date)} s/d {fmtDate(sub.end_date)}
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant italic">Belum diaktifkan</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {sub.status === 'pending' && (
                    <button
                      onClick={() => handleOpenActivateModal(sub)}
                      disabled={isBusy}
                      className="px-4 py-2 bg-primary text-on-primary rounded-full font-semibold text-xs hover:shadow-md active:scale-95 transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      Aktifkan Langganan
                    </button>
                  )}

                  {sub.status === 'active' && (
                    <button
                      onClick={() => handleExtend30Days(sub)}
                      disabled={isBusy}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-full font-semibold text-xs hover:bg-emerald-700 active:scale-95 transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      Perpanjang +30 Hari
                    </button>
                  )}

                  {(sub.status === 'pending' || sub.status === 'active') && (
                    <button
                      onClick={() => handleCancelSub(sub)}
                      disabled={isBusy}
                      className="px-3.5 py-2 border border-error/30 text-error hover:bg-error/10 rounded-full font-semibold text-xs transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">block</span>
                      Batalkan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi Aktivasi & Pilih Start Date */}
      <Modal isOpen={Boolean(activeModalItem)} onClose={() => setActiveModalItem(null)}>
        <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-primary/10 text-left animate-scale-up space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Aktivasi Langganan</h3>
              <p className="text-xs text-on-surface-variant">SUB-{activeModalItem?.id}</p>
            </div>
          </div>

          <div className="bg-surface-cream/80 p-3.5 rounded-2xl border border-outline-variant/60 text-xs space-y-1 text-on-surface">
            <p>
              Pelanggan:{' '}
              <span className="font-bold">
                {activeModalItem?.user?.full_name || activeModalItem?.user?.username || 'Tanpa Nama'}
              </span>
            </p>
            <p>
              Paket:{' '}
              <span className="font-bold text-primary uppercase">
                {activeModalItem?.tier === 'pro' ? 'CookPass Pro' : 'CookPass Lite'}
              </span>
            </p>
          </div>

          {/* Form Input Start Date */}
          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs font-semibold text-on-surface mb-1">Tanggal Mulai (Start Date)</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </label>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 block">
                Tanggal Berakhir Otomatis (+30 Hari)
              </span>
              <span className="text-sm font-bold text-emerald-700 block">{fmtDate(calculatedEndDate)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveModalItem(null)}
              disabled={Boolean(busyId)}
              className="flex-1 py-3 px-5 rounded-full border border-outline-variant text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmActivate}
              disabled={Boolean(busyId)}
              className="flex-1 py-3 px-5 rounded-full bg-primary text-on-primary font-semibold text-sm shadow-md hover:shadow-lg active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busyId ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Memproses...
                </>
              ) : (
                'Aktifkan Sekarang'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
