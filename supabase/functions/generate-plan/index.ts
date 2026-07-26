// Edge Function: generate-plan
// Proxy AI provider-agnostic untuk generate foodplan/foodprep.
// Flow: auth → rate limit → validate → cache → retrieve resep → prompt → AI
//       → parse → validate → pantry subtract → persist → return.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { SYSTEM_PROMPT, PROMPT_VERSION, buildUserMessage } from "../_shared/prompt.ts";
import { callProvider, safeJsonExtract, estimateCost } from "../_shared/aiAdapter.ts";
import type { AIProvider } from "../_shared/aiAdapter.ts";
import { validateInput, validateOutput, enforceVariety } from "../_shared/validate.ts";
import { filterRecipesByDiet } from "../_shared/dietFilter.ts";
import { buildShoppingList } from "../_shared/shoppingList.ts";
import type { RecipeWithIngredients } from "../_shared/shoppingList.ts";

const RATE_LIMIT_PER_DAY = 20; // generate per user per hari
const GUEST_LIMIT = 2;         // total percobaan untuk tamu (anonymous), bukan per hari

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

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Client untuk verifikasi user (pakai JWT dari header).
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  // Client service_role untuk baca ai_providers (lockdown) & tulis log.
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Auth
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Tidak terautentikasi." }, 401);
  const userId = userData.user.id;
  const isAnon = userData.user.is_anonymous === true;

  // 2. Rate limit.
  //    - User penuh: batas per hari (window UTC-based, konsisten dengan
  //      getTodayUsageCount di klien).
  //    - Tamu (anonymous): batas TOTAL seumur sesi (tanpa filter hari), supaya
  //      "2 percobaan gratis" benar-benar 2x lalu harus daftar.
  let usageQuery = admin
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (!isAnon) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    usageQuery = usageQuery.gte("created_at", startOfDay.toISOString());
  }
  const { count: usageCount } = await usageQuery;
  const limit = isAnon ? GUEST_LIMIT : RATE_LIMIT_PER_DAY;
  if ((usageCount ?? 0) >= limit) {
    if (isAnon) {
      return json({
        error: `Batas ${GUEST_LIMIT} percobaan gratis tercapai. Daftar gratis untuk lanjut.`,
        limitReached: true,
        guest: true,
      }, 429);
    }
    return json({ error: `Batas ${RATE_LIMIT_PER_DAY} generate per hari tercapai. Coba lagi besok.` }, 429);
  }

  // 3. Validate input
  let input;
  try {
    input = validateInput(await req.json());
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  // 4. Cache check — PROMPT_VERSION ikut di-hash supaya perubahan prompt
  //    otomatis membatalkan cache lama. TTL PENDEK (90 detik): cache cuma untuk
  //    melindungi double-submit/refresh cepat. Generate ulang dgn input sama
  //    SETELAH 90 detik = sengaja minta variasi baru → jangan kembalikan cache
  //    (akar masalah "menu itu-itu aja"). Variasi dijamin shuffle bank resep + model.
  const CACHE_TTL_MS = 90_000;
  const inputHash = await sha256(`${PROMPT_VERSION}:${JSON.stringify(input)}`);
  const cacheSince = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  const { data: cached } = await admin
    .from("generated_plans")
    .select("id, output_json, reasoning_content, model")
    .eq("user_id", userId)
    .eq("input_hash", inputHash)
    .eq("status", "success")
    .gte("created_at", cacheSince)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.output_json) {
    await admin.from("ai_usage_log").insert({
      user_id: userId, endpoint: "generate-plan", cache_hit: true, model: cached.model,
    });
    return json({
      plan: cached.output_json,
      reasoning: cached.reasoning_content,
      meta: { cached: true, model: cached.model },
      planId: cached.id,
    });
  }

  // 5. Retrieve recipe context (filter berdasarkan preferensi via recipes.tags).
  //    Ambil SEMUA yang cocok (bukan 40 pertama), lalu ACAK & potong ke 40.
  //    Kalau cuma 40 pertama yang dikirim, AI selalu lihat resep yang sama →
  //    hasil "itu-itu aja". Shuffle bikin tiap generate beda kombinasi resep.
  //    Catatan: filter dilakukan pada kolom `tags` (sumber kebenaran yang sama
  //    dengan chip katalog & diet_tags.value). Kolom `diet` lama deprecated.
  const RECIPE_COLS =
    "id, title, calories, price_idr, ready_in_minutes, difficulty, cuisine, tags, badges, ingredients_text, base_servings";
  const RECIPE_CAP = 42;

  //    Filter preferensi dilakukan di memori (pool aktif kecil, ~ratusan resep)
  //    memakai filterRecipesByDiet — semantik UNION/OR antar chip, sama persis
  //    dengan filter katalog. Ini menangani slug yang BUKAN tag literal
  //    ('tinggi-protein', 'cepat', 'hemat') yang tidak bisa dijaring overlaps().
  const { data: allActive } = await admin.from("recipes").select(RECIPE_COLS).eq("is_active", true);
  let pool = filterRecipesByDiet(allActive ?? [], input.diet);
  if (pool.length === 0) {
    return json({ error: "Bank resep kosong. Tambahkan resep dulu." }, 422);
  }

  // Jika user memasang budget, terapkan Stratified Sampling dengan Quota Rollover
  if (input.budget && input.budget > 0) {
    const mealCount = Array.isArray(input.meals) && input.meals.length > 0 ? input.meals.length : 3;
    const totalServingsNeeded = (input.periode || 1) * mealCount * (input.porsi || 1);
    const avgBudgetPerServing = input.budget / totalServingsNeeded;
    
    // Toleransi: resep maksimal 1.5x dari rata-rata budget per porsi
    const maxPricePerServing = avgBudgetPerServing * 1.5;

    const affordablePool = pool.filter((r) => {
      const price = r.price_idr || 0;
      const base = (r.base_servings && r.base_servings > 0) ? r.base_servings : 2;
      const pricePerServing = price / base;
      return pricePerServing <= maxPricePerServing;
    });

    // Pisahkan ke dalam 3 bucket berdasarkan kedekatan harga dengan avgBudgetPerServing
    const cheap: typeof pool = [];
    const medium: typeof pool = [];
    const premium: typeof pool = [];

    for (const r of affordablePool) {
      const price = r.price_idr || 0;
      const base = (r.base_servings && r.base_servings > 0) ? r.base_servings : 2;
      const pricePerServing = price / base;
      
      if (pricePerServing <= avgBudgetPerServing * 0.3) {
        cheap.push(r);
      } else if (pricePerServing <= avgBudgetPerServing * 0.7) {
        medium.push(r);
      } else {
        premium.push(r);
      }
    }

    // Fungsi shuffle lokal
    const shuffle = (arr: any[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    };
    shuffle(cheap);
    shuffle(medium);
    shuffle(premium);

    // Kuota: Target Total = RECIPE_CAP (42)
    // Distribusi: 10 Premium, 16 Medium, 16 Cheap (memberi variasi gizi dan kebebasan budget)
    let targetPremium = 10;
    let targetMedium = 16;
    let targetCheap = 16;
    
    const picked = [];
    
    // Ambil Premium
    const pickedPremium = premium.slice(0, targetPremium);
    picked.push(...pickedPremium);
    let deficit = targetPremium - pickedPremium.length;
    
    // Oper defisit ke Medium
    targetMedium += deficit;
    const pickedMedium = medium.slice(0, targetMedium);
    picked.push(...pickedMedium);
    deficit = targetMedium - pickedMedium.length;
    
    // Oper defisit ke Cheap
    targetCheap += deficit;
    const pickedCheap = cheap.slice(0, targetCheap);
    picked.push(...pickedCheap);
    deficit = targetCheap - pickedCheap.length; // Sisa defisit final jika total database terlalu sedikit

    pool = picked;
  } else {
    // Jika tidak ada budget, cukup shuffle semua yang ada
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool = pool.slice(0, RECIPE_CAP);
  }

  // Acak ulang gabungan hasil sampling agar AI tidak bias membaca berurutan dari yang paling premium ke murah
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const candidates = pool;
  const validIds = new Set(candidates.map((r) => r.id));

  // 6. Ambil provider untuk chain failover (service_role bypass RLS lockdown).
  //    Mode chain: kalau ada provider dgn priority NOT NULL, dicoba urut priority ASC
  //    (3 main + fallback dst). Mode legacy: pakai is_active (primary) + is_fallback.
  const { data: providers } = await admin
    .from("ai_providers")
    .select("*")
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
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(input, candidates) },
  ];

  // 8. Call AI: coba tiap provider di chain berurutan, fallback bila gagal
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

  if (!aiResult || !usedProvider) {
    // Audit H2: log percobaan gagal ke ai_usage_log supaya tetap kena rate limit
    // (mencegah abuse panggilan AI berbayar lewat input yang sengaja gagal).
    await admin.from("ai_usage_log").insert({
      user_id: userId, endpoint: "generate-plan", cache_hit: false,
      provider_id: (tryProviders[0]?.id) ?? null, model: (tryProviders[0]?.model) ?? null,
    });
    await admin.from("generated_plans").insert({
      user_id: userId, input_hash: inputHash, input_json: input,
      output_type: input.outputType, status: "failed", error_message: lastError,
    });
    return json({ error: `Semua provider AI gagal: ${lastError}` }, 502);
  }

  // 9. Parse + validate (retry 1x bila JSON rusak)
  let parsed = safeJsonExtract(aiResult.content);
  if (!parsed) {
    // retry sekali dengan pesan korektif
    const retryMessages = [
      ...messages,
      { role: "assistant", content: aiResult.content.slice(0, 2000) },
      { role: "user", content: "Output sebelumnya bukan JSON valid. Kirim ULANG sebagai JSON valid sesuai schema, TANPA teks lain." },
    ];
    try {
      const retry = await callProvider(usedProvider, retryMessages);
      aiResult = { ...retry, latencyMs: aiResult.latencyMs + retry.latencyMs };
      parsed = safeJsonExtract(retry.content);
    } catch { /* tetap null */ }
  }

  if (!parsed) {
    await admin.from("ai_usage_log").insert({
      user_id: userId, endpoint: "generate-plan", cache_hit: false,
      provider_id: usedProvider.id, model: usedProvider.model,
      tokens_input: aiResult.tokensInput, tokens_output: aiResult.tokensOutput,
    });
    await admin.from("generated_plans").insert({
      user_id: userId, input_hash: inputHash, input_json: input,
      output_type: input.outputType, status: "failed",
      error_message: "Output AI bukan JSON valid setelah retry.",
      provider_id: usedProvider.id, model: usedProvider.model,
    });
    return json({ error: "AI menghasilkan output tidak valid. Coba lagi." }, 502);
  }

  const validation = validateOutput(parsed, validIds, input);
  if (!validation.ok) {
    await admin.from("ai_usage_log").insert({
      user_id: userId, endpoint: "generate-plan", cache_hit: false,
      provider_id: usedProvider.id, model: usedProvider.model,
      tokens_input: aiResult.tokensInput, tokens_output: aiResult.tokensOutput,
    });
    // Tetap simpan untuk debug, tapi kembalikan error informatif.
    await admin.from("generated_plans").insert({
      user_id: userId, input_hash: inputHash, input_json: input,
      output_json: parsed, output_type: input.outputType, status: "failed",
      error_message: validation.errors.join("; "),
      provider_id: usedProvider.id, model: usedProvider.model,
    });
    return json({ error: "Output AI tidak lolos validasi: " + validation.errors[0] }, 502);
  }

  // 10. Post-process di server (bukan delegasi ke AI):
  //     a. tegakkan variasi/hari + isi 3 slot (foodprep)
  const variedOutput = enforceVariety(parsed as Record<string, unknown>, input.variasiPerHari, input.porsi, input.meals);

  //     b. Bangun shopping_list deterministik dari database & kurangi pantry
  const variedOutputObj = variedOutput as Record<string, any>;
  const allRecipeIds = new Set<number>();
  for (const d of (variedOutputObj.days ?? [])) {
    for (const m of (d.meals ?? [])) {
      if (m.recipe_id != null) allRecipeIds.add(Number(m.recipe_id));
    }
  }

  let shoppingPatch = { shopping_list: [] as any[], total_estimated_cost: 0 };
  if (allRecipeIds.size > 0) {
    const { data: recRows } = await admin
      .from("recipes")
      .select("id, base_servings, ingredients:recipe_ingredients(name, amount, unit, category, price_idr)")
      .in("id", [...allRecipeIds]);
    const recipesById = new Map<number, RecipeWithIngredients>(
      (recRows ?? []).map((r) => [r.id as number, r as unknown as RecipeWithIngredients]),
    );
    shoppingPatch = buildShoppingList(variedOutputObj.days, recipesById, input.pantry);
  }

  let finalSummary = variedOutputObj.plan_summary || "";
  if (typeof finalSummary === "string") {
    finalSummary = finalSummary.replace(
      /\[TOTAL_BIAYA\]/g,
      `Rp ${shoppingPatch.total_estimated_cost.toLocaleString('id-ID')}`
    );
    // Bersihkan pernyataan budget jika ternyata melebihi budget
    if (input.budget > 0 && shoppingPatch.total_estimated_cost > input.budget) {
      // Hapus "masih di bawah budget Rp X" atau "di bawah budget Rp X"
      finalSummary = finalSummary.replace(/,?\s*masih\s+di\s+bawah\s+budget\s+(Rp\s*)?[\d\.\,]+/gi, "");
      finalSummary = finalSummary.replace(/,?\s*di\s+bawah\s+budget\s+(Rp\s*)?[\d\.\,]+/gi, "");
      // Hapus kalimat tentang sisa budget (mis. "Sisa budget bisa digunakan...")
      finalSummary = finalSummary.replace(/\.?\s*sisa\s+budget\s+[^.]*\.?/gi, ".");
      // Pastikan spasi dan titik rapi
      finalSummary = finalSummary.replace(/\s+/g, " ").replace(/\s+\./g, ".").replace(/\.\./g, ".").trim();
    }
  }

  let finalWarnings = variedOutputObj.warnings || [];
  if (Array.isArray(finalWarnings)) {
    // Saring warning dari AI yang memuat budget/biaya/harga agar tidak double atau halusinasi
    finalWarnings = finalWarnings.filter((w: unknown) =>
      typeof w === "string" &&
      !w.toLowerCase().includes("budget") &&
      !w.toLowerCase().includes("biaya") &&
      !w.toLowerCase().includes("harga")
    );

    finalWarnings = finalWarnings.map((w: unknown) =>
      typeof w === "string"
        ? w.replace(/\[TOTAL_BIAYA\]/g, `Rp ${shoppingPatch.total_estimated_cost.toLocaleString('id-ID')}`)
        : w
    );
  }

  // Tambahkan warning otomatis jika budget ditentukan
  if (input.budget > 0) {
    const budgetVal = input.budget;
    const finalCost = shoppingPatch.total_estimated_cost;
    let budgetMsg = "";
    if (finalCost > budgetVal) {
      const diff = finalCost - budgetVal;
      budgetMsg = `Total estimasi belanja (Rp ${finalCost.toLocaleString('id-ID')}) sedikit melebihi target budget Rp ${budgetVal.toLocaleString('id-ID')} (selisih Rp ${diff.toLocaleString('id-ID')}). Anda dapat menyesuaikan atau mengurangi porsi bahan secara mandiri di Weekly Planner atau menaikkan budget.`;
    } else if (finalCost < budgetVal) {
      const diff = budgetVal - finalCost;
      budgetMsg = `Total estimasi belanja (Rp ${finalCost.toLocaleString('id-ID')}) di bawah target budget Rp ${budgetVal.toLocaleString('id-ID')} (sisa budget Rp ${diff.toLocaleString('id-ID')}).`;
    } else {
      budgetMsg = `Total estimasi belanja (Rp ${finalCost.toLocaleString('id-ID')}) tepat sesuai dengan target budget Rp ${budgetVal.toLocaleString('id-ID')}.`;
    }
    
    finalWarnings.push(budgetMsg);
  }

  const finalOutput = {
    ...variedOutputObj,
    plan_summary: finalSummary,
    warnings: finalWarnings,
    shopping_list: shoppingPatch.shopping_list,
    total_estimated_cost: shoppingPatch.total_estimated_cost,
  };

  // 11. Persist
  const cost = estimateCost(aiResult.tokensInput, aiResult.tokensOutput);
  const { data: saved } = await admin
    .from("generated_plans")
    .insert({
      user_id: userId, input_hash: inputHash, input_json: input,
      output_json: finalOutput, output_type: input.outputType,
      reasoning_content: aiResult.reasoning,
      provider_id: usedProvider.id, model: usedProvider.model,
      tokens_input: aiResult.tokensInput, tokens_output: aiResult.tokensOutput,
      cost_usd: cost, latency_ms: aiResult.latencyMs, status: "success",
    })
    .select("id")
    .single();

  // 12. Log usage
  await admin.from("ai_usage_log").insert({
    user_id: userId, endpoint: "generate-plan", provider_id: usedProvider.id,
    model: usedProvider.model, tokens_input: aiResult.tokensInput,
    tokens_output: aiResult.tokensOutput, cost_usd: cost, cache_hit: false,
  });

  return json({
    plan: finalOutput,
    reasoning: aiResult.reasoning,
    meta: {
      cached: false,
      model: usedProvider.model,
      provider: usedProvider.label,
      latency_ms: aiResult.latencyMs,
      est_cost_usd: cost,
    },
    planId: saved?.id,
  });
});
