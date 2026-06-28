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

    // total_price & delivery_fee otoritas server (trigger DB menurunkan
    // total_price = SUM(price_idr) saat item masuk + mengunci delivery_fee).
    // Baris `order` di atas diambil SEBELUM item ada → total-nya masih nilai
    // klien. Ambil ulang agar yang dikembalikan = nilai server final.
    const { data: fresh, error: refErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order.id)
      .single();
    if (!refErr && fresh) return fresh;
  }

  return order;
}

// Metadata status badge = sumber tunggal di utils/orderStatus.js
// (ORDER_STATUS_META / PAYMENT_STATUS_META). Konsumen impor langsung dari sana.

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

// Label ramah untuk kode output_type (order non-paket).
const OUTPUT_TYPE_LABEL = {
  package: "Paket Belanja",
  full: "Paket Lengkap",
  foodplan: "Food Plan",
  foodprep: "Food Prep",
};

// Order paket "Belanja di Kami" menyimpan nama paket di notes sebagai
// "Paket: <nama> (<detail>)". Pisahkan jadi { name, detail } bila cocok.
function parsePackageNote(notes) {
  if (!notes) return null;
  const m = /^Paket:\s*(.+?)\s*(?:\(([^)]*)\))?\s*$/.exec(notes.trim());
  if (!m) return null;
  return { name: m[1].trim(), detail: (m[2] || "").trim() };
}

// Jenis paket terbaca: nama paket asli (mis. "Paket Hemat 5 Hari") bila ada,
// kalau tidak pakai label ramah dari kode output_type.
function formatJenis(order, pkg) {
  if (pkg?.name) return pkg.name;
  return OUTPUT_TYPE_LABEL[order.output_type] || order.output_type || null;
}

// Tanggal order (id-ID, "27 Jun 2026"); fallback ke hari ini.
function formatTanggal(order) {
  const raw = order.createdAt || order.created_at;
  const d = raw ? new Date(raw) : new Date();
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

// Label "Jenis" terbaca untuk ditampilkan di UI admin (nama paket asli bila ada).
export function orderJenisLabel(order) {
  return formatJenis(order, parsePackageNote(order.notes)) || "—";
}

// Teks WhatsApp RINGKAS dari pembeli ke admin: cukup ringkasan pesanan (kode,
// tanggal, jenis, porsi, biaya). Rincian item & struk rapi dikirim admin sebagai
// GAMBAR (renderReceiptImage) — teks monospace panjang mudah "rusak" di HP.
export function buildWhatsappText(order) {
  const subtotal = order.total_price ?? 0;
  const deliveryFee = order.delivery_fee ?? 0;
  const total = subtotal + deliveryFee;
  const pkg = parsePackageNote(order.notes);
  const jenis = formatJenis(order, pkg);

  const lines = [];
  lines.push("Halo CookPlan! Aku mau pesan, berikut ringkasannya:");
  lines.push("");
  lines.push(`No. Pesanan: ${order.id}`);
  lines.push(`Tanggal: ${formatTanggal(order)}`);
  if (jenis) lines.push(`Jenis: ${jenis}`);
  if (pkg?.detail) lines.push(`Porsi: ${pkg.detail}`);
  lines.push(`Subtotal: ${formatRupiah(subtotal)}`);
  lines.push(`Ongkir: ${formatRupiah(deliveryFee)}`);
  lines.push(`Total: ${formatRupiah(total)}`);
  lines.push("");
  lines.push("Mohon diproses ya, terima kasih.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Struk gambar (PNG) — dipakai admin untuk dikirim balik ke pembeli.
// Dirender via Canvas (tanpa dependensi) supaya kolom & angka selalu rapi.
// ---------------------------------------------------------------------------

const BRAND = {
  green: "#375219",
  logoInk: "#2C3A1E", // warna logo asli
  headerBg: "#d7e9c0", // hijau pastel untuk band header
  cream: "#d9dfb0",
  ink: "#121f06",
  muted: "#6b7361",
  line: "#c4c8b9",
  white: "#ffffff",
};

const RECEIPT_FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Bungkus teks ke beberapa baris sesuai lebar piksel (pakai measureText).
function wrapByWidth(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (!cur || ctx.measureText(test).width <= maxWidth) cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

// Pangkas teks + "…" agar muat dalam lebar piksel.
function ellipsize(ctx, text, maxWidth) {
  text = String(text);
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

// Render struk pesanan jadi PNG Blob. Async karena logo dimuat dari /public.
export async function renderReceiptImage(order, items = []) {
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
  const W = 680;
  const padX = 48;
  const contentW = W - padX * 2;
  const labelColW = 130;

  const subtotal = order.total_price ?? 0;
  const deliveryFee = order.delivery_fee ?? 0;
  const total = subtotal + deliveryFee;
  const pkg = parsePackageNote(order.notes);

  const metaRaw = [
    ["No. Pesanan", order.id],
    ["Tanggal", formatTanggal(order)],
    ["Jenis", formatJenis(order, pkg)],
    ["Porsi", pkg?.detail],
    ["Nama", order.customer_name],
    ["Telepon", order.customer_phone],
    ["Alamat", order.delivery_address],
    ["Pembayaran", order.payment_method],
  ];
  if (!pkg && order.notes) metaRaw.push(["Catatan", order.notes]);
  const meta = metaRaw.filter(([, v]) => v != null && v !== "");

  const rows = items.map((it) => ({
    name: it.name ?? "",
    qty: [it.amount, it.unit].filter((v) => v != null && v !== "").join(" "),
    price: formatRupiah(it.priceIdr ?? 0),
  }));

  // Pengukur teks (font wajib di-set sebelum measureText).
  const mc = document.createElement("canvas").getContext("2d");
  const fValue = `15px ${RECEIPT_FONT}`;

  // Pra-hitung pembungkusan nilai meta yang panjang (alamat/catatan).
  mc.font = fValue;
  const valueW = contentW - labelColW;
  const metaLines = meta.map(([label, value]) => ({
    label,
    lines: wrapByWidth(mc, value, valueW),
  }));

  // Hitung tinggi kanvas.
  const HEADER_H = 156;
  const LINE_H = 24;
  const ITEM_H = 28;
  let H = HEADER_H + 26; // header + jeda
  H += 30; // judul "DETAIL PESANAN"
  for (const m of metaLines) H += m.lines.length * LINE_H + 6;
  H += 18; // divider
  if (rows.length) {
    H += 30; // judul "RINCIAN BELANJA"
    H += rows.length * ITEM_H;
    H += 18; // divider
  }
  H += LINE_H * 2; // subtotal + ongkir
  H += 40; // total (ditebalkan)
  H += 22; // jeda
  H += 44; // footer
  H += 32; // padding bawah

  // Kanvas final (retina-friendly).
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.textBaseline = "top";

  // Latar putih.
  ctx.fillStyle = BRAND.white;
  ctx.fillRect(0, 0, W, H);

  // Header hijau pastel + logo warna asli (kontras & terbaca).
  ctx.fillStyle = BRAND.headerBg;
  ctx.fillRect(0, 0, W, HEADER_H);
  let logo = null;
  try { logo = await loadImage("/email/cookplan-logo-dark.png"); } catch { /* fallback teks */ }
  if (logo && logo.width) {
    const lh = 60;
    const lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, (W - lw) / 2, 36, lw, lh);
  } else {
    ctx.fillStyle = BRAND.logoInk;
    ctx.font = `bold 34px ${RECEIPT_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("CookPlan", W / 2, 48);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = BRAND.green;
  ctx.font = `600 14px ${RECEIPT_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("STRUK PESANAN", W / 2, HEADER_H - 38);
  ctx.textAlign = "left";

  let y = HEADER_H + 26;

  const sectionTitle = (text) => {
    ctx.fillStyle = BRAND.green;
    ctx.font = `bold 13px ${RECEIPT_FONT}`;
    ctx.fillText(text.toUpperCase(), padX, y);
    y += 30;
  };
  const divider = () => {
    y += 8;
    ctx.strokeStyle = BRAND.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + 0.5);
    ctx.lineTo(W - padX, y + 0.5);
    ctx.stroke();
    y += 10;
  };

  // Detail pesanan.
  sectionTitle("Detail Pesanan");
  for (const m of metaLines) {
    ctx.fillStyle = BRAND.muted;
    ctx.font = `13px ${RECEIPT_FONT}`;
    ctx.fillText(m.label, padX, y + 2);
    ctx.fillStyle = BRAND.ink;
    ctx.font = fValue;
    m.lines.forEach((ln, i) => ctx.fillText(ln, padX + labelColW, y + i * LINE_H));
    y += m.lines.length * LINE_H + 6;
  }

  divider();

  // Rincian belanja.
  if (rows.length) {
    sectionTitle("Rincian Belanja");
    const priceColW = 110;
    const qtyColW = 96;
    const nameColW = contentW - priceColW - qtyColW - 8;
    const qtyX = padX + nameColW + 8;
    for (const r of rows) {
      ctx.fillStyle = BRAND.ink;
      ctx.font = fValue;
      ctx.textAlign = "left";
      ctx.fillText(ellipsize(ctx, r.name, nameColW), padX, y);
      ctx.fillStyle = BRAND.muted;
      ctx.font = `14px ${RECEIPT_FONT}`;
      ctx.fillText(r.qty, qtyX, y + 1);
      ctx.fillStyle = BRAND.ink;
      ctx.font = fValue;
      ctx.textAlign = "right";
      ctx.fillText(r.price, W - padX, y);
      ctx.textAlign = "left";
      y += ITEM_H;
    }
    divider();
  }

  // Rincian biaya.
  const costRow = (label, value, emphasis) => {
    ctx.textAlign = "left";
    ctx.fillStyle = emphasis ? BRAND.green : BRAND.muted;
    ctx.font = emphasis ? `bold 18px ${RECEIPT_FONT}` : `14px ${RECEIPT_FONT}`;
    ctx.fillText(label, padX, y);
    ctx.textAlign = "right";
    ctx.fillStyle = emphasis ? BRAND.green : BRAND.ink;
    ctx.font = emphasis ? `bold 18px ${RECEIPT_FONT}` : `15px ${RECEIPT_FONT}`;
    ctx.fillText(value, W - padX, y);
    ctx.textAlign = "left";
    y += emphasis ? 40 : LINE_H;
  };
  costRow("Subtotal", formatRupiah(subtotal), false);
  costRow("Ongkir", formatRupiah(deliveryFee), false);
  costRow("TOTAL", formatRupiah(total), true);

  // Footer.
  y += 22;
  ctx.fillStyle = BRAND.ink;
  ctx.font = `600 14px ${RECEIPT_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Terima kasih telah memesan di CookPlan!", W / 2, y);
  ctx.fillStyle = BRAND.muted;
  ctx.font = `12px ${RECEIPT_FONT}`;
  ctx.fillText("Simpan struk ini sebagai bukti pesanan.", W / 2, y + 22);
  ctx.textAlign = "left";

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat gambar struk."))),
      "image/png"
    );
  });
}

// Buat struk PNG lalu picu unduhan (Struk-<id>.png).
export async function downloadReceiptImage(order, items = []) {
  const blob = await renderReceiptImage(order, items);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Struk-${order.id || "pesanan"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Susun URL wa.me lengkap (siap dibuka window.open). Teks = ringkasan singkat.
export function buildWhatsappUrl(order, adminNumber = WA_ADMIN_NUMBER) {
  const text = buildWhatsappText(order);
  return `https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}`;
}

// Template singkat (tanpa order) untuk CTA umum di landing/hero.
export function buildSimpleWhatsappUrl(message, adminNumber = WA_ADMIN_NUMBER) {
  return `https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`;
}

export { WA_ADMIN_NUMBER, formatRupiah };
