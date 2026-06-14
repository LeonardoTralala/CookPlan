import { formatRupiah } from '../utils/buildShoppingList.js';

const SOURCE_LABEL = {
  generate: 'Hasil Generate',
  package: 'Paket Kami',
  planner: 'Rencana Mingguan',
};

// Daftar belanja tersimpan milik user (notulen #13). Bisa dibuka (lihat isi) & dihapus.
export function SavedListsSection({ lists, onDelete, onOpen }) {
  if (!lists || lists.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-outline-variant/60">
      <h2 className="font-headline-md text-headline-md text-on-surface mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">bookmarks</span>
        Daftar Tersimpan
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {lists.map((l) => {
          const items = Array.isArray(l.items_json) ? l.items_json : [];
          return (
            <div key={l.id} className="rounded-2xl border border-outline-variant bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => onOpen?.(l)} className="min-w-0 flex-1 text-left cursor-pointer">
                  <p className="font-semibold text-on-surface text-sm truncate">{l.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {SOURCE_LABEL[l.source_type] || l.source_type} · {items.length} bahan · {formatRupiah(l.total_idr)}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                    {new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </button>
                <button onClick={() => onDelete?.(l.id)} aria-label="Hapus daftar"
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/5 transition cursor-pointer">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
