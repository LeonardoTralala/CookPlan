import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getGeneratedPlanById } from '../services/aiService.js';
import { createOrder, formatRupiah } from '../services/orderService.js';
import { usePlan } from '../hooks/usePlan.js';
import { trackOrderCreated } from '../lib/posthog.js';
import { getProfile, updateProfile } from '../services/profileService.js';

// Fitur 3: Menu Order via WhatsApp. Ambil hasil generate (foodprep/full) → form
// alamat & kontak → buat order (ID CP-...) → buka WhatsApp dengan teks terformat.

export function OrderPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = usePlan();
  const isPackage = planId === 'package';

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: 'malang',
    kecamatan: '',
    detailAddress: '',
    notes: ''
  });
  const [formErr, setFormErr] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let output;
        if (isPackage) {
          output = {
            shopping_list: location.state?.items?.map((it) => ({
              ingredient: it.name,
              total_amount: it.amount,
              unit: it.unit,
              category: it.category,
              estimated_price_idr: it.priceIdr
            })) || [],
            total_estimated_cost: location.state?.subtotal || 0,
            notes: location.state?.notes || ''
          };
        } else {
          const cached = sessionStorage.getItem(`plan_${planId}`);
          const data = cached ? JSON.parse(cached) : null;
          if (data?.plan) {
            output = data.plan;
          } else {
            const row = await getGeneratedPlanById(planId);
            output = row.output_json;
          }
        }

        let profile = null;
        try {
          profile = await getProfile();
        } catch (pe) {
          console.warn('Gagal memuat profil untuk auto-fill:', pe);
        }

        if (!active) return;
        setPlan(output);

        if (profile) {
          setForm((p) => ({
            ...p,
            name: p.name || profile.deliveryCustomerName || profile.fullName || '',
            phone: p.phone || profile.deliveryCustomerPhone || '',
            kecamatan: p.kecamatan || profile.deliveryKecamatan || '',
            detailAddress: p.detailAddress || profile.deliveryDetailAlamat || '',
            city: profile.deliveryKecamatan ? 'malang' : p.city,
          }));
        }
      } catch (e) {
        if (active) setError(e.message || 'Gagal memuat paket.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [planId, isPackage, location.state]);

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
    
    if (form.city === 'malang') {
      if (!form.kecamatan) e.kecamatan = 'Kecamatan wajib dipilih.';
      if (!form.detailAddress.trim()) e.detailAddress = 'Detail alamat wajib diisi.';
    } else {
      e.city = 'Wilayah di luar Kota Malang belum didukung.';
    }
    return e;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFormErr(errs);
      if (errs.city) {
        showToast('Maaf, layanan belanja hanya tersedia di Kota Malang.', { variant: 'error' });
      } else {
        showToast('Lengkapi data pengirimanmu dulu, yuk!', { variant: 'error' });
      }
      return;
    }
    setSubmitting(true);
    try {
      const fullAddress = `${form.detailAddress.trim()}, Kec. ${form.kecamatan}, Kota Malang`;

      const order = await createOrder({
        planId: isPackage ? null : Number(planId),
        outputType: isPackage ? 'package' : 'full',
        items,
        totalPrice: subtotal,
        deliveryFee,
        address: fullAddress,
        name: form.name.trim(),
        phone: form.phone.trim(),
        paymentMethod: null,
        notes: isPackage 
          ? `${plan?.notes || ''}${form.notes.trim() ? ` (Catatan: ${form.notes.trim()})` : ''}` 
          : (form.notes.trim() || null),
      });
      trackOrderCreated(order.id, total, form.paymentMethod);

      try {
        await updateProfile({
          deliveryCustomerName: form.name.trim(),
          deliveryCustomerPhone: form.phone.trim(),
          deliveryKecamatan: form.kecamatan,
          deliveryDetailAlamat: form.detailAddress.trim()
        });
      } catch (pe) {
        console.warn('Gagal menyimpan default alamat pengiriman:', pe);
      }
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
        <p className="text-on-surface-variant text-sm mb-6">{error || 'Rencana makan tidak ditemukan.'}</p>
        <button onClick={() => navigate('/generate')} className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer">
          Buat Rencana Baru
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
          Lengkapi data pengirimanmu. Setelah ini, pesanan akan diteruskan ke admin CookPlan via WhatsApp.
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

      {/* Banner Informasi Area */}
      <div className="bg-surface-cream border border-outline/10 rounded-2xl p-4 flex gap-3 text-on-surface-variant items-center">
        <span className="material-symbols-outlined text-primary text-[24px] shrink-0">location_on</span>
        <p className="text-xs md:text-sm leading-relaxed">
          Layanan pengantaran bahan masakan CookPlan saat ini hanya melayani area <strong>Kota Malang</strong>.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <OrderField id="o-name" label="Nama Penerima" error={formErr.name}>
          <input id="o-name" type="text" value={form.name} onChange={update('name')}
            placeholder="Nama lengkapmu" autoComplete="name" className={inputCls(formErr.name)} />
        </OrderField>
        <OrderField id="o-phone" label="Nomor WhatsApp" error={formErr.phone}>
          <input id="o-phone" type="tel" value={form.phone} onChange={update('phone')}
            placeholder="Contoh: 081234567890" autoComplete="tel" className={inputCls(formErr.phone)} />
        </OrderField>
        <OrderField id="o-city" label="Kota / Kabupaten" error={formErr.city}>
          <select id="o-city" value={form.city} onChange={update('city')} className={inputCls(formErr.city)}>
            <option value="malang">Kota Malang</option>
            <option value="other">Kota Lain (Belum Didukung)</option>
          </select>
        </OrderField>

        {form.city === 'malang' ? (
          <>
            <OrderField id="o-kecamatan" label="Kecamatan" error={formErr.kecamatan}>
              <select id="o-kecamatan" value={form.kecamatan} onChange={update('kecamatan')} className={inputCls(formErr.kecamatan)}>
                <option value="">Pilih Kecamatan</option>
                <option value="Blimbing">Blimbing</option>
                <option value="Klojen">Klojen</option>
                <option value="Kedungkandang">Kedungkandang</option>
                <option value="Lowokwaru">Lowokwaru</option>
                <option value="Sukun">Sukun</option>
              </select>
            </OrderField>
            <OrderField id="o-address" label="Detail Alamat Pengiriman" error={formErr.detailAddress}>
              <textarea id="o-address" value={form.detailAddress} onChange={update('detailAddress')} rows={3}
                placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan" className={inputCls(formErr.detailAddress)} />
            </OrderField>
          </>
        ) : (
          <div className="bg-surface-cream border border-outline/15 rounded-2xl p-5 flex gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-primary shrink-0 text-[24px]">local_shipping</span>
            <div className="text-sm space-y-1.5">
              <p className="font-bold text-primary">Layanan Belum Tersedia di Wilayahmu</p>
              <p className="leading-relaxed text-on-surface-variant text-sm">
                Mohon maaf! Saat ini layanan CookPlan Belanja baru melayani pengantaran untuk wilayah <strong>Kota Malang</strong> saja.
              </p>
              <p className="leading-relaxed text-on-surface-variant/80 text-xs">
                Kamu tetap bisa menyusun menu mingguan dan menggunakan tab <strong>"Belanja Sendiri"</strong> sebagai checklist belanja mandiri saat berbelanja di pasar atau toko lokal terdekatmu.
              </p>
            </div>
          </div>
        )}

        <OrderField id="o-notes" label="Catatan (opsional)">
          <input id="o-notes" type="text" value={form.notes} onChange={update('notes')}
            placeholder="Contoh: Titipkan ke satpam kos" className={inputCls()} />
        </OrderField>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => navigate(-1)} disabled={submitting}
          className="px-6 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm hover:bg-surface-container-low transition cursor-pointer disabled:opacity-50">
          Kembali
        </button>
        {form.city === 'malang' ? (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 px-6 py-3.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {submitting ? (
              <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Memproses pesanan...</>
            ) : (
              <><span className="material-symbols-outlined text-[20px]">chat</span> Pesan via WhatsApp</>
            )}
          </button>
        ) : (
          <button onClick={() => navigate(-1)}
            className="flex-1 px-6 py-3.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer inline-flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[20px]">restaurant_menu</span>
            Kembali ke Rencana Makan
          </button>
        )}
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
