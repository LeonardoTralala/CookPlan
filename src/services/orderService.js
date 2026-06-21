import { supabase } from "../lib/supabase.js";

// Service layer untuk order. Membuat baris orders (+ order_items) lalu menyusun
// URL WhatsApp dengan teks terformat berisi ID pesanan unik (CP-YYYYMMDD-XXXX).

// Nomor WA admin CookPlan. Set via env (Vercel/Vite) sebagai VITE_WA_ADMIN_NUMBER
// agar mudah diganti tanpa rebuild. Fallback = nomor resmi CookPlan
// (085167542103 -> 6285167542103) supaya tetap jalan kalau env belum di-set.
const WA_ADMIN_NUMBER = import.meta.env.VITE_WA_ADMIN_NUMBER || "6285167542103";

function formatRupiah(num) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0);
}

// Buat order baru. payload:
//   { planId?, outputType, items:[{name,amount,unit,category,priceIdr}],
//     totalPrice, deliveryFee, address, name, phone, paymentMethod?, notes? }
// Return order row (termasuk id CP-...).
export async function createOrder(payload) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      plan_id: payload.planId ?? null,
      output_type: payload.outputType ?? null,
      total_price: payload.totalPrice ?? 0,
      delivery_fee: payload.deliveryFee ?? 15000,
      delivery_address: payload.address ?? null,
      customer_name: payload.name ?? null,
      customer_phone: payload.phone ?? null,
      payment_method: payload.paymentMethod ?? null,
      notes: payload.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // insert item-item bila ada
  if (payload.items && payload.items.length > 0) {
    const rows = payload.items.map((it) => ({
      order_id: order.id,
      name: it.name,
      amount: it.amount,
      unit: it.unit,
      category: it.category ?? null,
      price_idr: Math.round(it.priceIdr ?? 0),
    }));
    const { error: itErr } = await supabase.from("order_items").insert(rows);
    if (itErr) {
      // Hindari order "yatim" tanpa item bila insert order_items gagal.
      // Best-effort cleanup: kalau delete juga gagal (mis. RLS/network),
      // tetap lempar error asli supaya UI bisa tampilkan ke user.
      await supabase.from("orders").delete().eq("id", order.id);
      throw itErr;
    }
  }

  return order;
}

// Susun teks WhatsApp terformat untuk sebuah order + daftar item.
export function buildWhatsappText(order, items = []) {
  const lines = [];
  lines.push(`Halo Cookplan! 👋`);
  lines.push("");
  lines.push(`Aku mau pesan Paket *${order.id}*`);
  lines.push("");
  lines.push(`📋 *Detail Pesanan:*`);
  if (order.output_type) lines.push(`• Jenis: ${order.output_type}`);
  lines.push(`• Total: ${formatRupiah(order.total_price + (order.delivery_fee || 0))}`);
  if (order.delivery_address) lines.push(`• Alamat: ${order.delivery_address}`);
  if (order.customer_name) lines.push(`• Nama: ${order.customer_name}`);

  if (items.length > 0) {
    lines.push("");
    lines.push(`🛒 *Daftar Belanja:*`);
    for (const it of items) {
      lines.push(`• ${it.name} ${it.amount} ${it.unit}`);
    }
  }

  lines.push("");
  lines.push(`Mohon konfirmasi kapan pesananku siap diantar 🙏`);
  return lines.join("\n");
}

// Susun URL wa.me lengkap (siap dibuka window.open).
export function buildWhatsappUrl(order, items = [], adminNumber = WA_ADMIN_NUMBER) {
  const text = buildWhatsappText(order, items);
  return `https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}`;
}

// Template singkat (tanpa order) untuk CTA umum di landing/hero.
export function buildSimpleWhatsappUrl(message, adminNumber = WA_ADMIN_NUMBER) {
  return `https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`;
}

export { WA_ADMIN_NUMBER, formatRupiah };
