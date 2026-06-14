import { useMemo, useState, useEffect } from 'react';
import { getRecipes } from '../services/recipeService.js';
import {
  buildShoppingListFromSlots, slotsFromWeeklyPlan, flattenSections,
  formatRupiah, formatAmount,
} from '../utils/buildShoppingList.js';
import { usePlan } from '../hooks/usePlan.js';

const DELIVERY_FEE = 15000;

// Tab "Belanja Sendiri": daftar belanja dari Weekly Planner (menu hasil generate /
// pilihan sendiri). Bahannya belum tentu kami sediakan → checklist + estimasi,
// tanpa order ke kami. Bisa disimpan sebagai daftar.
export function ShopSelfTab({ weeklyPlan, onGoToPlanner, onSave }) {
  const { showToast } = usePlan();
  const [checkedItems, setCheckedItems] = useState(() => new Set());
  const [recipes, setRecipes] = useState([]);

  useEffect(() => {
    let active = true;
    getRecipes()
      .then((data) => { if (active) setRecipes(data); })
      .catch((err) => {
        console.error('Gagal memuat resep:', err);
        if (active) showToast('Gagal memuat katalog resep. Coba refresh halaman.', { variant: 'error' });
      });
    return () => { active = false; };
  }, [showToast]);

  const recipeIndex = useMemo(() => {
    const m = new Map();
    for (const r of recipes) m.set(r.id, r);
    return m;
  }, [recipes]);

  const { sections, totalItems, estimatedCost } = useMemo(() => {
    const slots = slotsFromWeeklyPlan(weeklyPlan, recipeIndex);
    return buildShoppingListFromSlots(slots);
  }, [weeklyPlan, recipeIndex]);

  const toggleItem = (id) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const total = estimatedCost + (totalItems > 0 ? DELIVERY_FEE : 0);
  const checkedCount = checkedItems.size;

  const handleSave = () => {
    if (totalItems === 0) return;
    onSave?.({
      title: `Belanja Sendiri — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`,
      sourceType: 'planner',
      sourceRef: null,
      items: flattenSections(sections),
      totalIdr: estimatedCost,
    });
  };

  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-surface-cream flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-primary text-4xl">shopping_cart</span>
        </div>
        <h2 className="font-headline-md text-headline-md text-primary mb-2">Belum Ada Menu di Rencana</h2>
        <p className="text-on-surface-variant text-sm max-w-md mb-6">
          Susun menu di Rencana Mingguan, bahan-bahannya otomatis terkumpul di sini.
        </p>
        <button onClick={onGoToPlanner}
          className="bg-primary text-white px-7 py-3.5 rounded-full shadow-lg shadow-primary/30 flex items-center gap-2 active:scale-95 cursor-pointer font-bold">
          <span className="material-symbols-outlined">calendar_month</span>
          Buka Rencana Mingguan
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8 space-y-8">
        {sections.map((section) => (
          <section key={section.key}>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">{section.meta.icon}</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">{section.meta.label}</h3>
              <span className="ml-auto text-sm font-semibold text-outline">{section.items.length} bahan</span>
            </div>
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant overflow-hidden recipe-card-shadow">
              {section.items.map((item) => {
                const checked = checkedItems.has(item.id);
                return (
                  <button key={item.id} onClick={() => toggleItem(item.id)}
                    className="w-full text-left flex items-center justify-between p-4 md:p-5 border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                        checked ? 'bg-success-green border-success-green' : 'border-outline-variant group-hover:border-primary'}`}>
                        <span className={`material-symbols-outlined text-sm transition-opacity ${
                          checked ? 'text-white opacity-100' : 'text-primary opacity-0 group-hover:opacity-60'}`}>check</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold text-on-surface truncate ${checked ? 'line-through opacity-60' : ''}`}>{item.name}</p>
                        <p className="text-xs text-on-surface-variant">Beli di: <span className="text-primary font-bold">{section.meta.store}</span></p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-3 flex flex-col items-end gap-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        checked ? 'bg-success-green/15 text-success-green' : 'bg-surface-cream text-on-surface'}`}>
                        {formatAmount(item.amount)} {item.unit}
                      </span>
                      {item.priceIdr > 0 && (
                        <span className="text-xs font-bold text-primary">{formatRupiah(Math.round(item.priceIdr))}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="lg:col-span-4">
        <div className="sticky top-24 space-y-4">
          <div className="bg-surface-cream p-6 rounded-panel shadow-sm">
            <h3 className="font-headline-md text-headline-md text-primary mb-5">Ringkasan</h3>
            <div className="mb-5">
              <div className="flex justify-between text-xs font-semibold text-on-surface-variant mb-2">
                <span>Progres belanja</span>
                <span>{checkedCount} dari {totalItems} dibeli</span>
              </div>
              <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${Math.round((checkedCount / totalItems) * 100)}%` }} />
              </div>
            </div>
            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between"><span className="text-on-surface-variant">Total Bahan</span><span className="font-bold text-on-surface">{totalItems} item</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Estimasi Biaya</span><span className="font-bold text-on-surface">{formatRupiah(estimatedCost)}</span></div>
              <div className="pt-3 border-t border-outline/20 flex justify-between"><span className="text-lg font-bold text-primary">Total</span><span className="text-lg font-bold text-primary">{formatRupiah(total)}</span></div>
            </div>
            <button onClick={handleSave}
              className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer">
              <span className="material-symbols-outlined">bookmark_add</span>
              Simpan Daftar Belanja
            </button>
            <p className="text-xs text-on-surface-variant text-center mt-3">
              Bahan menu ini kamu belanja sendiri. Mau dibelanjakan kami? Cek tab <span className="font-semibold text-primary">Belanja di Kami</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
