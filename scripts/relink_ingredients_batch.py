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

def normalize(name):
    if not name:
        return ""
    name = name.lower()
    name = re.sub(r'[^a-z0-9\s]', ' ', name)
    return " ".join(name.split())

def find_master_id(suggested_name, master_map, master_names, newly_inserted):
    norm_s = normalize(suggested_name)
    if not norm_s:
        return None, ""
        
    # Kamus alias manual untuk sinonim / kecocokan khusus
    aliases = {
        "gula": "gula pasir",
        "lada": "merica",
        "lada bubuk": "merica",
        "lada bubu": "merica",
        "air lemon": "jeruk lemon lokal",
        "perasan lemon": "jeruk lemon lokal",
        "air perasan lemon": "jeruk lemon lokal",
        "cabai keriting": "cabai keriting merah",
        "cabe keriting": "cabai keriting merah",
        "bon cabe": "boncabe",
        "kaldu jamur": "kaldu bubuk",
        "kaldu ayam": "kaldu bubuk",
        "kaldu sapi": "kaldu bubuk",
        "masako": "kaldu bubuk",
        "royco": "kaldu bubuk",
    }
    
    if norm_s in aliases:
        norm_s = normalize(aliases[norm_s])
        
    # 0. Cek kecocokan di newly_inserted (yang baru saja di-insert dinamis)
    if norm_s in newly_inserted:
        return "NEW", newly_inserted[norm_s]
        
    # 1. Cek exact match database saja (tidak memakai substring matching lokal agar tidak salah tebak)
    if norm_s in master_map:
        for norm_m, display_m, m_id in master_names:
            if norm_m == norm_s:
                return m_id, display_m
                
    return None, ""

def main():
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
    
    # 1. Fetch master ingredients
    print("Mengambil data master bahan (ingredients) dari database...", flush=True)
    url_ing = f"{supabase_url}/rest/v1/ingredients?select=id,name"
    res_ing = requests.get(url_ing, headers=headers)
    if res_ing.status_code != 200:
        print(f"Gagal mengambil master bahan: {res_ing.status_code} {res_ing.text}", flush=True)
        sys.exit(1)
        
    master_ingredients = res_ing.json()
    print(f"Berhasil mengambil {len(master_ingredients)} master bahan.", flush=True)
    
    master_map = {}
    master_names = []
    for ing in master_ingredients:
        norm = normalize(ing["name"])
        if norm:
            master_map[norm] = ing["id"]
            master_names.append((norm, ing["name"], ing["id"]))
            
    master_names.sort(key=lambda x: len(x[0]), reverse=True)
    
    # 2. Fetch unlinked recipe ingredients
    print("Mengambil recipe_ingredients yang belum terhubung (ingredient_id NULL)...", flush=True)
    url_ri = f"{supabase_url}/rest/v1/recipe_ingredients?select=id,name,raw_text&ingredient_id=is.null"
    res_ri = requests.get(url_ri, headers=headers)
    if res_ri.status_code != 200:
        print(f"Gagal mengambil recipe_ingredients: {res_ri.status_code} {res_ri.text}", flush=True)
        sys.exit(1)
        
    unlinked_items = res_ri.json()
    print(f"Ditemukan {len(unlinked_items)} bahan resep yang belum terhubung.", flush=True)
    
    if not unlinked_items:
        print("Semua bahan resep sudah terhubung!", flush=True)
        return
        
    # 3. Masukkan semua bahan yang belum terhubung ke pemrosesan AI (Tanpa exact match lokal awal agar AI membersihkan semuanya)
    to_process_ai = unlinked_items
    newly_inserted = {}
    
    output_file = "fill_ingredients.sql"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("-- SQL Pembersihan & Relink Bahan Resep (Production Grade - Full DeepSeek)\n")
        f.write("BEGIN;\n")
        f.flush()
        
    print(f"Bahan yang memerlukan AI: {len(to_process_ai)} bahan.", flush=True)
    
    # DeepSeek API Configuration
    api_key = "sk-7cf886d503e64ad090a5ca18bea1a973"
    api_url = "https://api.deepseek.com/chat/completions"
    model = "deepseek-v4-pro"
    
    # 4. Batch processing with AI
    batch_size = 15
    total_batches = (len(to_process_ai) + batch_size - 1) // batch_size
    
    print(f"\nMemproses {len(to_process_ai)} bahan dengan AI dalam {total_batches} batch...", flush=True)
    
    for b_idx in range(total_batches):
        batch = to_process_ai[b_idx*batch_size : (b_idx+1)*batch_size]
        print(f"\n[Batch {b_idx+1}/{total_batches}] Memproses {len(batch)} bahan...", flush=True)
        
        # Format batch data for prompt
        batch_input = []
        for item in batch:
            batch_input.append({
                "id": item["id"],
                "name": item["name"],
                "raw_text": item.get("raw_text") or ""
            })
            
        prompt = f"""Anda adalah asisten data resep masakan Indonesia. 
Tugas Anda adalah memetakan daftar bahan mentah hasil scraping dari Cookpad berikut ke nama bahan makanan standar Indonesia (seperti: "bawang putih", "cabai rawit", "telur ayam", "tepung terigu", "minyak goreng", "garam", "tempe", "tahu putih", "saus tiram").

Bahan-bahan yang harus dipetakan:
{json.dumps(batch_input, indent=2)}

Instruksi Pemetaan:
1. Jika baris bahan sebenarnya adalah catatan instruksi/note masakan (misal: "Campur semua saos", "Kukus sampai matang"), kembalikan action "delete".
2. Jika bahan mengandung typo ("cebe" -> cabai, "baput" -> bawang putih), perbaiki namanya ke nama standar.
3. Jika bahan mengandung deskripsi ("bawang putih cincang halus"), bersihkan menjadi nama dasarnya ("bawang putih").
4. Jika berupa gabungan bahan ("Garam dan merica"), petakan ke bahan yang dominan / berbayar (misal: "merica" atau "garam").
5. Jika bahan standar ini tidak ada di kamus standar yang umum (seperti: "tepung roti", "cabai bubuk", "oregano", "tuna kaleng", "sayuran beku", "jengkol"), berikan usulan nama bahan standar Indonesia yang bersih beserta estimasi kategori (pilihan: dairy, dry_goods, meat, spices, vegetables), satuan dasar (g, ml, pcs), dan estimasi harga wajar per satuan dasar (rupiah per gram/ml/pcs).

Kembalikan respon HANYA dalam format JSON valid berikut berupa ARRAY dari objek pemetaan, tanpa penjelasan tambahan, tanpa markdown code block:
[
  {{
    "id": 163,
    "action": "update", // "update" atau "delete"
    "cleaned_name": "bawang putih", // nama bahan yang bersih & standar
    "suggested_master_name": "bawang putih", // usulan nama bahan standar Indonesia
    "category": "vegetables", // jika baru: dairy, dry_goods, meat, spices, atau vegetables
    "base_unit": "pcs", // jika baru: g, ml, pcs
    "price_per_base": 150 // jika baru: estimasi harga wajar dalam Rupiah per satuan dasar (misal Rp150 per pcs bawang putih, Rp30 per gram tepung roti, Rp100 per gram cabai bubuk, dll)
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
                        action = res.get("action", "update")
                        
                        if action == "delete":
                            sql = f"DELETE FROM public.recipe_ingredients WHERE id = {ri_id};"
                            batch_sqls.append(sql)
                            print(f"  -> ID {ri_id}: HAPUS (catatan)", flush=True)
                        else:
                            cleaned_name = res.get("cleaned_name", "")
                            suggested_master = res.get("suggested_master_name", "")
                            
                            ing_id, display_master = find_master_id(suggested_master, master_map, master_names, newly_inserted)
                            
                            if ing_id == "NEW":
                                # Terhubung ke master baru yang telah didefinisikan sebelumnya di SQL
                                master_name_escaped = display_master.replace("'", "''")
                                cleaned_name_escaped = cleaned_name.replace("'", "''")
                                sql = f"UPDATE public.recipe_ingredients SET name = '{cleaned_name_escaped}', ingredient_id = (SELECT id FROM public.ingredients WHERE name = '{master_name_escaped}') WHERE id = {ri_id};"
                                batch_sqls.append(sql)
                                print(f"  -> ID {ri_id}: '{cleaned_name}' -> MATCH ke master baru '{display_master}'", flush=True)
                            elif ing_id:
                                # Update reference ke ingredient yang sudah ada di database
                                cleaned_name_escaped = cleaned_name.replace("'", "''")
                                sql = f"UPDATE public.recipe_ingredients SET name = '{cleaned_name_escaped}', ingredient_id = {ing_id} WHERE id = {ri_id};"
                                batch_sqls.append(sql)
                                print(f"  -> ID {ri_id}: '{cleaned_name}' -> MATCH ke master '{display_master}' (id: {ing_id})", flush=True)
                            else:
                                # Buat ingredient baru (belum terdaftar di DB maupun newly_inserted)
                                category = res.get("category", "dry_goods")
                                if category not in ['dairy', 'dry_goods', 'meat', 'spices', 'vegetables']:
                                    category = 'dry_goods'
                                base_unit = res.get("base_unit", "g")
                                if base_unit not in ['g', 'ml', 'pcs']:
                                    base_unit = 'g'
                                price_per_base = int(res.get("price_per_base", 30))
                                
                                master_name_clean = suggested_master.strip()
                                master_name_escaped = master_name_clean.replace("'", "''")
                                cleaned_name_escaped = cleaned_name.replace("'", "''")
                                
                                sql_insert = f"""-- Daftarkan master bahan baru
INSERT INTO public.ingredients (name, category, base_unit, price_per_base, is_staple)
SELECT '{master_name_escaped}', '{category}', '{base_unit}', {price_per_base}, false
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE name = '{master_name_escaped}');"""
                                
                                sql_update = f"""UPDATE public.recipe_ingredients
SET name = '{cleaned_name_escaped}', ingredient_id = (SELECT id FROM public.ingredients WHERE name = '{master_name_escaped}')
WHERE id = {ri_id};"""
                                
                                batch_sqls.append(sql_insert)
                                batch_sqls.append(sql_update)
                                
                                # Daftarkan ke newly_inserted lokal
                                norm_new = normalize(master_name_clean)
                                newly_inserted[norm_new] = master_name_clean
                                
                                print(f"  -> ID {ri_id}: '{cleaned_name}' -> BUAT master baru '{master_name_clean}' (kat: {category}, unit: {base_unit}, harga: Rp{price_per_base})", flush=True)
                                
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
