import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { supabase } from '../lib/supabase.js';

export function PageOnboarding({ steps, pageKey, triggerRun, onComplete }) {
  const { isAuthenticated, isAnonymous, user } = useAuth();
  const [trackedPage, setTrackedPage] = useState(pageKey);
  const [lastTriggerRun, setLastTriggerRun] = useState(triggerRun);
  
  // Helper untuk mengecek apakah user sudah pernah melihat onboarding halaman ini
  const hasSeenOnpage = () => {
    if (isAuthenticated && !isAnonymous && user) {
      const dbStatus = user.user_metadata?.onboarding_seen;
      if (dbStatus && dbStatus[pageKey]) return true;
    }
    return localStorage.getItem(`onboarding_seen:${pageKey}`) === 'true';
  };

  const [currentStep, setCurrentStep] = useState(() => {
    return !hasSeenOnpage() ? 0 : -1;
  });
  const [targetRect, setTargetRect] = useState(null);
  const [isVisible, setIsVisible] = useState(() => {
    return !hasSeenOnpage();
  });
  const popoverRef = useRef(null);

  // Sesuaikan state saat data user berubah (terhidrasi secara asinkron)
  const [lastUser, setLastUser] = useState(user);
  if (lastUser !== user) {
    setLastUser(user);
    if (isAuthenticated && !isAnonymous && user) {
      const dbStatus = user.user_metadata?.onboarding_seen;
      if (dbStatus && dbStatus[pageKey]) {
        setIsVisible(false);
        setCurrentStep(-1);
        setTargetRect(null);
      }
    }
  }

  // Sesuaikan state saat pageKey berubah (pola adjust-state-during-render)
  if (trackedPage !== pageKey) {
    setTrackedPage(pageKey);
    const seen = hasSeenOnpage();
    if (!seen) {
      setCurrentStep(0);
      setIsVisible(true);
    } else {
      setCurrentStep(-1);
      setIsVisible(false);
    }
    setTargetRect(null);
  }

  // Sesuaikan state saat triggerRun berubah (pemicu manual dari luar)
  if (lastTriggerRun !== triggerRun) {
    setLastTriggerRun(triggerRun);
    if (triggerRun) {
      setCurrentStep(0);
      setIsVisible(true);
      setTargetRect(null);
    }
  }

  const step = steps[currentStep];

  useEffect(() => {
    if (!isVisible || !step) return;

    const updatePosition = () => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        // Scroll target ke pandangan secara halus
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Ambil koordinat relatif terhadap viewport
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      } else {
        // Jika elemen target tidak ditemukan di halaman, sembunyikan spotlight
        setTargetRect(null);
      }
    };

    // Jalankan segera dan beri delay kecil untuk transisi scroll
    updatePosition();
    const timer = setTimeout(updatePosition, 300);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [currentStep, step, isVisible]);

  if (!isVisible || !step) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleClose = () => {
    // 1. Simpan di localStorage sebagai fallback
    localStorage.setItem(`onboarding_seen:${pageKey}`, 'true');

    // 2. Simpan di database Supabase (metadata user) jika merupakan full user (terautentikasi & bukan guest)
    if (isAuthenticated && !isAnonymous && user) {
      const prevSeen = user.user_metadata?.onboarding_seen ?? {};
      const newSeen = { ...prevSeen, [pageKey]: true };
      supabase.auth.updateUser({
        data: { ...user.user_metadata, onboarding_seen: newSeen }
      }).catch((e) => console.error("Gagal menyimpan metadata onboarding:", e.message));
    }

    setIsVisible(false);
    setCurrentStep(-1);
    setTargetRect(null);
    if (onComplete) onComplete();
  };

  // Hitung posisi popover agar berada di dekat elemen target (viewport-relative)
  const getPopoverStyle = () => {
    if (!targetRect) {
      // Fallback ke tengah layar jika elemen target tidak ditemukan
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 55,
      };
    }

    const space = 12;
    const popoverWidth = 320;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    let left = targetRect.left + (targetRect.width - popoverWidth) / 2;
    // Cek batas kiri & kanan layar
    if (left < 16) left = 16;
    if (left + popoverWidth > screenWidth - 16) {
      left = screenWidth - popoverWidth - 16;
    }

    let top = targetRect.top + targetRect.height + space;

    // Jika ruang di bawah terlalu sempit, taruh di atas target
    if (top + 180 > screenHeight) {
      top = targetRect.top - space - 180; // 180px perkiraan tinggi popover
      if (top < 16) top = 16; // Cek batas atas layar
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      zIndex: 55,
    };
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Dimmed Overlay dengan sorotan spotlight */}
      {targetRect && (
        <div
          className="fixed inset-0 bg-black/60 transition-opacity duration-300 pointer-events-auto"
          style={{
            clipPath: `polygon(
              0% 0%, 0% 100%, 
              ${targetRect.left}px 100%, 
              ${targetRect.left}px ${targetRect.top}px, 
              ${targetRect.left + targetRect.width}px ${targetRect.top}px, 
              ${targetRect.left + targetRect.width}px ${targetRect.top + targetRect.height}px, 
              ${targetRect.left}px ${targetRect.top + targetRect.height}px, 
              ${targetRect.left}px 100%, 
              100% 100%, 100% 0%
            )`,
          }}
          onClick={handleClose}
        />
      )}

      {/* Jika target tidak ada, overlay penuh */}
      {!targetRect && (
        <div className="fixed inset-0 bg-black/60 pointer-events-auto" onClick={handleClose} />
      )}

      {/* Spotlight Border Glow */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: `${targetRect.top - 4}px`,
            left: `${targetRect.left - 4}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
            zIndex: 54,
          }}
          className="border-2 border-primary rounded-xl pointer-events-none animate-pulse shadow-[0_0_15px_#8b5cf6]"
        />
      )}

      {/* Popover Card */}
      <div
        ref={popoverRef}
        style={getPopoverStyle()}
        className="bg-white rounded-3xl p-5 shadow-2xl border border-outline-variant pointer-events-auto transition-all duration-300 animate-fade-in"
      >
        {/* Progress Header */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            Langkah {currentStep + 1} dari {steps.length}
          </span>
          <button 
            onClick={handleClose} 
            className="text-on-surface-variant hover:text-on-surface cursor-pointer inline-flex p-1 rounded-full hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <h3 className="font-bold text-on-surface text-base mb-1.5">{step.title}</h3>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-5">{step.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleClose}
            className="text-xs font-semibold text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
          >
            Lewati
          </button>
          
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-3.5 py-1.5 rounded-full border border-outline-variant hover:bg-surface-container text-xs font-bold text-on-surface cursor-pointer transition"
              >
                Kembali
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-full bg-primary hover:opacity-90 text-on-primary text-xs font-bold shadow-md cursor-pointer transition"
            >
              {currentStep === steps.length - 1 ? 'Selesai' : 'Lanjut'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
