-- =============================================================================
-- Migrasi: RLS Policy Admin untuk Langganan CookPass & Profil Pengguna
-- -----------------------------------------------------------------------------
-- Memastikan pengguna dengan role 'admin' dapat membaca dan mengelola seluruh
-- data langganan (subscriptions) dan melihat profil pengguna untuk keperluan analitik.
-- =============================================================================

-- 1. Pastikan fungsi is_admin() berstatus SECURITY DEFINER dan search_path aman
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. Policy Admin untuk public.subscriptions (akses penuh admin)
drop policy if exists "subs_admin_all" on public.subscriptions;
create policy "subs_admin_all"
  on public.subscriptions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Policy Admin Select untuk public.profiles (admin bisa membaca profil semua user)
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
  on public.profiles for select
  to authenticated
  using (public.is_admin());
