---
phase: overview
status: in-progress
last-updated: 2026-06-11
---

# 📋 Decisions Log (Architecture Decision Records)

> Catatan setiap keputusan teknis penting: kapan, apa, kenapa, dan alternatif yang
> dipertimbangkan. Format ADR ringkas. Append-only (jangan hapus, tandai superseded).

---

## ADR-001 — Backend: Supabase Edge Functions (bukan backend terpisah)

**Tanggal:** 2026-06-11
**Status:** Accepted

**Konteks:** Butuh server-side untuk call AI API (API key tidak boleh ke browser).
Pertimbangan: React+Vite langsung (tidak aman), Edge Functions, ElysiaJS terpisah, Next.js.

**Keputusan:** Pakai **Supabase Edge Functions** (Deno runtime).

**Alasan:**
- Hanya 1 dari 6 operasi MVP yang butuh server (generate AI). Bikin backend penuh = overkill.
- Satu vendor (Supabase), satu dashboard, satu billing.
- Edge Function otomatis dapat JWT user, gampang RLS-aware.
- Deploy 1 perintah, free tier 500K invocations/bulan.

**Alternatif ditolak:**
- ElysiaJS terpisah → tambah vendor hosting, CORS, JWT verify manual. Overkill untuk PKM.
- Next.js → migrasi besar dari Vite, risiko di tengah PKM.

---

## ADR-002 — AI Provider-Agnostic via OpenAI-Compatible Format

**Tanggal:** 2026-06-11
**Status:** Accepted

**Konteks:** User mau ganti-ganti model AI sesuka hati (Sonnet 4.5 thinking, DeepSeek, dll)
lewat proxy 9router & enowxlabs.

**Keputusan:** Edge Function jadi **proxy universal** yang ngomong format
**OpenAI-compatible chat completions** (`POST {base_url}/chat/completions`). Config
(base_url, api_key, model, dll) disimpan di tabel `ai_providers`, bisa diganti tanpa redeploy.

**Alasan:**
- >90% provider modern support format ini (termasuk Sonnet via proxy, DeepSeek native).
- Tidak perlu adapter per provider.

**Alternatif ditolak:**
- Adapter Claude Messages API khusus → tidak perlu karena pakai proxy OpenAI-compat.

---

## ADR-003 — AI Fallback ke Gemini

**Tanggal:** 2026-06-11
**Status:** Accepted

**Keputusan:** Kalau provider primary error/timeout, fallback ke Gemini.

**Catatan keamanan:** API key disimpan via Supabase secrets / Vault, BUKAN plaintext di
tabel atau git.

---

## ADR-004 — Recipe Context: SQL Pre-filter (bukan vector embedding)

**Tanggal:** 2026-06-11
**Status:** Accepted

**Keputusan:** Untuk RAG, pakai **SQL filter** (diet/budget/waktu) → kirim 20-30 kandidat
resep ke AI. Bukan vector embedding.

**Alasan:** Cepat, deterministik, gampang debug. Vector embedding overkill untuk katalog
< 200 resep. Disimpan untuk v2.

---

## ADR-005 — Structured Output: Schema-in-Prompt + Defensive Parsing

**Tanggal:** 2026-06-11
**Status:** Accepted

**Keputusan:** JSON schema dikirim sebagai **teks di dalam prompt** (bukan param API),
lalu parse defensive di server + validasi Zod.

**Alasan:** Jalan di semua provider tanpa peduli mereka native support `response_format`
atau tidak. Provider-agnostic.

---

## ADR-006 — 100% Local Development

**Tanggal:** 2026-06-11
**Status:** Accepted

**Keputusan:** Semua dev pakai Supabase CLI local. Production tidak disentuh.

**Alasan:** User mau build sampai benar-benar selesai dulu sebelum ke prod. Tidak perlu
nunggu approval/akses. Zero risk ke data production.

**Konsekuensi:** Data pre-register production tidak ada di local. Perlu fase "deploy ke
prod" terpisah nanti.

---

## ADR-007 — Admin Role via `profiles.role` Column

**Tanggal:** 2026-06-11
**Status:** Accepted

**Keputusan:** Otorisasi admin pakai kolom `profiles.role` enum ('user', 'admin'). RLS
cek `(select role from profiles where id = auth.uid()) = 'admin'`.

**Alasan:** Dynamic (ganti admin tanpa redeploy), clean, gampang debug.

---

## ADR-008 — Edit Manual Setelah Generate Masuk MVP

**Tanggal:** 2026-06-11
**Status:** Accepted

**Keputusan:** User bisa swap menu individual setelah AI generate (drag/drop atau picker).
Edit mengubah `output_json`, tidak re-generate (hemat biaya AI).

**Alasan:** AI tidak selalu pas, user pasti mau tweak.

---

## ADR-009 — Caching via input_hash

**Tanggal:** 2026-06-11
**Status:** Accepted

**Keputusan:** Hash deterministik dari input user → kalau sama persis, return hasil cache
dari `generated_plans`, tidak call AI lagi.

**Alasan:** Hemat biaya AI signifikan + respon instan untuk input identik.

---

## ADR-010 — Dokumentasi di `liam_docs/`

**Tanggal:** 2026-06-11
**Status:** Accepted

**Keputusan:** Semua dokumentasi pengembangan AI di folder `liam_docs/` (terpisah dari
`docs/` lama). Bahasa Indonesia santai. ~50 file MD, parallel doc + code.

---

## ADR-011 — Apply Migration Baru ke Prod via Raw SQL (Bukan `db push`)

**Tanggal:** 2026-06-11
**Status:** Accepted

**Konteks:** Saat hendak deploy phase 1 (Edge Function `generate-plan`) ke production
project `phdbbiydrjwxlehdfubh`, ditemukan migration history mismatch besar: prod cuma
punya 3 entri di `supabase_migrations.schema_migrations` (`initial_schema`,
`generate_order_id_function`, `create_preregistrations`) sedangkan repo punya 9 file
migration. Skema di prod kemungkinan dibikin manual / via dashboard sebelum migration
dijalankan, sehingga banyak klausa `on delete cascade` & default value di-skip oleh
`create table if not exists`.

**Keputusan:** Migration baru (`20260611150000`, `20260611150100`) di-apply ke prod
**lewat raw SQL via Supabase Management API** (`POST /v1/projects/{ref}/database/query`),
**bukan** lewat `supabase db push`. Migration ditulis idempoten (`drop constraint if exists`
lalu `add`, `create table if not exists`, `add column if not exists`) sehingga aman
di-jalankan ulang di env mana pun.

**Alasan:**
- `db push` akan menghitung diff terhadap `schema_migrations` table di prod. Karena
  history di prod minim, dia bakal coba apply 6 migration "missing" (000000-000006)
  secara berurutan — sebagian besar pakai `create table if not exists` yang bakal
  no-op untuk tabel yang sudah ada, tapi function/trigger/policy bisa nimbulkan
  konflik tak terduga atau side effect.
- Project ini punya owner lain (bukan kami). Memaksakan history sync = risiko
  kerusakan tinggi tanpa manfaat fungsional.
- Raw SQL via Mgmt API atomik per-request (kalau gagal, transaksi rollback dan
  state prod tidak berubah).

**Konsekuensi:**
- `schema_migrations` di prod tidak nyatat 2 migration baru. Kalau tim mau apply ke
  env baru lewat `db push`, mereka harus jalanin ulang manual atau update catatan
  history. Konsekuensi diterima karena migration idempoten.
- Untuk env baru (dev/staging) yang dibikin dari nol, jalankan `supabase db reset`
  yang otomatis nge-apply semua migration dari folder.

**Alternatif ditolak:**
- `supabase db push` ke prod → risiko konflik dengan tabel/function yang sudah ada.
- Sync paksa `schema_migrations` table → mengubah audit history project orang lain.
- Tidak apply migration sama sekali → membiarkan bug critical (hapus akun gagal).

---

## ADR-012 — Patch Minimal untuk Drift Skema (Conservative Approach)

**Tanggal:** 2026-06-11
**Status:** Accepted

**Konteks:** Audit prod menemukan drift yang lebih luas dari yang awalnya disangka:
4 FK constraint salah behavior, kolom extra tak terdokumentasi di `orders`
(`service_fee`, `payment_status`, `order_status`), kolom `gender` di `profiles`,
tabel `subscriptions` tanpa migration file, policy duplikat di beberapa tabel.

**Keputusan:** Hanya fix yang **breaking** atau menyentuh **bidang keamanan**:
1. FK `profiles_id_fkey` → CASCADE (kritis — hapus user gagal total).
2. FK `orders.user_id` → SET NULL (preserve riwayat order).
3. FK `meal_entries.recipe_id` → SET NULL (preserve snapshot menu).
4. FK `subscriptions.user_id` → CASCADE.
5. `orders.id` default `generate_order_id()` (insert order baru gagal tanpa ini).
6. `orders.delivery_address` drop NOT NULL (frontend kirim null kadang-kadang).
7. `orders.payment_method` check tambah `'cod'` (selaras migration).
8. `order_items.order_id` NOT NULL + tambah kolom `category`, `created_at`.
9. Revoke EXECUTE `prevent_role_change()` dari role API (hardening SECURITY DEFINER).

Drift kosmetik (kolom extra harmless, policy duplikat dengan efek sama) **dibiarkan**.

**Alasan:**
- Project punya owner lain. Mengubah hal yang tidak breaking = risiko mengganggu
  alur yang mungkin dipakai admin tool/dashboard di luar repo (misalnya laporan
  yang baca `payment_status` di kolom extra).
- Kolom extra di `orders` semuanya nullable atau punya default valid → tidak
  bikin insert frontend gagal.
- Menghapus kolom = `pg_dump` history hilang permanen. Reversibility murah:
  alter constraint balik gampang, tapi `drop column` susah dikembalikan.

**Konsekuensi:**
- Skema prod agak "kotor" dibanding migration baseline tapi konsisten dengan
  niat code di frontend & Edge Functions.
- Kalau owner mau bersihin nanti, bisa jalankan `pg_dump --schema-only` baseline
  baru dan rebuild migration history dari nol di env staging dulu.

**Alternatif ditolak:**
- Drop semua kolom extra di `orders` → reversibility murah secara DDL tapi
  potensial putus integrasi tak terlihat.
- Sync penuh skema lewat `supabase db diff --linked` lalu apply → risiko ubah
  hal yang tidak perlu.

---

## ADR-013 — Regenerate Per Hari: Edge Function Terpisah + Shopping List Deterministik

**Tanggal:** 2026-06-14
**Status:** Accepted

**Konteks:** Fitur "Ganti Menu Harian" — user bisa menyusun ulang menu satu hari
dari hasil generate, dengan catatan preferensi opsional ("pengen ayam"). Pertanyaan
desain: bikin Edge Function baru atau pakai `generate-plan`? Bagaimana daftar belanja
(yang agregat seluruh hari) tetap konsisten? Bagaimana sinkronisasi ke planner?

**Keputusan:**
1. **Edge Function terpisah `regenerate-day`** (bukan menambah mode ke `generate-plan`).
   Caching `generate-plan` berbasis `input_hash` seluruh plan; mencampur regenerate
   parsial akan mengotori jalur cache itu. Fungsi terpisah lebih bersih & mudah diuji.
2. **Shopping list di-recompute DETERMINISTIK di server** dari `recipe_ingredients`
   (`_shared/shoppingList.ts`), bukan diminta ulang dari AI. Akurat, tanpa biaya token,
   dan jadi fondasi reusable untuk fitur "Belanja Sendiri vs Belanja di Kami".
3. **Cakupan: seluruh hari (3 waktu makan)**, tapi backend menerima param `mealType`
   opsional → siap untuk regenerate per-waktu-makan tanpa ubah Edge Function lagi.
4. **Update `output_json` baris `generated_plans` yang sama** — planId & URL tetap,
   tidak ada tabel/kolom baru.
5. **Rate limit berbagi kuota** dengan generate-plan (20/hari, `endpoint='regenerate-day'`).
6. **Sync planner otomatis** bila plan sudah di-apply (re-apply seluruh plan via `applySlots`).
7. **Catatan user di-sanitasi** (buang char kontrol, clamp 200) + di-frame sebagai DATA
   preferensi di dalam delimiter, bukan instruksi sistem (anti prompt-injection, selaras
   pola `notes` di buildUserMessage).

**Alasan:**
- Memisahkan jalur cache full-plan dari regenerate parsial menghindari bug halus.
- Recompute deterministik = satu sumber kebenaran harga, hemat token, konsisten.
- Param `mealType` opsional = ekstensi murah (vision per-waktu-makan) tanpa rework.

**Konsekuensi:**
- Metodologi harga berbeda antara generate awal (harga dari AI) dan setelah regenerate
  (recompute dari `recipe_ingredients`) → angka belanja bisa sedikit bergeser setelah
  regenerate pertama. Diterima karena lebih akurat; akan diseragamkan saat fitur belanja.
- Edge Function tidak otomatis ter-type-check di CI (CI hanya eslint + vite build);
  verifikasi `deno check` dilakukan manual.

**Alternatif ditolak:**
- Tambah mode `regenerateDayIndex` ke `generate-plan` → mengotori caching input_hash.
- Minta AI menghitung ulang shopping_list → boros token & rawan tidak konsisten.
- Tabel baru untuk menyimpan versi hari → overkill; cukup update `output_json`.
