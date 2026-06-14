import { supabase } from "../lib/supabase.js";

// Service layer untuk taksonomi preferensi diet (tabel `diet_tags`).
// Read publik (RLS: hanya baris is_active), jadi tidak perlu cek login — ini
// data referensi, bukan data milik user. `value` = slug yang dikirim ke Edge
// Function generate-plan & dicocokkan ke `recipes.diet`.

// Ambil daftar diet aktif, urut sort_order. Bentuk: [{ value, label }].
export async function getActiveDietTags() {
  const { data, error } = await supabase
    .from("diet_tags")
    .select("value, label")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
