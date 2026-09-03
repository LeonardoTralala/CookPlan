import { useState } from 'react';
import { usePlan } from '../hooks/usePlan.js';
import { triggerCookPlanAlarm } from '../utils/alarm.js';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MEAL_LABEL = {
  breakfast: 'Sarapan 🌅',
  lunch: 'Makan Siang ☀️',
  dinner: 'Makan Malam 🌙',
};

// Estimasi ketahanan bahan berdasarkan kata kunci di judul/bahan masakan
function getFreshnessStatus(recipeTitle = '') {
  const lower = recipeTitle.toLowerCase();
  if (/bayam|kangkung|sawi|sayur|brokoli|toge|tauge|buncis|ikan|udang|seafood|cumi/i.test(lower)) {
    return {
      level: 'urgent',
      badge: '🔴 Rawan Rusak',
      color: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
      dotColor: 'bg-rose-500 animate-ping',
      desc: 'Sayuran hijau & Seafood rawan layu/rusak. Disarankan dimasak hari ini!'
    };
  }
  if (/ayam|daging|sapi|bakso|sosis|tahu|tempe/i.test(lower)) {
    return {
      level: 'warning',
      badge: '🟡 Perlu Diolah',
      color: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      dotColor: 'bg-amber-400',
      desc: 'Daging, Ayam, & Tahu/Tempe: Segera diolah dalam 2-3 hari agar nutrisi tetap terjaga.'
    };
  }
  return {
    level: 'safe',
    badge: '🟢 Segar',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    dotColor: 'bg-emerald-400',
    desc: 'Bahan tahan lama & awet di kulkas atau suhu ruang.'
  };
}

// Database Panduan Ketahanan Bahan (Penyimpanan Ideal)
const SHELF_LIFE_DATABASE = [
  { category: 'Daging Sapi Segar', roomTemp: '2 jam', fridge: '2-3 hari', freezer: '1-3 bulan', icon: 'set_meal' },
  { category: 'Daging Ayam Segar', roomTemp: '2 jam', fridge: '1-2 hari', freezer: '1 minggu', icon: 'restaurant' },
  { category: 'Seafood & Ikan Segar', roomTemp: '2 jam', fridge: '1-2 hari', freezer: '2-3 minggu', icon: 'phishing' },
  { category: 'Sayuran Hijau (Bayam, Kangkung)', roomTemp: '1 hari', fridge: '2-3 hari', freezer: 'Tidak disarankan', icon: 'eco' },
  { category: 'Telur Ayam', roomTemp: '1-2 minggu', fridge: '2-3 minggu', freezer: 'Tidak disarankan', icon: 'egg' },
  { category: 'Tahu & Tempe', roomTemp: '1 hari', fridge: '2-3 hari', freezer: 'Tidak disarankan', icon: 'inventory_2' },
  { category: 'Bumbu & Rempah Kering', roomTemp: '1-2 minggu', fridge: '2-3 minggu', freezer: 'Tidak disarankan', icon: 'skillet' },
];

export function UncookedMealAssistant() {
  const { weeklyPlan, toggleCookedStatus, showToast } = usePlan();
  const [showTable, setShowTable] = useState(true);

  const todayName = DAY_NAMES[new Date().getDay()];

  // Ambil semua menu hari ini yang belum dimasak
  const todayPlan = weeklyPlan[todayName] || {};
  const todayMeals = Object.entries(todayPlan)
    .filter(([, slot]) => slot && slot.recipeId && !slot.isCooked)
    .map(([type, slot]) => ({ mealType: type, day: todayName, ...slot }));

  // Ambil semua menu minggu ini yang belum dimasak
  const allUncookedMeals = [];
  Object.entries(weeklyPlan || {}).forEach(([day, meals]) => {
    Object.entries(meals || {}).forEach(([type, slot]) => {
      if (slot && slot.recipeId && !slot.isCooked) {
        allUncookedMeals.push({ day, mealType: type, ...slot });
      }
    });
  });

  const handleMarkCooked = async (day, mealType, title) => {
    try {
      await toggleCookedStatus(day, mealType, true);
      showToast(`"${title}" ditandai sudah dimasak! 🍳✨`);
    } catch {
      showToast('Gagal mengubah status masak.', { variant: 'error' });
    }
  };

  return (
    <div className="mb-6 rounded-[28px] bg-gradient-to-br from-emerald-950 via-teal-950 to-neutral-900 text-white p-5 sm:p-6 shadow-xl border border-emerald-500/30 relative overflow-hidden animate-fade-in space-y-5">
      {/* Backdrop Ambient Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Widget */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-2xl animate-pulse">soup_kitchen</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-white tracking-tight">
                Cooking Assistant & Ketahanan Bahan
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider">
                Hari Ini: {todayName}
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              {todayMeals.length > 0
                ? `Deteksi Otomatis: Kamu punya ${todayMeals.length} menu belum dimasak hari ini!`
                : allUncookedMeals.length > 0
                ? `Semua menu ${todayName} sudah dimasak! Masih ada ${allUncookedMeals.length} menu di hari lain.`
                : `Belum ada menu tertunda. Susun jadwal di bawah untuk mengaktifkan pengingat!`
              }
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => {
              if (todayMeals.length === 0 && allUncookedMeals.length === 0) {
                showToast('Isi jadwal makanmu terlebih dahulu di Rencana Masak agar alarm dapat berfungsi!', { variant: 'warning' });
                return;
              }
              triggerCookPlanAlarm();
            }}
            className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 border border-emerald-400/40"
          >
            <span className="material-symbols-outlined text-[16px]">alarm_on</span>
            <span>Bunyikan Alarm 🔔</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-emerald-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/15"
          >
            <span className="material-symbols-outlined text-[16px]">table_chart</span>
            <span>{showTable ? 'Sembunyikan Tabel' : 'Tabel Ketahanan'}</span>
          </button>
        </div>
      </div>

      {/* DETEKSI OTOMATIS MENU HARI INI */}
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">flatware</span>
            Deteksi Menu Belum Dimasak Hari Ini ({todayName})
          </h4>
          <span className="text-[11px] text-emerald-200/70">
            Indikator: 🟢 Segar | 🟡 Perlu Diolah | 🔴 Rawan Rusak
          </span>
        </div>

        {todayMeals.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayMeals.map((item) => {
              const freshness = getFreshnessStatus(item.title);
              return (
                <div
                  key={`${item.day}-${item.mealType}`}
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 hover:border-emerald-400/50 transition flex flex-col justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                        {MEAL_LABEL[item.mealType] || item.mealType}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${freshness.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${freshness.dotColor}`} />
                        {freshness.badge}
                      </span>
                    </div>

                    <h5 className="font-bold text-sm text-white line-clamp-1">
                      {item.title}
                    </h5>

                    <p className="text-[11px] text-emerald-100/90 leading-tight bg-black/20 p-2 rounded-xl border border-white/10">
                      💡 {freshness.desc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleMarkCooked(item.day, item.mealType, item.title)}
                    className="w-full py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Tandai Sudah Dimasak
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl p-4 text-center text-xs text-emerald-200/90 border border-white/10 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">task_alt</span>
            <span>Tidak ada menu tertunda untuk hari <strong>{todayName}</strong>. Semua aman!</span>
          </div>
        )}
      </div>

      {/* TABEL PANDUAN BATAS WAKTU PENYIMPANAN IDEAL */}
      {showTable && (
        <div className="relative z-10 pt-2 border-t border-white/10 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">kitchen</span>
              Tabel Panduan Ketahanan Bahan (Penyimpanan Ideal)
            </h4>
            <span className="text-[10px] text-emerald-200/70">Daging · Sayur · Seafood · Telur · Tahu/Tempe · Bumbu</span>
          </div>

          <div className="overflow-x-auto hide-scrollbar rounded-2xl border border-white/15 bg-black/30">
            <table className="w-full text-left text-xs border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-white/10 text-emerald-200 border-b border-white/10">
                  <th className="py-2.5 px-4 font-bold">Kategori Bahan</th>
                  <th className="py-2.5 px-3 font-bold text-center bg-amber-500/10 text-amber-200">Suhu Ruang</th>
                  <th className="py-2.5 px-3 font-bold text-center bg-teal-500/10 text-teal-200">Kulkas Bawah</th>
                  <th className="py-2.5 px-3 font-bold text-center bg-blue-500/10 text-blue-200">Freezer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-emerald-100/90">
                {SHELF_LIFE_DATABASE.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition">
                    <td className="py-2.5 px-4 font-semibold flex items-center gap-2 text-white">
                      <span className="material-symbols-outlined text-emerald-400 text-base">{item.icon}</span>
                      <span>{item.category}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-200 font-medium bg-amber-500/5">{item.roomTemp}</td>
                    <td className="py-2.5 px-3 text-center text-teal-200 font-bold bg-teal-500/5">{item.fridge}</td>
                    <td className="py-2.5 px-3 text-center text-blue-200 font-medium bg-blue-500/5">{item.freezer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
