// Edge Function: generate-plan
// Proxy AI provider-agnostic untuk generate foodplan/foodprep.
// Flow: auth → rate limit → validate → cache → retrieve resep → prompt → AI
//       → parse → validate → pantry subtract → persist → return.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { SYSTEM_PROMPT, PROMPT_VERSION, buildUserMessage } from "../_shared/prompt.ts";
import { callProvider, safeJsonExtract, estimateCost } from "../_shared/aiAdapter.ts";
import type { AIProvider } from "../_shared/aiAdapter.ts";
import { validateInput, validateOutput, subtractPantry, enforceVariety } from "../_shared/validate.ts";

const RATE_LIMIT_PER_DAY = 20; // generate per user per hari

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

  // 2. Rate limit (window UTC-based, konsisten dengan getTodayUsageCount di klien)
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

  // 3. Validate input
  let input;
  try {
    input = validateInput(await req.json());
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  // 4. Cache check — PROMPT_VERSION ikut di-hash supaya perubahan prompt
  // otomatis membatalkan cache hasil prompt lama.
  const inputHash = await sha256(`${PROMPT_VERSION}:${JSON.stringify(input)}`);
  const { data: cached } = await admin
    .from("generated_plans")
    .select("id, output_json, reasoning_content, model")
    .eq("user_id", userId)
    .eq("input_hash", inputHash)
    .eq("status", "success")
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

  // 5. Retrieve recipe context (filter berdasarkan diet bila ada tag cocok)
  let recipeQuery = admin
    .from("recipes")
    .select("id, title, calories, price_idr, ready_in_minutes, difficulty, cuisine, tags, badges, ingredients_text, base_servings")
    .eq("is_active", true)
    .limit(40);
  // Filter diet: resep harus punya minimal satu slug diet yang cocok (overlap).
  // Pakai kolom `recipes.diet` (controlled vocabulary), bukan `tags` yang nyampur bahan.
  if (input.diet.length > 0) {
    recipeQuery = recipeQuery.overlaps("diet", input.diet);
  }
  let { data: candidates } = await recipeQuery;
  // Fallback: kalau filter diet menyisakan terlalu sedikit, ambil semua aktif.
  if (!candidates || candidates.length < 3) {
    const { data: allActive } = await admin
      .from("recipes")
      .select("id, title, calories, price_idr, ready_in_minutes, difficulty, cuisine, tags, badges, ingredients_text, base_servings")
      .eq("is_active", true)
      .limit(40);
    candidates = allActive ?? [];
  }
  if (candidates.length === 0) {
    return json({ error: "Bank resep kosong. Tambahkan resep dulu." }, 422);
  }
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
  //     a. tegakkan variasi/hari + isi 3 slot (foodprep), b. kurangi pantry.
  const variedOutput = enforceVariety(parsed as Record<string, unknown>, input.variasiPerHari, input.porsi);
  const finalOutput = subtractPantry(variedOutput, input.pantry);

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
