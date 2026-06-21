import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGeneratedPlanById } from '../services/aiService.js';
import { createOrder, formatRupiah } from '../services/orderService.js';
import { usePlan } from '../hooks/usePlan.js';

// Fitur 3: Menu Order via WhatsApp. Ambil hasil generate (foodprep/full) → form
// alamat & kontak → buat order (ID CP-...) → buka WhatsApp dengan teks terformat.

export function OrderPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ name: '', phone: '', address: '', paymentMethod: 'cod', notes: '' });
  const [formErr, setFormErr] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = sessionStorage.getItem(`plan_${planId}`);
        const data = cached ? JSON.parse(cached) : null;
        let output;
        if (data?.plan) {
          output = data.plan;
        } else {
          const row = await getGeneratedPlanById(planId);
          output = row.output_json;
        }
        if (!active) return;
        setPlan(output);
      } catch (e) {
        if (active) setError(e.message || 'Gagal memuat paket.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [planId]);

  const update = (field) => (e) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setFormErr((p) => ({ ...p, [field]: undefined }));
  };

  const items = plan?.shopping_list?.map((it) => ({
    name: it.ingredient,
    amount: it.total_amount,
    unit: it.unit,
    category: it.category,
    priceIdr: it.estimated_price_idr,
  })) ?? [];

  const subtotal = plan?.total_estimated_cost ?? 0;
  const deliveryFee = 15000;
  const total = subtotal + deliveryFee;

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Nama wajib diisi.';
    if (!form.phone.trim()) e.phone = 'Nomor WhatsApp wajib diisi.';
    else if (!/^[0-9+\s-]{8,16}$/.test(form.phone.trim())) e.phone = 'Nomor tidak valid.';
    if (!form.address.trim()) e.address = 'Alamat pengiriman wajib diisi.';
    return e;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFormErr(errs);
      showToast('Lengkapi data pengiriman dulu ya.', { variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const order = await createOrder({
        planId: Number(planId),
        outputType: 'full',
        items,
        totalPrice: subtotal,
        deliveryFee,
        address: form.address.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim() || null,
      });
      // Order tersimpan sebagai 'draft'. Arahkan ke layar konfirmasi in-app
      // (bukan langsung wa.me): di sana user menekan "Buka WhatsApp" yang
      // mempromosikan draft → received + membuka WA dgn user-activation bersih.
      navigate(`/order/sukses/${order.id}`, { state: { order, items } });
    } catch (e) {
      showToast(e.message || 'Gagal membuat pesanan.', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-3">progress_activity</span>
        <p className="text-sm">Memuat paket…</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-4">error</span>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Paket Tidak Ditemukan</h1>
        <p className="text-on-surface-variant text-sm mb-6">{error || 'Data tidak ada.'}</p>
        <button onClick={() => navigate('/generate')} className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer">
          Buat Plan Baru
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-7">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl">shopping_cart_checkout</span>
          Pesan Paket Belanja
        </h1>
        <p className="text-on-surface-variant text-body-md">
          Lengkapi data pengiriman. Pesanan diteruskan ke admin CookPlan via WhatsApp.
        </p>
      </div>

      {/* Ringkasan biaya */}
      <div className="bg-surface-cream rounded-2xl p-5 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Total Bahan ({items.length} item)</span>
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

      {/* Form */}
      <div className="space-y-4">
        <OrderField id="o-name" label="Nama Penerima" error={formErr.name}>
          <input id="o-name" type="text" value={form.name} onChange={update('name')}
            placeholder="Nama lengkap" autoComplete="name" className={inputCls(formErr.name)} />
        </OrderField>
        <OrderField id="o-phone" label="Nomor WhatsApp" error={formErr.phone}>
          <input id="o-phone" type="tel" value={form.phone} onChange={update('phone')}
            placeholder="0812xxxxxxxx" autoComplete="tel" className={inputCls(formErr.phone)} />
        </OrderField>
        <OrderField id="o-address" label="Alamat Pengiriman" error={formErr.address}>
          <textarea id="o-address" value={form.address} onChange={update('address')} rows={3}
            placeholder="Jalan, nomor, kecamatan, kota" className={inputCls(formErr.address)} />
        </OrderField>
        <OrderField id="o-payment" label="Metode Pembayaran">
          <select id="o-payment" value={form.paymentMethod} onChange={update('paymentMethod')} className={inputCls()}>
            <option value="cod">Bayar di Tempat (COD)</option>
            <option value="transfer_bank">Transfer Bank</option>
            <option value="qris">QRIS</option>
          </select>
        </OrderField>
        <OrderField id="o-notes" label="Catatan (opsional)">
          <input id="o-notes" type="text" value={form.notes} onChange={update('notes')}
            placeholder="mis. titip ke satpam kos" className={inputCls()} />
        </OrderField>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => navigate(-1)} disabled={submitting}
          className="px-6 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm hover:bg-surface-container-low transition cursor-pointer disabled:opacity-50">
          Kembali
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          className="flex-1 px-6 py-3.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {submitting ? (
            <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Memproses…</>
          ) : (
            <><span className="material-symbols-outlined text-[20px]">chat</span> Pesan via WhatsApp</>
          )}
        </button>
      </div>
    </div>
  );
}

function OrderField({ id, label, error, children }) {
  return (
    <label htmlFor={id} className="block">
      <span className="block text-sm font-semibold text-on-surface mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-xs text-error mt-1">{error}</span>}
    </label>
  );
}

function inputCls(error) {
  return `w-full px-4 py-3 rounded-xl bg-white border text-base ${
    error ? 'border-error' : 'border-outline-variant'
  } text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all`;
}
