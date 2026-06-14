import { supabase } from "../lib/supabase.js";

// Service layer untuk Paket "Belanja di Kami" (Phase 12).
// Paket = periode + menu fiks yang bahannya kami stok. Menu refer ke recipes
// katalog, jadi bahan & harga ikut recipe_ingredients (single source of truth).

// Select paket + menu fiks-nya, embed resep lengkap (dengan bahan camelCase) agar
// halaman bisa langsung agregasi daftar belanja tanpa query tambahan.
const PACKAGE_SELECT = `
  id, slug, name, description,
  periodeDays:periode_days,
  mealsPerDay:meals_per_day,
  baseServings:base_servings,
  priceIdr:price_idr,
  imageUrl:image_url,
  badges, sort_order,
  meals:package_meals (
    dayIndex:day_index,
    mealType:meal_type,
    recipe:recipes (
      id, title, description, calories, difficulty, cuisine, badges, tags, instructions,
      imageUrl:image_url,
      priceIdr:price_idr,
      readyInMinutes:ready_in_minutes,
      baseServings:base_servings,
      ingredients:recipe_ingredients ( name, amount, unit, category, priceIdr:price_idr )
    )
  )
`;

// Ambil semua paket aktif (terurut sort_order), beserta menu & resepnya.
export async function getPackages() {
  const { data, error } = await supabase
    .from("packages")
    .select(PACKAGE_SELECT)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map(sortMeals);
}

// Ambil satu paket by id.
export async function getPackageById(id) {
  const { data, error } = await supabase
    .from("packages")
    .select(PACKAGE_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .single();
  if (error) throw error;
  return sortMeals(data);
}

// Urutkan menu paket per (dayIndex, urutan waktu makan) supaya tampil rapi.
const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };
function sortMeals(pkg) {
  if (pkg?.meals) {
    pkg.meals.sort((a, b) =>
      a.dayIndex - b.dayIndex || (MEAL_ORDER[a.mealType] ?? 9) - (MEAL_ORDER[b.mealType] ?? 9));
  }
  return pkg;
}
