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
      // Order lahir sebagai 'draft' — belum jadi "pesanan masuk". Dipromosikan ke
      // 'received' oleh confirmOrderSent() saat user menekan "Buka WhatsApp" di
      // layar konfirmasi. Mencegah phantom order kalau user batal kirim WA.
      order_status: "draft",
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

// Metadata status (label Indonesia + tone untuk badge UI). Dipakai di riwayat
// pesanan user (UserProfile). Nilai-nilainya selaras dengan constraint DB dan
// dengan ORDER_STATUSES/PAYMENT_STATUSES di adminOrderService.js.
export const ORDER_STATUS_META = {
  received: { label: "Diterima", tone: "info" },
  processed: { label: "Diproses", tone: "warn" },
  shipped: { label: "Dikirim", tone: "warn" },
  delivered: { label: "Selesai", tone: "ok" },
};
export const PAYMENT_STATUS_META = {
  pending: { label: "Belum bayar", tone: "warn" },
  completed: { label: "Lunas", tone: "ok" },
  failed: { label: "Gagal", tone: "error" },
};

const MY_ORDERS_SELECT = `
  id, output_type, total_price, delivery_fee,
  delivery_address, customer_name, customer_phone, payment_method,
  orderStatus:order_status, paymentStatus:payment_status,
  notes, createdAt:created_at,
  items:order_items ( id, name, amount, unit, category, priceIdr:price_idr )
`;

// Riwayat pesanan milik user yang login (terbaru dulu) + rincian item.
// RLS owner-policy (orders_owner) sudah membatasi ke user_id sendiri; filter
// eksplisit di sini = defense-in-depth + query lebih ringan. 'draft' (order
// yang belum dikonfirmasi kirim WA) disembunyikan dari riwayat.
export async function getMyOrders() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const { data, error } = await supabase
    .from("orders")
    .select(MY_ORDERS_SELECT)
    .eq("user_id", user.id)
    .neq("order_status", "draft")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Ambil satu order milik user (untuk layar konfirmasi pasca-checkout). RLS
// owner-policy membatasi akses; getUser() = defense-in-depth.
export async function getOrderById(orderId) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Belum login.");

  const { data, error } = await supabase
    .from("orders")
    .select(MY_ORDERS_SELECT)
    .eq("id", orderId)
    .single();
  if (error) throw error;
  return data;
}

// Tandai order sudah dikirim ke WhatsApp: draft → received. Dipanggil saat user
// menekan "Buka WhatsApp" di layar konfirmasi. Hanya mempromosikan draft (tidak
// menimpa status lanjutan yang mungkin sudah diubah admin). Best-effort: kegagalan
// tidak boleh memblok pembukaan WhatsApp.
export async function confirmOrderSent(orderId) {
  const { error } = await supabase
    .from("orders")
    .update({ order_status: "received" })
    .eq("id", orderId)
    .eq("order_status", "draft");
  if (error) throw error;
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
