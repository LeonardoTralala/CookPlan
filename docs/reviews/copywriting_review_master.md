# Master Laporan Tinjauan Copywriting & UX Writing
## CookPlan — PIMNAS 2026

Laporan ini menyajikan hasil peninjauan menyeluruh terhadap kualitas bahasa, kegunaan (*UX writing*), peningkatan konversi (*CRO*), serta ejaan tata bahasa Indonesia di seluruh berkas proyek **CookPlan**. Peninjauan ini dilakukan secara bersamaan oleh 3 sub-agent yang berfokus pada alur pengguna yang berbeda:
1. **Landing Page & Auth Flow**
2. **Core Planner & Onboarding Flow**
3. **E-Commerce, Support & Legal Docs**

---

## 1. Temuan Kritis Utama (Critical Findings)

### 🚨 Isu Konversi & UX Kritis (Halaman Sukses Belanja)
* **Temuan**: Pada [OrderSuccess.jsx](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/OrderSuccess.jsx#L105), judul utama halaman bertuliskan **"Pesanan Tersimpan"**.
* **Masalah**: Pengguna dapat mengira pesanan mereka sudah selesai diproses. Padahal, pesanan tersebut baru tersimpan secara lokal dan pengguna **wajib** mengeklik tombol **"Buka WhatsApp"** untuk meneruskan rincian belanja ke admin.
* **Rekomendasi**: Ubah judul utama menjadi **"Tinggal Satu Langkah Lagi!"** atau **"Kirim Pesananmu Sekarang"** dan ubah tombol aksi dari *"Buka WhatsApp"* menjadi *"Kirim via WhatsApp"* untuk mendesak penyelesaian transaksi.

### 🐛 Bug Teknis Gambar Rusak (Broken Image)
* **Temuan**: Pada berkas profil tim [TeamProfile.jsx](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/TeamProfile.jsx#L12), terdapat kesalahan penulisan spasi pada jalur gambar untuk Direktur Utama:
  ```javascript
  image: '/foto/al .jpeg'
  ```
* **Masalah**: Spasi sebelum ekstensi `.jpeg` akan mengakibatkan gambar gagal dimuat (*broken image*) pada peramban web.
* **Rekomendasi**: Ubah segera menjadi `'/foto/al.jpeg'`.

---

## 2. Pola Masalah Kebahasaan yang Ditemukan (Common Themes)

### A. Inkonsistensi Kata Ganti Orang Kedua (*Kamu* vs. *Anda*)
Terdapat pencampuran gaya sapaan pengguna di berbagai berkas:
* **"kamu" / "-mu"** digunakan di: Landing Page (Hero, WhyCookPlan, FinalCTA), Onboarding, GeneratePlan, dan Feedback.
* **"Anda" / "anda"** digunakan di: HowItWorks, WeeklyPlanner, RecipeCatalog, HelpCenter, dan TeamProfile.
* **Rekomendasi**: Seragamkan seluruh sapaan non-legal menjadi **"kamu"** dan **"-mu"** agar memberikan kesan asisten dapur pribadi yang hangat, ramah, dan cocok dengan target audiens mahasiswa/kaum muda. Sapaan **"Anda"** hanya boleh digunakan secara ketat pada dokumen legal ([TermsOfService.jsx](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/TermsOfService.jsx) & [PrivacyPolicy.jsx](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/PrivacyPolicy.jsx)).

### B. Kepatuhan EYD V & Bahasa Baku untuk Juri PKM/PIMNAS
Sebagai proyek yang diajukan untuk Program Kreativitas Mahasiswa (PKM) tingkat nasional, kerapian bahasa sangat krusial dalam penilaian juri.
1. **Pembersihan Kata Slang**: Ubah kata tidak baku pada percakapan/petunjuk input seperti *"pengen"* $\rightarrow$ *"ingin"*, *"gimana"* $\rightarrow$ *"bagaimana"*, *"aja"* $\rightarrow$ *"saja"*, dan *"buat"* (sebagai kata depan) $\rightarrow$ *"untuk"*.
2. **Huruf Kapital Tengah Kalimat**: Koreksi penulisan kata ganti *"Kami"* dan *"Kamu"* yang ditulis kapital di tengah kalimat (misalnya pada kalimat penawaran paket di `GeneratePlan.jsx`). Berdasarkan EYD, kedua kata tersebut harus ditulis dengan huruf kecil jika berada di tengah kalimat.
3. **Penyelarasan Istilah Asing (Indolish)**: 
   * Istilah asing seperti *budget* diterjemahkan menjadi **anggaran**.
   * Istilah *supplier* diterjemahkan menjadi **pemasok**.
   * Istilah *food waste* diterjemahkan menjadi **sampah makanan** (atau dicetak miring jika dipertahankan).
   * Istilah *generate plan* diterjemahkan menjadi **susun rencana** atau **buat menu**.

---

## 3. Laporan Rinci Sub-Agent

Untuk melihat daftar perbaikan kata demi kata beserta baris kode yang spesifik, Anda dapat membuka laporan individual masing-masing sub-agent di bawah ini:

* 📄 **Laporan 1 (Landing Page & Autentikasi)**:  
  [review_landing_page.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/2c02bc7a-6204-438a-beb7-7d218fda8ee4/review_landing_page.md)
* 📄 **Laporan 2 (Core Planner & Onboarding)**:  
  [review_core_planner.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/f633173b-fa0f-432e-b5af-e7ced492c354/review_core_planner.md)
* 📄 **Laporan 3 (E-Commerce & Support)**:  
  [review_support_ecommerce.md](file:///C:/Users/Zilfi%20Alvin/.gemini/antigravity-cli/brain/73a7636c-feee-4db5-8ecb-59bb4973352b/review_support_ecommerce.md)

---

## 4. Rencana Aksi Selanjutnya (Next Steps)

Silakan tentukan langkah yang Anda inginkan:
1. **Perbaikan Bug Gambar**: Segera perbaiki kesalahan penulisan spasi pada [TeamProfile.jsx](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/TeamProfile.jsx#L12).
2. **Penerapan Copywriting Secara Otomatis**: Saya dapat memperbarui teks-teks antarmuka pada berkas JSX proyek Anda sesuai dengan rekomendasi di atas.
3. **Penyelarasan Selektif**: Beri tahu saya jika ada beberapa istilah atau gaya bahasa yang ingin Anda pertahankan (misalnya tetap menggunakan istilah bahasa Inggris tertentu).
