-- =============================================================================
-- Migrasi: UGC Recipes & Recipe Likes (PRD User-Created Recipes - Phase 1)
-- -----------------------------------------------------------------------------
-- 1. Tambah kolom UGC pada public.recipes (user_id, is_public, author_name, likes_count).
-- 2. Buat indeks pendukung query katalog UGC, filter user, dan sorting popularitas.
-- 3. Buat tabel public.recipe_likes + RLS + trigger counter likes_count.
-- 4. Update RLS policy public.recipes & public.recipe_ingredients untuk UGC.
-- 5. Tambah RLS storage.objects pada bucket 'recipes' untuk folder user_id.
-- =============================================================================

-- 1. Perubahan Tabel public.recipes --------------------------------------------
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.recipes.user_id     IS 'NULL = resep ofisial CookPlan; NOT NULL = resep kreasi pengguna';
COMMENT ON COLUMN public.recipes.is_public   IS 'true = tampil di katalog komunitas; false = draf pribadi';
COMMENT ON COLUMN public.recipes.author_name IS 'Snapshot nama pengguna pembuat saat resep dibuat';
COMMENT ON COLUMN public.recipes.likes_count IS 'Jumlah total like dari pengguna lain';

-- Indeks pendukung
CREATE INDEX IF NOT EXISTS recipes_user_id_idx    ON public.recipes (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS recipes_public_idx     ON public.recipes (is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS recipes_likes_count_idx ON public.recipes (likes_count DESC);


-- 2. Tabel Baru public.recipe_likes -------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_likes (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id  INTEGER NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

COMMENT ON TABLE public.recipe_likes IS 'Tabel pencatat like resep (1 user 1 like per resep).';

CREATE INDEX IF NOT EXISTS recipe_likes_recipe_id_idx ON public.recipe_likes (recipe_id);

-- RLS Policy untuk recipe_likes
ALTER TABLE public.recipe_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipe_likes_read_public" ON public.recipe_likes;
CREATE POLICY "recipe_likes_read_public" ON public.recipe_likes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "recipe_likes_owner_insert" ON public.recipe_likes;
CREATE POLICY "recipe_likes_owner_insert" ON public.recipe_likes
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "recipe_likes_owner_delete" ON public.recipe_likes;
CREATE POLICY "recipe_likes_owner_delete" ON public.recipe_likes
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);


-- 3. Trigger counter likes_count ----------------------------------------------
CREATE OR REPLACE FUNCTION public.update_recipe_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes SET likes_count = likes_count + 1 WHERE id = NEW.recipe_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.recipes SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.recipe_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recipe_likes_count_trigger ON public.recipe_likes;
CREATE TRIGGER recipe_likes_count_trigger
  AFTER INSERT OR DELETE ON public.recipe_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_recipe_likes_count();


-- 4. Update RLS Policies public.recipes ----------------------------------------
DROP POLICY IF EXISTS "recipes_read_public" ON public.recipes;
DROP POLICY IF EXISTS "recipes_read_all" ON public.recipes;
DROP POLICY IF EXISTS "recipes_admin_write" ON public.recipes;
DROP POLICY IF EXISTS "recipes_user_insert" ON public.recipes;
DROP POLICY IF EXISTS "recipes_user_update" ON public.recipes;
DROP POLICY IF EXISTS "recipes_user_delete" ON public.recipes;

-- READ: Resep ofisial aktif + resep publik aktif + resep milik sendiri + admin
CREATE POLICY "recipes_read_all" ON public.recipes
  FOR SELECT TO anon, authenticated
  USING (
    (is_active = true AND (user_id IS NULL OR is_public = true OR user_id = (SELECT auth.uid())))
    OR public.is_admin()
  );

-- INSERT: User hanya bisa buat resep atas nama sendiri
CREATE POLICY "recipes_user_insert" ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- UPDATE: Pemilik resep atau Admin
CREATE POLICY "recipes_user_update" ON public.recipes
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- DELETE: Pemilik resep atau Admin
CREATE POLICY "recipes_user_delete" ON public.recipes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());


-- 5. Update RLS Policies public.recipe_ingredients ---------------------------
DROP POLICY IF EXISTS "recipe_ingredients_user_insert" ON public.recipe_ingredients;
CREATE POLICY "recipe_ingredients_user_insert" ON public.recipe_ingredients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
        AND recipes.user_id = (SELECT auth.uid())
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "recipe_ingredients_user_update" ON public.recipe_ingredients;
CREATE POLICY "recipe_ingredients_user_update" ON public.recipe_ingredients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
        AND (recipes.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
        AND (recipes.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "recipe_ingredients_user_delete" ON public.recipe_ingredients;
CREATE POLICY "recipe_ingredients_user_delete" ON public.recipe_ingredients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
        AND (recipes.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );


-- 6. Storage Policies untuk Bucket 'recipes' -----------------------------------
DROP POLICY IF EXISTS "recipes_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "recipes_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "recipes_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "recipes_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "recipes_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "recipes_owner_delete" ON storage.objects;

CREATE POLICY "recipes_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recipes'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_admin()
    )
  );

CREATE POLICY "recipes_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'recipes'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'recipes'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_admin()
    )
  );

CREATE POLICY "recipes_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'recipes'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_admin()
    )
  );
