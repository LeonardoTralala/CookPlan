import { supabase } from "../lib/supabase.js";
import { RECIPE_SELECT } from "./recipeService.js";

// Service layer untuk Admin UI bank resep (/admin/recipes).
// Tulis langsung lewat supabase client — RLS policy admin (public.is_admin()) untuk
// recipes & recipe_ingredients sudah ada (migrasi 20260611000004). getUser() dipakai
// sebagai defense-in-depth; gerbang sebenarnya tetap RLS di server.

const RECIPE_IMAGE_BUCKET = "recipes"; // bucket bersama yang sudah ada (admin-write, public read)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (samakan dengan limit bucket `recipes`)
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Kolom resep yang boleh ditulis admin. UI pakai camelCase; DB snake_case.
const FIELD_MAP = {
  title: "title",
  description: "description",
  readyInMinutes: "ready_in_minutes",
  calories: "calories",
  // priceIdr (total) TIDAK ditulis manual — dihitung otomatis dari harga bahan (trigger DB).
  imageUrl: "image_url",
  difficulty: "difficulty",
  cuisine: "cuisine",
  badges: "badges",
  tags: "tags",
  instructions: "instructions",
  ingredientsText: "ingredients_text",
  baseServings: "base_servings",
  isActive: "is_active",
};

// Ubah patch camelCase → baris snake_case (hanya field yang dikenal).
function toRow(patch) {
  const row = {};
  for (const [key, col] of Object.entries(FIELD_MAP)) {
    if (key in patch) row[col] = patch[key];
  }
  return row;
}

async function requireUser() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Belum login.");
  return data.user;
}

// --- Resep -------------------------------------------------------------------

// Semua resep (termasuk yang disembunyikan / is_active=false), urut id.
export async function listAllRecipes() {
  await requireUser();
  // RECIPE_SELECT (dipakai katalog) tak memuat is_active; admin butuh kolom ini
  // untuk membedakan resep aktif vs disembunyikan.
  const { data, error } = await supabase
    .from("recipes")
    .select(`${RECIPE_SELECT}, isActive:is_active`)
    .order("id");
  if (error) throw error;
  return data ?? [];
}

// Buat resep baru. Return id resep yang dibuat.
export async function createRecipe(patch) {
  await requireUser();
  const { data, error } = await supabase
    .from("recipes")
    .insert(toRow(patch))
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Update field resep (camelCase patch).
export async function updateRecipe(id, patch) {
  await requireUser();
  const { error } = await supabase
    .from("recipes")
    .update(toRow(patch))
    .eq("id", id);
  if (error) throw error;
}

// Hapus resep (recipe_ingredients ikut terhapus via FK on delete cascade).
export async function deleteRecipe(id) {
  await requireUser();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

// --- Bahan (recipe_ingredients) ----------------------------------------------
// CHECK: category ∈ vegetables|meat|dairy|spices|dry_goods (boleh NULL).

// Bahan satu resep LENGKAP dengan id (RECIPE_SELECT tak memuat id) — dipakai
// editor agar bisa update/hapus baris yang sudah ada.
export async function listIngredients(recipeId) {
  await requireUser();
  // price_idr kini DERIVED (trigger) — disertakan read-only untuk preview biaya baris.
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("id, ingredientId:ingredient_id, name, amount, unit, category, priceIdr:price_idr")
    .eq("recipe_id", recipeId)
    .order("id");
  if (error) throw error;
  return data ?? [];
}

// Baris bahan resep. Harga (price_idr) TIDAK ditulis di sini — dihitung trigger DB
// dari ingredient_id + amount + unit lewat Master Bahan. name/category disimpan untuk
// display (mengikuti master saat dipilih).
function ingredientRow(ing) {
  return {
    ingredient_id: ing.ingredientId ?? ing.ingredient_id ?? null,
    name: ing.name,
    amount: ing.amount === "" || ing.amount == null ? null : Number(ing.amount),
    unit: ing.unit || null,
    category: ing.category || null,
  };
}

export async function addIngredient(recipeId, ing) {
  await requireUser();
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .insert({ recipe_id: recipeId, ...ingredientRow(ing) })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateIngredient(ingId, ing) {
  await requireUser();
  const { error } = await supabase
    .from("recipe_ingredients")
    .update(ingredientRow(ing))
    .eq("id", ingId);
  if (error) throw error;
}

export async function deleteIngredient(ingId) {
  await requireUser();
  const { error } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("id", ingId);
  if (error) throw error;
}

// --- Foto resep (Storage) ----------------------------------------------------
// Tiru profileService.uploadAvatar: validasi klien (UX cepat), bucket limit + RLS
// admin menjaga di server. Path "{recipe_id}/cover" (upsert) → ganti foto tak
// menumpuk file lama. Return URL publik (dengan cache-buster); pemanggil yang
// menulis ke recipes.image_url.
export async function uploadRecipeImage(recipeId, file) {
  await requireUser();
  if (!file) throw new Error("File tidak ditemukan.");
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Format foto harus JPG, PNG, atau WebP.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Ukuran foto maksimal 5 MB.");
  }

  const path = `${recipeId}/cover`;
  const { error: uploadError } = await supabase.storage
    .from(RECIPE_IMAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage
    .from(RECIPE_IMAGE_BUCKET)
    .getPublicUrl(path);
  // Nama file tetap → tambahkan cache-buster agar <img> memuat versi terbaru.
  return `${pub.publicUrl}?t=${Date.now()}`;
}
