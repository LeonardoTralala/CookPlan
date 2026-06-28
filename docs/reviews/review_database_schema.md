# Laporan Review Skema Database & Keamanan Supabase CookPlan

Laporan ini memuat analisis mendalam mengenai skema database, migrasi SQL, kebijakan keamanan Row Level Security (RLS), dan konfigurasi Supabase client pada proyek CookPlan. 

---

## Ringkasan Eksekutif (Executive Summary)

Secara umum, skema database CookPlan dirancang dengan sangat baik menggunakan PostgreSQL dan Supabase. Beberapa pola terbaik yang telah diterapkan antara lain:
*   **Keamanan Ketat (Defense-in-depth)**: Tabel `ai_providers` dan `order_id_counters` di-lockdown total dari akses API langsung (`revoke all`), membatasi akses sensitif (seperti API key AI) hanya melalui Edge Functions.
*   **Keamanan Fungsi**: Fungsi-fungsi `SECURITY DEFINER` yang berisiko dirancang dengan membatasi execute privilege (`revoke execute ... from public`) dan mengunci `search_path = ''` untuk mencegah *search_path hijacking*.
*   **Paritas Produksi (Anti-Drift)**: Proses migrasi telah merekonsiliasi perbedaan kolom (seperti `order_status` dan `payment_status`) yang sebelumnya mengalami *drift* di lingkungan produksi.
*   **Statement-Level Triggers**: Penggunaan `FOR EACH STATEMENT` dan *transition tables* untuk sinkronisasi harga pesanan merupakan keputusan performa yang sangat tepat untuk mengurangi redundansi operasi tulis database.

Meskipun demikian, review ini menemukan beberapa **potensi celah keamanan, celah integritas model data, dan risiko performa** yang diklasifikasikan ke dalam 7 temuan utama berikut.

---

## Tabel Temuan Review (Findings Table)

| No | Lokasi File / Line | Kategori | Deskripsi | Keparahan | Rekomendasi Solusi / Snippet Kode | Rencana Mitigasi & Rationale |
|---|---|---|---|---|---|---|
| 1 | `supabase/migrations/` `20260622000000_ingredient_pricing_model.sql` (Line ~180-205) | Performa & Optimasi | **Inefisiensi Update Cascading Row-Level Trigger di `recipe_ingredients`.**<br><br>Trigger `recipe_ingredients_recompute_total` berjalan `FOR EACH ROW`. Saat harga bahan pangan pangan berubah, modifikasi massal pada baris `recipe_ingredients` akan memicu trigger update `recipes` berulang kali untuk resep yang sama (O(N^2) reads/writes). | **Medium** | Ganti trigger level baris dengan statement-level menggunakan transition tables:<br><br>```sql\ncreate or replace function public.recompute_recipe_totals_statement()\nreturns trigger language plpgsql security definer set search_path = '' as $$\nbegin\n  update public.recipes r\n     set price_idr = coalesce((\n       select sum(price_idr)::int\n       from public.recipe_ingredients\n       where recipe_id = r.id\n     ), 0)\n   where r.id in (\n     select recipe_id from new_rows\n     union\n     select recipe_id from old_rows\n   );\n  return null;\nend; $$\n``` | Mengurangi penulisan database redundan dari O(N) per transaksi menjadi O(1) per resep, mencegah kemacetan penguncian baris (row locking) pada tabel resep. |
| 2 | `supabase/migrations/` `20260611000001_create_weekly_plans.sql` (Line ~10-24) | Integritas Model Data | **Absennya Check Constraint Hari Senin pada `weekly_plans.week_start_date`.**<br><br>Unique constraint `(user_id, week_start_date)` mengasumsikan tanggal selalu hari Senin. Tanpa constraint DB, klien bisa memasukkan hari Selasa/Minggu yang berakibat pada duplikasi rencana mingguan dan inkonsistensi jadwal kalender di UI. | **Medium** | Tambahkan check constraint untuk memastikan hari Senin (ISO day of week = 1):<br><br>```sql\nalter table public.weekly_plans\n  add constraint weekly_plans_week_start_date_is_monday\n  check (extract(isodow from week_start_date) = 1);\n``` | Menjamin integritas data kalender di tingkat database sehingga tidak ada tumpang tindih rencana mingguan yang dikirim dari klien. |
| 3 | `supabase/migrations/` `20260622000000_ingredient_pricing_model.sql` (Line ~58-63) | Integritas Model Data | **Ketiadaan Restriksi Hapus pada Master Bahan `ingredients`.**<br><br>Relasi FK di `recipe_ingredients` menggunakan `on delete set null`. Jika admin menghapus bahan di master `ingredients`, relasi terputus secara diam-diam dan `price_idr` pada resep terpengaruh menjadi NULL (rusak/hilang) tanpa peringatan. | **Medium** | Gunakan `on delete restrict` pada foreign key, atau pasang status `is_active` (soft-delete) di master bahan:<br><br>```sql\nalter table public.recipe_ingredients\n  drop constraint recipe_ingredients_ingredient_id_fkey,\n  add constraint recipe_ingredients_ingredient_id_fkey\n    foreign key (ingredient_id)\n    references public.ingredients (id)\n    on delete restrict;\n``` | Mencegah penghapusan tidak sengaja pada bahan master yang sedang aktif digunakan dalam kompilasi resep katalog. |
| 4 | `supabase/functions/` `admin-providers/index.ts` (Line ~29-56) | Bug Risiko & Keamanan | **Risiko Bypass SSRF melalui DNS Rebinding & HTTP Redirect.**<br><br>Validasi `validateBaseUrl` hanya memverifikasi format string. Penyerang dapat mengirimkan domain kustom (mis. `ssrf.domain.com`) yang mulanya beresolusi ke IP publik (lolos validasi), namun saat di-fetch beresolusi ke IP lokal (`127.0.0.1`) atau memicu HTTP redirect ke server internal. | **Medium** | Lakukan pemanggilan dengan opsi redirect manual dan verifikasi resolusi IP domain sebelum mengirim fetch request:<br><br>```typescript\n// Nonaktifkan pengalihan otomatis\nconst res = await fetch(url, {\n  method: \"POST\",\n  redirect: \"manual\",\n  // ...\n});\n``` | Memblokir upaya memindai port infrastruktur lokal (seperti Supabase local API) dari dalam Edge Function runtime. |
| 5 | `supabase/migrations/` `20260622000000_order_id_atomic_counter.sql` (Line ~37-56) | UX & Ketepatan Konteks | **Drift Zona Waktu UTC pada Pembuatan ID Pesanan (`generate_order_id`).**<br><br>Fungsi menggunakan `to_char(now(), 'YYYYMMDD')`. Karena zona waktu server default UTC, pesanan di Indonesia (WIB, GMT+7) antara jam 00:00 - 07:00 pagi akan mendapat ID berawalan tanggal kemarin (drift 1 hari). | **Low** | Gunakan zona waktu lokal Jakarta (`Asia/Jakarta`) secara eksplisit:<br><br>```sql\ntoday text := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD');\n``` | Menghilangkan kerancuan pencatatan transaksi antara struk pesanan pengguna dan ID yang terdaftar di admin WhatsApp. |
| 6 | `supabase/migrations/` `20260611000003_create_orders.sql` (Line ~29-45) | Integritas Model Data | **Absennya Declarative Check Constraints untuk Nilai Moneter `orders`.**<br><br>Meskipun harga `order_items` dijaga, kolom `orders.total_price` dan `orders.delivery_fee` belum dilindungi check constraint tabel. Perubahan data di masa depan (misal update langsung) dapat memicu nilai negatif. | **Low** | Tambahkan check constraints non-negatif ke tabel `orders`:<br><br>```sql\nalter table public.orders\n  add constraint orders_total_price_nonnegative check (total_price >= 0),\n  add constraint orders_delivery_fee_nonnegative check (delivery_fee >= 0);\n``` | Memberikan proteksi menyeluruh di tingkat database (declarative level) untuk mendeteksi anomali tagihan negatif. |
| 7 | `supabase/migrations/` `20260627000000_create_feedback.sql` (Line ~40-55) | Risiko Abuse / Spam | **Ketiadaan Rate-Limiting/Anti-Spam pada Pengiriman `feedback`.**<br><br>Tabel terbuka untuk INSERT bagi seluruh pengguna `authenticated` tanpa limit. Pengguna jahat atau akun yang terkompromi dapat membuat skrip loop pengiriman feedback untuk membanjiri ruang penyimpanan DB. | **Low** | Pasang trigger untuk membatasi jumlah feedback (misal max 5 baris per user per hari):<br><br>```sql\ncreate or replace function public.limit_user_feedback()\nreturns trigger language plpgsql security definer as $$\ndeclare\n  cnt int;\nbegin\n  select count(*) into cnt from public.feedback\n   where user_id = new.user_id and created_at > now() - interval '1 day';\n  if cnt >= 5 then\n    raise exception 'Batas pengiriman feedback harian tercapai.';\n  end if;\n  return new;\nend; $$;\n``` | Melindungi database dari serangan Denial of Service (DoS) lokal berupa spam data umpan balik pengguna. |

---

## Tinjauan Konfigurasi Klien Supabase (`src/lib/`)

1.  **`src/lib/supabase.js`**:
    *   Konfigurasi klien tunggal (singleton) dirancang dengan baik menggunakan variabel lingkungan Vite (`import.meta.env`).
    *   Penggunaan parameter `persistSession`, `autoRefreshToken`, dan `detectSessionInUrl` sudah tepat untuk aplikasi React Single Page Application (SPA).
    *   Kunci anon/publishable aman digunakan di sisi browser karena seluruh validasi data sensitif diserahkan pada kebijakan RLS database.
2.  **`src/lib/session.js`**:
    *   Mekanisme penanganan kegagalan sesi terpusat (`notifySessionExpired`) bekerja dengan andal.
    *   Pemisahan error otorisasi/kuota (seperti RLS violation `42501` atau `Rate Limit`) dari kegagalan autentikasi (`401`) sudah diimplementasikan dengan sangat baik, sehingga mencegah pengguna ter-logout secara tidak terduga saat kuota harian habis.

---

## Rekomendasi Tambahan (Best Practices)

1.  **Gunakan PostgreSQL schemas secara optimal**:
    Untuk masa depan, data log seperti `ai_usage_log` atau data internal `order_id_counters` dapat dipindahkan ke skema kustom (misal `private` atau `logs`) untuk mengisolasi tabel-tabel ini sepenuhnya dari skema `public` yang otomatis terekspos ke REST API PostgREST.
2.  **Taxonomy mapping join table**:
    Kolom `recipes.tags` yang bertipe array `text[]` tidak mendukung integritas referensial. Untuk meningkatkan keamanan relasi kategori diet, pertimbangkan membuat tabel relasi seperti `recipe_diet_tags` yang menghubungkan `recipes.id` dengan `diet_tags.id` via foreign keys.
