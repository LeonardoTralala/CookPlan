import { RecipeCard } from "./RecipeCard.jsx";
import { usePlan } from "../hooks/usePlan.js";
import { initialRecipes } from "../utils/recipes.js";

export function FeaturedRecipes({ onNavigate }) {
  const { showToast } = usePlan();

  // Arahkan ke katalog penuh di dalam aplikasi (butuh login).
  const seeAll = () =>
    onNavigate ? onNavigate("catalog") : showToast("Katalog lengkap resep ada di dalam aplikasi.");

  // Kartu resep unggulan = teaser marketing. Klik mengarahkan ke katalog
  // (bukan menambah ke rencana, karena katalog penuh ada di area login).
  const handleAdd = () =>
    onNavigate ? onNavigate("catalog") : showToast("Masuk untuk mengakses resep lengkap!");

  return (
    <section id="recipes" className="section-padding bg-canvas-white px-margin-mobile md:px-margin-desktop">
      <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-start md:items-end mb-10 md:mb-12 gap-6">
        <div className="max-w-xl">
          <h2 className="font-headline-lg text-headline-lg text-primary mb-4">
            Resep Unggulan Minggu Ini
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Inspirasi menu sehat yang paling banyak dipilih oleh komunitas CookPlan.
          </p>
        </div>
        <button
          onClick={seeAll}
          className="flex items-center gap-2 text-primary font-bold hover:gap-4 active:opacity-70 transition-all cursor-pointer py-2 -my-2"
        >
          <span>Lihat Semua Resep</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>

      <div className="max-w-container-max mx-auto grid md:grid-cols-3 gap-6 md:gap-8">
        {initialRecipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} onAdd={handleAdd} />
        ))}
      </div>
    </section>
  );
}
