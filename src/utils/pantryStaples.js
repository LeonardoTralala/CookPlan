// Bahan pokok dapur ("pantry staples") yang praktis selalu tersedia di rumah dan
// tidak perlu dimasukkan ke daftar belanja (air, garam, gula pasir, dll).
//
// Pencocokan memakai NAMA TER-NORMALISASI yang SAMA PERSIS (bukan substring),
// supaya bahan asli yang kebetulan memuat kata staple tetap aman — contoh nyata
// dari data: "air jeruk nipis", "gula merah", "minyak wijen", "minyak kelapa"
// TIDAK ikut terhapus.
//
// Daftar ini sengaja konservatif: kalau ragu, bahan dibiarkan masuk daftar
// belanja (lebih baik kelebihan satu item daripada menghapus bahan yang perlu).
// Mudah diperluas — cukup tambahkan varian nama kanoniknya di STAPLE_NAMES.

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
  // Penyedap & kaldu bubuk instan
  "penyedap", "penyedap rasa", "micin", "vetsin", "msg",
  "kaldu bubuk", "kaldu ayam bubuk", "kaldu sapi bubuk", "kaldu jamur bubuk",
  // Minyak goreng generik — "minyak wijen/kelapa/zaitun" = bahan, dibiarkan
  "minyak", "minyak goreng", "minyak sayur",
];

// Normalisasi nama bahan: lowercase, buang catatan dalam kurung, kata "secukupnya",
// angka/simbol, lalu rapikan spasi. Hasilnya dipakai untuk perbandingan persis.
function normalize(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\(.*?\)/g, " ")
    .replace(/\bsecukupnya\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STAPLE_SET = new Set(STAPLE_NAMES.map(normalize));

// True bila `name` adalah bahan pokok dapur yang tak perlu masuk daftar belanja.
export function isPantryStaple(name) {
  const n = normalize(name);
  return n.length > 0 && STAPLE_SET.has(n);
}

// Kunci kanonik (nama ter-normalisasi) untuk men-dedup staple lintas resep —
// "Garam", "garam", "Garam (halus)" → "garam". Dipakai saat mengumpulkan daftar
// "cek stok dapur" agar tiap staple muncul sekali saja.
export function pantryStapleKey(name) {
  return normalize(name);
}
