# Product Requirement Document (PRD)
## Kurangi Friction Onboarding & Optimasi "Aha! Moment" Pengunjung CookPlan

---

### 1. Ringkasan Eksekutif (Executive Summary)
**CookPlan** adalah aplikasi *meal planning*, otomatisasi daftar belanja, dan *food prep* berbasis AI untuk PKM-K 2026. Berdasarkan evaluasi akuisisi pengguna, hambatan utama (*friction*) pengunjung baru dalam mencoba CookPlan adalah keharusan untuk membuat akun/login terlalu awal sebelum mereka memahami atau merasakan manfaat aplikasi.

PRD ini bertujuan merombak alur *first impression* dengan menerapkan strategi **Product-Led Growth (PLG) / Try-Before-Register**: pengunjung web (calon pengguna) dapat langsung mencoba **seluruh core offer CookPlan** (AI Meal Generator, Katalog Resep, Rencana Masak Mingguan, dan Checklist Belanja Otomatis) secara gratis tanpa mendaftar. Setelah merasakan nilai utama aplikasi ("Aha! Moment"), barulah pengguna diajak mendaftar untuk menyimpan progres mereka secara permanen di server.

---

### 2. Latar Belakang & Pernyataan Masalah (Problem Statement)

> **Masalah**: Pengunjung yang didatangkan dari kegiatan marketing/sosial media sering batal mencoba aplikasi (*drop-off*) ketika terhalang tembok login/register di awal. 
> 
> **Dampak**: Tingkat konversi calon pengunjung menjadi pengguna aktif (*real user*) rendah karena calon pengguna belum melihat keunggulan CookPlan secara langsung.

#### Prinsip Solusi:
1. **Zero-Friction Access**: Pengunjung baru yang masuk ke CookPlan langsung diberikan akses penuh ke seluruh fitur utama (**Generate AI**, **Katalog**, **Planner**, dan **Belanja**) dalam **Mode Tamu (Guest Mode)**.
2. **Visual & Interactive "Aha! Moment"**: Tamu dapat menyusun rencana makan mingguan, melihat daftar belanja otomatis yang dapat dicentang, serta mengeksplorasi resep masakan secara instan.
3. **Soft-Gated Conversion**: Ajakan mendaftar (CTA Registrasi) ditempatkan secara alami tepat ketika calon pengguna ingin menyimpan progres permanen ke server, menyukai/menyimpan resep, atau melakukan pesanan paket logistik.

---

### 3. Matriks Fitur Mode Tamu (Guest Mode Feature Matrix)

| Fitur | Status Guest Mode | Pengalaman Pengguna (UX) Tamu | Triger Konversi (Auth Required) |
| :--- | :---: | :--- | :--- |
| **Susun Menu AI (`/generate`)** | 🔓 Terbuka | Bebas atur wizard & buat rencana menu AI (hingga 2x kuota gratis per sesi tamu). | Menampilkan CTA Registrasi di halaman hasil untuk simpan permanen. |
| **Katalog Resep (`/catalog`)** | 🔓 Terbuka | Bebas cari resep, filter diet/waktu/harga, dan baca panduan langkah masak lengkap. | Menampilkan Auth Modal saat menekan **Bookmark (Simpan)** atau **Like (Suka)**. |
| **Rencana Masak (`/planner`)** | 🔓 Terbuka | Bebas atur jadwal makan 7 hari (Senin–Minggu). Data tersimpan lokal di browser (`localStorage`). | Menampilkan banner edukasi: *"Daftar akun gratis agar jadwal makanmu tersimpan permanen & tidak hilang."* |
| **Daftar Belanja (`/shopping`)** | 🔓 Terbuka | Bebas lihat checklist belanja otomatis dari planner, centang bahan, & salin ke WA/Clipboard. | Menampilkan Auth Modal saat menekan **Simpan ke Server** atau **Checkout Pesanan Paket**. |
| **Profil & Admin (`/profile`, `/admin/*`)** | 🔒 Terkunci | Dialihkan ke halaman login/register (`/auth`). | Butuh akun terdaftar. |

---

### 4. Detail Fitur & Spesifikasi Pengalaman Pengguna (User Experience & Features)

#### Fitur 1: Navigasi Full-Access untuk Tamu (Seamless Guest Navigation)
* **Deskripsi**: Menyediakan navigasi 4 tab lengkap bagi tamu baik di Desktop maupun Mobile.
* **Kebutuhan UI/UX**:
  * **Desktop Top Nav**: Menampilkan menu **Generate** (`/generate`), **Katalog** (`/catalog`), **Rencana** (`/planner`), **Belanja** (`/shopping`), dan tombol CTA **"Daftar / Masuk"**.
  * **Mobile Bottom Nav**: Menampilkan bottom nav bar 5 tab penuh untuk tamu (`Generate`, `Katalog`, `Rencana`, `Belanja`, `Daftar`).
  * **Guest Teaser Banner**: Menampilkan banner subtle di bagian paling atas layar:
    > *"✨ **Mode Uji Coba**: Kamu sedang mencoba Mode Tamu! Coba fitur AI, Katalog, Planner &amp; Belanja sepuasnya. [Daftar Akun Gratis]"*

#### Fitur 2: Rencana Masak & Belanja Lokal (Local Planner & Shopping Checklist)
* **Deskripsi**: Tamu dapat mengedit jadwal makan dan melihat daftar belanjaan yang diperbarui secara *real-time* di peramban (*localStorage*).
* **High-Converting CTA**:
  * Di bagian atas halaman Planner & Shopping untuk tamu, tampilkan banner pengingat ramah:
    > *"💡 Rencana &amp; daftar belanjamu tersimpan sementara di perangkat ini. **Daftar akun gratis** agar dapat diakses dari HP &amp; laptop mana saja!"*

#### Fitur 3: Pengalaman "Aha! Moment" AI Generator & Hasilnya
* **Deskripsi**: Tamu dapat menyusun menu AI dan langsung melihat hasilnya.
* **High-Converting CTA**:
  * Tepat di bawah hasil generate, tampilkan **Aha! Conversion Card**:
    > *"🎉 Suka dengan Rencana Makan Ini? Daftar akun gratis sekarang untuk menerapkan rencana ini ke Planner Mingguan dan menyimpan daftar belanja otomatis!"*
    > [Daftar Akun Gratis (10 Detik)]

---

### 5. Alur Pengguna (User Journey Diagram)

```mermaid
flowchart TD
    A[Pengunjung Membuka CookPlan] --> B[Sesi Anonim/Tamu Dibuat Otomatis]
    B --> C{Jelajahi Aplikasi}
    C -->|1. Generate Menu AI| D["Aha! Moment: Rencana Menu & Belanja AI Jadi"]
    C -->|2. Katalog Resep| E["Aha! Moment: Temukan Resep Hemat & Sehat"]
    C -->|3. Weekly Planner| F["Aha! Moment: Susun Jadwal Makan 7 Hari"]
    C -->|4. Shopping List| G["Aha! Moment: Checklist Belanja Otomatis & Salin ke WA"]
    
    D --> H[Klik 'Simpan / Terapkan ke Planner']
    E --> H[Klik 'Bookmark / Like Resep']
    F --> H[Klik 'Simpan Permanen']
    G --> H[Klik 'Checkout Paket / Simpan List']
    
    H --> I[Modal Registrasi / Auth Modal 10 Detik]
    I --> J[Login / Register 1-Klik Google/Email]
    J --> K[Data Lokal Otomatis Tersimpan ke Server & Sync!]
```

---

### 6. Arsitektur Teknis & Keamanan (Technical Architecture)

1. **Routing (`src/App.jsx`)**:
   * Pindahkan `/planner` dan `/shopping` ke rute `allowAnonymous`:
     `<Route element={<ProtectedRoute allowAnonymous />}>` untuk `/generate`, `/catalog`, `/planner`, dan `/shopping`.
2. **Local Persistence (`src/context/PlanContext.jsx`)**:
   * `PlanContext` sudah mendukung penyimpanan `localStorage` per minggu (`weeklyPlan:YYYY-MM-DD`) secara otomatis saat user belum login / tamu.
3. **Pending Data Sync (`src/pages/AuthPage.jsx`)**:
   * Saat registrasi/login berhasil, data dari `localStorage` & pending action otomatis diimpor ke akun Supabase pengguna tanpa ada data yang hilang.

---

### 7. Rencana Pelaksanaan (Implementation Plan)

- [x] **Tahap 1**: Buat git branch `feature/onboarding-friction-reduction` dan dokumen PRD lengkap.
- [ ] **Tahap 2**: Update `App.jsx` (Buka rute `/planner` & `/shopping` untuk `allowAnonymous`).
- [ ] **Tahap 3**: Update `AppShell.jsx` (Tampilkan navigasi 4-tab penuh & Guest Top Banner).
- [ ] **Tahap 4**: Update `RecipeCatalog.jsx` (Soft-gated modal untuk Save/Like/Add to Plan).
- [ ] **Tahap 5**: Update `GeneratePlan.jsx` & `GenerateResult.jsx` (Conversion card & auto-apply trigger).
- [ ] **Tahap 6**: Update `WeeklyPlanner.jsx` & `ShoppingList.jsx` (Banner edukasi penyimpanan lokal & soft-gated checkout/save).
- [ ] **Tahap 7**: Uji coba komprehensif & commit perubahan.

---
*Dokumen ini disusun untuk mengawal pengembangan CookPlan PKM-K 2026.*
