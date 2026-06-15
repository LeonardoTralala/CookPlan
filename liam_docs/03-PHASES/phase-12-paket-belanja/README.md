---
phase: 12
status: done
last-updated: 2026-06-14
estimated-effort: 3-5 hari
dependencies: [phase-1, phase-3, phase-4]
---

> **STATUS: SELESAI** — skema ter-apply ke prod, UI 2 tab + paket + simpan daftar
> jadi, lint/build bersih, uji end-to-end prod lulus. Detail di
> [verification.md](./verification.md) & ADR-014.

# Phase 12 — Paket "Belanja di Kami" + Dua Tab Belanja + Simpan Daftar

> Plan teknis. Disusun dari notulen tim (2026-06-14). Branch: `feat/paket-belanja`.
> Fokus tahap ini: **PAKET dulu** (notulen #12), lalu 2 tab belanja & simpan daftar.

## Konteks & Masalah
CookPlan punya dua jalur menu:
1. **Generate AI (foodplan)** — fleksibel, dari katalog resep, bahan **belum tentu**
   tersedia di supplier kami → daftar belanja = **"Belanja Sendiri"** (checklist).
2. **Paket (BARU)** — kombinasi *periode + menu fiks* yang **bahannya kami stok**
   (hanya ~3 paket). Porsi bisa di-request. Daftar belanja = **"Belanja di Kami"**
   → bisa di-order via WhatsApp (core offer / dropship).

Notulen kunci:
- #4 "FoodPlan & Prep tidak masuk generate (beda lagi). Paket = periode + menu fiks,
  porsi bisa request."
- #5 "Di belanja ada 2 tab: belanja sendiri & belanja di kami."
- #12 "Fokus paket dulu (yang 3 itu)."
- #13 "Tambah fitur simpan daftar belanja di bagian belanja."
- #2 "Tambah bahan di Supabase."

## Keputusan Desain (disepakati)
| Aspek | Keputusan |
|-------|-----------|
| Wujud paket | **Tabel baru `packages`** (+ `package_items`) — terpisah dari katalog resep. Menangkap "periode + menu fiks". |
| Lokasi 2 tab | **Halaman Belanja utama** (`/shopping`, `ShoppingList.jsx`) — sesuai notulen #5. |
| Penentu "di kami" | Daftar belanja yang berasal dari **paket** → tab "Belanja di Kami". Daftar dari generate/planner biasa → "Belanja Sendiri". |
| Order | "Belanja di Kami" → order via WhatsApp (reuse `orderService`). "Belanja Sendiri" → checklist saja. |
| Simpan daftar | **Tabel `saved_shopping_lists`** (snapshot per user). |
| Harga | Bahan paket punya harga pasti (dari `package_items`), bukan estimasi AI. |

## Skema Database (rencana migrasi)
Migrasi baru: `supabase/migrations/2026061500000X_create_packages.sql`

### `packages` — paket menu fiks yang bahannya kami sediakan
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | serial PK | |
| slug | text unique | key permanen (mis. `paket-hemat-3hari`) |
| name | text not null | nama tampilan |
| description | text | |
| periode_days | integer not null | jumlah hari menu fiks |
| meals_per_day | integer not null default 3 | |
| base_servings | integer not null default 2 | acuan skala harga saat porsi di-request |
| price_idr | integer not null default 0 | harga paket (porsi dasar) |
| image_url | text | |
| badges | text[] default '{}' | |
| is_active | boolean not null default true | soft hide |
| sort_order | integer not null default 0 | |
| created_at / updated_at | timestamptz | trigger set_updated_at |

### `package_meals` — menu fiks per hari paket (refer ke recipes katalog)
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | serial PK | |
| package_id | int not null FK → packages(id) on delete cascade | |
| day_index | integer not null | 0-based |
| meal_type | text check (breakfast/lunch/dinner) | |
| recipe_id | int FK → recipes(id) on delete restrict | menu fiks |
| UNIQUE (package_id, day_index, meal_type) | | |

> Alternatif dipertimbangkan: simpan bahan langsung di `package_items` (lepas dari
> recipes). Diputuskan **refer ke recipes** supaya bahan & harga ikut
> `recipe_ingredients` yang sudah ada (single source of truth, reuse `shoppingList.ts`).
> "Tambah bahan di Supabase" (#2) = lengkapi `recipe_ingredients` + `price_idr` resep
> yang dipakai paket.

### `saved_shopping_lists` — simpan daftar belanja (#13)
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | serial PK | |
| user_id | uuid not null FK → profiles(id) on delete cascade | |
| title | text not null | nama daftar (auto/manual) |
| source_type | text check (`generate`/`package`/`planner`) | asal daftar |
| source_ref | text | planId / packageId (opsional) |
| items_json | jsonb not null | snapshot item belanja |
| total_idr | integer not null default 0 | |
| created_at | timestamptz default now() | |

### RLS
- `packages`, `package_meals` → **read publik** (anon+authenticated, `is_active`),
  tulis **admin** (`is_admin()`), pola sama `recipes`/`diet_tags`.
- `saved_shopping_lists` → **owner-only** (semua operasi), pola sama `weekly_plans`.

## Service Layer (frontend)
- `src/services/packageService.js` (baru): `getPackages()`, `getPackageById(id)`
  (embed `package_meals` + recipe + ingredients).
- `src/services/shoppingListService.js` (baru): `saveShoppingList(payload)`,
  `getSavedShoppingLists()`, `deleteSavedShoppingList(id)`.
- Util bersama `src/utils/buildShoppingList.js` (port logika dari `ShoppingList.jsx`
  + `shoppingList.ts`) supaya planner & paket pakai agregasi yang sama, dengan
  penanda `source` ('sendiri' | 'kami') per item.

## UI (implementasi final)
1. **Halaman Belanja (`ShoppingList.jsx`)** — shell dengan **2 tab**:
   - *Belanja Sendiri* (`ShopSelfTab.jsx`): item dari Weekly Planner (menu non-paket)
     → checklist + progres + estimasi. Tombol **Simpan Daftar**.
   - *Belanja di Kami* (`ShopWithUsTab.jsx`): pilih paket → stepper porsi → daftar
     belanja (harga agregasi `recipe_ingredients`) → **Pesan via WhatsApp** + Simpan Daftar.
   - **Daftar Tersimpan** (`SavedListsSection.jsx`): list + buka (modal isi) + hapus.
2. **Tidak ada route `/packages` terpisah** — paket tampil dalam tab "Belanja di Kami"
   (horizontal package picker). Nav bottom tetap 5 item.
3. Util bersama `src/utils/buildShoppingList.js` — agregasi dipakai oleh kedua tab
   (planner & paket), satu sumber logika.

> Catatan: notulen #4 "FoodPlan & Prep tidak masuk generate" → paket adalah jalur
> TERPISAH dari wizard generate, hidup di halaman Belanja. Generate tetap fleksibel
> (foodplan AI). Item generate-tweaks (#6 diet, #10 banner) dipisah ke branch lain.

## File yang dibuat/diubah
| File | Status |
|------|--------|
| `supabase/migrations/20260615000000_create_packages.sql` | baru (applied ke prod via Mgmt API) |
| `src/utils/buildShoppingList.js` | baru (util agregasi bersama) |
| `src/services/packageService.js` | baru |
| `src/services/shoppingListService.js` | baru |
| `src/components/ShopSelfTab.jsx` | baru |
| `src/components/ShopWithUsTab.jsx` | baru |
| `src/components/SavedListsSection.jsx` | baru |
| `src/pages/ShoppingList.jsx` | rewrite (shell 2 tab + modal lihat daftar) |

## Cakupan PR ini (feat/paket-belanja)
✅ Skema: `packages`, `package_meals`, `saved_shopping_lists` + RLS + seed 3 paket
✅ Service: packageService, shoppingListService, util buildShoppingList bersama
✅ UI: 2 tab di /shopping, package picker + stepper porsi, simpan & lihat daftar tersimpan
✅ Order WA untuk "Belanja di Kami" (reuse orderService, planId=null)
✅ Lint + build bersih, uji end-to-end prod lulus

## DILUAR cakupan PR ini (branch lain)
- Generate tweaks: diet diperbaiki + hapus "Hemat Budget" (#6), banner layanan
  antar (#10) → `feat/generate-tweaks`
- Guest boleh generate 1× lalu wajib login (#11) → `feat/auth-guest-generate`
- Admin UI kelola paket → fase lanjutan (seed manual dulu)

## Status item notulen (verifikasi 2026-06-14)
- #4 FoodPlan & Prep tidak masuk generate → ✅ DONE (selector outputType dihapus
  dari wizard, hardcoded 'full').
- #8 Catatan khusus di bawah "bahan di rumah" → ✅ DONE (urutan field sudah benar
  di Step 2).
- #1 Porsi per hari → ⚠️ DIANGGAP SELESAI oleh tim via relabel "porsi per jam
  makan" + penjelasan total otomatis ×waktu makan. CATATAN: secara teknis masih
  per-slot, bukan "per hari" literal. Bila tim mau angka input benar-benar = porsi
  per hari, perlu perubahan terpisah.
- #9 Regenerate per hari → ✅ SELESAI di PR #26 (`feat/regenerate-day`).

## Keputusan final (resolved)
1. **Harga paket = agregasi `recipe_ingredients`** (skala per porsi yang di-request).
   `packages.price_idr` cuma harga tampilan/marketing opsional (default 0).
2. **Order "Belanja di Kami" reuse `orderService.createOrder`** dengan `planId=null`
   + `outputType='package'` + items dari agregasi bahan paket → buka WhatsApp. Tidak
   ada route/tabel order baru.
3. **Lokasi 2 tab = halaman Belanja (`/shopping`)**, bukan route `/packages` baru —
   menghindari bottom-nav lebih dari 5 item & paling setia ke notulen #5.
