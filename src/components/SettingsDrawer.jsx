import { useEffect, useRef } from 'react';

// Bottom-sheet drawer untuk navigasi Pengaturan di mobile. Slide-up dari bawah,
// kunci scroll body, tutup via Escape / klik overlay / tarik handle. Desktop
// memakai sidebar terpisah, jadi komponen ini hanya dipakai pada viewport kecil.
export function SettingsDrawer({ isOpen, onClose, title = 'Pengaturan', children }) {
  const sheetRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      setTimeout(() => sheetRef.current?.focus(), 10);
    } else {
      document.body.style.overflow = '';
      triggerRef.current?.focus?.();
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:hidden bg-on-surface/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[80dvh] overflow-y-auto bg-canvas-white rounded-t-3xl border-t border-outline-variant outline-none animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        {/* Handle */}
        <div className="sticky top-0 bg-canvas-white pt-3 pb-2">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-outline-variant" aria-hidden="true" />
          <div className="flex items-center justify-between px-5 pt-3">
            <h2 className="font-headline-md text-headline-md text-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full cursor-pointer"
              aria-label="Tutup"
            >
              close
            </button>
          </div>
        </div>
        <div className="px-3 pt-1">{children}</div>
      </div>
    </div>
  );
}
