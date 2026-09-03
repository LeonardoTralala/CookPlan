import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPackages } from '../services/packageService.js';
import { getPantryAddons } from '../services/ingredientService.js';
import { getProfile } from '../services/profileService.js';
import { getDeliveryFeeByKecamatan } from '../utils/delivery.js';
import { useSubscription } from '../hooks/useSubscription.js';
import { getFreeShippingStatus } from '../services/subscriptionService.js';
import {
  buildShoppingListFromSlots, slotsFromPackageMeals, flattenSections,
  formatRupiah, formatAmount,
} from '../utils/buildShoppingList.js';
import { pantryStapleKey } from '../utils/pantryStaples.js';
import { usePlan } from '../hooks/usePlan.js';
import { ModalSheet } from './ModalSheet.jsx';

// Tab "Belanja di Kami": pilih paket (menu fiks, bahan kami stok, porsi dasar sesuai admin),
// lihat daftar belanja + harga (agregasi recipe_ingredients), order via WhatsApp.
export function ShopWithUsTab({ onSave }) {
  const { showToast, applySlots, weekStart, restoreSlot } = usePlan();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [freeShippingUsed, setFreeShippingUsed] = useState(0);

  // Katalog bumbu dapur add-on (garam, minyak, dll) + pilihan user. Default KOSONG
  // (opt-in): yang sudah punya di rumah biarkan, yang butuh tinggal centang.
  const [addonCatalog, setAddonCatalog] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState(() => new Set());
  const [applied, setApplied] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);

  // Inisialisasi profil untuk sinkronisasi alamat pengiriman
  useEffect(() => {
    let active = true;
    getProfile()
      .then((p) => { if (active) setProfile(p); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Cek voucher gratis ongkir jika langganan Pro
  useEffect(() => {
    if (subscription?.status === 'active' && subscription?.tier === 'pro') {
      getFreeShippingStatus()
        .then((count) => setFreeShippingUsed(count))
        .catch(() => setFreeShippingUsed(0));
    }
  }, [subscription]);

  // Reset status applied jika ganti paket (derived state pattern)
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId);
  if (selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId);
    setApplied(false);
  }

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

  // Katalog add-on bersifat global (tak tergantung paket) → muat sekali.
  // Gagal muat tidak fatal: section add-on cuma tak muncul.
  useEffect(() => {
    let active = true;
    getPantryAddons()
      .then((data) => { if (active) setAddonCatalog(data); })
      .catch(() => { /* add-on opsional — abaikan kalau gagal */ });
    return () => { active = false; };
  }, []);

  // Ganti paket → reset pilihan add-on (staple yang relevan bisa berbeda).
  const selectPackage = (id) => {
    setSelectedId(id);
    setSelectedAddons(new Set());
  };

  const selected = useMemo(
    () => packages.find((p) => p.id === selectedId) ?? null,
    [packages, selectedId]
  );

  // Porsi paket dikunci ke baseServings yang diatur di dashboard admin (tidak dicustom user)
  const servings = selected?.baseServings && selected.baseServings > 0 ? selected.baseServings : 2;

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

  // Agregasi daftar belanja paket terpilih, skala sesuai porsi dasar paket (dari dashboard admin).
  const { sections, totalItems, estimatedCost, pantryItems } = useMemo(() => {
    if (!selected) return { sections: [], totalItems: 0, estimatedCost: 0, pantryItems: [] };
    const slots = slotsFromPackageMeals(selected.meals, servings);
    return buildShoppingListFromSlots(slots);
  }, [selected, servings]);

  // Add-on yang relevan utk paket ini: staple yang dipakai resep (pantryItems) DAN
  // tersedia di katalog (punya harga kemasan). Dicocokkan via kunci ter-normalisasi.
  const applicableAddons = useMemo(() => {
    if (pantryItems.length === 0 || addonCatalog.length === 0) return [];
    const usedKeys = new Set(pantryItems.map(pantryStapleKey));
    return addonCatalog.filter((a) => usedKeys.has(pantryStapleKey(a.name)));
  }, [pantryItems, addonCatalog]);

  // Item add-on terpilih → baris pesanan (1 kemasan @ harga retail).
  const addonItems = useMemo(
    () => applicableAddons
      .filter((a) => selectedAddons.has(a.id))
      .map((a) => ({
        name: a.name,
        amount: 1,
        unit: a.packLabel || 'pcs',
        category: a.category || 'spices',
        priceIdr: a.packPriceIdr,
      })),
    [applicableAddons, selectedAddons]
  );

  const addonsTotal = useMemo(
    () => addonItems.reduce((s, it) => s + (it.priceIdr || 0), 0),
    [addonItems]
  );

  // Staple yang dipakai tapi tak ada di katalog add-on (mis. penyedap belum
  // berharga) → tetap diberitahukan "siapkan sendiri".
  const selfPrepItems = useMemo(() => {
    const covered = new Set(applicableAddons.map((a) => pantryStapleKey(a.name)));
    return pantryItems.filter((n) => !covered.has(pantryStapleKey(n)));
  }, [pantryItems, applicableAddons]);

  const toggleAddon = (id) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Hitung harga paket: jika admin menginput priceIdr manual (>0), pakai langsung (sudah untuk baseServings).
  // Jika priceIdr 0/null, fallback ke estimatedCost (agregasi bahan resep pada porsi dasar).
  const packageSellingPrice = useMemo(() => {
    if (!selected) return 0;
    if (selected.priceIdr && selected.priceIdr > 0) {
      return Math.round(selected.priceIdr);
    }
    return estimatedCost;
  }, [selected, estimatedCost]);

  const savedKecamatan = profile?.deliveryKecamatan || '';
  const isProActive = subscription?.status === 'active' && subscription?.tier === 'pro';
  const hasFreeShippingVoucher = isProActive && freeShippingUsed < 6;
  const rawDeliveryFee = savedKecamatan ? getDeliveryFeeByKecamatan(savedKecamatan) : null;
  const deliveryFee = hasFreeShippingVoucher ? 0 : rawDeliveryFee;

  const subtotal = packageSellingPrice + addonsTotal;
  const total = subtotal + (deliveryFee ?? 0);

  const handleOrder = () => {
    if (!selected || totalItems === 0) return;
    const items = [
      ...flattenSections(sections).map((it) => ({
        name: it.name, amount: it.amount, unit: it.unit,
        category: it.category, priceIdr: it.priceIdr,
      })),
      ...addonItems,
    ];
    navigate('/order/package', {
      state: {
        items,
        subtotal,
        notes: `Paket: ${selected.name} (${servings} porsi/menu, ${selected.periodeDays} hari)`,
        kecamatan: savedKecamatan,
        deliveryFee: deliveryFee ?? (rawDeliveryFee || 15000),
      }
    });
  };

  const handleSave = () => {
    if (!selected || totalItems === 0) return;
    onSave?.({
      title: `${selected.name} — ${servings} porsi`,
      sourceType: 'package',
      sourceRef: String(selected.id),
      items: [...flattenSections(sections), ...addonItems],
      totalIdr: packageSellingPrice + addonsTotal,
    });
  };

  const handleApplyToPlanner = () => {
    if (!selected || !selected.meals || selected.meals.length === 0) return;
    const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const slots = selected.meals.map((meal) => {
      const dayName = DAYS[meal.dayIndex % 7];
      return {
        recipe: meal.recipe,
        day: dayName,
        mealType: meal.mealType,
        servings: servings,
        weekStart,
      };
    });

    const undoList = applySlots(slots);
    setApplied(true);
    showToast(`${slots.length} menu dari paket "${selected.name}" diterapkan ke planner!`, {
      onUndo: () => {
        for (const u of undoList) restoreSlot(u.day, u.mealType, u.prev, u.weekStart);
        setApplied(false);
        showToast('Penerapan menu paket diurungkan.');
      },
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
      {/* Info pengiriman area terbatas */}
      <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-low px-4 py-2.5 rounded-2xl w-fit">
        <span className="material-symbols-outlined text-primary text-[18px]">info</span>
        <span>Layanan pengiriman CookPlan saat ini baru melayani area <strong>Kota Malang</strong>.</span>
      </div>

      {/* Pemilih paket */}
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
        {packages.map((p) => (
          <button
            key={p.id}
            onClick={() => selectPackage(p.id)}
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
            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-outline-variant/40 gap-1.5">
              <span className="text-[11px] text-primary font-semibold truncate">{p.periodeDays} hari · {p.mealsPerDay}× makan · {p.baseServings || 2} porsi</span>
              <span className="font-bold text-primary text-xs shrink-0">
                {formatRupiah(p.priceIdr > 0 ? p.priceIdr : buildShoppingListFromSlots(slotsFromPackageMeals(p.meals, p.baseServings || 2)).estimatedCost)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Menu paket: user bisa lihat menu fiks per hari, bukan cuma bahan. */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">restaurant_menu</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Menu Paket</h3>
              <span className="ml-auto text-sm text-outline">{mealsByDay.length} hari · {servings} porsi</span>
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

          {/* Bumbu dapur: bahan pokok TIDAK termasuk harga paket (biasanya sudah ada
              di rumah). Ditawarkan sbg ADD-ON OPSIONAL — default mati. User yang dapurnya
              kosong tinggal centang utk dibelikan sekalian di satuan jual terkecil.
              Harga add-on di-derive dari master (pack_size × price_per_base). */}
          {pantryItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="material-symbols-outlined text-primary text-2xl">kitchen</span>
                <h3 className="font-headline-md text-headline-md text-on-surface">Bumbu Dapur</h3>
                <span className="ml-auto text-sm text-outline">opsional</span>
              </div>
              <p className="text-sm text-on-surface-variant mb-3">
                Bahan pokok ini <span className="font-semibold">tidak termasuk paket</span> karena biasanya sudah ada di dapur.
                {applicableAddons.length > 0 && ' Centang yang mau kami belikan sekalian.'}
              </p>

              {applicableAddons.length > 0 && (
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant divide-y divide-outline-variant/40 overflow-hidden">
                  {applicableAddons.map((a) => {
                    const checked = selectedAddons.has(a.id);
                    return (
                      <button key={a.id} onClick={() => toggleAddon(a.id)} aria-pressed={checked}
                        className="w-full text-left flex items-center gap-3 p-4 hover:bg-surface-container-low transition-colors group cursor-pointer">
                        <div className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                          checked ? 'bg-primary border-primary' : 'border-outline-variant group-hover:border-primary'}`}>
                          <span className={`material-symbols-outlined text-sm text-white transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}>check</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-on-surface">{a.name}</span>
                          <span className="block text-xs text-on-surface-variant">1 {a.packLabel}</span>
                        </div>
                        <span className="text-sm font-bold text-primary whitespace-nowrap">+{formatRupiah(a.packPriceIdr)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selfPrepItems.length > 0 && (
                <p className="flex items-start gap-2 text-xs text-on-surface-variant mt-2.5 px-1">
                  <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
                  <span>
                    {applicableAddons.length > 0 ? 'Sisanya disiapkan sendiri ya: ' : 'Disiapkan sendiri ya: '}
                    <span className="text-on-surface">{selfPrepItems.join(', ')}</span>.
                  </span>
                </p>
              )}
            </section>
          )}

          {/* Card untuk Terapkan ke Planner */}
          <div className="bg-primary/[0.04] border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 text-left">
              <h3 className="font-bold text-primary mb-1 flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                Jadwalkan Menu Paket
              </h3>
              <p className="text-xs text-on-surface-variant">
                Terapkan menu paket ini ke Rencana Masak Mingguan Anda secara otomatis.
              </p>
            </div>
            <button
              onClick={() => (applied ? navigate('/planner') : setConfirmApply(true))}
              className={`px-5 py-2.5 rounded-full font-semibold text-xs min-[360px]:text-sm active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 ${
                applied 
                  ? 'bg-white border border-primary text-primary hover:bg-primary/5' 
                  : 'bg-primary text-white hover:opacity-95 shadow-sm'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] min-[360px]:text-[20px]">{applied ? 'event_available' : 'calendar_month'}</span>
              {applied ? 'Lihat Rencana Mingguan' : 'Terapkan ke Planner'}
            </button>
          </div>

          {/* Ringkasan + aksi - disembunyikan di mobile (lihat sticky bar di bawah) */}
          <div className="hidden sm:block bg-surface-cream rounded-2xl p-5 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant font-medium">Paket {selected.name} ({servings} porsi)</span>
              <span className="font-semibold text-on-surface">{formatRupiah(packageSellingPrice)}</span>
            </div>
            {addonsTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Bumbu dapur ({addonItems.length} item)</span>
                <span className="font-semibold text-on-surface">{formatRupiah(addonsTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm items-center">
              <span className="text-on-surface-variant flex items-center gap-1.5">
                <span>Biaya Pengantaran</span>
                {savedKecamatan && (
                  <span className="text-xs text-on-surface-variant">
                    (Kec. {savedKecamatan})
                  </span>
                )}
                {hasFreeShippingVoucher && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full border border-emerald-200">
                    PRO FREE ONGKIR
                  </span>
                )}
              </span>
              {savedKecamatan ? (
                <span className={`font-semibold ${hasFreeShippingVoucher ? 'text-emerald-600 font-bold' : 'text-on-surface'}`}>
                  {hasFreeShippingVoucher ? (
                    <span className="flex items-center gap-1">
                      <span className="line-through text-xs text-on-surface-variant/60 font-normal">
                        {formatRupiah(rawDeliveryFee ?? 15000)}
                      </span>
                      <span>Rp 0</span>
                    </span>
                  ) : (
                    formatRupiah(deliveryFee)
                  )}
                </span>
              ) : (
                <span className="text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                  Belum atur alamat (mulai Rp 5.000)
                </span>
              )}
            </div>

            {/* Banner info alamat tersinkron dari profil */}
            {savedKecamatan ? (
              <div className="flex items-center justify-between text-xs text-on-surface-variant bg-surface-container-low px-3 py-2 rounded-xl">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="material-symbols-outlined text-[16px] text-primary shrink-0">location_on</span>
                  <span className="truncate">Tersinkron profil: <strong>Kec. {savedKecamatan}</strong>{profile?.deliveryDetailAlamat ? ` · ${profile.deliveryDetailAlamat}` : ''}</span>
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/profile?tab=addresses')}
                  className="text-primary hover:underline font-semibold shrink-0 ml-2 cursor-pointer"
                >
                  Ubah
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-amber-900 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0">info</span>
                  <span>Belum ada alamat di profil</span>
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/profile?tab=addresses')}
                  className="text-primary hover:underline font-semibold shrink-0 ml-2 cursor-pointer"
                >
                  Atur Alamat
                </button>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-outline/20">
              <span className="font-bold text-primary">Total</span>
              <span className="font-bold text-primary text-lg">
                {formatRupiah(total)}
                {!savedKecamatan && (
                  <span className="text-xs font-normal text-on-surface-variant ml-1">(+ ongkir)</span>
                )}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex flex-col sm:flex-row gap-3">
            <button onClick={handleSave} disabled={totalItems === 0}
              className="px-5 py-3 border border-primary text-primary rounded-full font-semibold text-sm hover:bg-primary/5 transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">bookmark_add</span>
              Simpan Daftar
            </button>
            <button onClick={handleOrder} disabled={totalItems === 0}
              className="flex-1 px-6 py-3.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">chat</span> Pesan via WhatsApp
            </button>
          </div>
        </>
      )}
    </div>

    {/* Sticky bar mobile: total + CTA melayang di atas nav bawah */}
    {selected && totalItems > 0 && (
      <div className="sm:hidden fixed bottom-above-nav left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-outline-variant shadow-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-xs text-on-surface-variant flex-1 truncate">
            {totalItems} bahan
            {savedKecamatan ? (
              <span className="text-primary font-medium">
                {' · '}Ongkir {hasFreeShippingVoucher ? 'Rp 0' : formatRupiah(deliveryFee)} (Kec. {savedKecamatan})
              </span>
            ) : (
              <span className="text-amber-800 font-medium"> · Ongkir mulai Rp 5.000</span>
            )}
          </span>
          <span className="font-bold text-primary shrink-0">{formatRupiah(total)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={totalItems === 0}
            className="flex-1 py-2.5 border border-primary text-primary rounded-full font-semibold text-sm transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5 active:scale-95">
            <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
            Simpan
          </button>
          <button onClick={handleOrder} disabled={totalItems === 0}
            className="flex-1 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm transition cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5 active:scale-95">
            <span className="material-symbols-outlined text-[18px]">chat</span> Pesan WA
          </button>
        </div>
      </div>
    )}

    {/* Konfirmasi terapkan ke planner */}
    {confirmApply && (
      <ModalSheet onClose={() => setConfirmApply(false)} labelledBy="confirm-apply-title" panelClassName="max-w-md">
        <div className="p-6 pt-4 space-y-5">
          <div className="flex flex-col items-center text-center gap-2">
            <span className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[26px]">calendar_month</span>
            </span>
            <h3 id="confirm-apply-title" className="font-headline-sm text-headline-sm text-on-surface">
              Masuk ke Planner?
            </h3>
            <p className="text-sm text-on-surface-variant">
              Menu ini akan diterapkan ke Rencana Masak Mingguan kamu. Slot yang sudah terisi akan ditimpa.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmApply(false)}
              className="flex-1 px-5 py-3 rounded-full border border-outline-variant text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low active:scale-95 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => { setConfirmApply(false); handleApplyToPlanner(); }}
              className="flex-1 px-5 py-3 rounded-full bg-primary text-on-primary font-semibold text-sm hover:shadow-md active:scale-95 transition cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">check</span>
              Ya, Terapkan
            </button>
          </div>
        </div>
      </ModalSheet>
    )}
    </>
  );
}
