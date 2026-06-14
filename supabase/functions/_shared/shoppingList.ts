// Builder daftar belanja deterministik (server-side, TANPA token AI).
// Dipakai oleh regenerate-day untuk menghitung ulang shopping_list + total biaya
// dari SELURUH plan setelah satu hari diganti — supaya daftar belanja & total
// selalu konsisten dengan menu terbaru.
//
// Sumber data: recipe_ingredients (name, amount, unit, category, price_idr).
// Bukan dari AI, jadi akurat & gratis. Fondasi ini juga akan dipakai ulang oleh
// fitur "Belanja Sendiri vs Belanja di Kami" (lihat ADR terkait).

import { subtractPantry, type GenerateInput } from "./validate.ts";

export interface IngredientRow {
  name: string;
  amount: number | null;
  unit: string | null;
  category: string | null;
  price_idr: number | null;
}

export interface RecipeWithIngredients {
  id: number;
  base_servings: number | null;
  ingredients: IngredientRow[];
}

interface PlanMeal {
  recipe_id?: number;
  servings?: number;
}

interface PlanDay {
  meals?: PlanMeal[];
}

interface ShoppingItem {
  ingredient: string;
  total_amount: number;
  unit: string;
  category: string;
  estimated_price_idr: number;
}

// Bulatkan ke 2 desimal supaya akumulasi float (mis. 0.1+0.2) tidak menumpuk
// jadi angka panjang yang jelek di UI.
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Kunci agregasi: nama (lowercase, trim) + unit + kategori. Bahan yang sama
// dengan unit berbeda (mis. "gram" vs "kg") sengaja TIDAK digabung — konversi
// satuan di luar scope dan berisiko salah hitung.
function aggKey(name: string, unit: string, category: string): string {
  return `${name.toLowerCase().trim()}|${unit.toLowerCase().trim()}|${category.toLowerCase().trim()}`;
}

// Susun shopping_list + total_estimated_cost dari semua meal di plan.
// - recipesById: Map<recipe_id, RecipeWithIngredients> (hasil query recipe_ingredients).
// - Skala amount & harga per (servings / base_servings); base_servings default 2.
// - Setelah agregasi, kurangi pantry (reuse subtractPantry yang sudah teruji).
//
// Return objek baru { shopping_list, total_estimated_cost } untuk di-merge ke plan.
export function buildShoppingList(
  days: PlanDay[],
  recipesById: Map<number, RecipeWithIngredients>,
  pantry: GenerateInput["pantry"],
): { shopping_list: ShoppingItem[]; total_estimated_cost: number } {
  const agg = new Map<string, ShoppingItem>();

  for (const day of days ?? []) {
    for (const meal of day.meals ?? []) {
      const rid = Number(meal.recipe_id);
      const recipe = recipesById.get(rid);
      if (!recipe) continue;

      const baseServings = recipe.base_servings && recipe.base_servings > 0 ? recipe.base_servings : 2;
      const wanted = Number(meal.servings);
      const factor = Number.isFinite(wanted) && wanted > 0 ? wanted / baseServings : 1;

      for (const ing of recipe.ingredients ?? []) {
        const name = String(ing.name ?? "").trim();
        if (!name) continue;
        const unit = String(ing.unit ?? "").trim();
        const category = String(ing.category ?? "dry_goods").trim();
        const amount = (Number(ing.amount) || 0) * factor;
        const price = (Number(ing.price_idr) || 0) * factor;

        const key = aggKey(name, unit, category);
        const existing = agg.get(key);
        if (existing) {
          existing.total_amount = round2(existing.total_amount + amount);
          existing.estimated_price_idr = Math.round(existing.estimated_price_idr + price);
        } else {
          agg.set(key, {
            ingredient: name,
            total_amount: round2(amount),
            unit,
            category,
            estimated_price_idr: Math.round(price),
          });
        }
      }
    }
  }

  const shopping_list = [...agg.values()];
  const total_estimated_cost = shopping_list.reduce((sum, it) => sum + (it.estimated_price_idr || 0), 0);

  // subtractPantry mengembalikan objek dengan shopping_list & total yang sudah
  // dikurangi stok rumah, sekaligus recompute total. Bungkus dgn shape minimal.
  const subtracted = subtractPantry(
    { shopping_list, total_estimated_cost },
    pantry,
  ) as { shopping_list: ShoppingItem[]; total_estimated_cost: number };

  return {
    shopping_list: subtracted.shopping_list,
    total_estimated_cost: subtracted.total_estimated_cost,
  };
}
