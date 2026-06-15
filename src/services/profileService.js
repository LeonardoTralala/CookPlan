import { supabase } from "../lib/supabase.js";

// Service layer untuk profil pengguna. Data profil disimpan di user_metadata
// Supabase Auth (bukan tabel terpisah) — diisi awal saat signUp (full_name,
// username) lalu diperbarui dari halaman Profil. updateUser memicu
// onAuthStateChange (event USER_UPDATED), jadi `user` di AuthContext otomatis
// ikut ter-refresh tanpa perlu reload.

// Ambil profil pengguna aktif dalam bentuk yang siap dipakai UI.
export async function getProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: meta.full_name || meta.username || "",
    username: meta.username || "",
    gender: meta.gender || "",
    avatarUrl: meta.avatar_url || "",
    createdAt: user.created_at ?? null,
  };
}

// Perbarui sebagian field profil. patch hanya boleh berisi field yang dikenal;
// field lain di user_metadata dibiarkan utuh karena updateUser melakukan merge.
export async function updateProfile(patch = {}) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const data = {};
  if (patch.fullName !== undefined) {
    const name = patch.fullName.trim();
    if (name === "") throw new Error("Nama tidak boleh kosong.");
    data.full_name = name;
  }
  if (patch.gender !== undefined) data.gender = patch.gender;
  if (patch.avatarUrl !== undefined) data.avatar_url = patch.avatarUrl;

  if (Object.keys(data).length === 0) return getProfile();

  const { error } = await supabase.auth.updateUser({ data });
  if (error) throw error;

  return getProfile();
}
