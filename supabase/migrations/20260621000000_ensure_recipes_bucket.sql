-- =============================================================================
-- Migrasi: pastikan bucket Storage "recipes" (foto resep, dikelola admin)
-- -----------------------------------------------------------------------------
-- Bucket "recipes" sudah dibuat langsung di proyek remote (drift — tidak ada di
-- migration lokal). Migrasi ini mengabadikannya ke version control agar fresh
-- `db reset` ikut membuatnya, sekaligus menghapus bucket "recipe-images" yang
-- sempat dibuat redundan (fungsinya sama persis dengan "recipes").
--
-- Konvensi: foto cover resep di-upload admin lewat /admin/recipes ke path
--   recipes/{recipe_id}/cover  (upsert) → URL publik ditulis ke recipes.image_url.
-- Gerbang tulis = PERAN admin (public.is_admin()), bukan kepemilikan folder.
-- Bucket public (read terbuka) supaya <img src> memuat tanpa signed URL.
-- =============================================================================

-- Bucket: public read, batas 5 MB, hanya gambar umum.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipes',
  'recipes',
  true,
  5242880,                                              -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Siapa pun boleh membaca foto resep (bucket public).
drop policy if exists "recipes_public_read" on storage.objects;
create policy "recipes_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'recipes');

-- Hanya admin yang boleh upload/timpa/hapus foto resep.
drop policy if exists "recipes_admin_insert" on storage.objects;
create policy "recipes_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recipes' and public.is_admin());

drop policy if exists "recipes_admin_update" on storage.objects;
create policy "recipes_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recipes' and public.is_admin())
  with check (bucket_id = 'recipes' and public.is_admin());

drop policy if exists "recipes_admin_delete" on storage.objects;
create policy "recipes_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recipes' and public.is_admin());

-- -----------------------------------------------------------------------------
-- Bersihkan policy bucket redundan "recipe-images" (sempat terbuat lalu dibatalkan).
-- Baris bucket-nya sendiri TIDAK bisa dihapus via SQL (trigger storage.protect_delete);
-- hapus bucket kosong "recipe-images" lewat Storage API / Dashboard bila masih ada.
-- -----------------------------------------------------------------------------
drop policy if exists "recipe_images_public_read"   on storage.objects;
drop policy if exists "recipe_images_admin_insert"  on storage.objects;
drop policy if exists "recipe_images_admin_update"  on storage.objects;
drop policy if exists "recipe_images_admin_delete"  on storage.objects;
