import { supabase } from "../lib/supabase.js";

// Service layer untuk profil pengguna. Sumber kebenaran = tabel public.profiles
// (pola best-practice Supabase: tabel publik sebagai mirror auth.users yang bisa
// di-join & di-query). Baris profil dibuat otomatis saat signup oleh trigger
// handle_new_user(); halaman Profil membaca & memperbarui full_name, gender, dan
// avatar_url. Email tidak disimpan di profiles — selalu dibaca dari auth.users.
// RLS owner-only (profiles_select_own / profiles_update_own) menjaga akses.

const PROFILE_SELECT = "id, full_name, username, gender, avatar_url, created_at, diet_prefs, persona";

// Persona valid (selaras CHECK constraint DB & VALID_PERSONA di Edge Function).
const VALID_PERSONA = ["mahasiswa", "pekerja", "ibu_rumah_tangga", "keluarga", "lainnya"];

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
    dietPrefs: data.diet_prefs ?? [], // array slug diet_tags.value
    persona: data.persona || "",      // NULL di DB → "" untuk UI ("belum diisi")
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
  if (patch.dietPrefs !== undefined) {
    if (!Array.isArray(patch.dietPrefs)) throw new Error("Preferensi diet tidak valid.");
    // Normalisasi: hanya string, buang duplikat & kosong.
    updates.diet_prefs = [...new Set(patch.dietPrefs.filter((v) => typeof v === "string" && v))];
  }
  if (patch.persona !== undefined) {
    // "" (belum diisi) → NULL agar lolos CHECK constraint & berarti "belum diisi".
    if (patch.persona === "") {
      updates.persona = null;
    } else if (VALID_PERSONA.includes(patch.persona)) {
      updates.persona = patch.persona;
    } else {
      throw new Error("Persona tidak valid.");
    }
  }

  if (Object.keys(updates).length === 0) return getProfile();

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);
  if (error) throw error;

  return getProfile();
}

// --- Foto profil (Supabase Storage: bucket "avatars") ------------------------
const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB, samakan dengan limit bucket
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Unggah foto profil lalu simpan URL-nya ke profiles.avatar_url.
// Validasi tipe & ukuran di sisi klien (UX cepat); RLS + limit bucket menjaga
// di sisi server. Path tetap "{user_id}/avatar" (upsert) → satu file per user,
// sehingga ganti foto tidak menumpuk file lama.
export async function uploadAvatar(file) {
  if (!file) throw new Error("File tidak ditemukan.");
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error("Format foto harus JPG, PNG, atau WebP.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Ukuran foto maksimal 2 MB.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const path = `${user.id}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // Nama file tetap, jadi tambahkan cache-buster waktu agar <img> & browser
  // memuat versi terbaru, bukan foto lama dari cache.
  const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`;

  return updateProfile({ avatarUrl });
}
