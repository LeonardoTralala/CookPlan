-- =============================================================================
-- Migrasi: jadikan sinkronisasi total_price level-statement (bukan per-baris)
-- -----------------------------------------------------------------------------
-- KONTEKS: migrasi 20260622010000 memasang order_items_sync_total sebagai trigger
-- FOR EACH ROW. Saat order_items di-insert massal (N item per pesanan), trigger
-- menembak N kali — tiap kali SUM seluruh item + UPDATE orders (O(N^2) sia-sia).
-- Selain itu, pada UPDATE yang memindah order_id, hanya order baru yang dihitung
-- ulang; order lama menyisakan item yang sudah pindah di totalnya.
--
-- PERBAIKAN (best practice): trigger FOR EACH STATEMENT + transition tables.
-- Menembak SEKALI per statement, menghitung ulang hanya order_id terdampak, dan
-- pada UPDATE menyertakan order lama MAUPUN baru (gabungan new_rows ∪ old_rows).
-- Tiga trigger terpisah per event karena transition table yang tersedia berbeda
-- (INSERT→new, DELETE→old, UPDATE→keduanya); satu fungsi bercabang via TG_OP.
-- =============================================================================

create or replace function public.order_items_sync_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Recompute total hanya untuk order yang itemnya berubah di statement ini.
  -- Cabang TG_OP memastikan transition table yang dibaca = yang dideklarasikan
  -- trigger pemanggil (new_rows untuk INSERT, old_rows untuk DELETE, keduanya
  -- untuk UPDATE) sehingga tak pernah merujuk relasi yang tak tersedia.
  if tg_op = 'INSERT' then
    update public.orders o
       set total_price = coalesce((select sum(price_idr) from public.order_items where order_id = o.id), 0)
     where o.id in (select distinct order_id from new_rows);
  elsif tg_op = 'DELETE' then
    update public.orders o
       set total_price = coalesce((select sum(price_idr) from public.order_items where order_id = o.id), 0)
     where o.id in (select distinct order_id from old_rows);
  else -- UPDATE
    update public.orders o
       set total_price = coalesce((select sum(price_idr) from public.order_items where order_id = o.id), 0)
     where o.id in (
       select order_id from new_rows
       union
       select order_id from old_rows
     );
  end if;
  return null;
end;
$$;

-- Ganti trigger per-baris lama dengan tiga trigger level-statement.
drop trigger if exists order_items_sync_total_aiud on public.order_items;

drop trigger if exists order_items_sync_total_ins on public.order_items;
create trigger order_items_sync_total_ins
  after insert on public.order_items
  referencing new table as new_rows
  for each statement execute function public.order_items_sync_total();

drop trigger if exists order_items_sync_total_del on public.order_items;
create trigger order_items_sync_total_del
  after delete on public.order_items
  referencing old table as old_rows
  for each statement execute function public.order_items_sync_total();

drop trigger if exists order_items_sync_total_upd on public.order_items;
create trigger order_items_sync_total_upd
  after update on public.order_items
  referencing new table as new_rows old table as old_rows
  for each statement execute function public.order_items_sync_total();

-- Fungsi trigger tak dipanggil langsung; cabut EXECUTE PUBLIC bawaan (idempoten,
-- CREATE OR REPLACE mempertahankan ACL lama tapi kita tegaskan ulang).
revoke execute on function public.order_items_sync_total() from public, anon, authenticated;
