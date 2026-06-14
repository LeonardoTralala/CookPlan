// Mapper hasil generate AI → slot Rencana Masak Mingguan (planner).
// Output AI: plan.days[].day bisa "Senin"/"Selasa"/... atau "Hari 1"/"Hari 2"/...
// Planner: key hari Indonesia (Senin..Minggu) × meal_type (breakfast/lunch/dinner).
// Konstanta sengaja didefinisikan lokal agar util ini pure (tidak menarik supabase).

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

// Index hari ini dalam DAYS (Senin=0 .. Minggu=6).
function todayIndex(date) {
  return (date.getDay() + 6) % 7;
}

// Tentukan nama hari planner dari label hari AI (dipakai untuk plan 7 hari penuh).
// Prioritas: 1) mengandung nama hari Indonesia, 2) mengandung angka
// ("Hari 3" → Rabu), 3) fallback urutan index entri.
function resolveDayName(raw, idx) {
  const text = String(raw ?? "").toLowerCase();
  const named = DAYS.find((d) => text.includes(d.toLowerCase()));
  if (named) return named;
  const num = text.match(/(\d+)/);
  if (num) {
    const i = Number(num[1]) - 1;
    if (i >= 0 && i < DAYS.length) return DAYS[i];
  }
  return DAYS[idx];
}

// Ubah plan hasil AI menjadi daftar slot siap masuk planner.
// recipeIndex: Map<recipe_id, recipe> (shape camelCase dari recipeService).
// Return { slots: [{ recipe, day, mealType, servings }], skippedDays, skippedMeals }.
//
// Aturan penempatan hari:
// - Plan < 7 hari: mulai dari HARI INI (generate 3 hari di hari Jumat → Jumat,
//   Sabtu, Minggu), label hari dari AI diabaikan karena AI tidak tahu tanggal.
// - Plan ≥ 7 hari: satu minggu penuh — pakai nama hari dari AI bila ada,
//   fallback urutan dari Senin. Entri ke-8 dst tidak muat di planner mingguan
//   dan dilewati (dihitung di skippedDays).
export function mapGeneratedPlanToWeek(plan, recipeIndex, today = new Date()) {
  const slots = [];
  let skippedDays = 0;
  let skippedMeals = 0;

  const days = plan?.days ?? [];
  const useTodayOffset = days.length > 0 && days.length < DAYS.length;
  const startIdx = todayIndex(today);
  // Hari planner yang sudah terisi — cegah dua entri AI jatuh ke hari yang sama.
  const usedDays = new Set();

  days.forEach((dayEntry, idx) => {
    if (idx >= DAYS.length) {
      skippedDays += 1;
      return;
    }
    let day = useTodayOffset
      ? DAYS[(startIdx + idx) % DAYS.length]
      : resolveDayName(dayEntry.day, idx);
    // resolveDayName bisa memetakan dua label AI ke hari yang sama; alihkan ke
    // hari kosong berikutnya supaya menu hari itu tidak hilang tertimpa dedup.
    if (usedDays.has(day)) {
      const free = DAYS.find((d) => !usedDays.has(d));
      if (!free) {
        skippedDays += 1;
        return;
      }
      day = free;
    }
    usedDays.add(day);
    for (const meal of dayEntry.meals ?? []) {
      const recipe = recipeIndex.get(meal.recipe_id);
      if (!recipe || !MEAL_TYPES.includes(meal.meal_type)) {
        skippedMeals += 1;
        continue;
      }
      const servings = Number(meal.servings);
      slots.push({
        recipe,
        day,
        mealType: meal.meal_type,
        servings: Number.isFinite(servings) && servings >= 1 ? Math.min(Math.round(servings), 20) : 2,
      });
    }
  });

  return { slots, skippedDays, skippedMeals };
}
