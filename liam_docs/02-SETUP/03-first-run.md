---
phase: setup
status: done
last-updated: 2026-06-11
---

# 🚀 First Run — Dari Clone ke Jalan

Langkah lengkap pertama kali setup CookPlan di mesin baru. Pastikan prerequisites (`00-local-environment.md`) udah keinstall semua.

## Langkah-Langkah

### 1. Install Dependency

```bash
npm install
```

Install semua package frontend dari `package.json`.

### 2. Pastikan Docker Nyala

Buka **Docker Desktop**, tunggu sampai icon paus stabil (gak loading). Wajib ini dulu, kalau nggak `supabase start` bakal gagal.

### 3. Nyalain Supabase Local

```bash
supabase start
```

> Pertama kali bakal lama (~5-10 menit) karena download Docker image. Sabar ya. Habis selesai, dia print kredensial.

### 4. Copy Kredensial ke `.env.local`

Liat output `supabase start` (atau jalanin `supabase status` lagi), lalu bikin file `.env.local`:

```bash
# .env.local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_YOUR_LOCAL_ANON_KEY
```

> Detail soal env ada di `02-env-configuration.md`.

### 5. Seed Database

```bash
supabase db reset
```

Ini apply semua migration + jalanin `seed.sql` (6 resep + 2 config ai_providers).

### 6. Jalanin Dev Server

```bash
npm run dev
```

Vite nyalain dev server di **port 5173**.

### 7. Buka di Browser

Buka [http://localhost:5173](http://localhost:5173). Aplikasi harusnya udah jalan dan kebaca resep dari seed.

### 8. (Opsional) Aktifin Fitur AI

Buat fitur generate meal plan, jalanin Edge Functions di terminal terpisah:

```bash
supabase functions serve
```

Lalu isi **API key asli** provider AI (default-nya cuma placeholder). Lewat SQL di Studio (http://127.0.0.1:54323):

```sql
UPDATE ai_providers
SET api_key = '<API_KEY_ASLI>'
WHERE name = '<nama_provider>';
```

Atau lewat UI `/admin/ai` (butuh user admin — liat bawah).

## Bikin User Admin

Buat akses halaman admin (`/admin/ai`), kamu butuh user dengan role `admin`. Langkahnya:

1. Daftar user biasa dulu lewat aplikasi (signup di localhost:5173).
2. Ambil UUID user-nya dari tabel `auth.users` atau `profiles` di Studio.
3. Update role-nya jadi admin lewat SQL Editor di Studio:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = '<uuid_user_kamu>';
```

Habis itu login ulang, dan kamu bisa akses `/admin/ai`.

## Cek Sebelum Commit

Sebelum push, jalanin:

```bash
npm run lint    # cek lint error
npm run build   # pastikan build sukses
```

Kalau ada error pas setup, cek `04-troubleshooting.md`.
