---
phase: 12
status: done
last-updated: 2026-06-14
---

# Phase 12 — Verification

## Lint & Build (frontend)
```
npm run lint   → bersih (0 problems)
npm run build  → sukses
                 121 modules transformed
                 dist/assets/index-*.js   329.09 kB │ gzip: 96.81 kB
                 dist/assets/index-*.css  72.78 kB  │ gzip: 12.11 kB
```

## Migrasi (prod)
`supabase/migrations/20260615000000_create_packages.sql` di-apply ke prod
`phdbbiydrjwxlehdfubh` via **Management API** (raw SQL, idempoten — sesuai ADR-011,
karena migration history prod mismatch). HTTP 201.

Hasil seed: 3 paket × 9 menu (slug `paket-hemat-3hari`, `paket-sehat-3hari`,
`paket-protein-3hari`), pakai resep 1-6 yang punya bahan + harga lengkap.

## Uji End-to-End PRODUCTION (2026-06-14) ✅
Pakai user test sementara (signup + auto-confirm admin API) yang **dihapus setelah
uji** (cascade). Tidak menyentuh data user asli.

| Skenario | Hasil |
|----------|-------|
| Embed paket → menu → resep → bahan (packageService query) | ✅ Paket Hemat: 9 slot ter-embed |
| Agregasi harga dari `recipe_ingredients` (porsi=2) | ✅ 25 bahan unik, **Rp297.000** |
| Read `packages` pakai JWT user (RLS read publik) | ✅ HTTP 200 |
| Simpan daftar belanja (insert `saved_shopping_lists`) | ✅ HTTP 201, id 1 |
| User baca daftarnya sendiri | ✅ 1 daftar ("Paket Hemat — 2 porsi", Rp297.000) |
| **RLS isolasi**: anon (tanpa login) baca saved lists | ✅ `[]` kosong (RLS blokir) |
| Hapus daftar | ✅ HTTP 204 |
| Cleanup user test | ✅ user + data cascade terhapus, `saved_shopping_lists` */0 |
| Paket tetap utuh (deliverable) | ✅ 3 paket masih ada |

## Belum diuji via UI browser
Logika sudah ter-cover build + uji REST/RLS langsung. Disarankan smoke test klik
manual saat rilis:
- [ ] Switch tab Belanja Sendiri ↔ Belanja di Kami
- [ ] Pilih paket + ubah stepper porsi → harga ikut berubah
- [ ] Tombol "Pesan via WhatsApp" buka wa.me dengan teks order
- [ ] Simpan daftar dari kedua tab → muncul di "Daftar Tersimpan"
- [ ] Buka modal daftar tersimpan & hapus

## Catatan
- Order "Belanja di Kami" reuse `orderService.createOrder` (planId=null,
  outputType='package'). Order tetap tercatat di tabel `orders` + `order_items`.
- Harga = agregasi `recipe_ingredients` (bukan kolom statis), konsisten dgn daftar belanja.

## Status: ✅ PHASE 12 DONE — kode bersih + uji E2E prod lulus
