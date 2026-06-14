---
phase: reference
status: done
last-updated: 2026-06-11
---

# Daftar Error Code

Kumpulan semua pesan error + HTTP code di CookPlan, dari Edge Function sampai service layer. Berguna buat debugging dan handling error di UI.

---

## Edge Function: `generate-plan`

| HTTP | Pesan | Sumber / Kondisi |
|---|---|---|
| 405 | `Method not allowed` | method bukan POST |
| 401 | `Tidak terautentikasi.` | JWT gak ada / invalid (`auth.getUser` gagal) |
| 429 | `Batas 20 generate per hari tercapai. Coba lagi besok.` | `ai_usage_log` >= `RATE_LIMIT_PER_DAY` (20) hari ini |
| 400 | `Input tidak valid.` | `validateInput`: raw bukan objek |
| 400 | `Periode harus 3, 7, atau 14 hari.` | `validateInput`: periode invalid |
| 400 | `Jumlah porsi harus antara 1 dan 20.` | `validateInput`: porsi di luar 1..20 |
| 400 | `Budget tidak valid.` | `validateInput`: budget bukan number / negatif |
| 400 | `Jenis output tidak valid.` | `validateInput`: outputType bukan foodplan/foodprep/full |
| 422 | `Bank resep kosong. Tambahkan resep dulu.` | gak ada resep aktif kandidat |
| 503 | `Belum ada AI provider aktif. Atur di Admin.` | gak ada provider `is_active` maupun `is_fallback` |
| 502 | `Semua provider AI gagal: <detail>` | primary + fallback dua-duanya throw |
| 502 | `AI menghasilkan output tidak valid. Coba lagi.` | output bukan JSON valid setelah retry 1x |
| 502 | `Output AI tidak lolos validasi: <error pertama>` | `validateOutput` gagal (mis. recipe_id invalid) |

### Error internal dari `aiAdapter.callProvider` (jadi bagian dari pesan 502)

| Pesan | Kondisi |
|---|---|
| `Provider <label> HTTP <status>: <body 300 char>` | response provider `!res.ok` |
| `Provider <label> mengembalikan content kosong.` | `choices[0].message.content` kosong |
| (AbortError) | timeout 90 detik |

---

## Edge Function: `admin-providers`

| HTTP | Pesan | Kondisi |
|---|---|---|
| 405 | `Method not allowed` | method bukan POST |
| 401 | `Tidak terautentikasi.` | JWT gak ada / invalid |
| 403 | `Khusus admin.` | `profiles.role != 'admin'` |
| 400 | `Body invalid.` | body gak bisa di-`json()` |
| 400 | `Action tidak dikenal.` | action bukan list/create/update/set_active/set_fallback/delete |
| 500 | `<error.message>` | error DB Supabase (insert/update/delete/select) |

---

## Edge Function: `regenerate-day`

| HTTP | Pesan | Kondisi |
|---|---|---|
| 405 | `Method not allowed` | method bukan POST |
| 401 | `Tidak terautentikasi.` | JWT gak ada / invalid |
| 429 | `Batas 20 generate per hari tercapai. Coba lagi besok.` | kuota harian habis (berbagi dgn generate-plan) |
| 400 | `Body invalid.` | body gak bisa di-`json()` |
| 400 | `planId tidak valid.` | planId bukan integer > 0 |
| 400 | `dayIndex tidak valid.` | dayIndex bukan integer >= 0 |
| 400 | `mealType tidak valid.` | mealType di luar breakfast/lunch/dinner |
| 400 | `Hari yang diminta di luar rentang plan.` | dayIndex >= jumlah hari di plan |
| 404 | `Plan tidak ditemukan.` | plan gak ada / bukan milik user |
| 422 | `Bank resep kosong. Tambahkan resep dulu.` | gak ada resep aktif |
| 503 | `Belum ada AI provider aktif. Atur di Admin.` | gak ada provider |
| 502 | `Semua provider AI gagal: <detail>` | semua provider error |
| 502 | `AI menghasilkan output tidak valid. Coba lagi.` | output bukan objek hari valid setelah retry |
| 502 | `Output AI tidak lolos validasi: recipe_id <id> tidak ada di bank resep.` | AI mengarang resep |
| 500 | `Gagal memuat plan.` / `Gagal menyimpan hasil regenerate.` | error DB baca/tulis |

---

## Service Layer (frontend)

Pesan ini di-throw sebagai `Error` dari fungsi service. UI nangkap lewat try/catch.

### `planService.js`

| Pesan | Sumber |
|---|---|
| `Belum login.` | `getCurrentPlan`: gak ada user |
| `Hari atau jenis makan tidak valid.` | `setSlot`: day gak di `DAYS` atau mealType gak di `MEAL_TYPES` |
| (re-throw Supabase error) | query gagal (`error` dari supabase-js) |

### `orderService.js`

| Pesan | Sumber |
|---|---|
| `Belum login.` | `createOrder`: gak ada user |
| (re-throw Supabase error) | insert orders/order_items gagal |

### `aiService.js`

| Pesan | Sumber |
|---|---|
| `Gagal generate plan.` | `generatePlan`: fallback kalau `error.message` kosong |
| (pesan dari `error.context.json().error`) | `generatePlan`: pesan ramah dari Edge Function |
| (re-throw Supabase error) | `getGeneratedHistory` / `getGeneratedPlanById` / `getTodayUsageCount` gagal |

### `adminService.js`

| Pesan | Sumber |
|---|---|
| `Operasi admin gagal.` | `invokeAdmin`: fallback kalau `error.message` kosong |
| (pesan dari `error.context.json().error`) | `invokeAdmin`: pesan ramah dari Edge Function |

> Pola umum service AI/admin: kalau `supabase.functions.invoke` balik `error`, fungsi nyoba ekstrak `error.context.json().error` (pesan ramah dari Edge Function), kalau gagal pakai `error.message`, kalau itu juga kosong pakai pesan fallback.

---

## Error DB Postgres yang relevan

| Code | Kondisi | Penanganan |
|---|---|---|
| `23505` | unique violation | `preregistrations`: email dobel → klien tampilkan "sudah terdaftar". Juga relevan buat unique `is_active`/`is_fallback` di `ai_providers`. |
