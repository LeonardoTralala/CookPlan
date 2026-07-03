---
phase: setup
status: done
last-updated: 2026-06-11
---

# 🔐 Env Configuration

Cara setting environment variable di CookPlan, dan kenapa AI key **gak** masuk ke env.

## `.env` vs `.env.local`

| File | Fungsi | Di-commit? |
|------|--------|------------|
| `.env` | Template / placeholder buat production. Isinya contoh nilai. | Ya (gak ada rahasia) |
| `.env.local` | Config buat **local dev**. Override `.env`. | **TIDAK** — gitignored via `*.local` |

Vite otomatis baca `.env.local` dan nge-override nilai dari `.env`. Jadi buat dev lokal, cukup isi `.env.local`.

> `.env.local` udah otomatis di-ignore Git lewat pattern `*.local` di `.gitignore`. Aman, gak bakal ke-push.

## Isi `.env.local` untuk Local Dev

Ambil nilai dari output `supabase status`:

```bash
# .env.local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_YOUR_LOCAL_ANON_KEY
```

Cuma 2 variabel ini yang dibutuhin frontend buat connect ke Supabase local.

## Kenapa Prefix `VITE_`?

Vite **cuma nge-bundle** env variable yang diawali `VITE_` ke dalam kode browser. Variabel tanpa prefix ini **gak akan** kebawa ke bundle frontend.

Artinya: apapun yang ber-prefix `VITE_` itu **kelihatan publik** di browser (siapapun bisa lihat lewat DevTools). Makanya:

- ✅ `VITE_SUPABASE_ANON_KEY` → aman, karena anon key emang **publik** dan dibatasin sama Row Level Security.
- ❌ Service role key / API key AI → **JANGAN** pernah pakai prefix `VITE_`. Itu bakal kebongkar ke publik.

## API Key AI Disimpan Di Mana?

API key provider AI **TIDAK** disimpan di `.env` sama sekali. Dia disimpan di tabel database **`ai_providers`** (server-side).

Alurnya:

```
Browser  →  Edge Function (generate-plan)  →  baca ai_providers (pakai service_role)  →  panggil API AI
```

- Edge Function akses tabel `ai_providers` pakai **service_role** (server-side, gak kebongkar).
- Tabel `ai_providers` di-lockdown sama RLS — klien biasa (anon) **gak boleh** baca. Ini sengaja, biar API key aman.

Jadi key AI gak pernah nyentuh browser. 

## Cara Ganti API Key AI

Seed default ngisi `ai_providers` dengan **API key placeholder** (bukan key asli). Buat fitur AI jalan beneran, ganti dulu:

**Opsi A — lewat UI admin:**

Buka `/admin/ai` (harus login sebagai user admin), lalu update key provider di sana.

**Opsi B — lewat SQL langsung:**

```sql
UPDATE ai_providers
SET api_key = '<API_KEY_ASLI_KAMU>'
WHERE name = '<nama_provider>';
```

Jalanin SQL-nya lewat Studio (http://127.0.0.1:54323) di tab SQL Editor.

> Selama key masih placeholder, `generate-plan` bakal balikin error "Please pass a valid API key". Liat `04-troubleshooting.md`.
