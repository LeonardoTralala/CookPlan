# 📝 Laporan Review Dokumentasi CookPlan (PKM-K 2026)

## 📌 Executive Summary

Dokumentasi repositori **CookPlan** telah dianalisis untuk menilai keakuratan instruksi pengaturan (setup), konfigurasi basis data lokal, panduan bagi pengembang (developer guidance), serta keselarasan tata bahasa (Bahasa Indonesia EYD V). 

Secara umum, dokumentasi telah memuat penjelasan alur pengguna (*user flow*), *tech stack*, dan rencana pengembangan (*roadmap*) yang sangat terperinci untuk kepentingan program PKM-K 2026. Namun, terdapat beberapa temuan krusial yang dapat menghambat pengembang baru atau menyebabkan kegagalan sistem saat dijalankan:
1. **Konflik Skema Database**: `ARCHITECTURE.md` menyajikan skema basis data usang yang tidak kompatibel dengan kebutuhan visual/logika aplikasi, sementara skema yang benar ada di `BACKEND.md`.
2. **Panduan SQL Manual vs Supabase CLI**: Dokumen menyarankan eksekusi manual via dashboard Supabase SQL Editor, sedangkan kode proyek sebenarnya telah bermigrasi menggunakan Supabase Migrations (55 berkas SQL di `supabase/migrations/`).
3. **Salah Prefiks Variabel Lingkungan**: `ARCHITECTURE.md` menyarankan prefiks `NEXT_PUBLIC_` (milik Next.js), sedangkan proyek dikembangkan dengan Vite yang memerlukan prefiks `VITE_`.
4. **Nama Berkas Salah**: Rujukan ke berkas klien Supabase ditulis `supabaseClient.js` di panduan backend, padahal nama berkas riilnya adalah `supabase.js`.
5. **Rujukan Berkas Hilang**: Rujukan ke berkas `DESIGN.md` tertera di beberapa ulasan UI/UX, tetapi berkas tersebut tidak ada di repositori.
6. **Tata Bahasa Non-Standar**: Penggunaan kata tidak baku seperti "projek" di banyak tempat, padahal standar EYD V menetapkan penulisan yang benar adalah "proyek".

Laporan rinci dan rekomendasi perbaikan dijabarkan pada tabel temuan di bawah ini.

---

## 🔍 Tabel Temuan & Rekomendasi Perbaikan

| Lokasi Berkas & Garis | Deskripsi Masalah | Tingkat Keparahan | Rekomendasi Solusi / Potongan Kode | Rasional |
| :--- | :--- | :---: | :--- | :--- |
| [docs/ARCHITECTURE.md#L126-L207](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/ARCHITECTURE.md#L126-L207) | **Skema Database Outdated/Inconsistent**<br>Skema database yang dijabarkan di `ARCHITECTURE.md` tertinggal dan tidak cocok dengan struktur state frontend. Kolom penting seperti `meal_type` pada `meal_entries`, `price_idr` pada `recipe_ingredients`, serta detail deskripsi/instruksi resep pada `recipes` tidak dicantumkan di sini. | **High** | Perbarui seluruh blok kode skema di `ARCHITECTURE.md` agar selaras dengan skema terkoreksi di `BACKEND.md` (atau buat rujukan langsung ke `BACKEND.md` / berkas migrasi). | Pengembang baru yang merujuk pada arsitektur akan membuat skema database yang rusak dan menyebabkan aplikasi *crash* karena kolom tidak ditemukan. |
| [docs/BACKEND.md#L118-L217](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/BACKEND.md#L118-L217) | **Panduan SQL Manual vs Migrasi CLI**<br>Dokumen menyarankan pengembang menjalankan perintah pembuatan tabel secara manual melalui menu SQL Editor di Supabase Dashboard. Padahal, repositori sudah memiliki 55 berkas migrasi terstruktur di dalam folder `supabase/migrations/` dan file `CLAUDE.md` merekomendasikan `supabase db push`. | **High** | Hapus instruksi SQL manual di `BACKEND.md` dan ganti dengan instruksi penggunaan Supabase CLI:<br>```markdown\n### 4. Sinkronisasi Skema Database\nJalankan perintah berikut untuk menerapkan migrasi lokal ke proyek Supabase terhubung:\n```bash\nsupabase db push\n```\n``` | Menggunakan SQL Editor secara manual mengabaikan riwayat migrasi git, menyebabkan *schema drift*, konflik migrasi, dan menyulitkan CI/CD. |
| [docs/ARCHITECTURE.md#L261-L271](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/ARCHITECTURE.md#L261-L271) | **Salah Prefiks Environment Variables**<br>Variabel lingkungan dicantumkan dengan prefiks `NEXT_PUBLIC_` (mis. `NEXT_PUBLIC_SUPABASE_URL`), padahal teknologi yang digunakan adalah Vite SPA yang membutuhkan prefiks `VITE_`. | **Medium** | Ubah seluruh prefiks variabel di `ARCHITECTURE.md` menjadi `VITE_`:<br>```env\nVITE_SUPABASE_URL=https://xxxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ...\n``` | Vite tidak memuat variabel lingkungan yang diawali selain `VITE_` ke dalam bundel klien, sehingga pemanggilan client Supabase akan mengembalikan nilai `undefined` di lingkungan production. |
| [docs/BACKEND.md#L98](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/BACKEND.md#L98), [#L114](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/BACKEND.md#L114), [#L250](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/BACKEND.md#L250), [#L265](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/BACKEND.md#L265) | **Salah Rujukan Nama File Klien Supabase**<br>`BACKEND.md` menyuruh pengembang membuat file `src/lib/supabaseClient.js` dan melakukan impor dari lokasi tersebut. Di dalam repositori, berkas tersebut sebenarnya bernama `src/lib/supabase.js`. | **Medium** | Ganti kata `supabaseClient.js` menjadi `supabase.js` dan ganti semua contoh import:<br>```javascript\nimport { supabase } from '../lib/supabase';\n``` | Developer akan mendapatkan error *module not found* saat mengikuti panduan backend jika file yang diimpor tidak sesuai dengan yang ada di repositori. |
| [docs/UI_UX_MOBILE_SIZING.md#L29](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/UI_UX_MOBILE_SIZING.md#L29), [docs/UI_UX_REVIEW.md#L74](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/UI_UX_REVIEW.md#L74) | **Broken File Link (`DESIGN.md` Tidak Ditemukan)**<br>Kedua ulasan UI/UX merujuk pada aturan token dan font keluarga di berkas `DESIGN.md`, namun berkas `DESIGN.md` tidak tersedia di seluruh direktori repositori. | **Medium** | Buat berkas `docs/DESIGN.md` baru yang memuat seluruh spesifikasi token desain, atau pindahkan rujukan informasi tersebut langsung ke `src/index.css` atau `ARCHITECTURE.md`. | Rujukan ke file yang tidak ada membingungkan pengembang yang ingin meneliti spesifikasi token tipografi responsif. |
| [README.md#L9](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/README.md#L9), [#L21](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/README.md#L21), [#L23](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/README.md#L23), [#L26](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/README.md#L26) | **Ejaan Non-Standar (Kata "Projek" vs "Proyek")**<br>Masih banyak penggunaan kata tidak baku "projek" di berkas `README.md`, `ARCHITECTURE.md`, dan `ROADMAP.md` untuk merujuk pada aplikasi ini. | **Low** | Ganti semua kemunculan kata "projek" menjadi kata baku "proyek" sesuai dengan ketentuan EYD V. | Penulisan laporan PKM-K dan dokumen publik memerlukan standar tata bahasa resmi Indonesia agar dinilai profesional dan akademis di mata juri PIMNAS. |
| [README.md#L32-L40](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/README.md#L32-L40), [docs/FEATURES.md#L20](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/FEATURES.md#L20), [#L63](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/docs/FEATURES.md#L63) | **Status Fitur Tidak Akurat**<br>Semua fitur utama di tabel fitur `README.md` dan `FEATURES.md` berstatus `Planned` atau `Planned (Direncanakan)`. Padahal, berdasarkan berkas `CLAUDE.md`, routing, authentikasi Supabase, otorisasi RLS, dan model-model service sudah berstatus `Implemented`/`Partial`. | **Low** | Perbarui status tabel fitur sesuai dengan progress terbaru (misal: Autentikasi menjadi `✅ Implemented`, Katalog Menu dan Planner menjadi `⚠️ Partial`/`✅ Implemented`). | Status yang selalu tertulis direncanakan (Planned) memberikan impresi buruk kepada pembaca luar bahwa proyek tidak berjalan atau belum memiliki kode riil. |

---

## 💡 Panduan Tambahan Bagi Pengembang (Developer Guidance Update)

Untuk memastikan kelancaran kolaborasi menggunakan AI maupun pemrograman manual, direkomendasikan penambahan poin-poin berikut ke dalam `CONTRIBUTING.md` atau `CLAUDE.md`:

1. **Gunakan Supabase CLI untuk Perubahan Skema**:
   Jangan pernah melakukan modifikasi skema tabel langsung di dashboard Supabase (DDL manual). Selalu gunakan CLI:
   ```bash
   # Membuat berkas migrasi kosong baru
   supabase migration new nama_perubahan
   # Terapkan perubahan ke database lokal/remote
   supabase db push
   ```
2. **Standardisasi Impor Klien Supabase**:
   Pastikan seluruh pemanggilan basis data di lapisan service menggunakan impor tunggal yang seragam:
   ```javascript
   import { supabase } from '@/lib/supabase';
   ```
3. **Penyelarasan Kasus Kolom Database (snake_case vs camelCase)**:
   Sebagaimana disarankan pada `BACKEND.md` seksi 5.1, lakukan aliasing langsung saat query menggunakan Supabase Client agar formatnya sesuai dengan penamaan camelCase di JavaScript (contoh: `imageUrl:image_url`).

---

*Laporan review dokumentasi ini dibuat secara otomatis untuk membantu keselarasan kualitas teknis dan administrasi CookPlan PKM-K 2026.*
