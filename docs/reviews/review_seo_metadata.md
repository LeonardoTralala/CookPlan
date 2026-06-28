# Laporan Peninjauan Kode: SEO, Metadata & PWA Konfigurasi (CookPlan)

## Ringkasan Eksekutif (Executive Summary)

Berdasarkan hasil analisis terhadap berkas-berkas konfigurasi utama (`index.html`, `public/manifest.webmanifest`, dan `vite.config.js`), aplikasi **CookPlan** telah memiliki fondasi PWA dan SEO yang cukup baik dengan mendukung lokalisasi bahasa Indonesia, tag Open Graph dasar, serta Service Worker manual untuk kemampuan offline. 

Namun, ditemukan satu celah kritis (**High Severity**) pada implementasi caching Service Worker: **Aset bundel produksi (JS/CSS dengan hash dinamis dari Vite) tidak masuk ke daftar *precache***. Hal ini mengakibatkan aplikasi menampilkan layar kosong (blank screen) saat dibuka dalam kondisi luring (offline) karena kode aplikasi utama gagal dimuat.

Selain itu, terdapat beberapa perbaikan kelas menengah (**Medium Severity**) terkait pengoptimalan SEO on-page (tag judul dan deskripsi), URL gambar Open Graph yang menggunakan tautan Google Photos sementara (rentan kedaluwarsa), serta absennya meta tag Twitter Cards dan tautan Canonical.

Rekomendasi utama adalah mengadopsi **`vite-plugin-pwa`** untuk mengotomatisasi generasi Service Worker dan *precache manifest*, mengoreksi metadata sosial, serta melengkapi berkas pelacak seperti `robots.txt` dan `sitemap.xml`.

---

## Tabel Temuan (Table of Findings)

| No | Lokasi Berkas & Baris | Deskripsi Masalah | Tingkat Keparahan | Solusi Rekomendasi / Snippet Kode | Rasional |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **1** | [public/sw.js:6-14](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/public/sw.js#L6-14) | **Aset Hasil Build Vite Tidak Ter-cache (Offline Failure)**<br><br>Daftar `PRECACHE` ditulis secara manual dan hanya mencakup berkas statis di folder `public`. Aset utama aplikasi (`/assets/index-[hash].js` dan `/assets/index-[hash].css`) tidak masuk daftar precache. Akibatnya, saat offline, aplikasi gagal memuat kode JS/CSS utama sehingga menampilkan halaman kosong. | **High** | Pasang dan gunakan `vite-plugin-pwa` untuk menangani pembuatan Service Worker secara otomatis.<br><br>1. Instal plugin:<br>`npm install -D vite-plugin-pwa`<br><br>2. Perbarui [vite.config.js](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/vite.config.js):<br>```javascript\nimport { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nimport tailwindcss from '@tailwindcss/vite'\nimport { VitePWA } from 'vite-plugin-pwa'\n\nexport default defineConfig({\n  plugins: [\n    react(),\n    tailwindcss(),\n    VitePWA({\n      registerType: 'autoUpdate',\n      manifest: false, // Gunakan manifest.webmanifest eksternal\n      injectRegister: 'inline',\n      workbox: {\n        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],\n      }\n    })\n  ],\n})\n``` | Tanpa meng-cache aset ber-hash dinamis hasil build Vite, aplikasi PWA tidak akan berfungsi saat offline. Menggunakan `vite-plugin-pwa` memecahkan masalah ini dengan mendeteksi dan meng-cache seluruh berkas hasil kompilasi secara otomatis. |
| **2** | [index.html:7](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/index.html#L7) | **Tag Title Kurang Deskriptif**<br><br>Judul situs hanya berisi `"CookPlan"`. Ini melewatkan peluang SEO untuk menargetkan kata kunci utama pada hasil pencarian (SERP). | **Medium** | Ubah baris title menjadi:<br>```html\n<title>CookPlan — Rencana Menu Masak Mingguan & Resep Nusantara</title>\n``` | Judul halaman adalah elemen SEO on-page terpenting. Menyisipkan kata kunci utama seperti "Rencana Menu Masak" dan "Resep Nusantara" meningkatkan relevansi dan *click-through rate* (CTR) dari mesin pencari. |
| **3** | [index.html:25](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/index.html#L25) | **URL Tautan Gambar Open Graph (`og:image`) Rentan Kedaluwarsa**<br><br>Menggunakan tautan panjang Google Photos/Aida Public. Tautan eksternal semacam ini rentan terkena *rate limit*, kedaluwarsa token, atau dihapus secara sepihak, yang akan merusak pratinjau (preview) di media sosial. | **Medium** | Unggah gambar banner resmi (misal: `og-image.png` ukuran 1200x630) ke folder `public/`, lalu gunakan domain absolut produksi:<br>```html\n<meta property="og:image" content="https://cookplan.id/og-image.png" />\n``` | Menggunakan aset lokal yang dihosting pada domain sendiri menjamin stabilitas dan ketersediaan gambar pratinjau saat tautan aplikasi dibagikan ke WhatsApp, Slack, Facebook, atau Telegram. |
| **4** | [index.html:21-27](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/index.html#L21-27) | **Metadata Sosial Tidak Lengkap (Twitter Cards & Canonical URL)**<br><br>Tidak ada tag untuk Twitter Cards dan properti `og:url` serta tautan `<link rel="canonical">` absen. | **Medium** | Tambahkan baris berikut di dalam `<head>`:<br>```html\n<link rel="canonical" href="https://cookplan.id/" />\n<meta property="og:url" content="https://cookplan.id/" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="CookPlan — Rencana Menu Masak & Resep Nusantara" />\n<meta name="twitter:description" content="Rencanakan menu masak mingguan dengan resep nusantara dan dapatkan daftar belanja otomatis dengan estimasi biaya petani lokal secara praktis." />\n<meta name="twitter:image" content="https://cookplan.id/og-image.png" />\n``` | Tag canonical mencegah masalah konten duplikat (duplicate content), sedangkan Twitter Cards memastikan tautan terlihat profesional dengan kartu besar ketika dibagikan di platform X/Twitter. |
| **5** | [index.html:8](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/index.html#L8) | **Meta Description Terlalu Panjang**<br><br>Deskripsi meta saat ini memiliki panjang 202 karakter. Google biasanya memotong deskripsi setelah ~160 karakter di hasil pencarian seluler maupun desktop. | **Low** | Persingkat deskripsi menjadi kisaran 140-155 karakter:<br>```html\n<meta name="description" content="CookPlan: Rencanakan menu masak mingguan dengan resep nusantara dan dapatkan daftar belanja otomatis dengan estimasi biaya dari petani lokal." />\n``` *(141 karakter)* | Mencegah teks deskripsi terpotong secara canggung (diakhiri tanda "...") di halaman hasil pencarian Google, menjaga keterbacaan info bagi calon pengguna. |
| **6** | [public/manifest.webmanifest](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/public/manifest.webmanifest) | **Absennya Tangkapan Layar (Screenshots) di Web App Manifest**<br><br>Manifestasi PWA tidak memiliki properti `"screenshots"`, sehingga gagal menampilkan dialog instalasi kaya visual (*rich install prompt*) pada browser Chrome (Android & Desktop). | **Low** | Tambahkan properti `"screenshots"` di dalam [manifest.webmanifest](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/public/manifest.webmanifest):<br>```json\n"screenshots": [\n  {\n    "src": "/screenshots/narrow.png",\n    "sizes": "720x1280",\n    "type": "image/png",\n    "form_factor": "narrow"\n  },\n  {\n    "src": "/screenshots/wide.png",\n    "sizes": "1280x720",\n    "type": "image/png",\n    "form_factor": "wide"\n  }\n]\n``` | Memberikan antarmuka instalasi aplikasi PWA yang lebih menarik bagi pengguna (menyerupai Google Play Store / App Store) dibandingkan sekadar spanduk teks polos biasa. |
| **7** | [public/sw.js:6-14](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/public/sw.js#L6-14) | **Aset Maskable Icon Tidak Masuk Caching Offline**<br><br>Berkas `/icon-maskable-512.png` dideklarasikan dalam manifest tetapi dilewatkan dari daftar precache `sw.js`. | **Low** | Tambahkan `"/icon-maskable-512.png"` ke dalam daftar konstanta `PRECACHE` di `sw.js` (atau otomatis jika menggunakan Vite PWA plugin). | Mencegah ikon adaptif PWA gagal tampil (menjadi fallback default sistem operasi) saat perangkat pengguna sedang offline. |
| **8** | Folder `public/` | **Kehilangan Berkas `robots.txt` dan `sitemap.xml`**<br><br>Kedua berkas krusial untuk indeksasi dan perayapan mesin pencari (crawling) ini tidak ditemukan di direktori publik. | **Low** | Buat berkas baru di folder `public/`:<br><br>**`robots.txt`**:<br>```txt\nUser-agent: *\nAllow: /\nSitemap: https://cookplan.id/sitemap.xml\n```<br><br>**`sitemap.xml`**:<br>```xml\n<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://cookplan.id/</loc><priority>1.0</priority></url>\n  <url><loc>https://cookplan.id/generate</loc><priority>0.8</priority></url>\n  <url><loc>https://cookplan.id/planner</loc><priority>0.8</priority></url>\n  <url><loc>https://cookplan.id/shopping</loc><priority>0.8</priority></url>\n</urlset>\n``` | Membimbing robot perayap Google (Googlebot) untuk mengindeks rute halaman SPA dengan benar dan efisien. |

---

## Analisis Kata Kunci (Keywords Analysis)

Berikut adalah evaluasi performa kata kunci yang ditargetkan dalam metadata halaman utama:

- **Kata Kunci Utama (Primary Keywords):**
  1. *Rencana menu masak* (Sangat baik, telah digunakan di meta deskripsi & manifest)
  2. *Resep nusantara* (Sangat baik, tercantum di deskripsi & og:description)
  3. *Daftar belanja otomatis* (Baik, terdapat di deskripsi)
- **Kata Kunci Pendukung (Secondary Keywords):**
  1. *Estimasi biaya* (Hadir di deskripsi utama)
  2. *Petani lokal* (Hadir di deskripsi utama)
  3. *Masak hemat* (Hadir di deskripsi manifest)

### Rekomendasi Struktur Heading SEO (On-page SEO)
Untuk menyelaraskan dengan keyword yang diletakkan pada metadata head di atas, pastikan struktur heading pada halaman depan aplikasi React (misal: di `App.jsx` atau `Home.jsx`) mengikuti pola hierarki semantik berikut:
- **`<h1>`**: Mengandung nama brand & kata kunci utama (misal: `CookPlan: Rencana Menu Masak & Resep Nusantara`).
- **`<h2>`**: Menjelaskan fitur utama dengan kata kunci sekunder (misal: `Rekomendasi Resep Masakan Nusantara`, `Daftar Belanja Otomatis dengan Estimasi Biaya`).

---

## Kesimpulan Akhir & Prioritas Perbaikan

1. **Prioritas 1 (Segera):** Perbaiki `sw.js` dengan mengintegrasikan `vite-plugin-pwa` ke dalam `vite.config.js` agar aset JS/CSS aplikasi dapat dimuat tanpa koneksi internet.
2. **Prioritas 2 (Penting):** Perbarui tag judul (`<title>`) dan ganti tautan gambar Open Graph Google Photos dengan gambar statis lokal yang dihosting pada domain CookPlan sendiri demi kestabilan pratinjau media sosial.
3. **Prioritas 3 (Opsional/Saran):** Tambahkan `robots.txt` dan `sitemap.xml` untuk efisiensi perayapan SEO.
