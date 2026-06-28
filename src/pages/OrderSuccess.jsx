import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  getOrderById, confirmOrderSent, buildWhatsappText, buildWhatsappUrl, formatRupiah,
} from '../services/orderService.js';
import { usePlan } from '../hooks/usePlan.js';

// Layar konfirmasi pasca-checkout. Order sudah tersimpan sebagai 'draft'; di sini
// user meninjau ringkasan + ID pesanan, lalu menekan "Buka WhatsApp" untuk
// mengirim ke admin. Klik itu mempromosikan order draft → received (sinyal niat
// kirim) dan baru membuka wa.me — dengan user-activation context yang bersih
// (menghindari popup-blocker yang dulu jadi alasan window.location.href langsung).
export function OrderSuccess() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = usePlan();

  // Data bisa datang lewat navigasi (state) untuk hindari refetch; fallback ke
  // fetch by id (mis. user refresh / buka link langsung).
  const [order, setOrder] = useState(location.state?.order ?? null);
  const [items, setItems] = useState(location.state?.items ?? null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (order) return;
    let active = true;
    getOrderById(orderId)
      .then((row) => {
        if (!active) return;
        setOrder(row);
        setItems(row.items ?? []);
      })
      .catch((e) => { if (active) setError(e.message || 'Pesanan tidak ditemukan.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [order, orderId]);

  const itemList = useMemo(() => items ?? [], [items]);
  const subtotal = order?.total_price ?? 0;
  const deliveryFee = order?.delivery_fee ?? 0;
  const total = subtotal + deliveryFee;

  const waUrl = useMemo(
    () => (order ? buildWhatsappUrl(order) : null),
    [order]
  );

  const handleOpenWhatsapp = async () => {
    if (sending || !order || !waUrl) return;
    setSending(true);
    try {
      // Promosikan draft → received. Best-effort: kalau gagal, tetap buka WA
      // (order sudah tersimpan, admin masih bisa lihat lewat rekonsiliasi).
      await confirmOrderSent(order.id);
    } catch (e) {
      console.error('Gagal konfirmasi order:', e);
    } finally {
      setSending(false);
      window.location.href = waUrl;
    }
  };

  const handleCopy = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(buildWhatsappText(order));
      showToast('Teks pesanan disalin. 📋');
    } catch {
      showToast('Gagal menyalin teks.', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-3">progress_activity</span>
        <p className="text-sm">Memuat pesanan…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-4">error</span>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Pesanan Tidak Ditemukan</h1>
        <p className="text-on-surface-variant text-sm mb-6">{error || 'Data tidak ada.'}</p>
        <button onClick={() => navigate('/shopping')} className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer">
          Kembali ke Belanja
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-7">
      {/* Header sukses */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-4xl">receipt_long</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-primary mb-1">Pesanan Tersimpan</h1>
        <p className="text-on-surface-variant text-body-md">
          ID pesanan kamu: <span className="font-bold text-on-surface">{order.id}</span>
        </p>
      </div>

      {/* Instruksi: belum terkirim sampai buka WhatsApp */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <span className="material-symbols-outlined text-amber-600 shrink-0">info</span>
        <p className="text-sm text-amber-800">
          Pesananmu <strong>belum terkirim</strong> ke admin. Tekan <strong>Buka WhatsApp</strong> di bawah
          untuk mengirim rincian agar pesanan diproses.
        </p>
      </div>

      {/* Ringkasan biaya */}
      <div className="bg-surface-cream rounded-2xl p-5 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Total Bahan ({itemList.length} item)</span>
          <span className="font-semibold text-on-surface">{formatRupiah(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Biaya Pengantaran</span>
          <span className="font-semibold text-on-surface">{formatRupiah(deliveryFee)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-outline/20">
          <span className="font-bold text-primary">Total</span>
          <span className="font-bold text-primary text-lg">{formatRupiah(total)}</span>
        </div>
      </div>

      {/* Rincian item */}
      {itemList.length > 0 && (
        <div className="rounded-2xl border border-outline-variant bg-white divide-y divide-outline-variant/40 overflow-hidden">
          {itemList.map((it, i) => (
            <div key={it.id ?? i} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-on-surface">{it.name}</span>
              <span className="text-on-surface-variant">{it.amount} {it.unit}</span>
            </div>
          ))}
        </div>
      )}

      {/* Aksi */}
      <div className="flex flex-col gap-3">
        <button onClick={handleOpenWhatsapp} disabled={sending}
          className="w-full px-6 py-3.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {sending ? (
            <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Memproses…</>
          ) : (
            <><span className="material-symbols-outlined text-[20px]">chat</span> Buka WhatsApp</>
          )}
        </button>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleCopy}
            className="flex-1 px-5 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm hover:bg-surface-container-low transition cursor-pointer inline-flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[20px]">content_copy</span>
            Salin Pesanan
          </button>
          <button onClick={() => navigate('/profile?tab=orders')}
            className="flex-1 px-5 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm hover:bg-surface-container-low transition cursor-pointer inline-flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            Riwayat Pesanan
          </button>
        </div>
      </div>
    </div>
  );
}
