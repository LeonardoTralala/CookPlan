import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Modal } from './Modal.jsx';
import { usePlan } from '../hooks/usePlan.js';
import { submitFeedback, FEEDBACK_CATEGORIES } from '../services/feedbackService.js';

const MAX_MESSAGE_LEN = 2000;

// Label kontekstual mengikuti rating yang dipilih — memberi umpan balik instan.
const RATING_HINTS = {
  1: 'Sangat kurang',
  2: 'Kurang',
  3: 'Cukup',
  4: 'Bagus',
  5: 'Luar biasa!',
};

// Tombol Feedback mengambang + modal. Dipasang sekali di AppShell sehingga
// tersedia di seluruh halaman aplikasi untuk mengumpulkan masukan evaluasi.
export function FeedbackButton() {
  const { pathname } = useLocation();
  const { showToast } = usePlan();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState('saran');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAutoOpened, setIsAutoOpened] = useState(false);
  const [cooldownKey, setCooldownKey] = useState('default');

  const getStorageKey = (key) => key === 'default' ? 'feedback_cooldown_until' : `feedback_cooldown_until_${key}`;

  const resetForm = () => {
    setRating(0);
    setHoverRating(0);
    setCategory('saran');
    setMessage('');
    setCooldownKey('default');
  };

  useEffect(() => {
    const handleTriggerFeedback = (e) => {
      resetForm();
      if (e.detail?.category) {
        setCategory(e.detail.category);
      }
      if (e.detail?.rating) {
        setRating(e.detail.rating);
      }
      if (e.detail?.cooldownKey) {
        setCooldownKey(e.detail.cooldownKey);
      }
      setIsAutoOpened(true);
      setOpen(true);
    };

    window.addEventListener('trigger-feedback-modal', handleTriggerFeedback);
    return () => {
      window.removeEventListener('trigger-feedback-modal', handleTriggerFeedback);
    };
  }, []);

  const openModal = () => {
    resetForm();
    setIsAutoOpened(false);
    setOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setOpen(false);
    if (isAutoOpened) {
      // Pengguna menutup prompt otomatis -> Cooldown 1 minggu (7 hari)
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem(getStorageKey(cooldownKey), (Date.now() + oneWeekMs).toString());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      showToast('Pilih rating 1–5 bintang dulu, ya.', { variant: 'error' });
      return;
    }
    if (message.trim() === '') {
      showToast('Ceritakan sedikit masukanmu, ya.', { variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({ rating, category, message, page: pathname });
      setOpen(false);
      showToast('Terima kasih! Masukanmu sangat berharga bagi perkembangan CookPlan. 🙏');
      // Berhasil kirim -> Cooldown 30 hari agar tidak mengganggu lagi dalam waktu dekat
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      localStorage.setItem(getStorageKey(cooldownKey), (Date.now() + thirtyDaysMs).toString());
    } catch (err) {
      showToast(err.message || 'Gagal mengirim feedback. Coba lagi.', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const activeStars = hoverRating || rating;

  const showFAB = pathname === '/profile';

  return (
    <>
      {/* FAB: di atas bottom-nav pada mobile (bottom-24), pojok kanan di desktop. */}
      {showFAB && (
        <button
          onClick={openModal}
          aria-label="Beri masukan"
          className="fixed right-4 bottom-24 md:right-6 md:bottom-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-on-primary shadow-lg hover:shadow-xl active:scale-95 transition-all px-4 py-3 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">feedback</span>
          <span className="hidden md:inline text-sm font-semibold">Masukan</span>
        </button>
      )}

      <Modal isOpen={open} onClose={closeModal}>
        <form
          onSubmit={handleSubmit}
          className="bg-canvas-white rounded-panel p-8 max-w-md w-full shadow-2xl border border-outline-variant/30 relative space-y-6"
        >
          <button
            type="button"
            onClick={closeModal}
            className="absolute top-4 right-4 material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full cursor-pointer"
            aria-label="Tutup"
          >
            close
          </button>

          <div>
            <h3 className="font-headline-md text-headline-md text-primary">Beri Masukan</h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Pendapatmu sangat membantu kami dalam menyempurnakan CookPlan.
            </p>
          </div>

          {/* Rating bintang */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-on-surface">
              Seberapa puas kamu?
            </span>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating kepuasan">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onFocus={() => setHoverRating(star)}
                  onBlur={() => setHoverRating(0)}
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} bintang`}
                  className="p-1 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                >
                  <span
                    className={`material-symbols-outlined text-[32px] ${
                      star <= activeStars ? 'fill text-warning' : 'text-outline-variant'
                    }`}
                    aria-hidden="true"
                  >
                    star
                  </span>
                </button>
              ))}
              {activeStars > 0 && (
                <span className="ml-2 text-sm font-medium text-on-surface-variant">
                  {RATING_HINTS[activeStars]}
                </span>
              )}
            </div>
          </div>

          {/* Kategori */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-on-surface">Jenis Masukan</span>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_CATEGORIES.map((cat) => {
                const active = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-cream text-on-surface-variant hover:bg-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{cat.icon}</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pesan */}
          <div className="space-y-2">
            <label htmlFor="feedback-message" className="block text-sm font-medium text-on-surface">
              Pesan
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LEN))}
              placeholder="Ceritakan apa yang kamu sukai atau hal yang perlu kami tingkatkan..."
              rows={4}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <p className="text-xs text-on-surface-variant text-right">
              {message.length}/{MAX_MESSAGE_LEN}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={submitting}
              className="px-5 py-3 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-semibold hover:bg-surface-tint transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {submitting ? 'Mengirim...' : 'Kirim Masukan'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
