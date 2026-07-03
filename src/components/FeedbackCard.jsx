import { useState } from 'react';

export function FeedbackCard({ question = "Bagaimana pengalamanmu menggunakan AI Planner hari ini?", category = "saran" }) {
  const [visible, setVisible] = useState(() => {
    const cooldownUntil = localStorage.getItem('feedback_cooldown_until');
    return !cooldownUntil || parseInt(cooldownUntil, 10) <= Date.now();
  });
  const [hoverRating, setHoverRating] = useState(0);

  const handleDismiss = () => {
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('feedback_cooldown_until', (Date.now() + oneWeekMs).toString());
    setVisible(false);
  };

  const handleRate = (rating) => {
    // Pemicu modal masukan global dengan rating terisi
    window.dispatchEvent(new CustomEvent('trigger-feedback-modal', {
      detail: { rating, category }
    }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="bg-surface-cream/80 border border-outline-variant/50 rounded-3xl p-5 relative shadow-sm hover:shadow-md transition-all animate-fade-in flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 material-symbols-outlined text-[18px] text-on-surface-variant/70 hover:bg-surface-variant/20 p-1 rounded-full cursor-pointer transition-colors"
        aria-label="Tutup saran"
      >
        close
      </button>

      <div className="space-y-1 pr-6">
        <h4 className="font-bold text-primary text-sm sm:text-base leading-snug">{question}</h4>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Pilihan bintangmu akan membuka lembar masukan detail. Pendapatmu sangat membantu kami!
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 cursor-pointer transition-transform hover:scale-115 active:scale-90"
            aria-label={`Beri ${star} bintang`}
          >
            <span
              className={`material-symbols-outlined text-[28px] transition-colors ${
                star <= (hoverRating || 0) ? 'fill text-warning' : 'text-outline-variant'
              }`}
            >
              star
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
