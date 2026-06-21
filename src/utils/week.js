// Sumber kebenaran tunggal untuk semua perhitungan & format tanggal mingguan.
// Minggu dimulai hari SENIN (konvensi planner). Semua memakai komponen tanggal
// LOKAL (bukan UTC / toISOString) supaya user di WIB (UTC+7) tidak tergeser ke
// hari sebelumnya saat tengah malam lokal — bug yang bikin week_start_date
// tersimpan/terbaca di minggu yang salah.
//
// Dipakai bersama oleh planService.js (kunci DB) dan WeeklyPlanner.jsx (tampilan)
// supaya tidak ada lagi dua implementasi "cari hari Senin" yang bisa drift.

export const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

// Date object di local-midnight hari Senin pada minggu yang memuat `date`.
export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Minggu..6=Sabtu
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 'YYYY-MM-DD' dari komponen LOKAL — dipakai sebagai kunci week_start_date di DB
// dan sebagai sufiks key localStorage.
export function toWeekKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Parse 'YYYY-MM-DD' menjadi Date di local-midnight. Sengaja TIDAK pakai
// `new Date('YYYY-MM-DD')` karena itu diparse sebagai UTC dan bisa menggeser hari.
export function weekKeyToDate(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Geser n minggu (boleh negatif) dari sebuah weekStart, kembalikan Date baru.
export function addWeeks(weekStart, n) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + n * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 7 Date object Senin..Minggu dari sebuah weekStart.
export function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

// Formatter Intl di-cache di module scope (membuat instance baru tiap render mahal).
const fmtDayMonthYear = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDayMonth = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long' });
const fmtDay = new Intl.DateTimeFormat('id-ID', { day: 'numeric' });

// Rentang minggu yang ramah dibaca, menangani lintas bulan & tahun:
//   "16–22 Juni 2026"
//   "30 Juni – 6 Juli 2026"
//   "29 Desember 2025 – 4 Januari 2026"
export function formatWeekRange(weekStart) {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) return `${fmtDay.format(start)}–${fmtDayMonthYear.format(end)}`;
  if (sameYear) return `${fmtDayMonth.format(start)} – ${fmtDayMonthYear.format(end)}`;
  return `${fmtDayMonthYear.format(start)} – ${fmtDayMonthYear.format(end)}`;
}
