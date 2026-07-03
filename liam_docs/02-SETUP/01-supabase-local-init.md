---
phase: setup
status: done
last-updated: 2026-06-11
---

# 🧩 Supabase Local — Init & Commands

Semua command Supabase CLI yang kepakai di CookPlan, plus kapan dipakainya. Pastikan **Docker Desktop udah nyala** dulu sebelum mulai.

## `supabase init` (udah dilakukan)

Ini cuma sekali di awal project, dan **sudah dijalankan**. Command ini bikin folder `supabase/` + file `config.toml`.

```bash
supabase init
```

Hasil config penting di `supabase/config.toml`:

- `project_id = "CookPlan"`
- Postgres `major_version = 17`

Kamu **gak perlu** jalanin ini lagi. Cukup tau aja config-nya.

## `supabase start`

Nyalain seluruh stack Supabase local (9 container Docker: Postgres, Auth, PostgREST, Studio, dll).

```bash
supabase start
```

> ⏳ **Pertama kali bakal LAMA (~5-10 menit)** karena harus download Docker image dulu. Sabar, ini normal. Start berikutnya cepet karena image udah ke-cache.

Setelah selesai, dia bakal nge-print kredensial (URL + key). Output-nya kira-kira:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
```

## `supabase status`

Liat status stack + kredensial kapan aja (tanpa restart).

```bash
supabase status
```

Output yang kepakai buat `.env.local`:

| Service | URL / Value |
|---------|-------------|
| Studio (dashboard) | http://127.0.0.1:54323 |
| API | http://127.0.0.1:54321 |
| DB | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Edge Functions | http://127.0.0.1:54321/functions/v1 |
| anon (publishable) key | `sb_publishable_YOUR_LOCAL_ANON_KEY` |

> anon key di atas adalah **default lokal** Supabase — bukan rahasia, aman dipakai di local dev.

**Kapan dipakai:** tiap kali lupa URL/key, atau mau cek stack masih jalan apa nggak.

## `supabase stop`

Matiin semua container Supabase local. Data tetap aman (gak kehapus).

```bash
supabase stop
```

**Kapan dipakai:** kalau udah selesai kerja, atau pas mau resolve **port conflict** (54321/54322 nyangkut).

## `supabase db reset`

Rebuild database dari nol: drop DB → apply **semua migration** di `supabase/migrations/` → jalanin `supabase/seed.sql`.

```bash
supabase db reset
```

Seed bakal masukin **6 resep + 2 config ai_providers**.

> ⚠️ Ini **menghapus semua data** di DB lokal dan bikin ulang dari migration + seed. Aman di lokal, jangan dipakai di production.

**Kapan dipakai:**
- Pertama kali abis `supabase start`, biar DB keisi seed.
- Habis nambah/ubah file migration.
- Pas DB lokal "berantakan" dan mau balik ke kondisi bersih.

## `supabase functions serve`

Jalanin Edge Functions (`generate-plan`, `admin-providers`) di lokal.

```bash
supabase functions serve
```

Fungsi-nya nongol di `http://127.0.0.1:54321/functions/v1/<nama-function>`.

**Kapan dipakai:** kalau mau tes fitur AI (generate meal plan) atau admin providers di lokal. Jalanin di terminal terpisah (biarin nyala sambil `npm run dev` jalan).

> Catatan macOS: kalau mau jalanin di background, pakai `nohup supabase functions serve &` (macOS gak punya `timeout`).

## Ringkasan Alur Umum

```bash
# 1. nyalain stack (Docker harus udah on)
supabase start

# 2. liat kredensial buat .env.local
supabase status

# 3. seed database
supabase db reset

# 4. (opsional) jalanin edge functions buat fitur AI
supabase functions serve

# ... kerja ...

# 5. selesai, matiin
supabase stop
```
