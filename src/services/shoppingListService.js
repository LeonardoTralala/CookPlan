import { supabase } from "../lib/supabase.js";
import { getCurrentSubscription } from "./subscriptionService.js";

// Service layer untuk fitur "Simpan Daftar Belanja" (Phase 12, notulen #13).
// Snapshot daftar belanja milik user disimpan di tabel saved_shopping_lists
// (owner-only via RLS).

const MONTHLY_FREE_SHOPPING_LIMIT = 10;

// Menghitung jumlah pembuatan/penyimpanan daftar belanja bulan ini (UTC start of month)
export async function getMonthlyShoppingListCount() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return 0;

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { count, error } = await supabase
    .from("saved_shopping_lists")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth);

  if (error) return 0;
  return count ?? 0;
}

// Simpan daftar belanja baru.
// payload: { title, sourceType: 'generate'|'package'|'planner', sourceRef?, items:[...], totalIdr }
// Return baris yang tersimpan.
export async function saveShoppingList(payload) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  // Cek limit 10x per bulan untuk user non-langganan
  const monthlyCount = await getMonthlyShoppingListCount();
  if (monthlyCount >= MONTHLY_FREE_SHOPPING_LIMIT) {
    const sub = await getCurrentSubscription().catch(() => null);
    if (!sub || sub.status !== 'active') {
      const err = new Error("Kuota 10x pembuatan/penyimpanan daftar belanja otomatis gratis bulan ini telah habis. Silakan berlangganan Paket Digital (CookPass Lite) atau Paket Komplet (CookPass Pro) untuk membuat daftar belanja tanpa batas.");
      err.code = "QUOTA_EXHAUSTED";
      throw err;
    }
  }

  const { data, error } = await supabase
    .from("saved_shopping_lists")
    .insert({
      user_id: user.id,
      title: payload.title,
      source_type: payload.sourceType ?? "planner",
      source_ref: payload.sourceRef ?? null,
      items_json: payload.items ?? [],
      total_idr: Math.round(payload.totalIdr ?? 0),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Ambil daftar belanja tersimpan milik user (terbaru dulu).
export async function getSavedShoppingLists() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const { data, error } = await supabase
    .from("saved_shopping_lists")
    .select("id, title, source_type, source_ref, items_json, total_idr, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Hapus satu daftar tersimpan (RLS memastikan hanya milik sendiri).
export async function deleteSavedShoppingList(id) {
  const { error } = await supabase
    .from("saved_shopping_lists")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
