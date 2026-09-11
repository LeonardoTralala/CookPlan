import { toPng } from 'html-to-image';

export const QRIS_BANK_OPTIONS = [
  'Mandiri',
  'BCA',
  'BRI',
  'BNI',
  'BSI',
  'CIMB Niaga',
  'Bank Jatim',
  'PermataBank',
  'GoPay',
  'OVO',
  'DANA',
  'ShopeePay',
  'LinkAja',
];

/**
 * Dapatkan bank / e-wallet sumber acak dari daftar QRIS_BANK_OPTIONS
 */
export function getRandomBank() {
  const idx = Math.floor(Math.random() * QRIS_BANK_OPTIONS.length);
  return QRIS_BANK_OPTIONS[idx];
}

const INDO_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Format Date object atau ISO string ke format struk: "2 Jul 2026 - 16:13"
 */
export function formatQrisDate(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = d.getDate();
  const month = INDO_MONTHS_SHORT[d.getMonth()] || '';
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year} - ${hours}:${minutes}`;
}

/**
 * Format input datetime-local HTML (YYYY-MM-DDTHH:mm) ke Date string/obj
 */
export function getLocalDatetimeInputValue(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Format Date object ke string YYYY-MM-DD untuk input HTML type="date"
 */
export function getLocalDateOnlyInputValue(date = new Date()) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Buat Date H-1 dari hari acuan (pemesanan paket) dengan jam acak di bawah pukul 20:00 (rentang 08:00 - 19:59)
 */
export function generateHMinusOneRandomDate(baseDate = new Date()) {
  let d = new Date(baseDate);
  if (isNaN(d.getTime())) d = new Date();
  d.setDate(d.getDate() - 1);
  const randomHour = Math.floor(8 + Math.random() * 12); // 8 s/d 19
  const randomMinute = Math.floor(Math.random() * 60);  // 0 s/d 59
  d.setHours(randomHour, randomMinute, 0, 0);
  return d;
}

/**
 * Buat Date H-1 atau H-2 dari hari acuan paket belanja bahan makanan
 * dengan jam acak di bawah pukul 20:00 (rentang 08:00 - 19:59).
 * @param {Date|string} baseDate - Tanggal rujukan paket
 * @param {number|null} daysBack - Jumlah hari mundur (1 = H-1, 2 = H-2, null = acak antara 1 atau 2)
 */
export function generatePackageRandomDate(baseDate = new Date(), daysBack = null) {
  let d = new Date(baseDate);
  if (isNaN(d.getTime())) d = new Date();
  const days = daysBack !== null ? daysBack : (Math.random() < 0.5 ? 1 : 2);
  d.setDate(d.getDate() - days);
  const randomHour = Math.floor(8 + Math.random() * 12); // 8 s/d 19
  const randomMinute = Math.floor(Math.random() * 60);  // 0 s/d 59
  d.setHours(randomHour, randomMinute, 0, 0);
  return d;
}

/**
 * Buat Date pada hari yang sama (Hari-H) dari hari acuan (khusus penjualan langganan bulanan CookPass)
 * dengan jam acak di bawah pukul 20:00 (rentang 08:00 - 19:59)
 */
export function generateSameDayRandomDate(baseDate = new Date()) {
  let d = new Date(baseDate);
  if (isNaN(d.getTime())) d = new Date();
  const randomHour = Math.floor(8 + Math.random() * 12); // 8 s/d 19
  const randomMinute = Math.floor(Math.random() * 60);  // 0 s/d 59
  d.setHours(randomHour, randomMinute, 0, 0);
  return d;
}

/**
 * Buat kode acak alfanumerik yang selalu berakhiran "ID" (misal: "bZ9xID")
 */
export function generateRandomSuffix(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const prefixLen = Math.max(1, len - 2);
  let res = '';
  for (let i = 0; i < prefixLen; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${res}ID`;
}

/**
 * Memastikan string kode berakhiran huruf kapital "ID"
 */
export function ensureSuffixEndsWithId(code) {
  if (!code) return generateRandomSuffix(6);
  const trimmed = code.trim();
  if (trimmed.toUpperCase().endsWith('ID')) {
    return `${trimmed.slice(0, -2)}ID`;
  }
  return `${trimmed}ID`;
}

/**
 * Buat nomor transaksi QRIS realistis:
 * - part1: 14 digit numerik (contoh: 04202607020913)
 * - part2: 13 karakter alfanumerik (contoh: 38pYm4tQbZ9xK)
 * - part3: 1 karakter alfanumerik (contoh: w)
 */
export function generateTxNumbers(date = new Date()) {
  const d = new Date(date);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const randomSeq = String(Math.floor(1000 + Math.random() * 9000));
  const part1 = `04${yyyy}${mm}${dd}${randomSeq}`;

  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let fullAlpha = '';
  for (let i = 0; i < 14; i++) {
    fullAlpha += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const part2 = fullAlpha.slice(0, 13);
  const part3 = fullAlpha.slice(13);

  return { part1, part2, part3, fullCode: `${part1}${fullAlpha}` };
}

/**
 * NMID resmi toko CookPlan
 */
export const DEFAULT_NMID = 'ID1026539688444';

/**
 * Mendapatkan NMID resmi toko CookPlan ("ID1026539688444")
 */
export function generateRandomNmid() {
  return DEFAULT_NMID;
}

/**
 * Format angka ke format Rupiah tanpa desimal (misal: 200000 -> "Rp200.000")
 */
export function formatReceiptRupiah(num) {
  const n = typeof num === 'number' ? num : Number(String(num).replace(/[^0-9]/g, '')) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n).replace(/\s+/g, '');
}

/**
 * Unduh elemen DOM sebagai gambar PNG dengan resolusi proporsional (pixelRatio: 2)
 */
export async function exportQrisToPng(elementNode, filename = 'Struk-QRIS.png') {
  if (!elementNode) throw new Error('Elemen struk tidak ditemukan.');

  const dataUrl = await toPng(elementNode, {
    pixelRatio: 2,
    cacheBust: true,
    style: {
      transform: 'none',
      margin: '0 auto',
    },
  });

  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
