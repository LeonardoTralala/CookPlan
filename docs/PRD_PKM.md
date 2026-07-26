# 📄 Product Requirement Document (PRD) — CookPlan
**Status:** Draft (PKM-K 2026 Alignment)  
**Target Pengguna:** Mahasiswa Kos & Pekerja Kantoran  
**Tim Pengembang:** 2 Orang (AI-assisted coding approach)

---

## 1. Executive Summary & Context PKM-K

### 1.1 Latar Belakang (Problem Statement)
* **Masalah Pengguna:** Mahasiswa kos dan pekerja kantor perkotaan sering mengalami kesulitan merencanakan masakan harian, mengelola anggaran belanja, dan menyisakan banyak bahan makanan mentah yang akhirnya membusuk dan terbuang (*food waste*).
* **Masalah Operasional:** Belanja bahan makanan eceran di pasar tradisional memakan waktu, sedangkan belanja di supermarket/aplikasi e-grocery premium terlalu mahal untuk budget mahasiswa.
* **Solusi CookPlan:** Platform perencanaan menu mingguan berbasis web yang secara otomatis mengubah rencana masakan menjadi daftar belanja terkategorisasi, lalu menyalurkan pesanan bahan makanan ke mitra pedagang/supplier sayur lokal terdekat dengan model bisnis dropship.

### 1.2 Tujuan Proyek PKM-K
1. **Validasi Bisnis Nyata:** Menghasilkan transaksi belanja riil dengan margin komisi yang sehat selama periode PKM.
2. **Solusi Zero-Waste & Ekonomis:** Membantu pengguna belanja bahan makanan pas sesuai porsi resep untuk menekan pengeluaran dan mengurangi sampah makanan.
3. **Pemberdayaan Mitra Lokal:** Menghubungkan konsumen dengan pedagang sayur/kelontong lokal, meningkatkan omzet digital mereka tanpa biaya operasional tambahan yang besar.

---

## 2. Branding & Identitas Visual

Untuk menjaga konsistensi antarmuka (UI/UX) dan laporan PKM, diputuskan identitas visual berikut:

* **Nama Resmi Aplikasi:** `CookPlan`
* **Tema Warna Utama (Organic & Earthy Sage):**
  * `#2C3A1E` (Dark Olive - Background gelap / teks primer)
  * `#4E6B2F` (Olive Green - Warna brand utama / tombol aksi primer)
  * `#7A8C4A` (Medium Sage - Warna sekunder / border aktif)
  * `#A6A96A` (Light Sage - Aksen / status)
  * `#D9DFB0` (Cream Green - Background kartu / teks sekunder)
* **Tipografi:** Google Fonts — **Poppins** (modern, ramah, dan mudah dibaca oleh kalangan muda).

---

## 3. Model Bisnis (PKM-K Revenue Model)

Sebagai proyek PKM Kewirausahaan (PKM-K), CookPlan harus membuktikan kelayakan ekonomisnya melalui beberapa *revenue stream*:

1. **Komisi Dropship (Affiliate Margin):**
   * Pengguna mengonfirmasi daftar belanja di aplikasi.
   * CookPlan meneruskan pesanan ke mitra pemasok lokal terdekat.
   * CookPlan mendapatkan komisi berkisar antara **5% - 15%** dari total transaksi belanja bahan mentah.
2. **Paket Berlangganan Bulanan (Monthly Subscription):**
   * Pengguna membayar biaya langganan bulanan tetap.
   * **Benefit Langganan:**
     * Potongan harga bahan makanan (belanja tanpa *markup* harga).
     * Gratis ongkos kirim dari kurir mitra.
     * Rekomendasi resep yang dipersonalisasi sesuai kebutuhan nutrisi.
3. **Pengiriman oleh Kurir Lokal:**
   * Pengantaran bahan makanan dilakukan oleh kurir internal CookPlan (tim PKM) atau kurir mitra lokal dengan tarif flat yang terjangkau.

---

## 4. Spesifikasi MVP Scope (Fase Penilaian Monev)

Karena tim pengembang terdiri dari 2 orang yang berfokus menggunakan bantuan coding AI (no-code/low-code background) dan memiliki batasan waktu PKM (4 bulan), cakupan fitur aplikasi dibagi secara ketat antara **Monev-Ready** dan **Rencana Masa Depan**.

### 4.1 Fitur Utama MVP (Wajib Selesai untuk Demo Juri)

| Modul | Deskripsi Fitur | Implementasi Teknis (AI-Friendly) |
|---|---|---|
| **Katalog Resep** | Menampilkan menu masakan Indonesia dengan filter pencarian bahan dasar, estimasi waktu masak, dan harga. | React client-side rendering dengan data resep yang disimpan di database Supabase. |
| **Weekly Planner** | Kalender 7 hari (Senin-Minggu) untuk menambahkan menu makanan dan menentukan jumlah porsi (misal: 1 porsi untuk anak kos, 2 porsi untuk pasangan). | State management sederhana yang menyimpan rencana masak per user di Supabase. |
| **Auto Shopping List** | Secara otomatis menggabungkan bahan-bahan masakan dari kalender planner, menghitung total gramasi bahan, dan mengelompokkannya ke kategori (Sayur, Daging, Rempah). | Fungsi JavaScript yang melakukan kompilasi array bahan mentah secara otomatis dari database. |
| **Simulasi Checkout & Order** | Halaman ringkasan belanjaan sebelum dibeli. Menampilkan total belanja, biaya layanan, metode pembayaran, dan tombol checkout. | Layar Checkout yang profesional dengan integrasi **Midtrans Sandbox** (untuk demo pembayaran simulasi) yang terintegrasi dengan tabel `orders` Supabase. |
| **WhatsApp Order Redirect** *(Fallback & Validasi Riil)* | Saat checkout dikonfirmasi, sistem membuat baris baru di tabel `orders` Supabase untuk mendapatkan **ID Pesanan unik** (misal: `#CP-260527-004`), lalu mengarahkan user ke WhatsApp Admin dengan teks pesanan terformat otomatis yang mencantumkan ID tersebut, nama, detail bahan, total harga, dan alamat. | Tombol dinamis yang mengambil `order_id` dari database Supabase dan menghasilkan URL WhatsApp (`https://wa.me/...&text=...`) dengan pesan terformat rapi (menggunakan bold/line breaks WA) agar admin dapat melacak pesanan dengan mudah di dashboard database. |
| **Sistem Autentikasi** | Pendaftaran dan masuk akun pengguna agar rencana masak dan riwayat pesanan tidak hilang. | **Supabase Auth** bawaan (sangat mudah disetup dengan React tanpa menulis backend manual). |

### 4.2 Fitur Pasca-PIMNAS (Out of Scope untuk Monev Awal)
* **Integrasi API Kurir Pihak Ketiga Rill (Gosend/BiteShip):** Cukup disimulasikan dengan tarif flat di UI.
* **Integrasi Google Maps API Riil:** Diganti dengan input alamat teks biasa dan pencarian manual untuk mempermudah pengerjaan AI.
* **Smart Pantry / Sensor Ketahanan Expired:** Diganti dengan notifikasi/catatan statis sederhana di dashboard planner.

### 4.3 Alur Pengguna (User Flow MVP)

1. **Eksplorasi Landing Page:** Pengguna membuka CookPlan, melihat fitur, manfaat hemat biaya & zero-waste, lalu klik **"Mulai Rencanakan"**.
2. **Autentikasi (Sign Up/In):** Pengguna masuk menggunakan email/password (dikelola oleh Supabase Auth).
3. **Memilih Resep (Recipe Selection):** Pengguna menelusuri katalog resep, menggunakan filter bahan dasar atau estimasi harga, lalu menekan **"Add to Plan"** (memilih hari dan jumlah porsi).
4. **Penyusunan Rencana (Weekly Planner):** Pengguna meninjau jadwal mingguan (Senin-Minggu). Di sini mereka bisa menghapus menu atau menekan **"Generate Daftar Belanja"**.
5. **Kompilasi Daftar Belanja (Shopping List):** Sistem otomatis merangkum bahan-bahan belanjaan yang sudah dikonversi porsinya. Pada tab *Belanja Sendiri*, pengguna dapat menandai (*check-off*) bahan yang sudah mereka miliki di kulkas agar tidak dibeli ulang sebagai checklist belanja mandiri.
6. **Proses Checkout (Belanja Lewat CookPlan):** Di tab *Belanja Lewat CookPlan*, pengguna memilih paket bahan makanan, memasukkan nama, nomor WhatsApp, dan alamat pengiriman area Kota Malang (layanan hanya tersedia untuk Kota Malang saja), memilih metode pembayaran, lalu menekan **"Konfirmasi & Kirim Pesanan"**.
7. **Simpan Data & Redirect WhatsApp:** Sistem menyimpan rekaman pesanan ke tabel `orders` di Supabase untuk mendapatkan **ID Pesanan**, lalu secara otomatis mengarahkan browser untuk membuka aplikasi WhatsApp dengan pesan terformat rapi berisi rincian pesanan dan ID unik tersebut untuk diproses oleh admin.

---

## 5. Indikator Kinerja Utama (KPI) & Luaran PKM-K

Juri PKM-K akan sangat menilai hasil nyata dari usaha ini. Dokumen PRD ini menetapkan metrik kesuksesan berikut:

### 5.1 Metrik Produk & Bisnis
* **User Acquisition:** Minimal 30 pengguna aktif bulanan dari kalangan mahasiswa kos/pekerja kantor di area uji coba.
* **Transaksi Riil:** Minimal 50 transaksi belanja bahan makanan berhasil diselesaikan lewat platform/WhatsApp redirect selama 2 bulan operasional.
* **Omzet Penjualan:** Target minimal penjualan kotor (GMV) sebesar Rp 1.500.000,- selama masa pelaksanaan PKM.
* **Uji Usability:** Aplikasi mencapai skor pengujian kegunaan (*System Usability Scale* / SUS) minimal **78** (Kategori *Good/Excellent*).

### 5.2 Luaran Wajib PKM-K
1. Laporan Kemajuan Proyek PKM-K.
2. Laporan Akhir Proyek PKM-K.
3. Aplikasi Web CookPlan yang Fungsional & Siap Pakai.
4. Sertifikat Hak Cipta (HKI) atas nama Tim PKM CookPlan.
5. Media promosi produk berupa video kreatif dan akun media sosial aktif (Instagram/TikTok).

### 5.3 Rencana Validasi & Pengujian Pengguna
1. **Alpha Testing (Internal):** Pengujian fungsionalitas tombol, alur database, dan tautan redirect WhatsApp oleh 2 orang anggota tim pengembang untuk meminimalkan bug sebelum rilis publik.
2. **Beta Testing (Uji Coba Pengguna Terbatas):** Menyebarkan kuesioner evaluasi dan meminta 10–15 mahasiswa kos/pekerja kantor untuk menggunakan aplikasi CookPlan selama 1-2 minggu untuk merencanakan makanan mereka.
3. **Pengukuran SUS (System Usability Scale):** Menggunakan 10 pertanyaan standar kuesioner SUS untuk menghitung skor kepuasan dan kemudahan penggunaan aplikasi di akhir pengujian pengguna. Target skor minimal adalah **78**.
4. **Analisis Finansial & Operasional:** Menganalisis catatan transaksi di Supabase (total penjualan, margin profit, biaya operasional pengiriman) untuk membuktikan kelayakan bisnis CookPlan kepada juri Monev.

---

## 6. Arsitektur Teknologi (AI Coding Friendly)

Untuk meminimalkan error kode saat menggunakan AI coding assistant, diputuskan stack teknologi berikut:
* **Frontend:** **React SPA (Vite)** + **Tailwind CSS v4** (untuk pembuatan komponen antarmuka yang cepat dan responsif).
* **Backend & Database:** **Supabase** (menyediakan layanan Database PostgreSQL, Auth, dan API instan tanpa perlu coding backend Node.js terpisah).
* **Deployment:** **Vercel** atau **Netlify** (gratis, setup cepat dengan integrasi Github, auto-deploy saat kode di-push).

---

*PRD ini disepakati oleh tim pengembang CookPlan sebagai kompas utama dalam penulisan ulang kode.*
