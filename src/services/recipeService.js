import { supabase } from "../lib/supabase.js";
import { getCurrentSubscription } from "./subscriptionService.js";

// Service layer untuk bank resep (Ofisial & Kreasi Pengguna/UGC).
// Kolom DB (snake_case) di-alias ke camelCase agar konsisten di seluruh UI.

export const RECIPE_SELECT = `
  id, title, description, calories, difficulty, cuisine, badges, tags, instructions,
  imageUrl:image_url,
  priceIdr:price_idr,
  readyInMinutes:ready_in_minutes,
  baseServings:base_servings,
  isVerified:is_verified,
  ingredientsText:ingredients_text,
  userId:user_id,
  isPublic:is_public,
  authorName:author_name,
  likesCount:likes_count,
  createdAt:created_at,
  ingredients:recipe_ingredients (
    id, ingredientId:ingredient_id, name, amount, unit, category, priceIdr:price_idr,
    master:ingredients ( isStaple:is_staple )
  )
`;

async function requireUser() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Belum login.");
  return data.user;
}

// Ambil semua resep aktif (resep ofisial + resep komunitas publik + resep sendiri).
export async function getRecipes() {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("is_active", true)
    .order("id");

  if (error) throw error;
  return data ?? [];
}

// Ambil resep kreasi milik pengguna sendiri (termasuk status draf).
export async function getMyRecipes() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Ambil resep komunitas publik (resep buatan user yang is_public = true).
export async function getCommunityRecipes(options = {}) {
  const { search, tags, page, limit, sortBy = "newest" } = options;

  let query = supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("is_active", true)
    .not("user_id", "is", null)
    .eq("is_public", true);

  if (search && search.trim()) {
    const q = search.trim();
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (Array.isArray(tags) && tags.length > 0) {
    query = query.overlaps("tags", tags);
  }

  if (sortBy === "popular") {
    query = query.order("likes_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (page && limit) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// Ambil satu resep berdasarkan id.
export async function getRecipeById(id) {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// Ambil beberapa resep sekaligus by id.
export async function getRecipesByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .in("id", ids);

  if (error) throw error;
  return data ?? [];
}

// Search master ingredients untuk autocomplete di form resep
export async function searchIngredients(query = "") {
  let q = supabase
    .from("ingredients")
    .select("id, name, category, baseUnit:base_unit")
    .order("name");

  if (query.trim()) {
    q = q.ilike("name", `%${query.trim()}%`);
  }

  const { data, error } = await q.limit(20);
  if (error) throw error;
  return data ?? [];
}

// --- CRUD Resep Kreasi Pengguna -----------------------------------------------

export async function createRecipe(recipeData) {
  const user = await requireUser();

  // Ambil author name dari profile user
  let authorName = "Pengguna CookPlan";
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single();
    if (prof) {
      authorName = prof.full_name?.trim() || prof.username?.trim() || authorName;
    }
  } catch (e) {
    console.warn("Gagal mengambil nama author:", e);
  }

  const instructionsList = Array.isArray(recipeData.instructions)
    ? recipeData.instructions.filter((s) => typeof s === "string" && s.trim())
    : typeof recipeData.instructions === "string"
    ? recipeData.instructions.split("\n").filter(Boolean)
    : [];

  const rawIngredients = Array.isArray(recipeData.ingredients) ? recipeData.ingredients : [];

  let ingredientsText = recipeData.ingredientsText ?? recipeData.ingredients_text ?? null;
  if (!ingredientsText && rawIngredients.length > 0) {
    ingredientsText = rawIngredients
      .map((i) => [i.amount, i.unit, i.name].filter(Boolean).join(" "))
      .join(", ");
  }

  const recipeRow = {
    user_id: user.id,
    author_name: authorName,
    title: recipeData.title?.trim() || "Resep Tanpa Judul",
    description: recipeData.description?.trim() || null,
    image_url: recipeData.imageUrl ?? recipeData.image_url ?? null,
    difficulty: recipeData.difficulty || "easy",
    ready_in_minutes: Number(recipeData.readyInMinutes) || 30,
    base_servings: Number(recipeData.baseServings) || 2,
    cuisine: recipeData.cuisine?.trim() || "Indonesian",
    is_public: recipeData.isPublic !== undefined ? Boolean(recipeData.isPublic) : true,
    instructions: instructionsList,
    ingredients_text: ingredientsText,
    is_active: true,
    badges: recipeData.badges || ["Komunitas"],
    tags: recipeData.tags || ["komunitas"],
  };

  const { data: insertedRecipe, error: recipeErr } = await supabase
    .from("recipes")
    .insert(recipeRow)
    .select("id")
    .single();

  if (recipeErr) throw recipeErr;
  const recipeId = insertedRecipe.id;

  // Insert ingredients into recipe_ingredients
  if (rawIngredients.length > 0) {
    const ingredientRows = rawIngredients
      .filter((ing) => ing.name && ing.name.trim())
      .map((ing) => ({
        recipe_id: recipeId,
        ingredient_id: ing.ingredientId ?? ing.ingredient_id ?? null,
        name: ing.name.trim(),
        amount: ing.amount != null && ing.amount !== "" ? Number(ing.amount) : null,
        unit: ing.unit ? ing.unit.trim().toLowerCase() : "secukupnya",
        category: ing.category || null,
      }));

    if (ingredientRows.length > 0) {
      const { error: ingErr } = await supabase
        .from("recipe_ingredients")
        .insert(ingredientRows);
      if (ingErr) throw ingErr;
    }
  }

  return recipeId;
}

export async function updateRecipe(recipeId, recipeData) {
  await requireUser();

  const updates = {};
  if (recipeData.title !== undefined) updates.title = recipeData.title.trim();
  if (recipeData.description !== undefined) updates.description = recipeData.description.trim() || null;
  if (recipeData.readyInMinutes !== undefined || recipeData.ready_in_minutes !== undefined) {
    updates.ready_in_minutes = recipeData.readyInMinutes ?? recipeData.ready_in_minutes ?? null;
  }
  if (recipeData.calories !== undefined) updates.calories = recipeData.calories ?? null;
  if (recipeData.difficulty !== undefined) updates.difficulty = recipeData.difficulty;
  if (recipeData.cuisine !== undefined) updates.cuisine = recipeData.cuisine || null;
  if (recipeData.badges !== undefined) updates.badges = Array.isArray(recipeData.badges) ? recipeData.badges : [];
  if (recipeData.tags !== undefined) updates.tags = Array.isArray(recipeData.tags) ? recipeData.tags : [];
  if (recipeData.instructions !== undefined) {
    updates.instructions = Array.isArray(recipeData.instructions)
      ? recipeData.instructions.filter((s) => typeof s === "string" && s.trim())
      : typeof recipeData.instructions === "string"
      ? recipeData.instructions.split("\n").filter(Boolean)
      : [];
  }
  if (recipeData.imageUrl !== undefined || recipeData.image_url !== undefined) {
    updates.image_url = recipeData.imageUrl ?? recipeData.image_url ?? null;
  }
  if (recipeData.isPublic !== undefined || recipeData.is_public !== undefined) {
    updates.is_public = recipeData.isPublic ?? recipeData.is_public ?? true;
  }
  if (recipeData.baseServings !== undefined || recipeData.base_servings !== undefined) {
    updates.base_servings = recipeData.baseServings ?? recipeData.base_servings ?? 2;
  }
  if (recipeData.ingredientsText !== undefined || recipeData.ingredients_text !== undefined) {
    updates.ingredients_text = recipeData.ingredientsText ?? recipeData.ingredients_text ?? null;
  }

  if (Object.keys(updates).length > 0) {
    const { error: recipeErr } = await supabase
      .from("recipes")
      .update(updates)
      .eq("id", recipeId);

    if (recipeErr) throw recipeErr;
  }

  // Sync ingredients if provided
  if (Array.isArray(recipeData.ingredients)) {
    const { error: delErr } = await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("recipe_id", recipeId);
    if (delErr) throw delErr;

    const ingredientRows = recipeData.ingredients
      .filter((ing) => ing.name && ing.name.trim())
      .map((ing) => ({
        recipe_id: recipeId,
        ingredient_id: ing.ingredientId ?? ing.ingredient_id ?? null,
        name: ing.name.trim(),
        amount: ing.amount != null && ing.amount !== "" ? Number(ing.amount) : null,
        unit: ing.unit ? ing.unit.trim().toLowerCase() : "secukupnya",
        category: ing.category || null,
      }));

    if (ingredientRows.length > 0) {
      const { error: ingErr } = await supabase
        .from("recipe_ingredients")
        .insert(ingredientRows);
      if (ingErr) throw ingErr;
    }
  }

  return recipeId;
}

export async function deleteRecipe(recipeId) {
  await requireUser();
  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", recipeId);

  if (error) throw error;
}

// --- Sistem Like Resep --------------------------------------------------------

export async function toggleLikeRecipe(recipeId, isLiked) {
  const user = await requireUser();

  let targetLiked = isLiked;
  if (typeof targetLiked !== "boolean") {
    const { data } = await supabase
      .from("recipe_likes")
      .select("recipe_id")
      .eq("user_id", user.id)
      .eq("recipe_id", recipeId)
      .maybeSingle();
    targetLiked = !data;
  }

  if (targetLiked) {
    const { error } = await supabase
      .from("recipe_likes")
      .upsert(
        { user_id: user.id, recipe_id: recipeId },
        { onConflict: "user_id,recipe_id", ignoreDuplicates: true }
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("recipe_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("recipe_id", recipeId);
    if (error) throw error;
  }
}

export async function getMyLikedRecipeIds() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("recipe_likes")
    .select("recipe_id")
    .eq("user_id", user.id);

  if (error) throw error;
  return (data ?? []).map((row) => row.recipe_id);
}

// --- Resep tersimpan (saved_recipes) -----------------------------------------

export async function getSavedRecipes() {
  await requireUser();
  const { data, error } = await supabase
    .from("saved_recipes")
    .select(`created_at, recipe:recipes (${RECIPE_SELECT})`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => row.recipe).filter(Boolean);
}

export async function getSavedRecipeIds() {
  await requireUser();
  const { data, error } = await supabase
    .from("saved_recipes")
    .select("recipe_id");

  if (error) throw error;
  return (data ?? []).map((row) => row.recipe_id);
}

export async function saveRecipe(recipeId) {
  const user = await requireUser();
  
  // Cek jumlah resep yang sudah disimpan
  const { count } = await supabase
    .from("saved_recipes")
    .select("recipe_id", { count: "exact", head: true })
    .eq("user_id", user.id);
    
  if ((count ?? 0) >= 10) {
    // Cek apakah punya langganan aktif
    const sub = await getCurrentSubscription();
    if (!sub || sub.status !== 'active') {
      const err = new Error("Kuota simpan resep gratis (10 resep) telah habis. Silakan berlangganan Paket Digital (CookPass Lite) atau Paket Komplet (CookPass Pro) untuk menyimpan resep tanpa batas.");
      err.code = "QUOTA_EXHAUSTED";
      throw err;
    }
  }

  const { error } = await supabase
    .from("saved_recipes")
    .upsert(
      { user_id: user.id, recipe_id: recipeId },
      { onConflict: "user_id,recipe_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function unsaveRecipe(recipeId) {
  const user = await requireUser();
  const { error } = await supabase
    .from("saved_recipes")
    .delete()
    .eq("user_id", user.id)
    .eq("recipe_id", recipeId);
  if (error) throw error;
}
