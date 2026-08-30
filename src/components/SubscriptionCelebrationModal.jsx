import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal.jsx';

export function SubscriptionCelebrationModal({ isOpen, onClose, subscription }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const isPro = subscription?.tier === 'pro';
  const tierName = isPro ? 'CookPass Pro' : 'CookPass Lite';

  const handleAction = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-[32px] border-2 border-emerald-500/40 p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center space-y-6 animate-scale-up">
        {/* Glow backdrop & festive elements */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-teal-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 via-green-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4 animate-bounce">
            <span className="material-symbols-outlined text-4xl">workspace_premium</span>
          </div>

          <span className="px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider mb-2">
            Status Berlangganan Aktif 👑
          </span>

          <h2 className="text-2xl font-black text-on-surface tracking-tight leading-tight">
            Selamat! Paket <span className="text-primary">{tierName}</span> Kamu Sudah Aktif! 🎉
          </h2>

          <p className="text-on-surface-variant text-xs sm:text-sm mt-2 leading-relaxed max-w-xs">
            Pembayaranmu telah diverifikasi oleh Admin CookPlan. Nikmati semua benefit premium sekarang!
          </p>
        </div>

        {/* Benefit list */}
        <div className="bg-surface-cream/80 border border-emerald-200/70 rounded-2xl p-4 text-left space-y-3 relative z-10">
          <div className="flex items-center gap-2.5 text-xs text-emerald-950 font-medium">
            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">auto_awesome</span>
            <span><strong>30x AI Generate / Bulan</strong> (Menu & Foodprep otomatis)</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-emerald-950 font-medium">
            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">bookmark</span>
            <span><strong>Simpan Resep Unlimited</strong> (Tanpa batas kuota)</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-emerald-950 font-medium">
            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">calendar_month</span>
            <span><strong>Susun Rencana Masak Unlimited</strong> (Bebas atur menu mingguan)</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-emerald-950 font-medium">
            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">shopping_cart</span>
            <span><strong>Daftar Belanja Otomatis Unlimited</strong> (Generasi instan dari planner)</span>
          </div>
          {isPro && (
            <div className="flex items-center gap-2.5 text-xs text-emerald-950 font-medium">
              <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">local_shipping</span>
              <span><strong>Voucher Gratis Ongkir 6x / Bulan</strong> (Area Malang)</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-2.5 relative z-10 pt-2">
          <button
            onClick={() => handleAction('/generate')}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white rounded-full font-black text-sm hover:shadow-xl active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
          >
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            Mulai Susun Menu AI
          </button>

          <button
            onClick={() => handleAction('/catalog')}
            className="w-full py-3 px-5 bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-full font-bold text-xs hover:bg-surface-container transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            Jelajahi Katalog Resep
          </button>
        </div>
      </div>
    </Modal>
  );
}
