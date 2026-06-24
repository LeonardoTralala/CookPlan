-- Backfill harga bahan ronde 2 (incremental) + override satuan.
--
-- Lanjutan dari 20260623000000_seed_ingredient_pricing_backfill.sql. Menangkap pengisian
-- harga ronde berikutnya (estimasi pasar wajar) untuk bahan yang sebelumnya kosong.
--
-- Sifat: IDEMPOTEN & ADITIF — keyed by NAMA kanonik, UPSERT, step-0 insert-if-not-exists.
-- Hanya berisi DELTA ronde ini (bukan re-dump penuh) agar tidak menyentuh harga yang
-- diisi pihak lain. Tidak menghapus baris; alias hasil merge varian = bagian recovery
-- master terpisah (tidak di-reproduce di sini).

begin;

create temp table _price2(name text, base_unit text, price numeric) on commit drop;
insert into _price2(name, base_unit, price) values
  ('arak masak jepang', 'ml', 60.0000),
  ('beras', 'g', 14.0000),
  ('Beras Basmati', 'g', 30.0000),
  ('bihun', 'g', 20.0000),
  ('bihun jagung,seduh&tiriskan', 'g', 20.0000),
  ('bumbu kari', 'g', 80.0000),
  ('cabai hijau', 'pcs', 300.0000),
  ('Cue tongkol', 'g', 30.0000),
  ('dashi atau kaldu ayam', 'ml', 40.0000),
  ('es batu', 'g', 0.0000),
  ('es batu yg dihancurkan', 'g', 0.0000),
  ('fillet ikan tenggiri', 'g', 60.0000),
  ('iga sapi', 'g', 120.0000),
  ('ikan kembung', 'g', 35.0000),
  ('ikan mujair', 'g', 30.0000),
  ('Ikan nila', 'g', 35.0000),
  ('ikan tuna', 'g', 50.0000),
  ('jamur enoki', 'g', 40.0000),
  ('jus apel', 'ml', 10.0000),
  ('keju mozzarella', 'g', 120.0000),
  ('keju parmesan', 'g', 200.0000),
  ('kelapa parut', 'g', 15.0000),
  ('micin', 'g', 30.0000),
  ('mie telur', 'g', 20.0000),
  ('minyak samin', 'ml', 80.0000),
  ('nanas parut', 'ml', 10.0000),
  ('pala bubuk', 'ml', 100.0000),
  ('pasta tomat sugar free', 'ml', 80.0000),
  ('pete', 'g', 50.0000),
  ('pindang tongkol uk. sedang', 'g', 30.0000),
  ('pokcoy', 'g', 15.0000),
  ('puff pastry', 'g', 40.0000),
  ('ragi instan', 'ml', 200.0000),
  ('saus teriyaki', 'ml', 60.0000),
  ('saus tomat', 'ml', 30.0000),
  ('saus tomat+sambal mix', 'ml', 30.0000),
  ('spaghetti', 'g', 20.0000),
  ('tauco', 'ml', 50.0000),
  ('terasi', 'ml', 100.0000);

create temp table _override2(canon text, unit text, factor numeric) on commit drop;
insert into _override2(canon, unit, factor) values
  ('pete', 'papan', 50),
  ('pokcoy', 'batang', 50),
  ('spaghetti', 'genggam', 50),
  ('puff pastry', 'bungkus', 500),
  ('makaroni', 'genggam', 50),
  ('beras', 'cup', 200),
  ('gula merah', 'keping', 1),
  ('bihun', 'keping', 50);

-- 0) Pastikan baris kanonik baru ada (cabai hijau, beras, bihun, bumbu kari, dll)
insert into public.ingredients (name, base_unit)
select p.name, p.base_unit
from _price2 p
where not exists (
  select 1 from public.ingredients i where lower(i.name) = lower(p.name)
);

-- 1) Harga + base_unit (trigger recompute)
update public.ingredients i
set base_unit      = p.base_unit,
    price_per_base = p.price,
    updated_at     = now()
from _price2 p
where lower(i.name) = lower(p.name);

-- 2) Override konversi satuan per-bahan
insert into public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
select i.id, o.unit, o.factor
from _override2 o
join public.ingredients i on lower(i.name) = lower(o.canon)
on conflict (ingredient_id, unit) do update set factor_to_base = excluded.factor_to_base;

commit;
