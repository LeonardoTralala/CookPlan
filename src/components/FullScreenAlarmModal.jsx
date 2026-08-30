import { useState, useEffect, useCallback } from 'react';
import { usePlan } from '../hooks/usePlan.js';
import { playAlarmRingtone } from '../utils/alarm.js';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MEAL_LABEL = {
  breakfast: 'Sarapan 🌅',
  lunch: 'Makan Siang ☀️',
  dinner: 'Makan Malam 🌙',
};

export function FullScreenAlarmModal() {
  const { weeklyPlan, toggleCookedStatus, showToast } = usePlan();
  const [isVisible, setIsVisible] = useState(false);

  const todayKey = new Date().toISOString().split('T')[0];
  const todayName = DAY_NAMES[new Date().getDay()];

  // Ambil menu hari ini yang belum dimasak
  const todayPlan = weeklyPlan[todayName] || {};
  let uncookedMeals = Object.entries(todayPlan)
    .filter(([, slot]) => slot && slot.recipeId && !slot.isCooked)
    .map(([type, slot]) => ({ mealType: type, day: todayName, ...slot }));

  // Fallback: Jika hari ini kosong, ambil menu hari lain di minggu ini
  if (uncookedMeals.length === 0) {
    Object.entries(weeklyPlan || {}).forEach(([day, meals]) => {
      Object.entries(meals || {}).forEach(([type, slot]) => {
        if (slot && slot.recipeId && !slot.isCooked) {
          uncookedMeals.push({ day, mealType: type, ...slot });
        }
      });
    });
  }

  // Fallback Sample jika planner masih kosong agar notifikasi alarm TETAP BISA TAMPIL
  if (uncookedMeals.length === 0) {
    uncookedMeals = [
      { mealType: 'breakfast', day: todayName, title: 'Nasi Goreng Spesial Telur', servings: 2, recipeId: 'sample-1' },
      { mealType: 'lunch', day: todayName, title: 'Soto Ayam Madura Lengkap', servings: 2, recipeId: 'sample-2' },
    ];
  }

  const checkAlarmTrigger = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();

    // Notifikasi & alarm aktif mulai pukul 06.00 pagi atau lewat query ?trigger_alarm=true
    const urlParams = new URLSearchParams(window.location.search);
    const forceFromUrl = urlParams.get('trigger_alarm') === 'true';

    // Jika belum jam 06.00 pagi dan bukan dari klik notifikasi, tunggu jam 06.00
    if (currentHour < 6 && !forceFromUrl) return;

    // Cek apakah user sudah menghentikan alarm hari ini ("Baik CookPlan")
    const dismissedDay = localStorage.getItem('cookplan_alarm_dismissed_date');
    if (dismissedDay === todayKey && !forceFromUrl) return;

    // Cek apakah alarm sedang ditunda ("Tunda 10 Menit")
    const snoozeUntil = localStorage.getItem('cookplan_alarm_snooze_until');
    if (snoozeUntil && Date.now() < Number(snoozeUntil) && !forceFromUrl) return;

    // Trigger Alarm Layar Penuh!
    setIsVisible(true);
    playAlarmRingtone();

    // Kirim Web Push Notification sistem browser bila diizinkan
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification('⏰ Alarm Masak Pagi 06.00 CookPlan', {
              body: `Waktunya masak hari ini (${todayName})! Kamu punya ${uncookedMeals.length} menu yang belum dimasak.`,
              icon: '/icon-192.png',
              badge: '/favicon.svg',
              tag: 'cookplan-alarm-0600',
              renotify: true,
            });
          });
        } else {
          new Notification('⏰ Alarm Masak Pagi 06.00 CookPlan', {
            body: `Waktunya masak hari ini (${todayName})! Kamu punya ${uncookedMeals.length} menu yang belum dimasak.`,
            icon: '/icon-192.png',
            tag: 'cookplan-alarm-0600',
          });
        }
      } catch { /* opsional */ }
    }
  }, [todayKey, todayName, uncookedMeals.length]);

  useEffect(() => {
    // Minta Izin Notifikasi Browser / HP otomatis saat pertama kali dimuat
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    // Auto check saat mount (delay 1s) & interval tiap 10 detik
    const timerId = setTimeout(checkAlarmTrigger, 1000);
    const intervalId = setInterval(checkAlarmTrigger, 10000);

    // Event listener pemicu alarm manual & dari Service Worker message
    const handleCustomTrigger = () => {
      setIsVisible(true);
      playAlarmRingtone();
    };

    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'TRIGGER_COOKPLAN_ALARM') {
        setIsVisible(true);
        playAlarmRingtone();
      }
    };

    window.addEventListener('trigger-cookplan-alarm', handleCustomTrigger);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      clearTimeout(timerId);
      clearInterval(intervalId);
      window.removeEventListener('trigger-cookplan-alarm', handleCustomTrigger);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [checkAlarmTrigger]);

  // Tombol 1: Tunda 10 Menit (Snooze 10 Mins)
  const handleSnooze = () => {
    const tenMinutesLater = Date.now() + 10 * 60 * 1000;
    localStorage.setItem('cookplan_alarm_snooze_until', tenMinutesLater.toString());
    setIsVisible(false);
    showToast('Alarm ditunda 10 menit! CookPlan akan mengingatkanmu kembali ⏰', { duration: 5000 });
  };

  // Tombol 2: Baik CookPlan (Dismiss Alarm Today)
  const handleAcknowledge = () => {
    localStorage.setItem('cookplan_alarm_dismissed_date', todayKey);
    localStorage.removeItem('cookplan_alarm_snooze_until');
    setIsVisible(false);
    showToast('Siap, king! Alarm pagi 06.00 dihentikan untuk hari ini 👍', { duration: 5000 });
  };

  const handleMarkCooked = async (day, mealType, title) => {
    try {
      if (!title.includes('Spesial') && !title.includes('Madura')) {
        await toggleCookedStatus(day, mealType, true);
      }
      showToast(`"${title}" ditandai sudah dimasak! 🍳✨`);
    } catch {
      showToast('Gagal mengubah status.', { variant: 'error' });
    }
  };

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alarm-modal-title"
      className="fixed inset-0 z-[100] bg-gradient-to-b from-emerald-950 via-teal-950 to-black text-white flex flex-col justify-between p-6 sm:p-10 animate-fade-in overflow-y-auto"
    >
      {/* Visual Ambient Ringing Pulse Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-ping pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-teal-400/20 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header — WhatsApp Call Style */}
      <div className="relative z-10 text-center pt-6 space-y-3">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 via-green-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-2xl ring-8 ring-emerald-500/30 animate-bounce">
          <span className="material-symbols-outlined text-5xl">alarm_on</span>
        </div>

        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black uppercase tracking-widest shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          PENGINGAT MASAK PAGI 06.00 COOKPLAN
        </span>

        <h1 id="alarm-modal-title" className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
          Waktunya Masak Pagi Hari Ini ({todayName})! 🍳
        </h1>
        <p className="text-emerald-200/90 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Kamu punya <strong>{uncookedMeals.length} menu masakan</strong> yang belum dimasak. Yuk persiapkan bahan makananmu!
        </p>
      </div>

      {/* Main Content — Uncooked Menu Cards */}
      <div className="relative z-10 max-w-xl mx-auto w-full my-6 space-y-3">
        {uncookedMeals.map((item, idx) => (
          <div
            key={item.recipeId || `${item.day}-${item.mealType}-${idx}`}
            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xl"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-wider block">
                {MEAL_LABEL[item.mealType] || item.mealType} ({item.day})
              </span>
              <h3 className="font-extrabold text-base sm:text-lg text-white truncate">
                {item.title}
              </h3>
              <p className="text-xs text-emerald-100/80">Porsi: {item.servings} orang</p>
            </div>

            <button
              type="button"
              onClick={() => handleMarkCooked(item.day, item.mealType, item.title)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black shadow-lg transition active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Selesai
            </button>
          </div>
        ))}
      </div>

      {/* Bottom Action Controls — WhatsApp Call / Alarm Screen Buttons */}
      <div className="relative z-10 max-w-lg mx-auto w-full pb-6 grid grid-cols-2 gap-4">
        {/* Tombol 1: Tunda 10 Menit */}
        <button
          type="button"
          onClick={handleSnooze}
          className="py-4 px-5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-2 border-amber-400/50 rounded-full font-black text-xs sm:text-sm transition flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-lg backdrop-blur-md"
        >
          <span className="material-symbols-outlined text-2xl animate-spin">snooze</span>
          <span>Tunda 10 Menit 😴</span>
        </button>

        {/* Tombol 2: Baik CookPlan */}
        <button
          type="button"
          onClick={handleAcknowledge}
          className="py-4 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full font-black text-xs sm:text-sm transition flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xl ring-4 ring-emerald-500/30"
        >
          <span className="material-symbols-outlined text-2xl">verified</span>
          <span>Baik CookPlan 👍</span>
        </button>
      </div>
    </div>
  );
}
