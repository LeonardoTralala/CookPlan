-- =============================================================================
-- Migrasi: grant UPDATE per-kolom untuk gender, diet_prefs, persona
-- -----------------------------------------------------------------------------
-- Migrasi 20260611000006_harden_role_column mencabut UPDATE table-level dari role
-- `authenticated` lalu memberi grant PER-KOLOM (full_name, username, avatar_url,
-- updated_at) demi mencegah eskalasi privilege via kolom `role`.
--
-- Konsekuensinya: kolom profil yang ditambah SETELAH migrasi itu tidak otomatis
-- bisa di-update klien dan menghasilkan error 42501 "permission denied for table
-- profiles":
--   - gender      (dipakai modal Edit Profil)
--   - diet_prefs  (dipakai panel Preferensi)
--   - persona     (dipakai onboarding "siapakah kamu" + Edit Profil)
--
-- Tambahkan grant per-kolom untuk ketiganya. Model per-kolom dipertahankan —
-- `role` sengaja TETAP tidak ter-grant, jadi trigger prevent_role_change() +
-- ketiadaan grant tetap mencegah user mengubah role sendiri.
-- =============================================================================

grant update (gender, diet_prefs, persona) on public.profiles to authenticated;
