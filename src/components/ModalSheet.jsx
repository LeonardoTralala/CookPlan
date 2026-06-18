import { useEffect, useRef, useState } from "react";

// Selector elemen yang bisa difokus — dipakai untuk focus-trap.
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Responsive modal shell. Di mobile tampil sebagai bottom sheet (muncul dari
// bawah, ada drag-handle, bisa di-swipe ke bawah untuk menutup); di desktop
// tetap dialog yang berada di tengah layar. Menutup lewat klik backdrop & Escape.
//
// Props:
//   onClose        — dipanggil saat backdrop diklik, Escape ditekan, atau swipe-down.
//   labelledBy     — id elemen judul untuk aria-labelledby.
//   panelClassName — kelas tambahan untuk panel (ukuran maksimum, layout, dsb).
export function ModalSheet({ onClose, labelledBy, panelClassName = "", children }) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef(null);
  const panelRef = useRef(null);

  // Mount-only: kunci scroll body, pindahkan fokus ke dalam dialog saat dibuka,
  // dan kembalikan ke pemicu saat ditutup. Deps [] sengaja — parent kerap kirim
  // onClose inline (berubah tiap render), jadi jangan ikut di effect ini agar
  // fokus tidak "loncat" tiap render.
  useEffect(() => {
    const trigger = document.activeElement;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    // Delay kecil: tunggu animasi slide-up & elemen ter-mount sebelum fokus.
    const t = setTimeout(() => {
      if (!panel) return;
      const focusables = panel.querySelectorAll(FOCUSABLE);
      (focusables[0] ?? panel).focus();
    }, 10);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      if (trigger && typeof trigger.focus === "function") trigger.focus();
    };
  }, []);

  // Escape menutup; Tab/Shift+Tab dijebak agar fokus berputar di dalam dialog.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll(FOCUSABLE);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e) => {
    if (startY.current == null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    if (dragY > 100) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative outline-none bg-white w-full shadow-2xl border border-outline-variant rounded-t-[28px] md:rounded-[32px] animate-slide-up md:animate-fade-in ${panelClassName}`}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {/* Drag-handle — hanya tampil & berfungsi di mobile */}
        <div
          className="md:hidden shrink-0 pt-3 pb-1 flex justify-center touch-none cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-hidden="true"
        >
          <span className="block w-10 h-1.5 rounded-full bg-outline-variant" />
        </div>
        {children}
      </div>
    </div>
  );
}
