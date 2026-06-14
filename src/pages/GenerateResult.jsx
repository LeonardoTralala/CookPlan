import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getGeneratedPlanById, regenerateDay } from '../services/aiService.js';
import { getRecipesByIds } from '../services/recipeService.js';
import { usePlan } from '../hooks/usePlan.js';
import { mapGeneratedPlanToWeek } from '../utils/planMapper.js';
import { ModalSheet } from '../components/ModalSheet.jsx';

const MEAL_LABEL = { breakfast: 'Sarapan', lunch: 'Makan Siang', dinner: 'Makan Malam' };

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n || 0);
}

export function GenerateResult() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { applySlots, restoreSlot, showToast } = usePlan();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);
  const [recipeIndex, setRecipeIndex] = useState(new Map());
  const [detailRecipe, setDetailRecipe] = useState(null);
  const [applied, setApplied] = useState(false);
  // true bila datang langsung dari halaman generate (bukan buka ulang dari history).
  const autoApplyRef = useRef(Boolean(location.state?.autoApply));

  // State regenerate per hari: index hari mana yang lagi diproses, dan catatan
  // (note) per hari yang sedang dibuka editornya.
  const [regenDayIndex, setRegenDayIndex] = useState(null); // index loading, null = idle
  const [noteOpenIndex, setNoteOpenIndex] = useState(null); // index editor catatan terbuka
  const [noteDraft, setNoteDraft] = useState('');
  // Lacak status applied terbaru tanpa bikin handler regenerate bergantung ke state.
  const appliedRef = useRef(false);
  useEffect(() => { appliedRef.current = applied; }, [applied]);

  // Terapkan plan ke Rencana Masak Mingguan (planner), dengan opsi Urungkan
  // yang mengembalikan slot ke isi sebelumnya (termasuk yang tadinya kosong).
  const applyToPlanner = useCallback((planData, index, auto = false) => {
    const { slots, skippedDays } = mapGeneratedPlanToWeek(planData, index);
    if (slots.length === 0) {
      showToast('Tidak ada menu valid untuk dimasukkan ke planner.');
      return;
    }
    const undoList = applySlots(slots);
    setApplied(true);
    const extra = skippedDays > 0 ? ' (7 hari pertama)' : '';
    showToast(
      auto
        ? `${slots.length} menu otomatis masuk ke Rencana Mingguan${extra}! 🎉`
        : `${slots.length} menu diterapkan ke Rencana Mingguan${extra}!`,
      {
        onUndo: () => {
          for (const u of undoList) restoreSlot(u.day, u.mealType, u.prev);
          setApplied(false);
          showToast('Perubahan di planner diurungkan.');
        },
      }
    );
  }, [applySlots, restoreSlot, showToast]);

  // Muat hasil: utamakan sessionStorage (baru di-generate), fallback DB.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = sessionStorage.getItem(`plan_${planId}`);
        let data;
        if (cached) {
          data = JSON.parse(cached);
        } else {
          const row = await getGeneratedPlanById(planId);
          data = { plan: row.output_json, reasoning: row.reasoning_content, meta: { model: row.model }, planId: row.id };
        }
        if (!active) return;
        setResult(data);

        // Ambil resep detail untuk semua recipe_id di plan.
        const ids = new Set();
        for (const day of data.plan?.days ?? []) {
          for (const m of day.meals ?? []) if (m.recipe_id != null) ids.add(m.recipe_id);
        }
        if (ids.size > 0) {
          const recipes = await getRecipesByIds([...ids]);
          if (!active) return;
          const index = new Map(recipes.map((r) => [r.id, r]));
          setRecipeIndex(index);

          // Auto-apply ke planner sekali, hanya saat baru selesai generate.
          if (autoApplyRef.current) {
            autoApplyRef.current = false;
            applyToPlanner(data.plan, index, true);
            // Bersihkan state navigasi supaya refresh tidak menerapkan ulang.
            navigate(location.pathname, { replace: true, state: null });
          }
        }
      } catch (e) {
        if (active) setError(e.message || 'Gagal memuat hasil.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [planId, applyToPlanner, navigate, location.pathname]);

  const plan = result?.plan;
  const showShopping = useMemo(() => {
    // Foodprep & full menampilkan shopping list.
    return (plan?.shopping_list?.length ?? 0) > 0;
  }, [plan]);

  // Regenerate menu satu hari. Update plan + sessionStorage, dan kalau plan sudah
  // diterapkan ke planner, re-apply seluruh plan agar slot hari itu ikut sinkron.
  const handleRegenerateDay = useCallback(async (dayIndex, note) => {
    if (regenDayIndex != null) return; // cegah double-trigger
    setRegenDayIndex(dayIndex);
    try {
      const res = await regenerateDay(planId, dayIndex, { note });
      const newPlan = res.plan;

      // Pastikan resep baru ada di index (untuk render gambar/judul & sync planner).
      const newIds = new Set();
      for (const m of res.day?.meals ?? []) if (m.recipe_id != null) newIds.add(m.recipe_id);
      const missing = [...newIds].filter((id) => !recipeIndex.has(id));
      let nextIndex = recipeIndex;
      if (missing.length > 0) {
        const fetched = await getRecipesByIds(missing);
        nextIndex = new Map(recipeIndex);
        for (const r of fetched) nextIndex.set(r.id, r);
        setRecipeIndex(nextIndex);
      }

      const newResult = { ...result, plan: newPlan };
      setResult(newResult);
      try {
        sessionStorage.setItem(`plan_${planId}`, JSON.stringify(newResult));
      } catch { /* sessionStorage opsional */ }

      // Sinkronkan planner kalau plan sudah diterapkan.
      if (appliedRef.current) {
        const { slots } = mapGeneratedPlanToWeek(newPlan, nextIndex);
        if (slots.length > 0) applySlots(slots);
      }

      setNoteOpenIndex(null);
      setNoteDraft('');
      showToast(`Menu ${res.day?.day || `hari ${dayIndex + 1}`} berhasil diganti! 🍳`);
    } catch (e) {
      showToast(e.message || 'Gagal mengganti menu hari ini.', { variant: 'error' });
    } finally {
      setRegenDayIndex(null);
    }
  }, [planId, regenDayIndex, recipeIndex, result, applySlots, showToast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-3">progress_activity</span>
        <p className="text-sm">Memuat hasil…</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-4">error</span>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Gagal Memuat Hasil</h1>
        <p className="text-on-surface-variant text-sm mb-6">{error || 'Data tidak ditemukan.'}</p>
        <button onClick={() => navigate('/generate')} className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer">
          Generate Ulang
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary text-3xl">restaurant_menu</span>
          <h1 className="font-headline-lg text-headline-lg text-primary">Foodplan Kamu</h1>
        </div>
        {plan.plan_summary && <p className="text-on-surface-variant text-body-md">{plan.plan_summary}</p>}
        {result.meta?.model && (
          <p className="text-xs text-on-surface-variant/70 mt-2">
            Dibuat oleh {result.meta.model}
            {result.meta.latency_ms ? ` · ${(result.meta.latency_ms / 1000).toFixed(1)}s` : ''}
            {result.meta.cached ? ' · dari cache' : ''}
          </p>
        )}
      </div>

      {/* Status: sudah diterapkan ke planner (persisten, tidak hilang seperti toast) */}
      {applied && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-success-green/10 border border-success-green/30 px-4 py-3">
          <p className="text-sm text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-success-green text-[20px]">check_circle</span>
            Menu sudah masuk ke Rencana Masak Mingguan.
          </p>
          <button
            onClick={() => navigate('/planner')}
            className="text-sm font-bold text-primary whitespace-nowrap hover:underline cursor-pointer"
          >
            Lihat Planner →
          </button>
        </div>
      )}

      {/* Warnings */}
      {(plan.warnings?.length ?? 0) > 0 && (
        <div className="rounded-2xl bg-warning/10 border border-warning/30 p-4 space-y-1">
          {plan.warnings.map((w, i) => (
            <p key={i} className="text-sm text-on-surface-variant flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-warning shrink-0">warning</span>
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Reasoning disclosure */}
      {result.reasoning && (
        <div className="rounded-2xl border border-outline-variant overflow-hidden">
          <button
            onClick={() => setShowReasoning((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">psychology</span>
              Cara AI Berpikir
            </span>
            <span className={`material-symbols-outlined transition-transform ${showReasoning ? 'rotate-180' : ''}`}>expand_more</span>
          </button>
          {showReasoning && (
            <div className="px-4 py-3 text-xs text-on-surface-variant whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto bg-white">
              {result.reasoning}
            </div>
          )}
        </div>
      )}

      {/* Menu per hari */}
      <section className="space-y-5">
        <h2 className="font-headline-md text-headline-md text-on-surface">Menu Harian</h2>
        {plan.days?.map((day, di) => {
          const isRegenerating = regenDayIndex === di;
          const isNoteOpen = noteOpenIndex === di;
          const anyRegenerating = regenDayIndex != null;
          return (
          <div key={di} className="bg-surface-container-low rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-primary">{day.day}</h3>
              <button
                onClick={() => {
                  if (anyRegenerating) return;
                  setNoteDraft('');
                  setNoteOpenIndex(isNoteOpen ? null : di);
                }}
                disabled={anyRegenerating}
                aria-expanded={isNoteOpen}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/5 active:scale-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={`material-symbols-outlined text-[18px] ${isRegenerating ? 'animate-spin' : ''}`}>
                  {isRegenerating ? 'progress_activity' : 'autorenew'}
                </span>
                {isRegenerating ? 'Mengganti…' : 'Ganti Menu'}
              </button>
            </div>

            {/* Editor catatan opsional + tombol generate ulang hari ini */}
            {isNoteOpen && (
              <div className="mb-3 rounded-xl border border-outline-variant bg-white p-3 animate-fade-in">
                <label htmlFor={`note-${di}`} className="block text-xs font-semibold text-on-surface mb-1.5">
                  Catatan buat AI (opsional)
                </label>
                <textarea
                  id={`note-${di}`}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value.slice(0, 200))}
                  rows={2}
                  placeholder="mis. pengen yang ada ayamnya, atau kosongkan aja kalau cuma pengen menu lain"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-on-surface-variant/70">{noteDraft.length}/200</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setNoteOpenIndex(null); setNoteDraft(''); }}
                      disabled={isRegenerating}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition cursor-pointer disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleRegenerateDay(di, noteDraft.trim())}
                      disabled={isRegenerating}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold hover:shadow-md active:scale-95 transition cursor-pointer disabled:opacity-60"
                    >
                      <span className={`material-symbols-outlined text-[16px] ${isRegenerating ? 'animate-spin' : ''}`}>
                        {isRegenerating ? 'progress_activity' : 'auto_awesome'}
                      </span>
                      Generate Ulang
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className={`space-y-2 transition-opacity ${isRegenerating ? 'opacity-50 pointer-events-none' : ''}`}>
              {day.meals?.map((meal, mi) => {
                const recipe = recipeIndex.get(meal.recipe_id);
                return (
                  <button
                    key={mi}
                    onClick={() => recipe && setDetailRecipe(recipe)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-outline-variant/60 hover:border-primary/50 transition-colors text-left cursor-pointer"
                  >
                    {recipe?.imageUrl && (
                      <img src={recipe.imageUrl} alt="" loading="lazy"
                        onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                        className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{MEAL_LABEL[meal.meal_type] || meal.meal_type}</span>
                      <span className="block font-semibold text-sm text-on-surface truncate">{recipe?.title || `Resep #${meal.recipe_id}`}</span>
                      {meal.notes && <span className="block text-xs text-on-surface-variant truncate">{meal.notes}</span>}
                    </div>
                    <span className="text-xs text-on-surface-variant shrink-0">{meal.servings} porsi</span>
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
                  </button>
                );
              })}
            </div>
          </div>
          );
        })}
      </section>

      {/* Shopping list (foodprep & full) */}
      {showShopping && (
        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">Daftar Belanja</h2>
          <div className="bg-surface-container-low rounded-2xl divide-y divide-outline-variant/40">
            {plan.shopping_list.map((it, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-on-surface">{it.ingredient}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-on-surface">{it.total_amount} {it.unit}</span>
                  {it.estimated_price_idr > 0 && (
                    <span className="block text-xs text-primary font-bold">{formatRupiah(it.estimated_price_idr)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-primary-container/30 rounded-2xl">
            <span className="font-bold text-primary">Total Estimasi</span>
            <span className="font-bold text-primary text-lg">{formatRupiah(plan.total_estimated_cost)}</span>
          </div>
        </section>
      )}

      {/* Prep instructions (foodprep & full) */}
      {(plan.prep_instructions?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">Tips Foodprep</h2>
          <ol className="space-y-2">
            {plan.prep_instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">{i + 1}</span>
                <span className="text-on-surface-variant">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Action: apply ke planner + order (full mode = Core Offer) */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={() => navigate('/generate')}
          className="flex-1 px-6 py-3 border border-primary text-on-surface-variant rounded-full font-semibold text-sm hover:bg-surface-container-low active:scale-95 transition cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">refresh</span>
          Generate Lagi
        </button>
        <button
          onClick={() => (applied ? navigate('/planner') : applyToPlanner(plan, recipeIndex))}
          className="flex-1 px-6 py-3 border border-primary text-primary rounded-full font-semibold text-sm hover:bg-primary/5 active:scale-95 transition cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">{applied ? 'event_available' : 'calendar_month'}</span>
          {applied ? 'Lihat Rencana Mingguan' : 'Terapkan ke Planner'}
        </button>
        {showShopping && (
          <button
            onClick={() => navigate(`/order/${planId}`)}
            className="flex-1 px-6 py-3 border border-primary bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">shopping_cart_checkout</span>
            Pesan Paket Belanja
          </button>
        )}
      </div>

      {/* Modal detail resep */}
      {detailRecipe && (
        <ModalSheet onClose={() => setDetailRecipe(null)} labelledBy="rd-title" panelClassName="overflow-hidden max-w-2xl max-h-[90dvh] flex flex-col">
          <button onClick={() => setDetailRecipe(null)} aria-label="Tutup" className="absolute right-4 top-4 z-10 w-11 h-11 rounded-full bg-on-surface/60 text-white flex items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
          <div className="overflow-y-auto flex-1">
            {detailRecipe.imageUrl && (
              <img src={detailRecipe.imageUrl} alt={detailRecipe.title} className="w-full h-56 object-cover"
                onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }} />
            )}
            <div className="p-6 space-y-5">
              <h3 id="rd-title" className="font-headline-md text-headline-md text-primary">{detailRecipe.title}</h3>
              <p className="text-sm text-on-surface-variant italic">{detailRecipe.description}</p>
              <div>
                <h4 className="font-bold text-primary mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xl">restaurant_menu</span> Bahan
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(detailRecipe.ingredients ?? []).map((ing, i) => (
                    <li key={i} className="flex justify-between text-sm py-1 border-b border-outline-variant/30">
                      <span className="text-on-surface">{ing.name}</span>
                      <span className="text-on-surface-variant font-semibold">{ing.amount} {ing.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-primary mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xl">local_cafe</span> Langkah
                </h4>
                <ol className="space-y-2.5">
                  {(detailRecipe.instructions ?? []).map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">{i + 1}</span>
                      <span className="text-on-surface-variant">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </ModalSheet>
      )}
    </div>
  );
}
