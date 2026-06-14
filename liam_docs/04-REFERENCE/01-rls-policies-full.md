---
phase: reference
status: done
last-updated: 2026-06-11
---

# RLS Policy Lengkap CookPlan

Semua tabel di CookPlan pakai Row Level Security (RLS). Di Supabase, tabel baru yang RLS-nya aktif itu **deny-all by default**, jadi tiap akses dari klien wajib punya policy eksplisit. `service_role` (dipakai Edge Function) selalu bypass RLS.

Dokumen ini ngerangkum semua policy per tabel plus alasannya, ditutup matriks akses.

---

## Matriks Akses

Legenda: ✅ = boleh, ❌ = ditolak, ⚙️ = lewat Edge Function (service_role), 📝 = ada syarat (lihat detail).

| Tabel | anon | authenticated | service_role |
|---|---|---|---|
| `profiles` | ❌ | 📝 baca/insert/update miliknya sendiri | ✅ |
| `preregistrations` | 📝 INSERT only | 📝 INSERT only | ✅ (baca via dashboard) |
| `recipes` | 📝 SELECT (is_active) | 📝 SELECT + write kalau admin | ✅ |
| `recipe_ingredients` | 📝 SELECT | 📝 SELECT + write kalau admin | ✅ |
| `weekly_plans` | ❌ | 📝 ALL miliknya sendiri | ✅ |
| `meal_entries` | ❌ | 📝 ALL via kepemilikan plan | ✅ |
| `orders` | ❌ | 📝 ALL miliknya sendiri | ✅ |
| `order_items` | ❌ | 📝 ALL via kepemilikan order | ✅ |
| `ai_providers` | ❌ **LOCKDOWN** | ❌ **LOCKDOWN** | ⚙️ ✅ |
| `generated_plans` | ❌ | 📝 SELECT miliknya | ✅ (insert/update) |
| `ai_usage_log` | ❌ | 📝 SELECT miliknya | ✅ (insert) |

---

## `profiles`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `profiles_select_own` | SELECT | (default) | `auth.uid() = id` |
| `profiles_insert_own` | INSERT | (default) | `with check auth.uid() = id` |
| `profiles_update_own` | UPDATE | (default) | `using` + `with check auth.uid() = id` |

**Reasoning:** user cuma boleh lihat/ubah profilnya sendiri. Insert otomatis pas registrasi dilakukan trigger `handle_new_user()` (SECURITY DEFINER) jadi gak bergantung ke policy ini. Bisa dilonggarkan ke `using (true)` kalau nanti perlu profil publik antar user.

---

## `preregistrations`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `preregistrations_insert_public` | INSERT | anon, authenticated | validasi format: panjang name/email/city, regex email, panjang phone/kecamatan/user_type |

**Reasoning:** form daftar tunggu itu publik, jadi pengunjung anonim harus bisa INSERT. Tapi **gak ada policy SELECT/UPDATE/DELETE**, jadi email/no. HP pendaftar lain gak kebaca dari klien. Cuma `service_role` (dashboard) yang bisa baca. `with check` validasi sisi-server biar anon gak kirim data sampah. Grant cuma `INSERT` (bukan SELECT).

---

## `recipes`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `recipes_read_public` | SELECT | anon, authenticated | `is_active = true` |
| `recipes_admin_write` | ALL | authenticated | `using` + `with check public.is_admin()` |

**Reasoning:** resep boleh dibaca publik (buat katalog landing page), tapi cuma yang `is_active`. Write (tambah/edit/hapus) khusus admin lewat helper `is_admin()`.

---

## `recipe_ingredients`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `recipe_ingredients_read_public` | SELECT | anon, authenticated | `true` |
| `recipe_ingredients_admin_write` | ALL | authenticated | `public.is_admin()` |

**Reasoning:** sama kayak recipes — read publik, write khusus admin.

---

## `weekly_plans`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `weekly_plans_owner` | ALL | authenticated | `(select auth.uid()) = user_id` (using + with check) |

**Reasoning:** rencana mingguan privat per user, semua operasi dibatasi ke pemilik. Pakai `(select auth.uid())` (subquery) buat optimasi performa policy (di-cache per statement).

---

## `meal_entries`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `meal_entries_owner` | ALL | authenticated | `EXISTS (select 1 from weekly_plans p where p.id = plan_id and p.user_id = auth.uid())` |

**Reasoning:** slot menu ngikut kepemilikan plan induknya. Dicek lewat subquery EXISTS ke `weekly_plans`.

---

## `orders`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `orders_owner` | ALL | authenticated | `(select auth.uid()) = user_id` (using + with check) |

**Reasoning:** pesanan privat per user.

---

## `order_items`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `order_items_owner` | ALL | authenticated | `EXISTS (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())` |

**Reasoning:** item ngikut kepemilikan order induknya.

---

## `ai_providers` — LOCKDOWN TOTAL

```sql
revoke all on public.ai_providers from anon, authenticated;
```

**Reasoning (PENTING):** tabel ini nyimpen **API key** provider AI. Gak ada satu pun policy buat `anon`/`authenticated`, malah hak akses dicabut total (`revoke all`). Artinya:

- Klien (browser) **gak bisa baca** tabel ini sama sekali, bahkan kalau login.
- Cuma `service_role` (yang bypass RLS otomatis) yang bisa baca — dipakai Edge Function `generate-plan` buat ambil config provider.
- Admin UI **gak akses langsung** ke tabel ini. Semua operasi CRUD lewat Edge Function `admin-providers` yang memvalidasi `is_admin()` di dalam function dan me-mask API key sebelum dibalikin ke browser.

Ini lapisan keamanan inti: API key gak akan pernah bocor ke klien dalam kondisi apa pun.

---

## `generated_plans`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `generated_plans_select_own` | SELECT | authenticated | `(select auth.uid()) = user_id` |

**Reasoning:** user read-only ke history generate miliknya sendiri. Insert/update cuma dilakukan Edge Function (`service_role`), gak ada policy write buat klien.

---

## `ai_usage_log`

| Policy | Operasi | Role | Kondisi |
|---|---|---|---|
| `ai_usage_log_select_own` | SELECT | authenticated | `(select auth.uid()) = user_id` |

**Reasoning:** user bisa baca log pemakaian sendiri (buat lihat sisa kuota). Insert cuma lewat Edge Function (`service_role`).

---

## Catatan Fungsi Keamanan

| Fungsi | Properti | Grant |
|---|---|---|
| `is_admin()` | SECURITY DEFINER, stable, `search_path=''` | revoke dari public/anon; grant ke authenticated |
| `handle_new_user()` | SECURITY DEFINER, `search_path=public` | revoke execute dari public/anon/authenticated (trigger tetap jalan) |
| `set_updated_at()` | trigger, `search_path=''` | — |
| `generate_order_id()` | SECURITY DEFINER, `search_path=''` | grant ke authenticated (migration 0005), revoke dari anon |

`search_path` dikunci di semua fungsi buat cegah search_path hijacking (advisor 0011).

---

## RLS Phase 12 — Paket "Belanja di Kami"

| Tabel | Policy | Operasi | Role | Aturan |
|---|---|---|---|---|
| `packages` | `packages_read_public` | SELECT | anon, authenticated | `is_active = true` |
| `packages` | `packages_admin_write` | ALL | authenticated | `is_admin()` (using + check) |
| `package_meals` | `package_meals_read_public` | SELECT | anon, authenticated | `true` |
| `package_meals` | `package_meals_admin_write` | ALL | authenticated | `is_admin()` |
| `saved_shopping_lists` | `saved_lists_owner` | ALL | authenticated | `auth.uid() = user_id` (using + check) |

Pola sama `recipes`/`diet_tags` (read publik + admin write) & `weekly_plans`
(owner-only). Diuji: anon baca `saved_shopping_lists` → `[]` (RLS blokir), user
hanya lihat miliknya sendiri. Lihat `phase-12-paket-belanja/verification.md`.
