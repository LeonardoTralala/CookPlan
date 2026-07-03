// Edge Function: generate-prep
// Menghasilkan saran persiapan bahan (food prep) pintar berbasis Gemini AI.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { callProvider, safeJsonExtract } from "../_shared/aiAdapter.ts";
import type { AIProvider } from "../_shared/aiAdapter.ts";

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

  // 2. Validate input
  const { recipes } = await req.json();
  if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
    return json({ error: "Daftar resep kosong atau tidak valid." }, 400);
  }

  // 3. Get provider for chain failover
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

  // 4. Build prompt
  const SYSTEM_PROMPT = `Anda adalah asisten ahli food prep dapur Indonesia yang profesional, efisien, dan praktis.
Tugas Anda adalah menganalisis menu mingguan yang dijadwalkan oleh pengguna, memeriksa bahan-bahannya, dan merumuskan saran langkah food prep (persiapan bahan) mingguan yang ringkas, logis, dan saling berkolaborasi (efisien).

Fokus pada optimasi dapur:
- Kelompokkan bumbu dasar (misal: "Kupas & haluskan bawang merah, bawang putih, kemiri secara bersamaan untuk stok bumbu dasar Gulai dan Soto").
- Bagi porsi protein (daging, ayam, ikan, tahu, tempe) ke wadah kedap udara secara bersih sebelum disimpan di freezer/chiller.
- Cuci, keringkan, dan potong sayuran berumur panjang (wortel, buncis, brokoli) di awal minggu, taruh di wadah beralas tisu dapur.
- Instruksikan perendaman (misal kacang hijau/bihun) atau marinasi di awal.

Hasilkan respons dalam format JSON valid dengan satu properti "prep_tasks" yang merupakan array of string.
Contoh format output JSON:
{
  "prep_tasks": [
    "Kupas & haluskan bumbu (bawang merah, bawang putih, kemiri) secara bersamaan untuk cadangan menu Gulai Ikan dan Soto Ayam",
    "Bagi porsi & simpan daging sapi untuk Rendang dan Soto Daging di wadah kedap udara dalam freezer",
    "Cuci & potong sayur (wortel, buncis, kentang) untuk persiapan Sup Daging",
    "Rendam kacang hijau semalaman di hari Rabu untuk Bubur Kacang Hijau hari Kamis"
  ]
}

JANGAN menuliskan kata-kata penjelasan, markdown, atau pembuka lainnya selain JSON itu sendiri. Pastikan JSON Anda valid.`;

  const userMessage = `Berikut adalah resep yang dijadwalkan minggu ini:
${recipes.map((r, i) => {
  const ingredientsStr = (r.ingredients ?? []).map((ing: any) => `${ing.name} (${ing.amount} ${ing.unit})`).join(", ");
  const instructionsStr = (r.instructions ?? []).join(" ");
  return `${i+1}. ${r.title}
   - Bahan: ${ingredientsStr}
   - Langkah Masak: ${instructionsStr}`;
}).join("\n")}`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  // 5. Call AI
  let aiResult = null;
  let usedProvider = null;
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
    return json({ error: `Semua AI provider gagal dipanggil. Error terakhir: ${lastError}` }, 502);
  }

  // 6. Parse and return
  try {
    const extracted = safeJsonExtract(aiResult.content);
    if (!extracted || !Array.isArray(extracted.prep_tasks)) {
      throw new Error("JSON hasil AI tidak memiliki format 'prep_tasks' array.");
    }
    
    // Log usage
    await admin.from("ai_usage_log").insert({
      user_id: userId,
      endpoint: "generate-prep",
      cache_hit: false,
      model: usedProvider.model,
    });

    return json({ prep_tasks: extracted.prep_tasks });
  } catch (err) {
    console.error("Gagal parse output AI:", err, aiResult.content);
    // Fallback: kembalikan string mentah dipecah baris jika bukan JSON valid
    return json({ 
      prep_tasks: [
        "Cuci dan bersihkan semua bahan masakan minggu ini.",
        "Pisahkan daging dan sayuran di wadah penyimpanan yang berbeda."
      ] 
    });
  }
});
