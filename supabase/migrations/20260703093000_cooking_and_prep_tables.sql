-- =============================================================================
-- Migrasi: Menambahkan kolom status masak dan membuat tabel persiapan bahan (food prep)
-- =============================================================================

-- 1) Tambah kolom is_cooked ke meal_entries
ALTER TABLE public.meal_entries 
  ADD COLUMN IF NOT EXISTS is_cooked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.meal_entries.is_cooked IS 
  'Status apakah slot menu ini sudah selesai dimasak oleh user.';

-- 2) Buat tabel food_prep_tasks
CREATE TABLE IF NOT EXISTS public.food_prep_tasks (
  id           serial primary key,
  plan_id      integer not null references public.weekly_plans (id) on delete cascade,
  task_text    text not null,
  is_completed boolean not null default false,
  created_at   timestamptz not null default now()
);

COMMENT ON TABLE public.food_prep_tasks IS
  'Daftar catatan persiapan bahan makanan (food prep) manual per user per minggu.';

CREATE INDEX IF NOT EXISTS food_prep_tasks_plan_id_idx
  ON public.food_prep_tasks (plan_id);

-- 3) Row Level Security (RLS) untuk food_prep_tasks
ALTER TABLE public.food_prep_tasks ENABLE ROW LEVEL SECURITY;

-- Hak akses mengikuti kepemilikan plan weekly_plans induknya
DROP POLICY IF EXISTS "food_prep_tasks_owner" ON public.food_prep_tasks;
CREATE POLICY "food_prep_tasks_owner"
  ON public.food_prep_tasks FOR ALL
  TO authenticated
  USING (exists (
    SELECT 1 FROM public.weekly_plans p
    WHERE p.id = food_prep_tasks.plan_id AND p.user_id = (select auth.uid())
  ))
  WITH CHECK (exists (
    SELECT 1 FROM public.weekly_plans p
    WHERE p.id = food_prep_tasks.plan_id AND p.user_id = (select auth.uid())
  ));
