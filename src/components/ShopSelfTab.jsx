import { useMemo, useState, useEffect } from 'react';
import { getRecipes } from '../services/recipeService.js';
import {
  buildShoppingListFromSlots, buildMenuListFromSlots, slotsFromWeeklyPlan, flattenSections,
  formatRupiah, formatAmount,
} from '../utils/buildShoppingList.js';
import { usePlan } from '../hooks/usePlan.js';
import { ShoppingListSkeleton } from './Skeleton.jsx';

const DELIVERY_FEE = 15000;

// Tab "Belanja Sendiri": daftar belanja dari Weekly Planner (menu hasil generate /
// pilihan sendiri). Bahannya belum tentu kami sediakan → checklist + estimasi,
// tanpa order ke kami. Bisa disimpan sebagai daftar.
// Dua mode tampilan: per-bahan (gabung & checklist) atau per-menu (kelompok resep).
export function ShopSelfTab({ weeklyPlan, onGoToPlanner, onSave }) {
  const { showToast, loading: planLoading } = usePlan();
  // Checklist belanja: MULAI KOSONG (tidak auto-centang). User mencentang sendiri
  // tiap bahan yang sudah diambil/dibeli saat belanja. removedItems = bahan yang
  // dihapus user karena tidak diperlukan (keluar dari daftar & estimasi biaya).
  const [checkedItems, setCheckedItems] = useState(() => new Set());
  const [removedItems, setRemovedItems] = useState(() => new Set());
  // Centang stok bahan dapur (garam/minyak/dll). Murni penanda di layar — TIDAK
  // ikut disimpan, tidak masuk order, tidak memengaruhi biaya.
  const [checkedPantry, setCheckedPantry] = useState(() => new Set());
  const [recipes, setRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [view, setView] = useState('bahan'); // 'bahan' | 'menu'

  useEffect(() => {
    let active = true;
    getRecipes()
      .then((data) => { if (active) setRecipes(data); })
      .catch((err) => {
        console.error('Gagal memuat resep:', err);
        if (active) showToast('Gagal memuat katalog resep. Coba refresh halaman.', { variant: 'error' });
      })
      .finally(() => { if (active) setRecipesLoading(false); });
    return () => { active = false; };
  }, [showToast]);

  // Apakah plan punya slot terisi? Dihitung dari weeklyPlan (tak tergantung resep)
  // supaya bisa membedakan "plan kosong" vs "bahan belum termuat".
  const hasPlannedSlots = useMemo(
    () => Object.values(weeklyPlan ?? {}).some((day) => day && Object.values(day).some(Boolean)),
    [weeklyPlan]
  );

  const recipeIndex = useMemo(() => {
    const m = new Map();
    for (const r of recipes) m.set(r.id, r);
    return m;
  }, [recipes]);

  const slots = useMemo(
    () => slotsFromWeeklyPlan(weeklyPlan, recipeIndex),
    [weeklyPlan, recipeIndex]
  );
  const { sections, totalItems, pantryItems } = useMemo(
    () => buildShoppingListFromSlots(slots),
    [slots]
  );
  const menus = useMemo(() => buildMenuListFromSlots(slots), [slots]);

  // Centang/uncentang bahan (penanda sudah diambil saat belanja).
  const toggleItem = (id) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Centang/uncentang bahan dapur (penanda stok di rumah; tak memengaruhi apa pun).
  const togglePantry = (name) => {
    setCheckedPantry((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // Hapus bahan yang tidak diperlukan: keluar dari daftar & estimasi biaya.
  const removeItem = (id) => {
    setRemovedItems((prev) => new Set(prev).add(id));
    setCheckedItems((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Hitung bahan yang masih ada (tidak dihapus): total, berapa yang sudah dicentang,
  // dan estimasi biaya. Centang TIDAK memengaruhi biaya — hanya penanda progres.
  const { visibleCount, checkedCount, estCost } = useMemo(() => {
    let total = 0;
    let checked = 0;
    let cost = 0;
    for (const section of sections) {
      for (const item of section.items) {
        if (removedItems.has(item.id)) continue;
        total += 1;
        cost += item.priceIdr || 0;
        if (checkedItems.has(item.id)) checked += 1;
      }
    }
    return { visibleCount: total, checkedCount: checked, estCost: Math.round(cost) };
  }, [sections, removedItems, checkedItems]);

  const total = estCost + (visibleCount > 0 ? DELIVERY_FEE : 0);
  const removedCount = totalItems - visibleCount;

  const handleSave = () => {
    // Simpan semua bahan yang tidak dihapus (centang hanya penanda sudah diambil,
    // jadi bahan tercentang tetap ikut tersimpan).
    const keptSections = sections
      .map((s) => ({ ...s, items: s.items.filter((it) => !removedItems.has(it.id)) }))
      .filter((s) => s.items.length > 0);
    const items = flattenSections(keptSections);
    if (items.length === 0) {
      showToast('Tidak ada bahan untuk disimpan.', { variant: 'error' });
      return;
    }
    onSave?.({
      title: `Belanja Sendiri — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`,
      sourceType: 'planner',
      sourceRef: null,
      items,
      totalIdr: estCost,
    });
  };

  // Tampilkan skeleton saat plan masih dihidrasi dari DB, atau saat bahan (resep)
  // belum termuat padahal plan punya slot — mencegah flash "empty-state" yang
  // bikin user bingung mengira rencananya kosong.
  if (planLoading || (recipesLoading && hasPlannedSlots)) {
    return <ShoppingListSkeleton />;
  }

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
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-24 lg:pb-0">
      <div className="lg:col-span-8 space-y-6">
        {/* Toggle tampilan: per bahan (checklist) vs per menu (kelompok resep) */}
        <div className="inline-flex p-1 bg-surface-container-low rounded-full">
          <button onClick={() => setView('bahan')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              view === 'bahan' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}>
            <span className="material-symbols-outlined text-[18px]">checklist</span>
            Per Bahan
          </button>
          <button onClick={() => setView('menu')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              view === 'menu' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}>
            <span className="material-symbols-outlined text-[18px]">restaurant_menu</span>
            Per Menu
          </button>
        </div>

        {/* Petunjuk: checklist belanja — centang sendiri yang sudah diambil, hapus yang tak perlu. */}
        {view === 'bahan' && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-surface-cream/70 border border-outline-variant px-4 py-3 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0">info</span>
            <p>Centang bahan yang <span className="font-semibold text-on-surface">sudah kamu ambil/beli</span> saat belanja. Bahan yang tidak diperlukan bisa <span className="font-semibold text-on-surface">dihapus</span> lewat ikon tempat sampah.</p>
          </div>
        )}

        {/* ---- VIEW PER BAHAN (checklist, group kategori) ---- */}
        {view === 'bahan' && sections.map((section) => {
          const visibleItems = section.items.filter((it) => !removedItems.has(it.id));
          if (visibleItems.length === 0) return null; // semua bahan di seksi ini dihapus
          return (
            <section key={section.key}>
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary text-2xl">{section.meta.icon}</span>
                <h3 className="font-headline-md text-headline-md text-on-surface">{section.meta.label}</h3>
                <span className="ml-auto text-sm font-semibold text-outline">{visibleItems.length} bahan</span>
              </div>
              <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant overflow-hidden recipe-card-shadow">
                {visibleItems.map((item) => {
                  const checked = checkedItems.has(item.id); // sudah diambil saat belanja
                  return (
                    <div key={item.id}
                      className="flex items-stretch border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors group">
                      <button onClick={() => toggleItem(item.id)} aria-pressed={checked}
                        className="flex-1 min-w-0 text-left flex items-center justify-between p-4 md:p-5 cursor-pointer">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                            checked ? 'bg-success-green border-success-green' : 'border-outline-variant group-hover:border-primary'}`}>
                            <span className={`material-symbols-outlined text-sm transition-opacity ${
                              checked ? 'text-white opacity-100' : 'text-primary opacity-0 group-hover:opacity-60'}`}>check</span>
                          </div>
                          <div className="min-w-0">
                            <p className={`font-semibold text-on-surface truncate ${checked ? 'opacity-60' : ''}`}>{item.name}</p>
                            {checked ? (
                              <p className="text-xs text-on-surface-variant italic">Sudah diambil</p>
                            ) : (
                              <p className="text-xs text-on-surface-variant">Beli di: <span className="text-primary font-bold">{section.meta.store}</span></p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-3 flex flex-col items-end gap-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            checked ? 'bg-surface-container-low text-on-surface-variant' : 'bg-surface-cream text-on-surface'}`}>
                            {formatAmount(item.amount)} {item.unit}
                          </span>
                          {item.priceIdr > 0 && (
                            <span className={`text-xs font-bold ${checked ? 'text-on-surface-variant/50' : 'text-primary'}`}>{formatRupiah(Math.round(item.priceIdr))}</span>
                          )}
                        </div>
                      </button>
                      <button onClick={() => removeItem(item.id)} aria-label={`Hapus ${item.name}`} title="Hapus bahan"
                        className="shrink-0 px-4 flex items-center text-on-surface-variant hover:text-error hover:bg-error/5 transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* ---- VIEW PER MENU (kelompok resep) ---- */}
        {view === 'menu' && menus.map((menu) => (
          <section key={menu.recipeId}>
            <div className="flex items-center gap-3 mb-3">
              {menu.imageUrl && (
                <img src={menu.imageUrl} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                  className="w-11 h-11 rounded-xl object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-on-surface truncate">{menu.title}</h3>
                <p className="text-xs text-on-surface-variant">
                  {menu.count}× di plan · {menu.totalServings} porsi total · {menu.items.length} bahan
                </p>
              </div>
              <span className="ml-auto text-sm font-bold text-primary whitespace-nowrap">{formatRupiah(menu.subtotal)}</span>
            </div>
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant overflow-hidden">
              {menu.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-outline-variant/60 last:border-0">
                  <span className="text-sm text-on-surface">{item.name}</span>
                  <div className="text-right shrink-0 pl-3">
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

        {/* ---- BAHAN DAPUR (cek stok di rumah) ---- */}
        {/* Bahan pokok (garam, minyak, dll) dikecualikan dari belanja & biaya karena
            biasanya sudah ada di dapur. Ditampilkan sebagai reminder ringan — centang
            yang stoknya habis. Tidak masuk daftar tersimpan, order, atau estimasi biaya. */}
        {view === 'bahan' && pantryItems.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">kitchen</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Bahan Dapur</h3>
              <span className="ml-auto text-sm font-semibold text-outline">{pantryItems.length} bahan</span>
            </div>
            <div className="flex items-start gap-2.5 rounded-2xl bg-surface-container-low border border-outline-variant px-4 py-3 text-sm text-on-surface-variant mb-3">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0">info</span>
              <p>Bahan ini biasanya <span className="font-semibold text-on-surface">sudah ada di dapur</span>, jadi tidak dihitung ke biaya belanja. Centang yang <span className="font-semibold text-on-surface">stoknya habis</span> biar tidak lupa beli.</p>
            </div>
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant overflow-hidden recipe-card-shadow">
              {pantryItems.map((name) => {
                const checked = checkedPantry.has(name); // stok habis → perlu dibeli
                return (
                  <button key={name} onClick={() => togglePantry(name)} aria-pressed={checked}
                    className="w-full text-left flex items-center gap-4 p-4 md:p-5 border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors group cursor-pointer">
                    <div className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                      checked ? 'bg-success-green border-success-green' : 'border-outline-variant group-hover:border-primary'}`}>
                      <span className={`material-symbols-outlined text-sm transition-opacity ${
                        checked ? 'text-white opacity-100' : 'text-primary opacity-0 group-hover:opacity-60'}`}>check</span>
                    </div>
                    <span className={`font-semibold text-on-surface ${checked ? '' : 'opacity-90'}`}>{name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Disclaimer harga: estimasi, bukan harga final di pasar/toko. */}
        <p className="flex items-start gap-2 rounded-2xl bg-surface-cream/70 border border-outline-variant px-4 py-3 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px] shrink-0">info</span>
          <span>Harga yang tertera adalah harga estimasi, bisa berbeda dari harga sebenarnya di pasar/toko tergantung lokasi, musim, dan ketersediaan bahan.</span>
        </p>
      </div>

      <div className="hidden lg:block lg:col-span-4">
        <div className="sticky top-24 space-y-4">
          <div className="bg-surface-cream p-6 rounded-panel shadow-sm">
            <h3 className="font-headline-md text-headline-md text-primary mb-5">Ringkasan</h3>
            <div className="mb-5">
              <div className="flex justify-between text-xs font-semibold text-on-surface-variant mb-2">
                <span>Sudah dibeli</span>
                <span>{checkedCount} dari {visibleCount}</span>
              </div>
              <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${visibleCount > 0 ? Math.round((checkedCount / visibleCount) * 100) : 0}%` }} />
              </div>
              {removedCount > 0 && (
                <p className="text-xs text-on-surface-variant mt-2">{removedCount} bahan dihapus</p>
              )}
            </div>
            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between"><span className="text-on-surface-variant">Total Bahan</span><span className="font-bold text-on-surface">{visibleCount} item</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Estimasi Biaya</span><span className="font-bold text-on-surface">{formatRupiah(estCost)}</span></div>
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

      {/* Sticky bar mobile: total + CTA melayang di atas nav bawah */}
      <div className="lg:hidden fixed bottom-above-nav left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-outline-variant shadow-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-on-surface-variant leading-tight">{checkedCount} dari {visibleCount} bahan sudah dibeli</p>
            <p className="font-bold text-primary text-base leading-tight">{formatRupiah(total)}</p>
          </div>
          <button onClick={handleSave}
            className="shrink-0 bg-primary text-on-primary px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 active:scale-95 transition cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
            Simpan Daftar
          </button>
        </div>
      </div>
    </>
  );
}
