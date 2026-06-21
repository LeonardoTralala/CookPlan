-- =============================================================================
-- Migrasi: validasi harga sisi-server untuk orders / order_items
-- -----------------------------------------------------------------------------
-- MASALAH: createOrder() mengirim total_price, delivery_fee, dan price_idr per
-- item dari KLIEN. Tanpa otoritas server, klien usil bisa mengirim total 0 /
-- biaya antar 0 / harga negatif, dan total ringkasan bisa beda dari rincian item.
--
-- KETERBATASAN yang disadari: item belanja masih teks bebas (name/amount/unit)
-- hasil estimasi AI, BELUM tertaut ke master `ingredients`, sehingga server tak
-- bisa menghitung ulang harga tiap item dari sumber tepercaya. Yang BISA dijamin
-- server (dan dikerjakan di sini):
--   a) delivery_fee ditentukan server saat INSERT (flat MVP), bukan dari klien.
--   b) total_price SELALU = SUM(order_items.price_idr) → ringkasan == rincian,
--      diturunkan server lewat trigger (klien tak bisa mengklaim total palsu).
--   c) harga tak boleh negatif (CHECK + guard).
-- Penautan item→ingredients untuk harga kanonik penuh = pekerjaan terpisah.
-- =============================================================================

-- 1) Harga item tak boleh negatif -----------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_price_nonneg'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_price_nonneg check (price_idr >= 0);
  end if;
end $$;

-- 2) Saat INSERT order: delivery_fee ditetapkan server, total_price tak negatif -
-- BEFORE INSERT saja: edit oleh admin (UPDATE) tetap bebas menyesuaikan biaya.
create or replace function public.orders_enforce_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Biaya antar otoritas server (flat MVP = 15000), abaikan nilai dari klien.
  new.delivery_fee := 15000;
  if coalesce(new.total_price, 0) < 0 then
    raise exception 'total_price tidak boleh negatif';
  end if;
  new.total_price := coalesce(new.total_price, 0);
  return new;
end;
$$;

drop trigger if exists orders_enforce_costs_ins on public.orders;
create trigger orders_enforce_costs_ins
  before insert on public.orders
  for each row execute function public.orders_enforce_costs();

-- Fungsi trigger dijalankan oleh mekanisme trigger (sebagai owner), bukan
-- dipanggil langsung. Cabut EXECUTE PUBLIC bawaan agar tak terekspos sebagai
-- /rest/v1/rpc yang bisa dipanggil anon/authenticated.
revoke execute on function public.orders_enforce_costs() from public, anon, authenticated;

-- 3) total_price diturunkan dari SUM(order_items.price_idr) ----------------------
-- Setiap perubahan item menyinkronkan ulang total order → ringkasan == rincian,
-- dan klien tak bisa menyetel total lebih kecil dari jumlah harga item.
create or replace function public.order_items_sync_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  oid text := coalesce(new.order_id, old.order_id);
begin
  update public.orders o
     set total_price = coalesce(
       (select sum(price_idr) from public.order_items where order_id = oid), 0
     )
   where o.id = oid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists order_items_sync_total_aiud on public.order_items;
create trigger order_items_sync_total_aiud
  after insert or update or delete on public.order_items
  for each row execute function public.order_items_sync_total();

revoke execute on function public.order_items_sync_total() from public, anon, authenticated;
