import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { getRecipes } from '../services/recipeService.js';
import { usePlan } from '../hooks/usePlan.js';
import { useAuth } from '../hooks/useAuth.js';
import { generatePrepPlan } from '../services/aiService.js';
import { ModalSheet } from '../components/ModalSheet.jsx';
import { PlannerSkeleton } from '../components/Skeleton.jsx';
import { getWeekDates, getWeekStart, weekKeyToDate, formatWeekRange, isToday } from '../utils/week.js';
import { RecipeDetailModal } from '../components/RecipeDetailModal.jsx';
import { CookingModeModal } from '../components/CookingModeModal.jsx';

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

// Index hari (0=Senin..6=Minggu) untuk "hari ini", atau -1 bila hari ini di luar
// minggu yang sedang dilihat. Dipakai untuk default tab mobile.
function todayIndexIn(weekStartDate) {
  return getWeekDates(weekStartDate).findIndex(isToday);
}


// Ambil 3 resep acak untuk "Inspirasi Menu". Dipanggil di callback load (bukan
// saat render) supaya bebas dari aturan purity React.
function pickThree(list) {
  if (list.length <= 3) return list;
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function WeeklyPlanner({ 
  weeklyPlan, onSetSlot, onRemoveSlot, onToggleCookedStatus, 
  prepTasks = [], onAddPrepTask, onTogglePrepTask, onDeletePrepTask,
  onGoToCatalog, onGoToGenerate, onGenerateShoppingList, onGoToPackages
}) {
  const {
    showToast, restoreSlot, clearAllSlots, loading: planLoading,
    weekStart, isCurrentWeek, goToWeek, goToCurrentWeek,
  } = usePlan();
  const { isAuthenticated } = useAuth();

  const [confirmClear, setConfirmClear] = useState(false);

  // State untuk detail resep & mode masak
  const [selectedRecipeForDetail, setSelectedRecipeForDetail] = useState(null);
  const [activeCookingRecipe, setActiveCookingRecipe] = useState(null);
  const [cookingTarget, setCookingTarget] = useState(null); // { day, meal }
  const [newPrepText, setNewPrepText] = useState('');
  const [prepSuggestions, setPrepSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Slot yang sedang diisi: { day, meal } | null
  const [pickerTarget, setPickerTarget] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelectedRecipe, setPickerSelectedRecipe] = useState(null);
  const [pickerServings, setPickerServings] = useState(2);
  // Default tab mobile ke "hari ini" bila berada di minggu berjalan, selain itu Senin.
  const [activeMobileDay, setActiveMobileDay] = useState(() => {
    const idx = todayIndexIn(getWeekStart());
    return DAYS[idx >= 0 ? idx : 0].key;
  });

  // Hari ini dalam Bahasa Indonesia
  const todayIndo = useMemo(() => {
    const dayName = new Date().toLocaleDateString('id-ID', { weekday: 'long' });
    return dayName.charAt(0).toUpperCase() + dayName.slice(1);
  }, []);

  const totalTasks = prepTasks.length;
  const completedTasks = prepTasks.filter(t => t.isCompleted).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Bank resep dari DB (untuk picker & inspirasi).
  const [recipes, setRecipes] = useState([]);
  // Sampel acak untuk "Inspirasi Menu" — dihitung sekali saat resep dimuat.
  const [recommended, setRecommended] = useState([]);
  useEffect(() => {
    let active = true;
    getRecipes()
      .then((data) => { if (active) { setRecipes(data); setRecommended(pickThree(data)); } })
      .catch((err) => {
        // Audit Copilot: kegagalan jangan silent — log supaya bisa didiagnosis,
        // UI fallback tetap aman karena setRecipes default []
        console.error("Gagal memuat resep:", err);
      });
    return () => { active = false; };
  }, []);

  // Hasilkan rekomendasi tugas food prep berdasarkan resep yang aktif
  const generatePrepSuggestions = useCallback(() => {
    const plannedRecipeIds = new Set();
    Object.values(weeklyPlan).forEach(daySlots => {
      if (!daySlots) return;
      Object.values(daySlots).forEach(slot => {
        if (slot && slot.recipeId) {
          plannedRecipeIds.add(slot.recipeId);
        }
      });
    });

    if (plannedRecipeIds.size === 0) {
      return [];
    }

    const suggestions = [];
    const bumbuKeywords = ["bawang", "cabai", "cabe", "kemiri", "jahe", "kunyit", "kencur", "serai", "sereh", "lengkuas", "laos", "ketumbar", "lada", "merica", "pala"];
    const proteinKeywords = ["ayam", "daging", "sapi", "ikan", "tuna", "tenggiri", "salmon", "udang", "cumi", "kambing", "tempe", "tahu", "bakso", "sosis", "telur", "dada", "paha", "fillet"];
    const sayurKeywords = ["wortel", "kangkung", "bayam", "kentang", "tomat", "kol", "kubis", "buncis", "kacang panjang", "brokoli", "sawi", "selada", "timun", "daun bawang", "seledri", "terong", "labu", "jagung", "jamur", "daun jeruk", "daun salam", "kemangi"];

    plannedRecipeIds.forEach(id => {
      const fullRecipe = recipes.find(r => r.id === id);
      if (!fullRecipe) return;

      const title = fullRecipe.title;
      const ingredients = fullRecipe.ingredients ?? [];
      const instructionsText = (fullRecipe.instructions ?? []).join(" ").toLowerCase();

      const detectedBumbu = [];
      const detectedProtein = [];
      const detectedSayur = [];

      ingredients.forEach(ing => {
        const nameLower = ing.name.toLowerCase();
        if (proteinKeywords.some(kw => nameLower.includes(kw))) {
          detectedProtein.push(ing.name);
        } else if (bumbuKeywords.some(kw => nameLower.includes(kw))) {
          detectedBumbu.push(ing.name);
        } else if (sayurKeywords.some(kw => nameLower.includes(kw))) {
          detectedSayur.push(ing.name);
        }
      });

      // 1. Rekomendasi Protein
      if (detectedProtein.length > 0) {
        const listStr = detectedProtein.map(p => p.toLowerCase()).slice(0, 3).join(", ");
        suggestions.push({
          id: `${id}-protein`,
          taskText: `Bagi porsi & simpan protein (${listStr}) untuk ${title} di freezer/chiller`,
          recipeTitle: title
        });
      }

      // 2. Rekomendasi Bumbu
      if (detectedBumbu.length > 0) {
        const listStr = detectedBumbu.map(b => b.toLowerCase()).slice(0, 4).join(", ");
        suggestions.push({
          id: `${id}-bumbu`,
          taskText: `Kupas & siapkan bumbu (${listStr}) untuk ${title}`,
          recipeTitle: title
        });
      }

      // 3. Rekomendasi Sayur
      if (detectedSayur.length > 0) {
        const listStr = detectedSayur.map(s => s.toLowerCase()).slice(0, 4).join(", ");
        suggestions.push({
          id: `${id}-sayur`,
          taskText: `Cuci & potong sayur (${listStr}) untuk ${title}`,
          recipeTitle: title
        });
      }

      // 4. Rekomendasi Khusus dari Instruksi
      const matchedKeys = new Set();
      const keywords = [
        { key: "rendam", label: "Rendam bahan untuk" },
        { key: "ungkep", label: "Ungkep bahan untuk" },
        { key: "marinasi", label: "Marinasi bahan untuk" },
        { key: "marinate", label: "Marinasi bahan untuk" }
      ];
      keywords.forEach(kw => {
        if (instructionsText.includes(kw.key) && !matchedKeys.has(kw.label)) {
          suggestions.push({
            id: `${id}-${kw.key}`,
            taskText: `${kw.label} ${title}`,
            recipeTitle: title
          });
          matchedKeys.add(kw.label);
        }
      });
    });

    return suggestions;
  }, [recipes, weeklyPlan]);

  const handleAutoSuggest = useCallback(async () => {
    // 1. GUEST MODE FALLBACK
    if (!isAuthenticated) {
      const suggestions = generatePrepSuggestions();
      if (suggestions.length > 0) {
        const existingTexts = new Set(prepTasks.map(t => t.taskText.toLowerCase()));
        const filtered = suggestions.filter(s => !existingTexts.has(s.taskText.toLowerCase()));
        
        if (filtered.length === 0) {
          showToast("Semua saran food prep minggu ini sudah ada di daftar Anda.");
          setPrepSuggestions([]);
          setShowSuggestions(false);
        } else {
          setPrepSuggestions(filtered);
          setShowSuggestions(true);
          showToast("Menampilkan saran dasar. Masuk/Daftar untuk membuka saran AI Pro yang teroptimasi!");
        }
      } else {
        showToast("Tidak menemukan saran food prep dari menu minggu ini.");
        setPrepSuggestions([]);
        setShowSuggestions(false);
      }
      return;
    }

    // 2. LOGGED IN MODE: API CALL (AI PRO)
    const plannedRecipeIds = new Set();
    Object.values(weeklyPlan).forEach(daySlots => {
      if (!daySlots) return;
      Object.values(daySlots).forEach(slot => {
        if (slot && slot.recipeId) {
          plannedRecipeIds.add(slot.recipeId);
        }
      });
    });

    if (plannedRecipeIds.size === 0) {
      showToast("Belum ada menu yang direncanakan minggu ini.", { variant: "error" });
      return;
    }

    const resolvedRecipes = [];
    plannedRecipeIds.forEach(id => {
      const r = recipes.find(rec => rec.id === id);
      if (r) resolvedRecipes.push(r);
    });

    setLoadingSuggestions(true);
    try {
      const res = await generatePrepPlan(resolvedRecipes);
      const aiTasks = res?.prep_tasks ?? [];
      
      if (aiTasks.length > 0) {
        const existingTexts = new Set(prepTasks.map(t => t.taskText.toLowerCase()));
        const filtered = aiTasks
          .map((taskText, idx) => ({ id: `ai-${idx}`, taskText }))
          .filter(s => !existingTexts.has(s.taskText.toLowerCase()));
          
        if (filtered.length === 0) {
          showToast("Semua saran food prep AI sudah ada di daftar Anda.");
          setPrepSuggestions([]);
          setShowSuggestions(false);
        } else {
          setPrepSuggestions(filtered);
          setShowSuggestions(true);
          showToast("Berhasil memuat saran food prep dari AI.");
        }
      } else {
        showToast("AI tidak mendeteksi langkah food prep khusus untuk menu minggu ini.");
      }
    } catch (err) {
      console.error("Gagal generate prep AI:", err);
      showToast("Gagal memanggil AI. Menampilkan saran lokal sebagai fallback...", { variant: "error" });
      // Fallback ke pemindai lokal
      const localSuggestions = generatePrepSuggestions();
      const existingTexts = new Set(prepTasks.map(t => t.taskText.toLowerCase()));
      const filtered = localSuggestions.filter(s => !existingTexts.has(s.taskText.toLowerCase()));
      if (filtered.length > 0) {
        setPrepSuggestions(filtered);
        setShowSuggestions(true);
      } else {
        setPrepSuggestions([]);
        setShowSuggestions(false);
      }
    } finally {
      setLoadingSuggestions(false);
    }
  }, [generatePrepSuggestions, prepTasks, recipes, showToast, weeklyPlan, isAuthenticated]);

  const handleAddAllSuggestions = useCallback(async () => {
    if (prepSuggestions.length === 0) return;
    for (const sug of prepSuggestions) {
      await onAddPrepTask(sug.taskText);
    }
    showToast(`${prepSuggestions.length} catatan persiapan ditambahkan.`);
    setPrepSuggestions([]);
    setShowSuggestions(false);
  }, [prepSuggestions, onAddPrepTask, showToast]);

  const handleAddSingleSuggestion = useCallback(async (sug) => {
    await onAddPrepTask(sug.taskText);
    setPrepSuggestions(prev => prev.filter(s => s.id !== sug.id));
    showToast(`"${sug.taskText}" ditambahkan.`);
  }, [onAddPrepTask, showToast]);

  const handleClearCompleted = useCallback(async () => {
    const completedList = prepTasks.filter(t => t.isCompleted);
    if (completedList.length === 0) return;
    for (const t of completedList) {
      await onDeletePrepTask(t.id);
    }
    showToast("Tugas selesai telah dibersihkan.");
  }, [prepTasks, onDeletePrepTask, showToast]);

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

  // Date object Senin..Minggu untuk minggu yang sedang dilihat. Diturunkan dari
  // weekStart (PlanContext) — satu sumber kebenaran, ikut berubah saat navigasi.
  const weekStartDate = useMemo(() => weekKeyToDate(weekStart), [weekStart]);
  const weekDates = useMemo(() => getWeekDates(weekStartDate), [weekStartDate]);
  const weekRangeLabel = useMemo(() => formatWeekRange(weekStartDate), [weekStartDate]);

  // Saat minggu berganti, pindahkan tab mobile ke hari ini (bila masih dalam
  // minggu tsb) atau ke Senin. Pola "adjust state during render" yang
  // direkomendasikan React — tanpa useEffect, tanpa cascading render.
  const [trackedWeek, setTrackedWeek] = useState(weekStart);
  if (trackedWeek !== weekStart) {
    setTrackedWeek(weekStart);
    const idx = todayIndexIn(weekStartDate);
    setActiveMobileDay(DAYS[idx >= 0 ? idx : 0].key);
  }

  // Desktop: saat grid muncul (atau minggu berganti), geser kolom hari ini ke
  // tengah area scroll. Pakai perhitungan scrollLeft manual via getBoundingClientRect
  // (bukan scrollIntoView yang bisa ikut menggeser scroll vertikal halaman).
  // No-op bila kolom hari ini tak ada (di luar minggu ini) atau grid muat penuh.
  const gridScrollRef = useRef(null);
  const todayColRef = useRef(null);
  useEffect(() => {
    if (planLoading) return; // tunggu grid asli render, bukan skeleton
    const container = gridScrollRef.current;
    const col = todayColRef.current;
    if (!container || !col) return;
    if (container.scrollWidth <= container.clientWidth) return; // tak perlu scroll
    const cRect = container.getBoundingClientRect();
    const colRect = col.getBoundingClientRect();
    const delta = (colRect.left - cRect.left) - (container.clientWidth - col.clientWidth) / 2;
    container.scrollTo({ left: container.scrollLeft + delta, behavior: 'auto' });
  }, [weekStartDate, planLoading]);

  // Mobile: baris tab hari bisa di-scroll horizontal; tab hari aktif (default =
  // hari ini) sering di luar layar (mis. Minggu paling kanan) sehingga seolah
  // planner terbuka di Senin. Geser tab aktif ke tengah saat dibuka/ganti hari.
  const mobileTabsRef = useRef(null);
  const activeTabRef = useRef(null);
  useEffect(() => {
    if (planLoading) return; // tab baru ada setelah grid asli render
    const container = mobileTabsRef.current;
    const tab = activeTabRef.current;
    if (!container || !tab) return;
    const cRect = container.getBoundingClientRect();
    const tRect = tab.getBoundingClientRect();
    const delta = (tRect.left - cRect.left) - (container.clientWidth - tab.clientWidth) / 2;
    container.scrollTo({ left: container.scrollLeft + delta, behavior: 'smooth' });
  }, [activeMobileDay, weekStartDate, planLoading]);

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
    showToast('Daftar belanja berhasil dibuat berdasarkan rencana makanmu!');
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
                Atur jadwal makanmu untuk hidup yang lebih sehat dan teratur.
              </p>
            </div>

            {/* CTA generate AI — hanya saat tidak loading & planner kosong
                (status kosong belum diketahui selama plan dihidrasi). */}
            {!planLoading && stats.filled === 0 && (
              <div className="mb-6 rounded-panel border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-primary mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    Bingung mau masak apa minggu ini?
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Pilih paket menu siap saji kami atau biarkan AI menyusun menu sesuai anggaran dan preferensimu.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5 shrink-0">
                  <button
                    onClick={onGoToPackages}
                    className="px-5 py-3 border border-primary text-primary rounded-full font-semibold text-sm hover:bg-primary/5 transition cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                    Pilih Paket Menu
                  </button>
                  <button
                    id="planner-ai-btn"
                    onClick={onGoToGenerate}
                    className="px-5 py-3 bg-primary text-white rounded-full font-bold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    Susun Menu dengan AI
                  </button>
                </div>
              </div>
            )}

            {/* Navigasi minggu */}
            <div className="mb-6 flex items-center justify-between gap-3 rounded-panel border border-outline-variant bg-white/60 px-3 py-2.5">
              <button
                onClick={() => goToWeek(-1)}
                aria-label="Minggu sebelumnya"
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-on-surface hover:bg-secondary-container/40 active:scale-95 transition cursor-pointer"
              >
                <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
              </button>

              <div className="min-w-0 text-center" aria-live="polite">
                <div className="flex items-center justify-center gap-1.5 font-bold text-on-surface truncate">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">calendar_month</span>
                  <span className="truncate">{weekRangeLabel}</span>
                </div>
                {isCurrentWeek ? (
                  <span className="text-xs text-on-surface-variant">Minggu ini</span>
                ) : (
                  <button
                    onClick={goToCurrentWeek}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Kembali ke minggu ini
                  </button>
                )}
              </div>

              <button
                onClick={() => goToWeek(1)}
                aria-label="Minggu berikutnya"
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-on-surface hover:bg-secondary-container/40 active:scale-95 transition cursor-pointer"
              >
                <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </button>
            </div>

            {/* Hanya area grid yang diganti skeleton; navigasi minggu di atas
                tetap terlihat saat berpindah minggu. */}
            {planLoading ? (
              <PlannerSkeleton />
            ) : (
            <>
            {/* Mobile Days Tabs */}
            <div ref={mobileTabsRef} className="md:hidden flex overflow-x-auto hide-scrollbar gap-2 mb-6 -mx-5 px-5 pb-2">
              {DAYS.map((day, dayIdx) => {
                const today = isToday(weekDates[dayIdx]);
                return (
                  <button
                    key={day.key}
                    ref={activeMobileDay === day.key ? activeTabRef : null}
                    onClick={() => setActiveMobileDay(day.key)}
                    className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all shadow-sm cursor-pointer ${activeMobileDay === day.key
                        ? 'bg-primary text-white scale-105'
                        : `bg-white hover:bg-surface-variant ${today ? 'border-2 border-primary text-primary' : 'border border-outline-variant text-on-surface-variant'}`
                      }`}
                  >
                    {day.short} <span className="font-medium text-xs opacity-80 ml-1">{weekDates[dayIdx].getDate()}</span>
                    {today && <span className="ml-1 text-[10px] font-bold uppercase">• Hari ini</span>}
                  </button>
                );
              })}
            </div>

            <div id="planner-grid-container" ref={gridScrollRef} className="overflow-x-hidden md:overflow-x-auto hide-scrollbar -mx-5 px-5 md:mx-0 md:px-0">
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
                {DAYS.map((day, dayIdx) => {
                  const today = isToday(weekDates[dayIdx]);
                  return (
                  <div key={day.key} ref={today ? todayColRef : null} className={`relative flex-col gap-4 ${activeMobileDay === day.key ? 'flex' : 'hidden md:flex'}`}>
                    {/* Penanda kolom "hari ini" (desktop): latar + ring di belakang
                        seluruh kolom. Absolute → tidak menggeser layout/alignment. */}
                    {today && (
                      <div aria-hidden className="hidden md:block absolute inset-0 -z-10 rounded-3xl bg-primary/[0.06] ring-1 ring-primary/30 pointer-events-none" />
                    )}
                    {/* Header tanggal */}
                    <div className={`relative text-left md:text-center pb-2 md:pb-4 border-b md:border-none ${today ? 'border-primary/40' : 'border-outline-variant'}`}>
                      <div className={`text-xs font-bold mb-1 uppercase tracking-wide md:block inline-block mr-2 md:mr-0 ${today ? 'text-primary' : 'text-on-surface'}`}>
                        {day.short} <span className="md:hidden">- {weekDates[dayIdx].getDate()}</span>
                      </div>
                      <div className="hidden md:flex justify-center">
                        <span className={`text-2xl font-bold w-11 h-11 flex items-center justify-center rounded-full ${today ? 'bg-primary text-white ring-4 ring-primary/20 shadow-lg shadow-primary/30' : 'text-on-surface'}`}>
                          {weekDates[dayIdx].getDate()}
                        </span>
                      </div>
                      {/* Badge "Hari ini" (desktop) — absolute di bawah header supaya
                          tidak menambah tinggi & merusak kesejajaran kolom lain. */}
                      {today && (
                        <span className="hidden md:block absolute left-1/2 -translate-x-1/2 -bottom-1 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-wider leading-none shadow-sm whitespace-nowrap">
                          Hari ini
                        </span>
                      )}
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
                              onClick={() => {
                                const fullRecipe = recipes.find(r => r.id === slot.recipeId);
                                if (fullRecipe) {
                                  setSelectedRecipeForDetail(fullRecipe);
                                  setCookingTarget({ day: day.key, meal: meal.key });
                                } else {
                                  setSelectedRecipeForDetail({
                                    id: slot.recipeId,
                                    title: slot.title,
                                    imageUrl: slot.imageUrl,
                                    readyInMinutes: slot.readyInMinutes,
                                    calories: slot.calories,
                                    baseServings: slot.servings,
                                    priceIdr: slot.priceIdr,
                                    ingredients: [],
                                    instructions: ["Bahan dan instruksi tidak tersedia untuk resep kustom."]
                                  });
                                  setCookingTarget({ day: day.key, meal: meal.key });
                                }
                              }}
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
                                  {/* Waktu masak disembunyikan sementara */}
                                  <div className="flex items-center gap-1 bg-primary/90 backdrop-blur-md px-2 py-0.5 rounded-full text-white shadow-sm border border-primary-container/30">
                                    <span className="material-symbols-outlined text-[12px]">group</span>
                                    <span className="text-[9px] font-bold tracking-wide">{slot.servings || 2} porsi</span>
                                  </div>
                                </div>
                              </div>
                              {/* Overlay selesai dimasak */}
                              {slot.isCooked && (
                                <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1 z-10 animate-fade-in text-center">
                                  <span className="material-symbols-outlined text-emerald-400 text-3xl font-extrabold bg-emerald-950/90 rounded-full p-2 border border-emerald-500/30">
                                    check_circle
                                  </span>
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">
                                    Selesai Dimasak
                                  </span>
                                </div>
                              )}
                              {/* Tombol hapus */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const savedSlot = weeklyPlan[day.key][meal.key];
                                  onRemoveSlot(day.key, meal.key);
                                  showToast(
                                    `Menu berhasil dihapus dari ${meal.label} hari ${day.key}`,
                                    {
                                      onUndo: () => {
                                        restoreSlot(day.key, meal.key, savedSlot);
                                        showToast('Menu berhasil dikembalikan');
                                      }
                                    }
                                  );
                                }}
                                title="Hapus dari rencana"
                                aria-label={`Hapus ${slot.title} dari ${meal.label} hari ${day.key}`}
                                className="absolute top-2 right-2 w-11 h-11 rounded-full bg-on-surface/50 hover:bg-error text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer z-20"
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
                  );
                })}
              </div>
            </div>
            </>
            )}
          </div>

          {/* ---------------- Sidebar ---------------- */}
          <aside className="lg:w-80 shrink-0 flex flex-col gap-6">
            {/* Widget Hari Ini Masak Apa (Hanya muncul di minggu berjalan) */}
            {isCurrentWeek && (
              <div className="hidden lg:block bg-primary/[0.04] border border-primary/20 rounded-panel p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">local_fire_department</span>
                  <div className="text-left">
                    <h3 className="font-headline-sm text-headline-sm text-primary">Masak Hari Ini</h3>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                      Hari {todayIndo}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {MEALS.map((meal) => {
                    const slot = weeklyPlan?.[todayIndo]?.[meal.key];
                    return (
                      <div key={meal.key} className="flex items-center justify-between p-3 rounded-2xl bg-white border border-outline-variant/60 shadow-sm text-left">
                        <div className="flex flex-col flex-1 pr-2">
                          <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                            {meal.label}
                          </span>
                          <span className="text-xs font-semibold text-on-surface line-clamp-1">
                            {slot ? slot.title : "Belum direncanakan"}
                          </span>
                        </div>
                        
                        {slot ? (
                          slot.isCooked ? (
                            <button
                              onClick={() => onToggleCookedStatus(todayIndo, meal.key, false)}
                              className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 font-bold text-[10px] flex items-center gap-0.5 border border-emerald-200/50 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Tandai belum dimasak"
                            >
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              Selesai
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const fullRecipe = recipes.find(r => r.id === slot.recipeId);
                                if (fullRecipe) {
                                  setActiveCookingRecipe(fullRecipe);
                                  setCookingTarget({ day: todayIndo, meal: meal.key });
                                } else {
                                  setActiveCookingRecipe({
                                    id: slot.recipeId,
                                    title: slot.title,
                                    imageUrl: slot.imageUrl,
                                    readyInMinutes: slot.readyInMinutes,
                                    calories: slot.calories,
                                    baseServings: slot.servings,
                                    priceIdr: slot.priceIdr,
                                    ingredients: [],
                                    instructions: ["Bahan dan instruksi tidak tersedia untuk resep kustom."]
                                  });
                                  setCookingTarget({ day: todayIndo, meal: meal.key });
                                }
                              }}
                              className="px-3 py-1.5 rounded-full bg-primary text-white font-bold text-[10px] flex items-center gap-0.5 hover:bg-primary-container transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              <span className="material-symbols-outlined text-xs">play_arrow</span>
                              Masak
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              setPickerTarget({ day: todayIndo, meal: meal.key });
                              setPickerSearch('');
                            }}
                            className="p-1 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                            title="Tambah Menu"
                          >
                            <span className="material-symbols-outlined text-lg">add_circle</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hapus Semua */}
            {stats.filled > 0 && (
              <div className="border border-error/20 rounded-panel p-4 bg-error/5">
                <p className="text-xs text-on-surface-variant mb-3">
                  Hapus seluruh menu minggu ini sekaligus.
                </p>
                {confirmClear ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-on-surface">Apakah kamu yakin ingin menghapus semua menu?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const snapshot = weeklyPlan;
                          clearAllSlots();
                          setConfirmClear(false);
                          showToast('Semua menu dihapus', {
                            onUndo: () => {
                              const DAYS_LIST = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
                              const MEALS_LIST = ['breakfast','lunch','dinner'];
                              DAYS_LIST.forEach((d) => MEALS_LIST.forEach((m) => {
                                const s = snapshot[d]?.[m];
                                if (s) restoreSlot(d, m, s);
                              }));
                              showToast('Menu dikembalikan');
                            }
                          });
                        }}
                        className="flex-1 py-2 bg-error text-white text-sm font-bold rounded-full hover:bg-error/80 transition cursor-pointer"
                      >
                        Ya, hapus semua
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        className="flex-1 py-2 border border-outline-variant text-on-surface-variant text-sm font-bold rounded-full hover:bg-secondary-container/20 transition cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-error/40 text-error text-sm font-bold rounded-full hover:bg-error/10 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">delete_sweep</span>
                    Hapus Semua Menu
                  </button>
                )}
              </div>
            )}

            {/* Widget Persiapan Bahan (Food Prep) */}
            <div className="bg-surface-cream border border-outline-variant rounded-panel p-6 space-y-4 shadow-sm text-left">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
                  <div className="text-left">
                    <h3 className="font-headline-md text-headline-md text-primary">Persiapan Bahan</h3>
                    <p className="text-xs text-on-surface-variant">
                      Catatan food prep rencana masakmu.
                    </p>
                  </div>
                </div>
                
                {/* Tombol saran AI */}
                {stats.filled > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoSuggest}
                    disabled={loadingSuggestions}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary text-white text-[10px] font-bold hover:bg-primary-container transition-colors shadow-sm cursor-pointer shrink-0 ${
                      loadingSuggestions ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                    title="Hasilkan rekomendasi tugas persiapan bahan otomatis dari menu minggu ini"
                  >
                    <span className={`material-symbols-outlined text-[12px] ${loadingSuggestions ? "animate-spin" : ""}`}>
                      {loadingSuggestions ? "sync" : "auto_awesome"}
                    </span>
                    {loadingSuggestions ? "Memproses..." : "Saran AI"}
                  </button>
                )}
              </div>

              {/* Progress Bar Kemajuan */}
              {totalTasks > 0 && (
                <div className="space-y-1.5 pb-2 border-b border-outline-variant/30">
                  <div className="flex justify-between items-center text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <span>Kemajuan: {completedTasks}/{totalTasks} Selesai</span>
                    {completedTasks > 0 && (
                      <button
                        onClick={handleClearCompleted}
                        className="text-[9px] font-extrabold text-error hover:underline cursor-pointer"
                      >
                        Bersihkan Selesai
                      </button>
                    )}
                  </div>
                  <div className="w-full h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Panel Rekomendasi Food Prep AI */}
              {showSuggestions && prepSuggestions.length > 0 && (
                <div className="bg-primary/[0.06] border border-primary/20 rounded-2xl p-4 space-y-3 animate-fade-in text-left">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold uppercase text-primary tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                      Rekomendasi Food Prep
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddAllSuggestions}
                        className="text-[9px] font-extrabold bg-primary text-white px-2 py-1 rounded-lg hover:bg-primary-container transition-colors cursor-pointer shadow-sm"
                      >
                        Tambah Semua
                      </button>
                      <button
                        onClick={() => setShowSuggestions(false)}
                        className="text-[9px] font-extrabold border border-outline text-on-surface-variant px-2 py-1 rounded-lg hover:bg-secondary-container/20 transition-colors cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {prepSuggestions.map((sug) => (
                      <div key={sug.id} className="flex items-start justify-between gap-2 text-xs py-1 border-b border-outline-variant/20">
                        <span className="text-on-surface-variant leading-tight flex-1">{sug.taskText}</span>
                        <button
                          onClick={() => handleAddSingleSuggestion(sug)}
                          className="text-primary hover:text-primary-container p-0.5 cursor-pointer shrink-0"
                          title="Tambah ke checklist"
                        >
                          <span className="material-symbols-outlined text-base">add_circle</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input tugas baru */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newPrepText.trim()) {
                    onAddPrepTask(newPrepText);
                    setNewPrepText('');
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={newPrepText}
                  onChange={(e) => setNewPrepText(e.target.value)}
                  placeholder="Tambahkan tugas prep..."
                  className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-outline-variant bg-white text-on-surface focus:outline-none focus:border-primary placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer"
                >
                  Tambah
                </button>
              </form>

              {/* Daftar tugas */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {prepTasks.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic py-2">
                    Belum ada catatan persiapan. Ketik di atas atau klik tombol "Saran AI" jika sudah ada rencana menu.
                  </p>
                ) : (
                  prepTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="flex items-start gap-2.5 justify-between py-1.5 border-b border-outline-variant/30 text-left group"
                    >
                      <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={task.isCompleted}
                          onChange={(e) => onTogglePrepTask(task.id, e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer shrink-0"
                        />
                        <span className={`text-xs leading-tight break-words ${
                          task.isCompleted 
                            ? "text-slate-400 line-through" 
                            : "text-on-surface font-medium"
                        }`}>
                          {task.taskText}
                        </span>
                      </label>
                      <button
                        onClick={() => onDeletePrepTask(task.id)}
                        className="opacity-100 sm:opacity-0 group-hover:opacity-100 text-slate-400 hover:text-error transition-all p-0.5 cursor-pointer"
                        title="Hapus catatan"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Inspirasi menu — sampel resep untuk mengisi planner */}
            <div className="bg-surface-cream/40 border border-outline-variant rounded-panel p-6">
              <h3 className="font-headline-md text-headline-md text-primary mb-2">Inspirasi Menu</h3>
              <p className="text-on-surface-variant text-sm mb-6">
                Beberapa pilihan resep menarik untuk melengkapi rencana mingguanmu.
              </p>
              <div className="space-y-4">
                {recommended.map((recipe) => (
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
                      {/* Info waktu masak & kalori disembunyikan sementara */}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={onGoToCatalog}
                className="mt-6 w-full py-2.5 rounded-full border border-secondary text-secondary font-bold text-sm hover:bg-secondary-container/30 transition-all cursor-pointer"
              >
                Jelajahi Katalog Resep
              </button>
            </div>

          </aside>
        </div>
      </main>

      {/* ---------------- Bottom Action Bar ---------------- */}
      <div className="fixed bottom-above-nav md:bottom-0 left-0 right-0 z-40 p-4 md:p-6 md:pb-safe-6 bg-gradient-to-t from-canvas-white via-canvas-white/95 to-transparent flex justify-center pointer-events-none">
        <button
          id="planner-shopping-btn"
          onClick={handleGenerateShoppingList}
          disabled={stats.filled === 0}
          aria-disabled={stats.filled === 0}
          title={stats.filled === 0 ? 'Isi minimal satu jadwal makan terlebih dahulu' : undefined}
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
            {stats.filled === 0 ? 'Isi Jadwal Makan Dahulu' : 'Buat Daftar Belanja'}
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
                  Berapa porsi <strong>{pickerSelectedRecipe.title}</strong> yang ingin kamu masak untuk{' '}
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

      {/* Detail Resep Modal */}
      {selectedRecipeForDetail && cookingTarget && (
        <RecipeDetailModal
          recipe={selectedRecipeForDetail}
          isSaved={false}
          onClose={() => {
            setSelectedRecipeForDetail(null);
            setCookingTarget(null);
          }}
          showStartCooking={true}
          onStartCooking={(recipe) => {
            setActiveCookingRecipe(recipe);
            setSelectedRecipeForDetail(null);
          }}
          isCooked={weeklyPlan?.[cookingTarget.day]?.[cookingTarget.meal]?.isCooked}
          onToggleCooked={() => {
            const target = weeklyPlan?.[cookingTarget.day]?.[cookingTarget.meal];
            if (target) {
              onToggleCookedStatus(cookingTarget.day, cookingTarget.meal, !target.isCooked);
              showToast(target.isCooked ? "Menu ditandai belum dimasak" : "Menu ditandai selesai dimasak");
            }
          }}
        />
      )}

      {/* Cooking Mode Modal */}
      {activeCookingRecipe && cookingTarget && (
        <CookingModeModal
          recipe={activeCookingRecipe}
          onClose={() => {
            setActiveCookingRecipe(null);
            setCookingTarget(null);
          }}
          onComplete={() => {
            onToggleCookedStatus(cookingTarget.day, cookingTarget.meal, true);
            showToast(`Selamat! Menu "${activeCookingRecipe.title}" selesai dimasak.`, { duration: 4000 });
            setActiveCookingRecipe(null);
            setCookingTarget(null);
          }}
        />
      )}
    </div>
  );
}

export default WeeklyPlanner;
