-- =============================================================================
-- Migrasi: Penyesuaian biaya pengantaran per kecamatan di Kota Malang
-- -----------------------------------------------------------------------------
-- Mengizinkan delivery_fee dinamis yang dikirimkan klien (sesuai kecamatan tujuan:
-- Blimbing 5.000, Lowokwaru 8.000, Klojen 12.000, Kedungkandang 15.000, Sukun 15.000,
-- atau 0 untuk pengguna gratis ongkir CookPass Pro).
-- Menjaga total_price dan delivery_fee tetap tidak negatif.
-- =============================================================================

create or replace function public.orders_enforce_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Biaya antar: gunakan nilai dari klien jika disediakan dan valid (non-negatif),
  -- default ke 15000 jika null/kosong.
  if new.delivery_fee is null then
    new.delivery_fee := 15000;
  elsif new.delivery_fee < 0 then
    raise exception 'delivery_fee tidak boleh negatif';
  end if;

  if coalesce(new.total_price, 0) < 0 then
    raise exception 'total_price tidak boleh negatif';
  end if;
  new.total_price := coalesce(new.total_price, 0);
  return new;
end;
$$;
