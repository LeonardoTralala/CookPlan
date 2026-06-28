# Laporan Review Aksesibilitas (a11y) & Struktur Semantik

Laporan ini meninjau aspek aksesibilitas, kegunaan navigasi keyboard, struktur semantik HTML, serta kecocokan pembaca layar (screen reader) pada komponen UI utama CookPlan.

---

## Ringkasan Eksekutif

Secara keseluruhan, komponen CookPlan telah menerapkan dasar-dasar aksesibilitas dengan cukup baik, seperti penggunaan tag semantik `<header>`, `<nav>`, dan `<footer>`, dukungan untuk preferensi animasi (`prefers-reduced-motion`), serta fungsionalitas jebakan fokus (*focus trap*) dasar pada modal. Namun, terdapat beberapa celah aksesibilitas tingkat menengah (*medium*) dan rendah (*low*) yang perlu diperbaiki untuk memastikan pengalaman pengguna yang inklusif, terutama bagi pengguna keyboard-only dan pembaca layar (*screen reader*).

### Temuan Utama:
1. **Penyatuan Elemen Backdrop & Konten Modal (Medium):** Baik `Modal.jsx` maupun `ModalSheet.jsx` membungkus panel dialog di dalam div backdrop yang memiliki penanganan klik (`onClick`). Struktur sarang (*nested*) ini memicu peringatan interaksi elemen statis (`jsx-a11y`) dan dapat membingungkan pembaca layar.
2. **Ketiadaan Hubungan ARIA (`aria-labelledby`/`describedby`) di `Modal.jsx` (Medium):** Kontainer dialog pada `Modal` tidak terhubung dengan judul atau deskripsi di dalamnya, sehingga pembaca layar tidak akan membacakan konteks modal saat pertama kali terbuka.
3. **Navigasi Ganda Tanpa Label Unik di `AppShell.jsx` (Low):** Terdapat dua elemen `<nav>` (desktop dan mobile) yang dapat membingungkan pengguna pembaca layar karena tidak dibedakan secara eksplisit menggunakan `aria-label`.
4. **Ketiadaan Tautan Pintasan (*Skip Link*) (Low):** Pengguna keyboard harus menelusuri seluruh menu navigasi berulang kali sebelum dapat mengakses konten utama halaman.

---

## Tabel Temuan Audit

| ID | Berkas & Lokasi | Deskripsi Masalah | Keparahan | Rekomendasi Solusi | Rasional |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A11Y-01** | [Modal.jsx:L70-84](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/Modal.jsx#L70-L84)<br>[ModalSheet.jsx:L85-111](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/ModalSheet.jsx#L85-L111) | Panel dialog bersarang di dalam elemen backdrop interaktif (`onClick={onClose}`). Menyebabkan peringatan linting `jsx-a11y/no-static-element-interactions`. | **Medium** | Pisahkan elemen backdrop overlay dan panel dialog sebagai elemen bersaudara (*siblings*). Setel backdrop dengan `aria-hidden="true"`. | Menghilangkan peringatan linting, menyederhanakan CSS, serta mencegah pembaca layar mendeteksi backdrop sebagai elemen interaktif yang membingungkan. |
| **A11Y-02** | [Modal.jsx:L79-81](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/Modal.jsx#L79-L81) | Komponen `Modal` memiliki `role="dialog"` dan `aria-modal="true"`, tetapi tidak mendukung prop `labelledBy` atau `describedBy`. | **Medium** | Tambahkan prop `labelledBy` dan `describedBy`, lalu hubungkan ke judul (`<h2>`) dan deskripsi (`<p>`) di dalam modal. | Memungkinkan pembaca layar langsung membacakan judul modal (misalnya "Keluar dari akun?") begitu modal terbuka. |
| **A11Y-03** | [AppShell.jsx:L65](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/AppShell.jsx#L65)<br>[AppShell.jsx:L157](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/AppShell.jsx#L157) | Terdapat dua elemen navigasi `<nav>` utama pada satu halaman tanpa penamaan yang membedakan keduanya secara jelas. | **Low** | Berikan `aria-label` yang spesifik untuk masing-masing `<nav>`. | Membantu pengguna pembaca layar membedakan menu navigasi desktop dan mobile dengan mudah saat bernavigasi. |
| **A11Y-04** | [AppShell.jsx:L20](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/AppShell.jsx#L20) | Tidak ada tautan pintas (*skip link*) ke konten utama halaman pada awal struktur dokumen. | **Low** | Tambahkan tautan "Lompati ke Konten Utama" sebagai elemen fokus pertama di dalam `AppShell`. | Menghemat waktu pengguna keyboard (keyboard-only) agar tidak perlu menekan tombol `Tab` berulang kali melewati menu navigasi. |
| **A11Y-05** | [AppShell.jsx:L84-88](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/AppShell.jsx#L84-L88)<br>[AppShell.jsx:L177-181](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/AppShell.jsx#L177-L181) | Badge angka menu belanjaan (`plannedCount`) dibaca secara mentah sebagai angka tanpa konteks oleh pembaca layar. | **Low** | Gunakan teks khusus untuk pembaca layar dengan kelas `sr-only` dan sembunyikan angka visual menggunakan `aria-hidden="true"`. | Menghindari kebingungan pembaca layar yang hanya membacakan teks "Belanja 3" menjadi "Belanja, 3 menu direncanakan". |
| **A11Y-06** | [Modal.jsx:L40-42](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/Modal.jsx#L40-L42) | Selektor elemen fokus pada `Modal.jsx` tidak mengecualikan elemen yang dinonaktifkan (`disabled`), berbeda dengan `ModalSheet.jsx`. | **Low** | Selaraskan selektor elemen fokus agar mengecualikan `:not([disabled])`. | Mencegah jebakan fokus mencoba memfokuskan tombol/input yang sedang tidak aktif (*disabled*). |
| **A11Y-07** | [Footer.jsx:L14-32](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/components/Footer.jsx#L14-L32) | Daftar tautan footer dirender hanya menggunakan div fleksibel tanpa penanda daftar semantik (`<ul>`/`<li>`). | **Low** | Bungkus daftar tautan ke dalam tag `<nav>` dengan daftar tak berurut (`<ul>` dan `<li>`). | Membantu pembaca layar mengumumkan jumlah item tautan di footer sebagai satu daftar terstruktur. |
| **A11Y-08** | Semua Komponen | Ketiadaan indikator fokus visual kustom (*focus ring*) yang konsisten pada elemen-elemen interaktif (tautan & tombol). | **Low / Medium** | Terapkan kelas fokus kustom seperti `focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-offset-2`. | Memastikan indikator fokus terlihat jelas bagi pengguna keyboard di semua peramban (*browsers*), sesuai panduan WCAG 2.4.7. |

---

## Rekomendasi Perbaikan & Detail Kode

### 1. Perbaikan Desain Sibling untuk Backdrop (`Modal.jsx` & `ModalSheet.jsx`)
Nesting konten dialog di dalam backdrop yang memiliki *click handler* dapat memicu interaksi yang tidak diinginkan dan melanggar aturan semantik aksesibilitas.

> [!TIP]
> Dengan menggunakan relasi *sibling* (bersaudara) di bawah kontainer *relative*, kita tidak memerlukan `e.stopPropagation()` pada panel dialog.

#### Contoh Perbaikan pada `Modal.jsx`:
```diff
   if (!isOpen) return null;
 
   return (
-    <div 
-      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-surface/60 backdrop-blur-sm animate-fade-in"
-      onClick={onClose}
-    >
-      <div 
-        ref={modalRef}
-        tabIndex={-1}
-        className="w-full flex justify-center outline-none max-h-full"
-        onClick={(e) => e.stopPropagation()}
-        role="dialog"
-        aria-modal="true"
-      >
-        {children}
-      </div>
-    </div>
+    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
+      {/* Backdrop overlay */}
+      <div 
+        className="absolute inset-0 bg-on-surface/60 backdrop-blur-sm animate-fade-in"
+        onClick={onClose}
+        aria-hidden="true"
+      />
+      {/* Dialog container */}
+      <div 
+        ref={modalRef}
+        tabIndex={-1}
+        className="relative z-10 w-full flex justify-center outline-none max-h-full"
+        role="dialog"
+        aria-modal="true"
+        aria-labelledby={labelledBy}
+        aria-describedby={describedBy}
+      >
+        {children}
+      </div>
+    </div>
   );
```

### 2. Implementasi Hubungan Judul Dialog (`Modal.jsx`)
Perbarui definisi fungsi `Modal` untuk menerima `labelledBy` dan `describedBy` guna memenuhi kepatuhan WCAG terhadap komponen Dialog (`role="dialog"`).

```diff
-export function Modal({ isOpen, onClose, children }) {
+export function Modal({ isOpen, onClose, children, labelledBy, describedBy }) {
```

Lalu terapkan properti tersebut pada pemicunya di `AppShell.jsx` untuk dialog konfirmasi keluar:
```diff
-      <Modal isOpen={confirmOpen} onClose={() => !signingOut && setConfirmOpen(false)}>
-        <div className="w-full max-w-sm bg-canvas-white rounded-3xl p-6 shadow-xl">
-          <div className="flex flex-col items-center text-center gap-1">
-            <span className="material-symbols-outlined text-error text-[32px] mb-1" aria-hidden="true">logout</span>
-            <h2 className="text-lg font-bold text-on-surface">Keluar dari akun?</h2>
-            <p className="text-sm text-on-surface-variant">
-              Kamu perlu masuk lagi untuk mengakses rencana menumu.
-            </p>
-          </div>
+      <Modal 
+        isOpen={confirmOpen} 
+        onClose={() => !signingOut && setConfirmOpen(false)}
+        labelledBy="logout-dialog-title"
+        describedBy="logout-dialog-desc"
+      >
+        <div className="w-full max-w-sm bg-canvas-white rounded-3xl p-6 shadow-xl">
+          <div className="flex flex-col items-center text-center gap-1">
+            <span className="material-symbols-outlined text-error text-[32px] mb-1" aria-hidden="true">logout</span>
+            <h2 id="logout-dialog-title" className="text-lg font-bold text-on-surface">Keluar dari akun?</h2>
+            <p id="logout-dialog-desc" className="text-sm text-on-surface-variant">
+              Kamu perlu masuk lagi untuk mengakses rencana menumu.
+            </p>
+          </div>
```

### 3. Penambahan Skip to Content Link (`AppShell.jsx`)
Tautkan pemintas navigasi langsung ke elemen `<main id="main-content">` di paling atas halaman:

```diff
   return (
     <div className="min-h-dvh flex flex-col bg-canvas-white text-on-surface antialiased">
+      {/* Skip to Content Link */}
+      <a 
+        href="#main-content" 
+        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-[100] bg-primary text-on-primary px-4 py-2 rounded-full font-semibold outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
+      >
+        Lompati ke Konten Utama
+      </a>
+
       {/* Top nav (desktop) */}
```

### 4. Labeling Unik pada Navigasi (`AppShell.jsx`)
Bedakan navigasi atas (desktop) dan navigasi bawah (mobile):

*   **Navigasi Desktop:**
    ```diff
    -      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-canvas-white/95 backdrop-blur-md">
    -        <nav className="max-w-container-max mx-auto flex items-center justify-between px-margin-mobile md:px-margin-desktop py-3">
    +      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-canvas-white/95 backdrop-blur-md">
    +        <nav aria-label="Navigasi utama desktop" className="max-w-container-max mx-auto flex items-center justify-between px-margin-mobile md:px-margin-desktop py-3">
    ```

*   **Navigasi Mobile (sudah berlabel tetapi diselaraskan):**
    ```diff
    -      <nav
-        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-canvas-white/95 backdrop-blur-md border-t border-outline-variant/30 pb-safe-2"
-        aria-label="Navigasi utama"
-      >
+      <nav
+        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-canvas-white/95 backdrop-blur-md border-t border-outline-variant/30 pb-safe-2"
+        aria-label="Navigasi utama mobile"
+      >
    ```

### 5. Peningkatan Deskripsi Badge Rencana Belanja (`AppShell.jsx`)
Agar pembaca layar membacakan dengan informasi kontekstual:

```diff
                 {item.to === '/shopping' && plannedCount > 0 && (
                   <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-error text-white text-[10px] font-bold">
-                    {plannedCount}
+                    <span className="sr-only">, {plannedCount} menu direncanakan</span>
+                    <span aria-hidden="true">{plannedCount}</span>
                   </span>
                 )}
```

### 6. Struktur Semantik Footer (`Footer.jsx`)
Mengubah kumpulan link div sederhana menjadi daftar semantik ber-tag `<nav>`:

```diff
-        <div className="flex flex-wrap justify-center gap-6 md:gap-8">
-          {links.map((label) => {
-            let toPath = "/";
-            if (label === "Tentang Kami") toPath = "/about";
-            else if (label === "Bantuan") toPath = "/help";
-            else if (label === "Kebijakan Privasi") toPath = "/privacy";
-            else if (label === "Syarat dan Ketentuan") toPath = "/terms";
-
-            return (
-              <Link
-                key={label}
-                to={toPath}
-                className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer inline-flex items-center py-3"
-              >
-                {label}
-              </Link>
-            );
-          })}
-        </div>
+        <nav aria-label="Informasi Tambahan" className="flex flex-wrap justify-center gap-6 md:gap-8">
+          <ul className="flex flex-wrap justify-center gap-6 md:gap-8 list-none p-0 m-0">
+            {links.map((label) => {
+              let toPath = "/";
+              if (label === "Tentang Kami") toPath = "/about";
+              else if (label === "Bantuan") toPath = "/help";
+              else if (label === "Kebijakan Privasi") toPath = "/privacy";
+              else if (label === "Syarat dan Ketentuan") toPath = "/terms";
+
+              return (
+                <li key={label}>
+                  <Link
+                    to={toPath}
+                    className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer inline-flex items-center py-3 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus-visible:rounded"
+                  >
+                    {label}
+                  </Link>
+                </li>
+              );
+            })}
+          </ul>
+        </nav>
```

---

> [!NOTE]
> Semua perbaikan di atas tidak mengubah fungsionalitas logika bisnis, melainkan murni meningkatkan standar aksesibilitas peramban & kompatibilitas alat bantu pembaca layar.
