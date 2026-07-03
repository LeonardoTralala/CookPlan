---
phase: setup
status: done
last-updated: 2026-06-11
---

# 🩹 Troubleshooting

Error umum pas setup CookPlan + cara benerinnya.

## (a) "Docker not running" / "Cannot connect to the Docker daemon"

**Penyebab:** Docker Desktop belum nyala.

**Solusi:** Buka **Docker Desktop**, tunggu icon paus stabil, baru jalanin lagi:

```bash
supabase start
```

## (b) Port Conflict — 54321 / 54322 udah dipakai

**Gejala:** error "port is already allocated" pas `supabase start`.

**Penyebab:** ada instance Supabase lain yang masih nyala (atau crash dan nyangkut).

**Solusi:** matiin dulu, baru start ulang:

```bash
supabase stop
supabase start
```

## (c) Supabase config error di frontend (`.env`)

**Gejala:** app gagal connect, error soal `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` undefined.

**Penyebab:** `.env.local` belum diisi atau kosong.

**Solusi:** pastikan `.env.local` terisi dengan benar:

```bash
# .env.local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_YOUR_LOCAL_ANON_KEY
```

Ambil nilai aslinya dari `supabase status`. Habis ubah `.env.local`, **restart** `npm run dev`.

## (d) "permission denied for table ai_providers"

**Ini NORMAL, bukan bug.** ✅

Tabel `ai_providers` sengaja di-lockdown sama RLS. Klien biasa (anon) emang **gak boleh** baca tabel ini — biar API key aman. Cuma **service_role** (dipakai Edge Function) yang boleh akses.

Jadi kalau kamu lihat error ini dari klien, itu memang behavior yang diharapkan. Gak perlu dibenerin.

## (e) generate-plan: "Please pass a valid API key"

**Penyebab:** API key di `ai_providers` masih **placeholder** (bawaan seed), bukan key asli.

**Solusi:** isi API key asli. Lewat SQL di Studio (http://127.0.0.1:54323):

```sql
UPDATE ai_providers
SET api_key = '<API_KEY_ASLI>'
WHERE name = '<nama_provider>';
```

Atau lewat UI `/admin/ai` (butuh user admin). Pastikan juga `supabase functions serve` lagi jalan.

## (f) Migration error / DB berantakan

**Gejala:** error pas apply migration, atau data lokal aneh.

**Solusi:** reset DB dari nol (apply ulang semua migration + seed):

```bash
supabase db reset
```

> Ini ngehapus data lokal dan bikin ulang. Aman di lokal.

## (g) macOS gak punya command `timeout`

**Penyebab:** `timeout` itu command Linux, gak ada bawaan di macOS.

**Solusi:** buat jalanin proses di background (misal Edge Functions), pakai `nohup ... &`:

```bash
nohup supabase functions serve > functions.log 2>&1 &
```

Proses jalan di background, output masuk ke `functions.log`. Buat matiinnya, cari PID-nya:

```bash
jobs -l        # liat background job
kill <PID>     # matiin
```

## Masih Error?

- Cek versi tool lagi (`00-local-environment.md`).
- Pastikan Docker Desktop bener-bener nyala.
- Coba `supabase stop` lalu `supabase start` dari bersih.
- Liat log container kalau perlu: `supabase status` buat mastiin semua service up.
