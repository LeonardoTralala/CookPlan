import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal.jsx';
import { checkIsAdmin } from '../../services/adminService.js';

import { listOrders, updateOrder, deleteOrder, waLink } from '../../services/adminOrderService.js';
import {
  downloadReceiptImage,
  orderJenisLabel,
  PAYMENT_METHOD_LABEL,
  parseDiscountInfo,
  parseMemberTierFromNotes,
  downloadSubscriptionReceiptImage,
  buildSubscriptionWhatsappUrl,
} from '../../services/orderService.js';
import { getAdminSubscriptions, updateSubscriptionStatus } from '../../services/subscriptionService.js';
import {
  ORDER_STATUSES, PAYMENT_STATUSES, STATUS_TONE_CLS as TONE_CLS, orderMeta, payMeta,
} from '../../utils/orderStatus.js';
import { usePlan } from '../../hooks/usePlan.js';
import { formatRupiah, formatAmount } from '../../utils/buildShoppingList.js';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(iso));
  } catch { return iso; }
};

const getTodayString = () => new Date().toISOString().split('T')[0];

const addDays = (dateStr, days) => {
  const d = new Date(dateStr || Date.now());
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const SUBS_STATUS_CONFIG = {
  pending: { label: 'Pending', tone: 'warning', icon: 'hourglass_empty' },
  active: { label: 'Aktif', tone: 'success', icon: 'check_circle' },
  expired: { label: 'Expired', tone: 'neutral', icon: 'history' },
  cancelled: { label: 'Dibatalkan', tone: 'error', icon: 'cancel' },
};

const SUBS_TONE_CLS = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  neutral: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
  error: 'bg-rose-50 text-rose-700 border-rose-200',
};

const SUBS_CHIPS = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Aktif' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

// Admin UI: lacak & kelola pesanan paket belanja & langganan CookPass via WhatsApp.
export function AdminOrders() {
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [allowed, setAllowed] = useState(null); // null=checking
  const [orderTab, setOrderTab] = useState('packages'); // 'packages' | 'subscriptions'
  const [orders, setOrders] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Paket Belanja states
  const [filter, setFilter] = useState('all'); // 'all' | order_status
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [strukId, setStrukId] = useState(null); // order sedang dibuatkan struk PNG
  const [deletingId, setDeletingId] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // Langganan CookPass states
  const [subsFilter, setSubsFilter] = useState('all');
  const [subsSearch, setSubsSearch] = useState('');
  const [expandedSub, setExpandedSub] = useState(null);
  const [busySubId, setBusySubId] = useState(null);
  const [strukSubId, setStrukSubId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, subsRes] = await Promise.all([
        listOrders(),
        getAdminSubscriptions(),
      ]);
      setOrders(ordersRes);
      setSubscriptions(subsRes);
    } catch (e) {
      showToast(e.message, { variant: 'error' });
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
    return () => { active = false; };
  }, [refresh]);

  // Hitung jumlah per status untuk badge filter.
  const counts = useMemo(() => {
    const c = { all: orders.length };
    for (const s of ORDER_STATUSES) c[s.value] = 0;
    for (const o of orders) if (o.orderStatus in c) c[o.orderStatus] += 1;
    return c;
  }, [orders]);

  const filtered = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.orderStatus === filter)),
    [orders, filter]
  );

  const changeOrder = async (o, patch) => {
    setBusyId(o.id);
    // Optimistic: terapkan lokal dulu, rollback bila gagal.
    const prev = orders;
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, ...patch } : x)));
    try {
      await updateOrder(o.id, {
        orderStatus: patch.orderStatus,
        paymentStatus: patch.paymentStatus,
      });
      showToast('Pesanan diperbarui.');
    } catch (e) {
      setOrders(prev);
      showToast(e.message, { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  // Buat & unduh struk PNG untuk dikirim admin ke pembeli via WhatsApp.
  const handleDownloadStruk = async (o) => {
    setStrukId(o.id);
    try {
      await downloadReceiptImage(o, o.items ?? []);
      showToast('Struk diunduh. Lampirkan ke chat WhatsApp pembeli ya.');
    } catch (e) {
      showToast(e.message || 'Gagal membuat struk.', { variant: 'error' });
    } finally {
      setStrukId(null);
    }
  };

  const handleDeleteOrder = (o) => {
    setOrderToDelete(o);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    const o = orderToDelete;
    setDeletingId(o.id);
    const prev = orders;
    setOrders((list) => list.filter((x) => x.id !== o.id));
    setOrderToDelete(null);
    try {
      await deleteOrder(o.id);
      showToast('Pesanan berhasil dihapus.');
    } catch (e) {
      setOrders(prev);
      showToast(e.message || 'Gagal menghapus pesanan.', { variant: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const subsCounts = useMemo(() => {
    const c = { all: subscriptions.length, pending: 0, active: 0, expired: 0, cancelled: 0 };
    for (const s of subscriptions) {
      if (s.status in c) c[s.status] += 1;
    }
    return c;
  }, [subscriptions]);

  const filteredSubs = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchFilter = subsFilter === 'all' || sub.status === subsFilter;
      const q = subsSearch.toLowerCase().trim();
      const userName = (sub.user?.full_name || sub.user?.delivery_customer_name || sub.user?.username || '').toLowerCase();
      const userPhone = (sub.user?.delivery_customer_phone || sub.phone || '').toLowerCase();
      const subId = `sub-${sub.id}`.toLowerCase();
      const matchSearch = !q || userName.includes(q) || userPhone.includes(q) || subId.includes(q);
      return matchFilter && matchSearch;
    });
  }, [subscriptions, subsFilter, subsSearch]);

  const handleDownloadSubStruk = async (sub) => {
    setStrukSubId(sub.id);
    try {
      await downloadSubscriptionReceiptImage(sub);
      showToast(`Struk CookPass #${sub.id} berhasil diunduh! Siap dikirim via WA.`);
    } catch (e) {
      showToast(e.message || 'Gagal membuat struk langganan.', { variant: 'error' });
    } finally {
      setStrukSubId(null);
    }
  };

  const handleActivateSub = async (sub) => {
    setBusySubId(sub.id);
    const today = getTodayString();
    const endDate = addDays(today, 30);
    try {
      await updateSubscriptionStatus(sub.id, {
        status: 'active',
        start_date: today,
        end_date: endDate,
      });
      showToast(`Langganan #${sub.id} diaktifkan sampai ${fmtDate(endDate)}!`);
      refresh();
    } catch (e) {
      showToast(e.message || 'Gagal mengaktifkan langganan.', { variant: 'error' });
    } finally {
      setBusySubId(null);
    }
  };

  const handleExtendSub = async (sub) => {
    setBusySubId(sub.id);
    const currentEnd = sub.end_date || getTodayString();
    const newEnd = addDays(currentEnd, 30);
    try {
      await updateSubscriptionStatus(sub.id, {
        status: 'active',
        end_date: newEnd,
      });
      showToast(`Langganan #${sub.id} diperpanjang sampai ${fmtDate(newEnd)}!`);
      refresh();
    } catch (e) {
      showToast(e.message || 'Gagal memperpanjang langganan.', { variant: 'error' });
    } finally {
      setBusySubId(null);
    }
  };

  const handleCancelSub = async (sub) => {
    setBusySubId(sub.id);
    try {
      await updateSubscriptionStatus(sub.id, { status: 'cancelled' });
      showToast(`Langganan #${sub.id} dibatalkan.`);
      refresh();
    } catch (e) {
      showToast(e.message || 'Gagal membatalkan langganan.', { variant: 'error' });
    } finally {
      setBusySubId(null);
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

  const chips = [{ value: 'all', label: 'Semua' }, ...ORDER_STATUSES];

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl">receipt_long</span>
            Pesanan Masuk
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">Lacak pesanan paket belanja bahan dan verifikasi struk langganan CookPass.</p>
        </div>
        <button onClick={refresh} aria-label="Muat ulang" className="px-3 py-2.5 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low cursor-pointer inline-flex items-center gap-1.5 shrink-0">
          <span className="material-symbols-outlined text-[20px]">refresh</span>
        </button>
      </div>

      {/* Tab Switcher: Paket Belanja Bahan vs Langganan CookPass */}
      <div className="flex border-b border-outline-variant/60 gap-4 sm:gap-6">
        <button
          type="button"
          onClick={() => setOrderTab('packages')}
          className={`pb-3 px-1 font-semibold text-sm cursor-pointer border-b-2 transition-all flex items-center gap-2 ${
            orderTab === 'packages'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
          <span>Paket Belanja Bahan</span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold transition-colors ${
              orderTab === 'packages'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOrderTab('subscriptions')}
          className={`pb-3 px-1 font-semibold text-sm cursor-pointer border-b-2 transition-all flex items-center gap-2 ${
            orderTab === 'subscriptions'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
          <span>Langganan CookPass</span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold transition-colors ${
              orderTab === 'subscriptions'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {subscriptions.length}
          </span>
          {subsCounts.pending > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
              {subsCounts.pending} Baru
            </span>
          )}
        </button>
      </div>

      {orderTab === 'packages' ? (
        <>
          {/* Filter status */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {chips.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilter(c.value)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                  filter === c.value
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-white text-on-surface-variant border-outline-variant hover:border-primary/50'
                }`}
              >
                {c.label}
                <span className={`ml-1.5 text-xs ${filter === c.value ? 'text-on-primary/80' : 'text-outline'}`}>{counts[c.value] ?? 0}</span>
              </button>
            ))}
          </div>

      {loading ? (
        <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl text-primary mb-3">inbox</span>
          <p className="text-sm">Belum ada pesanan{filter !== 'all' ? ' di status ini' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const om = orderMeta(o.orderStatus);
            const pm = payMeta(o.paymentStatus);
            const grand = (o.total_price ?? 0) + (o.delivery_fee ?? 0);
            const isOpen = expanded === o.id;
            const memberTier = parseMemberTierFromNotes(o.notes);
            return (
              <div key={o.id} className="rounded-2xl border border-outline-variant bg-white overflow-hidden">
                {/* Header card (klik untuk buka) */}
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-surface-container-lowest transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-on-surface text-sm">{o.id}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${TONE_CLS[om.tone]}`}>
                        <span className="material-symbols-outlined text-[13px]">{om.icon}</span>{om.label}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${TONE_CLS[pm.tone]}`}>{pm.label}</span>
                      {memberTier === 'pro' && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300">
                          <span>👑</span> PRO (Free Ongkir + Prioritas Antar)
                        </span>
                      )}
                      {memberTier === 'lite' && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <span>🌿</span> LITE (Prioritas Antar)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 truncate">
                      {o.customer_name || 'Tanpa nama'} · {o.items?.length ?? 0} item · {fmtDate(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-primary text-right">{formatRupiah(grand)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOrder(o);
                      }}
                      disabled={deletingId === o.id}
                      className="p-1.5 rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-60"
                      title="Hapus Pesanan"
                      aria-label="Hapus Pesanan"
                    >
                      <span className={`material-symbols-outlined text-[20px] ${deletingId === o.id ? 'animate-spin text-error' : ''}`}>
                        {deletingId === o.id ? 'progress_activity' : 'delete'}
                      </span>
                    </button>
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px]">{isOpen ? 'expand_less' : 'expand_more'}</span>
                  </div>
                </button>


                {/* Detail */}
                {isOpen && (
                  <div className="border-t border-outline-variant/60 p-4 space-y-4 bg-surface-container-lowest">
                    {/* Kontak & info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <Info label="Pelanggan" value={o.customer_name || '—'} />
                      <Info label="Telepon" value={o.customer_phone || '—'} />
                      <Info label="Pembayaran" value={PAYMENT_METHOD_LABEL[o.payment_method] || o.payment_method || '—'} />
                      <Info label="Jenis" value={orderJenisLabel(o)} />
                      {memberTier === 'pro' && (
                        <div className="sm:col-span-2">
                          <Info label="Keanggotaan" value="Member CookPass Pro 👑 (Prioritas Antar Kurir & Free Ongkir)" />
                        </div>
                      )}
                      {memberTier === 'lite' && (
                        <div className="sm:col-span-2">
                          <Info label="Keanggotaan" value="Member CookPass Lite 🌿 (Prioritas Antar Kurir Internal)" />
                        </div>
                      )}
                      {o.delivery_address && <div className="sm:col-span-2"><Info label="Alamat" value={o.delivery_address} /></div>}
                      {o.notes && <div className="sm:col-span-2"><Info label="Catatan" value={o.notes} /></div>}
                    </div>

                    {/* Rincian item */}
                    {o.items?.length > 0 && (
                      <div className="rounded-xl border border-outline-variant bg-white divide-y divide-outline-variant/40 overflow-hidden">
                        {(() => {
                          const disc = parseDiscountInfo(o);
                          return (
                            <>
                              {o.items.map((it) => {
                                const displayPrice = disc ? disc.originalPrice : it.priceIdr;
                                return (
                                  <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                                    <span className="text-on-surface font-medium">{it.name}</span>
                                    <span className="text-on-surface-variant">
                                      {formatAmount(it.amount)} {it.unit}
                                      {displayPrice > 0 && (
                                        <span className="ml-2 text-on-surface font-semibold">
                                          {formatRupiah(displayPrice)}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                              {disc && (
                                <>
                                  <div className="flex items-center justify-between px-3 py-2 text-sm bg-surface-cream/30">
                                    <span className="text-on-surface-variant">Harga Asli</span>
                                    <span className="text-on-surface font-semibold">{formatRupiah(disc.originalPrice)}</span>
                                  </div>
                                  <div className="flex items-center justify-between px-3 py-2 text-sm bg-surface-cream/30 text-error">
                                    <span className="font-medium">Potongan Diskon ({disc.percent}%)</span>
                                    <span className="font-semibold">-{formatRupiah(disc.discountAmount)}</span>
                                  </div>
                                  <div className="flex items-center justify-between px-3 py-2 text-sm bg-surface-cream/50">
                                    <span className="text-on-surface font-medium">Subtotal Setelah Diskon</span>
                                    <span className="text-primary font-bold">{formatRupiah(o.total_price)}</span>
                                  </div>
                                </>
                              )}
                            </>
                          );
                        })()}
                        <div className="flex items-center justify-between px-3 py-2 text-sm bg-surface-cream">
                          <span className="text-on-surface-variant flex items-center gap-1.5 flex-wrap">
                            <span>Ongkir</span>
                            {(o.delivery_fee ?? 0) === 0 ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                PRO FREE ONGKIR
                              </span>
                            ) : memberTier === 'lite' ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                ⚡ PRIORITAS KURIR
                              </span>
                            ) : null}
                          </span>
                          <span className={`font-semibold ${(o.delivery_fee ?? 0) === 0 ? 'text-emerald-600 font-bold' : 'text-on-surface'}`}>
                            {(o.delivery_fee ?? 0) === 0 ? 'Rp 0 (Gratis Ongkir)' : formatRupiah(o.delivery_fee ?? 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <span className="font-bold text-primary">Total</span>
                          <span className="font-bold text-primary">{formatRupiah(grand)}</span>
                        </div>
                      </div>
                    )}

                    {/* Aksi: ubah status + hubungi */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="block text-xs font-semibold text-on-surface mb-1">Status pengiriman</span>
                        <select
                          value={o.orderStatus ?? 'received'}
                          disabled={busyId === o.id}
                          onChange={(e) => changeOrder(o, { orderStatus: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                        >
                          {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-xs font-semibold text-on-surface mb-1">Status pembayaran</span>
                        <select
                          value={o.paymentStatus ?? 'pending'}
                          disabled={busyId === o.id}
                          onChange={(e) => changeOrder(o, { paymentStatus: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                        >
                          {PAYMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => handleDownloadStruk(o)}
                        disabled={strukId === o.id}
                        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm hover:bg-surface-container-low active:scale-95 transition cursor-pointer disabled:opacity-60"
                      >
                        <span className={`material-symbols-outlined text-[20px] ${strukId === o.id ? 'animate-spin' : ''}`}>
                          {strukId === o.id ? 'progress_activity' : 'download'}
                        </span>
                        {strukId === o.id ? 'Membuat struk…' : 'Download Struk'}
                      </button>
                      <button
                        onClick={() => {
                          const total = (o.total_price ?? 0) + (o.delivery_fee ?? 0);
                          const date = o.created_at || o.createdAt || '';
                          navigate(`/admin/qris?amount=${total}&date=${encodeURIComponent(date)}&orderId=${encodeURIComponent(o.id)}`);
                        }}
                        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 rounded-full font-semibold text-sm active:scale-95 transition cursor-pointer"
                        title="Buka generator struk QRIS untuk pesanan ini"
                      >
                        <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                        Struk QRIS
                      </button>
                      {waLink(o.customer_phone) && (
                        <a
                          href={waLink(o.customer_phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-md active:scale-95 transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[20px]">chat</span>
                          Hubungi via WhatsApp
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteOrder(o)}
                        disabled={deletingId === o.id}
                        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 border border-error/30 text-error hover:bg-error/10 rounded-full font-semibold text-sm transition cursor-pointer disabled:opacity-60"
                        aria-label="Hapus pesanan"
                      >
                        <span className={`material-symbols-outlined text-[20px] ${deletingId === o.id ? 'animate-spin' : ''}`}>
                          {deletingId === o.id ? 'progress_activity' : 'delete'}
                        </span>
                        Hapus Pesanan
                      </button>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      ) : (
        <div className="space-y-4">
          {/* Subscriptions Filter Chips + Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {SUBS_CHIPS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setSubsFilter(c.value)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                    subsFilter === c.value
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-white text-on-surface-variant border-outline-variant hover:border-primary/50'
                  }`}
                >
                  {c.label}
                  <span className={`ml-1.5 text-xs ${subsFilter === c.value ? 'text-on-primary/80' : 'text-outline'}`}>
                    {subsCounts[c.value] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64 shrink-0">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
                search
              </span>
              <input
                type="text"
                placeholder="Cari nama, WA, ID..."
                value={subsSearch}
                onChange={(e) => setSubsSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-outline-variant rounded-full text-xs placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
            </div>
          ) : filteredSubs.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant bg-white rounded-2xl border border-outline-variant/60">
              <span className="material-symbols-outlined text-5xl text-primary mb-3">workspace_premium</span>
              <p className="text-sm font-medium">Belum ada pesanan langganan{subsFilter !== 'all' ? ' di status ini' : ''}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubs.map((sub) => {
                const isPro = (sub.tier || '').toLowerCase() === 'pro';
                const tierName = isPro ? 'CookPass Pro' : 'CookPass Lite';
                const price = isPro ? 29000 : 11000;
                const statusCfg = SUBS_STATUS_CONFIG[sub.status] || SUBS_STATUS_CONFIG.pending;
                const userName = sub.user?.full_name || sub.user?.delivery_customer_name || sub.user?.username || 'Pelanggan';
                const userPhone = sub.user?.delivery_customer_phone || sub.phone || '—';
                const isOpen = expandedSub === sub.id;
                const waSubUrl = buildSubscriptionWhatsappUrl(sub);

                return (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-outline-variant bg-white overflow-hidden shadow-xs hover:border-primary/40 transition"
                  >
                    {/* Header card (klik untuk buka) */}
                    <button
                      type="button"
                      onClick={() => setExpandedSub(isOpen ? null : sub.id)}
                      className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-surface-container-lowest transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-on-surface text-sm">SUB-{sub.id}</span>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              isPro
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px]">{isPro ? 'crown' : 'eco'}</span>
                            {tierName}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                              SUBS_TONE_CLS[statusCfg.tone]
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">{statusCfg.icon}</span>
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant truncate">
                          {userName} · {userPhone} · {fmtDate(sub.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="font-bold text-primary block text-sm sm:text-base">
                            {formatRupiah(price)}
                          </span>
                          <span className="text-[10px] text-on-surface-variant">/ 30 hari</span>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                          {isOpen ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </button>

                    {/* Detail langganan & aksi */}
                    {isOpen && (
                      <div className="border-t border-outline-variant/60 p-4 space-y-4 bg-surface-container-lowest">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <Info label="Pelanggan" value={userName} />
                          <Info label="WhatsApp / Telepon" value={userPhone} />
                          <Info label="Paket Langganan" value={`${tierName} (${formatRupiah(price)})`} />
                          <Info
                            label="Masa Berlaku"
                            value={
                              sub.status === 'active' || sub.start_date
                                ? `${fmtDate(sub.start_date)} s/d ${fmtDate(sub.end_date)}`
                                : 'Belum diaktifkan'
                            }
                          />
                          <Info label="Tanggal Pesanan" value={fmtDate(sub.created_at)} />
                          <Info label="Metode Pembayaran" value="QRIS" />
                        </div>

                        {/* Benefit list preview */}
                        <div className="rounded-xl border border-outline-variant/80 bg-white p-3 space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                            Benefit Keanggotaan {tierName}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-on-surface">
                            {isPro ? (
                              <>
                                <span className="inline-flex items-center gap-1.5 text-amber-900 font-medium">
                                  <span className="material-symbols-outlined text-amber-600 text-[16px]">check_circle</span>
                                  AI Meal Planner Unlimited
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-amber-900 font-medium">
                                  <span className="material-symbols-outlined text-amber-600 text-[16px]">check_circle</span>
                                  Gratis Ongkir Pengiriman Kota Malang
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-amber-900 font-medium">
                                  <span className="material-symbols-outlined text-amber-600 text-[16px]">check_circle</span>
                                  Akses Lengkap Seluruh Bank Resep
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-amber-900 font-medium">
                                  <span className="material-symbols-outlined text-amber-600 text-[16px]">check_circle</span>
                                  Badge Anggota Eksklusif CookPass Pro
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1.5 text-emerald-900 font-medium">
                                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                                  AI Menu Planner Prioritas
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-emerald-900 font-medium">
                                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                                  Akses Resep & Video Masak
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-emerald-900 font-medium">
                                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                                  Otomatisasi Jadwal Belanja Mingguan
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          {/* Download Struk Pembayaran Resmi */}
                          <button
                            type="button"
                            onClick={() => handleDownloadSubStruk(sub)}
                            disabled={strukSubId === sub.id}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-primary text-primary hover:bg-primary/5 active:scale-95 rounded-full font-semibold text-xs transition cursor-pointer disabled:opacity-60 shadow-xs"
                          >
                            <span className={`material-symbols-outlined text-[18px] ${strukSubId === sub.id ? 'animate-spin' : ''}`}>
                              {strukSubId === sub.id ? 'progress_activity' : 'receipt_long'}
                            </span>
                            {strukSubId === sub.id ? 'Membuat Struk PNG…' : 'Download Struk Pembayaran'}
                          </button>

                          {/* Buka Generator Struk QRIS CookPass */}
                          <button
                            type="button"
                            onClick={() => {
                              const isPro = (sub.tier || '').toLowerCase() === 'pro';
                              const amount = isPro ? 29000 : 11000;
                              const date = sub.created_at || sub.start_date || '';
                              const orderCode = `SUB-${sub.id}`;
                              navigate(`/admin/qris?amount=${amount}&date=${encodeURIComponent(date)}&orderId=${encodeURIComponent(orderCode)}&type=subscription`);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 rounded-full font-semibold text-xs active:scale-95 transition cursor-pointer shadow-xs"
                            title="Buka generator struk QRIS untuk langganan CookPass ini"
                          >
                            <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                            Struk QRIS
                          </button>

                          {/* Kirim Struk WA */}
                          {waSubUrl && (
                            <a
                              href={waSubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 rounded-full font-semibold text-xs transition cursor-pointer shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[18px]">chat</span>
                              Kirim Struk WA
                            </a>
                          )}

                          {/* Quick Status Modifiers */}
                          {sub.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleActivateSub(sub)}
                              disabled={busySubId === sub.id}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-xs hover:shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[16px]">verified</span>
                              Aktifkan (+30 Hari)
                            </button>
                          )}

                          {sub.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleExtendSub(sub)}
                              disabled={busySubId === sub.id}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full font-semibold text-xs hover:bg-emerald-100 active:scale-95 transition cursor-pointer disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[16px]">add_circle</span>
                              Perpanjang +30 Hari
                            </button>
                          )}

                          {(sub.status === 'pending' || sub.status === 'active') && (
                            <button
                              type="button"
                              onClick={() => handleCancelSub(sub)}
                              disabled={busySubId === sub.id}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-error/30 text-error hover:bg-error/10 rounded-full font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[16px]">block</span>
                              Batalkan
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Mewah */}
      <Modal isOpen={Boolean(orderToDelete)} onClose={() => setOrderToDelete(null)}>
        <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-error/10 text-center animate-scale-up">
          <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto mb-4 border border-error/20 shadow-inner">
            <span className="material-symbols-outlined text-3xl text-error">delete_forever</span>
          </div>

          <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-1">
            Hapus Pesanan Ini?
          </h3>

          {orderToDelete && (
            <div className="my-4 p-3.5 rounded-2xl bg-surface-cream/80 border border-outline-variant/60 text-left space-y-1 text-xs text-on-surface-variant">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface text-sm">#{orderToDelete.id}</span>
                <span className="font-bold text-primary">{formatRupiah((orderToDelete.total_price ?? 0) + (orderToDelete.delivery_fee ?? 0))}</span>
              </div>
              <p className="text-on-surface">Pelanggan: <span className="font-medium">{orderToDelete.customer_name || 'Tanpa Nama'}</span></p>
              <p className="text-on-surface-variant">Item: {orderToDelete.items?.length ?? 0} item ({orderJenisLabel(orderToDelete)})</p>
            </div>
          )}

          <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
            Data pesanan beserta rincian bahannya akan dihapus secara permanen dari database. Tindakan ini tidak dapat dibatalkan.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setOrderToDelete(null)}
              disabled={Boolean(deletingId)}
              className="flex-1 py-3 px-5 rounded-full border border-outline-variant text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmDeleteOrder}
              disabled={Boolean(deletingId)}
              className="flex-1 py-3 px-5 rounded-full bg-error text-on-error font-semibold text-sm shadow-md hover:bg-error/90 hover:shadow-lg active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {deletingId ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Menghapus…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Hapus Permanen
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


function Info({ label, value }) {
  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <span className="block text-on-surface break-words">{value}</span>
    </div>
  );
}
