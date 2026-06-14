---
phase: 11
status: done
last-updated: 2026-06-14
estimated-effort: 1-2 hari
dependencies: [phase-3, phase-4]
---

# Phase 11 — Regenerate Menu Harian + Catatan

## Goal
Tambah kemampuan **mengganti (regenerate) menu satu hari** langsung dari halaman
hasil generate (`GenerateResult`), tanpa harus generate ulang seluruh plan. User
bisa menambah **catatan opsional** untuk mengarahkan AI (mis. "pengen ayam"), atau
mengosongkannya kalau cuma kurang sreg dan ingin alternatif.

Vision: di tiap kartu hari ada tombol **"Ganti Menu"**. Misal hari ke-4 kurang
cocok dan pengen ayam → tulis di catatan → AI susun ulang 3 waktu makan hari itu.
Kalau cuma bingung/ga srek, langsung generate ulang tanpa catatan.

## Latar Belakang
Branch dibuat dari `origin/main` terbaru yang sudah memuat: model **slot-based meal**
(3 waktu makan tetap per hari), input `variasiPerHari` (jumlah resep berbeda/hari)
menggantikan pilihan waktu makan, taksonomi diet via tabel `diet_tags` + kolom
`recipes.diet`, dan field `notes` di input generate. Fitur ini menyelaraskan diri
dengan semua itu (lihat ADR-013).

## Deliverables
- ✅ Edge Function baru `regenerate-day` (Deno) — proxy AI khusus 1 hari
- ✅ `_shared/shoppingList.ts` — recompute daftar belanja **deterministik** dari
  `recipe_ingredients` (server-side, tanpa token AI)
- ✅ `_shared/prompt.ts` — `REGENERATE_DAY_SYSTEM_PROMPT`, `buildRegenerateDayMessage()`,
  `sanitizeNote()` (anti prompt-injection)
- ✅ `regenerateDay()` di `src/services/aiService.js`
- ✅ UI tombol "Ganti Menu" + editor catatan per kartu hari di `GenerateResult.jsx`
- ✅ Registrasi function di `supabase/config.toml` (`verify_jwt = false`)
- ✅ Lint + build + `deno check` semua bersih

## Keputusan Desain (ringkas — detail di ADR-013)
| Aspek | Keputusan |
|-------|-----------|
| Cakupan | **Seluruh hari** (3 waktu makan). Backend siap param `mealType` opsional untuk regenerate per-waktu-makan di masa depan |
| Daftar belanja | **Recompute deterministik di server** dari `recipe_ingredients` (akurat, gratis), bukan dari AI |
| Sync planner | Bila plan sudah di-apply ke Rencana Mingguan, **re-apply otomatis** agar slot hari itu ikut update |
| Rate limit | Dihitung **1 ke kuota 20/hari yang sama** (`endpoint='regenerate-day'` di `ai_usage_log`) |
| Penyimpanan | **Update `output_json`** pada baris `generated_plans` yang sama (planId & URL tetap) — tanpa perubahan schema DB |
| Catatan user | Disanitasi (buang char kontrol, clamp 200 char) + di-frame sebagai DATA preferensi, bukan instruksi sistem |

## Alur Teknis (Edge Function `regenerate-day`)
```
auth → rate limit (20/hari, UTC) → parse body (planId, dayIndex, note?, mealType?)
  → ambil generated_plans milik user → validasi dayIndex dalam rentang
  → retrieve bank resep (diet-filtered via recipes.diet)
  → provider selection (chain priority / is_active+is_fallback)
  → AI (REGENERATE_DAY_SYSTEM_PROMPT + buildRegenerateDayMessage) → parse 1 hari (retry 1x)
  → validasi recipe_id ∈ bank → enforceVariety (isi 3 slot, set servings)
  → ganti days[dayIndex] → buildShoppingList (recompute SELURUH plan)
  → update output_json → log ai_usage_log → return { plan, day, dayIndex, meta }
```

## Catatan Implementasi
- **Reuse maksimal**: `callProvider`, `safeJsonExtract`, `estimateCost` (aiAdapter),
  `enforceVariety` (validate), `subtractPantry` (lewat shoppingList). Logika provider
  selection identik dengan `generate-plan`.
- **Parsing dua bentuk**: AI bisa balas `{ "day": {...} }` (sesuai schema) atau flat
  `{ day: "Senin", meals: [...] }`. Deteksi via keberadaan array `meals` agar string
  `day` tidak salah dijadikan objek hari.
- **Selalu log usage** (sukses/gagal) supaya regenerate tetap kena rate limit
  (filosofi sama dengan audit H2 di generate-plan).
- **Pergeseran harga**: `generate-plan` memakai harga dari AI; regenerate memakai
  recompute deterministik dari `recipe_ingredients`. Jadi angka belanja bisa sedikit
  bergeser setelah regenerate pertama — ini lebih akurat dan jadi fondasi fitur
  "Belanja Sendiri vs Belanja di Kami" berikutnya.

## Definition of Done
- Edge Function type-check (`deno check`) bersih ✅
- Frontend `npm run lint` + `npm run build` bersih ✅
- UI per-hari: tombol, editor catatan, loading per-kartu, toast sukses/error ✅
- Sync planner saat sudah applied ✅
- Pengujian end-to-end interaktif (butuh API key asli + Supabase jalan) → lihat
  [verification.md](./verification.md)

Lihat juga: ADR-013 di `00-OVERVIEW/01-decisions-log.md`,
`04-REFERENCE/02-edge-functions-api.md` (spec API), `04-REFERENCE/06-error-codes.md`.
