import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getRecipes,
  getSavedRecipeIds,
  saveRecipe,
  unsaveRecipe,
  getMyLikedRecipeIds,
  toggleLikeRecipe,
  deleteRecipe,
} from '../services/recipeService.js';
import { getActiveDietTags, sampleDietTags } from '../services/dietService.js';
import { getProfile } from '../services/profileService.js';
import { usePlan } from '../hooks/usePlan.js';
import { useAuth } from '../hooks/useAuth.js';
import { ModalSheet } from '../components/ModalSheet.jsx';
import { Modal } from '../components/Modal.jsx';
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
  const navigate = useNavigate();
  const { showToast, weeklyPlan } = usePlan();
  const { user, isAnonymous } = useAuth();

  // State untuk Auth Modal Soft-Gated Tamu
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState({ icon: 'lock', title: '', description: '', from: '/catalog' });

  const triggerAuthModal = (title, description, icon = 'lock', from = '/catalog') => {
    setAuthModalMessage({ icon, title, description, from });
    setAuthModalOpen(true);
  };

  const handleCreateRecipeClick = (e) => {
    if (isAnonymous) {
      e.preventDefault();
      triggerAuthModal(
        'Buat & Bagikan Resep',
        'Daftar akun gratis dalam 10 detik untuk menulis dan membagikan resep kreasimu ke komunitas CookPlan.',
        'edit_note',
        '/recipes/create'
      );
    }
  };

  // Toggle simpan/hapus resep (optimistic + rollback bila gagal).
  const handleToggleSaved = async (recipe) => {
    if (isAnonymous) {
      triggerAuthModal(
        'Simpan Resep Favoritmu',
        'Daftar akun gratis dalam 10 detik untuk menyimpan resep favoritmu ke koleksi pribadi!',
        'bookmark'
      );
      return;
    }
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

  // Toggle like resep (optimistic + rollback bila gagal).
  const handleToggleLike = async (recipe, e) => {
    if (e) e.stopPropagation();
    if (isAnonymous) {
      triggerAuthModal(
        'Sukai Resep',
        'Daftar akun gratis dalam 10 detik untuk menyukai masakan favoritmu!',
        'favorite'
      );
      return;
    }
    const id = recipe.id;
    const isLiked = likedIds.has(id);

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(id); else next.add(id);
      return next;
    });

    setRecipes((prevRecipes) =>
      prevRecipes.map((r) => {
        if (r.id === id) {
          const count = r.likesCount ?? 0;
          return { ...r, likesCount: isLiked ? Math.max(0, count - 1) : count + 1 };
        }
        return r;
      })
    );

    if (selectedRecipeForDetail?.id === id) {
      setSelectedRecipeForDetail((prev) => {
        if (!prev) return null;
        const count = prev.likesCount ?? 0;
        return { ...prev, likesCount: isLiked ? Math.max(0, count - 1) : count + 1 };
      });
    }

    try {
      await toggleLikeRecipe(id, !isLiked);
      showToast(isLiked ? 'Menyukai resep dibatalkan.' : `Menyukai "${recipe.title}"!`);
    } catch (err) {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(id); else next.delete(id);
        return next;
      });
      setRecipes((prevRecipes) =>
        prevRecipes.map((r) => {
          if (r.id === id) {
            const count = r.likesCount ?? 0;
            return { ...r, likesCount: isLiked ? count + 1 : Math.max(0, count - 1) };
          }
          return r;
        })
      );
      if (selectedRecipeForDetail?.id === id) {
        setSelectedRecipeForDetail((prev) => {
          if (!prev) return null;
          const count = prev.likesCount ?? 0;
          return { ...prev, likesCount: isLiked ? count + 1 : Math.max(0, count - 1) };
        });
      }
      showToast(err.message || 'Gagal memperbarui Like.');
    }
  };

  // Bank resep dari DB (Supabase) — menggantikan mockRecipes statis.
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Catalog Tab: 'semua' | 'komunitas' | 'tersimpan' | 'resep-saya'
  const [activeTab, setActiveTab] = useState('semua');
  const [myRecipesFilter, setMyRecipesFilter] = useState('semua'); // 'semua' | 'publik' | 'draf'
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Sorting: 'newest' | 'popular'
  const [sortBy, setSortBy] = useState('newest');

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRecipe(deleteTarget.id);
      showToast(`Resep "${deleteTarget.title}" berhasil dihapus.`);
      setRecipes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Gagal menghapus resep:", err);
      showToast(err.message || 'Gagal menghapus resep.');
    } finally {
      setDeleting(false);
    }
  };

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
  // Set id resep yang disukai user (like).
  const [likedIds, setLikedIds] = useState(() => new Set());

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

  // Muat daftar id resep yang disukai (like).
  useEffect(() => {
    let active = true;
    getMyLikedRecipeIds()
      .then((ids) => { if (active) setLikedIds(new Set(ids)); })
      .catch((err) => { console.error('Gagal memuat resep disukai:', err); });
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



  // Toggle quick filter tag
  const handleToggleFilter = (filterName) => {
    if (activeFilters.includes(filterName)) {
      setActiveFilters(activeFilters.filter((f) => f !== filterName));
    } else {
      setActiveFilters([...activeFilters, filterName]);
    }
  };

  const handleResetFilters = () => {
    setActiveTab('semua');
    setSortBy('newest');
    setSearchQuery('');
    setActiveFilters([]);
    setMaxTime(120);
    setPriceCategory('Semua');
    setOnlyVerified(false);
  };

  // Filter recipes based on tab, search query, quick filters, and advanced criteria
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      // 0. Catalog Tab Filter
      if (activeTab === 'komunitas' && !recipe.userId) return false;
      if (activeTab === 'tersimpan' && !savedIds.has(recipe.id)) return false;
      if (activeTab === 'resep-saya') {
        if (!user || recipe.userId !== user.id) return false;
        if (myRecipesFilter === 'publik' && !recipe.isPublic) return false;
        if (myRecipesFilter === 'draf' && recipe.isPublic) return false;
      }

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
        const matchesAnyActive = activeFilters.some((slug) =>
          recipeMatchesDiet(recipe, slug, dietLabelOf.get(slug))
        );
        if (!matchesAnyActive) return false;
      }

      // 3. Max Cooking Time
      if (maxTime < 120 && recipe.readyInMinutes > maxTime) return false;

      // 4. Price Category
      const perServing = recipe.priceIdr / (recipe.baseServings || 1);
      if (priceCategory === 'Hemat' && perServing >= 15000) return false;
      if (priceCategory === 'Standar' && (perServing < 15000 || perServing > 30000)) return false;
      if (priceCategory === 'Premium' && perServing <= 30000) return false;

      // 5. Hanya terverifikasi admin
      if (onlyVerified && !recipe.isVerified) return false;

      return true;
    });
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [recipes, activeTab, myRecipesFilter, savedIds, searchQuery, activeFilters, maxTime, priceCategory, onlyVerified, dietLabelOf, user]);

  // Sort recipes based on sortBy selector ('newest' vs 'popular')
  const sortedRecipes = useMemo(() => {
    return [...filteredRecipes].sort((a, b) => {
      if (sortBy === 'popular') {
        const likesA = a.likesCount ?? 0;
        const likesB = b.likesCount ?? 0;
        if (likesB !== likesA) return likesB - likesA;
      }
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return timeB - timeA;
    });
  }, [filteredRecipes, sortBy]);

  // Reset pagination ke halaman pertama tiap kali kriteria filter berubah
  const filterSig = `${activeTab}|${sortBy}|${searchQuery}|${activeFilters.join(',')}|${maxTime}|${priceCategory}|${onlyVerified}`;
  const [lastFilterSig, setLastFilterSig] = useState(filterSig);
  if (filterSig !== lastFilterSig) {
    setLastFilterSig(filterSig);
    setVisibleCount(RECIPES_PER_PAGE);
  }

  const visibleRecipes = sortedRecipes.slice(0, visibleCount);
  const hasMore = visibleCount < sortedRecipes.length;

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

        {/* Unified Search & Control Bar */}
        <div className="max-w-4xl mx-auto space-y-4 mb-6">
          {/* Row 1: Search Input + Sort Selector + Filter Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 w-full group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl group-focus-within:text-primary transition-colors">
                search
              </span>
              <input
                id="catalog-search-input"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                className="w-full pl-11 pr-8 py-2.5 rounded-full border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-xs transition-all text-sm font-medium"
                placeholder="Cari resep atau bahan masakan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                  aria-label="Hapus pencarian"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
                </button>
              )}
            </div>

            {/* Sort Selector & Extra Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-white border border-outline-variant rounded-full px-3.5 py-2 shadow-xs">
                <span className="material-symbols-outlined text-base text-primary">sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-xs font-bold text-on-surface focus:outline-none cursor-pointer pr-1"
                >
                  <option value="newest">Terbaru</option>
                  <option value="popular">Paling Populer</option>
                </select>
              </div>

              {/* Toggle Advanced Filters Button */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-3.5 py-2 rounded-full font-bold text-xs border transition-all flex items-center gap-1 cursor-pointer shadow-xs ${
                  showAdvancedFilters
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-on-surface-variant border-outline-variant hover:bg-secondary-container/20'
                }`}
              >
                <span className="material-symbols-outlined text-base">tune</span>
                Filter
              </button>

              {/* Toggle Verified Only */}
              <button
                onClick={() => setOnlyVerified((v) => !v)}
                aria-pressed={onlyVerified}
                className={`px-3.5 py-2 rounded-full font-bold text-xs border transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                  onlyVerified
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-primary border-outline-variant hover:bg-primary/5'
                }`}
              >
                <span className="material-symbols-outlined text-base">verified</span>
                Verified
              </button>

              {(searchQuery || activeFilters.length > 0 || maxTime < 120 || priceCategory !== 'Semua' || onlyVerified) && (
                <button
                  onClick={handleResetFilters}
                  className="p-2 text-xs font-bold text-error hover:bg-error/10 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                  title="Atur Ulang Filter"
                >
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Chip preferensi diet — dinamis dari diet_tags */}
          <div id="catalog-filter-chips" className="flex flex-wrap justify-center items-center gap-2 pt-1">
            {dietSample.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleToggleFilter(opt.value)}
                className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full font-semibold text-xs border transition-all cursor-pointer ${
                  activeFilters.includes(opt.value)
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-surface-cream/50 text-primary border-outline-variant hover:bg-primary-container hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={reshuffleDiet}
              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-primary/50 text-primary hover:bg-primary/5 active:scale-95 transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">casino</span>
              Lainnya
            </button>
          </div>
        </div>

        {/* Sliding Panel / Advanced Filters Section */}
        {showAdvancedFilters && (
          <div className="max-w-2xl mx-auto mb-6 p-6 bg-white border border-outline-variant rounded-3xl shadow-sm animate-fade-in text-left">
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
              {/* Max Cooking Time Filter */}
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
        {/* Catalog Tab Navigation Bar & Sorting Selector */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 pb-3 border-b border-outline-variant/50">
          {/* Tabs: Semua | Komunitas | Tersimpan | Resep Saya */}
          <div className="flex bg-surface-container-high p-1 rounded-full border border-outline-variant/50 gap-1 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('semua')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'semua'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setActiveTab('komunitas')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'komunitas'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-base">groups</span>
              Komunitas
            </button>
            <button
              onClick={() => setActiveTab('tersimpan')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'tersimpan'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-base">bookmark</span>
              Tersimpan ({savedIds.size})
            </button>
            {user && (
              <button
                onClick={() => setActiveTab('resep-saya')}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'resep-saya'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-base">edit_note</span>
                Resep Saya
              </button>
            )}
          </div>
        </div>

        {/* Sub-Filter Bar for Resep Saya */}
        {activeTab === 'resep-saya' && user && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5 p-3 bg-surface-cream/40 rounded-2xl border border-outline-variant/40">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {[
                { id: 'semua', label: 'Semua Resep', count: recipes.filter((r) => r.userId === user.id).length },
                { id: 'publik', label: 'Publik', count: recipes.filter((r) => r.userId === user.id && r.isPublic).length },
                { id: 'draf', label: 'Draf Pribadi', count: recipes.filter((r) => r.userId === user.id && !r.isPublic).length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMyRecipesFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    myRecipesFilter === tab.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white text-on-surface-variant border border-outline-variant hover:bg-primary/5'
                  }`}
                >
                  {tab.label} <span className="opacity-80">({tab.count})</span>
                </button>
              ))}
            </div>

            <Link
              to="/recipes/create"
              onClick={handleCreateRecipeClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white font-bold text-xs hover:bg-primary-container transition-all shadow-xs shrink-0 cursor-pointer w-full sm:w-auto justify-center"
            >
              <span className="material-symbols-outlined text-base">add</span>
              + Buat Resep Baru
            </Link>
          </div>
        )}

        {loading ? (
          <CatalogGridSkeleton />
        ) : loadError ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-error/30 p-8">
            <span className="material-symbols-outlined text-5xl text-error mb-4">error</span>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Gagal Memuat Resep</h3>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto">{loadError}</p>
          </div>
        ) : sortedRecipes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-outline-variant p-8">
            <span className="material-symbols-outlined text-5xl md:text-6xl text-outline-variant mb-4">
              {activeTab === 'resep-saya' ? 'menu_book' : 'sentiment_dissatisfied'}
            </span>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">
              {activeTab === 'resep-saya' ? 'Belum Ada Resep Kreasi' : 'Resep Tidak Ditemukan'}
            </h3>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto">
              {activeTab === 'resep-saya'
                ? 'Anda belum pernah membuat resep kreasi sendiri. Yuk ciptakan resep andalan Anda sekarang!'
                : 'Maaf, kami tidak dapat menemukan resep yang sesuai dengan kriteria pencarian dan filtermu. Silakan coba atur ulang filter.'}
            </p>
            {activeTab === 'resep-saya' ? (
              <Link
                to="/recipes/create"
                onClick={handleCreateRecipeClick}
                className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-full hover:bg-primary-container transition-all cursor-pointer shadow-md"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Buat Resep Baru
              </Link>
            ) : (
              <button
                onClick={handleResetFilters}
                className="mt-6 px-6 py-2.5 bg-primary text-white font-bold rounded-full hover:bg-primary-container transition-all cursor-pointer shadow-md"
              >
                Atur Ulang Filter
              </button>
            )}
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
                <div className="relative h-28 sm:h-32 md:h-36 overflow-hidden">
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Status Badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    {activeTab === 'resep-saya' ? (
                      <span className={`px-2 py-0.5 rounded-full font-extrabold text-[9px] uppercase tracking-wide shadow-xs flex items-center gap-0.5 text-white ${
                        recipe.isPublic ? 'bg-emerald-600' : 'bg-amber-600'
                      }`}>
                        <span className="material-symbols-outlined text-[11px]">{recipe.isPublic ? 'public' : 'lock'}</span>
                        {recipe.isPublic ? 'Publik' : 'Draf'}
                      </span>
                    ) : !recipe.userId ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600/90 text-white font-bold text-[9px] shadow-xs tracking-wide flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">verified</span>
                        Official
                      </span>
                    ) : recipe.isVerified ? (
                      <span className="px-2 py-0.5 rounded-full bg-sky-500/90 text-white font-bold text-[9px] shadow-xs tracking-wide flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">verified</span>
                        Terverifikasi
                      </span>
                    ) : null}
                  </div>

                  {/* Interactive Like Pill Button */}
                  <button
                    onClick={(e) => handleToggleLike(recipe, e)}
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded-full backdrop-blur-md border text-[10px] font-extrabold flex items-center gap-1 shadow-xs transition-transform active:scale-90 cursor-pointer ${
                      likedIds.has(recipe.id)
                        ? 'bg-rose-500 text-white border-rose-400'
                        : 'bg-black/40 text-white border-white/30 hover:bg-black/60'
                    }`}
                    title={likedIds.has(recipe.id) ? 'Batal Suka' : 'Sukai Resep'}
                  >
                    <span className="material-symbols-outlined text-[12px]">favorite</span>
                    <span>{recipe.likesCount ?? 0}</span>
                  </button>
                </div>

                {/* Content Section */}
                <div className="p-2.5 md:p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-1.5 mb-1">
                      <h3 className="text-xs md:text-sm font-bold text-on-surface hover:text-primary transition-colors leading-tight line-clamp-2 flex-1">
                        {recipe.title}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecipeForPlan(recipe);
                        }}
                        className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
                        title="Tambah ke Rencana Mingguan"
                        aria-label="Tambah ke Rencana Mingguan"
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span>
                      </button>
                    </div>

                    {/* Author Attribution Line */}
                    {recipe.userId && (
                      <p className="text-[11px] font-semibold text-primary/80 mb-1.5 truncate flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">person</span>
                        Oleh @{recipe.authorName || 'Pengguna'}
                      </p>
                    )}
                  </div>

                  {/* Card Bottom Meta Bar */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/30 text-[11px] text-on-surface-variant font-medium">
                    <span className="truncate">
                      {recipe.readyInMinutes ? `${recipe.readyInMinutes} mnt` : `${recipe.baseServings || 2} porsi`}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSaved(recipe);
                      }}
                      className={`transition-all cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        savedIds.has(recipe.id)
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-on-surface-variant hover:text-primary hover:bg-primary/10 border border-outline-variant/40'
                      }`}
                      title={savedIds.has(recipe.id) ? 'Resep Tersimpan' : 'Simpan Resep'}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {savedIds.has(recipe.id) ? 'bookmark' : 'bookmark_border'}
                      </span>
                      <span>{savedIds.has(recipe.id) ? 'Tersimpan' : 'Simpan'}</span>
                    </button>
                  </div>

                  {activeTab === 'resep-saya' && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-outline-variant/30 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/recipes/${recipe.id}/edit`);
                        }}
                        className="flex-1 py-1 px-2 rounded-full border border-primary text-primary font-bold text-[11px] hover:bg-primary/5 transition-colors cursor-pointer flex items-center justify-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-xs">edit</span>
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(recipe);
                        }}
                        className="py-1 px-2 rounded-full border border-error/40 text-error font-bold text-[11px] hover:bg-error/10 transition-colors cursor-pointer flex items-center justify-center gap-0.5"
                        title="Hapus Resep"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                  )}
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
              Menampilkan {visibleRecipes.length} dari {sortedRecipes.length} resep
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
          isLiked={likedIds.has(selectedRecipeForDetail.id)}
          onToggleLike={handleToggleLike}
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

      {/* Delete Confirmation Modal for User Recipes */}
      <Modal isOpen={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)}>
        <div className="w-full max-w-sm bg-canvas-white rounded-3xl p-6 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-error/10 text-error mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">delete_forever</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-on-surface">Hapus Resep ini?</h3>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Resep <strong className="text-on-surface">"{deleteTarget?.title}"</strong> akan dihapus secara permanen dari CookPlan.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2.5 rounded-full border border-outline-variant text-on-surface-variant font-bold text-xs hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteConfirm}
              className="flex-1 py-2.5 rounded-full bg-error text-white font-bold text-xs hover:bg-error/90 transition-colors shadow-sm cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1"
            >
              {deleting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  Menghapus...
                </>
              ) : (
                'Ya, Hapus'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Soft-Gated Auth Tamu (Tanpa emoji) */}
      <Modal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)}>
        <div className="w-full max-w-sm bg-canvas-white rounded-3xl p-6 shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">{authModalMessage.icon || 'lock'}</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface mb-2">{authModalMessage.title}</h2>
          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
            {authModalMessage.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="flex-1 min-h-11 rounded-full text-sm font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
            >
              Nanti Saja
            </button>
            <Link
              to="/auth"
              state={{ from: authModalMessage.from || '/catalog' }}
              className="flex-1 min-h-11 rounded-full text-sm font-semibold text-on-primary bg-primary hover:shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">person_add</span>
              Daftar / Masuk
            </Link>
          </div>
        </div>
      </Modal>

      {/* Floating Action Button (FAB) "+ Buat Resep" */}
      <Link
        to="/recipes/create"
        onClick={handleCreateRecipeClick}
        className="fixed bottom-20 md:bottom-8 right-6 z-30 inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-primary text-white font-extrabold text-sm shadow-xl hover:bg-primary-container hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
        title="Buat Resep Baru"
        aria-label="Buat Resep Baru"
      >
        <span className="material-symbols-outlined text-xl">add</span>
        <span>Buat Resep</span>
      </Link>
    </div>
  );
}

export default RecipeCatalog;
