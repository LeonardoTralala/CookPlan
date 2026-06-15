// Edge Function: regenerate-day
// Susun ulang menu SATU hari dari sebuah plan yang sudah di-generate, dengan
// catatan preferensi opsional dari user ("pengen ayam", "ga srek", dll).
//
// Flow: auth → rate limit → ambil generated_plans (milik user) → validasi target
//       → retrieve resep (diet-filtered) → provider → AI → parse 1 hari → validasi
//       → enforce variety → ganti days[dayIndex] → RECOMPUTE shopping_list
//       (deterministik dari recipe_ingredients) → update output_json → log → return.
//
// Catatan biaya: shopping_list & total dihitung server-side (bukan dari AI), supaya
// daftar belanja seluruh plan selalu konsisten dengan menu terbaru.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  REGENERATE_DAY_SYSTEM_PROMPT,
  buildRegenerateDayMessage,
  sanitizeNote,
} from "../_shared/prompt.ts";
import { callProvider, safeJsonExtract, estimateCost } from "../_shared/aiAdapter.ts";
import type { AIProvider } from "../_shared/aiAdapter.ts";
import { enforceVariety } from "../_shared/validate.ts";
import { buildShoppingList, type RecipeWithIngredients } from "../_shared/shoppingList.ts";

const RATE_LIMIT_PER_DAY = 20; // berbagi kuota dengan generate-plan
const NOTE_MAX = 200;
const VALID_MEALS = ["breakfast", "lunch", "dinner"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface PlanMeal {
  meal_type?: string;
  recipe_id?: number;
  servings?: number;
  notes?: string;
}
interface PlanDay {
  day?: string;
  meals?: PlanMeal[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Auth
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Tidak terautentikasi." }, 401);
  const userId = userData.user.id;

  // 2. Rate limit (window UTC, berbagi kuota dengan generate-plan)
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: usageCount } = await admin
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());
  if ((usageCount ?? 0) >= RATE_LIMIT_PER_DAY) {
    return json({ error: `Batas ${RATE_LIMIT_PER_DAY} generate per hari tercapai. Coba lagi besok.` }, 429);
  }

  // 3. Parse & validasi body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body invalid." }, 400);
  }
  const planId = Number(body.planId);
  const dayIndex = Number(body.dayIndex);
  const note = sanitizeNote(body.note, NOTE_MAX);
  // mealType opsional: bila diisi, hanya slot waktu makan itu yang diganti
  // (fondasi fitur regenerate per-waktu-makan; default null = ganti seluruh hari).
  const mealType = body.mealType != null ? String(body.mealType) : null;
  if (!Number.isInteger(planId) || planId <= 0) {
    return json({ error: "planId tidak valid." }, 400);
  }
  if (!Number.isInteger(dayIndex) || dayIndex < 0) {
    return json({ error: "dayIndex tidak valid." }, 400);
  }
  if (mealType != null && !VALID_MEALS.includes(mealType)) {
    return json({ error: "mealType tidak valid." }, 400);
  }

  // 4. Ambil plan milik user (defense in depth: filter user_id + RLS service bypass)
  const { data: planRow, error: planErr } = await admin
    .from("generated_plans")
    .select("id, input_json, output_json, output_type, status, model, provider_id")
    .eq("id", planId)
    .eq("user_id", userId)
    .maybeSingle();
  if (planErr) return json({ error: "Gagal memuat plan." }, 500);
  if (!planRow || !planRow.output_json) return json({ error: "Plan tidak ditemukan." }, 404);

  const input = (planRow.input_json ?? {}) as Record<string, unknown>;
  const output = planRow.output_json as Record<string, unknown>;
  const days = (Array.isArray(output.days) ? output.days : []) as PlanDay[];
  if (dayIndex >= days.length) {
    return json({ error: "Hari yang diminta di luar rentang plan." }, 400);
  }
  const targetDay = days[dayIndex];
  const dayLabel = String(targetDay?.day ?? `Hari ${dayIndex + 1}`);

  // 5. Retrieve recipe bank (diet-filtered seperti generate-plan, pakai recipes.diet)
  const RECIPE_COLS =
    "id, title, calories, price_idr, ready_in_minutes, difficulty, cuisine, tags, badges, ingredients_text, base_servings";
  const diet = Array.isArray(input.diet) ? (input.diet as string[]) : [];
  let recipeQuery = admin.from("recipes").select(RECIPE_COLS).eq("is_active", true).limit(40);
  if (diet.length > 0) recipeQuery = recipeQuery.overlaps("diet", diet);
  let { data: candidates } = await recipeQuery;
  if (!candidates || candidates.length < 3) {
    const { data: allActive } = await admin
      .from("recipes").select(RECIPE_COLS).eq("is_active", true).limit(40);
    candidates = allActive ?? [];
  }
  if (candidates.length === 0) {
    return json({ error: "Bank resep kosong. Tambahkan resep dulu." }, 422);
  }
  const validIds = new Set(candidates.map((r) => r.id as number));

  // recipe_id yang dipakai di hari LAIN (dorong variasi) + menu hari ini sekarang
  const usedRecipeIds = new Set<number>();
  days.forEach((d, i) => {
    if (i === dayIndex) return;
    for (const m of d.meals ?? []) if (m.recipe_id != null) usedRecipeIds.add(Number(m.recipe_id));
  });
  const currentMeals = (targetDay?.meals ?? []).map((m) => ({
    meal_type: m.meal_type, recipe_id: m.recipe_id,
  }));

  // 6. Provider selection (mode chain priority, fallback ke is_active/is_fallback)
  const { data: providers } = await admin
    .from("ai_providers").select("*")
    .or("is_active.eq.true,is_fallback.eq.true,priority.not.is.null");
  const chainProviders = (providers ?? [])
    .filter((p) => p.priority != null)
    .sort((a, b) => (a.priority as number) - (b.priority as number)) as AIProvider[];
  let tryProviders: AIProvider[];
  if (chainProviders.length > 0) {
    tryProviders = chainProviders;
  } else {
    const primary = providers?.find((p) => p.is_active) as AIProvider | undefined;
    const fallback = providers?.find((p) => p.is_fallback) as AIProvider | undefined;
    tryProviders = [primary, fallback].filter(Boolean) as AIProvider[];
  }
  if (tryProviders.length === 0) {
    return json({ error: "Belum ada AI provider aktif. Atur di Admin." }, 503);
  }

  // 7. Build messages
  const messages = [
    { role: "system", content: REGENERATE_DAY_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildRegenerateDayMessage(input, candidates, {
        dayLabel,
        currentMeals,
        usedRecipeIds: [...usedRecipeIds],
        note,
      }),
    },
  ];

  // 8. Call AI (failover)
  let aiResult = null;
  let usedProvider: AIProvider | null = null;
  let lastError = "";
  for (const prov of tryProviders) {
    try {
      aiResult = await callProvider(prov, messages);
      usedProvider = prov;
      break;
    } catch (e) {
      lastError = (e as Error).message;
    }
  }

  // Selalu log usage (sukses/gagal) supaya regenerate tetap kena rate limit.
  const logUsage = (extra: Record<string, unknown> = {}) =>
    admin.from("ai_usage_log").insert({
      user_id: userId, endpoint: "regenerate-day", cache_hit: false,
      provider_id: usedProvider?.id ?? tryProviders[0]?.id ?? null,
      model: usedProvider?.model ?? tryProviders[0]?.model ?? null,
      ...extra,
    });

  if (!aiResult || !usedProvider) {
    await logUsage();
    return json({ error: `Semua provider AI gagal: ${lastError}` }, 502);
  }

  // 9. Parse + ambil objek hari
  let parsed = safeJsonExtract(aiResult.content) as Record<string, unknown> | null;
  if (!parsed) {
    const retryMessages = [
      ...messages,
      { role: "assistant", content: aiResult.content.slice(0, 2000) },
      { role: "user", content: "Output sebelumnya bukan JSON valid. Kirim ULANG sebagai JSON objek { \"day\": {...} } sesuai schema, TANPA teks lain." },
    ];
    try {
      const retry = await callProvider(usedProvider, retryMessages);
      aiResult = { ...retry, latencyMs: aiResult.latencyMs + retry.latencyMs };
      parsed = safeJsonExtract(retry.content) as Record<string, unknown> | null;
    } catch { /* tetap null */ }
  }

  // Ambil objek hari dari output AI. Tangani dua bentuk:
  //   a. terbungkus: { "day": { day, meals } }  (sesuai schema)
  //   b. flat:       { day: "Senin", meals: [...] }
  // Hati-hati: pada bentuk (b), parsed.day adalah STRING, jadi tidak boleh
  // dijadikan newDay. Deteksi via keberadaan array `meals`.
  let newDay: PlanDay | null = null;
  if (parsed && Array.isArray((parsed as PlanDay).meals)) {
    newDay = parsed as PlanDay;
  } else if (parsed && parsed.day && typeof parsed.day === "object") {
    newDay = parsed.day as PlanDay;
  }
  const tokensIn = aiResult.tokensInput;
  const tokensOut = aiResult.tokensOutput;

  if (!newDay || !Array.isArray(newDay.meals) || newDay.meals.length === 0) {
    await logUsage({ tokens_input: tokensIn, tokens_output: tokensOut });
    return json({ error: "AI menghasilkan output tidak valid. Coba lagi." }, 502);
  }

  // 10. Validasi recipe_id hari baru harus ada di bank resep
  const badId = newDay.meals.find((m) => !validIds.has(Number(m.recipe_id)));
  if (badId) {
    await logUsage({ tokens_input: tokensIn, tokens_output: tokensOut });
    return json({ error: `Output AI tidak lolos validasi: recipe_id ${badId.recipe_id} tidak ada di bank resep.` }, 502);
  }

  // 11. Enforce variety + isi 3 slot (reuse logika tested; bungkus 1 hari).
  const porsi = Number(input.porsi) || 2;
  const variasiPerHari = Number(input.variasiPerHari) || 3;
  const enforced = enforceVariety({ days: [{ ...newDay, day: dayLabel }] }, variasiPerHari, porsi);
  let rebuiltDay = (enforced.days as PlanDay[])[0];

  // mealType opsional: hanya ganti slot itu, slot lain pertahankan menu lama.
  if (mealType != null) {
    const replacement = rebuiltDay.meals?.find((m) => m.meal_type === mealType);
    const mergedMeals = VALID_MEALS.map((mt) => {
      if (mt === mealType && replacement) return { ...replacement, meal_type: mt, servings: porsi };
      const old = (targetDay?.meals ?? []).find((m) => m.meal_type === mt);
      return old ?? rebuiltDay.meals?.find((m) => m.meal_type === mt);
    }).filter(Boolean) as PlanMeal[];
    rebuiltDay = { ...targetDay, day: dayLabel, meals: mergedMeals };
  }

  // 12. Ganti hari di plan
  const newDays = days.map((d, i) => (i === dayIndex ? rebuiltDay : d));

  // 13. Recompute shopping_list deterministik dari recipe_ingredients utk SELURUH plan.
  const allRecipeIds = new Set<number>();
  for (const d of newDays) for (const m of d.meals ?? []) if (m.recipe_id != null) allRecipeIds.add(Number(m.recipe_id));
  let shoppingPatch: { shopping_list: unknown[]; total_estimated_cost: number } | null = null;
  if (allRecipeIds.size > 0 && Array.isArray(output.shopping_list)) {
    const { data: recRows } = await admin
      .from("recipes")
      .select("id, base_servings, ingredients:recipe_ingredients(name, amount, unit, category, price_idr)")
      .in("id", [...allRecipeIds]);
    const recipesById = new Map<number, RecipeWithIngredients>(
      (recRows ?? []).map((r) => [r.id as number, r as unknown as RecipeWithIngredients]),
    );
    const pantry = Array.isArray(input.pantry) ? input.pantry : [];
    shoppingPatch = buildShoppingList(newDays, recipesById, pantry as never);
  }

  // 14. Susun output baru & persist (update row yang sama)
  const newOutput: Record<string, unknown> = { ...output, days: newDays };
  if (shoppingPatch) {
    newOutput.shopping_list = shoppingPatch.shopping_list;
    newOutput.total_estimated_cost = shoppingPatch.total_estimated_cost;
  }

  const { error: updErr } = await admin
    .from("generated_plans")
    .update({ output_json: newOutput })
    .eq("id", planId)
    .eq("user_id", userId);
  if (updErr) {
    await logUsage({ tokens_input: tokensIn, tokens_output: tokensOut });
    return json({ error: "Gagal menyimpan hasil regenerate." }, 500);
  }

  // 15. Log usage sukses
  const cost = estimateCost(tokensIn, tokensOut);
  await logUsage({ tokens_input: tokensIn, tokens_output: tokensOut, cost_usd: cost });

  return json({
    plan: newOutput,
    dayIndex,
    day: rebuiltDay,
    meta: {
      model: usedProvider.model,
      provider: usedProvider.label,
      latency_ms: aiResult.latencyMs,
      est_cost_usd: cost,
    },
    planId,
  });
});
