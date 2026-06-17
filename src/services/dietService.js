import { supabase } from "../lib/supabase.js";

// Service layer untuk taksonomi preferensi diet (tabel `diet_tags`).
// Read publik (RLS: hanya baris is_active), jadi tidak perlu cek login — ini
// data referensi, bukan data milik user. `value` = slug yang dikirim ke Edge
// Function generate-plan & dicocokkan ke `recipes.tags`.

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

// Acak urutan array (Fisher-Yates) tanpa mengubah array asal.
export function shuffle(arr) {
  const a = [...(arr ?? [])];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Ambil `n` preferensi diet acak dari pool, tapi PASTIKAN item di `keep` (mis.
// yang sedang dipilih user) selalu ikut muncul supaya tidak hilang saat di-shuffle.
// Dipakai wizard untuk menampilkan pilihan yang segar/berbeda tiap kali (notulen #6/#7).
export function sampleDietTags(pool, n = 8, keep = []) {
  const keepSet = new Set(keep);
  const kept = (pool ?? []).filter((d) => keepSet.has(d.value));
  const rest = shuffle((pool ?? []).filter((d) => !keepSet.has(d.value)));
  const merged = [...kept, ...rest].slice(0, Math.max(n, kept.length));
  // Acak lagi posisi gabungan supaya yang "keep" tidak selalu di depan.
  return shuffle(merged);
}
