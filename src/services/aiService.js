import { supabase } from "../lib/supabase.js";

// Service layer untuk fitur AI generate. Memanggil Edge Function `generate-plan`
// yang jadi proxy provider-agnostic (lihat Phase 3). Frontend tidak pernah
// menyentuh API key AI — semua lewat Edge Function.

// Input shape yang dikirim ke Edge Function:
//   {
//     periode: 3|7|14,           // jumlah hari
//     porsi: number,             // porsi per jam makan (servings per slot, auto dikali jumlah waktu makan)
//     diet: string[],            // ['vegetarian','halal',...]
//     budget: number,            // IDR total
//     pantry: [{name, amount?, unit?}],  // bahan tersedia di rumah
//     variasiPerHari: number,    // 1..3 jumlah resep BERBEDA per hari (foodprep: dipakai ulang menutup 3 waktu makan)
//     notes: string,             // catatan khusus user (opsional), max 300 char
//     outputType: 'foodplan'|'foodprep'|'full'
//   }
//
// Output (dari Edge Function):
//   {
//     plan: { days:[...], shopping_list:[...], prep_instructions:[...],
//             total_estimated_cost, warnings:[] },
//     reasoning: string|null,
//     meta: { model, latency_ms, est_cost_usd, cached },
//     planId: number
//   }

export async function generatePlan(input) {
  const { data, error } = await supabase.functions.invoke("generate-plan", {
    body: input,
  });
  if (error) {
    // Edge Function error → coba ekstrak pesan ramah
    let detail = error.message || "Gagal generate plan.";
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) detail = ctx.error;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return data;
}

// Regenerate menu SATU hari dari sebuah plan. Memanggil Edge Function
// `regenerate-day`. AI menyusun ulang menu hari itu (opsional dengan catatan
// preferensi user), server menghitung ulang daftar belanja seluruh plan.
//   planId   : id baris generated_plans
//   dayIndex : index hari di plan.days (0-based)
//   opts     : { note?: string, mealType?: 'breakfast'|'lunch'|'dinner' }
// Return: { plan, dayIndex, day, meta, planId }
export async function regenerateDay(planId, dayIndex, { note = "", mealType = null } = {}) {
  const body = { planId, dayIndex };
  if (note) body.note = note;
  if (mealType) body.mealType = mealType;
  const { data, error } = await supabase.functions.invoke("regenerate-day", { body });
  if (error) {
    let detail = error.message || "Gagal regenerate hari.";
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) detail = ctx.error;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return data;
}

// Ambil history generate milik user (untuk halaman riwayat / dashboard).
// successOnly: filter status='success' DI SERVER supaya limit menghitung hanya
// hasil sukses — bila tidak, beberapa generate gagal terbaru bisa "menelan"
// kuota limit dan membuat daftar tampak kosong padahal ada sukses lebih lama.
export async function getGeneratedHistory(limit = 10, { successOnly = false } = {}) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");
  let query = supabase
    .from("generated_plans")
    .select("id, input_json, output_type, model, status, created_at")
    .eq("user_id", user.id);
  if (successOnly) query = query.eq("status", "success");
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Hapus satu hasil generate milik user (defense in depth: filter user_id eksplisit).
export async function deleteGeneratedPlan(id) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");
  const { error } = await supabase
    .from("generated_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

// Ambil satu hasil generate by id (untuk render ulang hasil tersimpan).
// Defense in depth: filter eksplisit user_id selain mengandalkan RLS (audit #9).
export async function getGeneratedPlanById(id) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");
  const { data, error } = await supabase
    .from("generated_plans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error) throw error;
  return data;
}

// Cek sisa kuota generate hari ini (rate limit info untuk UI).
// Pakai setUTCHours supaya batas hari konsisten dengan toISOString() (UTC).
// Server-side rate limit di Edge Function juga UTC-based, sehingga UI &
// server pakai window yang sama (audit Copilot: setHours lokal + toISOString
// UTC menghasilkan boundary yang inkonsisten untuk user non-UTC).
export async function getTodayUsageCount() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return 0;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfDay.toISOString());
  if (error) throw error;
  return count ?? 0;
}
