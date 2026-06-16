import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShopSelfTab } from '../components/ShopSelfTab.jsx';
import { ShopWithUsTab } from '../components/ShopWithUsTab.jsx';
import { SavedListsSection } from '../components/SavedListsSection.jsx';
import { ModalSheet } from '../components/ModalSheet.jsx';
import { usePlan } from '../hooks/usePlan.js';
import {
  saveShoppingList, getSavedShoppingLists, deleteSavedShoppingList,
} from '../services/shoppingListService.js';
import { formatRupiah, formatAmount } from '../utils/buildShoppingList.js';

const SOURCE_LABEL = {
  generate: 'Hasil Generate',
  package: 'Paket Kami',
  planner: 'Rencana Mingguan',
};

function ShoppingList({ weeklyPlan, onGoToPlanner }) {
  const { showToast } = usePlan();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'kami' ? 'us' : 'self');
  const [savedLists, setSavedLists] = useState([]);
  const [viewList, setViewList] = useState(null);
  const [showSavedDrawer, setShowSavedDrawer] = useState(false);

  const refreshSaved = useCallback(() => {
    getSavedShoppingLists()
      .then(setSavedLists)
      .catch(() => {});
  }, []);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  // Tutup drawer otomatis jika semua daftar dihapus
  useEffect(() => {
    if (savedLists.length === 0) {
      queueMicrotask(() => {
        setShowSavedDrawer(false);
      });
    }
  }, [savedLists.length]);

  const handleSave = useCallback(async (payload) => {
    try {
      await saveShoppingList(payload);
      showToast('Daftar belanja tersimpan! 📋');
      refreshSaved();
    } catch (e) {
      showToast(e.message || 'Gagal menyimpan daftar.', { variant: 'error' });
    }
  }, [showToast, refreshSaved]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteSavedShoppingList(id);
      setSavedLists((prev) => prev.filter((l) => l.id !== id));
      showToast('Daftar dihapus.');
    } catch (e) {
      showToast(e.message || 'Gagal menghapus daftar.', { variant: 'error' });
    }
  }, [showToast]);

  return (
    <div className="bg-canvas-white min-h-dvh text-on-surface">
      <main className="max-w-container-max mx-auto px-5 md:px-10 py-8 md:py-12 pb-44 lg:pb-12">
        <header className="mb-6 max-w-3xl animate-fade-in">
          <h1 className="font-headline-xl text-headline-lg md:text-headline-xl text-primary tracking-tight mb-2 leading-tight">
            Belanja
          </h1>
          <p className="text-on-surface-variant text-body-lg">
            Belanja sendiri bahan menumu, atau pesan paket lengkap yang kami siapkan.
          </p>
        </header>

        {/* Tab switcher */}
        <div className="inline-flex p-1 bg-surface-container-low rounded-full mb-8" role="tablist">
          <button role="tab" aria-selected={tab === 'self'} onClick={() => setTab('self')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
              tab === 'self' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}>
            Belanja Sendiri
          </button>
          <button role="tab" aria-selected={tab === 'us'} onClick={() => setTab('us')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
              tab === 'us' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}>
            Belanja di Kami
          </button>
        </div>

        {tab === 'self'
          ? <ShopSelfTab weeklyPlan={weeklyPlan} onGoToPlanner={onGoToPlanner} onSave={handleSave} />
          : <ShopWithUsTab onSave={handleSave} />}

        {/* Daftar tersimpan di bawah konten — tetap ada untuk desktop/scroll */}
        <SavedListsSection lists={savedLists} onDelete={handleDelete} onOpen={setViewList} />
      </main>

      {/* Floating chip — akses cepat daftar tersimpan tanpa scroll */}
      {savedLists.length > 0 && (
        <button
          onClick={() => setShowSavedDrawer(true)}
          aria-label={`Lihat ${savedLists.length} daftar belanja tersimpan`}
          className="fixed right-4 bottom-above-cta z-40 flex items-center gap-2 bg-white border border-outline-variant rounded-full shadow-lg px-4 py-2.5 text-sm font-bold text-on-surface hover:shadow-xl active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-primary text-[20px]">bookmarks</span>
          <span className="hidden sm:inline text-on-surface">Tersimpan</span>
          <span className="min-w-[1.25rem] h-5 flex items-center justify-center bg-primary text-on-primary text-[11px] font-bold px-1.5 rounded-full">
            {savedLists.length}
          </span>
        </button>
      )}

      {/* Drawer: daftar tersimpan (buka dari floating chip) */}
      {showSavedDrawer && (
        <ModalSheet
          onClose={() => setShowSavedDrawer(false)}
          labelledBy="saved-drawer-title"
          panelClassName="max-w-lg max-h-[80dvh] flex flex-col"
        >
          <div className="px-6 pb-6 overflow-y-auto flex-1">
            <h3 id="saved-drawer-title" className="font-headline-md text-headline-md text-primary mb-4 pt-2 flex items-center gap-2">
              <span className="material-symbols-outlined">bookmarks</span>
              Daftar Tersimpan
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {savedLists.map((l) => {
                const items = Array.isArray(l.items_json) ? l.items_json : [];
                return (
                  <div key={l.id} className="rounded-2xl border border-outline-variant bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => { setShowSavedDrawer(false); setViewList(l); }}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <p className="font-semibold text-on-surface text-sm truncate">{l.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {SOURCE_LABEL[l.source_type] || l.source_type} · {items.length} bahan · {formatRupiah(l.total_idr)}
                        </p>
                        <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                          {new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </button>
                      <button
                        onClick={() => handleDelete(l.id)}
                        aria-label="Hapus daftar"
                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/5 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ModalSheet>
      )}

      {/* Modal detail isi daftar tersimpan */}
      {viewList && (
        <ModalSheet onClose={() => setViewList(null)} labelledBy="sl-title" panelClassName="max-w-lg max-h-[85dvh] flex flex-col">
          <div className="p-6 overflow-y-auto">
            <h3 id="sl-title" className="font-headline-md text-headline-md text-primary mb-1">{viewList.title}</h3>
            <p className="text-xs text-on-surface-variant mb-4">
              {(Array.isArray(viewList.items_json) ? viewList.items_json : []).length} bahan · {formatRupiah(viewList.total_idr)}
            </p>
            <ul className="divide-y divide-outline-variant/40">
              {(Array.isArray(viewList.items_json) ? viewList.items_json : []).map((it, i) => (
                <li key={i} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-on-surface">{it.name}</span>
                  <span className="text-sm font-semibold text-on-surface-variant">
                    {formatAmount(it.amount)} {it.unit}
                    {it.priceIdr > 0 && <span className="text-primary ml-2">{formatRupiah(it.priceIdr)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ModalSheet>
      )}
    </div>
  );
}

export default ShoppingList;
