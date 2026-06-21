import { supabase } from "../lib/supabase.js";

// Service layer untuk Admin UI provider AI. Semua lewat Edge Function
// `admin-providers` (karena tabel ai_providers lockdown, hanya service_role baca).
// API key di-mask saat list (tidak pernah balik plaintext ke browser).

async function invokeAdmin(body) {
  const { data, error } = await supabase.functions.invoke("admin-providers", { body });
  if (error) {
    let detail = error.message || "Operasi admin gagal.";
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) detail = ctx.error;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return data;
}

export async function listProviders() {
  const data = await invokeAdmin({ action: "list" });
  return data.providers ?? [];
}

export function createProvider(provider) {
  return invokeAdmin({ action: "create", provider });
}

export function updateProvider(id, provider) {
  return invokeAdmin({ action: "update", id, provider });
}

export function setActiveProvider(id) {
  return invokeAdmin({ action: "set_active", id });
}

export function setFallbackProvider(id) {
  return invokeAdmin({ action: "set_fallback", id });
}

export function deleteProvider(id) {
  return invokeAdmin({ action: "delete", id });
}

// Cek apakah user yang login adalah admin (untuk gating UI).
export async function checkIsAdmin() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return false;
  const { data, error } = await supabase
    .from("profiles").select("role").eq("id", userData.user.id).single();
  if (error) return false;
  return data?.role === "admin";
}

// Ringkasan jumlah konten untuk dashboard admin (head:true → cuma count, tanpa
// transfer baris). Admin baca penuh via RLS. Gagal hitung salah satu → 0.
export async function getAdminStats() {
  const tally = async (table) => {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true });
    return error ? 0 : count ?? 0;
  };
  const [recipes, ingredients, packages] = await Promise.all([
    tally("recipes"),
    tally("ingredients"),
    tally("packages"),
  ]);
  return { recipes, ingredients, packages };
}
