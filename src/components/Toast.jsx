import { usePlan } from "../hooks/usePlan.js";

// Region aria-live selalu ada di DOM agar screen reader mendeteksinya sejak awal.
// Konten berubah saat ada pesan; sr-only menyembunyikannya secara visual saat kosong.
export function Toast() {
  const { toast } = usePlan();
  const isError = toast.variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={
        toast.message
          ? `fixed left-4 right-4 bottom-above-cta md:left-auto md:right-6 md:bottom-6 z-50 ${isError ? "bg-error" : "bg-primary"} text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in`
          : "sr-only"
      }
    >
      <span
        className={`material-symbols-outlined shrink-0 ${isError ? "text-white" : "text-success-green"}`}
        aria-hidden="true"
      >
        {isError ? "error" : "check_circle"}
      </span>
      <span className="font-medium text-sm">{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={toast.onUndo}
          className="ml-1 text-sm font-bold underline underline-offset-2 text-white/90 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
        >
          Urungkan
        </button>
      )}
    </div>
  );
}
