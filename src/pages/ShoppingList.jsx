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

// Halaman Belanja dengan 2 tab (notulen #5):
//   - Belanja Sendiri : daftar dari Weekly Planner (bahan belanja sendiri).
//   - Belanja di Kami : paket menu fiks yang bahannya kami stok → order WA.
// Plus fitur simpan daftar belanja (notulen #13) + daftar tersimpan.
// Query param ?tab=kami → langsung buka tab "Belanja di Kami" dari halaman Generate.
function ShoppingList({ weeklyPlan, onGoToPlanner }) {
  const { showToast } = usePlan();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'kami' ? 'us' : 'self'); // 'self' | 'us'
  const [savedLists, setSavedLists] = useState([]);
  const [viewList, setViewList] = useState(null); // daftar tersimpan yang dibuka

  const refreshSaved = useCallback(() => {
    getSavedShoppingLists()
      .then(setSavedLists)
      .catch(() => { /* opsional, jangan ganggu halaman */ });
  }, []);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

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

        <SavedListsSection lists={savedLists} onDelete={handleDelete} onOpen={setViewList} />
      </main>

      {/* Modal lihat isi daftar tersimpan */}
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
