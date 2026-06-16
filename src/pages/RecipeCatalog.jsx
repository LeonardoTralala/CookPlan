import { useState, useMemo, useEffect } from 'react';
import { getRecipes, getSavedRecipeIds, saveRecipe, unsaveRecipe } from '../services/recipeService.js';
import { getActiveDietTags, sampleDietTags } from '../services/dietService.js';
import { getProfile } from '../services/profileService.js';
import { usePlan } from '../hooks/usePlan.js';
import { ModalSheet } from '../components/ModalSheet.jsx';

// Opsi diet untuk chip "Inspirasi Masakan Hari Ini" diambil dinamis dari diet_tags
// (sama sumbernya dengan Generate step 2). Konstanta ini hanya FALLBACK bila fetch
// gagal supaya filter tidak pernah kosong.
const DEFAULT_DIET_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'halal', label: 'Halal' },
  { value: 'cepat', label: 'Cepat (< 30 mnt)' },
  { value: 'bahan-lokal', label: 'Bahan Lokal' },
];

// Cocokkan satu resep dengan satu preferensi diet (slug diet_tags.value).
// Kunci utama: recipe.tags (berisi slug). Fallback: badge label (case-insensitive),
// plus heuristik waktu/harga untuk slug 'cepat'/'hemat' (selaras perilaku lama).
function recipeMatchesDiet(recipe, slug, label) {
  if ((recipe.tags ?? []).includes(slug)) return true;
  if (label && (recipe.badges ?? []).some((b) => b.toLowerCase() === label.toLowerCase())) return true;
  if (slug === 'cepat' && recipe.readyInMinutes <= 30) return true;
  if (slug === 'hemat' && recipe.priceIdr <= 30000) return true;
  return false;
}

function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function RecipeCatalog({ onAddToPlan }) {
  const { showToast, weeklyPlan } = usePlan();

  // Bank resep dari DB (Supabase) — menggantikan mockRecipes statis.
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  // activeFilters menyimpan slug diet_tags.value (mis. 'vegetarian', 'serba-ayam').
  // Diisi awal dari preferensi diet tersimpan user (profiles.diet_prefs).
  const [activeFilters, setActiveFilters] = useState([]);
  // dietPool = semua preferensi aktif (diet_tags). dietSample = subset acak yang
  // ditampilkan sebagai chip (selaras Generate step 2: variatif + "Pilihan lain").
  const [dietPool, setDietPool] = useState(DEFAULT_DIET_OPTIONS);
  const [dietSample, setDietSample] = useState(() => DEFAULT_DIET_OPTIONS.slice(0, 8));
  const [maxTime, setMaxTime] = useState(120); // default max 120 minutes
  const [priceCategory, setPriceCategory] = useState('Semua'); // 'Semua', 'Hemat', 'Standar', 'Premium'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedRecipeForDetail, setSelectedRecipeForDetail] = useState(null);
  const [selectedRecipeForPlan, setSelectedRecipeForPlan] = useState(null);
  
  // State for Add to Plan form
  const [planDay, setPlanDay] = useState('Senin');
  const [planMeal, setPlanMeal] = useState('breakfast');
  const [planServings, setPlanServings] = useState(2);

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const mealOptions = [
    { value: 'breakfast', label: 'Sarapan' },
    { value: 'lunch', label: 'Makan Siang' },
    { value: 'dinner', label: 'Makan Malam' }
  ];

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedRecipeForPlan) setSelectedRecipeForPlan(null);
        else if (selectedRecipeForDetail) setSelectedRecipeForDetail(null);
        else if (showAdvancedFilters) setShowAdvancedFilters(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRecipeForDetail, selectedRecipeForPlan, showAdvancedFilters]);

  // Set id resep yang sudah disimpan user (untuk menandai status bookmark).
  const [savedIds, setSavedIds] = useState(() => new Set());

  // Muat bank resep dari Supabase saat mount.
  useEffect(() => {
    let active = true;
    getRecipes()
      .then((data) => { if (active) { setRecipes(shuffle(data)); setLoadError(''); } })
      .catch((err) => { if (active) setLoadError(err.message || 'Gagal memuat resep.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Muat daftar id resep tersimpan (gagal = diam, fitur simpan tetap bisa dipakai).
  useEffect(() => {
    let active = true;
    getSavedRecipeIds()
      .then((ids) => { if (active) setSavedIds(new Set(ids)); })
      .catch((err) => { console.error('Gagal memuat resep tersimpan:', err); });
    return () => { active = false; };
  }, []);

  // Opsi diet (chip) + preferensi tersimpan user — sama sumbernya dengan Generate
  // step 2: chip dari diet_tags, pilihan awal dari profiles.diet_prefs. Gagal fetch
  // → tetap pakai fallback konstanta, dan user belum login → tanpa pra-pilih.
  useEffect(() => {
    let active = true;
    Promise.all([
      getActiveDietTags().catch(() => []),
      getProfile().catch(() => null),
    ]).then(([rows, prof]) => {
      if (!active) return;
      const pool = rows.length ? rows : DEFAULT_DIET_OPTIONS;
      setDietPool(pool);
      // Hanya pra-pilih pref yang ada di pool agar tiap filter aktif punya chip.
      const poolValues = new Set(pool.map((d) => d.value));
      const prefs = (prof?.dietPrefs ?? []).filter((v) => poolValues.has(v));
      setActiveFilters(prefs);
      setDietSample(sampleDietTags(pool, 8, prefs));
    });
    return () => { active = false; };
  }, []);

  // Peta slug → label untuk pencocokan & tampilan.
  const dietLabelOf = useMemo(() => {
    const m = new Map();
    for (const d of dietPool) m.set(d.value, d.label);
    return m;
  }, [dietPool]);

  // Tampilkan kombinasi preferensi diet acak lain (yang sedang dipilih tetap muncul).
  const reshuffleDiet = () => setDietSample(sampleDietTags(dietPool, 8, activeFilters));

  // Toggle simpan/hapus resep (optimistic + rollback bila gagal).
  const handleToggleSaved = async (recipe) => {
    const id = recipe.id;
    const wasSaved = savedIds.has(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id); else next.add(id);
      return next;
    });
    try {
      if (wasSaved) await unsaveRecipe(id); else await saveRecipe(id);
      showToast(wasSaved ? 'Resep dihapus dari tersimpan.' : `"${recipe.title}" disimpan.`);
    } catch (err) {
      setSavedIds((prev) => { // rollback
        const next = new Set(prev);
        if (wasSaved) next.add(id); else next.delete(id);
        return next;
      });
      showToast(err.message || 'Gagal memperbarui resep tersimpan.');
    }
  };

  // Toggle quick filter tag
  const handleToggleFilter = (filterName) => {
    if (activeFilters.includes(filterName)) {
      setActiveFilters(activeFilters.filter((f) => f !== filterName));
    } else {
      setActiveFilters([...activeFilters, filterName]);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveFilters([]);
    setMaxTime(120);
    setPriceCategory('Semua');
  };

  // Filter recipes based on search query, quick filters, and advanced criteria
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      // 1. Search Query Filter (matches title or ingredients)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesTitle = recipe.title.toLowerCase().includes(query);
        const matchesIngredients = (recipe.ingredients ?? []).some((ing) =>
          ing.name.toLowerCase().includes(query)
        );
        if (!matchesTitle && !matchesIngredients) return false;
      }

      // 2. Preferensi diet (chip) — cocokkan slug ke recipe.tags / badges.
      if (activeFilters.length > 0) {
        const matchesAllActive = activeFilters.every((slug) =>
          recipeMatchesDiet(recipe, slug, dietLabelOf.get(slug))
        );
        if (!matchesAllActive) return false;
      }

      // 3. Max Cooking Time — 120 = "Semua" (tanpa batas), jadi skip filter.
      if (maxTime < 120 && recipe.readyInMinutes > maxTime) return false;

      // 4. Price Category
      if (priceCategory === 'Hemat' && recipe.priceIdr >= 15000) return false;
      if (priceCategory === 'Standar' && (recipe.priceIdr < 15000 || recipe.priceIdr > 30000)) return false;
      if (priceCategory === 'Premium' && recipe.priceIdr <= 30000) return false;

      return true;
    });
  }, [recipes, searchQuery, activeFilters, maxTime, priceCategory, dietLabelOf]);

  // Handle confirming "Add to Plan"
  const handleConfirmAddToPlan = () => {
    if (!selectedRecipeForPlan) return;

    if (onAddToPlan) {
      onAddToPlan(selectedRecipeForPlan, planDay, planMeal, planServings);
    }

    // Simpan info untuk pesan sebelum reset
    const mealLabel = mealOptions.find((m) => m.value === planMeal)?.label || '';
    const recipeTitle = selectedRecipeForPlan.title;

    // Reset and close
    setSelectedRecipeForPlan(null);
    setPlanDay('Senin');
    setPlanMeal('breakfast');
    setPlanServings(2);

    // Show alert
    showToast(`Berhasil menambahkan "${recipeTitle}" (${planServings} porsi) ke ${mealLabel} hari ${planDay}!`);
  };

  // Utility to format price to Rupiah
  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  // Slot yang sudah terisi pada kombinasi hari+jenis makan yang dipilih saat ini
  const existingSlot = selectedRecipeForPlan ? (weeklyPlan?.[planDay]?.[planMeal] ?? null) : null;

  return (
    <div className="bg-canvas-white min-h-dvh font-sans text-on-surface pb-24">
      {/* Hero header */}
      <section className="pt-8 pb-4 px-4 max-w-container-max mx-auto text-center">
        <h2 className="font-headline-md text-headline-md text-primary tracking-tight mb-4">
          Inspirasi Masakan Hari Ini
        </h2>

        {/* Search Input */}
        <div className="max-w-2xl mx-auto relative group mb-4">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            className="w-full pl-11 pr-6 py-2.5 rounded-full border border-outline-variant bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-sm transition-all text-sm font-medium"
            placeholder="Cari resep sehat untuk keluarga..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="Hapus pencarian"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
            </button>
          )}
        </div>

        {/* Chip preferensi diet — dinamis dari diet_tags (sama dgn Generate step 2),
            pra-pilih dari preferensi tersimpan user. */}
        <div className="flex flex-wrap justify-center items-center gap-3">
          {dietSample.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleToggleFilter(opt.value)}
              className={`px-6 py-2 rounded-full font-semibold text-xs md:text-sm border transition-all cursor-pointer ${
                activeFilters.includes(opt.value)
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-cream/50 text-primary border-outline-variant hover:bg-primary-container hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={reshuffleDiet}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs md:text-sm font-semibold border border-dashed border-primary/50 text-primary hover:bg-primary/5 active:scale-95 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">casino</span>
            Pilihan lain
          </button>

          {/* Toggle Advanced Filters Button */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-4 py-2 rounded-full font-semibold text-xs md:text-sm border transition-all flex items-center gap-1.5 cursor-pointer ${
              showAdvancedFilters
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-on-surface-variant border-outline-variant hover:bg-secondary-container/20'
            }`}
          >
            <span className="material-symbols-outlined text-lg">tune</span>
            Filter
          </button>

          {(searchQuery || activeFilters.length > 0 || maxTime < 120 || priceCategory !== 'Semua') && (
            <button
              onClick={handleResetFilters}
              className="text-xs md:text-sm font-bold text-error hover:text-error/80 transition-colors flex items-center gap-1 cursor-pointer pl-2"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Atur Ulang
            </button>
          )}
        </div>

        {/* Sliding Panel / Advanced Filters Section */}
        {showAdvancedFilters && (
          <div className="max-w-2xl mx-auto mt-6 p-6 bg-white border border-outline-variant rounded-3xl shadow-sm animate-fade-in text-left">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xl">tune</span>
                Batasan Memasak & Budget
              </h4>
              <button
                onClick={() => setShowAdvancedFilters(false)}
                className="w-11 h-11 rounded-full bg-secondary-container/40 text-on-surface flex items-center justify-center hover:bg-secondary-container transition-colors cursor-pointer"
                aria-label="Tutup pengaturan filter"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Max Cooking Time Filter — chip rentang bertingkat agar mudah dipilih dengan jari
                  (slider lama butuh presisi tinggi di layar sentuh). value 120 = tanpa batas. */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-on-surface-variant">
                  Waktu Masak Maksimal
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '≤ 15 mnt', value: 15 },
                    { label: '≤ 30 mnt', value: 30 },
                    { label: '≤ 45 mnt', value: 45 },
                    { label: '≤ 60 mnt', value: 60 },
                    { label: 'Semua', value: 120 }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setMaxTime(opt.value)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                        maxTime === opt.value
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-on-surface-variant border-outline-variant hover:bg-secondary-container/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Category Filter */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-on-surface-variant">
                  Kategori Harga (per porsi)
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Semua', 'Hemat', 'Standar', 'Premium'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setPriceCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                        priceCategory === cat
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-on-surface-variant border-outline-variant hover:bg-secondary-container/30'
                      }`}
                    >
                      {cat === 'Hemat' ? 'Hemat (< Rp 15k)' : 
                       cat === 'Standar' ? 'Standar (Rp 15k - 30k)' : 
                       cat === 'Premium' ? 'Premium (> Rp 30k)' : 'Semua'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Catalog Grid */}
      <section className="px-4 max-w-container-max mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-3" aria-hidden="true">progress_activity</span>
            <p className="text-sm">Memuat resep…</p>
          </div>
        ) : loadError ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-error/30 p-8">
            <span className="material-symbols-outlined text-5xl text-error mb-4">error</span>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Gagal Memuat Resep</h3>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto">{loadError}</p>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-outline-variant p-8">
            <span className="material-symbols-outlined text-5xl md:text-6xl text-outline-variant mb-4">
              sentiment_dissatisfied
            </span>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Resep Tidak Ditemukan</h3>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto">
              Maaf, kami tidak dapat menemukan resep yang sesuai dengan kriteria pencarian dan filter Anda. Silakan coba atur ulang filter.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-6 px-6 py-2.5 bg-primary text-white font-bold rounded-full hover:bg-primary-container transition-all cursor-pointer shadow-md"
            >
              Atur Ulang Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="recipe-card-shadow bg-surface-container rounded-2xl overflow-hidden group cursor-pointer hover:-translate-y-0.5 transition-all duration-300 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setSelectedRecipeForDetail(recipe)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedRecipeForDetail(recipe);
                  }
                }}
              >
                {/* Image Section */}
                <div className="relative h-24 sm:h-32 md:h-36 overflow-hidden">
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {recipe.badges?.[0] && (
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 rounded-full bg-white/95 text-primary font-bold text-[9px] shadow-sm tracking-wide">
                        {recipe.badges[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-2.5 md:p-3 flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-1.5 mb-1.5">
                    <h3 className="text-xs md:text-sm font-bold text-on-surface hover:text-primary transition-colors leading-tight line-clamp-2 flex-1">
                      {recipe.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRecipeForPlan(recipe);
                      }}
                      className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm shrink-0 cursor-pointer"
                      title="Tambah ke Rencana Mingguan"
                      aria-label="Tambah ke Rencana Mingguan"
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-on-surface-variant text-[11px] font-semibold">
                    <div className="flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      <span>{recipe.readyInMinutes}m</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[14px]">whatshot</span>
                      <span>{recipe.calories} kcal</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {filteredRecipes.length > 0 && (
          <div className="mt-16 text-center">
            <button
              onClick={() => showToast('Lebih banyak resep akan segera ditambahkan!')}
              className="px-8 py-3 rounded-full border border-secondary text-secondary font-bold hover:bg-secondary-container/20 transition-all cursor-pointer"
            >
              Muat Lebih Banyak Resep
            </button>
          </div>
        )}
      </section>

      {/* -------------------- DETAIL RESEP MODAL -------------------- */}
      {selectedRecipeForDetail && (
        <ModalSheet
          onClose={() => setSelectedRecipeForDetail(null)}
          labelledBy="modal-recipe-title"
          panelClassName="overflow-hidden max-w-2xl max-h-[90dvh] md:max-h-[85dvh] flex flex-col"
        >
            {/* Header Close button */}
            <button
              onClick={() => setSelectedRecipeForDetail(null)}
              className="absolute right-4 top-4 z-10 w-11 h-11 rounded-full bg-on-surface/60 text-white flex items-center justify-center hover:bg-on-surface transition-colors shadow-md cursor-pointer"
              aria-label="Tutup detail resep"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
            </button>

            {/* Scrollable Container */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {/* Header Image */}
              <div className="relative h-64 md:h-72">
                <img
                  src={selectedRecipeForDetail.imageUrl}
                  alt={selectedRecipeForDetail.title}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-6 left-6 text-white pr-10">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(selectedRecipeForDetail.badges ?? []).map((badge, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold text-[9px] uppercase tracking-wider"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <h3 id="modal-recipe-title" className="font-headline-lg text-headline-md md:text-headline-lg">{selectedRecipeForDetail.title}</h3>
                </div>
              </div>

              {/* Detail Content */}
              <div className="p-6 md:p-8 space-y-6">
                <p className="text-on-surface-variant text-sm md:text-base leading-relaxed italic">
                  "{selectedRecipeForDetail.description}"
                </p>

                {/* Quick Info Grid */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-secondary-container/20 rounded-2xl border border-outline-variant/60 text-center">
                  <div>
                    <span className="material-symbols-outlined text-primary text-2xl mb-1 block">
                      schedule
                    </span>
                    <span className="text-[10px] uppercase font-bold text-on-surface tracking-wider block">
                      Waktu Masak
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {selectedRecipeForDetail.readyInMinutes} mnt
                    </span>
                  </div>
                  <div>
                    <span className="material-symbols-outlined text-primary text-2xl mb-1 block">
                      whatshot
                    </span>
                    <span className="text-[10px] uppercase font-bold text-on-surface tracking-wider block">
                      Kalori
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {selectedRecipeForDetail.calories} kcal
                    </span>
                  </div>
                  <div>
                    <span className="material-symbols-outlined text-primary text-2xl mb-1 block">
                      payments
                    </span>
                    <span className="text-[10px] uppercase font-bold text-on-surface tracking-wider block">
                      Estimasi Harga
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {formatRupiah(selectedRecipeForDetail.priceIdr)}
                    </span>
                  </div>
                </div>

                {/* Ingredients Section */}
                <div>
                  <h4 className="text-lg font-bold text-primary border-b border-outline-variant pb-2 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xl">restaurant_menu</span>
                    Bahan-Bahan yang Dibutuhkan
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {(selectedRecipeForDetail.ingredients ?? []).map((ing, idx) => (
                      <li
                        key={idx}
                        className="flex justify-between items-center py-1.5 border-b border-outline-variant/30 text-xs md:text-sm"
                      >
                        <span className="font-medium text-on-surface">{ing.name}</span>
                        <span className="text-on-surface-variant font-bold bg-white px-2 py-0.5 rounded border border-outline-variant/40">
                          {ing.amount} {ing.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions Section */}
                <div>
                  <h4 className="text-lg font-bold text-primary border-b border-outline-variant pb-2 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xl">local_cafe</span>
                    Langkah-Langkah Memasak
                  </h4>
                  <ol className="space-y-4">
                    {(selectedRecipeForDetail.instructions ?? []).map((step, idx) => (
                      <li key={idx} className="flex gap-4 items-start text-xs md:text-sm leading-relaxed">
                        <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-on-surface-variant">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-4 bg-canvas-white border-t border-outline-variant flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => handleToggleSaved(selectedRecipeForDetail)}
                className={`px-5 py-2.5 rounded-full font-bold text-sm cursor-pointer flex items-center gap-1.5 transition-colors border ${
                  savedIds.has(selectedRecipeForDetail.id)
                    ? 'bg-error/10 border-error/30 text-error hover:bg-error/20'
                    : 'border-outline-variant text-on-surface-variant hover:bg-secondary-container/20'
                }`}
                aria-pressed={savedIds.has(selectedRecipeForDetail.id)}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  {savedIds.has(selectedRecipeForDetail.id) ? 'favorite' : 'favorite_border'}
                </span>
                {savedIds.has(selectedRecipeForDetail.id) ? 'Tersimpan' : 'Simpan'}
              </button>
              <button
                onClick={() => setSelectedRecipeForDetail(null)}
                className="px-5 py-2.5 border border-outline-variant text-on-surface-variant hover:bg-secondary-container/20 rounded-full font-bold text-sm cursor-pointer transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  setSelectedRecipeForPlan(selectedRecipeForDetail);
                  setSelectedRecipeForDetail(null);
                }}
                className="px-6 py-2.5 bg-primary text-white hover:bg-primary-container rounded-full font-bold text-sm cursor-pointer flex items-center gap-1.5 transition-all shadow-md"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Tambah ke Rencana
              </button>
            </div>
        </ModalSheet>
      )}

      {/* -------------------- ADD TO PLAN MODAL -------------------- */}
      {selectedRecipeForPlan && (
        <ModalSheet
          onClose={() => setSelectedRecipeForPlan(null)}
          labelledBy="modal-plan-title"
          panelClassName="max-w-sm max-h-[90dvh] overflow-y-auto p-6 md:p-8"
        >
            {/* Close Button */}
            <button
              onClick={() => setSelectedRecipeForPlan(null)}
              className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              aria-label="Tutup form rencana menu"
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>

            <h3 id="modal-plan-title" className="font-headline-md text-headline-md text-primary mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-2xl">calendar_today</span>
              Atur Menu Mingguan
            </h3>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
              Tambahkan hidangan <strong>{selectedRecipeForPlan.title}</strong> ke dalam agenda rencana masak mingguan Anda.
            </p>

            {/* Form Fields */}
            <div className="space-y-5">
              {/* Meal Type Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                  Pilih Jenis Makan
                </label>
                <select
                  value={planMeal}
                  onChange={(e) => setPlanMeal(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base font-semibold text-on-surface"
                >
                  {mealOptions.map((meal) => (
                    <option key={meal.value} value={meal.value}>
                      {meal.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                  Pilih Hari Memasak
                </label>
                <select
                  value={planDay}
                  onChange={(e) => setPlanDay(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base font-semibold text-on-surface"
                >
                  {daysOfWeek.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              {/* Servings Stepper */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                  Jumlah Porsi (Servings)
                </label>
                <div className="flex items-center gap-4 bg-secondary-container/20 border border-outline-variant p-2 rounded-2xl justify-between">
                  <button
                    onClick={() => setPlanServings(Math.max(1, planServings - 1))}
                    className="w-11 h-11 rounded-xl bg-white border border-outline-variant flex items-center justify-center hover:bg-secondary-container/30 active:scale-95 transition-all text-primary font-bold cursor-pointer"
                    aria-label="Kurangi porsi"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">remove</span>
                  </button>
                  <span className="font-extrabold text-lg text-primary" aria-live="polite">{planServings} Porsi</span>
                  <button
                    onClick={() => setPlanServings(planServings + 1)}
                    className="w-11 h-11 rounded-xl bg-white border border-outline-variant flex items-center justify-center hover:bg-secondary-container/30 active:scale-95 transition-all text-primary font-bold cursor-pointer"
                    aria-label="Tambah porsi"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Peringatan slot sudah terisi */}
            {existingSlot && (
              <div className="mt-5 flex items-start gap-2.5 p-3 rounded-2xl bg-warning/10 border border-warning/30">
                <span className="material-symbols-outlined text-base text-warning shrink-0 mt-0.5" aria-hidden="true">warning</span>
                <p className="text-xs font-medium text-on-surface-variant leading-snug">
                  Slot <strong className="text-on-surface">{mealOptions.find((m) => m.value === planMeal)?.label}</strong> hari <strong className="text-on-surface">{planDay}</strong> sudah terisi dengan <strong className="text-on-surface">{existingSlot.title}</strong>. Konfirmasi akan menggantikan resep tersebut.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedRecipeForPlan(null)}
                className="flex-1 py-3 border border-outline-variant text-on-surface-variant hover:bg-secondary-container/20 rounded-full font-bold text-sm transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmAddToPlan}
                className="flex-1 py-3 bg-primary text-white hover:bg-primary-container rounded-full font-bold text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">{existingSlot ? 'swap_horiz' : 'check'}</span>
                {existingSlot ? 'Ganti Menu' : 'Konfirmasi'}
              </button>
            </div>
        </ModalSheet>
      )}
    </div>
  );
}

export default RecipeCatalog;
