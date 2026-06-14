import { useState, useMemo, useEffect } from 'react';
import { getRecipes } from '../services/recipeService.js';
import { usePlan } from '../hooks/usePlan.js';
import { ModalSheet } from '../components/ModalSheet.jsx';

// Hari (key data) + label singkat untuk header kolom
const DAYS = [
  { key: 'Senin', short: 'Sen' },
  { key: 'Selasa', short: 'Sel' },
  { key: 'Rabu', short: 'Rab' },
  { key: 'Kamis', short: 'Kam' },
  { key: 'Jumat', short: 'Jum' },
  { key: 'Sabtu', short: 'Sab' },
  { key: 'Minggu', short: 'Min' }
];

const MEALS = [
  { key: 'breakfast', label: 'Sarapan' },
  { key: 'lunch', label: 'Makan Siang' },
  { key: 'dinner', label: 'Makan Malam' }
];


// Tanggal Senin–Minggu pada minggu berjalan (berdasarkan tanggal hari ini)
function getWeekDates() {
  const today = new Date();
  const dow = today.getDay(); // 0 = Minggu ... 6 = Sabtu
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  return DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getDate();
  });
}


function WeeklyPlanner({ weeklyPlan, onSetSlot, onRemoveSlot, onGoToCatalog, onGoToGenerate, onGenerateShoppingList }) {
  const { showToast, restoreSlot } = usePlan();

  // Slot yang sedang diisi: { day, meal } | null
  const [pickerTarget, setPickerTarget] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelectedRecipe, setPickerSelectedRecipe] = useState(null);
  const [pickerServings, setPickerServings] = useState(2);
  const [activeMobileDay, setActiveMobileDay] = useState(DAYS[0].key);

  // Bank resep dari DB (untuk picker & rekomendasi).
  const [recipes, setRecipes] = useState([]);
  useEffect(() => {
    let active = true;
    getRecipes()
      .then((data) => { if (active) setRecipes(data); })
      .catch((err) => {
        // Audit Copilot: kegagalan jangan silent — log supaya bisa didiagnosis,
        // UI fallback tetap aman karena setRecipes default []
        console.error("Gagal memuat resep:", err);
      });
    return () => { active = false; };
  }, []);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && pickerTarget) {
        setPickerTarget(null);
        setPickerSelectedRecipe(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pickerTarget]);

  const weekDates = useMemo(() => getWeekDates(), []);

  // Statistik untuk kartu Weekly Progress
  const stats = useMemo(() => {
    let filled = 0;
    let totalCalories = 0;
    let totalPrice = 0;
    DAYS.forEach(({ key }) => {
      MEALS.forEach(({ key: meal }) => {
        const slot = weeklyPlan?.[key]?.[meal];
        if (slot) {
          filled += 1;
          totalCalories += slot.calories || 0;
          totalPrice += slot.priceIdr || 0;
        }
      });
    });
    const avgCalories = filled > 0 ? Math.round(totalCalories / filled) : 0;
    let budgetImpact = 'Low';
    if (totalPrice >= 500000) budgetImpact = 'High';
    else if (totalPrice >= 200000) budgetImpact = 'Medium';
    return { filled, avgCalories, totalPrice, budgetImpact };
  }, [weeklyPlan]);

  // Resep untuk picker (difilter pencarian)
  const pickerResults = useMemo(() => {
    if (pickerSearch.trim() === '') return recipes;
    const q = pickerSearch.toLowerCase();
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, pickerSearch]);

  const recommended = recipes.slice(0, 3);
  const recommendCaptions = ['Terpopuler minggu ini', 'Berdasarkan pesananmu sebelumnya', 'Favorit di wilayahmu'];

  const handlePickRecipe = (recipe) => {
    setPickerSelectedRecipe(recipe);
    setPickerServings(2);
  };

  const handleConfirmAdd = () => {
    if (!pickerTarget || !pickerSelectedRecipe) return;
    onSetSlot(pickerSelectedRecipe, pickerTarget.day, pickerTarget.meal, pickerServings);

    const mealLabel = MEALS.find((m) => m.key === pickerTarget.meal)?.label || pickerTarget.meal;
    showToast(`Berhasil menambahkan ${pickerSelectedRecipe.title} ke menu ${mealLabel} hari ${pickerTarget.day}!`);

    setPickerTarget(null);
    setPickerSearch('');
    setPickerSelectedRecipe(null);
  };

  const handleCancelPick = () => {
    setPickerSelectedRecipe(null);
  };

  const handleGenerateShoppingList = () => {
    if (stats.filled === 0) return; // guard: tanpa slot terisi tidak ada yang bisa dibelanjakan
    showToast('Daftar belanja berhasil dibuat berdasarkan rencana makan Anda!');
    onGenerateShoppingList();
  };

  return (
    <div className="bg-canvas-white min-h-dvh text-on-surface pb-40 md:pb-28">
      <main className="max-w-container-max mx-auto px-5 md:px-10 py-8 md:py-12">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ---------------- Planner Grid ---------------- */}
          <div className="flex-1 min-w-0">
            <div className="mb-6 md:mb-8">
              <h1 className="font-headline-xl text-headline-lg md:text-headline-xl text-primary tracking-tight mb-2 leading-tight">
                Rencana Masak Mingguan
              </h1>
              <p className="text-on-surface-variant text-body-lg">
                Atur jadwal makan Anda untuk hidup yang lebih sehat dan teratur.
              </p>
            </div>

            {/* CTA generate AI saat planner masih kosong */}
            {stats.filled === 0 && (
              <div className="mb-6 rounded-panel border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-primary mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    Bingung mau masak apa minggu ini?
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Biar AI menyusun menu sesuai budget dan preferensimu, lalu otomatis mengisi planner ini.
                  </p>
                </div>
                <button
                  onClick={onGoToGenerate}
                  className="shrink-0 px-6 py-3 bg-primary text-white rounded-full font-bold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  Generate dengan AI
                </button>
              </div>
            )}

            {/* Mobile Days Tabs */}
            <div className="md:hidden flex overflow-x-auto hide-scrollbar gap-2 mb-6 -mx-5 px-5 pb-2">
              {DAYS.map((day, dayIdx) => (
                <button
                  key={day.key}
                  onClick={() => setActiveMobileDay(day.key)}
                  className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all shadow-sm cursor-pointer ${activeMobileDay === day.key
                      ? 'bg-primary text-white scale-105'
                      : 'bg-white text-on-surface-variant border border-outline-variant hover:bg-surface-variant'
                    }`}
                >
                  {day.short} <span className="font-medium text-xs opacity-80 ml-1">{weekDates[dayIdx]}</span>
                </button>
              ))}
            </div>

            <div className="overflow-x-hidden md:overflow-x-auto hide-scrollbar -mx-5 px-5 md:mx-0 md:px-0">
              <div className="flex flex-col gap-8 md:min-w-[1000px] md:grid md:grid-cols-8 md:gap-4">
                {/* Kolom label jenis makan (Hanya Desktop) */}
                <div className="hidden md:flex flex-col gap-4 mt-16">
                  {MEALS.map((meal) => (
                    <div key={meal.key} className="h-40 flex items-center justify-end pr-4 text-right">
                      <span className="text-xs font-semibold text-on-surface uppercase tracking-widest">
                        {meal.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Kolom per hari */}
                {DAYS.map((day, dayIdx) => (
                  <div key={day.key} className={`flex-col gap-4 ${activeMobileDay === day.key ? 'flex' : 'hidden md:flex'}`}>
                    {/* Header tanggal */}
                    <div className="text-left md:text-center pb-2 md:pb-4 border-b md:border-none border-outline-variant">
                      <div className="text-xs font-semibold text-on-surface mb-1 uppercase tracking-wide md:block inline-block mr-2 md:mr-0">
                        {day.short} <span className="md:hidden">- {weekDates[dayIdx]}</span>
                      </div>
                      <div className="hidden md:block text-2xl font-bold text-on-surface">{weekDates[dayIdx]}</div>
                    </div>

                    {/* Slot makan */}
                    {MEALS.map((meal) => {
                      const slot = weeklyPlan?.[day.key]?.[meal.key];
                      return (
                        <div key={meal.key} className="flex flex-col gap-2 md:block md:gap-0">
                          {/* Label makan untuk mobile */}
                          <div className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest pl-2">
                            {meal.label}
                          </div>
                          {slot ? (
                            <div
                              className="h-40 group relative rounded-3xl overflow-hidden recipe-card-shadow cursor-pointer"
                            >
                              <img
                                src={slot.imageUrl}
                                alt={slot.title}
                                loading="lazy"
                                onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                                <span className="text-white font-semibold text-[13px] leading-tight mb-1 line-clamp-2">
                                  {slot.title}
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <div className="flex items-center gap-1 bg-on-surface/50 backdrop-blur-md px-2 py-0.5 rounded-full text-white/95 shadow-sm border border-white/10">
                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                    <span className="text-[9px] font-bold tracking-wide">{slot.readyInMinutes}m</span>
                                  </div>
                                  <div className="flex items-center gap-1 bg-primary/90 backdrop-blur-md px-2 py-0.5 rounded-full text-white shadow-sm border border-primary-container/30">
                                    <span className="material-symbols-outlined text-[12px]">group</span>
                                    <span className="text-[9px] font-bold tracking-wide">{slot.servings || 2} porsi</span>
                                  </div>
                                </div>
                              </div>
                              {/* Tombol hapus */}
                              <button
                                onClick={() => {
                                  const savedSlot = weeklyPlan[day.key][meal.key];
                                  onRemoveSlot(day.key, meal.key);
                                  showToast(
                                    `Menu dihapus dari ${meal.label} hari ${day.key}`,
                                    {
                                      onUndo: () => {
                                        restoreSlot(day.key, meal.key, savedSlot);
                                        showToast('Menu dikembalikan');
                                      }
                                    }
                                  );
                                }}
                                title="Hapus dari rencana"
                                aria-label={`Hapus ${slot.title} dari ${meal.label} hari ${day.key}`}
                                className="absolute top-2 right-2 w-11 h-11 rounded-full bg-on-surface/50 hover:bg-error text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setPickerTarget({ day: day.key, meal: meal.key });
                                setPickerSearch('');
                              }}
                              className="h-40 border-2 border-dashed border-outline-variant rounded-3xl flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:border-primary hover:text-primary transition-all bg-white/50 group cursor-pointer w-full"
                            >
                              <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">
                                add_circle
                              </span>
                              <span className="text-xs font-semibold">Tambah Resep</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------------- Sidebar ---------------- */}
          <aside className="lg:w-80 shrink-0 flex flex-col gap-6">
            {/* Recommended for you */}
            <div className="bg-surface-cream/40 border border-outline-variant rounded-panel p-6">
              <h3 className="font-headline-md text-headline-md text-primary mb-2">Rekomendasi untuk Anda</h3>
              <p className="text-on-surface-variant text-sm mb-6">
                Rekomendasi pilihan berdasarkan tren populer dan riwayat pesanan Anda.
              </p>
              <div className="space-y-4">
                {recommended.map((recipe, idx) => (
                  <div key={recipe.id} className="flex items-center gap-4 group">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 recipe-card-shadow">
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-on-surface leading-tight line-clamp-1">
                        {recipe.title}
                      </h4>
                      <span className="text-xs text-on-surface-variant">{recommendCaptions[idx]}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={onGoToCatalog}
                className="mt-6 w-full py-2.5 rounded-full border border-secondary text-secondary font-bold text-sm hover:bg-secondary-container/30 transition-all cursor-pointer"
              >
                Lihat Semua Rekomendasi
              </button>
            </div>

            {/* Jadwal Pengiriman Bahan */}
            <div className="bg-primary-container text-on-primary-container rounded-panel p-6">
              <h3 className="font-headline-md text-headline-md mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">local_shipping</span>
                Jadwal Pengiriman
              </h3>
              <p className="text-on-primary-container/80 text-sm mb-5">
                Bahan segar diantar langsung ke rumahmu.
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 bg-white/15 rounded-2xl px-4 py-3">
                  <span className="material-symbols-outlined text-[20px] shrink-0">bolt</span>
                  <div>
                    <p className="text-sm font-semibold">Pengiriman Hari Ini</p>
                    <p className="text-xs opacity-70">Pesan sebelum pukul 12:00 WIB</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/15 rounded-2xl px-4 py-3">
                  <span className="material-symbols-outlined text-[20px] shrink-0">calendar_today</span>
                  <div>
                    <p className="text-sm font-semibold">Jadwal Besok</p>
                    <p className="text-xs opacity-70">Pesan kapan saja hari ini</p>
                  </div>
                </div>
              </div>
              {stats.filled > 0 ? (
                <button
                  onClick={handleGenerateShoppingList}
                  className="mt-5 w-full py-3 bg-white/20 hover:bg-white/30 text-on-primary-container rounded-full font-bold text-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                  Pesan Bahan Sekarang
                </button>
              ) : (
                <p className="mt-5 text-xs text-on-primary-container/70 text-center">
                  Isi rencana makan dulu untuk mulai memesan bahan.
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* ---------------- Bottom Action Bar ---------------- */}
      <div className="fixed bottom-above-nav md:bottom-0 left-0 right-0 z-40 p-4 md:p-6 md:pb-safe-6 bg-gradient-to-t from-canvas-white via-canvas-white/95 to-transparent flex justify-center pointer-events-none">
        <button
          onClick={handleGenerateShoppingList}
          disabled={stats.filled === 0}
          aria-disabled={stats.filled === 0}
          title={stats.filled === 0 ? 'Isi minimal satu slot makan dulu' : undefined}
          className={`pointer-events-auto px-8 py-4 rounded-full flex items-center gap-3 transition-all group ${stats.filled === 0
              ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed shadow-none'
              : 'bg-primary hover:bg-primary-container text-white shadow-2xl shadow-primary/30 active:scale-95 cursor-pointer'
            }`}
        >
          <span
            className={`material-symbols-outlined transition-transform ${stats.filled === 0 ? '' : 'group-hover:rotate-12'
              }`}
          >
            shopping_cart
          </span>
          <span className="font-bold text-lg">
            {stats.filled === 0 ? 'Isi Rencana Dulu' : 'Buat Daftar Belanja'}
          </span>
        </button>
      </div>

      {/* ---------------- Recipe Picker Modal ---------------- */}
      {pickerTarget && (
        <ModalSheet
          onClose={() => {
            setPickerTarget(null);
            setPickerSelectedRecipe(null);
          }}
          labelledBy="modal-picker-title"
          panelClassName="overflow-hidden max-w-2xl max-h-[90dvh] md:max-h-[85dvh] flex flex-col"
        >
          {/* Content Based on Selection */}
          {!pickerSelectedRecipe ? (
            <>
              <div className="p-6 border-b border-outline-variant shrink-0">
                <button
                  onClick={() => {
                    setPickerTarget(null);
                    setPickerSelectedRecipe(null);
                  }}
                  className="absolute right-4 top-4 w-11 h-11 rounded-full bg-secondary-container/40 text-on-surface flex items-center justify-center hover:bg-secondary-container transition-colors cursor-pointer"
                  aria-label="Tutup pencarian resep"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
                </button>
                <h3 id="modal-picker-title" className="font-headline-md text-headline-md text-primary mb-1 flex items-center gap-1.5 pr-10">
                  <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
                  Rekomendasi Resep
                </h3>
                <p className="text-xs text-on-surface-variant mb-4">
                  Pilih hidangan untuk{' '}
                  <strong>{MEALS.find((m) => m.key === pickerTarget.meal)?.label}</strong> hari{' '}
                  <strong>{pickerTarget.day}</strong>.
                </p>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                    search
                  </span>
                  <input
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoFocus
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Cari resep..."
                    className="w-full pl-11 pr-4 py-2.5 rounded-full border border-outline-variant bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-base font-medium"
                  />
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1 p-6">
                {pickerResults.length === 0 ? (
                  <div className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl text-outline-variant mb-2 block">
                      sentiment_dissatisfied
                    </span>
                    <p className="text-sm">Resep tidak ditemukan.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pickerResults.map((recipe) => (
                      <button
                        key={recipe.id}
                        onClick={() => handlePickRecipe(recipe)}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-outline-variant bg-white hover:bg-secondary-container/20 hover:border-primary transition-all text-left cursor-pointer group"
                      >
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                          <img
                            src={recipe.imageUrl}
                            alt={recipe.title}
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-on-surface leading-tight line-clamp-2">
                            {recipe.title}
                          </h4>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Konfirmasi Porsi Modal */}
              <div className="p-6 md:p-8">
                <button
                  onClick={() => {
                    setPickerTarget(null);
                    setPickerSelectedRecipe(null);
                  }}
                  className="absolute right-4 top-4 w-11 h-11 rounded-full bg-secondary-container/40 text-on-surface flex items-center justify-center hover:bg-secondary-container transition-colors cursor-pointer"
                  aria-label="Tutup pengaturan porsi"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
                </button>

                <h3 id="modal-picker-title" className="font-headline-md text-headline-md text-primary mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-2xl">group</span>
                  Atur Jumlah Porsi
                </h3>
                <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                  Berapa porsi <strong>{pickerSelectedRecipe.title}</strong> yang ingin Anda masak untuk{' '}
                  <strong>{MEALS.find((m) => m.key === pickerTarget.meal)?.label}</strong> hari{' '}
                  <strong>{pickerTarget.day}</strong>?
                </p>

                {/* Servings Stepper */}
                <div className="space-y-1.5 mb-8">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                    Jumlah Porsi (Servings)
                  </label>
                  <div className="flex items-center gap-4 bg-secondary-container/20 border border-outline-variant p-2 rounded-2xl justify-between">
                    <button
                      onClick={() => setPickerServings(Math.max(1, pickerServings - 1))}
                      className="w-11 h-11 rounded-xl bg-white border border-outline-variant flex items-center justify-center hover:bg-secondary-container/30 active:scale-95 transition-all text-primary font-bold cursor-pointer"
                      aria-label="Kurangi porsi"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">remove</span>
                    </button>
                    <span className="font-extrabold text-lg text-primary" aria-live="polite">{pickerServings} Porsi</span>
                    <button
                      onClick={() => setPickerServings(pickerServings + 1)}
                      className="w-11 h-11 rounded-xl bg-white border border-outline-variant flex items-center justify-center hover:bg-secondary-container/30 active:scale-95 transition-all text-primary font-bold cursor-pointer"
                      aria-label="Tambah porsi"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleCancelPick}
                    className="flex-1 py-3 border border-outline-variant text-on-surface-variant hover:bg-secondary-container/20 rounded-full font-bold text-sm transition-colors cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={handleConfirmAdd}
                    className="flex-1 py-3 bg-primary text-white hover:bg-primary-container rounded-full font-bold text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-lg">check</span>
                    Konfirmasi
                  </button>
                </div>
              </div>
            </>
          )}
        </ModalSheet>
      )}
    </div>
  );
}

export default WeeklyPlanner;
