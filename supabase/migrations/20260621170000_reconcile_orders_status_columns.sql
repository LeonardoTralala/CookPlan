-- =============================================================================
-- Migrasi: rekonsiliasi kolom workflow orders (status pengiriman & pembayaran)
-- -----------------------------------------------------------------------------
-- MASALAH: tabel `orders` di prod dibuat manual sebelum migrasi 20260611000003
-- dijalankan, sehingga kolom workflow yang dipakai kode dashboard admin
-- (`adminOrderService.js`) — `order_status`, `payment_status`, dan `service_fee`
-- — HANYA ada di prod, tidak di file migrasi. Akibatnya database baru yang
-- dibangun dari migrasi (dev lokal / fresh project / CI) TIDAK punya kolom itu,
-- jadi halaman /admin/orders dan /profile?tab=orders gagal query.
--
-- Migrasi ini menambahkan kolom + constraint + index tersebut secara IDEMPOTEN
-- sehingga: no-op total di prod (sudah ada), dan mereproduksi skema prod di DB
-- baru. Dengan begitu migrasi == prod dan environment jadi reproducible.
--
-- Kolom lama `orders.status` (dari migrasi 000003, tanpa constraint, tak dipakai
-- kode) SENGAJA tidak di-drop di sini — project Supabase ini dipakai bersama,
-- drop kolom butuh konfirmasi tim. `order_status` adalah sumber kebenaran
-- workflow pengiriman; `status` dibiarkan sebagai legacy nullable-by-default.
-- =============================================================================

-- 1) Kolom workflow + biaya ------------------------------------------------------
-- Nullable + default mengikuti skema prod (kode menangani null via `?? 'received'`).
alter table public.orders
  add column if not exists order_status   text    default 'received',
  add column if not exists payment_status text    default 'pending',
  add column if not exists service_fee    integer default 15000;

comment on column public.orders.order_status is
  'Status pengiriman (sumber kebenaran workflow): received|processed|shipped|delivered.';
comment on column public.orders.payment_status is
  'Status pembayaran: pending|completed|failed.';
comment on column public.orders.service_fee is
  'Biaya layanan (legacy, belum dipakai kode — disimpan untuk paritas skema prod).';

-- 2) Check constraints (Postgres tak punya ADD CONSTRAINT IF NOT EXISTS) ----------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_order_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_order_status_check
      check (order_status in ('received','processed','shipped','delivered'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('pending','completed','failed'));
  end if;
end $$;

-- 3) Index untuk filter status di dashboard admin --------------------------------
create index if not exists orders_order_status_idx on public.orders (order_status);
