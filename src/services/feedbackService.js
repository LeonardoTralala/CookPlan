import { supabase } from "../lib/supabase.js";

// Service layer untuk fitur Feedback (umpan balik pengguna untuk evaluasi).
// Pure data-access ke tabel public.feedback; RLS owner/admin menjaga akses.

// Kategori valid — selaras dengan CHECK constraint di migrasi feedback.
export const FEEDBACK_CATEGORIES = [
  { value: "saran", label: "Saran", icon: "lightbulb" },
  { value: "masalah", label: "Masalah / Bug", icon: "bug_report" },
  { value: "pujian", label: "Pujian", icon: "favorite" },
  { value: "lainnya", label: "Lainnya", icon: "chat" },
];

const VALID_CATEGORIES = FEEDBACK_CATEGORIES.map((c) => c.value);
const MAX_MESSAGE_LEN = 2000;

// Kirim feedback baru. payload: { rating: 1..5, category, message, page? }
// Mengembalikan baris feedback yang tersimpan.
export async function submitFeedback({ rating, category, message, page } = {}) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  // Validasi sisi klien (UX cepat); CHECK constraint DB menjaga di sisi server.
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    throw new Error("Pilih rating 1–5 bintang dulu ya.");
  }
  const text = (message ?? "").trim();
  if (text === "") throw new Error("Pesan feedback tidak boleh kosong.");
  if (text.length > MAX_MESSAGE_LEN) {
    throw new Error(`Pesan maksimal ${MAX_MESSAGE_LEN} karakter.`);
  }
  const cat = VALID_CATEGORIES.includes(category) ? category : "lainnya";

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      user_id: user.id,
      rating: r,
      category: cat,
      message: text,
      page: page ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Riwayat feedback milik user yang login (terbaru dulu). RLS owner-policy
// membatasi ke user sendiri; filter eksplisit = defense-in-depth.
export async function getMyFeedback() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const { data, error } = await supabase
    .from("feedback")
    .select("id, rating, category, message, page, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Daftar semua feedback (khusus admin — RLS feedback_admin_all yang menggerbangi).
// Disertai email pelapor lewat join ke profiles bila tersedia.
export async function getAllFeedback({ limit = 200 } = {}) {
  const { data, error } = await supabase
    .from("feedback")
    .select("id, rating, category, message, page, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Hapus satu feedback (admin: bersihkan spam). RLS feedback_admin_all menjaga.
export async function deleteFeedback(id) {
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) throw error;
}

// Ringkasan untuk evaluasi: total + rata-rata rating + sebaran per rating.
// Dihitung di klien dari daftar feedback yang sudah diambil admin.
export function summarizeFeedback(rows = []) {
  const total = rows.length;
  if (total === 0) {
    return { total: 0, avgRating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of rows) {
    const v = Number(r.rating);
    if (v >= 1 && v <= 5) {
      distribution[v] += 1;
      sum += v;
    }
  }
  return { total, avgRating: sum / total, distribution };
}
