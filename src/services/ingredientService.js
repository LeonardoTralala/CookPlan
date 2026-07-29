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

const SELECT =
  "id, name, category, baseUnit:base_unit, pricePerBase:price_per_base, isStaple:is_staple, " +
  "packSize:pack_size, packLabel:pack_label, packPriceIdr:pack_price_idr";

// Map patch camelCase → baris snake_case (hanya field yang dikenal).
function toRow(patch) {
  const row = {};
  if ("name" in patch) row.name = patch.name?.trim();
  if ("category" in patch) row.category = patch.category || null;
  if ("baseUnit" in patch) row.base_unit = patch.baseUnit;
  if ("pricePerBase" in patch)
    row.price_per_base =
      patch.pricePerBase === "" || patch.pricePerBase == null ? null : Number(patch.pricePerBase);
  if ("isStaple" in patch) row.is_staple = !!patch.isStaple;
  // pack_size/pack_label = penentu add-on "Belanja di Kami". pack_price_idr
  // TERHITUNG di DB (pack_size × price_per_base) — jangan ditulis manual.
  if ("packSize" in patch)
    row.pack_size = patch.packSize === "" || patch.packSize == null ? null : Number(patch.packSize);
  if ("packLabel" in patch) row.pack_label = patch.packLabel?.trim() || null;
  return row;
}

// --- Katalog bumbu dapur (add-on "Belanja di Kami") --------------------------

// Bahan pokok yang ditawarkan sbg add-on opsional: hanya yang punya ukuran kemasan
// jual + harga terhitung (pack_price_idr). Read publik via RLS — dipakai pembeli
// di tab "Belanja di Kami", bukan hanya admin, jadi tanpa requireUser (seperti
// getRecipes). pack_price_idr = pack_size × price_per_base (sumber tunggal harga).
const ADDON_SELECT =
  "id, name, category, baseUnit:base_unit, packSize:pack_size, packLabel:pack_label, packPriceIdr:pack_price_idr";

export async function getPantryAddons() {
  const { data, error } = await supabase
    .from("ingredients")
    .select(ADDON_SELECT)
    .not("pack_price_idr", "is", null)
    .order("name");
  if (error) throw error;
  return data ?? [];
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

// Gabung master `sourceId` ke `targetId` (pembersih duplikat tanpa loss): nama &
// alias sumber jadi alias target, override + semua baris resep dipindah, lalu
// sumber dihapus. Atomik & admin-only via RPC merge_ingredient (security definer).
export async function mergeIngredient(sourceId, targetId) {
  await requireUser();
  const { error } = await supabase.rpc("merge_ingredient", {
    p_source: sourceId,
    p_target: targetId,
  });
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

// Semua override (ingredientId → {unit, factorToBase}), untuk preview biaya baris
// di editor resep tanpa round-trip per bahan.
export async function listAllOverrides() {
  await requireUser();
  const { data, error } = await supabase
    .from("ingredient_unit_overrides")
    .select("ingredientId:ingredient_id, unit, factorToBase:factor_to_base");
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

// --- Alias bahan (sinonim → master kanonik) ----------------------------------
// Dipakai resolve nama di entri resep (RecipeManager) supaya varian seperti
// "santan instant" nempel ke master "santan instan", bukan bikin master kembar.

const normAlias = (s) => String(s ?? "").trim().toLowerCase();

// Semua alias (alias → ingredientId), untuk peta lookup sekali muat.
export async function listAllAliases() {
  await requireUser();
  const { data, error } = await supabase
    .from("ingredient_aliases")
    .select("alias, ingredientId:ingredient_id");
  if (error) throw error;
  return data ?? [];
}

export async function listAliases(ingredientId) {
  await requireUser();
  const { data, error } = await supabase
    .from("ingredient_aliases")
    .select("alias")
    .eq("ingredient_id", ingredientId)
    .order("alias");
  if (error) throw error;
  return data ?? [];
}

// Tambah/pindah alias ke sebuah master. alias selalu disimpan ternormalisasi.
// Tolak alias yang sama dengan nama master kanonik mana pun (itu bukan alias).
export async function addAlias(ingredientId, alias) {
  await requireUser();
  const a = normAlias(alias);
  if (a.length < 2) throw new Error("Alias terlalu pendek.");
  const { error } = await supabase
    .from("ingredient_aliases")
    .upsert({ alias: a, ingredient_id: ingredientId }, { onConflict: "alias" });
  if (error) throw error;
}

export async function deleteAlias(alias) {
  await requireUser();
  const { error } = await supabase.from("ingredient_aliases").delete().eq("alias", normAlias(alias));
  if (error) throw error;
}

// --- Antrean Bahan Bebas Pengguna (Unlinked Queue) ---------------------------

export async function getUnlinkedIngredients() {
  await requireUser();
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("name, recipes(title)")
    .is("ingredient_id", null);

  if (error) throw error;

  const groupMap = new Map();
  for (const row of data ?? []) {
    const cleanName = row.name?.trim();
    if (!cleanName) continue;
    const key = cleanName.toLowerCase();

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        name: cleanName,
        count: 0,
        sampleTitlesSet: new Set(),
      });
    }

    const item = groupMap.get(key);
    item.count += 1;
    if (row.recipes?.title) {
      item.sampleTitlesSet.add(row.recipes.title);
    }
  }

  const result = Array.from(groupMap.values()).map((item) => ({
    name: item.name,
    count: item.count,
    sampleRecipeTitles: Array.from(item.sampleTitlesSet).slice(0, 3),
  }));

  result.sort((a, b) => b.count - a.count);
  return result;
}

export async function linkUnlinkedIngredient(ingredientName, masterIngredientId) {
  await requireUser();
  if (!ingredientName || !masterIngredientId) {
    throw new Error("Nama bahan dan master ingredient ID wajib diisi.");
  }
  const { error } = await supabase
    .from("recipe_ingredients")
    .update({ ingredient_id: masterIngredientId })
    .is("ingredient_id", null)
    .ilike("name", ingredientName.trim());

  if (error) throw error;
}

