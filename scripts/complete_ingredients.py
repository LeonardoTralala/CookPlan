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
    
    # 1. Fetch master ingredients to get their base_unit
    print("Mengambil data master bahan (ingredients) dari database...", flush=True)
    url_ing = f"{supabase_url}/rest/v1/ingredients?select=id,name,base_unit"
    res_ing = requests.get(url_ing, headers=headers)
    if res_ing.status_code != 200:
        print(f"Gagal mengambil master bahan: {res_ing.status_code} {res_ing.text}", flush=True)
        sys.exit(1)
        
    master_ingredients = res_ing.json()
    master_map = {ing["id"]: ing for ing in master_ingredients}
    print(f"Berhasil mengambil {len(master_ingredients)} master bahan.", flush=True)
    
    # 2. Fetch recipe ingredients where amount or unit is NULL
    print("Mengambil recipe_ingredients yang belum lengkap (amount atau unit NULL)...", flush=True)
    url_ri = f"{supabase_url}/rest/v1/recipe_ingredients?select=id,name,raw_text,ingredient_id,recipe_id,recipes(title)&or=(amount.is.null,unit.is.null)"
    res_ri = requests.get(url_ri, headers=headers)
    if res_ri.status_code != 200:
        print(f"Gagal mengambil recipe_ingredients: {res_ri.status_code} {res_ri.text}", flush=True)
        sys.exit(1)
        
    incomplete_items = res_ri.json()
    print(f"Ditemukan {len(incomplete_items)} bahan resep yang belum lengkap takarannya.", flush=True)
    
    if not incomplete_items:
        print("Semua bahan resep sudah memiliki takaran lengkap!", flush=True)
        return
        
    output_file = "fill_ingredient_details.sql"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("-- SQL Pelengkap Takaran & Satuan Bahan Resep (Production Grade)\n")
        f.write("BEGIN;\n")
        f.flush()
        
    # DeepSeek API Configuration
    api_key = env.get("DEEPSEEK_API_KEY", "")
    api_url = "https://api.deepseek.com/chat/completions"
    model = "deepseek-v4-pro"
    
    # 3. Batch processing with AI
    batch_size = 15
    total_batches = (len(incomplete_items) + batch_size - 1) // batch_size
    
    print(f"\nMemproses {len(incomplete_items)} bahan dengan AI dalam {total_batches} batch...", flush=True)
    
    for b_idx in range(total_batches):
        batch = incomplete_items[b_idx*batch_size : (b_idx+1)*batch_size]
        print(f"\n[Batch {b_idx+1}/{total_batches}] Memproses {len(batch)} bahan...", flush=True)
        
        # Format batch data for prompt
        batch_input = []
        for item in batch:
            ing_id = item.get("ingredient_id")
            master_name = ""
            base_unit = "g"
            if ing_id and ing_id in master_map:
                master_name = master_map[ing_id]["name"]
                base_unit = master_map[ing_id]["base_unit"] or "g"
                
            raw_t = item.get("raw_text") or item.get("name") or ""
            recipe_title = item.get("recipes", {}).get("title") if item.get("recipes") else "Resep"
            
            batch_input.append({
                "id": item["id"],
                "raw_text": raw_t,
                "master_name": master_name,
                "base_unit": base_unit,
                "recipe_title": recipe_title
            })
            
        prompt = f"""Anda adalah koki profesional dan ahli gizi Indonesia.
Tugas Anda adalah memperkirakan jumlah (amount) dan satuan (unit) belanja/masak yang wajar untuk bahan-resep masakan berikut.

Bahan-bahan yang harus diproses:
{json.dumps(batch_input, indent=2)}

Instruksi Pemrosesan:
1. Analisis teks mentah ("raw_text") dan nama bahan standar ("master_name") dalam konteks judul resep ("recipe_title") untuk porsi 2 orang.
2. Estimasi nilai numerik `amount` (float) dan `unit` (string) yang wajar.
3. Anda harus memilih unit yang sedimensi dengan "base_unit" bahan tersebut agar dapat dikonversi dengan benar di database:
   - Jika "base_unit" adalah "g", gunakan satuan berat: "g", "gr", "gram", "kg". (Estimasi jumlah secukupnya dalam gram, misal: secukupnya garam = 2.5 g, secukupnya gula = 5 g, secukupnya kaldu bubuk = 4 g).
   - Jika "base_unit" adalah "ml", gunakan satuan volume: "ml", "sdm", "sdt", "gelas", "liter". (Estimasi jumlah secukupnya dalam ml atau sdm/sdt, misal: minyak goreng untuk menumis = 15 ml atau 1 sdm, air secukupnya = 150 ml).
   - Jika "base_unit" adalah "pcs", gunakan satuan hitung: "pcs", "buah", "biji", "butir". (Estimasi jumlah buah/pcs, misal: secukupnya tomat = 1 buah, secukupnya telur = 1 butir, 1 siung bawang putih = 1 pcs atau 1 buah).

Kembalikan respon HANYA dalam format JSON valid berupa ARRAY dari objek pemetaan berikut, tanpa penjelasan tambahan, tanpa markdown code block:
[
  {{
    "id": 856,
    "amount": 50.0,
    "unit": "g"
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
                    timeout=120
                )
                
                if response.status_code == 200:
                    res_data = response.json()
                    content = res_data["choices"][0]["message"]["content"].strip()
                    
                    if content.startswith("```"):
                        content = re.sub(r'^```json\s*', '', content, flags=re.I)
                        content = re.sub(r'```$', '', content).strip()
                        
                    results = json.loads(content)
                    
                    # Proses hasil pemetaan batch
                    batch_sqls = []
                    for res in results:
                        ri_id = res.get("id")
                        amount = res.get("amount")
                        unit = res.get("unit")
                        
                        if ri_id and amount is not None and unit is not None:
                            # Escape single quote in unit just in case
                            unit_escaped = str(unit).replace("'", "''")
                            sql = f"UPDATE public.recipe_ingredients SET amount = {amount}, unit = '{unit_escaped}' WHERE id = {ri_id};"
                            batch_sqls.append(sql)
                            
                            # Cari raw text asal untuk log
                            orig_text = ""
                            for item in batch_input:
                                if item["id"] == ri_id:
                                    orig_text = item["raw_text"]
                                    break
                            clean_orig = orig_text.encode('ascii', errors='replace').decode('ascii')
                            print(f"  -> ID {ri_id}: '{clean_orig}' -> ESTIMASI: {amount} {unit}", flush=True)
                            
                    if batch_sqls:
                        with open(output_file, "a", encoding="utf-8") as f:
                            for sql in batch_sqls:
                                f.write(sql + "\n")
                            f.flush()
                            
                    success = True
                else:
                    print(f"  -> Gagal (HTTP {response.status_code}): {response.text}", flush=True)
                    retries -= 1
                    time.sleep(2)
            except Exception as e:
                print(f"  -> Error: {str(e)}", flush=True)
                retries -= 1
                time.sleep(2)
                
        # Sleep polite
        time.sleep(1)
        
    with open(output_file, "a", encoding="utf-8") as f:
        f.write("COMMIT;\n")
    print(f"\nSelesai! Seluruh batch berhasil diproses. SQL ditulis ke '{output_file}'", flush=True)

if __name__ == "__main__":
    main()
