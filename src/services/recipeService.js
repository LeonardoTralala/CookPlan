import { supabase } from "../lib/supabase.js";

// Service layer untuk bank resep. Mengganti import langsung dari mockRecipes.js.
// Kolom DB (snake_case) di-alias ke camelCase agar bentuk objek persis sama dengan
// mockRecipes lama — komponen (RecipeCatalog, WeeklyPlanner, ShoppingList) hampir
// tidak perlu diubah.

export const RECIPE_SELECT = `
  id, title, description, calories, difficulty, cuisine, badges, tags, instructions,
  imageUrl:image_url,
  priceIdr:price_idr,
  readyInMinutes:ready_in_minutes,
  baseServings:base_servings,
  ingredientsText:ingredients_text,
  ingredients:recipe_ingredients (
    name, amount, unit, category, priceIdr:price_idr
  )
`;

// Ambil semua resep aktif (dengan bahan-bahannya), terurut id.
export async function getRecipes() {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("is_active", true)
    .order("id");

  if (error) throw error;
  return data ?? [];
}

// Ambil satu resep berdasarkan id (untuk modal detail / resep per menu).
export async function getRecipeById(id) {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// Ambil beberapa resep sekaligus by id (dipakai render hasil generate AI).
export async function getRecipesByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .in("id", ids);

  if (error) throw error;
  return data ?? [];
}

// --- Resep tersimpan (saved_recipes) -----------------------------------------
// Semua fungsi mengandalkan RLS (owner-only). getUser() dipakai sebagai
// defense-in-depth + untuk mengisi user_id saat insert.

async function requireUser() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Belum login.");
  return data.user;
}

// Ambil resep tersimpan milik user (objek resep lengkap, terbaru dulu).
export async function getSavedRecipes() {
  await requireUser();
  const { data, error } = await supabase
    .from("saved_recipes")
    .select(`created_at, recipe:recipes (${RECIPE_SELECT})`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  // Buang baris yatim (resep non-aktif/terhapus → recipe null).
  return (data ?? []).map((row) => row.recipe).filter(Boolean);
}

// Ambil hanya id resep tersimpan (ringan, untuk menandai status simpan di UI).
export async function getSavedRecipeIds() {
  await requireUser();
  const { data, error } = await supabase
    .from("saved_recipes")
    .select("recipe_id");

  if (error) throw error;
  return (data ?? []).map((row) => row.recipe_id);
}

// Simpan satu resep. Idempoten: duplikat (PK gabungan) di-upsert tanpa error.
export async function saveRecipe(recipeId) {
  const user = await requireUser();
  const { error } = await supabase
    .from("saved_recipes")
    .upsert(
      { user_id: user.id, recipe_id: recipeId },
      { onConflict: "user_id,recipe_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

// Hapus satu resep dari tersimpan.
export async function unsaveRecipe(recipeId) {
  const user = await requireUser();
  const { error } = await supabase
    .from("saved_recipes")
    .delete()
    .eq("user_id", user.id)
    .eq("recipe_id", recipeId);
  if (error) throw error;
}
