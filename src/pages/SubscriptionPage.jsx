import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '../hooks/useSubscription.js';
import { createSubscription } from '../services/subscriptionService.js';
import { useAuth } from '../hooks/useAuth.js';
import { buildSimpleWhatsappUrl } from '../services/orderService.js';
import { ModalSheet } from '../components/ModalSheet.jsx';

const formatDate = (dateIso) => {
  if (!dateIso) return '—';
  try {
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(d);
  } catch {
    return '—';
  }
};

export function SubscriptionPage() {
  const { subscription = null, refreshSubscription = () => { }, setShowCelebrationModal } = useSubscription() || {};
  const { isAnonymous = false, user = null } = useAuth() || {};
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingTier, setLoadingTier] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [checkoutSub, setCheckoutSub] = useState(null);
  const isActive = subscription?.status === 'active';
  const activeTier = isActive ? subscription.tier : null;
  const isPending = subscription?.status === 'pending';
  const [userSelectedTier, setUserSelectedTier] = useState(null);
  const selectedTier = userSelectedTier ?? activeTier ?? 'pro';
  const setSelectedTier = setUserSelectedTier;

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      const updated = await refreshSubscription();
      if (updated && updated.status === 'active') {
        setShowCelebrationModal?.(true);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  const quotaExhaustedNotice = location.state?.reason === 'quota_exhausted'
    ? (location.state?.message || 'Kuota 10x AI generate gratis bulan ini telah habis. Silakan berlangganan Paket Digital (CookPass Lite) atau Paket Komplet (CookPass Pro) untuk melanjutkan.')
    : null;

  // Pricing helper
  const getPricing = (tier) => {
    if (tier === 'lite') {
      if (billingCycle === '3months') return { monthly: 9900, total: 29700, original: 11000 };
      if (billingCycle === '6months') return { monthly: 8800, total: 52800, original: 11000 };
      return { monthly: 11000, total: 11000, original: 11000 };
    } else {
      if (billingCycle === '3months') return { monthly: 24900, total: 74700, original: 29000 };
      if (billingCycle === '6months') return { monthly: 19900, total: 119400, original: 29000 };
      return { monthly: 29000, total: 29000, original: 29000 };
    }
  };

  const getSavingsDetails = () => {
    if (billingCycle === '3months') {
      return {
        normal: 180000,
        pro: 74700,
        saved: 105300,
        pct: 58,
        label: '3 Bulan',
      };
    }
    if (billingCycle === '6months') {
      return {
        normal: 360000,
        pro: 119400,
        saved: 240600,
        pct: 67,
        label: '6 Bulan',
      };
    }
    return {
      normal: 60000,
      pro: 29000,
      saved: 31000,
      pct: 52,
      label: 'Bulanan',
    };
  };

  const handleSubscribe = async (tier) => {
    if (isAnonymous) {
      navigate('/auth');
      return;
    }

    if (activeTier === tier || loadingTier === tier) return;

    setLoadingTier(tier);
    setError('');
    try {
      const { id } = await createSubscription(tier);
      await refreshSubscription();

      const pricing = getPricing(tier);
      const baseName = tier === 'lite' ? 'CookPass Lite' : 'CookPass Pro';
      let cycleText = 'Bulanan';
      if (billingCycle === '3months') cycleText = '3 Bulan';
      if (billingCycle === '6months') cycleText = '6 Bulan';

      const message = `Halo Admin CookPlan,\n\nSaya ingin berlangganan paket *${baseName}* dengan durasi *${cycleText}* seharga *Rp ${pricing.total.toLocaleString('id-ID')}*.\n\nMohon informasi instruksi pembayarannya. Terima kasih!\n\n(Kode Subs: SUB-${id})`;
      const waUrl = buildSimpleWhatsappUrl(message);

      setCheckoutSub({
        id,
        tier,
        baseName,
        cycleText,
        totalPrice: pricing.total,
        waUrl
      });
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat memproses langganan.');
    } finally {
      setLoadingTier(null);
    }
  };

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const savings = getSavingsDetails();
  const litePrice = getPricing('lite');
  const proPrice = getPricing('pro');

  return (
    <div className="min-h-screen bg-surface py-8 pb-28 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto space-y-12 animate-fade-in">
      {/* HERO SECTION */}
      <div className="relative bg-gradient-to-tr from-[#1b2b0d] via-[#2d4715] to-[#121f06] text-white rounded-[32px] p-8 md:p-12 shadow-2xl overflow-hidden border border-emerald-500/20">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-80 h-80 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-64 h-64 bg-primary/25 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px] animate-pulse">workspace_premium</span>
            CookPass Premium
          </div>

          <h1 className="font-headline-xl text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Masak Hemat, Bebas Repot <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 via-green-300 to-teal-300 bg-clip-text text-transparent">
              AI Meal Plan & Gratis Ongkir
            </span>
          </h1>

          <p className="text-emerald-100/80 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Nikmati kuota generate AI hingga 30x/bulan, simpan resep & susun rencana masak mingguan tanpa batas, serta gratis ongkir pengantaran bahan masakan langsung ke rumahmu.
          </p>
        </div>
      </div>

      {/* QUOTA EXHAUSTED NOTICE BANNER */}
      {quotaExhaustedNotice && (
        <div className="bg-amber-50 border-2 border-amber-400 text-amber-950 rounded-[28px] p-6 shadow-md flex items-start gap-4 animate-fade-in max-w-4xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-2xl">lock_clock</span>
          </div>
          <div>
            <h3 className="font-extrabold text-base text-amber-950">Kuota 10x AI Generate Gratis Bulan Ini Telah Habis!</h3>
            <p className="text-xs sm:text-sm text-amber-900/90 mt-1 leading-relaxed">
              {quotaExhaustedNotice}
            </p>
          </div>
        </div>
      )}

      {/* ERROR ALERT */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-5 py-3.5 rounded-2xl text-sm flex items-center gap-3 max-w-2xl mx-auto animate-shake">
          <span className="material-symbols-outlined text-rose-500">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* ACTIVE SUBSCRIPTION BANNER */}
      {isActive && subscription && (
        <div className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-emerald-950 to-teal-900 text-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-emerald-500/30 space-y-6">
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-4 flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wide">
                <span className="material-symbols-outlined text-[16px] animate-pulse">verified_user</span>
                MEMBERSHIP AKTIF
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  CookPass {activeTier === 'pro' ? 'Pro' : 'Lite'} VIP
                </h2>
                <p className="text-emerald-300/80 text-xs sm:text-sm">
                  Terima kasih telah menjadi bagian dari CookPlan Premium.
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-emerald-100/70">
                <div>
                  <span className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Berlaku Hingga</span>
                  <span className="font-semibold text-white">
                    {formatDate(subscription.end_date)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Status Akun</span>
                  <span className="font-semibold text-white flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Terverifikasi
                  </span>
                </div>
              </div>
            </div>

            {/* VIP Card Graphic */}
            <div className="w-full max-w-[320px] h-[180px] rounded-2xl bg-gradient-to-tr from-emerald-800/80 via-emerald-950 to-neutral-900 border border-white/20 p-5 shadow-xl relative overflow-hidden flex flex-col justify-between self-center mx-auto md:mx-0 shrink-0">
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div className="w-10 h-8 rounded-md bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 opacity-80 shadow-inner flex items-center justify-center">
                  <div className="w-full h-[1px] bg-amber-800/20" />
                </div>
                <div className="text-right">
                  <span className="text-white font-extrabold text-sm tracking-widest block">COOKPASS</span>
                  <span className="text-[10px] text-emerald-400/80 tracking-widest uppercase block">{activeTier === 'pro' ? 'Pro Member' : 'Lite Member'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-white/60 text-[9px] uppercase tracking-wider block">Pemegang Kartu</span>
                <span className="text-white font-bold text-sm tracking-wide block truncate">
                  {user?.user_metadata?.full_name || user?.user_metadata?.username || user?.email || 'Premium Member'}
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px] text-white/50 border-t border-white/10 pt-2 font-mono">
                <span>VIP-{(subscription.id ?? '').toString().padStart(5, '0')}</span>
                <span className="text-emerald-400 font-bold">COOKPLAN</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PENDING STATUS NOTICE */}
      {isPending && !isActive && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-[32px] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined animate-spin text-2xl">hourglass_empty</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base">Pengajuan Langganan Sedang Diproses</h3>
              <p className="text-xs text-amber-700 mt-1">
                Konfirmasi via WhatsApp sudah dikirim. Admin sedang memverifikasi pembayaranmu.
              </p>
            </div>
          </div>
          <button
            onClick={handleCheckStatus}
            disabled={checkingStatus}
            className="px-5 py-2.5 bg-amber-600 text-white rounded-full text-xs font-bold hover:bg-amber-700 transition cursor-pointer shrink-0 shadow-sm disabled:opacity-60 flex items-center gap-1.5"
          >
            {checkingStatus ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                Mengecek...
              </>
            ) : (
              'Cek Status Terbaru'
            )}
          </button>
        </div>
      )}

      {/* BILLING CYCLE SELECTOR */}
      <div className="flex flex-col items-center space-y-4">
        <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant/80 bg-surface-container-high px-3.5 py-1.5 rounded-full border border-outline-variant/30">
          Siklus Berlangganan
        </span>
        <div className="inline-flex p-1.5 bg-surface-container-high rounded-3xl border border-outline-variant/60 relative">
          {[
            { id: 'monthly', label: 'Bulanan', badge: null },
            { id: '3months', label: '3 Bulan', badge: 'HEMAT 14%' },
            { id: '6months', label: '6 Bulan', badge: 'HEMAT 31%' }
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setBillingCycle(opt.id)}
              className={`relative px-5 py-3 sm:px-6 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 z-10 min-w-[90px] sm:min-w-[110px] ${billingCycle === opt.id
                ? 'text-on-primary bg-primary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`}
            >
              <span>{opt.label}</span>
              {opt.badge && (
                <span className={`text-[8px] tracking-wider px-1.5 py-0.5 rounded-full font-black ${billingCycle === opt.id
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-600/10 text-emerald-800'
                  }`}>
                  {opt.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ROI / SAVINGS CALCULATOR BANNER */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-[32px] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-emerald-200/20 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-3 text-center md:text-left flex-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/10 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px] animate-bounce">calculate</span>
            Kalkulator Hemat
          </div>

          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-on-surface">
            Kenapa Harus <span className="text-primary">CookPass Pro</span>?
          </h3>
          <p className="text-on-surface-variant text-xs sm:text-sm max-w-xl leading-relaxed">
            Ongkir normal belanja di Malang Rp 10.000 x 6 kali pesan/bln = <strong>Rp 60.000/bln</strong>.
            Dengan Paket Pro <strong>{savings.label}</strong>, pengeluaranmu berkurang menjadi Rp {Math.round(savings.pro / (billingCycle === '3months' ? 3 : billingCycle === '6months' ? 6 : 1)).toLocaleString('id-ID')}/bln.
            Total hemat sebesar <strong className="text-emerald-700">Rp {savings.saved.toLocaleString('id-ID')}</strong>!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-5 rounded-2xl border border-outline-variant/60 shadow-sm shrink-0 w-full md:w-auto relative z-10">
          <div className="flex items-center gap-4 justify-between w-full sm:w-auto">
            <div className="text-center px-4 border-r border-outline-variant/40">
              <span className="block text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-wider">Ongkir Normal</span>
              <span className="block text-base font-bold text-slate-400 line-through">Rp {savings.normal.toLocaleString('id-ID')}</span>
            </div>
            <div className="text-center px-4">
              <span className="block text-[10px] uppercase font-bold text-primary tracking-wider">Bayar Pro</span>
              <span className="block text-xl font-black text-primary">Rp {savings.pro.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="bg-emerald-600 text-white font-black text-xs px-4 py-3 rounded-xl text-center flex flex-col items-center justify-center shrink-0 w-full sm:w-auto shadow-md">
            <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Hemat</span>
            <span className="text-lg font-extrabold">{savings.pct}%</span>
          </div>
        </div>
      </div>

      {/* SUBSCRIPTION CARDS GRID */}
      <div className="grid md:grid-cols-2 gap-8 items-stretch">
        {/* LITE PLAN CARD */}
        <div
          onClick={() => setSelectedTier('lite')}
          className={`relative flex flex-col justify-between p-7 sm:p-9 rounded-[32px] transition-all duration-300 cursor-pointer ${selectedTier === 'lite'
            ? 'border-[3.5px] border-emerald-600 ring-8 ring-emerald-600/15 bg-white shadow-2xl scale-[1.01] opacity-100 z-10'
            : 'border-2 border-slate-300/70 bg-white/60 opacity-60 hover:opacity-100 hover:border-emerald-500/50 hover:shadow-lg'
            }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full inline-block mb-2">
                  Paket Digital Only
                </span>
                <h3 className="text-2xl font-black text-on-surface tracking-tight">CookPass Lite</h3>
              </div>
              <span className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${selectedTier === 'lite' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                }`}>
                <span className="material-symbols-outlined text-2xl">menu_book</span>
              </span>
            </div>

            <p className="text-on-surface-variant text-xs sm:text-sm mb-6 leading-relaxed">
              Cocok untuk mahasiswa hemat yang butuh kuota AI melimpah & simpan resep mandiri.
            </p>

            <div className="mb-8 pb-6 border-b border-outline-variant/50">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-on-surface">Rp {litePrice.monthly.toLocaleString('id-ID')}</span>
                <span className="text-on-surface-variant text-sm font-semibold">/ bulan</span>
              </div>
              {billingCycle !== 'monthly' && (
                <p className="text-xs text-emerald-700 font-bold mt-1.5">
                  <span className="line-through text-on-surface-variant/60 mr-1.5 font-medium">Rp 11.000/bln</span>
                  Ditagih Rp {litePrice.total.toLocaleString('id-ID')} untuk {billingCycle === '3months' ? '3' : '6'} bulan
                </p>
              )}
            </div>

            {/* Feature List */}
            <ul className="space-y-4 mb-8">
              <FeatureItem icon="check_circle" iconColor="text-emerald-600" active>
                <strong>30x Generate AI / Bulan</strong> (3x lipat user gratis)
              </FeatureItem>
              <FeatureItem icon="check_circle" iconColor="text-emerald-600" active>
                <strong>Simpan Resep Unlimited</strong> (tanpa batas)
              </FeatureItem>
              <FeatureItem icon="check_circle" iconColor="text-emerald-600" active>
                <strong>Susun Rencana Masak Unlimited</strong> (tanpa batas)
              </FeatureItem>
              <FeatureItem icon="check_circle" iconColor="text-emerald-600" active>
                <strong>Daftar Belanja Otomatis Unlimited</strong> (tanpa batas)
              </FeatureItem>
              <FeatureItem icon="lock" iconColor="text-outline" disabled>
                Voucher Gratis Ongkir (Tarif Pengantaran Normal)
              </FeatureItem>
            </ul>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSubscribe('lite');
            }}
            disabled={loadingTier === 'lite' || activeTier === 'lite'}
            className={`w-full py-4 rounded-full font-bold text-sm transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${activeTier === 'lite'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default shadow-none'
              : selectedTier === 'lite'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 font-black shadow-xl'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-emerald-600 hover:text-white'
              }`}
          >
            {loadingTier === 'lite' ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                Memproses...
              </>
            ) : activeTier === 'lite' ? (
              <>
                <span className="material-symbols-outlined text-[20px]">check</span>
                Paket Aktif Saat Ini
              </>
            ) : (
              <>
                Langganan CookPass Lite
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </div>

        {/* PRO PLAN CARD (HIGHLIGHTED) */}
        <div
          onClick={() => setSelectedTier('pro')}
          className={`relative flex flex-col justify-between p-7 sm:p-9 rounded-[32px] transition-all duration-300 overflow-hidden cursor-pointer ${selectedTier === 'pro'
            ? 'border-[3.5px] border-emerald-600 ring-8 ring-emerald-600/15 bg-white shadow-2xl scale-[1.01] opacity-100 z-10'
            : 'border-2 border-slate-300/70 bg-white/60 opacity-60 hover:opacity-100 hover:border-emerald-500/50 hover:shadow-lg'
            }`}
        >
          {/* Floating Tag */}
          <div className="absolute -top-4 right-8 bg-gradient-to-r from-primary to-emerald-600 text-on-primary px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase shadow-md flex items-center gap-1 z-10 animate-pulse">
            <span className="material-symbols-outlined text-[14px]">star</span>
            Terpopuler
          </div>

          {/* Card glow background blob */}
          <div className="absolute -right-24 -bottom-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full inline-block mb-2">
                  Paket Komplet + Ongkir
                </span>
                <h3 className="text-2xl font-black text-on-surface tracking-tight">CookPass Pro</h3>
              </div>
              <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-colors ${selectedTier === 'pro' ? 'bg-primary text-on-primary' : 'bg-slate-100 text-slate-500'
                }`}>
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
              </span>
            </div>

            <p className="text-on-surface-variant text-xs sm:text-sm mb-6 leading-relaxed">
              Solusi terbaik: Dapatkan akses AI penuh PLUS pengiriman bahan masakan gratis langsung ke rumahmu.
            </p>

            <div className="mb-8 pb-6 border-b border-outline-variant/50">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-primary">Rp {proPrice.monthly.toLocaleString('id-ID')}</span>
                <span className="text-on-surface-variant text-sm font-semibold">/ bulan</span>
              </div>
              {billingCycle !== 'monthly' && (
                <p className="text-xs text-emerald-700 font-bold mt-1.5">
                  <span className="line-through text-on-surface-variant/60 mr-1.5 font-medium">Rp 29.000/bln</span>
                  Ditagih Rp {proPrice.total.toLocaleString('id-ID')} untuk {billingCycle === '3months' ? '3' : '6'} bulan
                </p>
              )}
            </div>

            {/* Feature List */}
            <ul className="space-y-4 mb-8">
              <FeatureItem icon="check_circle" iconColor="text-emerald-600" active>
                <strong>30x Generate AI / Bulan</strong> (3x lipat user gratis)
              </FeatureItem>
              <FeatureItem icon="check_circle" iconColor="text-emerald-600" active>
                <strong>Simpan Resep Unlimited</strong> (tanpa batas)
              </FeatureItem>
              <FeatureItem icon="check_circle" iconColor="text-emerald-600" active>
                <strong>Susun Rencana Masak Unlimited</strong> (tanpa batas)
              </FeatureItem>
              <FeatureItem icon="check_circle" iconColor="text-emerald-600" active>
                <strong>Daftar Belanja Otomatis Unlimited</strong> (tanpa batas)
              </FeatureItem>
              <FeatureItem icon="stars" iconColor="text-amber-500" highlight>
                <strong className="text-emerald-800">Voucher Gratis Ongkir 6x / Bulan</strong> (Area Malang)
              </FeatureItem>
            </ul>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSubscribe('pro');
            }}
            disabled={loadingTier === 'pro' || activeTier === 'pro'}
            className={`w-full py-4 rounded-full font-bold text-sm transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${activeTier === 'pro'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default shadow-none'
              : selectedTier === 'pro'
                ? 'bg-primary text-on-primary hover:bg-primary/95 hover:shadow-xl shimmer-glow'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-primary hover:text-on-primary'
              }`}
          >
            {loadingTier === 'pro' ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                Memproses...
              </>
            ) : activeTier === 'pro' ? (
              <>
                <span className="material-symbols-outlined text-[20px]">check</span>
                Paket Aktif Saat Ini
              </>
            ) : (
              <>
                Langganan CookPass Pro
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* FEATURE COMPARISON TABLE */}
      <div className="bg-white rounded-[32px] border border-outline-variant/60 p-6 sm:p-8 shadow-sm space-y-6 overflow-hidden">
        <div className="text-center space-y-2">
          <h3 className="font-headline-sm text-xl sm:text-2xl font-black text-on-surface tracking-tight">
            Matriks Perbandingan Paket
          </h3>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Bandingkan benefit yang kamu dapatkan pada setiap tingkatan keanggotaan CookPlan.
          </p>
        </div>

        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-outline-variant/60">
                <th className="py-4 px-5 font-bold text-on-surface">Fitur & Benefit</th>
                <th className="py-4 px-5 font-bold text-center text-on-surface-variant">Free Access</th>
                <th className="py-4 px-5 font-bold text-center text-on-surface bg-surface-container/30">CookPass Lite</th>
                <th className="py-4 px-5 font-bold text-center text-primary bg-primary/5 rounded-t-2xl">CookPass Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-5 font-bold text-on-surface">Harga Dasar</td>
                <td className="py-4 px-5 text-center text-on-surface-variant font-medium">Rp 0</td>
                <td className="py-4 px-5 text-center font-bold text-on-surface bg-surface-container/30">Rp 11.000/bln</td>
                <td className="py-4 px-5 text-center font-black text-primary bg-primary/5">Rp 29.000/bln</td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-5 font-medium text-on-surface">Kuota Generate AI</td>
                <td className="py-4 px-5 text-center text-on-surface-variant font-medium">10x / Bulan</td>
                <td className="py-4 px-5 text-center font-bold text-emerald-800 bg-emerald-50/40">
                  30x / Bulan
                </td>
                <td className="py-4 px-5 text-center font-black text-emerald-800 bg-primary/5">
                  30x / Bulan
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-5 font-medium text-on-surface">Simpan Resep Favorit</td>
                <td className="py-4 px-5 text-center text-on-surface-variant font-medium">Maks 10 Resep</td>
                <td className="py-4 px-5 text-center font-bold text-emerald-800 bg-surface-container/30">Unlimited</td>
                <td className="py-4 px-5 text-center font-black text-emerald-800 bg-primary/5">Unlimited</td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-5 font-medium text-on-surface">Susun Rencana Masak Mingguan</td>
                <td className="py-4 px-5 text-center text-on-surface-variant font-medium">Standar</td>
                <td className="py-4 px-5 text-center font-bold text-emerald-800 bg-surface-container/30">Unlimited</td>
                <td className="py-4 px-5 text-center font-black text-emerald-800 bg-primary/5">Unlimited</td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-5 font-medium text-on-surface">Daftar Belanja Otomatis</td>
                <td className="py-4 px-5 text-center text-on-surface-variant font-medium">Standar</td>
                <td className="py-4 px-5 text-center font-bold text-emerald-800 bg-surface-container/30">Unlimited</td>
                <td className="py-4 px-5 text-center font-black text-emerald-800 bg-primary/5">Unlimited</td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-5 font-medium text-on-surface">Gratis Ongkir Pengantaran</td>
                <td className="py-4 px-5 text-center text-on-surface-variant font-medium">—</td>
                <td className="py-4 px-5 text-center text-on-surface-variant bg-surface-container/30 font-medium">—</td>
                <td className="py-4 px-5 text-center font-black text-primary bg-primary/10 rounded-b-2xl">
                  6x / Bulan (Rp 0)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ SECTION */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="font-headline-sm text-xl sm:text-2xl font-black text-on-surface tracking-tight">Pertanyaan Umum (FAQ)</h3>
          <p className="text-xs sm:text-sm text-on-surface-variant">Punya pertanyaan seputar berlangganan CookPass?</p>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="bg-white rounded-2xl border border-outline-variant/60 overflow-hidden shadow-sm hover:border-primary/30 transition-all duration-300">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left font-extrabold text-sm sm:text-base text-on-surface flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-container-lowest transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className={`material-symbols-outlined text-primary text-[20px] shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {isOpen && (
                  <div className="p-4 sm:p-5 pt-0 text-xs sm:text-sm text-on-surface-variant border-t border-outline-variant/30 leading-relaxed bg-surface-container-lowest animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* IN-APP CHECKOUT CONFIRMATION MODAL */}
      {checkoutSub && (
        <ModalSheet onClose={() => setCheckoutSub(null)} labelledBy="checkout-modal-title" panelClassName="max-w-lg">
          <div className="p-6 sm:p-8 space-y-6 text-on-surface">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <span className="material-symbols-outlined text-3xl">receipt_long</span>
              </div>
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-full uppercase tracking-wider">
                Pesanan Berhasil Dicatat
              </span>
              <h2 id="checkout-modal-title" className="text-2xl font-black text-on-surface tracking-tight">
                Konfirmasi Langganan
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant">
                Pesanan langgananmu telah tersimpan. Selesaikan konfirmasi ke Admin untuk mengaktifkan paket.
              </p>
            </div>

            {/* Summary Card */}
            <div className="bg-surface-container-low border border-outline-variant/60 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center text-xs pb-3 border-b border-outline-variant/40">
                <span className="text-on-surface-variant font-medium">Kode Transaksi</span>
                <span className="font-mono font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  SUB-{checkoutSub.id}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant">Paket Pilihan</span>
                <span className="font-extrabold text-on-surface">{checkoutSub.baseName}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant">Siklus Berlangganan</span>
                <span className="font-bold text-on-surface">{checkoutSub.cycleText}</span>
              </div>
              <div className="flex justify-between items-center text-base pt-3 border-t border-outline-variant/40">
                <span className="font-extrabold text-on-surface">Total Tagihan</span>
                <span className="text-xl font-black text-emerald-700">
                  Rp {checkoutSub.totalPrice.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Notice / Instruction */}
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <span className="material-symbols-outlined text-[18px] text-amber-600">info</span>
                Instruksi Pembayaran:
              </div>
              <p className="text-amber-800/90 leading-relaxed">
                Tekan tombol di bawah untuk membuka WhatsApp resmi CookPlan. Admin akan memberikan instruksi transfer / QRIS untuk pengaktifan akun secara instan.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <a
                href={checkoutSub.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setCheckoutSub(null)}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-black text-sm text-center flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[20px]">chat</span>
                Lanjut Konfirmasi via WhatsApp
              </a>

              <button
                type="button"
                onClick={() => setCheckoutSub(null)}
                className="w-full py-3 bg-surface-container-high hover:bg-surface-container text-on-surface-variant font-bold text-xs rounded-full transition-colors cursor-pointer"
              >
                Selesai & Cek Status Nanti
              </button>
            </div>
          </div>
        </ModalSheet>
      )}
    </div>
  );
}

function FeatureItem({ icon, iconColor, disabled, highlight, children }) {
  return (
    <li className="flex items-start gap-3 text-xs sm:text-sm">
      <span className={`material-symbols-outlined shrink-0 text-[20px] transition-colors duration-300 ${disabled ? 'text-on-surface-variant/40' : iconColor}`}>
        {disabled ? 'lock' : icon}
      </span>
      <span className={disabled ? 'text-on-surface-variant/40 line-through font-normal' : highlight ? 'text-on-surface font-semibold' : 'text-on-surface'}>
        {children}
      </span>
    </li>
  );
}

const FAQS = [
  {
    q: 'Bagaimana cara pembayaran berlangganan CookPass?',
    a: 'Setelah menekan tombol "Pilih via WhatsApp", kamu akan diarahkan ke chat WhatsApp resmi CookPlan. Admin kami akan memberikan instruksi pembayaran mudah via E-Wallet (GoPay/OVO/Dana) atau QRIS/Transfer Bank.',
  },
  {
    q: 'Berapa lama langganan aktif setelah pembayaran?',
    a: 'Setelah transfer berhasil dikonfirmasi oleh Admin CookPlan, akun kamu akan langsung aktif sebagai member CookPass selama 30 hari penuh.',
  },
  {
    q: 'Bagaimana cara menggunakan Voucher Gratis Ongkir Paket Pro?',
    a: 'Voucher Gratis Ongkir (6x per bulan) akan otomatis memotong biaya pengantaran menjadi Rp 0 secara otomatis saat kamu melakukan checkout paket belanja bahan di wilayah Kota Malang.',
  },
  {
    q: 'Apakah kuota generate AI dan susun rencana masak mingguan bernilai unlimited?',
    a: 'Pengguna CookPass Lite dan Pro mendapatkan akses 30x generate menu AI setiap bulannya, simpan resep tanpa batas, serta menyusun rencana masak mingguan secara unlimited tanpa batasan.',
  },
];
