import { useState, useEffect } from 'react';
import { ModalSheet } from './ModalSheet.jsx';

// Fungsi untuk mensintesis suara bel 'cling' menggunakan Web Audio API bawaan browser.
const playClingChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Nada 1: Nada dasar bel (frekuensi G5 - 783.99Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    // Nada 2: Nada harmonis C6 - 1046.50Hz (terdengar sedikit setelah nada 1)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.08);
    gain2.gain.setValueAtTime(0.06, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.4);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn('Gagal memutar audio feedback:', err);
  }
};

export function FeedbackCard({ question = "Bagaimana pengalamanmu menggunakan AI Planner hari ini?", category = "saran" }) {
  const [visible, setVisible] = useState(() => {
    const cooldownUntil = localStorage.getItem('feedback_cooldown_until');
    return !cooldownUntil || parseInt(cooldownUntil, 10) <= Date.now();
  });
  const [hoverRating, setHoverRating] = useState(0);
  const [clickedStar, setClickedStar] = useState(null);
  const [burstParticles, setBurstParticles] = useState([]);

  // Putar lonceng cling saat kartu pertama kali dimuat ke layar
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        playClingChime();
      }, 350); // tunggu transisi modal selesai dimuat
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleDismiss = () => {
    // Pengguna memilih untuk menutup atau batal -> Cooldown 7 hari
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('feedback_cooldown_until', (Date.now() + oneWeekMs).toString());
    setVisible(false);
  };

  const handleRate = (rating) => {
    if (clickedStar !== null) return; // cegah double-click

    // Buat partikel percikan kembang api bintang mini di sekeliling bintang yang diklik
    const particles = Array.from({ length: 6 }).map((_, i) => {
      const angle = (i * Math.PI * 2) / 6 + (Math.random() * 0.4 - 0.2);
      const dist = 35 + Math.random() * 20;
      return {
        id: i,
        tx: Math.cos(angle) * dist + 'px',
        ty: Math.sin(angle) * dist + 'px',
        rot: (Math.random() * 60 - 30) + 'deg',
      };
    });

    setBurstParticles(particles);
    setClickedStar(rating);

    // Nada klik pendek untuk penegasan interaksi
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, now); // C6
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (err) {
      console.warn('Gagal memutar audio klik:', err);
    }

    // Beri waktu 550ms agar animasi kembang api selesai sebelum pemicu modal formulir detail
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('trigger-feedback-modal', {
        detail: { rating, category }
      }));
      setVisible(false);
    }, 550);
  };

  if (!visible) return null;

  return (
    <ModalSheet onClose={handleDismiss} labelledBy="feedback-title" panelClassName="max-w-md">
      <div className="p-6 md:p-8 space-y-6 text-center">
        {/* Header Icon dengan efek mengambang/pulse */}
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-[36px] animate-pulse">auto_awesome</span>
        </div>

        {/* Informasi Pertanyaan */}
        <div className="space-y-2">
          <h3 id="feedback-title" className="font-headline-sm text-headline-sm text-primary font-bold">
            {question}
          </h3>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
            Bintang pilihanmu akan membuka lembar masukan detail. Pendapatmu sangat membantu kami!
          </p>
        </div>

        {/* Pemilih Rating Bintang */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="flex items-center gap-1.5 relative">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 cursor-pointer transition-transform hover:scale-125 active:scale-90 relative"
                aria-label={`Beri ${star} bintang`}
              >
                <span
                  className={`material-symbols-outlined text-[36px] transition-colors ${
                    star <= (hoverRating || 0) ? 'fill text-warning' : 'text-outline-variant'
                  }`}
                >
                  star
                </span>

                {/* Tempat merender partikel ledakan bintang saat bintang ini di-klik */}
                {clickedStar === star && burstParticles.map((p) => (
                  <span
                    key={p.id}
                    className="absolute pointer-events-none text-[14px] text-warning animate-particle z-50"
                    style={{
                      left: '50%',
                      top: '50%',
                      '--tx': p.tx,
                      '--ty': p.ty,
                      '--rot': p.rot,
                    }}
                  >
                    ✨
                  </span>
                ))}
              </button>
            ))}
          </div>

          {/* Label ekspresif di bawah bintang */}
          {hoverRating > 0 && (
            <span className="text-xs font-semibold text-primary/80 animate-fade-in h-4">
              {hoverRating === 1 && "Buruk sekali 😢"}
              {hoverRating === 2 && "Kurang memuaskan 🙁"}
              {hoverRating === 3 && "Biasa saja 😐"}
              {hoverRating === 4 && "Bagus! 🙂"}
              {hoverRating === 5 && "Luar biasa! 😍"}
            </span>
          )}
          {!hoverRating && <div className="h-4" />}
        </div>

        {/* Pilihan Tutup */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-3 rounded-full border border-outline-variant text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low active:scale-95 transition-all cursor-pointer"
          >
            Nanti Saja
          </button>
        </div>
      </div>
    </ModalSheet>
  );
}
