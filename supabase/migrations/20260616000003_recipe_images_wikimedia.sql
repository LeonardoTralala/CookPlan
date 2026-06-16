-- =============================================================================
-- Migrasi: ganti image_url resep katalog → foto masakan asli di Wikimedia Commons
-- -----------------------------------------------------------------------------
-- Foto stok Pexels/googleusercontent sebelumnya generik & sering tidak cocok
-- dengan masakannya (mis. "Rendang" menampilkan daging acak). Diganti ke foto
-- dokumentasi masakan Indonesia spesifik di Wikimedia Commons (lisensi bebas,
-- URL stabil). Pola Special:FilePath/<file> auto-redirect ke berkas asli; param
-- ?width=800 mengambil thumbnail agar ringan. Semua nama berkas sudah diverifikasi
-- resolve (HTTP 301 → upload.wikimedia.org).
--
-- Update by title → idempoten & aman dijalankan pada DB yang sudah berisi data
-- (lewat `supabase db push`). Untuk fresh `db reset`, resep 1–6 juga sudah
-- diperbarui di seed.sql (seed berjalan paling akhir).
-- =============================================================================

update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Gado-gado.jpg?width=800'                       where title = 'Gado-Gado Segar';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Soto_ayam.JPG?width=800'                       where title = 'Soto Ayam Kampung';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Tempe_and_tahu_goreng.JPG?width=800'           where title = 'Tempe Bowl Sehat';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Mie_goreng.jpg?width=800'                      where title = 'Mie Goreng Jawa';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Ikan_kakap_bakar_madu.JPG?width=800'           where title = 'Ikan Bakar Bali';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Tumis_kangkung.JPG?width=800'                  where title = 'Tumis Sayur Pelangi';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Rendang.JPG?width=800'                         where title = 'Rendang Daging Sapi';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Bakso_ayam.jpg?width=800'                      where title = 'Bakso Sapi Kuah';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Nasi_Uduk_Jengkol_Daging_Krecek.JPG?width=800' where title = 'Nasi Uduk Betawi';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Sate_ayam-Jakarta.JPG?width=800'               where title = 'Sate Ayam Madura';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Ayam_goreng.JPG?width=800'                     where title = 'Ayam Goreng Kremes';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Sayur_asem.JPG?width=800'                      where title = 'Sayur Asem Segar';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Bubur_Ayam_di_Semarang.jpg?width=800'          where title = 'Bubur Ayam Spesial';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Cap_Cai.JPG?width=800'                        where title = 'Cap Cay Kuah';
update public.recipes set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Ayam_penyet.JPG?width=800'                     where title = 'Pecel Ayam Kampung';
