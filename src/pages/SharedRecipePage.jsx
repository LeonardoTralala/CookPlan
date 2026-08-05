import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRecipeById } from "../services/recipeService.js";
import { getCurrentPlan, setSlot, getCurrentWeekStart, DAYS } from "../services/planService.js";
import { useAuth } from "../hooks/useAuth.js";
import { usePlan } from "../hooks/usePlan.js";
import { AppShell } from "../components/AppShell.jsx";
import { ModalSheet } from "../components/ModalSheet.jsx";
import { SEOHead } from "../components/SEOHead.jsx";

const formatRupiah = (val) => {
  if (!val) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

export function SharedRecipePage() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const { isFullUser } = useAuth();
  const { showToast, refreshPlan } = usePlan();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recipe, setRecipe] = useState(null);

  // Modal & Picker state for "Tambahkan ke Rencana Masakku"
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [planDay, setPlanDay] = useState("Senin");
  const [planMeal, setPlanMeal] = useState("breakfast");
  const [planServings, setPlanServings] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getRecipeById(recipeId)
      .then((data) => {
        if (active) {
          if (!data) {
            setError("Resep tidak ditemukan.");
          } else {
            setRecipe(data);
            setPlanServings(data.baseServings || 2);
            setError(null);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Gagal memuat resep.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [recipeId]);

  const handleAddClick = () => {
    setShowPickerModal(true);
  };

  const handleConfirmAddToPlan = async () => {
    if (!recipe) return;

    if (!isFullUser) {
      sessionStorage.setItem(
        "pending_recipe_action",
        JSON.stringify({
          type: "add_to_plan",
          recipeId: recipe.id || recipeId,
          day: planDay,
          meal: planMeal,
          servings: planServings,
        })
      );
      showToast(
        `Silakan masuk atau buat akun gratis untuk menyimpan resep ini ke jadwal ${planDay} kamu!`,
        { variant: "info" }
      );
      setShowPickerModal(false);
      navigate("/auth", { state: { from: `/share/recipe/${recipeId}` } });
      return;
    }

    setSubmitting(true);
    try {
      const currentWeekKey = getCurrentWeekStart();
      const { planId } = await getCurrentPlan(currentWeekKey);
      await setSlot(planId, recipe, planDay, planMeal, planServings);
      await refreshPlan(currentWeekKey);
      showToast(`Resep ${recipe.title} berhasil ditambahkan ke jadwal ${planDay} kamu! 🎉`, { variant: "success" });
      setShowPickerModal(false);
      navigate("/planner");
    } catch (err) {
      showToast(err.message || "Gagal menambahkan resep ke jadwal.", { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const mealOptions = [
    { value: "breakfast", label: "Sarapan" },
    { value: "lunch", label: "Makan Siang" },
    { value: "dinner", label: "Makan Malam" },
  ];

  const perServingPrice = recipe
    ? Math.round((recipe.priceIdr || 0) / (recipe.baseServings || 1))
    : 0;

  const recipeSchema = recipe ? {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    image: recipe.imageUrl ? [recipe.imageUrl] : ['https://cookplan.id/hero-poster.jpg'],
    description: recipe.description || `Resep ${recipe.title} di CookPlan`,
    recipeYield: `${recipe.baseServings || 2} porsi`,
    recipeIngredient: (recipe.ingredients || []).map(ing => `${ing.name} ${ing.amount || ''} ${ing.unit || ''}`.trim()),
    recipeInstructions: (recipe.instructions || []).map((step, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      text: step,
    })),
    offers: recipe.priceIdr ? {
      '@type': 'Offer',
      price: recipe.priceIdr,
      priceCurrency: 'IDR',
    } : undefined,
  } : null;

  return (
    <AppShell>
      <SEOHead
        title={recipe ? `${recipe.title} — Resep & Estimasi Biaya | CookPlan` : 'Resep Masakan — CookPlan'}
        description={recipe ? (recipe.description || `Resep masakan ${recipe.title} lengkap dengan bahan-bahan, porsi, dan estimasi biaya per porsi di CookPlan.`) : 'Resep masakan CookPlan'}
        canonicalUrl={`https://cookplan.id/share/recipe/${recipeId}`}
        ogImage={recipe?.imageUrl || 'https://cookplan.id/hero-poster.jpg'}
        jsonLd={recipeSchema}
      />
      <div className="bg-canvas-white min-h-dvh font-sans text-on-surface pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-3">
              progress_activity
            </span>
            <p className="text-sm text-on-surface-variant font-medium">Memuat resep…</p>
          </div>
        ) : error || !recipe ? (
          <div className="max-w-md mx-auto px-4 py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-error mb-3">
              error_outline
            </span>
            <h2 className="font-bold text-lg text-on-surface mb-2">Resep Tidak Ditemukan</h2>
            <p className="text-xs text-on-surface-variant mb-6">{error || "Resep yang kamu cari tidak tersedia."}</p>
            <button
              onClick={() => navigate("/catalog")}
              className="px-6 py-2.5 bg-primary text-white rounded-full font-bold text-sm hover:bg-primary-container transition cursor-pointer"
            >
              Lihat di Katalog CookPlan
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
            {/* Tag Badge Share */}
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs">
                <span className="material-symbols-outlined text-sm">share</span>
                Resep yang Dibagikan
              </span>
            </div>

            {/* Hero Card */}
            <div className="bg-white border border-outline-variant rounded-3xl overflow-hidden shadow-sm">
              <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  onError={(e) => {
                    e.currentTarget.src = "/img/recipe-placeholder.svg";
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {recipe.isVerified && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white text-primary font-bold text-[9px] uppercase tracking-wider inline-flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">verified</span>
                        Terverifikasi
                      </span>
                    )}
                    {(recipe.badges ?? []).map((badge, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold text-[9px] uppercase tracking-wider"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <h1 className="font-headline-lg text-2xl md:text-4xl text-white font-bold leading-tight">
                    {recipe.title}
                  </h1>
                </div>
              </div>

              {/* Description & Overview */}
              <div className="p-6 space-y-6">
                {recipe.description && (
                  <p className="text-on-surface-variant text-sm md:text-base leading-relaxed italic border-l-4 border-primary pl-4 py-1">
                    "{recipe.description}"
                  </p>
                )}

                {/* Info Grid: Porsi & Estimasi Harga */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20">
                    <span className="material-symbols-outlined text-3xl text-primary shrink-0">
                      group
                    </span>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                        Porsi Resep
                      </span>
                      <span className="text-base font-extrabold text-primary">
                        {recipe.baseServings ?? 2} Porsi
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary text-white shadow-xs">
                    <span className="material-symbols-outlined text-3xl shrink-0">
                      payments
                    </span>
                    <div>
                      <span className="text-[10px] uppercase font-bold opacity-80 block">
                        Estimasi Harga
                      </span>
                      <div className="text-base font-extrabold">
                        {formatRupiah(recipe.priceIdr)}
                        <span className="text-xs font-normal opacity-90">
                          {" "}
                          ({formatRupiah(perServingPrice)} / porsi)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daftar Bahan */}
                <div>
                  <h2 className="text-lg font-bold text-primary border-b border-outline-variant pb-2 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl">restaurant_menu</span>
                    Daftar Bahan
                  </h2>
                  {recipe.ingredients && recipe.ingredients.length > 0 ? (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                      {recipe.ingredients.map((ing, idx) => (
                        <li
                          key={idx}
                          className="flex justify-between items-center py-2 border-b border-outline-variant/30 text-xs md:text-sm"
                        >
                          <span className="font-medium text-on-surface">{ing.name}</span>
                          <span className="text-on-surface-variant font-bold bg-surface-cream px-2.5 py-0.5 rounded-lg border border-outline-variant/40">
                            {ing.amount} {ing.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-on-surface-variant italic">Bahan-bahan tidak tercantum.</p>
                  )}
                </div>

                {/* Langkah Memasak */}
                <div>
                  <h2 className="text-lg font-bold text-primary border-b border-outline-variant pb-2 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl">soup_kitchen</span>
                    Langkah Memasak
                  </h2>
                  {recipe.instructions && recipe.instructions.length > 0 ? (
                    <ol className="space-y-3">
                      {recipe.instructions.map((step, idx) => (
                        <li
                          key={idx}
                          className="flex gap-3 items-start text-xs md:text-sm leading-relaxed p-3.5 rounded-2xl bg-surface-cream/40 border border-outline-variant/30"
                        >
                          <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-on-surface font-medium pt-0.5">{step}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-on-surface-variant italic">Langkah memasak tidak tercantum.</p>
                  )}
                </div>

                {/* CTA Buttons (Primary & Secondary) */}
                <div className="pt-4 border-t border-outline-variant flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <button
                    onClick={() => navigate("/catalog")}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-full border border-outline-variant text-on-surface-variant font-bold text-sm hover:bg-secondary-container/20 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">menu_book</span>
                    Lihat di Katalog CookPlan
                  </button>

                  <button
                    onClick={handleAddClick}
                    className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white font-extrabold text-sm rounded-full hover:bg-primary-container active:scale-95 transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    Tambahkan ke Rencana Masakku
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Picker Modal for isFullUser */}
        {showPickerModal && recipe && (
          <ModalSheet
            onClose={() => !submitting && setShowPickerModal(false)}
            labelledBy="modal-picker-title"
            panelClassName="max-w-sm max-h-[90dvh] overflow-y-auto p-6 md:p-8"
          >
            <button
              onClick={() => !submitting && setShowPickerModal(false)}
              className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              aria-label="Tutup"
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>

            <h3 id="modal-picker-title" className="font-headline-md text-headline-md text-primary mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl">calendar_today</span>
              Pilih Hari & Waktu Makan
            </h3>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
              Tambahkan <strong>{recipe.title}</strong> ke jadwal masak minggu ini.
            </p>

            <div className="space-y-5">
              {/* Day Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                  Hari Memasak
                </label>
                <select
                  value={planDay}
                  onChange={(e) => setPlanDay(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base font-semibold text-on-surface"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              {/* Meal Type Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                  Waktu Makan
                </label>
                <select
                  value={planMeal}
                  onChange={(e) => setPlanMeal(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base font-semibold text-on-surface"
                >
                  {mealOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Servings Stepper */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                  Jumlah Porsi
                </label>
                <div className="flex items-center gap-4 bg-secondary-container/20 border border-outline-variant p-2 rounded-2xl justify-between">
                  <button
                    type="button"
                    onClick={() => setPlanServings(Math.max(1, planServings - 1))}
                    className="w-11 h-11 rounded-xl bg-white border border-outline-variant flex items-center justify-center hover:bg-secondary-container/30 active:scale-95 transition-all text-primary font-bold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">remove</span>
                  </button>
                  <span className="font-extrabold text-lg text-primary">{planServings} Porsi</span>
                  <button
                    type="button"
                    onClick={() => setPlanServings(planServings + 1)}
                    className="w-11 h-11 rounded-xl bg-white border border-outline-variant flex items-center justify-center hover:bg-secondary-container/30 active:scale-95 transition-all text-primary font-bold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPickerModal(false)}
                disabled={submitting}
                className="flex-1 py-3 border border-outline-variant text-on-surface-variant hover:bg-secondary-container/20 rounded-full font-bold text-sm transition-colors cursor-pointer disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAddToPlan}
                disabled={submitting}
                className="flex-1 py-3 bg-primary text-white hover:bg-primary-container rounded-full font-bold text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {submitting ? (
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">check</span>
                )}
                {submitting ? "Menambahkan…" : "Konfirmasi"}
              </button>
            </div>
          </ModalSheet>
        )}
      </div>
    </AppShell>
  );
}

export default SharedRecipePage;
