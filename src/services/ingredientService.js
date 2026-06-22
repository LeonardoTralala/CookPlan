import { supabase } from "../lib/supabase.js";
import { validateIngredientName } from "../utils/parseIngredient.js";

// Service layer untuk Master Bahan (/admin/ingredients) — sumber kebenaran harga.
// Tulis langsung lewat RLS admin (public.is_admin()); harga di recipe_ingredients &
// total recipes dihitung ulang otomatis oleh trigger DB saat price_per_base berubah.

async function requireUser() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Belum login.");
  return data.user;
}

const SELECT = "id, name, category, baseUnit:base_unit, pricePerBase:price_per_base";

// Map patch camelCase → baris snake_case (hanya field yang dikenal).
function toRow(patch) {
  const row = {};
  if ("name" in patch) row.name = patch.name?.trim();
  if ("category" in patch) row.category = patch.category || null;
  if ("baseUnit" in patch) row.base_unit = patch.baseUnit;
  if ("pricePerBase" in patch)
    row.price_per_base =
      patch.pricePerBase === "" || patch.pricePerBase == null ? null : Number(patch.pricePerBase);
  return row;
}

// --- Master bahan ------------------------------------------------------------

// Semua bahan (opsi { unpriced } untuk hanya yang belum berharga), urut nama.
export async function listIngredients({ unpriced = false } = {}) {
  await requireUser();
  let q = supabase.from("ingredients").select(SELECT).order("name");
  if (unpriced) q = q.is("price_per_base", null);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createIngredient(patch) {
  await requireUser();
  const nameErr = validateIngredientName(patch.name);
  if (nameErr) throw new Error(nameErr);
  const { data, error } = await supabase
    .from("ingredients")
    .insert(toRow(patch))
    .select(SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateIngredient(id, patch) {
  await requireUser();
  if ("name" in patch) {
    const nameErr = validateIngredientName(patch.name);
    if (nameErr) throw new Error(nameErr);
  }
  const { error } = await supabase.from("ingredients").update(toRow(patch)).eq("id", id);
  if (error) throw error;
}

// Hapus bahan master. recipe_ingredients.ingredient_id → NULL otomatis (FK on
// delete set null), jadi resep tak ikut hilang — hanya tautan harganya lepas.
export async function deleteIngredient(id) {
  await requireUser();
  const { error } = await supabase.from("ingredients").delete().eq("id", id);
  if (error) throw error;
}

// --- Konversi satuan global (read-only di UI) --------------------------------
export async function listConversions() {
  const { data, error } = await supabase
    .from("unit_conversions")
    .select("unit, dimension, toBaseFactor:to_base_factor")
    .order("dimension")
    .order("unit");
  if (error) throw error;
  return data ?? [];
}

// --- Override hitung↔berat per-bahan -----------------------------------------
export async function listOverrides(ingredientId) {
  await requireUser();
  const { data, error } = await supabase
    .from("ingredient_unit_overrides")
    .select("unit, factorToBase:factor_to_base")
    .eq("ingredient_id", ingredientId)
    .order("unit");
  if (error) throw error;
  return data ?? [];
}

export async function upsertOverride(ingredientId, unit, factorToBase) {
  await requireUser();
  const { error } = await supabase
    .from("ingredient_unit_overrides")
    .upsert(
      { ingredient_id: ingredientId, unit: unit.trim().toLowerCase(), factor_to_base: Number(factorToBase) },
      { onConflict: "ingredient_id,unit" }
    );
  if (error) throw error;
}

export async function deleteOverride(ingredientId, unit) {
  await requireUser();
  const { error } = await supabase
    .from("ingredient_unit_overrides")
    .delete()
    .eq("ingredient_id", ingredientId)
    .eq("unit", unit);
  if (error) throw error;
}
