-- =============================================================================
-- Migrasi: Fungsi gabung (merge) master bahan — pembersihan duplikat tanpa loss
-- -----------------------------------------------------------------------------
-- Membersihkan master bahan yang berpolusi (hasil scraping: "minyak", "minyak
-- sayur", "minyak goreng untuk menumis", dll) dengan MENGGABUNG, bukan menghapus.
-- Hapus polos itu lossy: FK `on delete set null` melepas tautan recipe_ingredients
-- → harga baris & total resep hilang. merge_ingredient memindahkan semuanya ke
-- master kanonik lalu menyimpan nama lama sebagai alias (anti bikin kembar lagi).
--
-- Dipanggil dari /admin/ingredients (aksi "Gabung ke bahan lain"). Admin-only via
-- public.is_admin() (defense-in-depth di atas RLS), atomik dalam satu transaksi fn.
-- =============================================================================

create or replace function public.merge_ingredient(p_source integer, p_target integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Khusus admin.';
  end if;
  if p_source is null or p_target is null or p_source = p_target then
    raise exception 'Sumber & target harus berbeda.';
  end if;
  if not exists (select 1 from public.ingredients where id = p_target) then
    raise exception 'Bahan target tidak ditemukan.';
  end if;
  if not exists (select 1 from public.ingredients where id = p_source) then
    raise exception 'Bahan sumber tidak ditemukan.';
  end if;

  -- 1) Simpan nama sumber sebagai alias target.
  insert into public.ingredient_aliases (alias, ingredient_id)
    select lower(trim(name)), p_target from public.ingredients where id = p_source
    on conflict (alias) do nothing;

  -- 2) Pindahkan alias milik sumber → target (lewati yang akan bentrok).
  update public.ingredient_aliases a set ingredient_id = p_target
    where a.ingredient_id = p_source
      and not exists (
        select 1 from public.ingredient_aliases b
        where b.alias = a.alias and b.ingredient_id = p_target
      );
  delete from public.ingredient_aliases where ingredient_id = p_source;

  -- 3) Pindahkan override satuan sumber → target (lewati yang sudah ada).
  insert into public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
    select p_target, unit, factor_to_base
    from public.ingredient_unit_overrides where ingredient_id = p_source
    on conflict (ingredient_id, unit) do nothing;

  -- 4) Repoint semua baris resep → target (trigger recompute harga & total resep).
  update public.recipe_ingredients set ingredient_id = p_target where ingredient_id = p_source;

  -- 5) Hapus master sumber (override sisa ikut cascade).
  delete from public.ingredients where id = p_source;
end $$;

comment on function public.merge_ingredient(integer, integer) is
  'Gabung master bahan p_source → p_target: alias + override + baris resep dipindah, lalu sumber dihapus. Admin-only.';

-- Boleh dipanggil klien (admin), gating ada di dalam fungsi.
grant execute on function public.merge_ingredient(integer, integer) to authenticated;
