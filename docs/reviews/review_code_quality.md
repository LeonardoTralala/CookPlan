# Laporan Peninjauan Kualitas Kode & Konfigurasi Linting

## Ringkasan Eksekutif (Executive Summary)

Peninjauan ini berfokus pada analisis logika helper di dalam direktori `src/utils/` dan aturan format pada berkas `eslint.config.js` di proyek CookPlan. 

### Temuan Utama:
1. **Bug Parsing Pecahan Campuran & Karakter Vulgar (`parseIngredient.js`)**: Parser bahan gagal mengidentifikasi jumlah berbentuk pecahan campuran (seperti `"1 1/2"`) dan karakter pecahan Unicode/vulgar (seperti `"½"`, `"1½"`). Hal ini mengakibatkan kuantitas terpotong dan teks sisa bocor ke nama bahan, sehingga memicu kegagalan validasi DB.
2. **Kesalahan Deteksi Satuan Tanpa Kuantitas (`parseIngredient.js`)**: Modul parser memotong kata benda yang termasuk dalam `UNIT_TOKENS` meskipun tidak ada kuantitas numerik (mis. `"Buah naga"` menjadi nama: `"naga"`, unit: `"buah"`).
3. **Redundansi Perhitungan Daftar Belanja (`buildShoppingList.js` & `shoppingList.js`)**: Terdapat dua file terpisah yang menghitung daftar belanja client-side dengan aturan pembulatan dan struktur penggabungan yang berbeda, berpotensi menyebabkan ketidakkonsistenan tampilan antara halaman.
4. **Kerentanan TypeError pada AI Plan Mapper (`planMapper.js`)**: Tidak adanya pengecekan defensif pada entri hari dari AI yang bernilai null/undefined dapat memicu crash total pada aplikasi React.
5. **Konfigurasi ESLint Terlalu Longgar (`eslint.config.js`)**: Proyek JS murni ini tidak mengaktifkan modul `eslint-plugin-react`, sehingga kesalahan JSX fundamental (seperti missing `key` prop) tidak terdeteksi sebelum runtime.

---

## Tabel Temuan Peninjauan (Table of Findings)

| Lokasi Berkas & Baris | Deskripsi Masalah | Tingkat Keparahan | Solusi / Potongan Kode Rekomendasi | Rasional |
| :--- | :--- | :--- | :--- | :--- |
| [parseIngredient.js:L98-L110](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/utils/parseIngredient.js#L98-L110) | **Bug Kuantitas Pecahan**: `parseLeadingNumber` hanya mendukung digit desimal dan pecahan biasa (`/`). Pecahan campuran dengan spasi (`1 1/2`) atau simbol Unicode (`½`, `1½`) tidak dapat diparse dengan benar. | **High** | Lihat rekomendasi perbaikan fungsi `parseLeadingNumber` di bawah tabel ini. | Memastikan akurasi kuantitas bahan saat scraping/impor resep, serta mencegah karakter pecahan masuk ke kolom nama bahan yang divalidasi ketat oleh database. |
| [parseIngredient.js:L134-L143](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/utils/parseIngredient.js#L134-L143) | **Unit Stripping Tanpa Angka**: Kata benda seperti `"Buah naga"` atau `"Biji wijen"` dipotong karena `"buah"` dan `"biji"` terdaftar sebagai satuan hitung, menghasilkan nama rusak (`"naga"`, `"wijen"`). | **High** | Batasi ekstraksi satuan hitung hanya ketika kuantitas (`amount`) terdeteksi, atau jika satuan tersebut merupakan satuan ukuran murni (`MEASUREMENT_UNITS`). | Mencegah kerusakan nama bahan yang sah ketika didefinisikan tanpa angka kuantitas (misalnya dalam resep dengan keterangan bumbu opsional). |
| [buildShoppingList.js](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/utils/buildShoppingList.js) & [shoppingList.js](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/utils/shoppingList.js) | **Redundansi Kode**: Kedua berkas melakukan perhitungan agregasi daftar belanja dengan implementasi pembulatan (`formatAmount` vs `round2`) dan format yang berbeda. | **Medium** | Satukan fungsi pembulatan dan agregasi dasar ke dalam satu berkas helper (mis. di `shoppingList.js`), kemudian impor di `buildShoppingList.js` untuk bagian kategorisasi/pengelompokan. | Menghindari duplikasi kode, meminimalkan maintenance overhead, serta menjaga konsistensi hasil perhitungan harga/stok antara halaman Planner, Katalog, dan GenerateResult. |
| [planMapper.js:L50-L83](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/utils/planMapper.js#L50-L83) | **Potensi TypeError dari AI**: Perulangan `days.forEach` langsung membaca `dayEntry.day` dan `dayEntry.meals` tanpa memeriksa apakah `dayEntry` valid (bukan null/undefined). | **Medium** | Tambahkan baris penanganan defensif di awal perulangan:<br>```javascript\nif (!dayEntry) return;\n``` | AI generatif bersifat non-deterministik dan terkadang mengembalilkan array hari yang timpang atau null. Pengecekan ini mencegah aplikasi mengalami crash layar putih (white screen). |
| [eslint.config.js:L7-L21](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/eslint.config.js#L7-L21) | **Linter Terlalu Minimal**: Konfigurasi ESLint tidak memasang `eslint-plugin-react` dan tidak mengatur format konsistensi kode (misalnya Prettier / import sorting). | **Medium** | Pasang `eslint-plugin-react` dan perbarui konfigurasi ESLint untuk memperluas plugin React secara flat. | Pada proyek Javascript tanpa TypeScript, linter adalah benteng utama untuk mendeteksi kesalahan sintaksis React dan siklus hidup komponen sebelum aplikasi dijalankan. |

---

## Rekomendasi Perbaikan Detil

### 1. Perbaikan Parser Pecahan & Deteksi Satuan (`parseIngredient.js`)

Untuk menyelesaikan bug pecahan campuran, Unicode vulgar, dan pemotongan nama bahan, berikut adalah usulan modifikasi pada `src/utils/parseIngredient.js`:

```javascript
// Peta pecahan vulgar Unicode ke nilai desimal
const VULGAR_FRACTIONS = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 0.333,
  '⅔': 0.667,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 0.167,
  '⅚': 0.833,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875
};

// Pola regex untuk mendeteksi pecahan vulgar Unicode di awal string
const VULGAR_FRACTION_RE = new RegExp(`^([½¼¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])`);
const MIXED_VULGAR_FRACTION_RE = new RegExp(`^(\\d+)\\s*([½¼¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])`);

function parseLeadingNumber(s) {
  // 1. Cek pecahan campuran dengan angka normal (mis. "1 1/2" atau "1-1/2")
  const mixedNormal = s.match(/^(\d+)\s+([0-9]\/[0-9])/);
  if (mixedNormal) {
    const whole = Number(mixedNormal[1]);
    const [num, den] = mixedNormal[2].split('/').map(Number);
    const fractionVal = den ? num / den : 0;
    return { amount: whole + fractionVal, rest: s.slice(mixedNormal[0].length).trimStart() };
  }

  // 2. Cek pecahan campuran dengan pecahan vulgar (mis. "1½" atau "1 ½")
  const mixedVulgar = s.match(MIXED_VULGAR_FRACTION_RE);
  if (mixedVulgar) {
    const whole = Number(mixedVulgar[1]);
    const fractionVal = VULGAR_FRACTIONS[mixedVulgar[2]] || 0;
    return { amount: whole + fractionVal, rest: s.slice(mixedVulgar[0].length).trimStart() };
  }

  // 3. Cek pecahan vulgar tunggal di awal (mis. "½")
  const singleVulgar = s.match(VULGAR_FRACTION_RE);
  if (singleVulgar) {
    const amount = VULGAR_FRACTIONS[singleVulgar[1]] || null;
    return { amount, rest: s.slice(singleVulgar[0].length).trimStart() };
  }

  // 4. Default: pola angka desimal / pecahan biasa bawaan
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
```

Kemudian, perbarui logika pendeteksian satuan di dalam `parseIngredient(raw)` agar tidak memotong satuan hitung (counting units) bila tidak ada angka kuantitas yang jelas:

```javascript
  // 4) token pertama setelah angka → unit (bila dikenali / singkatan scraping)
  const firstTokenMatch = body.match(/^([\p{L}]+)\b/u);
  if (firstTokenMatch) {
    const tok = firstTokenMatch[1].toLowerCase();
    const canonUnit = UNIT_ABBREV.get(tok) ?? (UNIT_TOKENS.has(tok) ? tok : null);
    
    // Satuan hanya diekstrak jika:
    // a) Ada kuantitas numerik yang berhasil diparse (amount != null)
    // b) Atau, satuan tersebut merupakan satuan ukuran murni (mis. "sdt", "gr", "ml" di MEASUREMENT_UNITS)
    const isPureMeasurement = MEASUREMENT_UNITS.has(canonUnit);
    if (canonUnit && (amount != null || isPureMeasurement)) {
      unit = canonUnit;
      body = body.slice(firstTokenMatch[0].length).trimStart();
    }
  }
```

### 2. Rekomendasi Peningkatan ESLint (`eslint.config.js`)

Untuk memastikan kualitas kode React dan keterbacaan berkas dalam jangka panjang, tingkatkan konfigurasi ESLint dengan mengaktifkan aturan JSX dasar dan penataan impor:

```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.agents/scratch']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
    },
    extends: [
      js.configs.recommended,
      reactPlugin.configs.flat.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { 
        ecmaFeatures: { jsx: true } 
      },
    },
    rules: {
      // Nonaktifkan keharusan import React di tiap file (React 17+ JSX transform)
      'react/react-in-jsx-scope': 'off',
      // Cegah hilangnya prop 'key' pada perulangan JSX (.map)
      'react/jsx-key': 'error',
      // Berikan peringatan untuk console.log yang tertinggal di berkas produksi
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Hindari variabel yang dideklarasikan tapi tidak digunakan
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
])
```
