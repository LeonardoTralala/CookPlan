import os
import re
import sys
import json
import time
import requests

def load_env():
    env = {}
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return env

def fetch_all_paginated(url, headers):
    out = []
    offset = 0
    limit = 1000
    while True:
        headers_page = headers.copy()
        headers_page["Range"] = f"{offset}-{offset+limit-1}"
        res = requests.get(url, headers=headers_page)
        if res.status_code not in [200, 206]:
            print(f"Gagal mengambil data dari {url} di offset {offset}: {res.status_code} {res.text}", flush=True)
            sys.exit(1)
        data = res.json()
        if not data:
            break
        out.extend(data)
        if len(data) < limit:
            break
        offset += limit
    return out

def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
        
    env = load_env()
    supabase_url = env.get("VITE_SUPABASE_URL")
    anon_key = env.get("VITE_SUPABASE_ANON_KEY")
    
    if not supabase_url or not anon_key:
        print("Error: VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan di .env", flush=True)
        sys.exit(1)
        
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    # 1. Ambil semua recipes
    print("Mengambil data resep dari database...", flush=True)
    recipes_url = f"{supabase_url}/rest/v1/recipes?select=id,title,base_servings,instructions,description"
    recipes = fetch_all_paginated(recipes_url, headers)
    print(f"Berhasil mengambil {len(recipes)} resep.", flush=True)
    
    # 2. Ambil semua master ingredients
    print("Mengambil master ingredients...", flush=True)
    ing_url = f"{supabase_url}/rest/v1/ingredients?select=id,name,base_unit"
    master_ingredients = fetch_all_paginated(ing_url, headers)
    master_map = {ing["id"]: ing for ing in master_ingredients}
    print(f"Berhasil mengambil {len(master_ingredients)} master ingredients.", flush=True)
    
    # 3. Ambil semua recipe_ingredients
    print("Mengambil recipe_ingredients...", flush=True)
    ri_url = f"{supabase_url}/rest/v1/recipe_ingredients?select=id,recipe_id,name,amount,unit,ingredient_id,raw_text"
    recipe_ingredients = fetch_all_paginated(ri_url, headers)
    print(f"Berhasil mengambil {len(recipe_ingredients)} recipe_ingredients.", flush=True)
    
    # Kelompokkan recipe_ingredients berdasarkan recipe_id
    recipe_ingredients_map = {}
    for ri in recipe_ingredients:
        r_id = ri["recipe_id"]
        if r_id not in recipe_ingredients_map:
            recipe_ingredients_map[r_id] = []
        recipe_ingredients_map[r_id].append(ri)
        
    # DeepSeek API Configuration
    api_key = env.get("DEEPSEEK_API_KEY", "")
    api_url = "https://api.deepseek.com/chat/completions"
    model = "deepseek-v4-pro"
    
    output_file = "supabase/migrations/20260703160000_recalibrate_recipe_ingredients.sql"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("-- SQL Rekalibrasi Takaran Bahan Resep agar Realistis (Production Grade - AI Assisted)\n")
        f.write("BEGIN;\n\n")
        f.flush()
        
    batch_size = 5  # Memproses 5 resep per batch agar prompt tidak terlalu panjang dan tetap fokus
    total_batches = (len(recipes) + batch_size - 1) // batch_size
    
    print(f"\nMemproses {len(recipes)} resep dalam {total_batches} batch dengan AI...", flush=True)
    
    for b_idx in range(total_batches):
        batch_recipes = recipes[b_idx*batch_size : (b_idx+1)*batch_size]
        print(f"\n[Batch {b_idx+1}/{total_batches}] Memproses {len(batch_recipes)} resep...", flush=True)
        
        # Buat context input untuk batch ini
        batch_input = []
        for r in batch_recipes:
            r_id = r["id"]
            ingredients_list = recipe_ingredients_map.get(r_id, [])
            if not ingredients_list:
                continue
                
            ingredients_data = []
            for ri in ingredients_list:
                ing_id = ri["ingredient_id"]
                base_unit = "g"
                master_name = ""
                if ing_id and ing_id in master_map:
                    base_unit = master_map[ing_id]["base_unit"] or "g"
                    master_name = master_map[ing_id]["name"]
                    
                ingredients_data.append({
                    "id": ri["id"],
                    "current_name": ri["name"],
                    "master_name": master_name,
                    "current_amount": ri["amount"],
                    "current_unit": ri["unit"],
                    "raw_text": ri["raw_text"],
                    "master_base_unit": base_unit
                })
                
            batch_input.append({
                "recipe_id": r_id,
                "title": r["title"],
                "base_servings": r["base_servings"] or 2,
                "description": r["description"],
                "instructions": r["instructions"],
                "ingredients": ingredients_data
            })
            
        if not batch_input:
            continue
            
        prompt = f"""Anda adalah koki profesional dan ahli gizi Indonesia.
Tugas Anda adalah memeriksa dan mengoreksi jumlah (amount) dan satuan (unit) bahan resep agar REALISTIS, MASUK AKAL, dan SEIMBANG (proporsional) untuk porsi hidangan ("base_servings") yang ditentukan.

Data resep yang harus diproses:
{json.dumps(batch_input, indent=2)}

Panduan Rekalibrasi Bahan:
1. Porsi Acuan ("base_servings"): Hitung jumlah bahan secara akurat agar pas untuk porsi tersebut. (Misal jika base_servings = 2, porsi daging ayam biasanya sekitar 250g - 400g, telur 2-4 butir, kentang 1-2 buah, dll).
2. Spices/Aromatics: Gunakan takaran wajar dalam resep Indonesia.
   - Bawang merah, bawang putih: Lebih baik gunakan satuan "siung" (atau "butir" / "buah") jika master_base_unit = g/pcs. (1 siung bawang putih ~ 5g, 1 siung bawang merah ~ 10g).
   - Jahe, lengkuas, kunyit: Gunakan "ruas" atau "g" (misal 2 cm / 2 ruas / 10g).
   - Cabai: Gunakan "buah" atau "pcs" (misal tumis kangkung porsi 2 cukup 3-5 buah cabai, bukan 50 buah atau 0.1 buah).
3. Condiments/Seasonings (secukupnya): Jangan biarkan nol atau kosong. Berikan takaran wajar:
   - Garam: Untuk porsi 2 orang, garam secukupnya ~ 0.5 sdt s.d 1 sdt (sekitar 2.5g - 5g).
   - Gula pasir: 0.5 sdt s.d 1.5 sdt (sekitar 2g - 6g).
   - Kaldu bubuk / kaldu jamur: 0.5 sdt s.d 1 sdt (sekitar 2g - 4g).
   - Merica / lada bubuk: 0.25 sdt s.d 0.5 sdt (sekitar 0.5g - 1g).
   - Minyak goreng (untuk menumis): 1 sdm - 2 sdm (sekitar 15ml - 30ml).
   - Air: Untuk kuah sop porsi 2 orang ~ 400ml - 600ml. Untuk tumisan ~ 50ml - 100ml.
4. Kesesuaian Satuan (Kritis): Unit yang dikembalikan harus sedimensi dengan `master_base_unit` agar bisa dikonversi di database:
   - Jika `master_base_unit` adalah "g": gunakan "g", "gr", "gram", "kg", "sdm", "sdt", "siung", "butir", "pcs", "buah", "batang", "lembar", "ikat", "ruas".
   - Jika `master_base_unit` adalah "ml": gunakan "ml", "sdm", "sdt", "gelas", "liter".
   - Jika `master_base_unit` adalah "pcs": gunakan "pcs", "buah", "biji", "butir", "lembar", "batang".
5. Logika & Proporsi: Pastikan rasio bahan masuk akal (misal: nasi goreng porsi 2 piring membutuhkan nasi sekitar 400g - 500g, bukan 5g atau 50kg).

Kembalikan respon HANYA dalam bentuk JSON valid berupa ARRAY dari objek-objek berikut (gabungkan semua resep dari batch ini ke satu array hasil), tanpa penjelasan tambahan, tanpa markdown code block:
[
  {{
    "id": 2314, // ID recipe_ingredient
    "amount": 350.0,
    "unit": "g"
  }},
  {{
    "id": 2315,
    "amount": 3.0,
    "unit": "siung"
  }}
]"""

        success = False
        retries = 3
        while retries > 0 and not success:
            try:
                response = requests.post(
                    api_url,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {api_key}"
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.1
                    },
                    timeout=150
                )
                
                if response.status_code == 200:
                    res_json = response.json()
                    content = res_json["choices"][0]["message"]["content"].strip()
                    
                    # Hilangkan markdown code block jika ada
                    if content.startswith("```"):
                        content = re.sub(r"^```json\s*", "", content)
                        content = re.sub(r"^```\s*", "", content)
                        content = re.sub(r"\s*```$", "", content)
                        content = content.strip()
                        
                    results = json.loads(content)
                    
                    # Tulis ke SQL file
                    with open(output_file, "a", encoding="utf-8") as f:
                        f.write(f"-- Batch {b_idx+1} updates\n")
                        for r_item in results:
                            ri_id = r_item["id"]
                            amount = float(r_item["amount"])
                            unit = str(r_item["unit"]).strip().replace("'", "''")
                            f.write(f"UPDATE public.recipe_ingredients SET amount = {amount}, unit = '{unit}' WHERE id = {ri_id};\n")
                        f.write("\n")
                        f.flush()
                        
                    print(f"  -> Berhasil memproses batch {b_idx+1}. Menulis {len(results)} update.", flush=True)
                    success = True
                else:
                    print(f"  -> Gagal dengan status {response.status_code}: {response.text}. Retrying...", flush=True)
                    retries -= 1
                    time.sleep(2)
            except Exception as e:
                print(f"  -> Error: {e}. Retrying...", flush=True)
                retries -= 1
                time.sleep(2)
                
        if not success:
            print("Gagal memproses batch setelah beberapa kali percobaan. Keluar.", flush=True)
            sys.exit(1)
            
    with open(output_file, "a", encoding="utf-8") as f:
        f.write("COMMIT;\n")
        f.flush()
        
    print(f"\nProses selesai! File SQL disimpan di: {output_file}", flush=True)

if __name__ == "__main__":
    main()
