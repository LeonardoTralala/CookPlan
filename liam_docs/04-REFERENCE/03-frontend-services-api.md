---
phase: reference
status: done
last-updated: 2026-06-11
---

# API Frontend Service Layer

Semua akses data dari frontend lewat service layer di `src/services/`. Tujuannya supaya komponen gak nyentuh `supabase` client langsung, dan shape data DB (snake_case) di-alias ke camelCase biar cocok sama mock lama.

---

## `recipeService.js`

Bank resep. Kolom DB di-alias ke camelCase via `RECIPE_SELECT` (`image_url` → `imageUrl`, `price_idr` → `priceIdr`, dst), termasuk relasi `recipe_ingredients`.

| Fungsi | Signature | Return | Deskripsi |
|---|---|---|---|
| `getRecipes` | `getRecipes()` | `Promise<Recipe[]>` | Semua resep aktif (`is_active = true`) + bahannya, urut `id`. |
| `getRecipeById` | `getRecipeById(id)` | `Promise<Recipe>` | Satu resep by id (buat modal detail). Throw kalau gak ketemu (`.single()`). |
| `getRecipesByIds` | `getRecipesByIds(ids)` | `Promise<Recipe[]>` | Beberapa resep sekaligus by array id (render hasil generate AI). Return `[]` kalau `ids` kosong. |

Shape `Recipe` (sesudah alias): `{ id, title, description, calories, difficulty, cuisine, badges, tags, instructions, imageUrl, priceIdr, readyInMinutes, baseServings, ingredientsText, ingredients: [{ name, amount, unit, category, priceIdr }] }`.

---

## `planService.js`

Rencana mingguan. State frontend berbentuk `{ Senin: { breakfast, lunch, dinner }, ... }`, di DB jadi `weekly_plans` + `meal_entries`.

| Fungsi | Signature | Return | Deskripsi |
|---|---|---|---|
| `getCurrentWeekStart` | `getCurrentWeekStart(date = new Date())` | `string` (YYYY-MM-DD) | Hitung tanggal Senin minggu berjalan (ISO) sebagai kunci minggu. |
| `getCurrentPlan` | `getCurrentPlan()` | `Promise<{ planId, plan }>` | Ambil (atau buat kalau belum ada) plan minggu ini milik user login. `plan` = shape state frontend. Throw `Belum login.` kalau gak ada user. |
| `setSlot` | `setSlot(planId, recipe, day, mealType, servings)` | `Promise<void>` | Upsert satu slot (onConflict `plan_id,day_of_week,meal_type`). Throw `Hari atau jenis makan tidak valid.` kalau day/mealType gak valid. |
| `removeSlot` | `removeSlot(planId, day, mealType)` | `Promise<void>` | Hapus satu slot. |

Konstanta diekspor: `DAYS` (`['Senin'..'Minggu']`), `MEAL_TYPES` (`['breakfast','lunch','dinner']`).

---

## `orderService.js`

Order + WhatsApp redirect. Bikin baris `orders` (+ `order_items`) lalu susun URL `wa.me` dengan teks berisi ID pesanan.

| Fungsi | Signature | Return | Deskripsi |
|---|---|---|---|
| `createOrder` | `createOrder(payload)` | `Promise<Order>` | Insert order + item-itemnya. Throw `Belum login.` kalau gak ada user. Return row order (termasuk id `CP-...`). |
| `buildWhatsappText` | `buildWhatsappText(order, items = [])` | `string` | Susun teks WA terformat (ID, detail pesanan, daftar belanja). |
| `buildWhatsappUrl` | `buildWhatsappUrl(order, items = [], adminNumber?)` | `string` | URL `https://wa.me/<no>?text=...` siap dibuka. |
| `buildSimpleWhatsappUrl` | `buildSimpleWhatsappUrl(message, adminNumber?)` | `string` | URL WA singkat tanpa order (CTA landing/hero). |
| `formatRupiah` | `formatRupiah(num)` | `string` | Format IDR via `Intl.NumberFormat`. |

`payload` untuk `createOrder`:
```jsonc
{
  "planId": 12,            // optional
  "outputType": "full",
  "items": [{ "name": "Wortel", "amount": 500, "unit": "gram",
              "category": "vegetables", "priceIdr": 8000 }],
  "totalPrice": 285000,
  "deliveryFee": 15000,    // default 15000
  "address": "...", "name": "...", "phone": "...",
  "paymentMethod": "transfer_bank",  // optional
  "notes": "..."           // optional
}
```

Konstanta diekspor: `WA_ADMIN_NUMBER` (`"6281234567890"` — ganti ke nomor asli).

---

## `aiService.js`

Fitur AI generate. `generatePlan` manggil Edge Function `generate-plan`. Sisanya baca tabel langsung (read-only via RLS).

| Fungsi | Signature | Return | Deskripsi |
|---|---|---|---|
| `generatePlan` | `generatePlan(input)` | `Promise<{ plan, reasoning, meta, planId }>` | Invoke Edge Function `generate-plan`. Ekstrak pesan error ramah dari `error.context.json()`. |
| `regenerateDay` | `regenerateDay(planId, dayIndex, { note?, mealType? })` | `Promise<{ plan, dayIndex, day, meta, planId }>` | Invoke Edge Function `regenerate-day`. Susun ulang menu 1 hari + catatan opsional; server recompute shopping_list. |
| `getGeneratedHistory` | `getGeneratedHistory(limit = 10, { successOnly = false })` | `Promise<Plan[]>` | History generate milik user, urut terbaru. `successOnly` filter `status='success'` di server. Field: `id, input_json, output_type, model, status, created_at`. |
| `getGeneratedPlanById` | `getGeneratedPlanById(id)` | `Promise<Plan>` | Satu hasil generate by id (`select *`). |
| `getTodayUsageCount` | `getTodayUsageCount()` | `Promise<number>` | Jumlah pemakaian AI hari ini (sisa kuota buat UI). |

`input` untuk `generatePlan`: `{ periode, porsi, diet[], budget, pantry[], variasiPerHari, notes, outputType }` (lihat `02-edge-functions-api.md`).

---

## `adminService.js`

Admin UI provider AI. Semua lewat Edge Function `admin-providers` (karena `ai_providers` lockdown). Helper internal `invokeAdmin(body)` ekstrak error ramah.

| Fungsi | Signature | Return | Deskripsi |
|---|---|---|---|
| `listProviders` | `listProviders()` | `Promise<Provider[]>` | List provider (key ter-mask). Return `data.providers ?? []`. |
| `createProvider` | `createProvider(provider)` | `Promise<{ ok, id }>` | Bikin provider baru. |
| `updateProvider` | `updateProvider(id, provider)` | `Promise<{ ok }>` | Update provider (api_key cuma kalau dikirim & gak masked). |
| `setActiveProvider` | `setActiveProvider(id)` | `Promise<{ ok }>` | Set provider aktif. |
| `setFallbackProvider` | `setFallbackProvider(id)` | `Promise<{ ok }>` | Set provider fallback. |
| `deleteProvider` | `deleteProvider(id)` | `Promise<{ ok }>` | Hapus provider. |
| `checkIsAdmin` | `checkIsAdmin()` | `Promise<boolean>` | Cek role user login (buat gating UI). Return `false` kalau gak login / error. |
