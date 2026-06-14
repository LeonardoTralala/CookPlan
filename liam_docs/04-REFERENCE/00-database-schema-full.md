---
phase: reference
status: done
last-updated: 2026-06-11
---

# Skema Database Lengkap CookPlan

Dokumen ini ngerangkum semua tabel di database CookPlan (Postgres via Supabase) berdasarkan file migration. Semua tabel pakai konvensi `snake_case` dan ada di schema `public`. Triggernya kebanyakan pakai fungsi `set_updated_at()` buat auto-update kolom `updated_at`.

## ERD (Teks)

```
auth.users (Supabase Auth)
   │ 1:1 (on delete cascade)
   ▼
profiles ──────────────┐
   │ id (uuid PK)       │ role: user | admin
   │                    │
   │ 1:N                │ 1:N                  1:N
   ├──────────────► weekly_plans          generated_plans ◄── ai_providers
   │                    │ 1:N                  │ provider_id        │ id (uuid PK)
   │                    ▼                      │                    │
   │                meal_entries ──► recipes   │                    │
   │                                   ▲       │                    │
   │ 1:N                               │ N:1   │                    │
   ├──────────────► orders             │       │                    │
   │                    │ plan_id ─────┼───────┘                    │
   │                    │ 1:N          │                            │
   │                    ▼              │                            │
   │                order_items        │                            │
   │                                   │ 1:N                        │
   │                            recipe_ingredients                  │
   │ 1:N                                                            │
   └──────────────► ai_usage_log ──────────────────────────────────┘
                          (provider_id)

preregistrations  (berdiri sendiri, daftar tunggu publik, gak ada FK ke user)
```

Relasi singkat:

| Parent | Child | Kolom FK | On Delete |
|---|---|---|---|
| `auth.users` | `profiles` | `profiles.id` | cascade |
| `profiles` | `weekly_plans` | `weekly_plans.user_id` | cascade |
| `weekly_plans` | `meal_entries` | `meal_entries.plan_id` | cascade |
| `recipes` | `meal_entries` | `meal_entries.recipe_id` | set null |
| `recipes` | `recipe_ingredients` | `recipe_ingredients.recipe_id` | cascade |
| `profiles` | `orders` | `orders.user_id` | set null |
| `generated_plans` | `orders` | `orders.plan_id` | set null |
| `orders` | `order_items` | `order_items.order_id` | cascade |
| `profiles` | `generated_plans` | `generated_plans.user_id` | cascade |
| `ai_providers` | `generated_plans` | `generated_plans.provider_id` | set null |
| `profiles` | `ai_usage_log` | `ai_usage_log.user_id` | set null |
| `ai_providers` | `ai_usage_log` | `ai_usage_log.provider_id` | set null |
| `profiles` | `subscriptions` | `subscriptions.user_id` | cascade |

---

## 1. `profiles`

Profil pengguna, hubungannya 1:1 sama `auth.users`. Dibuat otomatis lewat trigger `on_auth_user_created` pas user baru daftar.

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | uuid | PK, FK → `auth.users(id)` on delete cascade | ID user |
| `full_name` | text | nullable | Nama tampilan dari metadata saat daftar |
| `username` | text | unique, nullable | Handle unik, diturunkan dari email |
| `avatar_url` | text | nullable | URL foto profil |
| `role` | text | not null default `'user'`, check in (`user`,`admin`) | Peran user (ditambah di migration 0004) |
| `created_at` | timestamptz | not null default `now()` | |
| `updated_at` | timestamptz | not null default `now()` | auto-update via trigger |

Fungsi pendukung:
- `set_updated_at()` — trigger before update.
- `handle_new_user()` — SECURITY DEFINER, bikin baris profil baru pas registrasi (baca `raw_user_meta_data`, generate username dari email + potongan UUID).
- `is_admin()` — SECURITY DEFINER stable, return boolean apakah caller admin.

---

## 2. `preregistrations`

Daftar tunggu calon pengguna dari halaman `/register`. Publik insert-only buat anon (gak bisa dibaca dari klien).

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | uuid | PK default `gen_random_uuid()` | |
| `name` | text | not null | Nama pendaftar |
| `email` | text | not null, unique index `lower(email)` | Satu email sekali daftar |
| `phone` | text | nullable | |
| `city` | text | not null | |
| `kecamatan` | text | nullable | |
| `user_type` | text | nullable | Tipe user (mahasiswa/pekerja/dll) |
| `created_at` | timestamptz | not null default `now()` | |

Unique index: `preregistrations_email_unique` on `lower(email)`. Pelanggaran balikin error `23505` yang di-handle klien sebagai "sudah terdaftar".

---

## 3. `recipes`

Bank resep CookPlan. Sumber katalog plus konteks buat AI generate foodplan.

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | serial | PK | |
| `title` | text | not null | Judul resep |
| `description` | text | nullable | |
| `ready_in_minutes` | integer | nullable | Waktu masak |
| `calories` | integer | nullable | |
| `price_idr` | integer | nullable | Estimasi harga total resep (porsi dasar) |
| `image_url` | text | nullable | |
| `difficulty` | text | check in (`easy`,`medium`,`hard`) | |
| `cuisine` | text | nullable | nusantara / asia / western / dll |
| `badges` | text[] | not null default `'{}'` | Label tampilan (Vegetarian, Cepat, dll) |
| `tags` | text[] | not null default `'{}'` | Constraint AI (halal, vegan, low-carb) |
| `instructions` | text[] | not null default `'{}'` | Langkah memasak |
| `ingredients_text` | text | nullable | Ringkasan bahan jadi 1 string, hemat token buat prompt AI |
| `base_servings` | integer | not null default `2` | Porsi acuan takaran bahan |
| `is_active` | boolean | not null default `true` | Soft hide tanpa delete |
| `created_at` | timestamptz | not null default `now()` | |
| `updated_at` | timestamptz | not null default `now()` | auto-update via trigger |

---

## 4. `recipe_ingredients`

Bahan per resep. Diagregasi jadi shopping list pas generate foodprep.

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | serial | PK | |
| `recipe_id` | integer | not null, FK → `recipes(id)` on delete cascade | |
| `name` | text | not null | |
| `amount` | numeric | nullable | |
| `unit` | text | nullable | |
| `category` | text | check in (`vegetables`,`meat`,`dairy`,`spices`,`dry_goods`) | |
| `price_idr` | integer | nullable | Estimasi harga komponen (porsi dasar) |
| `created_at` | timestamptz | not null default `now()` | |

Index: `recipe_ingredients_recipe_id_idx` on `recipe_id`.

---

## 5. `weekly_plans`

Rencana masak mingguan milik user. Satu baris per user per minggu (gantiin localStorage lama).

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | serial | PK | |
| `user_id` | uuid | not null, FK → `profiles(id)` on delete cascade | |
| `week_start_date` | date | not null | Tanggal Senin minggu berjalan |
| `created_at` | timestamptz | not null default `now()` | |
| `updated_at` | timestamptz | not null default `now()` | auto-update via trigger |

Unique: `(user_id, week_start_date)`. Index: `weekly_plans_user_id_idx`.

---

## 6. `meal_entries`

Slot menu pada rencana mingguan. Unik per (plan, hari, jenis makan). Nyimpen snapshot data resep biar kartu tetap tampil walau resep induk berubah/dihapus.

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | serial | PK | |
| `plan_id` | integer | not null, FK → `weekly_plans(id)` on delete cascade | |
| `recipe_id` | integer | FK → `recipes(id)` on delete set null | |
| `day_of_week` | text | check in (`Senin`..`Minggu`) | |
| `meal_type` | text | check in (`breakfast`,`lunch`,`dinner`) | |
| `servings` | integer | not null default `2` | |
| `title` | text | nullable | snapshot |
| `image_url` | text | nullable | snapshot |
| `price_idr` | integer | nullable | snapshot |
| `ready_in_minutes` | integer | nullable | snapshot |
| `calories` | integer | nullable | snapshot |
| `created_at` | timestamptz | not null default `now()` | |

Unique: `(plan_id, day_of_week, meal_type)`. Index: `meal_entries_plan_id_idx`.

---

## 7. `orders`

Pesanan paket belanja. ID kustom `CP-YYYYMMDD-XXXX` digenerate sebelum buka WhatsApp.

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | text | PK default `generate_order_id()` | Format `CP-YYYYMMDD-XXXX` |
| `user_id` | uuid | FK → `profiles(id)` on delete set null | |
| `plan_id` | integer | FK → `generated_plans(id)` on delete set null | |
| `output_type` | text | nullable | foodplan / foodprep / full |
| `total_price` | integer | not null default `0` | |
| `delivery_fee` | integer | not null default `15000` | Selaras `DELIVERY_FEE` di ShoppingList.jsx |
| `delivery_address` | text | nullable | |
| `customer_name` | text | nullable | |
| `customer_phone` | text | nullable | |
| `payment_method` | text | check in (`transfer_bank`,`qris`,`cod`) | |
| `status` | text | not null default `'pending'`, check in (`pending`,`confirmed`,`processed`,`delivered`,`cancelled`) | |
| `notes` | text | nullable | |
| `created_at` | timestamptz | not null default `now()` | |
| `updated_at` | timestamptz | not null default `now()` | auto-update via trigger |

Index: `orders_user_id_idx`. Fungsi `generate_order_id()` (SECURITY DEFINER) pakai pendekatan count+1 per hari, di-grant ke `authenticated` (lihat migration 0005).

---

## 8. `order_items`

Rincian bahan per pesanan (hasil shopping list).

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | serial | PK | |
| `order_id` | text | not null, FK → `orders(id)` on delete cascade | |
| `name` | text | not null | |
| `amount` | numeric | not null | |
| `unit` | text | not null | |
| `category` | text | nullable | |
| `price_idr` | integer | not null default `0` | |
| `created_at` | timestamptz | not null default `now()` | |

Index: `order_items_order_id_idx`.

---

## 9. `ai_providers`

Config AI provider (provider-agnostic, ADR-002). Bisa diganti admin lewat UI tanpa redeploy. **HANYA `service_role` yang boleh baca** karena ada API key.

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | uuid | PK default `gen_random_uuid()` | |
| `label` | text | not null | Nama tampilan, mis. "OpenRouter Sonnet 4.5 Thinking" |
| `base_url` | text | not null | Endpoint OpenAI-compatible |
| `api_key` | text | not null | **Sensitif** (TODO pindah ke Vault saat prod) |
| `model` | text | not null | mis. `anthropic/claude-sonnet-4.5` |
| `temperature` | numeric(3,2) | not null default `0.70` | |
| `max_tokens` | integer | not null default `4096` | |
| `supports_json_mode` | boolean | not null default `true` | |
| `is_reasoning` | boolean | not null default `false` | thinking model? |
| `is_active` | boolean | not null default `false` | provider utama |
| `is_fallback` | boolean | not null default `false` | dipakai kalau primary gagal |
| `estimated_latency_seconds` | integer | nullable | kasar, buat UX loading |
| `notes` | text | nullable | |
| `created_at` | timestamptz | not null default `now()` | |
| `updated_at` | timestamptz | not null default `now()` | auto-update via trigger |

Unique partial index:
- `ai_providers_only_one_active` on `(is_active) where is_active = true` — cuma 1 yang aktif.
- `ai_providers_only_one_fallback` on `(is_fallback) where is_fallback = true` — cuma 1 fallback.

---

## 10. `generated_plans`

Hasil generate AI + cache (`input_hash`) + history per user.

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | serial | PK | |
| `user_id` | uuid | FK → `profiles(id)` on delete cascade | |
| `input_hash` | text | not null | sha256 dari input → caching (ADR-009) |
| `input_json` | jsonb | not null | raw input form user |
| `output_json` | jsonb | nullable | hasil AI (menu + shopping list + prep) |
| `output_type` | text | not null | foodplan / foodprep / full |
| `reasoning_content` | text | nullable | chain-of-thought ditampilkan ke user |
| `provider_id` | uuid | FK → `ai_providers(id)` on delete set null | |
| `model` | text | nullable | |
| `tokens_input` | integer | nullable | |
| `tokens_output` | integer | nullable | |
| `cost_usd` | numeric(10,6) | nullable | |
| `latency_ms` | integer | nullable | |
| `status` | text | not null default `'pending'`, check in (`pending`,`success`,`failed`) | |
| `error_message` | text | nullable | |
| `created_at` | timestamptz | not null default `now()` | |

Index: `generated_plans_user_id_idx`, `generated_plans_input_hash_idx`.

---

## 11. `ai_usage_log`

Log pemakaian AI per request (buat rate limit + monitoring biaya).

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | bigserial | PK | |
| `user_id` | uuid | FK → `profiles(id)` on delete set null | |
| `endpoint` | text | not null default `'generate-plan'` | |
| `provider_id` | uuid | FK → `ai_providers(id)` on delete set null | |
| `model` | text | nullable | |
| `tokens_input` | integer | nullable | |
| `tokens_output` | integer | nullable | |
| `cost_usd` | numeric(10,6) | nullable | |
| `cache_hit` | boolean | not null default `false` | |
| `created_at` | timestamptz | not null default `now()` | |

Index: `ai_usage_log_user_created_idx` on `(user_id, created_at)`.

---

## 12. `subscriptions`

Langganan user (paket berlangganan). Awalnya tidak ada di file migration tapi
ada di prod (drift) — di-legalisasi oleh migration `20260611150000` agar repo
jadi sumber kebenaran.

| Kolom | Tipe | Constraint / Default | Keterangan |
|---|---|---|---|
| `id` | serial | PK | |
| `user_id` | uuid | FK → `profiles(id)` on delete cascade | |
| `tier` | text | nullable | Paket langganan |
| `status` | text | nullable | Status (active/expired/dll) |
| `start_date` | date | not null | |
| `end_date` | date | not null | |
| `created_at` | timestamptz | default `now()` | |

Policy: `subs_owner` (ALL, authenticated, owner-only).

---

## Catatan: Drift Skema di Produksi (2026-06-11)

Project produksi `phdbbiydrjwxlehdfubh` punya beberapa drift dari skema yang
didokumentasi di atas:

**Kolom extra yang ada di prod (tidak dipakai code, dibiarkan):**
- `profiles.gender text nullable`
- `orders.service_fee integer default 15000`
- `orders.payment_status text default 'pending'` (check: pending|completed|failed)
- `orders.order_status text default 'received'` (check: received|processed|shipped|delivered)

**Policy duplikat di prod (efek sama, kosmetik):**
- `weekly_plans`: `plans_owner` + `weekly_plans_owner`
- `recipes`: `recipes_read` + `recipes_read_public`
- `recipe_ingredients`: `ingredients_read` + `recipe_ingredients_read_public`

Drift ini didiamkan saat remediasi 2026-06-11 karena project punya owner lain
dan konsekuensi mengubah hal non-breaking lebih besar dari manfaatnya. Detail:
`liam_docs/05-OPERATIONS/06-schema-drift-audit-2026-06-11.md`.

---

## Tabel Phase 12 — Paket "Belanja di Kami" (migrasi `20260615000000_create_packages.sql`)

### `packages` — paket menu fiks yang bahannya kami stok
| Kolom | Tipe | Catatan |
|---|---|---|
| id | serial PK | |
| slug | text unique not null | key permanen |
| name | text not null | |
| description | text | |
| periode_days | integer not null default 3 | jumlah hari menu fiks |
| meals_per_day | integer not null default 3 | |
| base_servings | integer not null default 2 | acuan skala harga saat porsi di-request |
| price_idr | integer not null default 0 | harga tampilan opsional; harga asli = agregasi recipe_ingredients |
| image_url | text | |
| badges | text[] default '{}' | |
| is_active | boolean not null default true | soft hide |
| sort_order | integer not null default 0 | |
| created_at / updated_at | timestamptz | trigger set_updated_at |

### `package_meals` — menu fiks per hari (refer recipes katalog)
| Kolom | Tipe | Catatan |
|---|---|---|
| id | serial PK | |
| package_id | int not null → packages(id) on delete cascade | |
| day_index | integer not null | 0-based |
| meal_type | text check (breakfast/lunch/dinner) | |
| recipe_id | int not null → recipes(id) on delete restrict | menu fiks |
| UNIQUE (package_id, day_index, meal_type) | | |

### `saved_shopping_lists` — simpan daftar belanja (notulen #13)
| Kolom | Tipe | Catatan |
|---|---|---|
| id | serial PK | |
| user_id | uuid not null → profiles(id) on delete cascade | |
| title | text not null | |
| source_type | text check (generate/package/planner) default 'planner' | |
| source_ref | text | planId / packageId opsional |
| items_json | jsonb not null default '[]' | snapshot item belanja |
| total_idr | integer not null default 0 | |
| created_at | timestamptz default now() | |

> Harga paket dihitung dari agregasi `recipe_ingredients` (skala per porsi), bukan
> kolom statis. Lihat ADR-014.
