// Sumber kebenaran tunggal untuk metadata status pesanan & pembayaran.
// Sebelumnya tersebar (ORDER_STATUSES di adminOrderService, ORDER_STATUS_META di
// orderService, TONE_CLS/STATUS_TONE_CLS di tiap halaman) → rawan drift saat
// menambah status. Semua konsumen (admin & riwayat user) impor dari sini.

// Status pengiriman, urut sesuai alur. Selaras dengan constraint DB
// orders_order_status_check (received|processed|shipped|delivered). 'draft'
// sengaja tak masuk daftar tampil — itu cart yang belum dikonfirmasi kirim.
export const ORDER_STATUSES = [
  { value: "received", label: "Diterima", icon: "inbox", tone: "info" },
  { value: "processed", label: "Diproses", icon: "skillet", tone: "warn" },
  { value: "shipped", label: "Dikirim", icon: "local_shipping", tone: "warn" },
  { value: "delivered", label: "Selesai", icon: "task_alt", tone: "ok" },
];

// Status pembayaran. Selaras dengan orders_payment_status_check.
export const PAYMENT_STATUSES = [
  { value: "pending", label: "Belum bayar", tone: "warn" },
  { value: "completed", label: "Lunas", tone: "ok" },
  { value: "failed", label: "Gagal", tone: "error" },
];

// Lookup value → meta (dipakai render badge).
export const ORDER_STATUS_META = Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s]));
export const PAYMENT_STATUS_META = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s.value, s]));

// Meta dengan fallback aman untuk nilai tak dikenal (mis. status lama/draft).
export const orderMeta = (v) => ORDER_STATUS_META[v] ?? { label: v ?? "—", tone: "info", icon: "help" };
export const payMeta = (v) => PAYMENT_STATUS_META[v] ?? { label: v ?? "—", tone: "info" };

// tone → kelas Tailwind badge. Dipakai di /admin/orders & riwayat pesanan user.
export const STATUS_TONE_CLS = {
  info: "bg-primary/10 text-primary",
  warn: "bg-amber-100 text-amber-700",
  ok: "bg-emerald-100 text-emerald-700",
  error: "bg-error/10 text-error",
};
