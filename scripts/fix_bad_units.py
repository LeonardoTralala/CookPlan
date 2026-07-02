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
    
    # 1. Fetch recipe_ingredients with pagination (to bypass 1000 rows limit)
    print("Mengambil bahan resep dari database (paginated)...", flush=True)
    recipe_ingredients = []
    offset = 0
    limit = 1000
    while True:
        url_ri = f"{supabase_url}/rest/v1/recipe_ingredients?select=id,name,amount,unit,raw_text,ingredient_id,recipes(title)"
        headers_page = headers.copy()
        headers_page["Range"] = f"{offset}-{offset+limit-1}"
        res_ri = requests.get(url_ri, headers=headers_page)
        
        if res_ri.status_code not in [200, 206]:
            print(f"Gagal mengambil recipe_ingredients di offset {offset}: {res_ri.status_code} {res_ri.text}", flush=True)
            sys.exit(1)
            
        data = res_ri.json()
        if not data:
            break
            
        recipe_ingredients.extend(data)
        print(f"  -> Berhasil mengambil {len(data)} baris (Total: {len(recipe_ingredients)})", flush=True)
        
        if len(data) < limit:
            break
        offset += limit
        
    # 2. Fetch master ingredients
    url_ing = f"{supabase_url}/rest/v1/ingredients?select=id,name,base_unit"
    res_ing = requests.get(url_ing, headers=headers)
    master_ingredients = res_ing.json()
    master_map = {ing["id"]: ing for ing in master_ingredients}
    
    # 3. Fetch global unit conversions
    url_conv = f"{supabase_url}/rest/v1/unit_conversions?select=unit,dimension,to_base_factor"
    res_conv = requests.get(url_conv, headers=headers)
    conversions = res_conv.json()
    conv_map = {c["unit"].lower(): c for c in conversions}
    
    # 4. Fetch ingredient unit overrides
    print("Mengambil data unit overrides dari database...", flush=True)
    url_ov = f"{supabase_url}/rest/v1/ingredient_unit_overrides?select=ingredient_id,unit,factor_to_base"
    res_ov = requests.get(url_ov, headers=headers)
    if res_ov.status_code != 200:
        print(f"Gagal mengambil overrides: {res_ov.status_code} {res_ov.text}", flush=True)
        sys.exit(1)
    overrides_list = res_ov.json()
    
    overrides_map = {}
    for ov in overrides_list:
        ing_id = ov["ingredient_id"]
        unit_name = str(ov["unit"]).strip().lower()
        factor = float(ov["factor_to_base"])
        if ing_id not in overrides_map:
            overrides_map[ing_id] = {}
        overrides_map[ing_id][unit_name] = factor
        
    BASE_DIM = { 'g': 'mass', 'ml': 'volume', 'pcs': 'count' }
    
    # Cari yang invalid
    bad_rows = []
    for row in recipe_ingredients:
        ing_id = row.get("ingredient_id")
        if not ing_id or ing_id not in master_map:
            continue
            
        ing = master_map[ing_id]
        base_unit = ing.get("base_unit")
        if not base_unit:
            continue
            
        amt_str = row.get("amount")
        unit_str = row.get("unit")
        if amt_str is None or unit_str is None:
            continue
            
        try:
            amt = float(amt_str)
        except ValueError:
            continue
            
        unit = str(unit_str).strip().lower()
        
        # Cek konversi
        factor = None
        if unit == base_unit.lower():
            factor = 1.0
        elif ing_id in overrides_map and unit in overrides_map[ing_id]:
            factor = overrides_map[ing_id][unit]
        else:
            c = conv_map.get(unit)
            if c and c["dimension"] == BASE_DIM.get(base_unit.lower()):
                factor = float(c["to_base_factor"])
                
        if factor is None:
            bad_rows.append(row)
            
    print(f"Ditemukan {len(bad_rows)} baris yang benar-benar memerlukan perbaikan satuan.", flush=True)
    
    if not bad_rows:
        print("Semua satuan sudah valid dan terhitung!", flush=True)
        return
        
    output_file = "apply_bad_units_fixes.sql"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("-- SQL Perbaikan Satuan Tidak Valid (Production Grade - Paginated)\n")
        f.write("BEGIN;\n")
        f.flush()
        
    # DeepSeek API Configuration
    api_key = "sk-7cf886d503e64ad090a5ca18bea1a973"
    api_url = "https://api.deepseek.com/chat/completions"
    model = "deepseek-v4-pro"
    
    # 5. Batch processing with AI
    batch_size = 15
    total_batches = (len(bad_rows) + batch_size - 1) // batch_size
    
    print(f"\nMemproses {len(bad_rows)} bahan dengan AI dalam {total_batches} batch...", flush=True)
    
    for b_idx in range(total_batches):
        batch = bad_rows[b_idx*batch_size : (b_idx+1)*batch_size]
        print(f"\n[Batch {b_idx+1}/{total_batches}] Memproses {len(batch)} bahan...", flush=True)
        
        # Format batch data for prompt
        batch_input = []
        for item in batch:
            ing_id = item["ingredient_id"]
            master = master_map[ing_id]
            recipe_title = item.get("recipes", {}).get("title") if item.get("recipes") else "Resep"
            
            batch_input.append({
                "id": item["id"],
                "recipe_ing_name": item["name"],
                "recipe_ing_amount": item["amount"],
                "recipe_ing_unit": item["unit"],
                "raw_text": item.get("raw_text") or "",
                "master_name": master["name"],
                "master_base_unit": master["base_unit"],
                "recipe_title": recipe_title
            })
            
        prompt = f"""Kami memiliki ketidakcocokan satuan (bad-unit) antara satuan bahan resep (recipe_ing_unit) dengan satuan dasar master bahan (master_base_unit).
Tugas Anda adalah mengonversi takaran resep tersebut agar menggunakan satuan yang sedimensi dengan `master_base_unit` (g, ml, atau pcs), dan sesuaikan nilai numerik `amount` agar setara dengan takaran aslinya dalam porsi resep tersebut.

Contoh Konversi Panduan:
- `3 sdt kaldu bubuk` (master: `g`): 1 sdt kaldu bubuk = 4 gram, jadi kembalikan: `amount: 12.0`, `unit: "g"`.
- `150 gr Cabai Merah Keriting` (master: `pcs`): 1 cabai merah keriting = 5 gram, jadi 150 gr = 30 buah, jadi kembalikan: `amount: 30.0`, `unit: "pcs"`.
- `1 buah ikan gurame (500 gram)` (master: `g`): kembalikan: `amount: 500.0`, `unit: "g"`.
- `2 sdm perasan air lemon` (master: `g`): 1 sdm cairan = 15 gram, jadi 2 sdm = 30 gram, jadi kembalikan: `amount: 30.0`, `unit: "g"`.
- `5 cup air kaldu ayam` (master `g` kaldu bubuk): kaldu ayam cair 5 cup (1200 ml) membutuhkan sekitar 10 gram kaldu bubuk untuk rasanya, jadi kembalikan: `amount: 10.0`, `unit: "g"`.
- `2 butir putih telur` (master `g` putih telur): 1 butir putih telur = 30 gram, jadi 2 butir = 60 gram, jadi kembalikan: `amount: 60.0`, `unit: "g"`.
- `1 kaleng tuna` (master `g` tuna): 1 kaleng tuna sedang = 150 gram, jadi kembalikan: `amount: 150.0`, `unit: "g"`.
- `1 kaleng jamur kancing` (master `g` jamur kancing): 1 kaleng jamur kancing = 200 gram, jadi kembalikan: `amount: 200.0`, `unit: "g"`.
- `0.25 kg ikan tongkol` (master: `pcs`): 1 pcs/potong tongkol = 80g, jadi 250g = 3 potong/pcs, jadi kembalikan: `amount: 3.0`, `unit: "pcs"`.
- `1 sdm minyak goreng` (master: `ml`): 1 sdm = 15 ml, jadi kembalikan: `amount: 15.0`, `unit: "ml"`.
- `3 porsi nasi dingin` (master: `pcs` porsi nasi): kembalikan `amount: 3.0`, `unit: "pcs"`.

Bahan-bahan yang harus diproses:
{json.dumps(batch_input, indent=2)}

Kembalikan respon HANYA dalam format JSON valid berupa ARRAY dari objek pemetaan berikut, tanpa penjelasan tambahan, tanpa markdown code block:
[
  {{
    "id": 163,
    "amount": 12.0,
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
                            unit_escaped = str(unit).replace("'", "''")
                            sql = f"UPDATE public.recipe_ingredients SET amount = {amount}, unit = '{unit_escaped}' WHERE id = {ri_id};"
                            batch_sqls.append(sql)
                            
                            orig_info = ""
                            for item in batch_input:
                                if item["id"] == ri_id:
                                    orig_info = f"'{item['recipe_ing_name']}' ({item['recipe_ing_amount']} {item['recipe_ing_unit']}) -> Master: {item['master_name']} ({item['master_base_unit']})"
                                    break
                                    
                            clean_log = orig_info.encode('ascii', errors='replace').decode('ascii')
                            print(f"  -> ID {ri_id}: {clean_log} -> KONVERSI: {amount} {unit}", flush=True)
                            
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
