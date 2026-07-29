-- =============================================================================
-- Migrasi: Tambah share_token & RLS publik pada weekly_plans & meal_entries
-- -----------------------------------------------------------------------------
-- Memungkinkan rencana mingguan di-share dan dibaca publik via share_token.
-- =============================================================================

-- 1) Tambah kolom share_token (string acak 16-karakter hex)
ALTER TABLE public.weekly_plans 
ADD COLUMN IF NOT EXISTS share_token text UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex');

COMMENT ON COLUMN public.weekly_plans.share_token IS
  'Token acak unguessable untuk akses preview publik rencana mingguan.';

-- 2) Index lookup share_token
CREATE INDEX IF NOT EXISTS weekly_plans_share_token_idx 
ON public.weekly_plans (share_token) 
WHERE share_token IS NOT NULL;

-- 3) Policy RLS baca publik untuk weekly_plans yang memiliki share_token
DROP POLICY IF EXISTS "weekly_plans_shared_read" ON public.weekly_plans;
CREATE POLICY "weekly_plans_shared_read"
  ON public.weekly_plans FOR SELECT
  TO public
  USING (share_token IS NOT NULL);

-- 4) Policy RLS baca publik untuk meal_entries dari plan yang di-share
DROP POLICY IF EXISTS "meal_entries_shared_read" ON public.meal_entries;
CREATE POLICY "meal_entries_shared_read"
  ON public.meal_entries FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.weekly_plans p
    WHERE p.id = meal_entries.plan_id AND p.share_token IS NOT NULL
  ));
