# 📋 FEATURES.md — Dokumentasi Fitur CookPlan

Dokumen ini menjelaskan seluruh fitur aplikasi CookPlan secara detail untuk skema PKM-K 2026.

> [!IMPORTANT]
> **Status Proyek Saat Ini:** Proyek sedang dalam masa pembangunan ulang (*code rebuild*) dari purwarupa statis HTML lama ke arsitektur modern **React + Supabase**. Status fitur diatur ulang dan diperbarui mengikuti alur fungsional CookPlan versi PKM-K.

---

## Legenda Status

| Badge | Arti |
|-------|------|
| 🔄 **Planned** | Direncanakan untuk diimplementasikan dalam penulisan ulang kode |
| ⚠️ **Partial** | Mulai diimplementasikan secara parsial |
| ✅ **Implemented** | Sudah selesai diimplementasikan penuh pada kode baru |

---

## Fitur 1: Katalog Inspirasi Menu 🔄 Planned

**Modul Aplikasi:** Halaman Utama / Pustaka Resep (React Component)

### Deskripsi
Pengguna dapat menjelajahi koleksi resep masakan khas Indonesia yang tersedia di aplikasi. Setiap kartu resep menampilkan informasi esensial untuk membantu pengguna memilih.

### Spesifikasi Teknis
- **Data source:** Supabase Database (Tabel `recipes`)
- **Rendering:** React Component Client-Side Rendering (`App.jsx`)
- **Filter logic:** React state-driven filtering berdasarkan input pencarian dan filter porsi

### Resep yang Tersedia (Default)
| ID | Nama | Waktu | Estimasi Harga |
|----|------|-------|----------------|
| 1 | Nasi Goreng | 20 menit | ~Rp 35.000 |
| 2 | Soto Ayam | 45 menit | ~Rp 40.000 |
| 3 | Gado-Gado | 30 menit | ~Rp 30.000 |
| 4 | Rendang | 120 menit | ~Rp 55.000 |
| 5 | Bakso | 60 menit | ~Rp 45.000 |
| 6 | Sate Ayam | 40 menit | ~Rp 40.000 |
| 7 | Sayur Asem | 35 menit | ~Rp 25.000 |

### Filter yang Tersedia
| Filter | Input | Cara Kerja |
|--------|-------|------------|
| 🔍 Cari Bahan | Text input | Mencocokkan teks dengan array `ingredients` per resep |
| ⏱️ Waktu Maksimal | Number input (menit) | Filter `readyInMinutes <= maxTime` |
| 💰 Harga Maksimal | Number input | Filter `price <= maxPrice` |

### Informasi per Kartu Resep
- Foto masakan (gambar dari Unsplash)
- Nama resep
- Badge tingkat kesulitan (Easy / Medium / Hard — otomatis dari durasi)
- Estimasi waktu memasak
- Estimasi harga
- Preview 3 bahan utama
- Tombol **Add to Plan**



---

## Fitur 2: Perencanaan Menu Mingguan 🔄 Planned

**Modul Aplikasi Rujukan:** Halaman Utama / Perencana Mingguan (React Component)

### Deskripsi
Fitur untuk menyusun jadwal menu masakan untuk 7 hari ke depan (Senin–Minggu). Pengguna bisa menambahkan, menghapus, atau mengacak ulang rencana masakan kapan saja.

### Spesifikasi Teknis
- **State:** React state `weeklyPlan` yang tersinkronisasi ke database Supabase / localStorage
- **Tampilan:** Grid 7 kolom (responsive: 1 kolom di mobile, 3 di tablet, 7 di desktop)
- **Interaksi:** Modal popup untuk memilih resep dan jumlah porsi

### Sub-Fitur

#### 2a. Tambah Menu ke Kalender
- Dari halaman Recipes → klik **"Add to Plan"** → modal muncul
- Dari halaman Planner → klik ikon `+` pada kartu hari → modal pilih resep
- Modal berisi: dropdown pilih hari, input jumlah porsi (default: 2)

#### 2b. Hapus Menu
- Setiap item di kalender memiliki tombol `X`
- Klik → item terhapus dari state `weeklyPlan[day]` → UI diperbarui

#### 2c. Regenerate Plan (Acak Otomatis)
- Tombol **"Regenerate Plan"** → mengosongkan semua hari
- Memilih 5 resep acak dari `mockRecipes` dan mendistribusikannya ke hari-hari
- Porsi diacak antara 1–3 orang

### Data Structure
```javascript
weeklyPlan = {
  "Senin":  [{ recipeId, title, servings, ingredients[] }],
  "Selasa": [],
  "Rabu":   [...],
  // ... hingga Minggu
}
```

---

## Fitur 3: Daftar Belanja Otomatis 🔄 Planned

**Modul Aplikasi Rujukan:** Halaman Utama / Daftar Belanja (React Component)

### Deskripsi
Sistem secara otomatis mengkonversi rencana menu mingguan menjadi daftar belanja yang terkategorisasi, disesuaikan dengan jumlah porsi.

### Spesifikasi Teknis
- **Trigger:** Tombol "Generate Shopping List" di halaman Planner
- **Algoritma:** Iterasi semua meal di `weeklyPlan`, kumpulkan ingredients, kelompokkan per kategori

### Kategori Bahan
| Kategori | Contoh Bahan |
|----------|--------------|
| 🥬 Vegetables | Bawang merah, bawang putih, cabai, kol, tauge, labu siam |
| 🥩 Meat & Fish | Ayam, daging sapi, bakso |
| 🥚 Dairy & Eggs | Telur, santan |
| 🌶️ Spices | Kunyit, jahe, ketumbar, merica, garam, kecap manis |
| 🌾 Dry Goods | Nasi, bihun, tahu, tempe, tepung, kentang, kacang tanah |

### Fitur Shopping List (Belanja Sendiri)
- **Konsolidasi bahan:** Bahan yang sama dari resep berbeda digabung otomatis.
- **Estimasi biaya:** Total perkiraan biaya mingguan ditampilkan.
- **Check-off:** Checkbox per item → efek strikethrough ketika dicentang (berfungsi sebagai checklist pribadi pengguna saat belanja mandiri di pasar).
- **Simpan Daftar:** Pengguna dapat menyimpan daftar belanja untuk dilihat kembali nanti, namun **tidak membuat pesanan riil** ke database admin.
- **Update List:** Tombol refresh untuk menyinkronkan dengan perubahan planner.
- **Print/Share:** Tombol print dan share tersedia (UI only, belum functional).

---

## Fitur 4: Integrasi Produsen & Distributor Lokal 🔄 Planned

### Deskripsi
Daftar belanja terhubung langsung dengan mitra produsen dan distributor lokal untuk memastikan bahan yang diterima segar dan berkualitas.

### Konsep yang Direncanakan

#### Database Mitra
- Daftar supplier per kategori bahan (sayuran, daging, rempah, dll.)
- Informasi: nama supplier, lokasi, kontak, jadwal tersedia, rating kualitas

#### Alur Integrasi
```
Daftar Belanja → Matching Supplier → Tampilkan Pilihan → Pengguna Konfirmasi → Order
```

#### Tampilan yang Direncanakan
- Setiap item di shopping list dapat di-klik untuk melihat supplier terdekat
- Filter supplier berdasarkan jarak, harga, atau rating
- Badge "✓ Lokal Terverifikasi" pada bahan dari mitra terpercaya

### Kebutuhan Backend
- Database supplier (tabel: `suppliers`, `supplier_categories`, `supplier_availability`)
- API endpoint: `GET /suppliers?category=vegetables&location=lat,lng`
- Integrasi peta (Google Maps API / Mapbox)

---

## Fitur 5: Pengiriman Bahan Masakan (Belanja Lewat CookPlan) 🔄 Planned

### Deskripsi
Layanan kurir yang mengantarkan bahan masakan sesuai paket belanja langsung ke rumah pengguna.

### Konsep yang Direncanakan

#### Alur Pemesanan
```
Belanja Lewat CookPlan → Pilih Paket → Tentukan Alamat & WA (Malang Kota) → Konfirmasi → Pembayaran → Tracking
```

#### Fitur Delivery
- Integrasi dengan kurir pihak ketiga (GoSend, JNE, SiCepat) atau kurir internal
- Penjadwalan pengiriman (same-day / next-day / pilih tanggal)
- Real-time tracking status pengiriman
- Notifikasi WhatsApp/SMS saat bahan tiba

#### Tombol "Checkout & WhatsApp Order Redirect"
> Setelah pengguna memilih paket bahan makanan, tombol Checkout akan memicu navigasi ke halaman pengisian alamat (`OrderPage.jsx`). Halaman ini akan memvalidasi alamat pengiriman agar hanya melayani wilayah **Kota Malang**. Setelah dikonfirmasi, sistem menyimpan detail transaksi ke database Supabase untuk memperoleh **ID Pesanan unik** (misal: `#CP-260527-004`) dan memperbarui alamat profil user untuk auto-fill pesanan selanjutnya. Terakhir, aplikasi me-redirect pengguna ke nomor WhatsApp Admin CookPlan dengan teks pesanan terformat rapi berisi ID Pesanan unik tersebut.

### Kebutuhan Backend (Supabase Integration)
- Tabel: `orders` (menyimpan ID pesanan, ID user, total harga, alamat, dan metode pembayaran).
- Tabel: `order_items` (menyimpan daftar bahan makanan spesifik yang dibeli per transaksi).
- Integrasi Midtrans Sandbox untuk simulasi pembayaran profesional pada juri Monev.

---

## Fitur 6: Pengingat Ketahanan Bahan 🔄 Planned

### Deskripsi
Sistem notifikasi untuk mengingatkan pengguna tentang stok bahan yang tersisa dan batas waktu penyimpanan agar bahan tidak terbuang sia-sia.

### Konsep yang Direncanakan

#### Tipe Pengingat
| Pengingat | Trigger | Channel |
|-----------|---------|---------|
| Stok hampir habis | Item di shopping list < ambang batas | Push notification / email |
| Bahan mendekati expired | H-2 dari tanggal kadaluarsa | Push notification |
| Saatnya masak hari ini | Sesuai jadwal planner | Push notification pagi |
| Belum belanja padahal ada plan | H-1 sebelum jadwal masak | Push notification |

#### Input Data Pengguna
- Pengguna mencatat stok bahan yang sudah dibeli beserta tanggal beli
- Sistem mengkalkulasi estimasi ketahanan berdasarkan jenis bahan (data dari database)

#### Database Ketahanan Bahan (Referensi)
| Bahan | Suhu Ruang | Kulkas | Freezer |
|-------|-----------|--------|---------|
| Ayam segar | 2 jam | 2 hari | 9 bulan |
| Sayuran hijau | 1 hari | 3–5 hari | 1 bulan |
| Bawang merah | 2 minggu | 1 bulan | — |
| Telur | 2 minggu | 1 bulan | — |

### Kebutuhan Backend
- Tabel: `user_pantry`, `ingredient_shelf_life`
- Cron job atau scheduled function untuk trigger notifikasi
- Push notification via Firebase Cloud Messaging (FCM)
- Web Push API untuk browser notification

---

## Fitur Pendukung

### Autentikasi Supabase 🔄 Planned
- Registrasi dan Login pengguna menggunakan **Supabase Auth** (email & password).
- Penyimpanan data sesi pengguna secara persisten agar tidak ter-logout saat halaman di-refresh.
- User State Management: Menampilkan profil pengguna dan riwayat transaksi belanja yang tersinkronisasi di server.
- Fitur Logout.

### Landing Page 🔄 Planned
- Hero section dengan simulasi drag-and-drop visual
- FAQ accordion interaktif
- Responsive design (mobile-friendly)
- Smooth scroll navigation

---

*Dokumen ini harus diperbarui setiap kali ada fitur baru yang diimplementasikan.*
