import { useState, useEffect } from "react";
import { ModalSheet } from "./ModalSheet.jsx";

// Helper untuk mendeteksi bahan apa saja yang muncul di teks langkah aktif
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
      const matchCount = words.filter(w => cleanStep.includes(w)).length;
      if (matchCount >= Math.min(2, words.length)) return true;
    }
    
    return false;
  });
};

export function CookingModeModal({ recipe, onClose, onComplete }) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const instructions = recipe.instructions ?? [];
  const totalSteps = instructions.length;
  const currentStepText = instructions[currentStepIdx] ?? "";
  const stepIngredients = getIngredientsForStep(currentStepText, recipe.ingredients);

  // Mengatur Wake Lock agar layar HP tidak mati saat memasak
  useEffect(() => {
    let activeLock = null;

    async function acquireWakeLock() {
      if (!("wakeLock" in navigator)) {
        console.warn("Wake Lock API tidak didukung di browser ini.");
        return;
      }
      try {
        activeLock = await navigator.wakeLock.request("screen");
        setWakeLockActive(true);
        console.log("Screen Wake Lock diaktifkan.");
      } catch (err) {
        console.error("Gagal mengaktifkan Wake Lock:", err);
      }
    }

    acquireWakeLock();

    // Re-acquire wake lock jika tab kembali aktif setelah minimize
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !activeLock) {
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (activeLock) {
        activeLock.release().then(() => {
          console.log("Screen Wake Lock dilepaskan.");
        });
      }
    };
  }, []);

  const handleNext = () => {
    if (currentStepIdx < totalSteps - 1) {
      setCurrentStepIdx(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    if (onComplete) {
      onComplete(recipe);
    }
  };

  const progressPercent = totalSteps > 0 ? Math.round(((currentStepIdx + 1) / totalSteps) * 100) : 0;

  return (
    <ModalSheet
      onClose={onClose}
      labelledBy="modal-cooking-title"
      panelClassName="overflow-hidden max-w-xl h-[100dvh] md:h-[80dvh] flex flex-col bg-canvas-white border-outline-variant text-on-surface rounded-none md:rounded-[32px]"
    >
      {/* Header Panel */}
      <header className="p-4 bg-surface-container-low border-b border-outline-variant flex items-center justify-between shrink-0">
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
            Mode Memasak Aktif
          </span>
          <h3 id="modal-cooking-title" className="text-sm font-bold text-on-surface line-clamp-1">
            {recipe.title}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Indikator Screen Lock */}
          <div 
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
              wakeLockActive 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "bg-outline-variant/30 text-on-surface-variant"
            }`}
            title={wakeLockActive ? "Layar akan tetap menyala" : "Wake lock tidak aktif"}
          >
            <span className="material-symbols-outlined text-[12px]">
              {wakeLockActive ? "screen_lock_portrait" : "phone_android"}
            </span>
            <span>{wakeLockActive ? "Layar On" : "Layar Auto"}</span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-secondary-container/50 hover:bg-secondary-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Keluar dari mode masak"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-outline-variant/30 shrink-0">
        <div 
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col justify-between space-y-6">
        {/* Step Number */}
        <div className="text-left">
          <span className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold border border-outline-variant/40">
            Langkah {currentStepIdx + 1} dari {totalSteps}
          </span>
        </div>

        {/* Big Instruction Text */}
        <div className="flex-1 flex items-center py-4">
          <p className="text-lg md:text-2xl font-semibold text-on-surface text-left leading-relaxed w-full">
            {currentStepText}
          </p>
        </div>

        {/* Ingredients for Current Step */}
        {stepIngredients.length > 0 && (
          <div className="bg-surface/40 rounded-2xl p-4 border border-outline-variant/50 text-left space-y-2 shrink-0">
            <h4 className="text-[10px] font-bold uppercase text-primary tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">soup_kitchen</span>
              Bahan untuk langkah ini:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stepIngredients.map((ing, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-outline-variant/30">
                  <span className="text-on-surface-variant font-medium">{ing.name}</span>
                  <span className="text-primary font-bold bg-white px-2 py-0.5 rounded border border-outline-variant/50">
                    {ing.amount} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Navigation Buttons Footer */}
      <footer className="p-4 bg-surface-container-low border-t border-outline-variant flex items-center gap-4 shrink-0">
        <button
          onClick={handlePrev}
          disabled={currentStepIdx === 0}
          className={`flex-1 py-4.5 px-4 rounded-2xl font-bold text-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
            currentStepIdx === 0
              ? "bg-outline-variant/30 text-on-surface-variant/40 cursor-not-allowed opacity-50"
              : "bg-white border border-outline-variant text-on-surface-variant hover:bg-secondary-container/20"
          }`}
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Sebelumnya
        </button>

        {currentStepIdx === totalSteps - 1 ? (
          <button
            onClick={handleFinish}
            className="flex-[1.5] py-4.5 px-4 bg-primary hover:bg-primary-container text-white rounded-2xl font-extrabold text-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-primary/10 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg font-bold">check_circle</span>
            Selesai Memasak
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex-[1.5] py-4.5 px-4 bg-primary text-white hover:bg-primary-container rounded-2xl font-bold text-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-primary/10 active:scale-[0.98]"
          >
            Lanjut
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        )}
      </footer>
    </ModalSheet>
  );
}
