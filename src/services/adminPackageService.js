import { supabase } from "../lib/supabase.js";

// Service layer untuk Admin UI Paket "Belanja di Kami" (/admin/packages).
// Tulis langsung lewat supabase client — RLS policy admin (public.is_admin())
// untuk packages & package_meals sudah ada (migrasi 20260615000000). getUser()
// dipakai sebagai defense-in-depth; gerbang sebenarnya tetap RLS di server.
//
// Harga paket TIDAK disimpan statis: dihitung dari agregasi recipe_ingredients
// menu paket (single source of truth, konsisten dengan halaman Belanja).

// Embed admin: termasuk paket non-aktif + menu + bahan resep (buat preview harga).
const PACKAGE_ADMIN_SELECT = `
  id, slug, name, description,
  periodeDays:periode_days,
  mealsPerDay:meals_per_day,
  baseServings:base_servings,
  priceIdr:price_idr,
  imageUrl:image_url,
  badges, isActive:is_active, sortOrder:sort_order,
  meals:package_meals (
    id, dayIndex:day_index, mealType:meal_type,
    recipe:recipes (
      id, title, baseServings:base_servings,
      imageUrl:image_url,
      ingredients:recipe_ingredients ( name, amount, unit, category, priceIdr:price_idr )
    )
  )
`;

// Kolom paket yang boleh ditulis admin. UI pakai camelCase; DB snake_case.
const FIELD_MAP = {
  slug: "slug",
  name: "name",
  description: "description",
  periodeDays: "periode_days",
  mealsPerDay: "meals_per_day",
  baseServings: "base_servings",
  priceIdr: "price_idr",
  imageUrl: "image_url",
  badges: "badges",
  isActive: "is_active",
  sortOrder: "sort_order",
};

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

// --- Paket --------------------------------------------------------------------

// Semua paket (termasuk yang disembunyikan / is_active=false), urut sort_order.
// Admin bisa baca paket non-aktif lewat policy packages_admin_write (for all).
export async function listAllPackages() {
  await requireUser();
  const { data, error } = await supabase
    .from("packages")
    .select(PACKAGE_ADMIN_SELECT)
    .order("sort_order")
    .order("id");
  if (error) throw error;
  return (data ?? []).map(sortMeals);
}

// Opsi resep untuk picker menu — embed bahan agar preview harga bisa hidup tanpa
// query tambahan tiap kali admin ganti resep. Resep katalog jumlahnya kecil.
export async function listRecipeOptions() {
  await requireUser();
  const { data, error } = await supabase
    .from("recipes")
    .select(`
      id, title,
      baseServings:base_servings,
      imageUrl:image_url,
      isActive:is_active,
      ingredients:recipe_ingredients ( name, amount, unit, category, priceIdr:price_idr )
    `)
    .order("title");
  if (error) throw error;
  return data ?? [];
}

// Buat paket baru. Return id paket yang dibuat.
export async function createPackage(patch) {
  await requireUser();
  const { data, error } = await supabase
    .from("packages")
    .insert(toRow(patch))
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Update field paket (camelCase patch). Slug tidak diubah dari editor (key permanen).
export async function updatePackage(id, patch) {
  await requireUser();
  const { error } = await supabase
    .from("packages")
    .update(toRow(patch))
    .eq("id", id);
  if (error) throw error;
}

// Hapus paket (package_meals ikut terhapus via FK on delete cascade).
export async function deletePackage(id) {
  await requireUser();
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw error;
}

// --- Menu fiks (package_meals) ------------------------------------------------

// Ganti seluruh menu sebuah paket: hapus dulu lalu insert ulang (idempoten, sama
// seperti seed migrasi). meals: [{ dayIndex, mealType, recipeId }] — baris tanpa
// recipeId di-skip. Constraint unik (package_id, day_index, meal_type) terjaga
// karena editor hanya mengirim 1 baris per slot.
export async function setPackageMeals(packageId, meals) {
  await requireUser();
  const { error: delErr } = await supabase
    .from("package_meals")
    .delete()
    .eq("package_id", packageId);
  if (delErr) throw delErr;

  const rows = (meals ?? [])
    .filter((m) => m.recipeId)
    .map((m) => ({
      package_id: packageId,
      day_index: m.dayIndex,
      meal_type: m.mealType,
      recipe_id: Number(m.recipeId),
    }));
  if (rows.length === 0) return;

  const { error } = await supabase.from("package_meals").insert(rows);
  if (error) throw error;
}

// --- Helper -------------------------------------------------------------------

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };
function sortMeals(pkg) {
  if (pkg?.meals) {
    pkg.meals.sort(
      (a, b) =>
        a.dayIndex - b.dayIndex ||
        (MEAL_ORDER[a.mealType] ?? 9) - (MEAL_ORDER[b.mealType] ?? 9)
    );
  }
  return pkg;
}

// Slugify nama jadi key permanen (a-z0-9 + dash). Dipakai saat buat paket baru.
export function slugify(text) {
  return (text ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
