-- =============================================================================
-- Migrasi: Status "Terverifikasi admin" untuk resep
-- -----------------------------------------------------------------------------
-- Data resep sebagian masih kotor/rusak (warisan scraping). Daripada menahan
-- semua resep, admin menandai resep yang SUDAH dicek sebagai terverifikasi →
-- badge "✓ Terverifikasi" di katalog + filter "Hanya terverifikasi". Murni sinyal
-- (tidak men-gate katalog/AI), jadi katalog tak mengkerut.
--
-- verified_at/verified_by di-cap OTOMATIS oleh trigger dari auth.uid() saat flag
-- berubah — klien cukup set is_verified, tak bisa memalsukan siapa/kapan.
-- =============================================================================

alter table public.recipes
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users (id) on delete set null;

comment on column public.recipes.is_verified is
  'Resep sudah dicek admin (data bersih). true → badge "Terverifikasi" di katalog.';

-- Stempel otomatis verified_at/verified_by mengikuti perubahan is_verified.
create or replace function public.recipes_stamp_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_verified then
      new.verified_at := now();
      new.verified_by := auth.uid();
    end if;
  elsif new.is_verified is distinct from old.is_verified then
    if new.is_verified then
      new.verified_at := now();
      new.verified_by := auth.uid();
    else
      new.verified_at := null;
      new.verified_by := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists recipes_stamp_verified on public.recipes;
create trigger recipes_stamp_verified
  before insert or update on public.recipes
  for each row execute function public.recipes_stamp_verified();

-- Fungsi internal (dipakai trigger) — cabut EXECUTE publik, selaras pola migrasi lain.
revoke execute on function public.recipes_stamp_verified() from public, anon, authenticated;

-- Catatan RLS: recipes sudah read-publik + admin-write. Kolom baru ikut kebijakan
-- tabel — tak perlu policy tambahan.
