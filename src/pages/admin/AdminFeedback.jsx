import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkIsAdmin } from '../../services/adminService.js';
import {
  getAllFeedback,
  deleteFeedback,
  summarizeFeedback,
  FEEDBACK_CATEGORIES,
} from '../../services/feedbackService.js';
import { usePlan } from '../../hooks/usePlan.js';

const CATEGORY_META = Object.fromEntries(FEEDBACK_CATEGORIES.map((c) => [c.value, c]));

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch { return iso; }
};

// Deretan 5 bintang read-only untuk menampilkan rating sebuah feedback.
function Stars({ value }) {
  return (
    <span className="inline-flex" aria-label={`Rating ${value} dari 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={`material-symbols-outlined text-[18px] ${s <= value ? 'fill text-warning' : 'text-outline-variant'}`}
          aria-hidden="true"
        >
          star
        </span>
      ))}
    </span>
  );
}

// Halaman admin: baca & evaluasi umpan balik pengguna. Gating UI lewat
// checkIsAdmin; gerbang sebenarnya tetap RLS feedback_admin_all di server.
export function AdminFeedback() {
  const navigate = useNavigate();
  const { showToast } = usePlan();
  const [allowed, setAllowed] = useState(null); // null=checking
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | category value
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => {
      if (!active) return;
      setAllowed(ok);
      if (!ok) { setLoading(false); return; }
      getAllFeedback()
        .then((data) => { if (active) setRows(data); })
        .catch((e) => { if (active) showToast(e.message || 'Gagal memuat feedback.', { variant: 'error' }); })
        .finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; };
  }, [showToast]);

  const stats = useMemo(() => summarizeFeedback(rows), [rows]);
  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.category === filter)),
    [rows, filter]
  );

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus feedback ini? Tindakan tidak bisa dibatalkan.')) return;
    const prev = rows;
    setDeletingId(id);
    setRows((list) => list.filter((r) => r.id !== id)); // optimistic
    try {
      await deleteFeedback(id);
      showToast('Feedback dihapus.');
    } catch (e) {
      setRows(prev); // rollback
      showToast(e.message || 'Gagal menghapus feedback.', { variant: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

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
          <span className="material-symbols-outlined text-3xl">feedback</span>
          Masukan Pengguna
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">Umpan balik dari pengguna untuk bahan evaluasi produk.</p>
      </div>

      {/* Ringkasan evaluasi */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-outline-variant bg-white p-4">
          <span className="block text-2xl font-bold text-on-surface leading-none">{stats.total}</span>
          <span className="block text-xs text-on-surface-variant mt-1">total masukan</span>
        </div>
        <div className="rounded-2xl border border-outline-variant bg-white p-4">
          <span className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-on-surface leading-none">
              {stats.total ? stats.avgRating.toFixed(1) : '—'}
            </span>
            <span className="material-symbols-outlined fill text-warning text-[18px]">star</span>
          </span>
          <span className="block text-xs text-on-surface-variant mt-1">rata-rata rating</span>
        </div>
        <div className="col-span-2 rounded-2xl border border-outline-variant bg-white p-4">
          <span className="block text-xs text-on-surface-variant mb-2">sebaran rating</span>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.distribution[star] ?? 0;
              const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-on-surface-variant tabular-nums">{star}</span>
                  <span className="material-symbols-outlined fill text-warning text-[12px]">star</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-on-surface-variant tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter kategori */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
            filter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-cream text-on-surface-variant hover:bg-surface-variant'
          }`}
        >
          Semua
        </button>
        {FEEDBACK_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              filter === cat.value ? 'bg-primary text-on-primary' : 'bg-surface-cream text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Daftar feedback */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-2" aria-hidden="true">progress_activity</span>
          <p className="text-sm">Memuat masukan…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl text-outline-variant mb-2 block">forum</span>
          <p className="text-sm">{rows.length === 0 ? 'Belum ada masukan dari pengguna.' : 'Tidak ada masukan pada kategori ini.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => {
            const cat = CATEGORY_META[f.category] ?? { label: f.category, icon: 'chat' };
            return (
              <div key={f.id} className="rounded-2xl border border-outline-variant bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Stars value={f.rating} />
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-surface-cream text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{cat.icon}</span>
                      {cat.label}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(f.id)}
                    disabled={deletingId === f.id}
                    className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-60"
                    aria-label="Hapus feedback"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${deletingId === f.id ? 'animate-spin' : ''}`}>
                      {deletingId === f.id ? 'progress_activity' : 'delete'}
                    </span>
                  </button>
                </div>
                <p className="text-sm text-on-surface whitespace-pre-wrap break-words">{f.message}</p>
                <p className="text-xs text-on-surface-variant flex items-center gap-2 flex-wrap">
                  <span>{fmtDate(f.created_at)}</span>
                  {f.page && (
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">link</span>
                      {f.page}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
