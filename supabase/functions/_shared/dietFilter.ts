// Pencocokan resep ↔ preferensi diet (slug diet_tags.value), dipakai bersama oleh
// generate-plan & regenerate-day untuk menyaring bank resep kandidat.
//
// HARUS selaras dengan recipeMatchesDiet di src/pages/RecipeCatalog.jsx supaya
// hasil filter wizard/regenerate konsisten dengan chip katalog. Sumber kebenaran
// = recipes.tags; sebagian slug BUKAN tag literal dan diturunkan secara heuristik.
//
// Catatan parity: fallback badge-label di katalog TIDAK direplikasi di sini —
// edge tidak punya label diet_tags, hanya slug. Resep tetap cocok lewat
// recipes.tags / heuristik di bawah, yang merupakan sumber kebenaran utama.

// Tag sumber protein. 'tinggi-protein' tidak pernah ditulis eksplisit ke
// recipes.tags, jadi diturunkan dari kehadiran salah satu tag ini.
export const PROTEIN_SOURCE_TAGS = new Set([
  "ayam", "ikan", "sapi", "kambing", "telur", "udang", "daging", "seafood", "tahu", "tempe",
]);

// Cocokkan satu resep dengan satu slug preferensi diet:
//  - 'cepat'          → ready_in_minutes <= 30 (NULL/unknown TIDAK match)
//  - 'hemat'          → price_idr <= 30000 (NULL/unknown TIDAK match)
//  - 'tinggi-protein' → punya salah satu tag sumber protein
//  - selainnya        → slug ada di recipes.tags
// Guard NULL penting: Number(null) === 0 akan keliru lolos sebagai "cepat"/"hemat".
export function recipeMatchesDiet(recipe: Record<string, unknown>, slug: string): boolean {
  const tags = (recipe.tags as string[] | null) ?? [];
  if (tags.includes(slug)) return true;
  if (slug === "cepat") return recipe.ready_in_minutes != null && Number(recipe.ready_in_minutes) <= 30;
  if (slug === "hemat") return recipe.price_idr != null && Number(recipe.price_idr) <= 30000;
  if (slug === "tinggi-protein") return tags.some((t) => PROTEIN_SOURCE_TAGS.has(t));
  return false;
}

// Saring pool resep terhadap daftar preferensi (semantik UNION/OR antar chip,
// sama dengan katalog). Bila hasil < minKeep, kembalikan pool asal apa adanya
// (lebih baik beri AI pilihan luas daripada pool nyaris kosong).
export function filterRecipesByDiet<T extends Record<string, unknown>>(
  pool: T[],
  diet: string[],
  minKeep = 3,
): T[] {
  if (!diet || diet.length === 0) return pool;
  const filtered = pool.filter((r) => diet.some((slug) => recipeMatchesDiet(r, slug)));
  return filtered.length >= minKeep ? filtered : pool;
}
