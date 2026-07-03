import { ModalSheet } from "./ModalSheet.jsx";

const formatRupiah = (val) => {
  if (!val) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
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
  if (!recipe) return null;

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
          <div className="grid grid-cols-3 gap-4 p-4 bg-secondary-container/20 rounded-2xl border border-outline-variant/60 text-center">
            <div>
              <span className="material-symbols-outlined text-primary text-2xl mb-1 block">
                schedule
              </span>
              <span className="text-[10px] uppercase font-bold text-on-surface tracking-wider block">
                Waktu Masak
              </span>
              <span className="text-sm font-bold text-primary">
                {recipe.readyInMinutes} mnt
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
                {recipe.calories} kcal
              </span>
            </div>
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
          <div>
            <h4 className="text-lg font-bold text-primary border-b border-outline-variant pb-2 mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xl">
                local_cafe
              </span>
              Langkah-Langkah Memasak
            </h4>
            <ol className="space-y-4 text-left">
              {(recipe.instructions ?? []).map((step, idx) => (
                <li
                  key={idx}
                  className="flex gap-4 items-start text-xs md:text-sm leading-relaxed"
                >
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
