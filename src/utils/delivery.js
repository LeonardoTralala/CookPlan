// Modul utilitas untuk biaya pengantaran (ongkir) CookPlan di area Kota Malang.
// Tarif disesuaikan per kecamatan:
// - Blimbing: Rp 5.000
// - Lowokwaru: Rp 8.000
// - Klojen: Rp 12.000
// - Kedungkandang: Rp 15.000
// - Sukun: Rp 15.000

export const KECAMATAN_DELIVERY_FEES = {
  Blimbing: 5000,
  Lowokwaru: 8000,
  Klojen: 12000,
  Kedungkandang: 15000,
  Sukun: 15000,
};

export const DEFAULT_DELIVERY_FEE = 15000;

export const KECAMATAN_LIST = [
  { name: 'Blimbing', fee: 5000 },
  { name: 'Lowokwaru', fee: 8000 },
  { name: 'Klojen', fee: 12000 },
  { name: 'Kedungkandang', fee: 15000 },
  { name: 'Sukun', fee: 15000 },
];

/**
 * Mengambil biaya pengantaran berdasarkan nama kecamatan (case-insensitive).
 * Mengembalikan null jika kecamatan kosong, atau DEFAULT_DELIVERY_FEE jika tidak terdaftar.
 */
export function getDeliveryFeeByKecamatan(kecamatan) {
  if (!kecamatan || typeof kecamatan !== 'string') return null;
  const trimmed = kecamatan.trim().toLowerCase();
  const match = KECAMATAN_LIST.find((k) => k.name.toLowerCase() === trimmed);
  return match ? match.fee : DEFAULT_DELIVERY_FEE;
}

/**
 * Mencari nama kecamatan yang terkandung dalam teks alamat.
 */
export function extractKecamatanFromAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const lower = address.toLowerCase();
  const match = KECAMATAN_LIST.find((k) => lower.includes(k.name.toLowerCase()));
  return match ? match.name : null;
}
