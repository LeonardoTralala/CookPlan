// Skeleton loaders untuk state "sedang memuat". Lebih ramah daripada spinner:
// mengurangi kesan lambat & layout-shift karena bentuknya meniru konten asli.
// Animasi pulse otomatis nonaktif saat prefers-reduced-motion (lihat index.css).

function Block({ className = '' }) {
  return <div className={`animate-pulse bg-surface-container-high rounded-lg ${className}`} />;
}

// Grid kartu resep — meniru layout RecipeCatalog.
export function CatalogGridSkeleton({ count = 10 }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Memuat resep…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-container rounded-2xl overflow-hidden recipe-card-shadow flex flex-col">
          <Block className="h-24 sm:h-32 md:h-36 rounded-none" />
          <div className="p-2.5 md:p-3 space-y-2">
            <Block className="h-3.5 w-full" />
            <Block className="h-3.5 w-2/3" />
            <Block className="h-3 w-1/2 mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Daftar belanja — beberapa section kategori dengan baris bahan.
export function ShoppingListSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Memuat daftar belanja…</span>
      {Array.from({ length: 2 }).map((_, s) => (
        <section key={s}>
          <div className="flex items-center gap-3 mb-4">
            <Block className="w-7 h-7 rounded-full" />
            <Block className="h-5 w-40" />
          </div>
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 md:p-5 border-b border-outline-variant last:border-0">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Block className="w-6 h-6 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Block className="h-4 w-1/2" />
                    <Block className="h-3 w-1/4" />
                  </div>
                </div>
                <Block className="h-6 w-16 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// Planner — tab hari (mobile) + slot makan. Dipakai saat plan masih dihidrasi.
export function PlannerSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Memuat rencana mingguan…</span>
      <div className="md:hidden flex gap-2 mb-6 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Block key={i} className="h-9 w-16 rounded-full shrink-0" />
        ))}
      </div>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Block key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
