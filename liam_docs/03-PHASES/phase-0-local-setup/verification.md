---
phase: 0
status: done
last-updated: 2026-06-11
---

# Phase 0 — Verification

## Prerequisites
```
node    v25.9.0   ✅
npm     11.12.1   ✅
docker  29.2.1    ✅ (running)
supabase 2.105.0  ✅ (installed via brew)
```

## Supabase Local Stack
`supabase status`:
```
Studio       http://127.0.0.1:54323
API          http://127.0.0.1:54321
DB           postgresql://postgres:postgres@127.0.0.1:54322/postgres
Edge Func    http://127.0.0.1:54321/functions/v1
Publishable  sb_publishable_YOUR_LOCAL_ANON_KEY (LOCAL only)
```

## Tabel Terverifikasi
```sql
\dt public.*
-- public | preregistrations | table
-- public | profiles         | table
```
Migrasi existing ter-apply otomatis saat `supabase start`. ✅

## Frontend
```
npm run dev → VITE v8.0.14 ready
curl localhost:5173 → HTTP 200 ✅
```

## Catatan
- `.env.local` dibuat (cocok pattern `*.local` di .gitignore, aman tidak ke-commit).
- Kredensial di atas adalah **kredensial LOCAL** (default Supabase CLI), bukan rahasia
  production. Aman ditulis di docs.
- Dev server dimatikan setelah verifikasi untuk hemat resource.
