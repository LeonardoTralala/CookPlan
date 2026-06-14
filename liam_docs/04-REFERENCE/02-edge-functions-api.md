---
phase: reference
status: done
last-updated: 2026-06-11
---

# Spec API Edge Functions

CookPlan punya 3 Edge Function (Deno, Supabase Functions). Semuanya cuma terima `POST` (plus `OPTIONS` buat CORS preflight). CORS-nya `Access-Control-Allow-Origin: *`.

```
supabase/functions/
  generate-plan/index.ts     # proxy AI provider-agnostic
  admin-providers/index.ts   # CRUD ai_providers (admin only)
  regenerate-day/index.ts    # regenerate menu 1 hari dari plan + catatan opsional
  _shared/
    prompt.ts                # SYSTEM_PROMPT + buildUserMessage + REGENERATE_DAY_* + sanitizeNote
    aiAdapter.ts             # callProvider, safeJsonExtract, estimateCost
    validate.ts              # validateInput, validateOutput, enforceVariety, subtractPantry
    shoppingList.ts          # buildShoppingList (recompute deterministik dari recipe_ingredients)
```

---

## 1. `generate-plan`

Proxy AI provider-agnostic buat generate foodplan/foodprep. Klien gak pernah nyentuh API key.

### Flow

```
auth → rate limit → validate input → cek cache → ambil resep
  → build prompt → panggil AI (primary, fallback bila gagal)
  → parse JSON (retry 1x) → validate output → subtract pantry
  → persist (generated_plans) → log usage → return
```

### Request

`POST /functions/v1/generate-plan` (header `Authorization: Bearer <jwt>` wajib).

```jsonc
{
  "periode": 7,                 // 3 | 7 | 14 (jumlah hari)
  "porsi": 2,                   // 1..20
  "diet": ["vegetarian", "halal"],  // string[], optional
  "budget": 300000,             // IDR, >= 0
  "pantry": [                   // bahan tersedia di rumah, optional
    { "name": "Beras", "amount": 2, "unit": "kg" }
  ],
  "outputType": "full"          // foodplan | foodprep | full
}
```

### Response (200)

```jsonc
{
  "plan": {
    "plan_summary": "string",
    "days": [
      { "day": "Hari 1", "meals": [
        { "meal_type": "lunch", "recipe_id": 12, "servings": 2, "notes": "..." }
      ] }
    ],
    "shopping_list": [
      { "ingredient": "Wortel", "total_amount": 500, "unit": "gram",
        "category": "vegetables", "estimated_price_idr": 8000 }
    ],
    "prep_instructions": ["string"],
    "total_estimated_cost": 285000,
    "warnings": []
  },
  "reasoning": "string | null",   // chain-of-thought (reasoning model)
  "meta": {
    "cached": false,
    "model": "anthropic/claude-sonnet-4.5",
    "provider": "OpenRouter Sonnet 4.5",
    "latency_ms": 8421,
    "est_cost_usd": 0.012
  },
  "planId": 134
}
```

Kalau cache hit, `meta` cuma `{ cached: true, model }` dan `reasoning` diambil dari row tersimpan.

### Error Code

| HTTP | Kondisi | Pesan |
|---|---|---|
| 401 | JWT gak ada / invalid | `Tidak terautentikasi.` |
| 429 | Lebih dari 20 generate/user/hari | `Batas 20 generate per hari tercapai. Coba lagi besok.` |
| 400 | Input gagal validasi | pesan dari `validateInput()` (lihat error-codes) |
| 422 | Bank resep kosong (gak ada resep aktif) | `Bank resep kosong. Tambahkan resep dulu.` |
| 503 | Belum ada provider aktif/fallback | `Belum ada AI provider aktif. Atur di Admin.` |
| 502 | Semua provider gagal | `Semua provider AI gagal: <detail>` |
| 502 | Output bukan JSON valid setelah retry | `AI menghasilkan output tidak valid. Coba lagi.` |
| 502 | Output gagal validasi semantik | `Output AI tidak lolos validasi: <error pertama>` |
| 405 | Method bukan POST | `Method not allowed` |

Catatan: rate limit `RATE_LIMIT_PER_DAY = 20`, dihitung dari `ai_usage_log` sejak awal hari. Timeout panggilan AI 90 detik (`timeoutMs` di `callProvider`).

---

## 2. `admin-providers`

CRUD buat tabel `ai_providers` yang lockdown. **Wajib role admin** (`profiles.role = 'admin'`). API key di-mask saat list. Pakai `service_role` buat operasi DB.

### Auth gate

1. Verifikasi JWT → kalau gagal balik **401** `Tidak terautentikasi.`
2. Cek `profiles.role` via service_role → kalau bukan `admin` balik **403** `Khusus admin.`

### Request

`POST /functions/v1/admin-providers` dengan body `{ action, ... }`.

| Action | Body tambahan | Efek | Response |
|---|---|---|---|
| `list` | — | Ambil semua provider, key di-mask | `{ providers: [...] }` |
| `create` | `provider: {...}` | Insert provider baru | `{ ok: true, id }` |
| `update` | `id`, `provider: {...}` | Update field; `api_key` cuma diupdate kalau dikirim & bukan masked | `{ ok: true }` |
| `set_active` | `id` | Matiin semua `is_active`, nyalain target | `{ ok: true }` |
| `set_fallback` | `id` | Matiin semua `is_fallback`, nyalain target | `{ ok: true }` |
| `delete` | `id` | Hapus provider | `{ ok: true }` |

### Key Masking

Pas `list`, tiap provider dikembalikan dengan:

```jsonc
{
  "...": "...",
  "api_key": "sk-1••••cdef",  // maskKey(): 4 char awal + "••••" + 4 char akhir
  "_has_key": true            // flag apakah key terisi
}
```

`maskKey()`: kalau panjang <= 8 → `"••••"`, selain itu `key.slice(0,4) + "••••" + key.slice(-4)`. Plaintext **gak pernah** balik ke browser.

Pas `update`, kalau `api_key` yang dikirim mengandung `"••"` (masih masked) atau kosong, field itu **gak ditimpa** — biar admin gak sengaja overwrite key beneran dengan versi masked.

### Error Code

| HTTP | Kondisi | Pesan |
|---|---|---|
| 401 | Gak terautentikasi | `Tidak terautentikasi.` |
| 403 | Bukan admin | `Khusus admin.` |
| 400 | Body gak bisa di-parse | `Body invalid.` |
| 400 | Action gak dikenal | `Action tidak dikenal.` |
| 405 | Method bukan POST | `Method not allowed` |
| 500 | Error DB | `error.message` dari Supabase |

### Constraint penting

Karena ada unique partial index (`is_active`/`is_fallback` cuma 1 yang true), action `set_active`/`set_fallback` selalu matiin dulu semua baris lain (`update {col:false}.neq(id)`) sebelum nyalain target — biar gak nabrak unique index.

---

## 3. `regenerate-day`

Susun ulang menu **satu hari** dari sebuah plan yang sudah di-generate, dengan **catatan preferensi opsional** dari user. Tidak menyentuh hari lain. Daftar belanja seluruh plan di-recompute deterministik di server (bukan dari AI). Lihat ADR-013.

### Flow

```
auth → rate limit (20/hari, berbagi kuota dgn generate-plan) → parse body
  → ambil generated_plans milik user → validasi dayIndex
  → retrieve resep (diet-filtered via recipes.diet) → provider (chain/legacy)
  → AI (REGENERATE_DAY_SYSTEM_PROMPT + buildRegenerateDayMessage) → parse 1 hari (retry 1x)
  → validasi recipe_id ∈ bank → enforceVariety → ganti days[dayIndex]
  → buildShoppingList (recompute SELURUH plan) → update output_json → log → return
```

### Request

`POST /functions/v1/regenerate-day` (header `Authorization: Bearer <jwt>` wajib).

```jsonc
{
  "planId": 134,        // id baris generated_plans (wajib, integer > 0)
  "dayIndex": 3,        // index hari di plan.days, 0-based (wajib, >= 0)
  "note": "pengen ayam", // catatan preferensi (opsional, di-sanitasi + clamp 200 char)
  "mealType": "lunch"   // opsional: ganti 1 waktu makan saja (breakfast|lunch|dinner)
                        //   default null = ganti seluruh hari (3 waktu makan)
}
```

### Response (200)

```jsonc
{
  "plan": { "...": "output_json plan lengkap setelah hari diganti + shopping_list & total ter-recompute" },
  "dayIndex": 3,
  "day": { "day": "Kamis", "meals": [ { "meal_type": "breakfast", "recipe_id": 7, "servings": 2 } ] },
  "meta": { "model": "...", "provider": "...", "latency_ms": 8421, "est_cost_usd": 0.01 },
  "planId": 134
}
```

### Error Code

| HTTP | Kondisi | Pesan |
|---|---|---|
| 401 | JWT gak ada / invalid | `Tidak terautentikasi.` |
| 429 | Kuota 20 generate/hari habis | `Batas 20 generate per hari tercapai. Coba lagi besok.` |
| 400 | Body gak bisa di-parse | `Body invalid.` |
| 400 | `planId` bukan integer > 0 | `planId tidak valid.` |
| 400 | `dayIndex` bukan integer >= 0 | `dayIndex tidak valid.` |
| 400 | `mealType` di luar enum | `mealType tidak valid.` |
| 400 | `dayIndex` di luar rentang plan | `Hari yang diminta di luar rentang plan.` |
| 404 | Plan gak ada / bukan milik user | `Plan tidak ditemukan.` |
| 422 | Bank resep kosong | `Bank resep kosong. Tambahkan resep dulu.` |
| 503 | Belum ada provider aktif | `Belum ada AI provider aktif. Atur di Admin.` |
| 502 | Semua provider gagal | `Semua provider AI gagal: <detail>` |
| 502 | Output AI tidak valid | `AI menghasilkan output tidak valid. Coba lagi.` |
| 502 | recipe_id hasil di luar bank | `Output AI tidak lolos validasi: recipe_id <id> tidak ada di bank resep.` |
| 500 | Gagal baca / simpan plan | `Gagal memuat plan.` / `Gagal menyimpan hasil regenerate.` |
| 405 | Method bukan POST | `Method not allowed` |

### Catatan

- **Selalu** menulis ke `ai_usage_log` (`endpoint='regenerate-day'`) baik sukses maupun gagal, supaya regenerate tetap kena rate limit (filosofi sama audit H2).
- Mengupdate `output_json` baris yang sama (planId tetap) — frontend cukup mengganti `result.plan` & sessionStorage.
- `buildShoppingList()` (di `_shared/shoppingList.ts`) mengagregasi `recipe_ingredients` seluruh plan, skala per `servings / base_servings`, lalu kurangi pantry via `subtractPantry`. Item dengan unit berbeda TIDAK digabung (konversi satuan di luar scope).
