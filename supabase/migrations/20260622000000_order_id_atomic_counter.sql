-- =============================================================================
-- Migrasi: ID pesanan atomik & anti-tabrakan (CP-YYYYMMDD-XXXX)
-- -----------------------------------------------------------------------------
-- MASALAH pada generate_order_id() lama:
--   1) SECURITY INVOKER + `select count(*) from orders ...` → hitungan dijalankan
--      di bawah RLS pemanggil, jadi tiap user HANYA melihat order miliknya. Order
--      pertama setiap user di hari yang sama sama-sama dapat seq 1 → CP-…-0001
--      bentrok antar-user (id = PK) → INSERT user kedua GAGAL.
--   2) Berbasis count(*): begitu draft dihapus, nomor dipakai ulang → bentrok
--      dengan order lama.
--   3) Race: dua INSERT bersamaan membaca count() yang sama → seq kembar.
--
-- SOLUSI: counter harian monotonik di tabel khusus + fungsi SECURITY DEFINER.
-- UPSERT `on conflict do update ... + 1` mengunci baris counter sehingga seq
-- di-serialize secara atomik dan TIDAK PERNAH mundur (tahan hapus draft).
-- Fungsi jadi SECURITY DEFINER (owner postgres) agar bisa menulis counter yang
-- tabelnya deny-all, dan agar hitungan tidak lagi terdistorsi RLS pemanggil.
-- =============================================================================

-- 1) Tabel counter per hari (kunci = string YYYYMMDD, sama dgn prefix ID) --------
create table if not exists public.order_id_counters (
  day      text    primary key,
  last_seq integer not null default 0
);

comment on table public.order_id_counters is
  'Counter harian monotonik untuk nomor urut ID pesanan (CP-YYYYMMDD-XXXX). '
  'Hanya ditulis oleh generate_order_id() (SECURITY DEFINER); tidak pernah mundur.';

-- RLS: deny-all by design. Tabel ini internal — tak ada satupun role klien yang
-- boleh baca/tulis langsung. Akses hanya lewat fungsi SECURITY DEFINER (owner
-- postgres) yang melewati RLS. Pola yang sama dipakai ai_providers.
alter table public.order_id_counters enable row level security;
revoke all on public.order_id_counters from anon, authenticated;

-- 2) Fungsi generator atomik (ganti yang lama) ----------------------------------
create or replace function public.generate_order_id()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  today text := to_char(now(), 'YYYYMMDD');
  seq   integer;
begin
  -- UPSERT atomik: baris counter dikunci saat konflik, jadi seq aman dari race
  -- dan monotonik (tak terpengaruh penghapusan order).
  insert into public.order_id_counters (day, last_seq)
  values (today, 1)
  on conflict (day) do update
    set last_seq = public.order_id_counters.last_seq + 1
  returning last_seq into seq;

  return 'CP-' || today || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- Pemanggil INSERT (default kolom orders.id) butuh EXECUTE; SECURITY DEFINER
-- membuat badannya tetap jalan sebagai postgres. Cabut grant PUBLIC bawaan
-- (anon tak boleh memanggil via /rest/v1/rpc — order butuh akun penuh, dan
-- panggilan langsung cuma menggelembungkan counter). Hanya authenticated &
-- service_role yang boleh, sesuai kebutuhan default kolom orders.id.
revoke execute on function public.generate_order_id() from public;
grant execute on function public.generate_order_id() to authenticated, service_role;

-- 3) Backfill dari ID yang sudah ada --------------------------------------------
-- Di prod sudah ada order CP-…; tanpa seed, counter mulai dari 0 dan menghasilkan
-- nomor yang bentrok dengan ID lama. Seed = seq maksimum per hari. No-op di DB
-- baru (belum ada order).
insert into public.order_id_counters (day, last_seq)
select substring(id from 4 for 8) as day,
       max(substring(id from 13)::int) as last_seq
from public.orders
where id ~ '^CP-[0-9]{8}-[0-9]{4}$'
group by substring(id from 4 for 8)
on conflict (day) do update
  set last_seq = greatest(public.order_id_counters.last_seq, excluded.last_seq);
