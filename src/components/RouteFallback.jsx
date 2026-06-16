// Fallback Suspense untuk route yang di-lazy-load (code-splitting). Spinner
// ringan; `variant="page"` untuk halaman publik penuh, "content" untuk area
// dalam AppShell (nav tetap terlihat saat konten dimuat).
export function RouteFallback({ variant = "page" }) {
  const wrap =
    variant === "content"
      ? "flex items-center justify-center py-24"
      : "min-h-dvh flex items-center justify-center bg-canvas-white";
  return (
    <div className={wrap}>
      <span className="material-symbols-outlined animate-spin text-3xl text-primary" aria-hidden="true">
        progress_activity
      </span>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
