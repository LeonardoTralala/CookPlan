-- =============================================================================
-- Migrasi: feedback (umpan balik pengguna untuk evaluasi produk)
-- -----------------------------------------------------------------------------
-- Menampung masukan pengguna dari tombol feedback mengambang yang tampil di
-- seluruh aplikasi. Dipakai tim untuk evaluasi: rating kepuasan (1-5), kategori
-- masukan, pesan bebas, dan halaman asal saat feedback dikirim.
--
-- Akses:
--   - Pemilik: boleh menulis & membaca feedback-nya sendiri.
--   - Admin  : boleh membaca/menghapus semua (public.is_admin()) untuk evaluasi.
-- =============================================================================

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid    not null references public.profiles (id) on delete cascade,
  -- Rating kepuasan keseluruhan (1-5 bintang). Inti metrik evaluasi.
  rating     smallint not null check (rating between 1 and 5),
  -- Jenis masukan agar mudah dikelompokkan saat analisis.
  category   text    not null default 'lainnya'
               check (category in ('saran', 'masalah', 'pujian', 'lainnya')),
  -- Isi masukan bebas. Dibatasi 1..2000 char (anti-kosong & anti-abuse).
  message    text    not null check (char_length(message) between 1 and 2000),
  -- Halaman asal feedback (path route), membantu konteks saat evaluasi. Opsional.
  page       text,
  created_at timestamptz not null default now()
);

comment on table public.feedback is
  'Umpan balik pengguna untuk evaluasi produk (rating, kategori, pesan, halaman asal).';

-- Listing admin paling sering diurut terbaru-dulu → index pada created_at desc.
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

-- Lookup "feedback milik saya".
create index if not exists feedback_user_id_idx
  on public.feedback (user_id);

-- Row Level Security: tabel baru = deny-all by default, policy WAJIB di sini.
alter table public.feedback enable row level security;

-- Pemilik: boleh mengirim feedback atas namanya sendiri.
drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
  on public.feedback for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Pemilik: boleh membaca feedback-nya sendiri (mis. riwayat masukan).
drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own"
  on public.feedback for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Admin: akses penuh (baca semua untuk evaluasi + hapus spam). Permissive →
-- di-OR dengan policy owner di atas.
drop policy if exists "feedback_admin_all" on public.feedback;
create policy "feedback_admin_all"
  on public.feedback for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
