-- =============================================================================
-- Migrasi: Backfill missing profiles & perkuat handle_new_user
-- =============================================================================

-- 1) Backfill profil untuk setiap user di auth.users yang belum ada di public.profiles
insert into public.profiles (id, full_name, username)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    u.raw_user_meta_data ->> 'username',
    'Pengguna'
  ),
  coalesce(
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'user'
  ) || '_' || substr(u.id::text, 1, 8)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
