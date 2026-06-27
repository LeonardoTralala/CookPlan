import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPackages } from '../services/packageService.js';
import { createOrder } from '../services/orderService.js';
import {
  buildShoppingListFromSlots, slotsFromPackageMeals, flattenSections,
  formatRupiah, formatAmount,
} from '../utils/buildShoppingList.js';
import { usePlan } from '../hooks/usePlan.js';

const DELIVERY_FEE = 15000;

// Tab "Belanja di Kami": pilih paket (menu fiks, bahan kami stok), atur porsi,
// lihat daftar belanja + harga (agregasi recipe_ingredients), order via WhatsApp.
export function ShopWithUsTab({ onSave }) {
  const { showToast } = usePlan();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [servings, setServings] = useState(2);
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    let active = true;
    getPackages()
      .then((data) => {
        if (!active) return;
        setPackages(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((e) => { if (active) showToast(e.message || 'Gagal memuat paket.', { variant: 'error' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showToast]);

  const selected = useMemo(
    () => packages.find((p) => p.id === selectedId) ?? null,
    [packages, selectedId]
  );

  const mealsByDay = useMemo(() => {
    const grouped = new Map();
    for (const meal of selected?.meals ?? []) {
      const day = meal.dayIndex ?? 0;
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day).push(meal);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([dayIndex, meals]) => ({ dayIndex, meals }));
  }, [selected]);

  // Agregasi daftar belanja paket terpilih, skala sesuai porsi yang diminta.
  const { sections, totalItems, estimatedCost } = useMemo(() => {
    if (!selected) return { sections: [], totalItems: 0, estimatedCost: 0 };
    const slots = slotsFromPackageMeals(selected.meals, servings);
    return buildShoppingListFromSlots(slots);
  }, [selected, servings]);

  const total = estimatedCost + (totalItems > 0 ? DELIVERY_FEE : 0);

  const handleOrder = async () => {
    if (ordering || !selected || totalItems === 0) return;
    setOrdering(true);
    try {
      const items = flattenSections(sections).map((it) => ({
        name: it.name, amount: it.amount, unit: it.unit,
        category: it.category, priceIdr: it.priceIdr,
      }));
      const order = await createOrder({
        planId: null,
        outputType: 'package',
        items,
        totalPrice: estimatedCost,
        deliveryFee: DELIVERY_FEE,
        notes: `Paket: ${selected.name} (${servings} porsi/menu, ${selected.periodeDays} hari)`,
      });
      // Order tersimpan sebagai 'draft' → ke layar konfirmasi in-app. User
      // menekan "Buka WhatsApp" di sana (promosi draft → received + buka WA).
      navigate(`/order/sukses/${order.id}`, { state: { order, items } });
    } catch (e) {
      showToast(e.message || 'Gagal membuat pesanan.', { variant: 'error' });
    } finally {
      setOrdering(false);
    }
  };

  const handleSave = () => {
    if (!selected || totalItems === 0) return;
    onSave?.({
      title: `${selected.name} — ${servings} porsi`,
      sourceType: 'package',
      sourceRef: String(selected.id),
      items: flattenSections(sections),
      totalIdr: estimatedCost,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-3">progress_activity</span>
        <p className="text-sm">Memuat paket…</p>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="text-center py-16 text-on-surface-variant">
        <span className="material-symbols-outlined text-5xl text-primary mb-3">inventory_2</span>
        <p className="text-sm">Belum ada paket bahan yang tersedia. Periksa kembali nanti, ya!</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 pb-32 sm:pb-0">
      {/* Pemilih paket */}
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
        {packages.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            className={`shrink-0 text-left rounded-2xl border p-4 w-56 transition-all cursor-pointer ${
              p.id === selectedId
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-outline-variant hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {(p.badges ?? []).map((b) => (
                <span key={b} className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full">{b}</span>
              ))}
            </div>
            <p className="font-bold text-on-surface text-sm">{p.name}</p>
            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{p.description}</p>
            <p className="text-xs text-primary font-semibold mt-2">{p.periodeDays} hari · {p.mealsPerDay}× makan/hari</p>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Stepper porsi */}
          <div className="flex items-center justify-between bg-surface-container-low rounded-2xl p-4">
            <div>
              <p className="font-semibold text-on-surface text-sm">Porsi per Menu</p>
              <p className="text-xs text-on-surface-variant">Sesuaikan dengan jumlah anggota keluarga atau porsi makanmu.</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Kurangi porsi"
                className="w-10 h-10 rounded-xl bg-white border border-outline-variant flex items-center justify-center text-primary cursor-pointer active:scale-95 transition">
                <span className="material-symbols-outlined">remove</span>
              </button>
              <span className="font-bold text-lg text-primary w-10 text-center" aria-live="polite">{servings}</span>
              <button onClick={() => setServings((s) => Math.min(20, s + 1))} aria-label="Tambah porsi"
                className="w-10 h-10 rounded-xl bg-white border border-outline-variant flex items-center justify-center text-primary cursor-pointer active:scale-95 transition">
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>

          {/* Menu paket: user bisa lihat menu fiks per hari, bukan cuma bahan. */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">restaurant_menu</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Menu Paket</h3>
              <span className="ml-auto text-sm text-outline">{mealsByDay.length} hari</span>
            </div>
            <div className="space-y-3">
              {mealsByDay.map(({ dayIndex, meals }) => (
                <div key={dayIndex} className="rounded-2xl border border-outline-variant bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-surface-cream text-primary font-bold text-sm">
                    Hari {dayIndex + 1}
                  </div>
                  <div className="divide-y divide-outline-variant/50">
                    {meals.map((meal) => (
                      <div key={`${dayIndex}-${meal.mealType}`} className="flex items-center gap-3 p-3">
                        {meal.recipe?.imageUrl && (
                          <img
                            src={meal.recipe.imageUrl}
                            alt=""
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                            className="w-12 h-12 rounded-xl object-cover shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                            {meal.mealType === 'breakfast' ? 'Sarapan' : meal.mealType === 'lunch' ? 'Makan Siang' : 'Makan Malam'}
                          </span>
                          <span className="block text-sm font-semibold text-on-surface truncate">
                            {meal.recipe?.title || `Resep #${meal.recipe?.id}`}
                          </span>
                        </div>
                        <span className="text-xs text-primary font-bold whitespace-nowrap">{servings} porsi</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Daftar belanja paket */}
          {sections.map((section) => (
            <section key={section.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-2xl">{section.meta.icon}</span>
                <h3 className="font-headline-md text-headline-md text-on-surface">{section.meta.label}</h3>
                <span className="ml-auto text-sm text-outline">{section.items.length} bahan</span>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant divide-y divide-outline-variant/40 overflow-hidden">
                {section.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4">
                    <span className="text-sm text-on-surface">{item.name}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-on-surface">{formatAmount(item.amount)} {item.unit}</span>
                      {item.priceIdr > 0 && (
                        <span className="block text-xs text-primary font-bold">{formatRupiah(Math.round(item.priceIdr))}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Ringkasan + aksi - disembunyikan di mobile (lihat sticky bar di bawah) */}
          <div className="hidden sm:block bg-surface-cream rounded-2xl p-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Total Bahan ({totalItems} item)</span>
              <span className="font-semibold text-on-surface">{formatRupiah(estimatedCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Biaya Pengantaran</span>
              <span className="font-semibold text-on-surface">{formatRupiah(DELIVERY_FEE)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-outline/20">
              <span className="font-bold text-primary">Total</span>
              <span className="font-bold text-primary text-lg">{formatRupiah(total)}</span>
            </div>
          </div>

          <div className="hidden sm:flex flex-col sm:flex-row gap-3">
            <button onClick={handleSave} disabled={totalItems === 0}
              className="px-5 py-3 border border-primary text-primary rounded-full font-semibold text-sm hover:bg-primary/5 transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">bookmark_add</span>
              Simpan Daftar
            </button>
            <button onClick={handleOrder} disabled={ordering || totalItems === 0}
              className="flex-1 px-6 py-3.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {ordering ? (
                <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Memproses…</>
              ) : (
                <><span className="material-symbols-outlined text-[20px]">chat</span> Pesan via WhatsApp</>
              )}
            </button>
          </div>
        </>
      )}
    </div>

    {/* Sticky bar mobile: total + CTA melayang di atas nav bawah */}
    {selected && totalItems > 0 && (
      <div className="sm:hidden fixed bottom-above-nav left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-outline-variant shadow-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-xs text-on-surface-variant flex-1">{totalItems} bahan</span>
          <span className="font-bold text-primary">{formatRupiah(total)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={totalItems === 0}
            className="flex-1 py-2.5 border border-primary text-primary rounded-full font-semibold text-sm transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5 active:scale-95">
            <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
            Simpan
          </button>
          <button onClick={handleOrder} disabled={ordering || totalItems === 0}
            className="flex-1 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm transition cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5 active:scale-95">
            {ordering ? (
              <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Proses…</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">chat</span> Pesan WA</>
            )}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
