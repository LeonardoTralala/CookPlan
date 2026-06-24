// Parser bahan: pisahkan string bebas (hasil scraping / input manual) menjadi
// komponen terstruktur { amount, unit, name, note, measurable }.
//
// Sumber kebenaran harga ada di master `ingredients` (lihat migrasi
// 20260622000000_ingredient_pricing_model.sql). Master HARUS berisi nama kanonik
// tanpa kuantitas ("bawang merah"), sedangkan kuantitas hidup di
// recipe_ingredients.amount + .unit. Parser ini dipakai untuk:
//   1) memvalidasi input Master Bahan (tolak "100 ml air", "(Baca caption)", dst),
//   2) memecah baris resep mentah menjadi amount/unit/nama saat impor/cleanup.
//
// Deterministik & pure (mudah diuji, tanpa dependency).

// Leksikon satuan yang dikenali. Selaras dengan tabel unit_conversions +
// satuan hitung umum di data Cookpad. Dipakai untuk DETEKSI (parser);
// konversi ke harga tetap urusan DB (unit_conversions / overrides).
const UNIT_TOKENS = new Set([
  // massa
  "g", "gr", "gram", "ons", "kg", "kilo",
  // volume
  "ml", "cc", "sdt", "sdm", "gelas", "liter", "ltr", "cup",
  // hitungan
  "pcs", "buah", "butir", "biji", "siung", "lembar", "lbr", "batang",
  "ruas", "ekor", "ikat", "genggam", "sachet", "bungkus", "potong", "keping", "porsi",
  // dimensi panjang (umumnya rempah: "6 cm kunyit")
  "cm", "ruas jari",
]);

// Satuan UKUR murni — tak pernah jadi awal nama bahan yang sah, jadi "ml air"
// pasti junk. Dipisah dari UNIT_TOKENS karena banyak satuan HITUNG (biji, buah,
// batang, daun, lembar, siung) juga kata benda bahan sah: "Biji Wijen",
// "Buah Naga", "Batang Serai", "Daun Bawang". Hanya set ini yang dipakai untuk
// menolak nama master yang diawali satuan.
const MEASUREMENT_UNITS = new Set([
  "g", "gr", "gram", "ons", "kg", "kilo", "ml", "cc", "sdt", "sdm", "liter", "ltr",
]);

// Frasa multi-kata → token tunggal yang setara (dinormalkan sebelum dicocokkan).
const UNIT_PHRASES = [
  [/\bsendok makan\b/gi, "sdm"],
  [/\bsendok teh\b/gi, "sdt"],
  [/\bsdk mkn\b/gi, "sdm"],
  [/\bsdk teh\b/gi, "sdt"],
];

// Singkatan satuan ala scraping → token kanonik (mis. "250 grm ayam", "2 bh tahu",
// "3 btr telur"). Terpisah dari UNIT_TOKENS supaya hanya berlaku saat DETEKSI satuan
// (di depan body), bukan sebagai kata-benda bahan yang sah.
const UNIT_ABBREV = new Map([
  ["grm", "gram"],
  ["btr", "butir"],
  ["bh", "buah"],
  ["btng", "batang"],
  ["btg", "batang"],
  ["bks", "bungkus"],
  ["sct", "sachet"],
  ["ptg", "potong"],
  ["lbr", "lembar"],
]);

// Kata yang menandai kuantitas tak terukur ("secukupnya", "sesuai selera").
const UNMEASURED_RE = /\b(secukupnya|sesuai selera|seperlunya|secukup ?nya)\b/i;

// Kata/penanda yang membuat sebuah baris BUKAN nama bahan yang valid untuk master.
const JUNK_RE = /\b(baca|caption|sesuai selera|secukupnya|sesuaikan|sepert)/i;

// Awalan emoji / simbol non-huruf yang sering nempel di data scraping.
const LEADING_SYMBOLS_RE = /^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}•·*\-–—:>~|»›#]+/u;
// Akhiran emoji/simbol (mirror LEADING) — "Bumbu halus👇" → "Bumbu halus".
const TRAILING_SYMBOLS_RE = /[\s\p{Extended_Pictographic}\p{Emoji_Presentation}•·*\-–—:>~|»›]+$/u;

// Penanda JUDUL SEKSI resep (bukan bahan), mis. "Bumbu halus", "Bahan lapisan",
// "Saus", "Marinasi". Nama yang HANYA kata heading (± modifier non-bahan) bukan
// bahan. "saus tiram"/"bumbu kari" TIDAK kena karena ada kata bahan nyata.
const SECTION_HEADER_RE =
  /^(bumbu|bahan|saus|sauce|pelengkap|topping|isian|olesan|olahan|taburan|kuah|marinasi|adonan|larutan|note|bumbu rempah)(\s+(halus|iris|utuh|kasar|rempah|lembut|lapisan|cocolan|rendaman|sajian|mentega|bombay|pelengkap))?$/i;

// Kata kerja persiapan — penanda bahwa teks setelah koma adalah CATATAN olah,
// bukan bahan lain. Hanya bila cocok ini ekor-koma dipotong, supaya baris multi-
// bahan ("gula, garam, merica") tak kehilangan item.
const PREP_VERB_RE =
  /\b(iris|cincang|rajang|goreng|potong|dadu|haluskan|halus|geprek|parut|sangrai|suir|belah|kupas|rebus|kukus|memarkan|serut|cacah|sobek|petik|sisir|cuci|tiriskan|buang|bersihkan)\b/i;
const PAREN_NOTE_RE = /\s*\([^)]*\)?/g; // "(...)" termasuk yang tak tertutup
const ASTERISK_NOTE_RE = /\s*\*.*$/; // "*saya pakai air kaldu..."

// Potong teks setelah koma pertama HANYA jika itu catatan persiapan.
// "bawang merah, iris rajang" → "bawang merah"; "gula, garam" → tetap utuh.
function stripPrepTail(s) {
  const i = s.indexOf(",");
  if (i < 0) return s;
  return PREP_VERB_RE.test(s.slice(i + 1)) ? s.slice(0, i) : s;
}

function normalizeSpaces(s) {
  return s.replace(/\s+/g, " ").trim();
}

// Ubah "1/2" → 0.5, "1,5" → 1.5, ambil angka pertama dari rentang "16 atau 32".
function parseLeadingNumber(s) {
  const m = s.match(/^(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)?)/);
  if (!m) return { amount: null, rest: s };
  const token = m[1];
  let amount;
  if (token.includes("/")) {
    const [a, b] = token.split("/").map((x) => Number(x.replace(",", ".")));
    amount = b ? a / b : a;
  } else {
    amount = Number(token.replace(",", "."));
  }
  return { amount, rest: s.slice(m[0].length).trimStart() };
}

/**
 * Pecah satu baris bahan mentah menjadi komponen terstruktur.
 * @param {string} raw
 * @returns {{amount: number|null, unit: string|null, name: string, note: string|null, measurable: boolean, raw: string}}
 */
export function parseIngredient(raw) {
  const original = String(raw ?? "");
  let s = original;

  // 1) buang simbol/emoji di depan
  s = s.replace(LEADING_SYMBOLS_RE, "");
  // 2) normalkan frasa satuan multi-kata → token tunggal
  for (const [re, token] of UNIT_PHRASES) s = s.replace(re, token);
  s = normalizeSpaces(s);

  const unmeasured = UNMEASURED_RE.test(s);

  // 3) angka di depan → amount
  const { amount, rest } = parseLeadingNumber(s);
  let body = rest;
  let unit = null;

  // 4) token pertama setelah angka → unit (bila dikenali / singkatan scraping)
  const firstTokenMatch = body.match(/^([\p{L}]+)\b/u);
  if (firstTokenMatch) {
    const tok = firstTokenMatch[1].toLowerCase();
    const canonUnit = UNIT_ABBREV.get(tok) ?? (UNIT_TOKENS.has(tok) ? tok : null);
    if (canonUnit) {
      unit = canonUnit;
      body = body.slice(firstTokenMatch[0].length).trimStart();
    }
  }

  // 5) bersihkan nama: buang catatan secukupnya/sesuai selera, paren, asterisk,
  //    catatan/sublist setelah ":", ekor koma, lalu simbol/emoji di ujung.
  let name = body
    .replace(UNMEASURED_RE, "")
    .replace(ASTERISK_NOTE_RE, "")
    .replace(PAREN_NOTE_RE, "")
    .replace(/\s*:.*$/, ""); // "bumbu pecak: tumbuk kasar" → "bumbu pecak"
  name = stripPrepTail(name);
  name = name.replace(TRAILING_SYMBOLS_RE, "");
  name = normalizeSpaces(name.replace(/^[\s/|+,-]+|[\s/|+,-]+$/g, ""));
  // judul seksi (mis. "Bumbu halus") = bukan bahan → nama kosong supaya dilewati.
  if (SECTION_HEADER_RE.test(name)) name = "";

  return {
    amount: unmeasured ? null : amount,
    unit,
    name,
    note: original === name ? null : original,
    measurable: !unmeasured && amount != null,
    raw: original,
  };
}

/**
 * Validasi nama untuk MASTER bahan (`ingredients.name`). Master = kata benda
 * kanonik tanpa kuantitas/satuan/catatan. Return pesan error (string) bila tidak
 * valid, atau null bila valid.
 * @param {string} name
 * @returns {string|null}
 */
export function validateIngredientName(name) {
  const n = String(name ?? "").trim();
  if (!n) return "Nama bahan wajib diisi.";
  if (n.length < 2) return "Nama bahan terlalu pendek.";
  if (/\d/.test(n)) return "Nama bahan tidak boleh memuat angka/kuantitas (mis. tulis “air”, bukan “100 ml air”).";
  if (JUNK_RE.test(n)) return "Nama bahan tidak boleh memuat catatan seperti “secukupnya”/“sesuai selera”/“baca caption”.";
  // diawali satuan UKUR murni ("ml air") → junk. Satuan hitung (biji/buah/batang)
  // dibiarkan karena sering jadi nama bahan sah ("Biji Wijen", "Buah Naga").
  const first = n.toLowerCase().match(/^([\p{L}]+)\b/u)?.[1];
  if (first && MEASUREMENT_UNITS.has(first)) return "Nama bahan diawali satuan — tulis nama bahannya saja.";
  if (/[(){}*•]|,/.test(n)) return "Nama bahan tidak boleh memuat tanda kurung/koma/catatan.";
  if (/[:#<>~|»›]/.test(n) || /[\p{Extended_Pictographic}]/u.test(n))
    return "Nama bahan tidak boleh memuat simbol/emoji/tanda titik dua.";
  if (SECTION_HEADER_RE.test(n))
    return "Itu judul seksi resep (mis. “Bumbu halus”), bukan nama bahan.";
  return null;
}
