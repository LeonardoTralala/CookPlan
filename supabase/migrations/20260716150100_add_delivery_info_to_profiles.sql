-- =============================================================================
-- Migrasi: Tambah kolom info pengantaran (delivery) pada public.profiles
-- -----------------------------------------------------------------------------
-- Kolom baru:
--   - delivery_customer_name  : nama default penerima paket belanja
--   - delivery_customer_phone : no WA default penerima paket belanja
--   - delivery_kecamatan      : kecamatan default di Kota Malang (check constraint)
--   - delivery_detail_alamat  : detail jalan, kelurahan, no rumah, dsb.
--
-- Karena update table-level dari role `authenticated` dicabut demi keamanan,
-- kolom baru ini wajib diberi grant update secara eksplisit per-kolom.
-- =============================================================================

alter table public.profiles
  add column if not exists delivery_customer_name text,
  add column if not exists delivery_customer_phone text,
  add column if not exists delivery_kecamatan text,
  add column if not exists delivery_detail_alamat text;

-- Tambahkan check constraint untuk membatasi kecamatan ke area Kota Malang yang didukung
alter table public.profiles
  drop constraint if exists check_delivery_kecamatan;

alter table public.profiles
  add constraint check_delivery_kecamatan
  check (
    delivery_kecamatan is null 
    or delivery_kecamatan in ('Klojen', 'Blimbing', 'Lowokwaru', 'Sukun', 'Kedungkandang')
  );

-- Berikan hak update kolom baru ke role authenticated
grant update (
  delivery_customer_name,
  delivery_customer_phone,
  delivery_kecamatan,
  delivery_detail_alamat
) on public.profiles to authenticated;
