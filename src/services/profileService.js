import { supabase } from "../lib/supabase.js";

// Service layer untuk profil pengguna. Sumber kebenaran = tabel public.profiles
// (pola best-practice Supabase: tabel publik sebagai mirror auth.users yang bisa
// di-join & di-query). Baris profil dibuat otomatis saat signup oleh trigger
// handle_new_user(); halaman Profil membaca & memperbarui full_name, gender, dan
// avatar_url. Email tidak disimpan di profiles — selalu dibaca dari auth.users.
// RLS owner-only (profiles_select_own / profiles_update_own) menjaga akses.

const PROFILE_SELECT = "id, full_name, username, gender, avatar_url, created_at";

// Ambil profil pengguna aktif dalam bentuk camelCase yang siap dipakai UI.
export async function getProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single();
  if (error) throw error;

  return {
    id: data.id,
    email: user.email ?? "",          // email hanya ada di auth.users
    fullName: data.full_name || "",
    username: data.username || "",
    gender: data.gender || "",        // NULL di DB → "" untuk UI
    avatarUrl: data.avatar_url || "",
    createdAt: data.created_at ?? user.created_at ?? null,
  };
}

// Perbarui sebagian field profil. patch hanya boleh berisi field dikenal; kolom
// lain dibiarkan utuh. Mengembalikan profil terbaru (hasil getProfile).
export async function updateProfile(patch = {}) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const updates = {};
  if (patch.fullName !== undefined) {
    const name = patch.fullName.trim();
    if (name === "") throw new Error("Nama tidak boleh kosong.");
    updates.full_name = name;
  }
  if (patch.gender !== undefined) {
    // Check constraint DB hanya izinkan 'male'/'female'. "" (tidak disebutkan)
    // dipetakan ke NULL agar lolos constraint sekaligus berarti "belum diisi".
    updates.gender = patch.gender === "" ? null : patch.gender;
  }
  if (patch.avatarUrl !== undefined) updates.avatar_url = patch.avatarUrl;

  if (Object.keys(updates).length === 0) return getProfile();

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);
  if (error) throw error;

  return getProfile();
}
