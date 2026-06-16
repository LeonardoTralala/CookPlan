-- =============================================================================
-- Migrasi: pengerasan keamanan (hasil audit `get_advisors`)
-- -----------------------------------------------------------------------------
-- Menutup tiga temuan advisor tanpa memutus fungsi yang ada:
--   1. is_admin() diturunkan dari SECURITY DEFINER → SECURITY INVOKER.
--   2. Bucket `avatars`: SELECT publik luas (bisa list semua file) → owner-only.
--   3. ai_providers: dokumentasi intent deny-all (tetap dibiarkan, by design).
-- =============================================================================

-- 1) is_admin(): SECURITY DEFINER → SECURITY INVOKER.
-- Fungsi hanya membaca baris profil milik pemanggil (id = auth.uid()), yang sudah
-- diizinkan policy profiles_select_own. Dengan INVOKER ia tak lagi berjalan dengan
-- hak definer (menghapus advisor 0029) namun RLS admin_write (recipes, packages,
-- diet_tags, dst.) tetap berfungsi: admin → true, non-admin → false.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path to ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- 2) Bucket avatars: ganti SELECT publik luas dengan SELECT khusus pemilik.
-- Bucket tetap public, jadi render <img> lewat public URL tak terpengaruh (jalur
-- /object/public bypass RLS). SELECT pemilik ini juga prasyarat upsert (ganti
-- foto) karena Storage upsert butuh INSERT + UPDATE + SELECT.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_owner_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 3) ai_providers: deny-all RLS memang disengaja (hanya service_role via Edge
-- Function admin-providers yang akses; tabel menyimpan API key provider). Beri
-- komentar agar intent jelas. JANGAN menambah policy SELECT untuk anon/authenticated
-- — itu akan membocorkan API key ke browser.
comment on table public.ai_providers is
  'Deny-all RLS disengaja: hanya service_role (Edge Function admin-providers) yang mengakses. Menyimpan API key provider — jangan menambah policy SELECT untuk anon/authenticated.';
