import { useState } from "react";
import { ModalSheet } from "./ModalSheet.jsx";

const formatRupiah = (val) => {
  if (!val) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

const getIngredientsForStep = (stepText, ingredientsList) => {
  if (!stepText || !ingredientsList || ingredientsList.length === 0) return [];
  
  const cleanStep = stepText.toLowerCase();
  return ingredientsList.filter((ing) => {
    const ingName = ing.name.toLowerCase();
    
    // 1. Cocokan langsung substring nama bahan
    if (cleanStep.includes(ingName)) return true;
    
    // 2. Cocokan parsial untuk nama bahan yang panjang (misal: "daging ayam fillet" cocok dengan "daging ayam")
    const words = ingName.split(" ").filter(w => w.length > 2);
    if (words.length > 1) {
      // Jika minimal 2 kata dari nama bahan ada di teks langkah
      const textMatches = words.filter(w => cleanStep.includes(w)).length;
      if (textMatches >= Math.min(2, words.length)) return true;
    }
    
    return false;
  });
};

export function RecipeDetailModal({
  recipe,
  isSaved,
  onToggleSave,
  onClose,
  showAddToPlan = false,
  onAddToPlan,
  showStartCooking = false,
  onStartCooking,
  isCooked = false,
  onToggleCooked,
}) {
  const [activeTab, setActiveTab] = useState("stepper");
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [prevRecipeId, setPrevRecipeId] = useState(recipe?.id);

  if (recipe?.id !== prevRecipeId) {
    setPrevRecipeId(recipe?.id);
    setCurrentStepIdx(0);
    setActiveTab("stepper");
  }

  if (!recipe) return null;

  const instructions = recipe.instructions ?? [];
  const totalSteps = instructions.length;
  const currentStepText = instructions[currentStepIdx] ?? "";
  const currentStepIngredients = getIngredientsForStep(currentStepText, recipe.ingredients);
  const progressPercent = totalSteps > 0 ? Math.round(((currentStepIdx + 1) / totalSteps) * 100) : 0;

  const handleNextStep = () => {
    if (currentStepIdx < totalSteps - 1) {
      setCurrentStepIdx((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((prev) => prev - 1);
    }
  };

  return (
    <ModalSheet
      onClose={onClose}
      labelledBy="modal-recipe-title"
      panelClassName="overflow-hidden max-w-2xl max-h-[90dvh] md:max-h-[85dvh] flex flex-col"
    >
      {/* Header Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 w-11 h-11 rounded-full bg-on-surface/60 text-white flex items-center justify-center hover:bg-on-surface transition-colors shadow-md cursor-pointer"
        aria-label="Tutup detail resep"
      >
        <span className="material-symbols-outlined text-lg" aria-hidden="true">
          close
        </span>
      </button>

      {/* Scrollable Container */}
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {/* Header Image */}
        <div className="relative h-64 md:h-72">
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = "/img/recipe-placeholder.svg";
            }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-6 left-6 text-white pr-10">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {recipe.isVerified && (
                <span className="px-2.5 py-0.5 rounded-full bg-white text-primary font-bold text-[9px] uppercase tracking-wider inline-flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px]">
                    verified
                  </span>
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
            <h3
              id="modal-recipe-title"
              className="font-headline-lg text-headline-md md:text-headline-lg text-white"
            >
              {recipe.title}
            </h3>
          </div>
        </div>

        {/* Detail Content */}
        <div className="p-6 md:p-8 space-y-6">
          {recipe.description && (
            <p className="text-on-surface-variant text-sm md:text-base leading-relaxed italic">
              "{recipe.description}"
            </p>
          )}

          {/* Banner harga */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary text-white shadow-sm">
            <span className="material-symbols-outlined text-3xl shrink-0">
              payments
            </span>
            <div className="leading-tight text-left">
              <div className="text-xl md:text-2xl font-extrabold text-white">
                {formatRupiah(recipe.priceIdr)}
                <span className="text-sm font-semibold opacity-90">
                  {" "}
                  untuk {recipe.baseServings ?? 2} porsi
                </span>
              </div>
              <div className="text-xs font-medium opacity-90 text-white/90">
                ≈{" "}
                {formatRupiah(
                  Math.round(
                    recipe.priceIdr / (recipe.baseServings || 1)
                  )
                )}{" "}
                / porsi
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 gap-4 p-4 bg-secondary-container/20 rounded-2xl border border-outline-variant/60 text-center">
            {/* Waktu Masak & Kalori disembunyikan sementara */}
            <div>
              <span className="material-symbols-outlined text-primary text-2xl mb-1 block">
                group
              </span>
              <span className="text-[10px] uppercase font-bold text-on-surface tracking-wider block">
                Porsi
              </span>
              <span className="text-sm font-bold text-primary">
                {recipe.baseServings ?? 2} porsi
              </span>
            </div>
          </div>

          {/* Ingredients Section */}
          <div>
            <h4 className="text-lg font-bold text-primary border-b border-outline-variant pb-2 mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xl">
                restaurant_menu
              </span>
              Bahan-Bahan yang Dibutuhkan
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-left">
              {(recipe.ingredients ?? []).map((ing, idx) => (
                <li
                  key={idx}
                  className="flex justify-between items-center py-1.5 border-b border-outline-variant/30 text-xs md:text-sm"
                >
                  <span className="font-medium text-on-surface">
                    {ing.name}
                  </span>
                  <span className="text-on-surface-variant font-bold bg-white px-2 py-0.5 rounded border border-outline-variant/40">
                    {ing.amount} {ing.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2 mb-3">
              <h4 className="text-lg font-bold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xl">
                  local_cafe
                </span>
                Langkah Memasak
              </h4>
              
              {/* Tab Selector */}
              <div className="flex bg-surface-container-high rounded-full p-0.5 border border-outline-variant/50 text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("stepper")}
                  className={`px-3.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                    activeTab === "stepper"
                      ? "bg-primary text-white shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Panduan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("list")}
                  className={`px-3.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                    activeTab === "list"
                      ? "bg-primary text-white shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Semua
                </button>
              </div>
            </div>

            {totalSteps === 0 ? (
              <p className="text-sm text-on-surface-variant italic text-left">
                Tidak ada langkah memasak untuk resep ini.
              </p>
            ) : activeTab === "stepper" ? (
              <div className="space-y-4 text-left">
                {/* Progress bar and counter */}
                <div className="flex items-center justify-between text-xs text-on-surface-variant font-bold">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Langkah {currentStepIdx + 1} dari {totalSteps}
                  </span>
                  <span className="text-primary">{progressPercent}% Selesai</span>
                </div>
                <div className="w-full h-2 bg-outline-variant/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Big Step text card */}
                <div className="relative overflow-hidden bg-primary/5 border border-primary/20 rounded-2xl p-5 md:p-6 shadow-inner min-h-[110px] flex flex-col justify-center transition-all duration-300">
                  {/* Decorative background icon */}
                  <span className="absolute -right-4 -bottom-4 text-primary/10 text-7xl material-symbols-outlined select-none pointer-events-none" aria-hidden="true">
                    soup_kitchen
                  </span>
                  
                  <p className="text-sm md:text-base font-semibold text-on-surface leading-relaxed z-10">
                    {instructions[currentStepIdx]}
                  </p>
                </div>

                {/* Ingredients needed for this step */}
                {currentStepIngredients.length > 0 && (
                  <div className="bg-secondary-container/10 border border-outline-variant/40 rounded-xl p-3.5 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">soup_kitchen</span>
                      Bahan untuk langkah ini:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {currentStepIngredients.map((ing, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-white border border-outline-variant/40 rounded-full px-3 py-1 text-xs shadow-xs"
                        >
                          <span className="text-on-surface font-medium">{ing.name}</span>
                          <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
                          <span className="text-primary font-bold">{ing.amount} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stepper Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={currentStepIdx === 0}
                    className={`flex-1 py-2.5 px-4 rounded-full font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all border ${
                      currentStepIdx === 0
                        ? "border-outline-variant/30 text-on-surface-variant/30 cursor-not-allowed opacity-50 bg-surface-container-low"
                        : "border-outline-variant text-on-surface-variant hover:bg-secondary-container/20 bg-white shadow-xs active:scale-[0.98]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Sebelumnya
                  </button>

                  {currentStepIdx < totalSteps - 1 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="flex-1 py-2.5 px-4 bg-primary text-white hover:bg-primary-container rounded-full font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                    >
                      Lanjut
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("list")}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Selesai & Lihat Semua
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* List view fallback */
              <ol className="space-y-2 text-left">
                {instructions.map((step, idx) => (
                  <li
                    key={idx}
                    className={`flex gap-3 items-start text-xs md:text-sm leading-relaxed p-2.5 rounded-xl border transition-all cursor-pointer ${
                      idx === currentStepIdx
                        ? "bg-primary/5 border-primary/30 shadow-xs"
                        : "border-outline-variant/20 hover:border-outline-variant/50 hover:bg-secondary-container/10"
                    }`}
                    onClick={() => {
                      setCurrentStepIdx(idx);
                      setActiveTab("stepper");
                    }}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 transition-colors ${
                        idx === currentStepIdx
                          ? "bg-primary text-white"
                          : "bg-surface-container-high text-on-surface-variant border border-outline-variant"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <p className="text-on-surface-variant flex-1 pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="p-4 bg-canvas-white border-t border-outline-variant flex items-center justify-end gap-3 shrink-0 flex-wrap">
        <button
          onClick={async () => {
            const shareUrl = `${window.location.origin}/catalog?recipe=${recipe.id}`;
            if (navigator.share) {
              try {
                await navigator.share({
                  title: `${recipe.title} - CookPlan`,
                  text: `Cek resep lezat "${recipe.title}" di CookPlan!`,
                  url: shareUrl,
                });
              } catch (err) {
                if (err.name !== "AbortError") {
                  navigator.clipboard.writeText(shareUrl);
                }
              }
            } else {
              navigator.clipboard.writeText(shareUrl);
            }
          }}
          className="px-4 py-2.5 border border-outline-variant text-on-surface-variant hover:bg-secondary-container/20 rounded-full font-bold text-sm cursor-pointer flex items-center gap-1.5 transition-colors"
          title="Bagikan Resep"
        >
          <span className="material-symbols-outlined text-lg">share</span>
          Bagikan
        </button>
        {onToggleSave && (
          <button
            onClick={() => onToggleSave(recipe)}
            className={`px-5 py-2.5 rounded-full font-bold text-sm cursor-pointer flex items-center gap-1.5 transition-colors border ${
              isSaved
                ? "bg-error/10 border-error/30 text-error hover:bg-error/20"
                : "border-outline-variant text-on-surface-variant hover:bg-secondary-container/20"
            }`}
            aria-pressed={isSaved}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {isSaved ? "favorite" : "favorite_border"}
            </span>
            {isSaved ? "Tersimpan" : "Simpan"}
          </button>
        )}
        <button
          onClick={onClose}
          className="px-5 py-2.5 border border-outline-variant text-on-surface-variant hover:bg-secondary-container/20 rounded-full font-bold text-sm cursor-pointer transition-colors"
        >
          Tutup
        </button>
        {showStartCooking && onStartCooking && (
          <div className="flex gap-2">
            {isCooked && onToggleCooked && (
              <button
                onClick={() => onToggleCooked(recipe)}
                className="px-5 py-2.5 border border-outline-variant text-on-surface-variant hover:bg-secondary-container/20 rounded-full font-bold text-sm cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-lg">restart_alt</span>
                Masak Ulang
              </button>
            )}
            <button
              onClick={() => onStartCooking(recipe)}
              className="px-6 py-2.5 bg-primary text-white hover:bg-primary-container rounded-full font-bold text-sm cursor-pointer flex items-center gap-1.5 transition-all shadow-md"
            >
              <span className="material-symbols-outlined text-lg">local_fire_department</span>
              {isCooked ? "Mulai Lagi" : "Mulai Masak"}
            </button>
          </div>
        )}
        {showAddToPlan && onAddToPlan && (
          <button
            onClick={() => onAddToPlan(recipe)}
            className="px-6 py-2.5 bg-primary text-white hover:bg-primary-container rounded-full font-bold text-sm cursor-pointer flex items-center gap-1.5 transition-all shadow-md"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Tambah ke Rencana
          </button>
        )}
      </div>
    </ModalSheet>
  );
}
