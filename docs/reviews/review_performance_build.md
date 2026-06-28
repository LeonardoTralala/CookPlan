# Laporan Peninjauan Kode: Performa, Dependensi, dan Konfigurasi Build CookPlan

## Ringkasan Eksekutif

CookPlan dirancang sebagai aplikasi web progresif (PWA) untuk membantu perencanaan menu mingguan. Berdasarkan tinjauan statis terhadap `vite.config.js`, `package.json`, `src/main.jsx`, dan penelusuran arsitektur menggunakan Graf Proyek (Graphify), kami mengidentifikasi beberapa peluang optimalisasi performa yang signifikan. 

Secara umum, aplikasi sudah mengimplementasikan *code-splitting* berbasis rute menggunakan `React.lazy()` di `src/App.jsx`. Namun, efektivitas pemecahan kode ini terhambat oleh masuknya pustaka besar seperti Supabase ke dalam bundel utama (*index bundle*). Selain itu, terdapat dependensi tidak terpakai, konfigurasi Tailwind v4 yang menyisakan dependensi lama (PostCSS/Autoprefixer), dan strategi caching Service Worker manual yang rentan terhadap masalah *stale cache* (ketidakcocokan hash aset pasca-deploy).

Penerapan rekomendasi dalam laporan ini diperkirakan dapat memperkecil ukuran bundel awal hingga >50%, mengurangi waktu *Time to Interactive* (TTI) di perangkat seluler, serta meningkatkan stabilitas pembaruan aplikasi (PWA).

---

## Tabel Temuan Peninjauan (Findings)

| Lokasi File & Baris | Deskripsi Masalah (Tingkat Keparahan) | Solusi yang Direkomendasikan / Potongan Kode | Rencana & Rationale |
| :--- | :--- | :--- | :--- |
| `package.json`<br>Baris 15 | **Dependensi Tidak Terpakai (`lucide-react`)**<br><br>**Tingkat Keparahan:** Rendah | Hapus `lucide-react` dari `package.json` dan jalankan `npm prune`:<br><br>```bash\nnpm uninstall lucide-react\n``` | Aplikasi menggunakan Google Material Symbols yang dimuat via tautan stylesheet CDN di `index.html` (Baris 33). Pustaka `lucide-react` tidak pernah diimpor di file `.jsx` mana pun, menjadikannya dependensi mati yang memperlambat waktu instalasi dependensi proyek (`npm install`). |
| `package.json`<br>Baris 14, 25, 30 | **Dependensi Tailwind v4 Tidak Sesuai Kategori & Redundan**<br><br>**Tingkat Keparahan:** Rendah | 1. Pindahkan `@tailwindcss/vite` ke `devDependencies`. <br>2. Hapus `postcss` dan `autoprefixer` karena tidak digunakan oleh compiler Tailwind v4.<br><br>```json\n// Perubahan di package.json\n"dependencies": {\n  "@supabase/supabase-js": "^2.106.2",\n  "react": "^19.2.6",\n  "react-dom": "^19.2.6",\n  "react-router-dom": "^7.16.0"\n},\n"devDependencies": {\n  "@tailwindcss/vite": "^4.3.0",\n  "tailwindcss": "^4.3.0",\n  // ...\n}\n``` | `@tailwindcss/vite` adalah plugin build-time dan seharusnya berada di `devDependencies` agar tidak diinstal di lingkungan produksi runtime. Tailwind CSS v4 menggunakan compiler internal berbasis Rust/Vite plugin langsung tanpa memerlukan `postcss` dan `autoprefixer`, sehingga kedua pustaka tersebut redundan. |
| `vite.config.js`<br>Baris 6-11 | **Bundel Awal Gemuk (Supabase Bloat di Initial Bundle)**<br><br>**Tingkat Keparahan:** Tinggi | Konfigurasikan pembagian manual (*manual chunks*) di `vite.config.js` untuk memisahkan pustaka Supabase, React, dan React Router ke bundel terpisah:<br><br>```javascript\nimport { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nimport tailwindcss from '@tailwindcss/vite'\n\nexport default defineConfig({\n  plugins: [\n    react(),\n    tailwindcss(),\n  ],\n  build: {\n    rollupOptions: {\n      output: {\n        manualChunks(id) {\n          if (id.includes('node_modules')) {\n            if (id.includes('@supabase')) return 'vendor-supabase';\n            if (id.includes('react-router-dom') || id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router';\n            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';\n            return 'vendor-libs';\n          }\n        }\n      }\n    }\n  }\n})\n``` | Karena `main.jsx` mengimpor `AuthProvider`, yang selanjutnya mengimpor `supabase.js`, seluruh SDK Supabase (~150kb+ minified) dipaksa masuk ke bundel awal (`index-[hash].js`). Dengan manual chunking, browser dapat mengunduh pustaka ini secara paralel (memanfaatkan HTTP/2) dan menjaga tembolok (*cache*) browser tetap valid untuk pustaka pihak ketiga ketika kode aplikasi mengalami pembaruan. |
| `public/sw.js`<br>Baris 1-61 | **Risiko Crash Akibat Sinkronisasi Chunks (Stale-While-Revalidate pada Aset Ber-hash)**<br><br>**Tingkat Keparahan:** Sedang-Tinggi | Migrasikan manajemen Service Worker dari file manual ke pustaka otomatis **`vite-plugin-pwa`**:<br><br>1. Instal plugin:<br>`npm install -D vite-plugin-pwa`<br>2. Konfigurasikan di `vite.config.js`:<br>```javascript\nimport { VitePWA } from 'vite-plugin-pwa'\n// Tambahkan VitePWA() ke array plugins\n``` | Service Worker saat ini mengadopsi taktik cache-first secara manual. Ketika aplikasi diperbarui, berkas JS dengan hash baru dideploy ke server, tetapi Service Worker mungkin masih menyajikan berkas HTML/JS lama dari cache. Saat berkas lama meminta pecahan kode (*chunk*) yang sudah dihapus dari server, aplikasi akan mengalami kegagalan/crash runtime. `vite-plugin-pwa` secara otomatis melacak seluruh manifes aset ber-hash dan mengelola siklus hidup pembaruan secara aman. |
| `vite.config.js`<br>Baris 6-11 | **Ketiadaan Kompresi Berkas Statis pada Sisi Build**<br><br>**Tingkat Keparahan:** Sedang | Integrasikan plugin kompresi untuk menghasilkan aset `.gz` (Gzip) dan `.br` (Brotli) saat build:<br><br>1. Instal plugin:<br>`npm install -D vite-plugin-compression`<br>2. Tambahkan ke `vite.config.js`:<br>```javascript\nimport viteCompression from 'vite-plugin-compression'\n// Tambahkan viteCompression() ke array plugins\n``` | Mengompresi berkas statis (HTML, JS, CSS) sebelum dideploy akan sangat menghemat bandwidth server dan mempercepat pemuatan halaman pertama pada koneksi mobile yang lambat, karena server dapat langsung menyajikan berkas `.br` atau `.gz` tanpa perlu mengompresinya secara dinamis (on-the-fly) yang memakan beban CPU server. |
| `src/App.jsx`<br>Baris 14-35 | **Impor Malas (Lazy Load) Bertele-tele karena Named Export**<br><br>**Tingkat Keparahan:** Rendah | Ubah ekspor komponen halaman dari *named export* menjadi *default export*, lalu sederhanakan impor `lazy`:<br><br>```javascript\n// Sebelum:\nconst PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx').then((m) => ({ default: m.PrivacyPolicy })));\n\n// Sesudah:\nconst PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'));\n``` | Saat ini, banyak rute menggunakan `.then((m) => ({ default: m.Component }))` karena halaman diekspor secara bernama (*named*). Dengan mengubah ke *default export* pada berkas-berkas halaman, kode router menjadi lebih bersih, lebih mudah dibaca, dan meminimalkan potensi kesalahan pengetikan nama komponen saat melakukan impor dinamis. |

---

## Panduan Penerapan Langkah demi Langkah

### Langkah 1: Bersihkan package.json
Jalankan perintah berikut untuk menghapus dependensi yang tidak digunakan dan membersihkan package.json:
```powershell
npm uninstall lucide-react postcss autoprefixer
```
Pastikan `@tailwindcss/vite` berada di dalam `"devDependencies"` bukan `"dependencies"`.

### Langkah 2: Perbarui vite.config.js
Ubah isi `vite.config.js` menjadi lebih optimal dengan pembagian manual chunking dan persiapan kompresi:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br' }),
    viteCompression({ algorithm: 'gzip', ext: '.gz' })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react-router-dom') || id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            return 'vendor-libs';
          }
        }
      }
    }
  }
})
```

### Langkah 3: Rencana Migrasi PWA (Opsional tapi Sangat Direkomendasikan)
Untuk menghindari crash akibat *stale chunk errors*, disarankan mengadopsi `vite-plugin-pwa` dengan mode *Prompt for Update*. Panduan integrasi detail:
1. Instal: `npm install -D vite-plugin-pwa`
2. Tambahkan konfigurasi `VitePWA` di `vite.config.js` yang mengontrol pendaftaran service worker secara otomatis.
3. Hapus logika pendaftaran manual di `src/main.jsx` (baris 28-34) agar tidak bentrok dengan pendaftaran otomatis dari plugin.
