import { supabase } from "../lib/supabase.js";

const RECIPES_BUCKET = "recipes";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function requireUser() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Belum login.");
  return data.user;
}

/**
 * Unggah foto cover resep ke Supabase storage (bucket "recipes").
 * @param {File} file File gambar yang diunggah
 * @param {string|number} [recipeId] ID resep opsional untuk penamaan path
 * @returns {Promise<string>} Public URL dari gambar yang diunggah (dengan cache buster)
 */
export async function uploadRecipeCover(file, recipeId) {
  const user = await requireUser();

  if (!file) throw new Error("File gambar tidak ditemukan.");
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Format foto harus JPG, PNG, atau WebP.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Ukuran foto maksimal 5 MB.");
  }

  const timestamp = Date.now();
  const fileExt = file.name.split(".").pop() || "jpg";
  const path = recipeId
    ? `${user.id}/${recipeId}_cover.${fileExt}`
    : `${user.id}/temp_${timestamp}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(RECIPES_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage
    .from(RECIPES_BUCKET)
    .getPublicUrl(path);

  return `${pub.publicUrl}?t=${timestamp}`;
}

// Alias untuk kompatibilitas
export const uploadRecipeImage = uploadRecipeCover;
