// Validasi input & output AI, plus post-processing pantry subtraction.

export interface GenerateInput {
  periode: number;        // 3 | 7 | 14
  porsi: number;          // >=1 — porsi per JAM MAKAN (servings per slot)
  diet: string[];
  budget: number;         // IDR
  pantry: { name: string; amount?: number; unit?: string }[];
  outputType: "foodplan" | "foodprep" | "full";
  variasiPerHari: number; // 1..3 — jumlah resep BERBEDA per hari (foodprep)
  notes: string;          // catatan khusus user (opsional, preferensi tambahan), max 300
}

const NOTES_MAX = 300;

// Periode bebas 1..7 hari (maksimal selaras kapasitas planner mingguan).
const PERIODE_MIN = 1;
const PERIODE_MAX = 7;
const VALID_OUTPUT = ["foodplan", "foodprep", "full"];
// Urutan kanonik waktu makan — setiap hari TETAP 3 slot ini. variasiPerHari
// hanya mengatur berapa resep BERBEDA yang mengisinya (sisanya pakai ulang).
const VALID_MEALS = ["breakfast", "lunch", "dinner"];
const VARIASI_MIN = 1;
const VARIASI_MAX = 3; // tidak mungkin > jumlah waktu makan

// Validasi & normalisasi input dari klien. Throw Error dengan pesan ramah.
export function validateInput(raw: unknown): GenerateInput {
  if (!raw || typeof raw !== "object") throw new Error("Input tidak valid.");
  const r = raw as Record<string, unknown>;

  const periode = Math.floor(Number(r.periode));
  if (!Number.isFinite(periode) || periode < PERIODE_MIN || periode > PERIODE_MAX) {
    throw new Error(`Periode harus antara ${PERIODE_MIN} dan ${PERIODE_MAX} hari.`);
  }

  const porsi = Number(r.porsi);
  if (!Number.isFinite(porsi) || porsi < 1 || porsi > 20) {
    throw new Error("Jumlah porsi harus antara 1 dan 20.");
  }

  const budget = Number(r.budget);
  if (!Number.isFinite(budget) || budget < 0) {
    throw new Error("Budget tidak valid.");
  }

  const outputType = String(r.outputType ?? "foodplan");
  if (!VALID_OUTPUT.includes(outputType)) {
    throw new Error("Jenis output tidak valid.");
  }

  const diet = Array.isArray(r.diet)
    ? r.diet.map((d) => String(d).toLowerCase().trim()).filter(Boolean).slice(0, 10)
    : [];

  const pantryRaw = Array.isArray(r.pantry) ? r.pantry : [];
  const pantry = pantryRaw.slice(0, 50).map((p) => {
    const item = p as Record<string, unknown>;
    return {
      name: String(item.name ?? "").trim().slice(0, 80),
      amount: item.amount != null ? Number(item.amount) : undefined,
      unit: item.unit != null ? String(item.unit).trim().slice(0, 20) : undefined,
    };
  }).filter((p) => p.name);

  // Jumlah variasi menu per hari (resep berbeda). Clamp 1..3. Klien lama yang
  // masih kirim `meals` (subset waktu makan) → turunkan jadi jumlah waktu makan
  // yang dipilih supaya tetap masuk akal (mis. pilih 1 slot lama ≈ 1 variasi).
  let variasiRaw = Number(r.variasiPerHari);
  if (!Number.isFinite(variasiRaw) && Array.isArray(r.meals)) {
    const legacy = new Set(
      r.meals.map((m) => String(m).toLowerCase().trim()).filter((m) => VALID_MEALS.includes(m)),
    );
    variasiRaw = legacy.size || VARIASI_MAX;
  }
  if (!Number.isFinite(variasiRaw)) variasiRaw = VARIASI_MAX;
  const variasiPerHari = Math.min(VARIASI_MAX, Math.max(VARIASI_MIN, Math.floor(variasiRaw)));

  // Catatan khusus opsional. Trim + cap panjang (hemat token + batasi abuse).
  const notes = String(r.notes ?? "").trim().slice(0, NOTES_MAX);

  return { periode, porsi, diet, budget, pantry, variasiPerHari, notes, outputType: outputType as GenerateInput["outputType"] };
}

// Validasi output AI secara semantik. Return { ok, errors }.
export function validateOutput(
  output: unknown,
  validRecipeIds: Set<number>,
  input: GenerateInput,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!output || typeof output !== "object") {
    return { ok: false, errors: ["Output bukan objek."] };
  }
  const o = output as Record<string, unknown>;

  if (!Array.isArray(o.days) || o.days.length === 0) {
    errors.push("Field 'days' kosong atau bukan array.");
  } else {
    for (const day of o.days as Record<string, unknown>[]) {
      const meals = day.meals;
      if (!Array.isArray(meals)) { errors.push("Sebuah hari tidak punya 'meals'."); continue; }
      for (const m of meals as Record<string, unknown>[]) {
        const rid = Number(m.recipe_id);
        if (!validRecipeIds.has(rid)) {
          errors.push(`recipe_id ${m.recipe_id} tidak ada di bank resep.`);
        }
      }
    }
  }

  if (!Array.isArray(o.shopping_list)) {
    errors.push("Field 'shopping_list' bukan array.");
  }

  // Budget check (toleransi 10%)
  const total = Number(o.total_estimated_cost ?? 0);
  if (input.budget > 0 && total > input.budget * 1.1) {
    // bukan hard error — hanya warning, AI seharusnya sudah kasih warnings
  }

  return { ok: errors.length === 0, errors };
}

// Tegakkan model "variasi per hari" sebagai safety net (prompt sudah menginstruksikan,
// tapi jangan percaya penuh ke AI — sama filosofinya dgn subtractPantry). Untuk SETIAP hari:
//   1. Pastikan ketiga waktu makan (breakfast/lunch/dinner) terisi — slot yang bolong
//      diisi ulang dari resep hari itu (foodprep: masak sekali, makan beberapa kali).
//   2. Batasi jumlah resep BERBEDA per hari = variasiPerHari; kelebihan dipetakan ulang
//      ke salah satu resep yang dipertahankan (palette).
//   3. Set servings tiap slot = porsi (porsi per jam makan) → total = 3 × porsi/hari.
// Hari tanpa satu pun meal valid dibiarkan apa adanya (tak bisa mengarang resep).
// Tidak menyentuh shopping_list/total: harga dihitung per resep & resep dipakai ulang;
// pengurangan biaya diserahkan ke subtractPantry (sama seperti sebelumnya).
export function enforceVariety(
  output: Record<string, unknown>,
  variasiPerHari: number,
  porsi: number,
) {
  if (!Array.isArray(output.days)) return output;
  const variasi = Math.min(VARIASI_MAX, Math.max(VARIASI_MIN, Math.floor(variasiPerHari) || 1));
  const days = (output.days as Record<string, unknown>[]).map((day) => {
    const meals = Array.isArray(day.meals) ? (day.meals as Record<string, unknown>[]) : [];
    if (meals.length === 0) return day;

    // Resep berbeda sesuai urutan kemunculan → palette dipotong ke `variasi`.
    const distinct: Record<string, unknown>[] = [];
    for (const m of meals) {
      const rid = Number(m.recipe_id);
      if (!distinct.some((d) => Number(d.recipe_id) === rid)) distinct.push(m);
    }
    const palette = distinct.slice(0, variasi);
    const allowedIds = new Set(palette.map((p) => Number(p.recipe_id)));

    // Bangun 3 slot kanonik. Slot yang sudah ada & resepnya ada di palette dipertahankan;
    // sisanya diisi resep palette secara bergiliran.
    const newMeals = VALID_MEALS.map((mealType, i) => {
      const existing = meals.find(
        (m) => m.meal_type === mealType && allowedIds.has(Number(m.recipe_id)),
      );
      const base = existing ?? palette[i % palette.length];
      return { ...base, meal_type: mealType, servings: porsi };
    });
    return { ...day, meals: newMeals };
  });
  return { ...output, days };
}

// Kurangi pantry user dari shopping list. Pencocokan nama longgar (case-insensitive,
// substring). Untuk bahan dengan amount, kurangi; kalau habis, buang dari list.
export function subtractPantry(output: Record<string, unknown>, pantry: GenerateInput["pantry"]) {
  if (!Array.isArray(output.shopping_list) || pantry.length === 0) return output;

  // Pencocokan berbasis kata (token), bukan substring mentah. Mencegah false
  // positive seperti pantry "ayam" menghapus item "bayam" (audit M2).
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/[^a-z0-9]+/i).filter((t) => t.length >= 3));

  const pantryEntries = pantry
    .map((p) => ({ tokens: tokenize(p.name), amount: p.amount, name: p.name.toLowerCase().trim() }))
    .filter((p) => p.name.length > 0);

  const list = output.shopping_list as Record<string, unknown>[];
  const filtered: Record<string, unknown>[] = [];

  for (const item of list) {
    const rawName = String(item.ingredient ?? "").trim();
    if (!rawName) { filtered.push(item); continue; }
    const itemTokens = tokenize(rawName);
    let matchedAmount: number | undefined;
    let matched = false;

    for (const p of pantryEntries) {
      // Cocok bila ada token yang sama persis di kedua sisi, atau nama sama persis.
      const shared = [...p.tokens].some((t) => itemTokens.has(t));
      if (shared || p.name === rawName.toLowerCase()) {
        matched = true;
        matchedAmount = p.amount;
        break;
      }
    }

    if (!matched) {
      filtered.push(item);
      continue;
    }

    // Punya jumlah pantry → kurangi. Tanpa jumlah → anggap cukup, buang item.
    if (matchedAmount == null) {
      // skip item (sudah punya di rumah)
      continue;
    }
    const need = Number(item.total_amount ?? 0);
    const remaining = need - matchedAmount;
    if (remaining > 0) {
      // Skala harga proporsional terhadap sisa kebutuhan supaya
      // total_estimated_cost setelah recompute mencerminkan jumlah yang
      // benar-benar perlu dibeli (audit Copilot: jangan biarin harga penuh
      // padahal jumlah sudah dikurangi).
      const price = Number(item.estimated_price_idr ?? 0);
      const newPrice = need > 0 ? price * (remaining / need) : price;
      filtered.push({
        ...item,
        total_amount: remaining,
        estimated_price_idr: Math.round(newPrice),
        _note: "dikurangi stok rumah",
      });
    }
    // kalau <= 0, buang (sudah tercukupi)
  }

  // Recompute total dari sisa item
  const newTotal = filtered.reduce((sum, it) => sum + Number(it.estimated_price_idr ?? 0), 0);
  return { ...output, shopping_list: filtered, total_estimated_cost: newTotal };
}
