-- =============================================================================
-- Migrasi: Flag bahan pokok dapur (is_staple) di master `ingredients`
-- -----------------------------------------------------------------------------
-- Sebelumnya pengecualian bumbu pokok (garam, minyak, kaldu, dll) dari daftar
-- belanja ditentukan oleh array NAMA hardcoded di frontend (src/utils/pantryStaples.js)
-- dengan cocok-persis. Akibatnya nama gabungan ("garam + masako ayam",
-- "merica dan kaldu bubuk") & merek (Masako/Royco) bocor ke daftar belanja, dan
-- admin tak bisa mengoreksinya tanpa deploy ulang.
--
-- Sekarang `is_staple` jadi PROPERTI per-bahan di master (sumber kebenaran, bisa
-- di-toggle admin di /admin/ingredients). recipe_ingredients mewarisi flag ini
-- lewat FK ingredient_id; baris yang belum tertaut tetap di-fallback ke heuristik
-- nama di frontend. `is_staple=true` → "cek stok di rumah", tak masuk belanja/biaya.
-- =============================================================================

-- 1) Kolom flag --------------------------------------------------------------
alter table public.ingredients
  add column if not exists is_staple boolean not null default false;
comment on column public.ingredients.is_staple is
  'Bahan pokok dapur (garam/minyak/kaldu/dll). true = "cek stok di rumah", dikecualikan dari daftar belanja & biaya. Di-kurasi admin.';

-- 2) Seed: tandai master yang SELURUH bagiannya adalah bumbu pokok ------------
-- Aturan konservatif: nama dipecah pada pemisah (, + & / "dan" "dengan") dan
-- HANYA ditandai staple bila SETIAP bagian adalah kata-bumbu yang dikenal. Ini
-- mengecualikan gabungan murni bumbu ("garam + masako ayam", "merica, garam")
-- tapi MEMBIARKAN bahan asli ("telur kocok + garam", "kecap manis + gula + garam",
-- "Gula garam royco sapi") tetap masuk belanja. Nol false-positive (sudah diuji).
-- Daftar kata-bumbu sengaja dicerminkan ke src/utils/pantryStaples.js.
update public.ingredients
set is_staple = true
where lower(trim(name)) ~ (
  '^\s*' ||
  '(garam halus|garam dapur|garam|gula pasir|gula putih|gula|merica bubuk|merica putih|merica' ||
  '|lada bubuk|lada putih|lada hitam|lada|kaldu ayam bubuk|kaldu sapi bubuk|kaldu jamur bubuk' ||
  '|kaldu ayam|kaldu sapi|kaldu jamur|kaldu bubuk|kaldu|penyedap rasa|penyedap|masako ayam' ||
  '|masako sapi|masako|royco|sasa|micin|vetsin|msg|minyak goreng|minyak sayur|minyak|air panas' ||
  '|air matang|air|es batu|es)' ||
  '(\s*([,+&/]|dan|dengan)\s*' ||
  '(garam halus|garam dapur|garam|gula pasir|gula putih|gula|merica bubuk|merica putih|merica' ||
  '|lada bubuk|lada putih|lada hitam|lada|kaldu ayam bubuk|kaldu sapi bubuk|kaldu jamur bubuk' ||
  '|kaldu ayam|kaldu sapi|kaldu jamur|kaldu bubuk|kaldu|penyedap rasa|penyedap|masako ayam' ||
  '|masako sapi|masako|royco|sasa|micin|vetsin|msg|minyak goreng|minyak sayur|minyak|air panas' ||
  '|air matang|air|es batu|es))*' ||
  '\s*$'
);

-- Catatan RLS: public.ingredients sudah read-publik + admin-write (migrasi
-- 20260622000000). Kolom baru ikut kebijakan tabel — tak perlu policy tambahan.
