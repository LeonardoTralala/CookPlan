# Laporan Tinjauan Kode: Setup PWA, Kemampuan Offline, dan Kode Utilitas (CookPlan)

Laporan ini menyajikan analisis mendalam terkait implementasi Progressive Web App (PWA), alur instalasi (*install workflow*), keandalan mode luring (*offline capability*), strategi penembolokan lokal (*local caching*), serta efisiensi kode utilitas (*utility code*) pada aplikasi CookPlan.

---

## Ringkasan Eksekutif

Secara umum, aplikasi CookPlan telah memiliki fondasi PWA yang baik melalui tersedianya berkas manifest yang lengkap (`manifest.webmanifest`), berkas pendukung ikon yang representatif, serta antarmuka ajakan instalasi (`InstallPrompt.jsx`) khusus bagi pengguna Android/Chrome dan iOS Safari. Namun, ditemukan beberapa celah kritis yang dapat merusak pengalaman pengguna saat aplikasi dijalankan dalam kondisi luring (*offline*):

1. **Gagal Muat Halaman Luring (Vite Chunk Error)**: Karena penulisan *service worker* dilakukan secara manual dan hanya meng-precached aset statis dasar, seluruh berkas pemisah JavaScript/CSS hasil build Vite (*code-split chunks*) tidak ter-precache. Menavigasi ke halaman yang belum pernah dikunjungi saat online akan menyebabkan aplikasi mengalami mati total (*crash*) akibat *chunk loading error*.
2. **Ketiadaan Cache Offline untuk Pengguna Login**: Mekanisme penulisan modifikasi slot planner ke `localStorage` dinonaktifkan ketika pengguna berstatus *authenticated* (menggunakan Supabase). Apabila jaringan terputus, pembacaan rencana masak akan gagal dan jatuh pada fallback `localStorage` yang kosong atau usang, sehingga pengguna disajikan kalender rencana kosong.
3. **Deteksi Perangkat iOS Tidak Kompatibel**: Deteksi perangkat iOS menggunakan ekspresi reguler sederhana pada `userAgent` yang gagal mengenali perangkat iPadOS terbaru karena Safari di iPadOS menyamar sebagai perangkat macOS.

---

## Tabel Temuan Masalah

| ID Temuan | Lokasi Berkas & Garis Estimasi | Deskripsi Masalah | Tingkat Kerawanan | Solusi / Potongan Kode Rekomendasi | Rencana Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PWA-01** | [`public/sw.js`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/public/sw.js) | **Gagal Muat Chunk Halaman Saat Offline**: *Service Worker* precache hanya mencakup aset statis statik (`/`, `/manifest.webmanifest`, logo), tidak menyertakan berkas JS/CSS chunks hasil build Vite yang di-lazyload. | **Tinggi (High)** | Integrasikan `@vite-pwa/plugin` pada konfigurasi Vite untuk mengotomatisasi penyusunan manifes precache berkas build atau sesuaikan *cache-first strategy* secara dinamis untuk menangkap `/assets/`. | Tanpa precaching menyeluruh terhadap bundel JS, navigasi SPA berbasis `React.lazy` akan mengalami kegagalan fatal saat memuat berkas JS halaman yang belum ter-cache. |
| **PWA-02** | [`src/context/PlanContext.jsx#L103-L127`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/context/PlanContext.jsx#L103-L127) | **Data Offline Kosong untuk User Login**: Sinkronisasi modifikasi planner ke `localStorage` dilewati bagi pengguna login (langsung dikirim ke Supabase). Fallback saat offline membaca `localStorage` yang kosong/usang. | **Tinggi (High)** | Perbarui `persistSlot` dan `persistRemove` agar selalu menyimpan salinan rencana mingguan ke `localStorage` sebagai cache lokal cadangan (*offline-first cache*). | Memastikan pengguna yang telah masuk akun tetap dapat membaca agenda rencana masaknya saat koneksi internet terputus menggunakan data terakhir yang berhasil disinkronkan. |
| **PWA-03** | [`src/utils/recipes.js#L11-L13`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/utils/recipes.js#L11-L13) & [`index.html#L25`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/index.html#L25) | **URL Aset Gambar Google Usercontent Rawan Kedaluwarsa**: Menggunakan URL langsung Google Photos/AIDA-public yang dibuat dinamis untuk resep unggulan dan banner Open Graph. | **Sedang (Medium)** | Simpan aset gambar dekoratif tersebut secara lokal di `/public/img/` atau unggah ke storage bucket Supabase yang ber-lifetime permanen. | URL sementara hasil rendering AI/Stitch memiliki masa aktif terbatas dan jika kedaluwarsa akan menghasilkan gambar rusak (*broken images*) di halaman awal dan pratinjau tautan sosial media. |
| **UTIL-01** | [`src/utils/shoppingList.js`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/utils/shoppingList.js) & [`src/utils/buildShoppingList.js`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/utils/buildShoppingList.js) | **Duplikasi Utilitas Kalkulasi Daftar Belanja**: Terdapat dua berkas utilitas terpisah untuk menangani pembuatan daftar belanja client-side, yang berisiko memicu inkonsistensi. | **Sedang (Medium)** | Gabungkan logika kedua utilitas ke dalam satu modul utilitas (misal `shoppingList.js`) yang mengadopsi struktur slotting, pengelompokan kategori, dan deduktor pantry secara bersamaan. | Mencegah terjadinya divergensi logika bisnis (*drift*) di masa mendatang serta merapikan struktur file utilitas agar lebih ringkas (*clean code*). |
| **PWA-04** | [`src/components/InstallPrompt.jsx#L15-L18`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/InstallPrompt.jsx#L15-L18) | **Deteksi Perangkat iOS Tidak Kompatibel iPadOS**: iPadOS Safari terbaru menyamar sebagai macOS pada user agent, sehingga mendeteksi iPad sebagai desktop. | **Sedang (Medium)** | Terapkan deteksi iPad berbasis touch points: `(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)` sebagai bagian dari `isIOS()`. | Pengguna iPadOS tidak akan disuguhkan instruksi instalasi manual (Safari Share -> Add to Home Screen) karena terdeteksi sebagai komputer desktop biasa. |
| **PWA-05** | [`src/context/PlanContext.jsx#L77`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/context/PlanContext.jsx#L77) | **Antrian Mutasi Offline Bersifat Volatile**: `pendingRef` disimpan di React `useRef([])` sehingga hilang total apabila halaman direfresh/ditutup sebelum sinkronisasi selesai. | **Sedang (Medium)** | Simpan antrian transaksi yang belum tersinkronisasi (`pendingMutations`) ke `localStorage` dan lakukan pemrosesan ulang (*flush queue*) begitu mendeteksi status *online*. | Menghindari data perubahan hilang ketika pengguna melakukan perubahan jadwal masak saat offline kemudian secara tidak sengaja memuat ulang halaman. |
| **PWA-06** | [`src/components/InstallPrompt.jsx#L8`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/InstallPrompt.jsx#L8) | **Flag Penolakan Banner Permanen**: Klik opsi "Nanti saja" menyimpan status penolakan selamanya di `localStorage` tanpa mekanisme kedaluwarsa. | **Rendah (Low)** | Berikan batas kedaluwarsa waktu (misal disimpan beserta timestamp 7 hari) atau gunakan `sessionStorage` sehingga banner tampil kembali di sesi berikutnya. | Membuka kesempatan bagi pengguna yang sebelumnya menolak, untuk menginstal CookPlan di waktu mendatang saat sudah merasa nyaman memakai aplikasi tanpa harus membersihkan cache browser. |
| **PWA-07** | [`src/components/InstallPrompt.jsx#L67`](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/InstallPrompt.jsx#L67) | **Aksesibilitas (a11y) Gambar & Simbol**: Deskripsi gambar logo kosong (`alt=""`) dan ikon `ios_share` dieja mentah oleh screen reader. | **Rendah (Low)** | Ubah `alt=""` menjadi `alt="Logo CookPlan"` dan sematkan properti `aria-hidden="true"` pada elemen span ikon `ios_share`. | Membantu meningkatkan keramahan aksesibilitas (*screen reader friendliness*) bagi penyandang disabilitas (*assistive technology*). |

---

## Analisis Mendalam & Solusi Kode

### 1. Perbaikan Kegagalan Memuat Chunks (PWA-01)

Untuk mengatasi masalah chunks JS/CSS yang tidak terprecached saat build, strategi terbaik adalah dengan mengonfigurasi generator otomatis seperti `@vite-pwa/plugin`. Namun jika ingin tetap mempertahankan struktur manual `sw.js` agar fleksibel, kita dapat mengubah *service worker* untuk meng-cache aset internal di `/assets/` secara dinamis pada event `fetch`.

Modifikasi pada `public/sw.js` untuk penanganan aset dinamis `/assets/`:

```javascript
// public/sw.js - Tambahan penanganan caching aset assets/ secara aman
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan campur tangan request ke origin lain
  if (url.origin !== self.location.origin) return;

  // Navigasi (SPA) → network-first, fallback ke shell "/" saat offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }

  // Tangani aset dinamis dan statis dari folder assets hasil build Vite
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Karena berkas di assets/ memiliki hash unik (cache-busting otomatis),
        // aman menggunakan Cache-First murni tanpa revalidasi setiap waktu
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Aset statis same-origin dasar lainnya (logo, icon, favicon) -> stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
```

---

### 2. Perbaikan Cache Offline & Antrian Mutasi Pengguna Login (PWA-02 & PWA-05)

Ubah logika `PlanContext.jsx` untuk memastikan data selalu tersimpan di `localStorage` sebagai cache cadangan meskipun pengguna berstatus terautentikasi (*authenticated*), serta menyimpan antrian mutasi offline agar tidak hilang saat reload.

```javascript
// src/context/PlanContext.jsx - Penyesuaian persistSlot & sinkronisasi
const PENDING_MUTATIONS_KEY = 'cookplan_pending_mutations';

// Load awal untuk antrian yang tersimpan di localStorage
const loadPendingMutations = () => {
  try {
    const saved = localStorage.getItem(PENDING_MUTATIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

// ... di dalam PlanProvider ...
  const pendingRef = useRef(loadPendingMutations());

  // Simpan antrian mutasi ke localStorage
  const savePendingMutations = (mutations) => {
    localStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(mutations));
  };

  const persistSlot = useCallback((recipe, day, mealType, servings, nextPlan) => {
    // SELALU tulis ke localStorage untuk cache offline, terlepas dari status login
    localStorage.setItem(localKey(weekStart), JSON.stringify(nextPlan));

    if (isAuthenticated) {
      if (planIdRef.current) {
        planService.setSlot(planIdRef.current, recipe, day, mealType, servings)
          .catch((e) => {
            console.error("setSlot gagal, mengantrekan mutasi:", e.message);
            const nextPending = [...pendingRef.current, { type: "set", recipe, day, mealType, servings, weekStart }];
            pendingRef.current = nextPending;
            savePendingMutations(nextPending);
          });
      } else {
        const nextPending = [...pendingRef.current, { type: "set", recipe, day, mealType, servings, weekStart }];
        pendingRef.current = nextPending;
        savePendingMutations(nextPending);
      }
    }
  }, [isAuthenticated, weekStart]);

  const persistRemove = useCallback((day, mealType, nextPlan) => {
    // SELALU tulis ke localStorage untuk cache offline
    localStorage.setItem(localKey(weekStart), JSON.stringify(nextPlan));

    if (isAuthenticated) {
      if (planIdRef.current) {
        planService.removeSlot(planIdRef.current, day, mealType)
          .catch((e) => {
            console.error("removeSlot gagal, mengantrekan mutasi:", e.message);
            const nextPending = [...pendingRef.current, { type: "remove", day, mealType, weekStart }];
            pendingRef.current = nextPending;
            savePendingMutations(nextPending);
          });
      } else {
        const nextPending = [...pendingRef.current, { type: "remove", day, mealType, weekStart }];
        pendingRef.current = nextPending;
        savePendingMutations(nextPending);
      }
    }
  }, [isAuthenticated, weekStart]);

  // Tambahkan penyimpan otomatis saat fetch online berhasil
  useEffect(() => {
    if (!isAuthenticated) return;
    // Saat berhasil memuat plan dari database (dalam effect muat plan)
    // Tulis ke localStorage:
    // localStorage.setItem(localKey(weekStart), JSON.stringify(plan));
  }, [isAuthenticated, weekStart]);
```

> [!TIP]
> Jalankan sinkronisasi antrian (`flush`) secara otomatis di latar belakang dengan mendengarkan event online:
> ```javascript
> useEffect(() => {
>   const handleOnline = () => {
>     // Trigger fungsi flush pending mutations ke database
>   };
>   window.addEventListener('online', handleOnline);
>   return () => window.removeEventListener('online', handleOnline);
> }, []);
> ```

---

### 3. Perbaikan Deteksi Perangkat iOS Safari (PWA-04)

Ubah deteksi platform iOS agar lebih ramah terhadap perangkat iPadOS yang menggunakan tampilan web desktop-mode:

```javascript
// src/components/InstallPrompt.jsx
function isIOS() {
  const userAgent = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;

  const isIosDevice = /iphone|ipad|ipod/i.test(userAgent);
  const isMaciPad = platform === 'MacIntel' && maxTouchPoints > 1;

  return (isIosDevice || isMaciPad) && !window.MSStream;
}
```

---

### 4. Konsolidasi Redundansi Kode Agregasi (UTIL-01)

Sangat direkomendasikan untuk menghapus salah satu berkas utilitas yang duplikat dan menyatukannya.
Sebagai contoh, struktur `src/utils/shoppingList.js` dapat menaungi seluruh fungsi seperti berikut:
* `buildShoppingList(days, recipeIndex, pantry)`: Menghasilkan daftar belanja bersih untuk mingguan planner (termasuk pengurangan stok rumah / pantry).
* `buildShoppingListFromSlots(slots)`: Menghasilkan daftar belanja untuk halaman paket/belanja instan.
* `CATEGORY_META` dan `CATEGORY_FALLBACK` dideklarasikan di sini agar menjadi satu referensi seragam bagi seluruh komponen UI.
* Hapus file `src/utils/buildShoppingList.js` setelah merujuk semua import ke `src/utils/shoppingList.js`.

---

## Kesimpulan & Langkah Rekomendasi

Aplikasi CookPlan sudah memiliki visualisasi alur PWA yang cantik, namun perlu penguatan di sektor ketahanan offline dan penanganan aset statis:
1. **Langkah Segera**: Ganti URL Google Usercontent yang bersifat sementara dengan aset internal di `/public/img/` agar mencegah terjadinya gambar pecah.
2. **Penguatan Offline**: Terapkan penyimpanan `localStorage` serentak baik untuk pengguna tamu maupun terautentikasi demi keandalan data lokal saat jaringan terputus.
3. **Pembersihan Kode**: Lakukan refaktorisasi pada `shoppingList` utilitas guna mengeliminasi duplikasi kode dan meminimalisir kemungkinan *bug* kalkulasi harga bahan di kemudian hari.
