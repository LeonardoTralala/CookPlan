-- =============================================================================
-- Migrasi: tambah status 'draft' ke orders.order_status
-- -----------------------------------------------------------------------------
-- KONTEKS: createOrder() menulis baris orders SEBELUM user benar-benar mengirim
-- pesan WhatsApp. Kalau user batal kirim, order tetap nangkring sebagai
-- 'received' → dashboard admin penuh "phantom order" & metrik konversi kotor.
--
-- Solusi: order dibuat sebagai 'draft' dulu. Baru dipromosikan ke 'received'
-- saat user menekan tombol "Buka WhatsApp" di layar konfirmasi (confirmOrderSent
-- di orderService.js). Admin & riwayat user menyembunyikan 'draft'.
--
-- Perubahan ini ADITIF (cuma melonggarkan check constraint, tidak menyentuh
-- baris lama) dan idempoten (drop+recreate constraint).
-- =============================================================================

alter table public.orders
  drop constraint if exists orders_order_status_check;

alter table public.orders
  add constraint orders_order_status_check
  check (order_status in ('draft','received','processed','shipped','delivered'));
