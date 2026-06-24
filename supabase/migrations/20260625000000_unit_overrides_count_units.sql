-- Override konversi satuan HITUNG → berat/volume per-bahan (siung/ekor/cm/ruas/lembar/sachet).
--
-- Pendamping enhance parser + re-link (recover-ingredients.mjs). Banyak baris resep
-- memakai satuan hitung yang tak ada di unit_conversions global (mis. "2 siung bawang
-- putih", "0,5 ekor ayam", "3 cm jahe") sehingga price_idr NULL. Override ini membuat
-- mereka terhitung. Estimasi berat wajar.
--
-- Idempoten, keyed by NAMA kanonik. Trigger overrides_after_change recompute price_idr.

begin;

create temp table _ov_count(canon text, unit text, factor numeric) on commit drop;
insert into _ov_count(canon, unit, factor) values
  ('ayam', 'ekor', 1000),
  ('bawang putih', 'siung', 5),
  ('bawang merah', 'siung', 10),
  ('bawang merah', 'buah', 10),
  ('jahe', 'cm', 8),
  ('jahe', 'ruas', 15),
  ('kunyit', 'cm', 8),
  ('kunyit', 'ruas', 15),
  ('lengkuas', 'ruas', 20),
  ('lengkuas', 'cm', 10),
  ('daun kunyit', 'lembar', 2),
  ('kaldu bubuk', 'sachet', 8);

insert into public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
select i.id, o.unit, o.factor
from _ov_count o
join public.ingredients i on lower(i.name) = lower(o.canon)
on conflict (ingredient_id, unit) do update set factor_to_base = excluded.factor_to_base;

commit;
