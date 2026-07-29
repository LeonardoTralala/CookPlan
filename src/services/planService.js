import { supabase } from "../lib/supabase.js";
import { getWeekStart, toWeekKey } from "../utils/week.js";

// Service layer untuk rencana mingguan. Mengganti persistensi localStorage.
// Bentuk state di frontend: { Senin: { breakfast, lunch, dinner }, ... }
// Di DB: weekly_plans (1 baris/user/minggu) + meal_entries (slot per hari+meal).

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

// Kunci minggu (YYYY-MM-DD = tanggal Senin) untuk week_start_date di DB.
// Delegasi ke utils/week.js supaya hanya ada SATU implementasi "cari hari Senin"
// di seluruh app (lihat catatan timezone lokal di sana).
export function getCurrentWeekStart(date = new Date()) {
  return toWeekKey(getWeekStart(date));
}

function createEmptyPlan() {
  return DAYS.reduce((acc, day) => {
    acc[day] = { breakfast: null, lunch: null, dinner: null };
    return acc;
  }, {});
}

// Ubah baris meal_entries jadi shape state frontend.
function entriesToPlanShape(entries) {
  const plan = createEmptyPlan();
  for (const e of entries ?? []) {
    if (!plan[e.day_of_week]) continue;
    plan[e.day_of_week][e.meal_type] = {
      recipeId: e.recipe_id,
      title: e.title,
      servings: e.servings,
      imageUrl: e.image_url,
      priceIdr: e.price_idr,
      readyInMinutes: e.ready_in_minutes,
      calories: e.calories,
      isCooked: e.is_cooked,
    };
  }
  return plan;
}

async function getAuthUser() {
  const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: null }));
  if (userData?.user) return userData.user;
  const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: null }));
  return sessionData?.session?.user ?? null;
}

// Ambil (atau buat) plan untuk satu minggu milik user yang sedang login.
// `weekStart` = kunci minggu (YYYY-MM-DD), default minggu berjalan. Backend
// (weekly_plans unik per user+week_start_date, RLS per-owner) sudah mendukung
// banyak minggu — parameter ini yang membuka navigasi antar-minggu di UI.
// Return { planId, plan } di mana plan = shape state frontend.
export async function getCurrentPlan(weekStart = getCurrentWeekStart()) {
  const user = await getAuthUser();
  if (!user || user.is_anonymous) throw new Error("Silakan masuk atau daftar akun untuk menyimpan rencana ke jadwal kamu.");

  // cari plan minggu ini
  let { data: planRow, error } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start_date", weekStart)
    .maybeSingle();
  if (error) throw error;

  // belum ada → buat
  if (!planRow) {
    const { data: inserted, error: insErr } = await supabase
      .from("weekly_plans")
      .insert({ user_id: user.id, week_start_date: weekStart })
      .select("id")
      .single();
    if (insErr) throw insErr;
    planRow = inserted;
  }

  // ambil slot
  const { data: entries, error: entErr } = await supabase
    .from("meal_entries")
    .select("recipe_id, day_of_week, meal_type, servings, title, image_url, price_idr, ready_in_minutes, calories, is_cooked")
    .eq("plan_id", planRow.id);
  if (entErr) throw entErr;

  return { planId: planRow.id, plan: entriesToPlanShape(entries) };
}

// Set / replace satu slot. Upsert berdasarkan unique (plan, day, meal).
export async function setSlot(planId, recipe, day, mealType, servings) {
  if (!DAYS.includes(day) || !MEAL_TYPES.includes(mealType)) {
    throw new Error("Hari atau jenis makan tidak valid.");
  }
  const row = {
    plan_id: planId,
    recipe_id: recipe.id ?? recipe.recipeId,
    day_of_week: day,
    meal_type: mealType,
    servings,
    title: recipe.title,
    image_url: recipe.imageUrl,
    price_idr: recipe.priceIdr,
    ready_in_minutes: recipe.readyInMinutes,
    calories: recipe.calories,
    is_cooked: false, // Reset status masak jika di-set ulang/baru
  };
  const { error } = await supabase
    .from("meal_entries")
    .upsert(row, { onConflict: "plan_id,day_of_week,meal_type" });
  if (error) throw error;
}

// Set banyak slot sekaligus (dipakai apply hasil generate AI ke planner).
// Satu kali upsert supaya tidak menembak 21 request terpisah. Duplikat
// (day, mealType) di-dedupe ambil yang terakhir — Postgres menolak ON CONFLICT
// yang menyentuh baris yang sama dua kali dalam satu statement.
export async function setSlots(planId, slots) {
  const deduped = new Map();
  for (const s of slots ?? []) {
    if (!DAYS.includes(s.day) || !MEAL_TYPES.includes(s.mealType)) {
      throw new Error("Hari atau jenis makan tidak valid.");
    }
    deduped.set(`${s.day}|${s.mealType}`, s);
  }
  if (deduped.size === 0) return;

  const rows = [...deduped.values()].map(({ recipe, day, mealType, servings }) => ({
    plan_id: planId,
    recipe_id: recipe.id ?? recipe.recipeId,
    day_of_week: day,
    meal_type: mealType,
    servings,
    title: recipe.title,
    image_url: recipe.imageUrl,
    price_idr: recipe.priceIdr,
    ready_in_minutes: recipe.readyInMinutes,
    calories: recipe.calories,
    is_cooked: false,
  }));
  const { error } = await supabase
    .from("meal_entries")
    .upsert(rows, { onConflict: "plan_id,day_of_week,meal_type" });
  if (error) throw error;
}

// Hapus satu slot.
export async function removeSlot(planId, day, mealType) {
  const { error } = await supabase
    .from("meal_entries")
    .delete()
    .eq("plan_id", planId)
    .eq("day_of_week", day)
    .eq("meal_type", mealType);
  if (error) throw error;
}

// Hapus semua slot dalam satu plan (satu DELETE, lebih efisien dari loop removeSlot).
export async function clearAllSlots(planId) {
  const { error } = await supabase
    .from("meal_entries")
    .delete()
    .eq("plan_id", planId);
  if (error) throw error;
}

// Mengubah status masak (is_cooked)
export async function toggleCookedStatus(planId, day, mealType, isCooked) {
  if (!DAYS.includes(day) || !MEAL_TYPES.includes(mealType)) {
    throw new Error("Hari atau jenis makan tidak valid.");
  }
  const { error } = await supabase
    .from("meal_entries")
    .update({ is_cooked: isCooked })
    .eq("plan_id", planId)
    .eq("day_of_week", day)
    .eq("meal_type", mealType);
  if (error) throw error;
}

// Mendapatkan semua tugas persiapan bahan (food prep)
export async function getPrepTasks(planId) {
  const { data, error } = await supabase
    .from("food_prep_tasks")
    .select("id, task_text, is_completed")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    taskText: t.task_text,
    isCompleted: t.is_completed,
  }));
}

// Menambahkan tugas persiapan bahan baru
export async function addPrepTask(planId, taskText) {
  const { data, error } = await supabase
    .from("food_prep_tasks")
    .insert({ plan_id: planId, task_text: taskText })
    .select("id, task_text, is_completed")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    taskText: data.task_text,
    isCompleted: data.is_completed,
  };
}

// Mengubah status penyelesaian tugas persiapan bahan
export async function togglePrepTask(taskId, isCompleted) {
  const { error } = await supabase
    .from("food_prep_tasks")
    .update({ is_completed: isCompleted })
    .eq("id", taskId);
  if (error) throw error;
}

// Menghapus tugas persiapan bahan
export async function deletePrepTask(taskId) {
  const { error } = await supabase
    .from("food_prep_tasks")
    .delete()
    .eq("id", taskId);
  if (error) throw error;
}

// --- FITUR SHARE & IMPORT RENCANA MINGGUAN ----------------------------------

// Mengambil (atau membuat) share_token unguessable untuk plan tertentu milik user
export async function getOrCreateShareToken(planId) {
  const user = await getAuthUser();
  if (!user || user.is_anonymous) throw new Error("Silakan masuk atau daftar akun untuk membagikan rencana makan ini.");

  const { data, error } = await supabase
    .from("weekly_plans")
    .select("share_token")
    .eq("id", planId)
    .single();
  if (error) throw error;

  if (data?.share_token) return data.share_token;

  // Generate token acak jika belum ada
  const newToken = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: updated, error: updateErr } = await supabase
    .from("weekly_plans")
    .update({ share_token: newToken })
    .eq("id", planId)
    .select("share_token")
    .single();

  if (updateErr) throw updateErr;
  return updated.share_token;
}

// Memuat rencana mingguan publik berdasarkan share_token (Tanpa perlu login / public read)
export async function getSharedPlanByToken(shareToken) {
  if (!shareToken) throw new Error("Token share tidak ditemukan.");

  const { data: planRow, error } = await supabase
    .from("weekly_plans")
    .select("id, week_start_date, user_id")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (error) throw error;
  if (!planRow) throw new Error("Rencana mingguan yang dibagikan tidak ditemukan atau telah dihapus.");

  const { data: entries, error: entErr } = await supabase
    .from("meal_entries")
    .select("recipe_id, day_of_week, meal_type, servings, title, image_url, price_idr, ready_in_minutes, calories, is_cooked")
    .eq("plan_id", planRow.id);

  if (entErr) throw entErr;

  return {
    planId: planRow.id,
    weekStartDate: planRow.week_start_date,
    plan: entriesToPlanShape(entries),
    rawEntries: entries ?? [],
  };
}

// Mengimpor slot menu dari plan yang di-share ke rencana mingguan milik user yang sedang login
export async function importSharedPlan(shareToken, targetWeekStart = getCurrentWeekStart()) {
  const { rawEntries } = await getSharedPlanByToken(shareToken);
  const { planId: targetPlanId } = await getCurrentPlan(targetWeekStart);

  if (!rawEntries || rawEntries.length === 0) {
    throw new Error("Rencana yang dibagikan belum memiliki menu masakan.");
  }

  const slotsToImport = rawEntries.map((e) => ({
    day: e.day_of_week,
    mealType: e.meal_type,
    servings: e.servings,
    recipe: {
      id: e.recipe_id,
      title: e.title,
      imageUrl: e.image_url,
      priceIdr: e.price_idr,
      readyInMinutes: e.ready_in_minutes,
      calories: e.calories,
    },
  }));

  await setSlots(targetPlanId, slotsToImport);
  return targetPlanId;
}

export { DAYS, MEAL_TYPES };

