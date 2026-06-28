# Laporan Review Panel Admin CookPlan

**Tanggal Review:** 27 Juni 2026  
**Fokus Review:** Konsistensi Copywriting (Bahasa Indonesia EYD V), Alur UX & Interaktivitas, Keamanan, serta Manajemen Layout  

---

## 1. Ringkasan Eksekutif (Executive Summary)

Secara keseluruhan, fungsionalitas panel admin CookPlan sudah terintegrasi dengan baik antara basis data Supabase (melalui RLS) dan antarmuka pengguna React. Admin dapat mengelola resep, bahan baku, paket belanja, pesanan WhatsApp, hingga penyedia layanan AI.

Namun, ditemukan beberapa **isu kritis pada alur UX** yang mengganggu operasional pengisian data oleh admin secara signifikan, serta beberapa **inkonsistensi copywriting** yang kurang profesional dalam Bahasa Indonesia (EYD V). 

### Temuan Utama:
1. **Bug Kritis Input Teks (Cursor Jump) (High)**: Admin tidak dapat menekan tombol "Enter" untuk menambah baris baru pada langkah instruksi resep, dan tidak dapat mengetik tanda koma (`,`) untuk memisahkan tag/badge. Hal ini terjadi karena manipulasi array secara langsung pada event `onChange`.
2. **Kesalahan Makna Kata "Belum Berharga" (Medium)**: Kata "berharga" (bernilai tinggi/precious) digunakan untuk menerjemahkan status bahan baku yang belum memiliki nilai harga di database (*unpriced*). Hal ini membuat kalimat di UI menjadi tidak logis (misalnya *"bahan belum berharga"* yang berarti *"bahan tidak bernilai/worthless"*).
3. **Kerentanan Keamanan Kunci API (API Key) (Medium)**: Kunci API untuk penyedia AI ditampilkan dalam bentuk teks polos (*plaintext*) pada halaman daftar penyedia AI, berisiko terhadap kebocoran informasi (*shoulder surfing*).
4. **Duplikasi Kode Gating Admin (Medium)**: Logika pengecekan otorisasi admin (`checkIsAdmin`) diduplikasi di setiap file halaman admin, alih-alih disatukan di dalam router guard atau `AdminLayout.jsx`.

---

## 2. Tabel Temuan Utama (Table of Findings)

| ID | Lokasi File & Perkiraan Baris | Deskripsi Masalah | Rerata Dampak (Severity) | Rekomendasi Solusi / Perbaikan Kode | Rasionale / Dampak UX |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | [RecipeManager.jsx:L604-611](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/RecipeManager.jsx#L604-L611) | **Bug Cursor Jump pada Instruksi**: Penggunaan `.filter(Boolean)` pada event `onChange` menghapus baris kosong secara instan saat admin menekan tombol *Enter*. Akibatnya, baris baru terhapus secara otomatis dan kursor melompat kembali ke baris sebelumnya. | **High** | Simpan input langkah sebagai satu string teks biasa dalam state form (`instructionsText`), dan pisahkan menggunakan `.split('\n')` hanya saat data akan dikirim ke API Supabase. | Admin tidak dapat mengetik langkah memasak multi-baris secara natural di dalam aplikasi jika bug ini tidak diperbaiki. |
| **F-02** | [RecipeManager.jsx:L598-603](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/RecipeManager.jsx#L598-L603)<br>[PackageManager.jsx:L305-307](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/PackageManager.jsx#L305-L307) | **Bug Input Tag & Badge**: Penggunaan fungsi `splitCsv()` langsung pada `onChange` membuat tanda koma (`,`) yang baru diketik langsung dihapus oleh filter data kosong, sehingga admin tidak bisa mengetik koma untuk menambah tag/badge baru. | **High** | Ubah tipe state untuk input tag/badge menjadi string sementara (misal `tagsInput`), lalu jalankan fungsi `splitCsv` hanya pada event `onBlur` atau saat tombol *Simpan* ditekan. | Admin tidak bisa memisahkan tag atau badge secara manual menggunakan koma kecuali dengan cara menempel (*paste*) teks yang sudah jadi. |
| **F-03** | [IngredientManager.jsx:L185](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/IngredientManager.jsx#L185), [L198](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/IngredientManager.jsx#L198), [L217](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/IngredientManager.jsx#L217)<br>[RecipeManager.jsx:L67](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/RecipeManager.jsx#L67), [L98](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/RecipeManager.jsx#L98), [L621](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/RecipeManager.jsx#L621) | **Copywriting Tidak Sesuai Makna ("Belum Berharga")**: Istilah *"belum berharga"* digunakan untuk mengindikasikan bahan yang belum diisi nominal harganya. Dalam Bahasa Indonesia, "berharga" berarti "valuable/precious", bukan "priced". | **Medium** | Ganti teks `"belum berharga"` menjadi `"belum memiliki harga"`, `"belum diatur harganya"`, atau `"harga belum diisi"`. | Menghindari kerancuan bahasa dan menjaga profesionalisme komunikasi antarmuka (UI). |
| **F-04** | [AIProviders.jsx:L120](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/AIProviders.jsx#L120) | **Kunci API Tampil Polos (Plaintext)**: Kunci API sensitif untuk model AI ditampilkan secara terbuka di halaman daftar penyedia AI. | **Medium** | Terapkan sensor penyamaran (*masking*), misalnya:<br>`key: {p.api_key ? '••••••••' : '(kosong)'}` atau tampilkan 4 karakter terakhir saja. | Mencegah kebocoran kunci API secara tidak sengaja melalui tangkapan layar (*screenshot*) atau pengintaian layar (*shoulder surfing*). |
| **F-05** | Semua file halaman di `src/pages/admin/` | **Duplikasi Kode Gating Admin**: Logika otentikasi admin (`checkIsAdmin()`) beserta tampilan loading spinner dan layar kunci (*lock screen*) diduplikasi di 7 halaman admin berbeda. | **Medium** | Satukan logika otorisasi tersebut ke dalam komponen `AdminLayout.jsx` atau buat pembungkus rute khusus (`AdminRoute.jsx`). Jika user bukan admin, langsung lakukan *redirect* atau tampilkan layar kunci secara terpusat. | Mematuhi prinsip DRY (*Don't Repeat Yourself*), menyederhanakan kode halaman admin, dan mempermudah pemeliharaan sistem otentikasi di masa mendatang. |
| **F-06** | [IngredientManager.jsx:L289](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/IngredientManager.jsx#L289) | **Copywriting Terlalu Kasual / Bahasa Gaul**: Kalimat instruksi menggunakan kata *"nempel"* (gaul untuk menempel/terhubung) dan *"bikin"* (informal untuk membuat). | **Low** | Ubah kalimat menjadi lebih formal (EYD V):<br>*"Saat resep menggunakan nama tersebut, resep otomatis terhubung ke bahan ini (sehingga tidak membuat data ganda)."* | Menjaga konsistensi tone bahasa profesional (Bahasa Indonesia baku) pada sistem manajemen internal. |
| **F-07** | [AIProviders.jsx:L6-L10](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/AIProviders.jsx#L6-L10), [L135-L163](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/pages/admin/AIProviders.jsx#L135-L163) | **Kolom Form Hilang**: Variabel `EMPTY_PROVIDER` mendefinisikan field `estimated_latency_seconds` dan `notes`, tetapi tidak ada input kontrol untuk kedua field tersebut di modal form tambah/edit. | **Low** | Tambahkan elemen `<AdminInput>` untuk latency dan notes di dalam modal form agar data tersebut dapat diisi atau diperbarui oleh admin. | Menghindari data yang tersembunyi (*hidden state*) yang tidak bisa diakses/diedit oleh pengguna secara visual. |
| **F-08** | Semua dialog hapus pada halaman admin | **Penggunaan Dialog Konfirmasi Bawaan Browser**: Tombol hapus memicu fungsi `confirm()` bawaan browser. | **Low** | Buat komponen modal konfirmasi kustom menggunakan Tailwind CSS yang selaras dengan tema CookPlan. | Dialog bawaan browser merusak estetika UI modern dan menghentikan eksekusi thread JavaScript (sinkron). |

---

## 3. Detail Rekomendasi Perbaikan Kode

### 1. Perbaikan Bug Cursor Jump di `RecipeManager.jsx`
Untuk mengatasi bug saat mengetik instruksi dan tag/badge, kita perlu menggunakan state string terpisah di dalam form dialog editing.

#### Perubahan pada State Pengeditan Resep:
```javascript
// Saat membuka form tambah (openCreate):
setEditing({
  ...EMPTY_RECIPE,
  instructionsText: '', // State lokal berupa string untuk textarea
  tagsText: '',         // State lokal berupa string untuk input tag
  badgesText: '',       // State lokal berupa string untuk input badge
});

// Saat membuka form edit (openEdit):
setEditing({
  ...EMPTY_RECIPE,
  ...r,
  instructionsText: (r.instructions ?? []).join('\n'),
  tagsText: (r.tags ?? []).join(', '),
  badgesText: (r.badges ?? []).join(', '),
});
```

#### Perubahan pada UI Input:
```jsx
// Ganti input instruksi:
<textarea
  value={editing.instructionsText}
  onChange={(e) => setField('instructionsText', e.target.value)}
  rows={4}
  className="..."
/>

// Ganti input tags:
<TextInput 
  value={editing.tagsText} 
  onChange={(v) => setField('tagsText', v)} 
  placeholder="halal, tinggi-protein" 
/>
```

#### Perubahan saat Menyimpan Data (`handleSave`):
```javascript
const patch = {
  title: editing.title.trim(),
  // ... field lainnya ...
  instructions: editing.instructionsText.split('\n').map(s => s.trim()).filter(Boolean),
  tags: editing.tagsText.split(',').map(s => s.trim()).filter(Boolean),
  badges: editing.badgesText.split(',').map(s => s.trim()).filter(Boolean),
  isActive: editing.isActive,
};
```

---

### 2. Sentralisasi Otorisasi Admin di `AdminLayout.jsx`
Alih-alih mengulang kode pengecekan otentikasi di 7 file halaman admin, lakukan sentralisasi di `AdminLayout.jsx` agar lebih ringkas dan konsisten secara UX.

```jsx
// src/components/AdminLayout.jsx
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { checkIsAdmin } from '../services/adminService.js';

const ADMIN_TABS = [ /* ... tetap sama ... */ ];

export function AdminLayout({ children }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // 'checking' | 'allowed' | 'denied'

  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => {
      if (active) {
        setStatus(ok ? 'allowed' : 'denied');
      }
    });
    return () => { active = false; };
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-4">lock</span>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Khusus Admin</h1>
        <p className="text-on-surface-variant text-sm mb-6">Halaman ini hanya untuk admin CookPlan.</p>
        <button 
          onClick={() => navigate('/generate')} 
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-outline-variant/40 bg-surface-container-lowest">
        <nav aria-label="Navigasi admin" className="max-w-3xl mx-auto px-5 md:px-10">
          <div className="flex gap-1 overflow-x-auto hide-scrollbar -mb-px">
            {ADMIN_TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3.5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-primary'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{tab.icon}</span>
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
      {children}
    </>
  );
}
```

**Dampak Perubahan:** 
Dengan memindahkan gating otorisasi ke `AdminLayout`, kita dapat menghapus sekitar ~30 baris kode logika loading/gating dari masing-masing 7 file halaman admin, menyisakan kode UI murni untuk manajemen fitur.

---

## 4. Evaluasi Copywriting Sesuai EYD V

Berikut adalah tabel pemetaan kata-kata non-standar/kurang konsisten yang ditemukan di dalam kode admin panel beserta rekomendasi perbaikannya:

| Kata dalam Kode | Rekomendasi EYD V / Istilah Baku | Konteks Penggunaan | Rationale |
| :--- | :--- | :--- | :--- |
| `fiks` / `menu fiks` | `tetap` / `menu tetap` | Halaman kelola paket belanja. | "Fiks" adalah kata cakapan tidak baku. Istilah baku yang tepat adalah "tetap". |
| `belum berharga` | `belum memiliki harga` | Menunjukkan bahan yang kolom `pricePerBase`-nya `null`. | Kata "berharga" berarti bernilai tinggi (*valuable*). Ini adalah kesalahan semantik yang fatal. |
| `nempel` | `terhubung` / `dipetakan` | Penjelasan mengenai relasi alias bahan baku. | Kata cakapan tidak baku, harus menggunakan bahasa formal. |
| `bikin` | `membuat` / `memproduksi` | Penjelasan pembuatan master ganda. | Kata cakapan tidak baku. |
| `live` | `langsung` / `seketika` | Teks indikator perhitungan biaya. | Menggunakan padanan kata bahasa Indonesia yang sesuai. |
| `AI Provider` / `Provider AI` | `Penyedia AI` | Nama halaman dan tab navigasi. | Konsistensi penggunaan istilah bahasa Indonesia untuk seluruh elemen menu. |
| `key` | `kunci` | Teks penjelasan slug paket atau API key. | Padanan istilah teknis dalam bahasa Indonesia. |
| `mis.` | `misalnya` | Singkatan penjelasan contoh konversi bahan. | Menghindari penggunaan singkatan di dalam teks instruksi UI agar lebih mudah dibaca. |
| `order plan` | `pemesanan rencana makan` | Deskripsi di dasbor admin pesanan. | Mengganti istilah asing campuran menjadi bahasa Indonesia terpadu. |
