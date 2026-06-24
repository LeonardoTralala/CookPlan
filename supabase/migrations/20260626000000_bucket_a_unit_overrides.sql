-- Bucket A: override satuan hitung tambahan + fix base_unit gula merah.
--
-- Lanjutan re-link (20260625000000). Membenahi baris recipe_ingredients yang sudah
-- ter-link ke master BERHARGA tapi satuannya (butir/potong/sdm/cm/keping/buah/dll)
-- belum terkonversi → price_idr NULL. Estimasi berat/volume wajar.
--
-- Idempoten, keyed by NAMA kanonik. Trigger recompute price_idr otomatis.

begin;

-- gula merah: base pcs → g (resep umumnya per gram); 1.000/keping ÷ ~50 g = 20/g.
update public.ingredients set base_unit='g', price_per_base=20.0000, updated_at=now()
where lower(name)='gula merah';

create temp table _ov_a(canon text, unit text, factor numeric) on commit drop;
insert into _ov_a(canon, unit, factor) values
  ('gula merah','keping',50),
  ('bawang merah','butir',10),
  ('mentega','sdm',14),('mentega','sdt',5),
  ('kayu manis','cm',2),('kayu manis','batang',5),('kayu manis','sdt',2),
  ('kayumanis','cm',2),('kayumanis','batang',5),('kayumanis','sdt',2),
  ('kunyit','buah',15),('kunyit','sdt',2),
  ('bawang putih','butir',5),('bawang putih','sdt',3),('bawang putih','sdm',8),
  ('bumbu kari','sachet',8),('bumbu kari','sdm',8),('bumbu kari','sdt',3),
  ('ayam','potong',50),('ayam','buah',200),
  ('kencur','cm',8),('kencur','ruas',15),
  ('bawang bombay','potong',20),('bawang bombay','siung',20),
  ('jahe','sdm',8),('jahe','sdt',3),
  ('tempe','lonjor',250),('tempe','potong',30),
  ('tepung bumbu','bungkus',100),('tepung bumbu','sdm',8),
  ('daun jeruk','lbr',0.5),('daun jeruk','buah',0.5),
  ('Seledri','batang',15),
  ('tahu putih','potong',0.25),('tahu putih','bungkus',4),
  ('jeruk nipis','sdm',0.5),
  ('Brokoli','buah',400),('buncis','buah',5),('kacang panjang','buah',12),
  ('daun salam','buah',0.5),('daun bawang','lembar',15),('udang','pcs',15),
  ('tepung panir','sdm',8),('tepung serbaguna','sdm',8),
  ('keju mozzarella','sdm',7),('keju parmesan','sdm',7),
  ('merica','butir',0.05),('cengkeh','sdt',5),('Belimbing wuluh','buah',15),
  ('Cue tongkol','potong',50),('pindang tongkol uk. sedang','ekor',200),
  ('ikan kembung','ekor',250),('wortel','batang',1);

insert into public.ingredient_unit_overrides (ingredient_id, unit, factor_to_base)
select i.id, o.unit, o.factor
from _ov_a o
join public.ingredients i on lower(i.name) = lower(o.canon)
on conflict (ingredient_id, unit) do update set factor_to_base = excluded.factor_to_base;

commit;
