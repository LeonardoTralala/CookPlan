// Bahan pokok dapur ("pantry staples") yang praktis selalu tersedia di rumah dan
// tidak perlu dimasukkan ke daftar belanja (air, garam, gula pasir, kaldu, dll).
//
// SUMBER KEBENARAN sekarang ada di kolom `ingredients.is_staple` (master bahan,
// di-toggle admin di /admin/ingredients). Modul ini dipakai sebagai:
//   1) FALLBACK heuristik untuk baris resep yang BELUM tertaut ke master
//      (ingredient_id NULL) — lihat isStapleIngredient().
//   2) Cermin daftar kata-bumbu untuk seed migrasi 20260628000000.
//
// Aturan pencocokan KONSERVATIF & sadar-gabungan: nama dipecah pada pemisah
// umum (",", "+", "&", "/", "dan", "dengan") dan dianggap staple HANYA bila
// SETIAP bagian adalah kata-bumbu yang dikenal. Jadi:
//   "garam + masako ayam"  → staple (semua bumbu)
//   "merica, garam"         → staple
//   "telur kocok + garam"   → BUKAN staple (ada telur → tetap dibeli)
//   "gula merah", "minyak wijen" → BUKAN staple (bahan asli, satu bagian utuh)
// Kalau ragu, bahan dibiarkan masuk daftar belanja (lebih baik kelebihan satu
// item daripada menghapus bahan yang perlu).

const STAPLE_NAMES = [
  // Air & es
  "air", "air putih", "air matang", "air panas", "air hangat", "air dingin",
  "air es", "es", "es batu",
  // Garam
  "garam", "garam halus", "garam dapur",
  // Gula meja saja — "gula merah" / "gula jawa" / "gula aren" = bahan, dibiarkan
  "gula", "gula pasir", "gula putih",
  // Lada / merica
  "lada", "lada bubuk", "lada putih", "lada hitam",
  "merica", "merica bubuk", "merica putih",
  // Penyedap, kaldu bubuk instan & merek umumnya
  "penyedap", "penyedap rasa", "micin", "vetsin", "msg",
  "kaldu", "kaldu bubuk", "kaldu ayam", "kaldu sapi", "kaldu jamur",
  "kaldu ayam bubuk", "kaldu sapi bubuk", "kaldu jamur bubuk",
  "masako", "masako ayam", "masako sapi", "royco", "sasa",
  // Minyak goreng generik — "minyak wijen/kelapa/zaitun" = bahan, dibiarkan
  "minyak", "minyak goreng", "minyak sayur",
];

// Pemisah antar-bahan dalam satu baris gabungan. Dipakai untuk memecah nama
// SEBELUM normalisasi (yang membuang tanda baca), supaya batas bagian tak hilang.
const SEPARATOR = /\s*(?:,|\+|&|\/|\bdan\b|\bdengan\b)\s*/i;

// Normalisasi nama bahan: lowercase, buang catatan dalam kurung & kata pengisi
// kuantitas ("secukupnya"/"sejumput"/"sedikit"), angka/simbol, rapikan spasi.
// Hasilnya dipakai untuk perbandingan persis terhadap STAPLE_SET.
function normalize(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(secukupnya|sejumput|sedikit)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STAPLE_SET = new Set(STAPLE_NAMES.map(normalize));

// True bila `name` seluruhnya tersusun dari bumbu pokok dapur (lihat aturan di
// header). Memecah nama pada pemisah lalu mensyaratkan SETIAP bagian ∈ STAPLE_SET.
export function isPantryStaple(name) {
  const parts = String(name ?? "")
    .split(SEPARATOR)
    .map(normalize)
    .filter((p) => p.length > 0);
  return parts.length > 0 && parts.every((p) => STAPLE_SET.has(p));
}

// Penentu final apakah satu baris bahan resep adalah staple (tak masuk belanja).
// PRESEDEN: bila baris tertaut ke master (punya master.isStaple boolean), pakai
// flag master itu (sumber kebenaran, dikurasi admin). Bila belum tertaut, jatuh
// ke heuristik nama isPantryStaple(). `ing` = bahan shape recipeService.
export function isStapleIngredient(ing) {
  const flag = ing?.master?.isStaple;
  if (typeof flag === "boolean") return flag;
  return isPantryStaple(ing?.name);
}

// Kunci kanonik (nama ter-normalisasi) untuk men-dedup staple lintas resep —
// "Garam", "garam", "Garam (halus)" → "garam". Dipakai saat mengumpulkan daftar
// "cek stok dapur" agar tiap staple muncul sekali saja.
export function pantryStapleKey(name) {
  return normalize(name);
}
