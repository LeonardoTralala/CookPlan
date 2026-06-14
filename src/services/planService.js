import { supabase } from "../lib/supabase.js";

// Service layer untuk rencana mingguan. Mengganti persistensi localStorage.
// Bentuk state di frontend: { Senin: { breakfast, lunch, dinner }, ... }
// Di DB: weekly_plans (1 baris/user/minggu) + meal_entries (slot per hari+meal).

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

// Hitung tanggal Senin minggu berjalan (YYYY-MM-DD) sebagai kunci week.
// Pakai komponen tanggal LOKAL (bukan toISOString) supaya user di non-UTC
// timezone (mis. WIB UTC+7) tidak ketarik ke hari sebelumnya saat tengah malam
// lokal — bug yang bikin week_start_date tersimpan/terbaca di minggu salah.
export function getCurrentWeekStart(date = new Date()) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Minggu..6=Sabtu
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
    };
  }
  return plan;
}

// Ambil (atau buat) plan minggu berjalan milik user yang sedang login.
// Return { planId, plan } di mana plan = shape state frontend.
export async function getCurrentPlan() {
  const weekStart = getCurrentWeekStart();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

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
    .select("recipe_id, day_of_week, meal_type, servings, title, image_url, price_idr, ready_in_minutes, calories")
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

export { DAYS, MEAL_TYPES };
