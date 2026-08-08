import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../hooks/useSubscription.js';
import { createSubscription } from '../services/subscriptionService.js';
import { useAuth } from '../hooks/useAuth.js';

export function SubscriptionPage() {
  const { subscription, refreshSubscription } = useSubscription();
  const { isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState(null);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  const isActive = subscription?.status === 'active';
  const isPending = subscription?.status === 'pending';
  const activeTier = isActive ? subscription.tier : null;

  const handleSubscribe = async (tier) => {
    if (isAnonymous) {
      navigate('/auth');
      return;
    }

    setLoadingTier(tier);
    setError('');
    try {
      const { waUrl } = await createSubscription(tier);
      await refreshSubscription();
      window.open(waUrl, '_blank');
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat memproses langganan.');
    } finally {
      setLoadingTier(null);
    }
  };

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-surface py-8 pb-28 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto space-y-12">
      {/* HERO SECTION */}
      <div className="relative text-center space-y-4 pt-4">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
          <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
          CookPass Membership · PKM-K 2026
        </div>

        <h1 className="font-headline-lg text-3xl sm:text-4xl md:text-5xl font-extrabold text-on-surface tracking-tight">
          Masak Lebih Hemat, <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-primary via-emerald-600 to-teal-500 bg-clip-text text-transparent">
            AI Meal Plan & Bebas Ongkir
          </span>
        </h1>

        <p className="text-on-surface-variant text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          Nikmati kuota generate AI hingga 30x/bulan, simpan resep tanpa batas, dan gratis ongkir pengantaran bahan masakan langsung ke kos di Malang.
        </p>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-5 py-3.5 rounded-2xl text-sm flex items-center gap-3 max-w-2xl mx-auto animate-shake">
          <span className="material-symbols-outlined text-rose-500">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* ACTIVE SUBSCRIPTION BANNER */}
      {isActive && (
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-900 to-primary text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-500/30 space-y-4">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-emerald-200 text-xs font-bold tracking-wide">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                MEMBERSHIP AKTIF
              </div>
              <h2 className="text-2xl font-bold text-white">
                CookPass {activeTier === 'pro' ? 'Pro' : 'Lite'} VIP Member
              </h2>
              <p className="text-emerald-100/80 text-xs sm:text-sm">
                Berlaku hingga:{' '}
                <span className="font-semibold text-white">
                  {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date(subscription.end_date))}
                </span>
              </p>
            </div>

            <div className="shrink-0 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center">
              <span className="block text-xs text-emerald-200 uppercase tracking-wider font-semibold">Benefit Aktif</span>
              <span className="block text-lg font-extrabold text-white">
                {activeTier === 'pro' ? 'AI 30x + 6x Free Ongkir' : 'AI 30x + Unlimited Resep'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PENDING STATUS NOTICE */}
      {isPending && !isActive && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined animate-spin text-2xl">hourglass_empty</span>
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Pengajuan Langganan Sedang Diproses</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Konfirmasi via WhatsApp sudah dikirim. Admin sedang memverifikasi pembayaranmu.
              </p>
            </div>
          </div>
          <button
            onClick={() => refreshSubscription()}
            className="px-4 py-2 bg-amber-600 text-white rounded-full text-xs font-semibold hover:bg-amber-700 transition cursor-pointer shrink-0"
          >
            Cek Status Terbaru
          </button>
        </div>
      )}

      {/* ROI / SAVINGS CALCULATOR BANNER */}
      <div className="bg-surface-cream border border-outline-variant/60 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="text-xs font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
            Hitung Hemat Kos
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-on-surface">
            Kenapa Harus <span className="text-primary">CookPass Pro</span>?
          </h3>
          <p className="text-on-surface-variant text-xs sm:text-sm max-w-lg">
            Ongkir normal belanja di Malang Rp 10.000 x 6 kali pesan = <strong>Rp 60.000</strong>. Dengan bayar Paket Pro <strong>Rp 29.000/bln</strong>, kamu langsung hemat <strong>Rp 31.000/bulan</strong>!
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-outline-variant/60 shadow-sm shrink-0">
          <div className="text-center px-3 border-r border-outline-variant/40">
            <span className="block text-xs text-on-surface-variant">Ongkir Normal</span>
            <span className="block text-base font-bold text-slate-400 line-through">Rp 60.000</span>
          </div>
          <div className="text-center px-3">
            <span className="block text-xs font-semibold text-primary">Bayar Pro</span>
            <span className="block text-xl font-extrabold text-primary">Rp 29.000</span>
          </div>
          <div className="bg-emerald-500 text-white font-extrabold text-xs px-3 py-2 rounded-xl text-center">
            HEMAT<br />31 RB!
          </div>
        </div>
      </div>

      {/* SUBSCRIPTION CARDS GRID */}
      <div className="grid md:grid-cols-2 gap-8 items-stretch">
        {/* LITE PLAN CARD */}
        <div
          className={`relative flex flex-col justify-between p-7 sm:p-9 rounded-[32px] border-2 transition-all ${
            activeTier === 'lite'
              ? 'border-primary bg-primary/5 shadow-md'
              : 'border-outline-variant/80 bg-white hover:border-primary/40 hover:shadow-lg'
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full inline-block mb-2">
                  Paket Digital
                </span>
                <h3 className="text-2xl font-extrabold text-on-surface">CookPass Lite</h3>
              </div>
              <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">menu_book</span>
              </span>
            </div>

            <p className="text-on-surface-variant text-xs sm:text-sm mb-6">
              Cocok untuk mahasiswa hemat yang cuma butuh kuota AI melimpah & simpan resep mandiri.
            </p>

            <div className="mb-8 pb-6 border-b border-outline-variant/50">
              <span className="text-4xl font-black text-on-surface">Rp 11.000</span>
              <span className="text-on-surface-variant text-sm font-medium"> / bulan</span>
            </div>

            {/* Feature List */}
            <ul className="space-y-4 mb-8">
              <FeatureItem icon="check_circle" iconColor="text-primary" active>
                <strong>30x Generate AI / Bulan</strong> (3x lipat user gratis)
              </FeatureItem>
              <FeatureItem icon="check_circle" iconColor="text-primary" active>
                <strong>Simpan Resep Unlimited</strong> (tanpa batas 10 resep)
              </FeatureItem>
              <FeatureItem icon="check_circle" iconColor="text-primary" active>
                Akses Rekomendasi Menu Hemat Kos
              </FeatureItem>
              <FeatureItem icon="cancel" iconColor="text-outline" disabled>
                Voucher Gratis Ongkir (Tarif Pengantaran Normal)
              </FeatureItem>
            </ul>
          </div>

          <button
            onClick={() => handleSubscribe('lite')}
            disabled={loadingTier === 'lite' || activeTier === 'lite'}
            className={`w-full py-4 rounded-full font-bold text-sm transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
              activeTier === 'lite'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default shadow-none'
                : 'bg-surface-container-high text-on-surface hover:bg-primary hover:text-on-primary'
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
                Pilih Lite via WhatsApp
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </div>

        {/* PRO PLAN CARD (HIGHLIGHTED) */}
        <div
          className={`relative flex flex-col justify-between p-7 sm:p-9 rounded-[32px] border-2 transition-all ${
            activeTier === 'pro'
              ? 'border-primary bg-primary/5 shadow-xl'
              : 'border-primary bg-white shadow-xl hover:shadow-2xl ring-4 ring-primary/10'
          }`}
        >
          {/* Floating Tag */}
          <div className="absolute -top-4 right-8 bg-gradient-to-r from-primary to-emerald-600 text-on-primary px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase shadow-md flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">star</span>
            Paling Komplet & Populer
          </div>

          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full inline-block mb-2">
                  Paket Komplet + Ongkir
                </span>
                <h3 className="text-2xl font-extrabold text-on-surface">CookPass Pro</h3>
              </div>
              <span className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
              </span>
            </div>

            <p className="text-on-surface-variant text-xs sm:text-sm mb-6">
              Solusi ultimate: Dapatkan akses AI penuh PLUS pengiriman bahan gratis langsung ke pintu kos.
            </p>

            <div className="mb-8 pb-6 border-b border-outline-variant/50">
              <span className="text-4xl font-black text-primary">Rp 29.000</span>
              <span className="text-on-surface-variant text-sm font-medium"> / bulan</span>
            </div>

            {/* Feature List */}
            <ul className="space-y-4 mb-8">
              <FeatureItem icon="verified" iconColor="text-primary" active>
                <strong>30x Generate AI / Bulan</strong> (3x lipat user gratis)
              </FeatureItem>
              <FeatureItem icon="verified" iconColor="text-primary" active>
                <strong>Simpan Resep Unlimited</strong> (tanpa batas)
              </FeatureItem>
              <FeatureItem icon="stars" iconColor="text-emerald-600" highlight>
                <strong className="text-primary">Voucher Gratis Ongkir 6x / Bulan</strong> (Khusus area Malang)
              </FeatureItem>
              <FeatureItem icon="verified" iconColor="text-primary" active>
                Prioritas Utama Slot Kurir Internal CookPlan
              </FeatureItem>
            </ul>
          </div>

          <button
            onClick={() => handleSubscribe('pro')}
            disabled={loadingTier === 'pro' || activeTier === 'pro'}
            className={`w-full py-4 rounded-full font-bold text-sm transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
              activeTier === 'pro'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default shadow-none'
                : 'bg-primary text-on-primary hover:bg-primary/90 hover:shadow-xl'
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
                Pilih Pro via WhatsApp
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* FEATURE COMPARISON TABLE */}
      <div className="bg-white rounded-[32px] border border-outline-variant/60 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="text-center space-y-1">
          <h3 className="font-headline-sm text-xl sm:text-2xl font-bold text-on-surface">
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
                <th className="py-3 px-4 font-bold text-on-surface">Fitur & Benefit</th>
                <th className="py-3 px-4 font-bold text-center text-on-surface-variant">Free Access</th>
                <th className="py-3 px-4 font-bold text-center text-on-surface">CookPass Lite</th>
                <th className="py-3 px-4 font-bold text-center text-primary">CookPass Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              <tr>
                <td className="py-3.5 px-4 font-medium text-on-surface">Harga Berlangganan</td>
                <td className="py-3.5 px-4 text-center font-bold text-on-surface-variant">Rp 0</td>
                <td className="py-3.5 px-4 text-center font-bold text-on-surface">Rp 11.000/bln</td>
                <td className="py-3.5 px-4 text-center font-bold text-primary">Rp 29.000/bln</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-on-surface">Kuota Generate AI</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">10x / Bulan</td>
                <td className="py-3.5 px-4 text-center font-bold text-emerald-700 bg-emerald-50/50 rounded-lg">
                  30x / Bulan
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-emerald-700 bg-emerald-50/50 rounded-lg">
                  30x / Bulan
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-on-surface">Simpan Resep Favorit</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">Maks 10 Resep</td>
                <td className="py-3.5 px-4 text-center font-bold text-emerald-700">Unlimited</td>
                <td className="py-3.5 px-4 text-center font-bold text-emerald-700">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-on-surface">Gratis Ongkir Pengantaran</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">—</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">—</td>
                <td className="py-3.5 px-4 text-center font-bold text-primary bg-primary/10 rounded-lg">
                  6x / Bulan (Rp 0)
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-on-surface">Prioritas Slot Kurir</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">Standar</td>
                <td className="py-3.5 px-4 text-center text-on-surface">Ya</td>
                <td className="py-3.5 px-4 text-center font-bold text-primary">Prioritas Utama</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ SECTION */}
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h3 className="font-headline-sm text-xl sm:text-2xl font-bold text-on-surface">Pertanyaan Umum (FAQ)</h3>
          <p className="text-xs sm:text-sm text-on-surface-variant">Punya pertanyaan seputar berlangganan CookPass?</p>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="bg-white rounded-2xl border border-outline-variant/60 overflow-hidden">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left font-bold text-sm sm:text-base text-on-surface flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-container-lowest transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
                    {isOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {isOpen && (
                  <div className="p-4 sm:p-5 pt-0 text-xs sm:text-sm text-on-surface-variant border-t border-outline-variant/30 leading-relaxed bg-surface-container-lowest">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, iconColor, disabled, highlight, children }) {
  return (
    <li className="flex items-start gap-3 text-xs sm:text-sm">
      <span className={`material-symbols-outlined shrink-0 text-[20px] ${iconColor}`}>{icon}</span>
      <span className={disabled ? 'text-on-surface-variant/60 line-through' : highlight ? 'text-on-surface font-medium' : 'text-on-surface'}>
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
    q: 'Apakah kuota generate AI bernilai 30x per bulan?',
    a: 'Ya! Pengguna CookPass Lite dan Pro mendapatkan akses 30x generate menu AI setiap bulannya (3x lipat dibanding batas user gratis).',
  },
];
