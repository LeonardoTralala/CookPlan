-- =============================================================================
-- Migrasi: Perbaiki hak akses (GRANT) pada public.profiles untuk role authenticated
-- =============================================================================

-- 1) Berikan hak SELECT dan INSERT ke authenticated
grant select, insert on public.profiles to authenticated;

-- 2) Berikan hak UPDATE ke kolom profil yang diizinkan (kecuali role)
grant update (
  full_name,
  username,
  avatar_url,
  gender,
  diet_prefs,
  persona,
  delivery_customer_name,
  delivery_customer_phone,
  delivery_kecamatan,
  delivery_detail_alamat,
  updated_at
) on public.profiles to authenticated;

-- 3) Pastikan policy RLS untuk insert ada dan aktif
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 4) Pastikan policy RLS untuk update ada dan aktif
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 5) Pastikan policy RLS untuk select ada dan aktif
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);
