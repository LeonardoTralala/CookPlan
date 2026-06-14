import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PlanContext } from "./plan-context.js";
import { useAuth } from "../hooks/useAuth.js";
import * as planService from "../services/planService.js";

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

function loadLocalPlan() {
  const saved = localStorage.getItem('weeklyPlan');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (isValidPlanShape(parsed)) return parsed;
    } catch {
      // abaikan data rusak
    }
  }
  return createEmptyPlan();
}

export function PlanProvider({ children }) {
  const { isAuthenticated } = useAuth();

  // toast pakai counter id agar dua pesan identik tetap me-reset timer (audit #16).
  const [toast, setToast] = useState({ id: 0, message: "", onUndo: null, variant: "success" });
  const [weeklyPlan, setWeeklyPlan] = useState(loadLocalPlan);

  // planId DB minggu berjalan (null saat belum login / belum dimuat).
  const planIdRef = useRef(null);
  // Antrian mutasi yang terjadi sebelum planId siap (audit #6), agar tidak hilang.
  const pendingRef = useRef([]);

  const showToast = useCallback((message, options = {}) => {
    setToast((prev) => ({
      id: prev.id + 1,
      message,
      onUndo: options.onUndo ?? null,
      variant: options.variant ?? "success",
    }));
  }, []);

  useEffect(() => {
    if (!toast.message) return undefined;
    const timer = setTimeout(
      () => setToast((prev) => ({ ...prev, message: "", onUndo: null })),
      3000
    );
    return () => clearTimeout(timer);
  }, [toast.id, toast.message]);

  // Persist helper: tulis ke DB bila login (planId siap), kalau belum siap antri,
  // kalau guest tulis localStorage. Dipanggil DI LUAR updater setState (audit #5).
  const persistSlot = useCallback((recipe, day, mealType, servings, nextPlan) => {
    if (isAuthenticated) {
      if (planIdRef.current) {
        planService.setSlot(planIdRef.current, recipe, day, mealType, servings)
          .catch((e) => console.error("setSlot gagal:", e.message));
      } else {
        pendingRef.current.push({ type: "set", recipe, day, mealType, servings });
      }
    } else {
      localStorage.setItem('weeklyPlan', JSON.stringify(nextPlan));
    }
  }, [isAuthenticated]);

  const persistRemove = useCallback((day, mealType, nextPlan) => {
    if (isAuthenticated) {
      if (planIdRef.current) {
        planService.removeSlot(planIdRef.current, day, mealType)
          .catch((e) => console.error("removeSlot gagal:", e.message));
      } else {
        pendingRef.current.push({ type: "remove", day, mealType });
      }
    } else {
      localStorage.setItem('weeklyPlan', JSON.stringify(nextPlan));
    }
  }, [isAuthenticated]);

  // Saat status login berubah: muat plan dari DB + flush antrian. Saat logout,
  // kembali ke localStorage.
  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      planIdRef.current = null;
      queueMicrotask(() => { if (active) setWeeklyPlan(loadLocalPlan()); });
      return () => { active = false; };
    }

    (async () => {
      try {
        const { planId, plan } = await planService.getCurrentPlan();
        if (!active) return;
        planIdRef.current = planId;

        // Flush mutasi yang sempat tertunda sebelum planId siap.
        const pending = pendingRef.current;
        pendingRef.current = [];
        for (const m of pending) {
          try {
            if (m.type === "set") await planService.setSlot(planId, m.recipe, m.day, m.mealType, m.servings);
            else await planService.removeSlot(planId, m.day, m.mealType);
          } catch (e) { console.error("flush pending gagal:", e.message); }
        }

        // Migrasi sekali: kalau DB kosong tapi ada data localStorage, dorong ke DB.
        const dbEmpty = Object.values(plan).every((d) => MEAL_TYPES.every((mm) => !d[mm]));
        const local = loadLocalPlan();
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
          if (migratedOk) localStorage.removeItem('weeklyPlan');
          const refreshed = await planService.getCurrentPlan();
          if (active) setWeeklyPlan(refreshed.plan);
        } else {
          // Bila ada pending yang baru di-flush, reload agar konsisten.
          if (pending.length > 0) {
            const refreshed = await planService.getCurrentPlan();
            if (active) setWeeklyPlan(refreshed.plan);
          } else {
            setWeeklyPlan(plan);
          }
        }
      } catch (e) {
        console.error("muat plan gagal:", e.message);
        if (active) setWeeklyPlan(loadLocalPlan());
      }
    })();

    return () => { active = false; };
  }, [isAuthenticated]);

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

  // setSlot: hitung next state, set, lalu persist DI LUAR updater (audit #5).
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
    let nextPlan;
    setWeeklyPlan((prev) => {
      nextPlan = { ...prev, [day]: { ...prev[day], [mealType]: slotData } };
      return nextPlan;
    });
    persistSlot(recipe, day, mealType, servings, nextPlan);
  }, [persistSlot]);

  // applySlots: terapkan banyak slot sekaligus (hasil generate AI → planner).
  // Satu setState + satu bulk upsert, bukan loop setSlot per slot.
  // Return daftar undo [{ day, mealType, prev }] berisi isi slot SEBELUM
  // tertimpa, untuk tombol "Urungkan" di toast (pakai restoreSlot per item).
  const applySlots = useCallback((slotList) => {
    const deduped = new Map();
    for (const s of slotList ?? []) deduped.set(`${s.day}|${s.mealType}`, s);
    if (deduped.size === 0) return [];

    // Mengandalkan eager evaluation updater React saat queue kosong — pola yang
    // sama dengan nextPlan di setSlot/removeSlot di atas.
    let nextPlan;
    const undoList = [];
    setWeeklyPlan((prev) => {
      nextPlan = { ...prev };
      for (const { day, mealType } of deduped.values()) {
        undoList.push({ day, mealType, prev: prev[day]?.[mealType] ?? null });
      }
      for (const { recipe, day, mealType, servings } of deduped.values()) {
        nextPlan[day] = {
          ...nextPlan[day],
          [mealType]: {
            recipeId: recipe.id,
            title: recipe.title,
            servings,
            imageUrl: recipe.imageUrl,
            priceIdr: recipe.priceIdr,
            readyInMinutes: recipe.readyInMinutes,
            calories: recipe.calories,
          },
        };
      }
      return nextPlan;
    });

    if (isAuthenticated) {
      if (planIdRef.current) {
        planService.setSlots(planIdRef.current, [...deduped.values()])
          .catch((e) => console.error("setSlots gagal:", e.message));
      } else {
        for (const s of deduped.values()) {
          pendingRef.current.push({ type: "set", recipe: s.recipe, day: s.day, mealType: s.mealType, servings: s.servings });
        }
      }
    } else {
      localStorage.setItem('weeklyPlan', JSON.stringify(nextPlan));
    }

    return undoList;
  }, [isAuthenticated]);

  const removeSlot = useCallback((day, mealType) => {
    let nextPlan;
    setWeeklyPlan((prev) => {
      nextPlan = { ...prev, [day]: { ...prev[day], [mealType]: null } };
      return nextPlan;
    });
    persistRemove(day, mealType, nextPlan);
  }, [persistRemove]);

  const restoreSlot = useCallback((day, mealType, slotData) => {
    let nextPlan;
    setWeeklyPlan((prev) => {
      nextPlan = { ...prev, [day]: { ...prev[day], [mealType]: slotData } };
      return nextPlan;
    });
    if (slotData?.recipeId != null) {
      persistSlot({ id: slotData.recipeId, ...slotData }, day, mealType, slotData.servings ?? 2, nextPlan);
    } else {
      persistRemove(day, mealType, nextPlan);
    }
  }, [persistSlot, persistRemove]);

  const plannedCount = useMemo(() => {
    let count = 0;
    Object.values(weeklyPlan).forEach((daySlots) => {
      if (!daySlots) return;
      Object.values(daySlots).forEach((slot) => { if (slot) count++; });
    });
    return count;
  }, [weeklyPlan]);

  const value = useMemo(() => ({
    toast,
    showToast,
    isInPlan,
    weeklyPlan,
    setSlot,
    applySlots,
    removeSlot,
    restoreSlot,
    plannedCount,
  }), [toast, showToast, isInPlan, weeklyPlan, setSlot, applySlots, removeSlot, restoreSlot, plannedCount]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
