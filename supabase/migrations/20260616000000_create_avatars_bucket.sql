-- =============================================================================
-- Migrasi: bucket Storage "avatars" (foto profil pengguna)
-- -----------------------------------------------------------------------------
-- File foto profil disimpan di Storage, URL publiknya ditulis ke
-- public.profiles.avatar_url (sumber kebenaran profil). Konvensi path:
--   avatars/{user_id}/avatar   → satu file per user, di-upsert saat ganti foto.
-- Folder pertama = user_id dipakai RLS untuk membatasi tulis ke milik sendiri.
-- Bucket public (read terbuka) supaya <img src> bisa memuat tanpa signed URL.
-- =============================================================================

-- Bucket: public read, batas 2 MB, hanya gambar umum.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,                                              -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS storage.objects sudah aktif by default. Tambahkan policy khusus avatars.

-- Siapa pun boleh membaca avatar (bucket public).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Hanya pemilik (folder pertama = auth.uid()) yang boleh upload.
drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Hanya pemilik yang boleh menimpa (upsert = update saat file sudah ada).
drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Hanya pemilik yang boleh menghapus avatarnya.
drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
