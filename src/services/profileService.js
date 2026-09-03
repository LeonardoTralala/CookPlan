import { supabase } from "../lib/supabase.js";

// Service layer untuk profil pengguna. Sumber kebenaran = tabel public.profiles
// (pola best-practice Supabase: tabel publik sebagai mirror auth.users yang bisa
// di-join & di-query). Baris profil dibuat otomatis saat signup oleh trigger
// handle_new_user(); halaman Profil membaca & memperbarui full_name, gender, dan
// avatar_url. Email tidak disimpan di profiles — selalu dibaca dari auth.users.
// RLS owner-only (profiles_select_own / profiles_update_own) menjaga akses.

const PROFILE_SELECT = "id, full_name, username, gender, avatar_url, created_at, diet_prefs, persona, delivery_customer_name, delivery_customer_phone, delivery_kecamatan, delivery_detail_alamat";

// Persona valid (selaras CHECK constraint DB & VALID_PERSONA di Edge Function).
const VALID_PERSONA = ["mahasiswa", "pekerja", "ibu_rumah_tangga", "keluarga", "lainnya"];

const DELIVERY_LOCAL_KEY = (uid) => `cookplan_delivery_${uid}`;

function getSavedLocalDelivery(uid) {
  if (!uid || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DELIVERY_LOCAL_KEY(uid));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalDelivery(uid, patch) {
  if (!uid || typeof window === "undefined") return;
  try {
    const prev = getSavedLocalDelivery(uid);
    const next = { ...prev };
    if (patch.deliveryCustomerName !== undefined) next.deliveryCustomerName = patch.deliveryCustomerName;
    if (patch.deliveryCustomerPhone !== undefined) next.deliveryCustomerPhone = patch.deliveryCustomerPhone;
    if (patch.deliveryKecamatan !== undefined) next.deliveryKecamatan = patch.deliveryKecamatan;
    if (patch.deliveryDetailAlamat !== undefined) next.deliveryDetailAlamat = patch.deliveryDetailAlamat;
    localStorage.setItem(DELIVERY_LOCAL_KEY(uid), JSON.stringify(next));
  } catch {
    // abaikan error localStorage
  }
}

// Ambil profil pengguna aktif dalam bentuk camelCase yang siap dipakai UI.
// Menggunakan pendekatan bertingkat: DB public.profiles -> auth user metadata -> localStorage.
export async function getProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  let data = null;
  try {
    const { data: row, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", user.id)
      .maybeSingle();

    if (!error) {
      data = row;
    } else {
      console.warn("Akses public.profiles terbatas, menggunakan data auth metadata:", error.message);
    }
  } catch (err) {
    console.warn("Gagal select dari public.profiles:", err);
  }

  const meta = user.user_metadata || {};
  const local = getSavedLocalDelivery(user.id);

  return {
    id: user.id,
    email: user.email ?? "",          // email hanya ada di auth.users
    fullName: data?.full_name || meta.full_name || meta.name || "",
    username: data?.username || meta.username || (user.email ? user.email.split('@')[0] : 'user'),
    gender: data?.gender || meta.gender || "",        // NULL di DB -> "" untuk UI
    avatarUrl: data?.avatar_url || meta.avatar_url || "",
    createdAt: data?.created_at ?? user.created_at ?? null,
    dietPrefs: data?.diet_prefs ?? meta.diet_prefs ?? [], // array slug diet_tags.value
    persona: data?.persona || meta.persona || "",      // NULL di DB -> "" untuk UI ("belum diisi")
    deliveryCustomerName: data?.delivery_customer_name || meta.deliveryCustomerName || local.deliveryCustomerName || "",
    deliveryCustomerPhone: data?.delivery_customer_phone || meta.deliveryCustomerPhone || local.deliveryCustomerPhone || "",
    deliveryKecamatan: data?.delivery_kecamatan || meta.deliveryKecamatan || local.deliveryKecamatan || "",
    deliveryDetailAlamat: data?.delivery_detail_alamat || meta.deliveryDetailAlamat || local.deliveryDetailAlamat || "",
  };
}

// Perbarui sebagian field profil. patch hanya boleh berisi field dikenal; kolom
// lain dibiarkan utuh. Mengembalikan profil terbaru (hasil getProfile).
export async function updateProfile(patch = {}) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  // 1. Simpan segera ke localStorage (offline-first & instan)
  saveLocalDelivery(user.id, patch);

  // 2. Simpan ke auth.user_metadata (selalu diizinkan untuk authenticated user, aman dari DB table permission error)
  const metaUpdates = {};
  if (patch.fullName !== undefined) metaUpdates.full_name = patch.fullName.trim();
  if (patch.deliveryCustomerName !== undefined) metaUpdates.deliveryCustomerName = patch.deliveryCustomerName.trim();
  if (patch.deliveryCustomerPhone !== undefined) metaUpdates.deliveryCustomerPhone = patch.deliveryCustomerPhone.trim();
  if (patch.deliveryKecamatan !== undefined) metaUpdates.deliveryKecamatan = patch.deliveryKecamatan;
  if (patch.deliveryDetailAlamat !== undefined) metaUpdates.deliveryDetailAlamat = patch.deliveryDetailAlamat.trim();
  if (patch.gender !== undefined) metaUpdates.gender = patch.gender;
  if (patch.persona !== undefined) metaUpdates.persona = patch.persona;
  if (patch.dietPrefs !== undefined) metaUpdates.diet_prefs = patch.dietPrefs;

  if (Object.keys(metaUpdates).length > 0) {
    try {
      await supabase.auth.updateUser({ data: metaUpdates });
    } catch (authErr) {
      console.warn("Gagal update user metadata:", authErr);
    }
  }

  // 3. Coba simpan ke tabel public.profiles (best-effort)
  const updates = {};
  if (patch.fullName !== undefined) {
    const name = patch.fullName.trim();
    if (name === "") throw new Error("Nama tidak boleh kosong.");
    updates.full_name = name;
  }
  if (patch.gender !== undefined) {
    updates.gender = patch.gender === "" ? null : patch.gender;
  }
  if (patch.avatarUrl !== undefined) updates.avatar_url = patch.avatarUrl;
  if (patch.dietPrefs !== undefined) {
    if (!Array.isArray(patch.dietPrefs)) throw new Error("Preferensi diet tidak valid.");
    updates.diet_prefs = [...new Set(patch.dietPrefs.filter((v) => typeof v === "string" && v))];
  }
  if (patch.persona !== undefined) {
    if (patch.persona === "") {
      updates.persona = null;
    } else if (VALID_PERSONA.includes(patch.persona)) {
      updates.persona = patch.persona;
    } else {
      throw new Error("Persona tidak valid.");
    }
  }
  if (patch.deliveryCustomerName !== undefined) {
    updates.delivery_customer_name = patch.deliveryCustomerName.trim() || null;
  }
  if (patch.deliveryCustomerPhone !== undefined) {
    updates.delivery_customer_phone = patch.deliveryCustomerPhone.trim() || null;
  }
  if (patch.deliveryKecamatan !== undefined) {
    updates.delivery_kecamatan = patch.deliveryKecamatan || null;
  }
  if (patch.deliveryDetailAlamat !== undefined) {
    updates.delivery_detail_alamat = patch.deliveryDetailAlamat.trim() || null;
  }

  if (Object.keys(updates).length > 0) {
    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) {
        console.warn("Update public.profiles tidak dapat dijalankan (izin DB):", error.message);
      }
    } catch (dbErr) {
      console.warn("Gagal update public.profiles:", dbErr);
    }
  }

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
