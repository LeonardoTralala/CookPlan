-- =============================================================================
-- Migrasi: akses admin ke orders + order_items (tracking pesanan di dashboard)
-- -----------------------------------------------------------------------------
-- Pesanan via WhatsApp sudah tersimpan di orders/order_items (orderService.
-- createOrder menulis SEBELUM buka WA), tapi RLS masih owner-only sehingga admin
-- tak bisa melihat pesanan user lain. Migrasi ini menambah policy admin
-- (public.is_admin()) DI SAMPING policy owner yang ada — permissive → di-OR,
-- jadi: owner ATAU admin boleh akses.
--
-- CATATAN DRIFT: tabel orders di prod dibuat manual & berbeda dari migrasi
-- 20260611000003. Kolom workflow yang BER-CONSTRAINT di prod adalah:
--   order_status  : received | processed | shipped | delivered  (default 'received')
--   payment_status: pending | completed | failed                (default 'pending')
-- Dashboard admin memakai kedua kolom itu. Kolom `status` (dari migrasi lama,
-- tanpa constraint, tak dipakai code) sengaja DIBIARKAN — konservatif, tidak
-- mengganggu skema prod yang sudah berjalan.
-- =============================================================================

-- orders: admin akses penuh (lihat + ubah status). Owner policy tetap berlaku.
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all"
  on public.orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- order_items: admin akses penuh (lihat rincian bahan tiap pesanan).
drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all"
  on public.order_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
