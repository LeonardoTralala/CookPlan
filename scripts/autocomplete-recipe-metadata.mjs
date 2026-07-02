// Script untuk otomatisasi pengisian metadata resep yang kurang lengkap (calories, ready_in_minutes, difficulty)
// Menggunakan AI provider yang aktif di database secara otomatis.
//
// Cara Penggunaan:
// 1. Tambahkan SUPABASE_SERVICE_ROLE_KEY=<key> di .env (karena membutuhkan izin write/bypass RLS)
// 2. Jalankan: node scripts/autocomplete-recipe-metadata.mjs

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Error: VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus didefinisikan di .env atau environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("Mengambil data resep yang belum lengkap metadatanya...");
  
  // Ambil resep yang calories null/0, atau ready_in_minutes null/0, atau difficulty null
  const { data: recipes, error: fetchError } = await supabase
    .from("recipes")
    .select("id, title, ingredients_text, instructions")
    .or("calories.is.null,calories.eq.0,ready_in_minutes.is.null,ready_in_minutes.eq.0,difficulty.is.null");
    
  if (fetchError) {
    console.error("Gagal mengambil data resep:", fetchError.message);
    process.exit(1);
  }
  
  console.log(`Ditemukan ${recipes.length} resep yang perlu dilengkapi.`);
  if (recipes.length === 0) {
    console.log("Semua resep sudah lengkap!");
    return;
  }
  
  // Ambil konfigurasi AI Provider yang aktif dari database
  const { data: providers, error: providerError } = await supabase
    .from("ai_providers")
    .select("base_url, api_key, model")
    .eq("is_active", true)
    .limit(1);
    
  if (providerError || !providers || providers.length === 0) {
    console.error("Gagal mengambil AI Provider yang aktif di database.");
    process.exit(1);
  }
  
  const aiProvider = providers[0];
  console.log(`Menggunakan AI Provider aktif: ${aiProvider.model} di ${aiProvider.base_url}`);
  
  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    console.log(`[${i + 1}/${recipes.length}] Mengestimasi metadata untuk: "${recipe.title}"...`);
    
    try {
      const prompt = `Anda adalah koki profesional dan ahli gizi Indonesia. Berikan estimasi kalori (total per resep porsi 2), waktu memasak (dalam menit), dan tingkat kesulitan (easy, medium, hard) untuk resep berikut:
      
Judul: ${recipe.title}
Bahan: ${recipe.ingredients_text || ""}
Langkah: ${JSON.stringify(recipe.instructions || [])}

Kembalikan respon HANYA dalam format JSON valid berikut tanpa penjelasan, tanpa markdown code block:
{
  "calories": 250,
  "ready_in_minutes": 35,
  "difficulty": "easy"
}`;

      const response = await fetch(`${aiProvider.base_url}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${aiProvider.api_key}`
        },
        body: JSON.stringify({
          model: aiProvider.model,
          messages: [
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} dari AI API`);
      }
      
      const resData = await response.json();
      let content = resData.choices[0].message.content.trim();
      
      // Bersihkan markdown code fence jika ada
      if (content.startsWith("```")) {
        content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }
      
      const parsed = JSON.parse(content);
      
      const calories = parseInt(parsed.calories, 10);
      const readyInMinutes = parseInt(parsed.ready_in_minutes, 10);
      const difficulty = parsed.difficulty;
      
      if (isNaN(calories) || isNaN(readyInMinutes) || !["easy", "medium", "hard"].includes(difficulty)) {
        throw new Error("Format output AI tidak valid");
      }
      
      const { error: updateError } = await supabase
        .from("recipes")
        .update({
          calories,
          ready_in_minutes: readyInMinutes,
          difficulty
        })
        .eq("id", recipe.id);
        
      if (updateError) {
        throw new Error(`Gagal update DB: ${updateError.message}`);
      }
      
      console.log(`  -> Berhasil! Kalori: ${calories} kcal | Waktu: ${readyInMinutes} m | Kesulitan: ${difficulty}`);
      
      // Delay kecil untuk mencegah rate limiting
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (err) {
      console.error(`  x Gagal untuk "${recipe.title}":`, err.message);
    }
  }
  
  console.log("\nSelesai! Pengisian metadata resep selesai.");
}

main();
