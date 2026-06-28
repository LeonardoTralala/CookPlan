# Master Laporan Tinjauan Kode & Arsitektur 360°
## CookPlan — PIMNAS 2026

Laporan ini menyusun secara terpadu seluruh temuan penting dari **10 sub-agent tinjauan kode** yang berjalan secara bersamaan di berbagai aspek aplikasi CookPlan. Evaluasi ini mencakup stabilitas PWA (luring), manajemen *state*, integritas basis data, optimasi performa build, aksesibilitas (a11y), SEO, dan kebersihan kode.

---

## 1. Temuan Kritis (Keparahan Tinggi / High Severity)

Berikut adalah 5 masalah kritis di tingkat kode dan basis data yang dapat mengakibatkan kegagalan fungsi aplikasi (*crash*) atau kerusakan data:

### 🚨 1. Layar Putih (Blank Screen) saat Luring (SEO & PWA Reviewer)
* **Isu**: Berkas service worker manual (`public/sw.js`) hanya meng-cache berkas statis dasar. Karena aplikasi menggunakan pembagian kode dinamis (`React.lazy`), saat pengguna dalam kondisi luring (offline) mencoba membuka halaman baru, peramban akan gagal mengunduh *code-split chunks* ber-hash (seperti `/assets/index-[hash].js`), memicu *chunk loading error* dan layar menjadi putih polos.
* **Solusi**: Migrasi dari service worker manual ke **`vite-plugin-pwa`** pada konfigurasi `vite.config.js` untuk mengotomatiskan precaching dari seluruh berkas bundel build Vite yang ber-hash.

### 🚨 2. Bug Penghapusan Menu Otomatis pada Mode Tamu (Hooks & State Reviewer)
* **Isu**: Di dalam `PlanContext.jsx`, mutasi state dilakukan secara asinkron. Namun, kode langsung memanggil `persistSlot` menggunakan variabel `nextPlan` secara sinkron langsung di bawah *setter* state. Hal ini menyebabkan `nextPlan` bernilai `undefined` dan menuliskan string literal `"undefined"` ke dalam `localStorage`, sehingga seluruh rencana masak milik Guest (tamu) terhapus otomatis saat halaman dimuat ulang.
* **Solusi**: Gunakan `useRef` untuk menyimpan state rencana terbaru secara sinkron sebelum memicu pembaruan state React dan proses persistensi data.

### 🚨 3. Bug Parsing Bahan Masakan Pecahan Unicode (Code Quality Reviewer)
* **Isu**: Fungsi `parseLeadingNumber` di `parseIngredient.js` gagal memproses kuantitas pecahan campuran (seperti `"1 1/2"`) atau karakter pecahan Unicode (seperti `"½"`, `"1½"`). Kegagalan ini menyebabkan teks pecahan bocor ke kolom nama bahan, memicu kegagalan validasi ketat skema basis data saat disimpan.
* **Solusi**: Perbarui regex parser bahan makanan agar mendeteksi pecahan Unicode dan pecahan campuran dengan spasi, lalu mengonversinya menjadi angka desimal sebelum disimpan.

### 🚨 4. Masalah Kursor Melompat / Cursor Jump pada Panel Admin (Admin Panel Reviewer)
* **Isu**: Pada `RecipeManager.jsx` (input langkah masak) dan `PackageManager.jsx` (input tag/badge), fungsi handler `onChange` langsung menyaring data array kosong menggunakan `.filter(Boolean)`. Proses instan ini merusak posisi kursor teks ketika tombol *Enter* atau tombol koma ditekan, sehingga admin tidak dapat menambahkan baris baru dengan normal.
* **Solusi**: Kelola input penulisan dalam string lokal terpisah, lalu konversi string tersebut menjadi array hanya saat admin menekan tombol Simpan ke basis data.

### 🚨 5. Rencana Kalender Hilang Saat Offline bagi Pengguna Login (PWA Reviewer)
* **Isu**: Saat pengguna masuk (*logged-in*), aplikasi menonaktifkan penyimpanan rencana memasak ke `localStorage` dan hanya menyinkronkannya langsung ke tabel Supabase. Akibatnya, saat luring, fallback `localStorage` bernilai kosong atau usang.
* **Solusi**: Terapkan arsitektur *offline-first* dengan selalu menuliskan data rencana mingguan ke `localStorage` as cache lokal bagi semua kategori pengguna (tamu maupun terautentikasi).

---

## 2. Optimasi Performa & Struktur Arsitektur (Medium Severity)

### ⚡ A. Rollup Chunk Splitting untuk SDK Supabase (Performance Reviewer)
* **Isu**: Berkas `main.jsx` memuat `@supabase/supabase-js` secara statis, memaksa pustaka Supabase (~150kb+ minified) masuk ke dalam bundel utama (`index.js`). Ini memperlambat pemuatan awal landing page.
* **Solusi**: Terapkan konfigurasi `rollupOptions.output.manualChunks` di `vite.config.js` untuk memecah pustaka vendor besar (`@supabase/supabase-js`, `react`, `react-router-dom`) ke berkas terpisah agar peramban dapat mengunduhnya secara paralel.

### ⚡ B. API Latency & Checkout Non-Atomik (Services Reviewer)
* **Isu**: Pembuatan pesanan belanja di `orderService.js` melakukan 3 permintaan jaringan secara beruntun (*triple round-trip*): menyisipkan pesanan, menyisipkan item pesanan, lalu mengambil pesanan kembali untuk menghitung total. Ini memperlambat proses transaksi dan berisiko memicu data pesanan yatim (*orphaned orders*) jika transaksi di tengah gagal.
* **Solusi**: Satukan alur checkout ke dalam satu fungsi PostgreSQL RPC tunggal (`create_order_with_items`) agar berjalan secara atomik di sisi server dalam satu koneksi tunggal.

### ⚡ C. Inefisiensi Cascading Triggers di Database (Database Reviewer)
* **Isu**: Pemicu `recipe_ingredients_recompute_total` berjalan `FOR EACH ROW`. Pembaruan massal harga bahan pangan memicu perhitungan ulang berkali-kali pada resep yang sama ($O(N^2)$).
* **Solusi**: Ubah trigger menjadi *statement-level trigger* menggunakan transition tables (`REFERENCING NEW TABLE AS new_rows`) untuk mengagregasi perhitungan ulang resep hanya sekali per statement.

---

## 3. Aksesibilitas (a11y) & SEO Gaps (Low Severity)

* **Modal Dialog Backdrop Click**: Kontainer dialog panel pada `Modal.jsx` bersarang di dalam elemen backdrop interaktif. Pembaca layar mendeteksinya sebagai elemen statis yang berinteraksi. Solusinya adalah memisahkan posisi dialog panel dan backdrop menjadi bersaudara (*siblings*) di bawah satu pembungkus relatif.
* **Optimasi Tag Judul SEO**: Judul pada `index.html` hanya `<title>CookPlan</title>`. Disarankan mengubahnya menjadi `<title>CookPlan — Rencana Menu Masak Mingguan & Resep Nusantara</title>` untuk meningkatkan indeks pencarian Google.
* **Pembersihan Dependensi Mati**: Hapus pustaka `lucide-react` dari `package.json` karena tidak digunakan (aplikasi menggunakan Material Symbols), serta geser `@tailwindcss/vite` dari `dependencies` ke `devDependencies`.

---

## 4. Daftar Laporan Rinci Sub-Agent

Untuk menelusuri potongan kode perbaikan spesifik, silakan buka laporan rinci masing-masing sub-agent berikut:

| Bidang Peninjauan | Tautan Laporan Rinci |
| :--- | :--- |
| **1. SEO, Metadata & Manifest** | [review_seo_metadata.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/b523f44c-85a2-4552-b148-d0a5b232c501/review_seo_metadata.md) |
| **2. Aksesibilitas (a11y) & UI** | [review_accessibility.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/603867a5-66b1-49ce-b93d-ee4745987316/review_accessibility.md) |
| **3. Kualitas & Kebersihan Kode** | [review_code_quality.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/15ffb2d1-18cd-4cdd-b9c0-fdeae0c4bb53/review_code_quality.md) |
| **4. State Context & React Hooks** | [review_contexts_hooks.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/660e018b-8dba-48dc-8e63-b24a7b26c5f4/review_contexts_hooks.md) |
| **5. Operasi API & Service Layer** | [review_api_services.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/6def23aa-d362-4920-b3e6-3a3fc87f5287/review_api_services.md) |
| **6. Layout & Alur Panel Admin** | [review_admin_panel.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/212e2bcf-a23f-4798-9a06-8181e9f2d395/review_admin_panel.md) |
| **7. Dokumentasi Projek & Setup** | [review_documentation.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/42ab6d77-7c28-47f8-bf17-4cfb3ccc5723/review_documentation.md) |
| **8. Performa Build & Bundling** | [review_performance_build.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/f80e2399-4d8d-46b1-9b9e-21996cec4843/review_performance_build.md) |
| **9. Integrasi PWA & Offline** | [review_pwa_offline.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/fdcc4ec2-5847-44f4-afb4-8a5fc776a35e/review_pwa_offline.md) |
| **10. Struktur DB & Supabase** | [review_database_schema.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/f67eac30-b6e2-4f9f-98f7-ba5d147181e0/review_database_schema.md) |

---

## 5. Rencana Aksi Selanjutnya (Next Steps)

Tentukan prioritas perbaikan yang Anda inginkan:
1. **Perbaikan Kritis Offline & Tamu**: Memperbaiki localStorage Guest Mode di `PlanContext.jsx` dan SEO tags di `index.html`.
2. **Pembersihan Dependensi & Vite PWA**: Menginstal `@vite-pwa/plugin` dan menghapus pustaka mati.
3. **Optimasi API & DB**: Membuat fungsi RPC untuk order transaksi Supabase.
