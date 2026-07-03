// Script untuk otomatisasi pengisian deskripsi resep yang masih kosong menggunakan API DeepSeek V4 Pro
// Script ini langsung memperbarui database jika ada SUPABASE_SERVICE_ROLE_KEY di .env,
// dan juga menuliskan query UPDATE ke berkas fill_descriptions.sql.
//
// Cara Penggunaan:
// 1. Tambahkan SUPABASE_SERVICE_ROLE_KEY=<key> di .env (opsional, jika ingin memperbarui langsung)
// 2. Jalankan: node scripts/generate-recipe-descriptions.mjs

import { readFileSync, writeFileSync } from "node:fs";
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
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Error: VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY harus didefinisikan di .env atau environment.");
  process.exit(1);
}

// Gunakan serviceKey jika ada agar bisa update RLS, jika tidak gunakan anonKey (hanya untuk baca)
const supabase = createClient(supabaseUrl, serviceKey || anonKey);

async function main() {
  console.log("Mengambil data resep yang belum memiliki deskripsi...");
  
  // Ambil resep yang description null atau kosong
  const { data: recipes, error: fetchError } = await supabase
    .from("recipes")
    .select("id, title, ingredients_text, instructions")
    .or("description.is.null,description.eq.''")
    .order("id");
    
  if (fetchError) {
    console.error("Gagal mengambil data resep:", fetchError.message);
    process.exit(1);
  }
  
  console.log(`Ditemukan ${recipes.length} resep yang perlu diisi deskripsinya.`);
  if (recipes.length === 0) {
    console.log("Semua resep sudah memiliki deskripsi!");
    return;
  }
  
  // Ambil konfigurasi DeepSeek V4 Pro dari database atau env/hardcoded fallback
  let aiProvider = {
    base_url: env.DEEPSEEK_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    api_key: env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || "",
    model: env.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-pro"
  };

  if (!aiProvider.api_key) {
    console.log("Mengambil konfigurasi AI Provider dari database...");
    const { data: providers, error: providerError } = await supabase
      .from("ai_providers")
      .select("base_url, api_key, model")
      .eq("model", "deepseek-v4-pro")
      .limit(1);
      
    if (providerError || !providers || providers.length === 0) {
      console.warn("Peringatan: Gagal menemukan provider 'deepseek-v4-pro'. Mencoba mengambil provider aktif...");
      const { data: activeProviders, error: activeError } = await supabase
        .from("ai_providers")
        .select("base_url, api_key, model")
        .eq("is_active", true)
        .limit(1);
        
      if (activeError || !activeProviders || activeProviders.length === 0) {
        console.error("Gagal mengambil AI Provider yang aktif atau DeepSeek V4 Pro di database.");
        process.exit(1);
      }
      aiProvider = activeProviders[0];
    } else {
      aiProvider = providers[0];
    }
  }
  
  console.log(`Menggunakan AI Provider: ${aiProvider.model} di ${aiProvider.base_url}`);
  
  const sqlFile = resolve(root, "fill_descriptions.sql");
  writeFileSync(sqlFile, "-- SQL Backfill untuk mengisi deskripsi resep menggunakan DeepSeek V4 Pro\n\n", "utf8");
  
  if (!serviceKey) {
    console.log("⚠️ SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env. Update real-time ke database dilewati (hanya menghasilkan fill_descriptions.sql).");
  }

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    console.log(`[${i + 1}/${recipes.length}] Memproses deskripsi untuk: "${recipe.title}" (ID: ${recipe.id})...`);
    
    try {
      const prompt = `Anda adalah koki profesional dan ahli gizi Indonesia. Buatlah deskripsi pendek yang menggugah selera (appetizing), sekitar 2-3 kalimat, menggunakan Bahasa Indonesia yang menarik dan ramah keluarga untuk resep berikut:
      
Judul: ${recipe.title}
Bahan: ${recipe.ingredients_text || ""}
Langkah: ${JSON.stringify(recipe.instructions || [])}

Kembalikan HANYA teks deskripsi resep tersebut saja tanpa format JSON, tanpa penjelasan tambahan, dan tanpa markdown code block.`;

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
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
      }

      const resData = await response.json();
      let description = resData.choices[0].message.content.trim();
      
      // Bersihkan jika model mengembalikan format markdown
      if (description.startsWith("```")) {
        description = description.replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "").trim();
      }
      
      console.log(`  -> Deskripsi: "${description}"`);
      
      // Tulis query SQL ke file
      const escapedDesc = description.replace(/'/g, "''");
      const sqlQuery = `UPDATE public.recipes SET description = '${escapedDesc}' WHERE id = ${recipe.id};\n`;
      writeFileSync(sqlFile, sqlQuery, { flag: "a", encoding: "utf8" });
      
      // Update database langsung jika serviceKey tersedia
      if (serviceKey) {
        const { error: updateError } = await supabase
          .from("recipes")
          .update({ description })
          .eq("id", recipe.id);
          
        if (updateError) {
          console.error(`  -> Gagal update database: ${updateError.message}`);
        } else {
          console.log(`  -> Berhasil update database secara real-time.`);
        }
      }
    } catch (err) {
      console.error(`  -> Gagal memproses "${recipe.title}":`, err.message);
    }
    
    // Delay kecil agar tidak terkena rate limit
    await new Promise((r) => setTimeout(r, 500));
  }
  
  console.log(`\nProses selesai! Berkas SQL disimpan di: ${sqlFile}`);
}

main();
