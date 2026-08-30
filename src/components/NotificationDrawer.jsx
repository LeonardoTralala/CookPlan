import { useState } from 'react';
import { ModalSheet } from './ModalSheet.jsx';
import { usePlan } from '../hooks/usePlan.js';
import { useNavigate } from 'react-router-dom';
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
      badge: '🔴 Rawan Rusak',
      color: 'bg-rose-100 text-rose-900 border-rose-300',
    };
  }
  if (/ayam|daging|sapi|bakso|sosis|tahu|tempe/i.test(lower)) {
    return {
      badge: '🟡 Perlu Diolah',
      color: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  }
  return {
    badge: '🟢 Segar',
    color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  };
}

// Panduan Referensi Ketahanan Bahan (Tabel Penyimpanan)
const SHELF_LIFE_DATABASE = [
  { item: 'Daging Sapi Segar', roomTemp: '2 jam', fridge: '2-3 hari', freezer: '1-3 bulan', icon: 'set_meal' },
  { item: 'Daging Ayam Segar', roomTemp: '2 jam', fridge: '1-2 hari', freezer: '1 minggu', icon: 'restaurant' },
  { item: 'Seafood & Ikan Segar', roomTemp: '2 jam', fridge: '1-2 hari', freezer: '2-3 minggu', icon: 'phishing' },
  { item: 'Sayuran Hijau (Bayam, Kangkung)', roomTemp: '1 hari', fridge: '2-3 hari', freezer: 'Tidak disarankan', icon: 'eco' },
  { item: 'Telur Ayam', roomTemp: '1-2 minggu', fridge: '2-3 minggu', freezer: 'Tidak disarankan', icon: 'egg' },
  { item: 'Tahu & Tempe', roomTemp: '1 hari', fridge: '2-3 hari', freezer: 'Tidak disarankan', icon: 'inventory_2' },
  { item: 'Bumbu & Rempah Kering', roomTemp: '1-2 minggu', fridge: '2-3 minggu', freezer: 'Tidak disarankan', icon: 'skillet' },
];

export function NotificationDrawerButton() {
  const { weeklyPlan } = usePlan();
  const [isOpen, setIsOpen] = useState(false);

  const todayName = DAY_NAMES[new Date().getDay()];

  // Hitung menu belum dimasak
  let uncookedCount = 0;
  const uncookedList = [];

  Object.entries(weeklyPlan || {}).forEach(([day, meals]) => {
    Object.entries(meals || {}).forEach(([type, slot]) => {
      if (slot && slot.recipeId && !slot.isCooked) {
        uncookedCount += 1;
        uncookedList.push({ day, mealType: type, ...slot });
      }
    });
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Pemberitahuan & Pengingat Masak"
        className="relative inline-flex items-center justify-center w-11 h-11 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container transition cursor-pointer"
      >
        <span className="material-symbols-outlined text-[22px]" aria-hidden="true">notifications</span>
        {uncookedCount > 0 && (
          <span className="absolute top-2 right-2 min-w-4 h-4 px-1 rounded-full bg-error text-white text-[10px] font-black flex items-center justify-center animate-pulse">
            {uncookedCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDrawerModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          uncookedList={uncookedList}
          todayName={todayName}
        />
      )}
    </>
  );
}

function NotificationDrawerModal({ onClose, uncookedList, todayName }) {
  const { toggleCookedStatus, showToast } = usePlan();
  const navigate = useNavigate();
  const [tab, setTab] = useState('uncooked'); // 'uncooked' | 'freshness'

  const todayUncooked = uncookedList.filter(item => item.day === todayName);
  const otherUncooked = uncookedList.filter(item => item.day !== todayName);

  const handleMarkCooked = async (day, mealType, title) => {
    try {
      await toggleCookedStatus(day, mealType, true);
      showToast(`"${title}" ditandai sudah dimasak! 🍳✨`);
    } catch {
      showToast('Gagal mengubah status masak.', { variant: 'error' });
    }
  };

  return (
    <ModalSheet onClose={onClose} labelledBy="notif-modal-title" panelClassName="max-w-xl max-h-[85dvh] flex flex-col">
      <div className="p-6 pb-4 border-b border-outline-variant/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">notifications_active</span>
          </div>
          <div className="flex-1">
            <h2 id="notif-modal-title" className="text-xl font-black text-on-surface tracking-tight">
              Pemberitahuan & Ketahanan Bahan
            </h2>
            <p className="text-xs text-on-surface-variant">
              Pengingat jadwal masak & batas waktu penyimpanan bahan makananmu.
            </p>
          </div>
        </div>

        {/* Tombol Bunyikan Alarm Layar Penuh */}
        <button
          type="button"
          onClick={() => {
            onClose();
            triggerCookPlanAlarm();
          }}
          className="w-full mt-3 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md hover:opacity-90 cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">alarm_on</span>
          <span>Bunyikan Alarm Pengingat Masak 🔔</span>
        </button>

        {/* Tab Switcher */}
        <div className="flex gap-2 mt-4 p-1 bg-surface-container-high rounded-full">
          <button
            type="button"
            onClick={() => setTab('uncooked')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === 'uncooked' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">cooking</span>
            <span>Menu Belum Dimasak ({uncookedList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('freshness')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === 'freshness' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">eco</span>
            <span>Ketahanan Bahan</span>
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 space-y-4">
        {tab === 'uncooked' ? (
          <>
            {uncookedList.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">task_alt</span>
                </div>
                <h3 className="font-bold text-base text-on-surface">Semua Menu Sudah Dimasak! 🎉</h3>
                <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                  Hebat sekali! Tidak ada jadwal menu masak yang tertunda minggu ini.
                </p>
              </div>
            ) : (
              <>
                {/* Menu Hari Ini */}
                {todayUncooked.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 w-fit">
                      <span className="material-symbols-outlined text-[16px] animate-pulse">priority_high</span>
                      <span>Harus Dimasak Hari Ini ({todayName})</span>
                    </div>

                    {todayUncooked.map((item) => {
                      const freshness = getFreshnessStatus(item.title);
                      return (
                        <div key={`${item.day}-${item.mealType}`} className="bg-white border-2 border-amber-300 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                                {MEAL_LABEL[item.mealType] || item.mealType}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${freshness.color}`}>
                                {freshness.badge}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-on-surface truncate">{item.title}</h4>
                            <span className="text-[11px] text-on-surface-variant">Porsi: {item.servings} orang</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMarkCooked(item.day, item.mealType, item.title)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[16px]">check</span>
                            Selesai
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Menu Hari Lainnya */}
                {otherUncooked.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                      Jadwal Hari Lain Mingguan ({otherUncooked.length})
                    </span>

                    {otherUncooked.map((item) => (
                      <div key={`${item.day}-${item.mealType}`} className="bg-surface-container-low border border-outline-variant/60 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold bg-surface-container-high px-2 py-0.5 rounded-md text-on-surface-variant">
                              {item.day}
                            </span>
                            <span className="text-[10px] text-on-surface-variant">
                              {MEAL_LABEL[item.mealType] || item.mealType}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-on-surface truncate mt-1">{item.title}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMarkCooked(item.day, item.mealType, item.title)}
                          className="px-3 py-1.5 bg-surface-container-high hover:bg-emerald-600 hover:text-white text-on-surface-variant rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                          Masak
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* Tab Ketahanan Bahan */
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl p-4 text-xs space-y-1">
              <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">tips_and_updates</span>
                Panduan Ketahanan Bahan Masakan (Food Freshness Guide):
              </div>
              <p className="text-emerald-800/90 leading-relaxed">
                Pastikan bahan makanan segar diolah sesuai batas ketahanan di bawah ini agar nutrisi terjaga dan tidak terbuang mubazir!
              </p>
            </div>

            <div className="space-y-3">
              {SHELF_LIFE_DATABASE.map((item, idx) => (
                <div key={idx} className="bg-white border border-outline-variant/60 rounded-2xl p-4 space-y-2 shadow-xs">
                  <div className="flex items-center gap-2.5 font-bold text-sm text-on-surface">
                    <span className="material-symbols-outlined text-primary text-xl">{item.icon}</span>
                    <span>{item.item}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-outline-variant/40">
                    <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
                      <span className="block text-[9px] font-bold text-amber-800 uppercase">Suhu Ruang</span>
                      <span className="font-extrabold text-amber-950">{item.roomTemp}</span>
                    </div>
                    <div className="bg-teal-50 p-2 rounded-xl border border-teal-200">
                      <span className="block text-[9px] font-bold text-teal-800 uppercase">Kulkas Bawah</span>
                      <span className="font-extrabold text-teal-950">{item.fridge}</span>
                    </div>
                    <div className="bg-blue-50 p-2 rounded-xl border border-blue-200">
                      <span className="block text-[9px] font-bold text-blue-800 uppercase">Freezer</span>
                      <span className="font-extrabold text-blue-950">{item.freezer}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-outline-variant/60 bg-surface-container-lowest text-center">
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/planner');
          }}
          className="w-full py-3 bg-primary text-white font-bold text-xs rounded-full shadow-md hover:bg-primary/90 transition cursor-pointer"
        >
          Kelola di Rencana Masak Mingguan
        </button>
      </div>
    </ModalSheet>
  );
}
