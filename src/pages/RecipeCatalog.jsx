import { useState, useMemo, useEffect } from 'react';
import { getRecipes, getSavedRecipeIds, saveRecipe, unsaveRecipe } from '../services/recipeService.js';
import { getActiveDietTags, sampleDietTags } from '../services/dietService.js';
import { getProfile } from '../services/profileService.js';
import { usePlan } from '../hooks/usePlan.js';
import { ModalSheet } from '../components/ModalSheet.jsx';
import { CatalogGridSkeleton } from '../components/Skeleton.jsx';
import { RecipeDetailModal } from '../components/RecipeDetailModal.jsx';
import { trackRecipeView } from '../lib/posthog.js';

// Opsi diet untuk chip "Inspirasi Masakan Hari Ini" diambil dinamis dari diet_tags
// (sama sumbernya dengan Generate step 2). Konstanta ini hanya FALLBACK bila fetch
// gagal supaya filter tidak pernah kosong.
const DEFAULT_DIET_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'halal', label: 'Halal' },
  { value: 'cepat', label: 'Cepat (< 30 mnt)' },
  { value: 'bahan-lokal', label: 'Bahan Lokal' },
];

// Jumlah resep yang ditampilkan per "halaman" (pagination sisi-klien). Tombol
// "Muat Lebih Banyak" menambah sebanyak ini; menjaga DOM awal tetap ringan.
const RECIPES_PER_PAGE = 12;

// Tag sumber protein. 'tinggi-protein' tidak pernah ditulis eksplisit ke
// recipes.tags, jadi chip-nya diturunkan dari kehadiran salah satu tag ini agar
// berfungsi tanpa perlu menandai tiap resep secara manual.
const PROTEIN_SOURCE_TAGS = new Set([
  'ayam', 'ikan', 'sapi', 'kambing', 'telur', 'udang', 'daging', 'seafood', 'tahu', 'tempe',
]);

// Cocokkan satu resep dengan satu preferensi diet (slug diet_tags.value).
// Kunci utama: recipe.tags (berisi slug). Fallback: badge label (case-insensitive),
// plus heuristik waktu/harga untuk slug 'cepat'/'hemat' dan derivasi sumber protein
// untuk 'tinggi-protein' (selaras perilaku lama + tag yang tidak ditulis eksplisit).
function recipeMatchesDiet(recipe, slug, label) {
  if ((recipe.tags ?? []).includes(slug)) return true;
  if (label && (recipe.badges ?? []).some((b) => b.toLowerCase() === label.toLowerCase())) return true;
  // NULL/unknown sengaja tidak match (selaras dietFilter.ts edge): tanpa guard,
  // null <= 30 / null <= 30000 bernilai true dan resep tanpa waktu/harga ikut lolos.
  if (slug === 'cepat' && recipe.readyInMinutes != null && recipe.readyInMinutes <= 30) return true;
  if (slug === 'hemat' && recipe.priceIdr != null && recipe.priceIdr <= 30000) return true;
  if (slug === 'tinggi-protein' && (recipe.tags ?? []).some((t) => PROTEIN_SOURCE_TAGS.has(t))) return true;
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

function RecipeCatalog({ onAddToPlan, initialRecipeId }) {
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
  const [onlyVerified, setOnlyVerified] = useState(false); // hanya resep terverifikasi admin
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  // Pagination sisi-klien: berapa banyak resep yang sedang ditampilkan.
  const [visibleCount, setVisibleCount] = useState(RECIPES_PER_PAGE);
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

  // Deep-linking: Buka modal detail resep otomatis jika initialRecipeId cocok
  useEffect(() => {
    if (initialRecipeId && recipes.length > 0) {
      const match = recipes.find((r) => String(r.id) === String(initialRecipeId));
      if (match) {
        const timer = setTimeout(() => {
          setSelectedRecipeForDetail(match);
          trackRecipeView(match.id, match.title);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [recipes, initialRecipeId]);

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
    setOnlyVerified(false);
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
      //    Semantik OR (union): resep lolos bila cocok dengan SALAH SATU chip aktif.
      //    Mis. pilih "Serba Ayam" + "Serba Sapi" → tampil resep ayam ATAU sapi
      //    (kalau pakai AND, dua protein selalu 0 hasil karena tak ada resep ayam
      //    sekaligus sapi). Selaras perilaku OR di filter wizard AI (overlaps).
      if (activeFilters.length > 0) {
        const matchesAnyActive = activeFilters.some((slug) =>
          recipeMatchesDiet(recipe, slug, dietLabelOf.get(slug))
        );
        if (!matchesAnyActive) return false;
      }

      // 3. Max Cooking Time — 120 = "Semua" (tanpa batas), jadi skip filter.
      if (maxTime < 120 && recipe.readyInMinutes > maxTime) return false;

      // 4. Price Category — bandingkan HARGA PER PORSI agar selaras dengan label
      //    filter "(per porsi)". priceIdr di DB adalah total resep utk base_servings,
      //    jadi dibagi dulu (guard baseServings null/0 → anggap 1 porsi).
      const perServing = recipe.priceIdr / (recipe.baseServings || 1);
      if (priceCategory === 'Hemat' && perServing >= 15000) return false;
      if (priceCategory === 'Standar' && (perServing < 15000 || perServing > 30000)) return false;
      if (priceCategory === 'Premium' && perServing <= 30000) return false;

      // 5. Hanya terverifikasi admin
      if (onlyVerified && !recipe.isVerified) return false;

      return true;
    });
  }, [recipes, searchQuery, activeFilters, maxTime, priceCategory, onlyVerified, dietLabelOf]);

  // Reset pagination ke halaman pertama tiap kali kriteria filter berubah, agar
  // user tidak "nyangkut" di posisi muat-banyak setelah memfilter. Pola adjust-
  // state-during-render (lint-safe), sama seperti recoverySynced di AuthPage.
  const filterSig = `${searchQuery}|${activeFilters.join(',')}|${maxTime}|${priceCategory}|${onlyVerified}`;
  const [lastFilterSig, setLastFilterSig] = useState(filterSig);
  if (filterSig !== lastFilterSig) {
    setLastFilterSig(filterSig);
    setVisibleCount(RECIPES_PER_PAGE);
  }

  const visibleRecipes = filteredRecipes.slice(0, visibleCount);
  const hasMore = visibleCount < filteredRecipes.length;

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
            id="catalog-search-input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            className="w-full pl-11 pr-6 py-2.5 rounded-full border border-outline-variant bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-sm transition-all text-base md:text-sm font-medium"
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
        <div id="catalog-filter-chips" className="flex flex-wrap justify-center items-center gap-3">
          {dietSample.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleToggleFilter(opt.value)}
              className={`inline-flex items-center justify-center min-h-[44px] px-6 py-2 rounded-full font-semibold text-xs md:text-sm border transition-all cursor-pointer ${
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
            className="inline-flex items-center justify-center min-h-[44px] gap-1.5 px-4 py-2 rounded-full text-xs md:text-sm font-semibold border border-dashed border-primary/50 text-primary hover:bg-primary/5 active:scale-95 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">casino</span>
            Pilihan lain
          </button>

          {/* Toggle Advanced Filters Button */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`min-h-[44px] px-4 py-2 rounded-full font-semibold text-xs md:text-sm border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              showAdvancedFilters
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-on-surface-variant border-outline-variant hover:bg-secondary-container/20'
            }`}
          >
            <span className="material-symbols-outlined text-lg">tune</span>
            Filter
          </button>

          {/* Toggle "Hanya terverifikasi" — badge ✓ resep yang sudah dicek admin */}
          <button
            onClick={() => setOnlyVerified((v) => !v)}
            aria-pressed={onlyVerified}
            className={`inline-flex items-center justify-center min-h-[44px] gap-1.5 px-4 py-2 rounded-full font-semibold text-xs md:text-sm border transition-all cursor-pointer ${
              onlyVerified
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-primary border-outline-variant hover:bg-primary/5'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            Terverifikasi
          </button>

          {(searchQuery || activeFilters.length > 0 || maxTime < 120 || priceCategory !== 'Semua' || onlyVerified) && (
            <button
              onClick={handleResetFilters}
              className="min-h-[44px] text-xs md:text-sm font-bold text-error hover:text-error/80 transition-colors flex items-center gap-1 cursor-pointer pl-2"
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
                Filter Waktu & Anggaran
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
                      className={`inline-flex items-center justify-center min-h-[44px] px-4 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
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
                      className={`inline-flex items-center justify-center min-h-[44px] px-4 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                        priceCategory === cat
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-on-surface-variant border-outline-variant hover:bg-secondary-container/30'
                      }`}
                    >
                      {cat === 'Hemat' ? 'Hemat (< Rp 15.000)' : 
                       cat === 'Standar' ? 'Standar (Rp 15.000 - 30.000)' : 
                       cat === 'Premium' ? 'Premium (> Rp 30.000)' : 'Semua'}
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
          <CatalogGridSkeleton />
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
              Maaf, kami tidak dapat menemukan resep yang sesuai dengan kriteria pencarian dan filtermu. Silakan coba atur ulang filter.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-6 px-6 py-2.5 bg-primary text-white font-bold rounded-full hover:bg-primary-container transition-all cursor-pointer shadow-md"
            >
              Atur Ulang Filter
            </button>
          </div>
        ) : (
          <div id="catalog-recipe-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {visibleRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="recipe-card-shadow bg-surface-container rounded-2xl overflow-hidden group cursor-pointer hover:-translate-y-0.5 transition-all duration-300 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => { setSelectedRecipeForDetail(recipe); trackRecipeView(recipe.id, recipe.title); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedRecipeForDetail(recipe);
                    trackRecipeView(recipe.id, recipe.title);
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
                  {recipe.isVerified && (
                    <div className="absolute top-2 right-2" title="Terverifikasi admin">
                      <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-[15px]">verified</span>
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

                  {/* Waktu masak & kalori disembunyikan sementara */}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Muat lebih banyak — pagination sisi-klien (hilang bila semua tampil) */}
        {hasMore && (
          <div className="mt-12 text-center">
            <button
              onClick={() => setVisibleCount((c) => c + RECIPES_PER_PAGE)}
              className="px-8 py-3 rounded-full border border-secondary text-secondary font-bold hover:bg-secondary-container/20 transition-all cursor-pointer"
            >
              Muat Lebih Banyak Resep
            </button>
            <p className="mt-3 text-xs text-on-surface-variant">
              Menampilkan {visibleRecipes.length} dari {filteredRecipes.length} resep
            </p>
          </div>
        )}
      </section>

      {/* -------------------- DETAIL RESEP MODAL -------------------- */}
      {selectedRecipeForDetail && (
        <RecipeDetailModal
          recipe={selectedRecipeForDetail}
          isSaved={savedIds.has(selectedRecipeForDetail.id)}
          onToggleSave={handleToggleSaved}
          onClose={() => setSelectedRecipeForDetail(null)}
          showAddToPlan={true}
          onAddToPlan={(recipe) => {
            setSelectedRecipeForPlan(recipe);
            setSelectedRecipeForDetail(null);
          }}
        />
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
                  Pilih Waktu Makan
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
                  Slot <strong className="text-on-surface">{mealOptions.find((m) => m.value === planMeal)?.label}</strong> hari <strong className="text-on-surface">{planDay}</strong> sudah terisi dengan <strong className="text-on-surface">{existingSlot.title}</strong>. Konfirmasi untuk mengganti menu tersebut.
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
