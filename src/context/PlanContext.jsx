import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PlanContext } from "./plan-context.js";
import { useAuth } from "../hooks/useAuth.js";
import * as planService from "../services/planService.js";
import { getWeekStart, toWeekKey, weekKeyToDate, addWeeks } from "../utils/week.js";

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

function createEmptyPlan() {
  return DAYS.reduce((acc, day) => {
    acc[day] = { breakfast: null, lunch: null, dinner: null };
    return acc;
  }, {});
}

function isValidPlanShape(plan) {
  if (!plan || typeof plan !== 'object') return false;
  return DAYS.every((day) => {
    const slots = plan[day];
    return slots && typeof slots === 'object' && !Array.isArray(slots) &&
      MEAL_TYPES.every((meal) => meal in slots);
  });
}

// localStorage (mode guest) di-key PER MINGGU supaya konsisten dengan DB yang
// juga per-minggu. Key: `weeklyPlan:<YYYY-MM-DD>`.
const localKey = (weekKey) => `weeklyPlan:${weekKey}`;

function loadLocalPlan(weekKey) {
  const saved = localStorage.getItem(localKey(weekKey));
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (isValidPlanShape(parsed)) return parsed;
    } catch {
      // abaikan data rusak
    }
  }
  // Migrasi sekali: key lama single-week ('weeklyPlan') hanya mewakili minggu
  // berjalan → adopsi ke key minggu ini lalu hapus yang lama.
  if (weekKey === toWeekKey(getWeekStart())) {
    const legacy = localStorage.getItem('weeklyPlan');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (isValidPlanShape(parsed)) {
          localStorage.setItem(localKey(weekKey), legacy);
          localStorage.removeItem('weeklyPlan');
          return parsed;
        }
      } catch {
        // abaikan data rusak
      }
      localStorage.removeItem('weeklyPlan');
    }
  }
  return createEmptyPlan();
}

export function PlanProvider({ children }) {
  const { isAuthenticated } = useAuth();

  // toast pakai counter id agar dua pesan identik tetap me-reset timer (audit #16).
  const [toast, setToast] = useState({ id: 0, message: "", onUndo: null, variant: "success" });
  // Minggu yang sedang dilihat (kunci YYYY-MM-DD = tanggal Senin). Default minggu
  // berjalan. Mengubahnya memicu reload plan dari DB/localStorage (lihat effect).
  const [weekStart, setWeekStart] = useState(() => toWeekKey(getWeekStart()));
  const [weeklyPlan, setWeeklyPlan] = useState(() => loadLocalPlan(toWeekKey(getWeekStart())));
  const [prepTasks, setPrepTasks] = useState([]);
  // Mirror SINKRON dari weeklyPlan terbaru. Sumber kebenaran untuk menghitung
  // nextPlan di mutator (setSlot/removeSlot/applySlots/restoreSlot) tanpa
  // bergantung pada eager-evaluation updater React (yang hanya jalan saat queue
  // update kosong). Setiap penulisan state HARUS lewat commitPlan / set ref ini.
  const planRef = useRef(weeklyPlan);
  // true saat plan user sedang dihidrasi dari DB (dipakai Planner & Belanja untuk
  // menampilkan skeleton, bukan flash empty-state). Guest pakai localStorage → false.
  const [loading, setLoading] = useState(false);

  // Satu-satunya jalur tulis state plan: jaga ref tetap sinkron lalu set state.
  // Nilai `next` harus sudah dihitung (bukan functional updater) supaya ref dan
  // state selalu identik secara sinkron.
  const commitPlan = useCallback((next) => {
    planRef.current = next;
    setWeeklyPlan(next);
  }, []);

  // planId DB minggu berjalan (null saat belum login / belum dimuat).
  const planIdRef = useRef(null);
  // Antrian mutasi yang terjadi sebelum planId siap (audit #6), agar tidak hilang.
  const pendingRef = useRef([]);

  const showToast = useCallback((message, options = {}) => {
    const onUndo = options.onUndo ?? null;
    setToast((prev) => ({
      id: prev.id + 1,
      message,
      onUndo,
      variant: options.variant ?? "success",
      // Toast ber-"Urungkan" hidup lebih lama: butuh waktu baca + putuskan + tap,
      // apalagi di mobile (audit UX). Bisa di-override lewat options.duration.
      duration: options.duration ?? (onUndo ? 7000 : 3000),
    }));
  }, []);

  useEffect(() => {
    if (!toast.message) return undefined;
    const timer = setTimeout(
      () => setToast((prev) => ({ ...prev, message: "", onUndo: null })),
      toast.duration ?? 3000
    );
    return () => clearTimeout(timer);
  }, [toast.id, toast.message, toast.duration]);

  // Persist helper: tulis ke DB bila login (planId siap), kalau belum siap antri,
  // kalau guest tulis localStorage. Dipanggil DI LUAR updater setState (audit #5).
  const persistSlot = useCallback((recipe, day, mealType, servings, nextPlan, ws = weekStart) => {
    if (isAuthenticated) {
      if (ws === weekStart && planIdRef.current) {
        planService.setSlot(planIdRef.current, recipe, day, mealType, servings)
          .catch((e) => console.error("setSlot gagal:", e.message));
      } else {
        planService.getCurrentPlan(ws)
          .then(({ planId }) => planService.setSlot(planId, recipe, day, mealType, servings))
          .catch((e) => console.error("setSlot multi-week gagal:", e.message));
      }
    } else {
      localStorage.setItem(localKey(ws), JSON.stringify(nextPlan));
    }
  }, [isAuthenticated, weekStart]);

  const persistRemove = useCallback((day, mealType, nextPlan, ws = weekStart) => {
    if (isAuthenticated) {
      if (ws === weekStart && planIdRef.current) {
        planService.removeSlot(planIdRef.current, day, mealType)
          .catch((e) => console.error("removeSlot gagal:", e.message));
      } else {
        planService.getCurrentPlan(ws)
          .then(({ planId }) => planService.removeSlot(planId, day, mealType))
          .catch((e) => console.error("removeSlot multi-week gagal:", e.message));
      }
    } else {
      localStorage.setItem(localKey(ws), JSON.stringify(nextPlan));
    }
  }, [isAuthenticated, weekStart]);

  // Saat status login ATAU minggu yang dilihat berubah: muat plan minggu tsb dari
  // DB + flush antrian. Saat logout/guest, baca localStorage per-minggu.
  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      planIdRef.current = null;
      // setState ditunda (queueMicrotask) agar tidak sinkron di body effect.
      queueMicrotask(() => {
        if (!active) return;
        setLoading(false);
        const next = loadLocalPlan(weekStart);
        planRef.current = next;
        setWeeklyPlan(next);
        
        // Guest mode: load prep tasks
        const savedTasks = localStorage.getItem(`prepTasks:${weekStart}`);
        setPrepTasks(savedTasks ? JSON.parse(savedTasks) : []);
      });
      return () => { active = false; };
    }

    // planId minggu lama tidak berlaku saat berpindah minggu: nolkan dulu supaya
    // mutasi yang masuk sebelum load baru selesai diantrekan, bukan ditulis ke
    // plan minggu yang salah.
    planIdRef.current = null;

    (async () => {
      setLoading(true);
      try {
        const { planId, plan } = await planService.getCurrentPlan(weekStart);
        if (!active) return;
        planIdRef.current = planId;

        // Muat prep tasks dari Supabase
        const tasks = await planService.getPrepTasks(planId);
        if (active) setPrepTasks(tasks);

        // Flush mutasi yang sempat tertunda sebelum planId siap.
        const pending = pendingRef.current;
        pendingRef.current = [];
        for (const m of pending) {
          try {
            if (m.type === "set") await planService.setSlot(planId, m.recipe, m.day, m.mealType, m.servings);
            else if (m.type === "toggleCooked") await planService.toggleCookedStatus(planId, m.day, m.mealType, m.isCooked);
            else await planService.removeSlot(planId, m.day, m.mealType);
          } catch (e) { console.error("flush pending gagal:", e.message); }
        }

        // Migrasi sekali: kalau DB kosong tapi ada data localStorage minggu ini,
        // dorong ke DB.
        const dbEmpty = Object.values(plan).every((d) => MEAL_TYPES.every((mm) => !d[mm]));
        const local = loadLocalPlan(weekStart);
        const localHasData = Object.values(local).some((d) => MEAL_TYPES.some((mm) => d[mm]));

        if (dbEmpty && localHasData && pending.length === 0) {
          let migratedOk = true;
          for (const day of DAYS) {
            for (const meal of MEAL_TYPES) {
              const slot = local[day][meal];
              if (slot && slot.recipeId != null) {
                try {
                  await planService.setSlot(planId, { id: slot.recipeId, ...slot }, day, meal, slot.servings ?? 2);
                } catch (e) { migratedOk = false; console.error("migrasi gagal:", e.message); }
              }
            }
          }
          // Hanya hapus localStorage bila SEMUA slot berhasil dimigrasi (audit #7).
          if (migratedOk) localStorage.removeItem(localKey(weekStart));
          const refreshed = await planService.getCurrentPlan(weekStart);
          if (active) { planRef.current = refreshed.plan; setWeeklyPlan(refreshed.plan); }
        } else {
          // Bila ada pending yang baru di-flush, reload agar konsisten.
          if (pending.length > 0) {
            const refreshed = await planService.getCurrentPlan(weekStart);
            if (active) { planRef.current = refreshed.plan; setWeeklyPlan(refreshed.plan); }
          } else {
            planRef.current = plan;
            setWeeklyPlan(plan);
          }
        }
      } catch (e) {
        console.error("muat plan gagal:", e.message);
        if (active) {
          const next = loadLocalPlan(weekStart);
          planRef.current = next;
          setWeeklyPlan(next);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [isAuthenticated, weekStart]);

  const isInPlan = useCallback(
    (recipeId) => {
      for (const day of DAYS) {
        for (const meal of MEAL_TYPES) {
          if (weeklyPlan[day]?.[meal]?.recipeId === recipeId) return true;
        }
      }
      return false;
    },
    [weeklyPlan]
  );

  // setSlot: hitung next state dari planRef (sinkron), commit, lalu persist DI
  // LUAR updater (audit #5). nextPlan dijamin terdefinisi (tak bergantung pada
  // eager-evaluation updater React).
  const setSlot = useCallback((recipe, day, mealType, servings) => {
    const slotData = {
      recipeId: recipe.id,
      title: recipe.title,
      servings,
      imageUrl: recipe.imageUrl,
      priceIdr: recipe.priceIdr,
      readyInMinutes: recipe.readyInMinutes,
      calories: recipe.calories,
    };
    const prev = planRef.current;
    const nextPlan = { ...prev, [day]: { ...prev[day], [mealType]: slotData } };
    commitPlan(nextPlan);
    persistSlot(recipe, day, mealType, servings, nextPlan);
  }, [commitPlan, persistSlot]);

  // applySlots: terapkan banyak slot sekaligus (hasil generate AI → planner).
  // Satu setState + satu bulk upsert, bukan loop setSlot per slot.
  // Return daftar undo [{ day, mealType, prev, weekStart }] berisi isi slot SEBELUM
  // tertimpa, untuk tombol "Urungkan" di toast (pakai restoreSlot per item).
  const applySlots = useCallback((slotList) => {
    const deduped = new Map();
    for (const s of slotList ?? []) {
      const ws = s.weekStart ?? weekStart;
      deduped.set(`${ws}|${s.day}|${s.mealType}`, { ...s, weekStart: ws });
    }
    if (deduped.size === 0) return [];

    // Group slots by weekStart
    const slotsByWeek = new Map();
    for (const s of deduped.values()) {
      if (!slotsByWeek.has(s.weekStart)) {
        slotsByWeek.set(s.weekStart, []);
      }
      slotsByWeek.get(s.weekStart).push(s);
    }

    const undoList = [];

    for (const [ws, weekSlots] of slotsByWeek.entries()) {
      let prevPlan;
      if (ws === weekStart) {
        prevPlan = planRef.current;
      } else {
        prevPlan = loadLocalPlan(ws);
      }

      const nextPlan = { ...prevPlan };
      for (const s of weekSlots) {
        undoList.push({
          day: s.day,
          mealType: s.mealType,
          weekStart: ws,
          prev: prevPlan[s.day]?.[s.mealType] ?? null
        });

        nextPlan[s.day] = {
          ...nextPlan[s.day],
          [s.mealType]: {
            recipeId: s.recipe.id,
            title: s.recipe.title,
            servings: s.servings,
            imageUrl: s.recipe.imageUrl,
            priceIdr: s.recipe.priceIdr,
            readyInMinutes: s.recipe.readyInMinutes,
            calories: s.recipe.calories,
          }
        };
      }

      if (ws === weekStart) {
        commitPlan(nextPlan);
      }

      if (isAuthenticated) {
        if (ws === weekStart && planIdRef.current) {
          planService.setSlots(planIdRef.current, weekSlots)
            .catch((e) => console.error("setSlots gagal:", e.message));
        } else {
          planService.getCurrentPlan(ws)
            .then(({ planId }) => planService.setSlots(planId, weekSlots))
            .catch((e) => console.error(`setSlots untuk ${ws} gagal:`, e.message));
        }
      } else {
        localStorage.setItem(localKey(ws), JSON.stringify(nextPlan));
      }
    }

    return undoList;
  }, [commitPlan, isAuthenticated, weekStart]);

  const removeSlot = useCallback((day, mealType) => {
    const prev = planRef.current;
    const nextPlan = { ...prev, [day]: { ...prev[day], [mealType]: null } };
    commitPlan(nextPlan);
    persistRemove(day, mealType, nextPlan);
  }, [commitPlan, persistRemove]);

  const toggleCookedStatus = useCallback(async (day, mealType, isCooked) => {
    const prev = planRef.current;
    const currentSlot = prev[day]?.[mealType];
    if (!currentSlot) return;

    const updatedSlot = { ...currentSlot, isCooked };
    const nextPlan = { ...prev, [day]: { ...prev[day], [mealType]: updatedSlot } };
    commitPlan(nextPlan);

    if (isAuthenticated) {
      if (planIdRef.current) {
        try {
          await planService.toggleCookedStatus(planIdRef.current, day, mealType, isCooked);
        } catch (e) {
          console.error("toggleCookedStatus gagal:", e.message);
          commitPlan(prev);
          showToast("Gagal memperbarui status masak", { variant: "error" });
        }
      } else {
        pendingRef.current.push({ type: "toggleCooked", day, mealType, isCooked });
      }
    } else {
      localStorage.setItem(localKey(weekStart), JSON.stringify(nextPlan));
    }
  }, [commitPlan, isAuthenticated, weekStart, showToast]);

  const addPrepTask = useCallback(async (taskText) => {
    if (!taskText.trim()) return;
    if (isAuthenticated) {
      if (planIdRef.current) {
        try {
          const newTask = await planService.addPrepTask(planIdRef.current, taskText);
          setPrepTasks(prev => [...prev, newTask]);
        } catch (e) {
          console.error("addPrepTask gagal:", e.message);
          showToast("Gagal menambah catatan persiapan", { variant: "error" });
        }
      }
    } else {
      const newTask = { id: Date.now(), taskText, isCompleted: false };
      const nextTasks = [...prepTasks, newTask];
      setPrepTasks(nextTasks);
      localStorage.setItem(`prepTasks:${weekStart}`, JSON.stringify(nextTasks));
    }
  }, [isAuthenticated, prepTasks, weekStart, showToast]);

  const togglePrepTask = useCallback(async (taskId, isCompleted) => {
    setPrepTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted } : t));
    
    if (isAuthenticated) {
      try {
        await planService.togglePrepTask(taskId, isCompleted);
      } catch (e) {
        console.error("togglePrepTask gagal:", e.message);
        setPrepTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !isCompleted } : t));
        showToast("Gagal memperbarui catatan persiapan", { variant: "error" });
      }
    } else {
      const nextTasks = prepTasks.map(t => t.id === taskId ? { ...t, isCompleted } : t);
      localStorage.setItem(`prepTasks:${weekStart}`, JSON.stringify(nextTasks));
    }
  }, [isAuthenticated, prepTasks, weekStart, showToast]);

  const deletePrepTask = useCallback(async (taskId) => {
    const prevTasks = prepTasks;
    setPrepTasks(prev => prev.filter(t => t.id !== taskId));
    
    if (isAuthenticated) {
      try {
        await planService.deletePrepTask(taskId);
      } catch (e) {
        console.error("deletePrepTask gagal:", e.message);
        setPrepTasks(prevTasks);
        showToast("Gagal menghapus catatan persiapan", { variant: "error" });
      }
    } else {
      const nextTasks = prepTasks.filter(t => t.id !== taskId);
      localStorage.setItem(`prepTasks:${weekStart}`, JSON.stringify(nextTasks));
    }
  }, [isAuthenticated, prepTasks, weekStart, showToast]);

  const clearAllSlots = useCallback(() => {
    const emptyPlan = createEmptyPlan();
    commitPlan(emptyPlan);
    if (isAuthenticated) {
      if (planIdRef.current) {
        planService.clearAllSlots(planIdRef.current)
          .catch((e) => console.error("clearAllSlots gagal:", e.message));
      } else {
        pendingRef.current = [];
      }
    } else {
      localStorage.setItem(localKey(weekStart), JSON.stringify(emptyPlan));
    }
  }, [commitPlan, isAuthenticated, weekStart]);

  // Navigasi antar-minggu. goToWeek(+1/-1) menggeser relatif; goToCurrentWeek
  // kembali ke minggu berjalan. Mengubah weekStart memicu reload via effect.
  const goToWeek = useCallback((offset) => {
    setWeekStart((prev) => toWeekKey(addWeeks(weekKeyToDate(prev), offset)));
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setWeekStart(toWeekKey(getWeekStart()));
  }, []);

  const isCurrentWeek = weekStart === toWeekKey(getWeekStart());

  const restoreSlot = useCallback((day, mealType, slotData, ws = weekStart) => {
    let nextPlan;
    if (ws === weekStart) {
      const prev = planRef.current;
      nextPlan = { ...prev, [day]: { ...prev[day], [mealType]: slotData } };
      commitPlan(nextPlan);
    } else {
      const prev = loadLocalPlan(ws);
      nextPlan = { ...prev, [day]: { ...prev[day], [mealType]: slotData } };
    }
    if (slotData?.recipeId != null) {
      persistSlot({ id: slotData.recipeId, ...slotData }, day, mealType, slotData.servings ?? 2, nextPlan, ws);
    } else {
      persistRemove(day, mealType, nextPlan, ws);
    }
  }, [commitPlan, persistSlot, persistRemove, weekStart]);

  const plannedCount = useMemo(() => {
    let count = 0;
    Object.values(weeklyPlan).forEach((daySlots) => {
      if (!daySlots) return;
      Object.values(daySlots).forEach((slot) => { if (slot) count++; });
    });
    return count;
  }, [weeklyPlan]);

  const refreshPlan = useCallback(async (ws = weekStart) => {
    if (isAuthenticated) {
      const { planId, plan } = await planService.getCurrentPlan(ws);
      planIdRef.current = planId;
      commitPlan(plan);
    } else {
      const local = loadLocalPlan(ws);
      commitPlan(local);
    }
  }, [isAuthenticated, weekStart, commitPlan]);

  const getShareToken = useCallback(async () => {
    if (!isAuthenticated) throw new Error("Belum login.");
    if (!planIdRef.current) {
      const { planId } = await planService.getCurrentPlan(weekStart);
      planIdRef.current = planId;
    }
    return await planService.getOrCreateShareToken(planIdRef.current);
  }, [isAuthenticated, weekStart]);

  const value = useMemo(() => ({
    toast,
    showToast,
    isInPlan,
    weeklyPlan,
    prepTasks,
    loading,
    setSlot,
    applySlots,
    removeSlot,
    toggleCookedStatus,
    addPrepTask,
    togglePrepTask,
    deletePrepTask,
    restoreSlot,
    clearAllSlots,
    plannedCount,
    weekStart,
    isCurrentWeek,
    goToWeek,
    goToCurrentWeek,
    getShareToken,
    refreshPlan,
  }), [toast, showToast, isInPlan, weeklyPlan, prepTasks, loading, setSlot, applySlots, removeSlot, toggleCookedStatus, addPrepTask, togglePrepTask, deletePrepTask, restoreSlot, clearAllSlots, plannedCount, weekStart, isCurrentWeek, goToWeek, goToCurrentWeek, getShareToken, refreshPlan]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
