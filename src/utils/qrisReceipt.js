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
 * Buat NMID toko acak CookPlan (misal: "ID1026849173025")
 */
export function generateRandomNmid() {
  let digits = '';
  for (let i = 0; i < 11; i++) {
    digits += Math.floor(Math.random() * 10);
  }
  return `ID10${digits}`;
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
