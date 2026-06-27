-- =============================================================================
-- Migrasi: Ukuran kemasan jual (pack size) untuk bumbu dapur "add-on"
-- -----------------------------------------------------------------------------
-- Fitur "Belanja di Kami" menawarkan bumbu pokok (garam, minyak, dll) sebagai
-- ADD-ON OPSIONAL: tak masuk harga paket, tapi bisa dicentang pembeli untuk
-- dibelikan sekalian di satuan jual terkecil (mis. 1 botol minyak).
--
-- Single source of truth tetap dijaga: harga add-on = pack_size × price_per_base
-- (kolom TERHITUNG `pack_price_idr`), jadi tak ada harga retail manual yang bisa
-- desync dari master harga. Hanya ukuran kemasan yang baru (1 angka per bahan).
-- =============================================================================

-- 1) Kolom ukuran kemasan + label tampilan --------------------------------------
alter table public.ingredients
  add column if not exists pack_size  numeric,  -- ukuran kemasan jual terkecil, dalam base_unit
  add column if not exists pack_label text;      -- label satuan jual: 'botol' | 'bungkus' | 'kg' | 'sachet'

comment on column public.ingredients.pack_size is
  'Ukuran kemasan jual terkecil (dalam base_unit). NULL = tak ditawarkan sbg add-on.';

-- 2) Harga kemasan = TERHITUNG dari master harga (bukan disimpan manual) ---------
alter table public.ingredients drop column if exists pack_price_idr;
alter table public.ingredients
  add column pack_price_idr numeric
  generated always as (
    case
      when pack_size is not null and price_per_base is not null
      then round(pack_size * price_per_base)
    end
  ) stored;
comment on column public.ingredients.pack_price_idr is
  'Harga 1 kemasan (terhitung): pack_size × price_per_base. Sumber tunggal harga.';

-- 3) Seed ukuran kemasan untuk bumbu dapur yang ditawarkan ----------------------
-- Dicocokkan ke nama ter-normalisasi (lower+trim) agar kena varian ejaan apa pun
-- yang ada di master. Penyedap sengaja DILEWATI (price_per_base masih NULL).
update public.ingredients set pack_size = 250,  pack_label = 'bungkus'
  where lower(trim(name)) in ('garam','garam halus','garam dapur');
update public.ingredients set pack_size = 1000, pack_label = 'kg'
  where lower(trim(name)) in ('gula','gula pasir','gula putih');
update public.ingredients set pack_size = 1000, pack_label = 'botol'
  where lower(trim(name)) in ('minyak','minyak goreng','minyak sayur');
update public.ingredients set pack_size = 4,    pack_label = 'sachet'
  where lower(trim(name)) in ('merica','merica bubuk','lada','lada bubuk');
update public.ingredients set pack_size = 100,  pack_label = 'bungkus'
  where lower(trim(name)) in ('kaldu bubuk','kaldu ayam bubuk','kaldu sapi bubuk','kaldu jamur bubuk');

-- Catatan RLS: public.ingredients sudah read-publik + admin-write (migrasi
-- 20260622000000). Kolom baru ikut kebijakan tabel — tak perlu policy tambahan.
