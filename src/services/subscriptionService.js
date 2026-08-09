import { supabase } from "../lib/supabase.js";
import { notifySessionExpired } from "../lib/session.js";
import { buildSimpleWhatsappUrl } from "./orderService.js";

async function requireUser() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    notifySessionExpired();
    throw new Error("Belum login.");
  }
  return user;
}

// Mengambil langganan aktif atau pending terbaru dari user
export async function getCurrentSubscription() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  
  // Jika langganan sudah lewat masa aktifnya (expired)
  if (data?.status === 'active' && data.end_date) {
    const today = new Date().toISOString().split('T')[0];
    if (today > data.end_date) {
      // Set to expired in DB
      await supabase.from("subscriptions").update({ status: 'expired' }).eq('id', data.id);
      return null;
    }
  }
  
  return data;
}

// Menghitung berapa kali user mendapat gratis ongkir bulan ini
export async function getFreeShippingStatus() {
  const user = await requireUser();
  const date = new Date();
  const startOfMonth = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1)).toISOString();
  
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("delivery_fee", 0)
    .neq("order_status", "draft")
    .neq("payment_status", "failed")
    .gte("created_at", startOfMonth);

  if (error) throw error;
  return count ?? 0;
}

// Buat langganan baru (pending) & kembalikan URL WhatsApp
export async function createSubscription(tier) {
  const user = await requireUser();
  
  // Pastikan profile user ada (upsert jika belum ada)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username || user.email?.split('@')[0] || 'User',
      full_name: user.user_metadata?.full_name || user.user_metadata?.username || 'User'
    });
  }

  // Cek apakah ada langganan yang masih pending
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
    
  if (existing) {
    // Hapus yang pending lama agar tidak duplikat
    await supabase.from("subscriptions").delete().eq("id", existing.id);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      tier: tier, // 'lite' or 'pro'
      status: 'pending',
      start_date: todayStr,
      end_date: todayStr
    })
    .select("id")
    .single();

  if (error) throw error;

  const harga = tier === 'lite' ? 'Rp 11.000' : 'Rp 29.000';
  const paket = tier === 'lite' ? 'CookPass Lite' : 'CookPass Pro';
  
  const message = `Halo Admin CookPlan,\n\nSaya ingin berlangganan paket *${paket}* seharga *${harga}* per bulan.\n\nMohon informasi instruksi pembayarannya. Terima kasih!\n\n(Kode Subs: SUB-${data.id})`;
  const waUrl = buildSimpleWhatsappUrl(message);
  
  return { id: data.id, waUrl };
}

// Khusus Admin: Ambil semua langganan
export async function getAdminSubscriptions() {
  await requireUser();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(`
      *,
      user:profiles (
        full_name,
        username
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Khusus Admin: Update status
export async function updateSubscriptionStatus(id, updates) {
  await requireUser();
  const { error } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("id", id);
    
  if (error) throw error;
}
