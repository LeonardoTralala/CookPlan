import { supabase } from "../lib/supabase.js";

// Service layer untuk Admin UI tracking pesanan (/admin/orders).
// Pesanan via WhatsApp tersimpan di orders/order_items (orderService.createOrder
// menulis SEBELUM buka WA). Admin baca/ubah lewat policy admin (public.is_admin())
// — lihat migrasi 20260621000001_admin_orders_access.sql. getUser() = defense-in-depth.
//
// Workflow status pakai kolom ber-constraint di prod:
//   order_status  : received | processed | shipped | delivered
//   payment_status: pending | completed | failed

// Pilihan status pengiriman (urut alur). Dipakai filter + dropdown editor.
export const ORDER_STATUSES = [
  { value: "received", label: "Diterima", icon: "inbox", tone: "info" },
  { value: "processed", label: "Diproses", icon: "skillet", tone: "warn" },
  { value: "shipped", label: "Dikirim", icon: "local_shipping", tone: "warn" },
  { value: "delivered", label: "Selesai", icon: "task_alt", tone: "ok" },
];

export const PAYMENT_STATUSES = [
  { value: "pending", label: "Belum bayar", tone: "warn" },
  { value: "completed", label: "Lunas", tone: "ok" },
  { value: "failed", label: "Gagal", tone: "error" },
];

const ORDER_SELECT = `
  id, output_type, total_price, delivery_fee,
  delivery_address, customer_name, customer_phone, payment_method,
  orderStatus:order_status, paymentStatus:payment_status,
  notes, createdAt:created_at,
  items:order_items ( id, name, amount, unit, category, priceIdr:price_idr )
`;

async function requireUser() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Belum login.");
  return data.user;
}

// Daftar pesanan (terbaru dulu) + rincian item. Filter opsional by order_status.
// 'draft' (order yang belum dikonfirmasi kirim WA oleh user) selalu dikecualikan
// — itu cart yang ditinggalkan, bukan pesanan masuk.
export async function listOrders({ status } = {}) {
  await requireUser();
  let q = supabase
    .from("orders")
    .select(ORDER_SELECT)
    .neq("order_status", "draft")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("order_status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// Ubah status pengiriman dan/atau pembayaran sebuah pesanan.
export async function updateOrder(id, { orderStatus, paymentStatus } = {}) {
  await requireUser();
  const patch = {};
  if (orderStatus !== undefined) patch.order_status = orderStatus;
  if (paymentStatus !== undefined) patch.payment_status = paymentStatus;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) throw error;
}

// Normalisasi nomor HP Indonesia → format wa.me (62xxxx). 0812 → 62812.
export function waLink(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (digits.startsWith("62")) { /* sudah benar */ }
  else if (digits.startsWith("8")) digits = "62" + digits;
  return `https://wa.me/${digits}`;
}
