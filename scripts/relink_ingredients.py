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
    # Lowercase, hilangkan karakter khusus, rapatkan spasi
    name = name.lower()
    name = re.sub(r'[^a-z0-9\s]', ' ', name)
    return " ".join(name.split())

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
    
    # Buat kamus pencocokan lokal
    master_map = {} # norm_name -> id
    master_names = [] # list of (norm_name, display_name, id)
    for ing in master_ingredients:
        norm = normalize(ing["name"])
        if norm:
            master_map[norm] = ing["id"]
            master_names.append((norm, ing["name"], ing["id"]))
            
    # Sortir master_names dari yang terpanjang ke terpendek agar pencocokan substring lebih presisi
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
        
    # DeepSeek API Configuration
    api_key = "sk-7cf886d503e64ad090a5ca18bea1a973"
    api_url = "https://api.deepseek.com/chat/completions"
    model = "deepseek-v4-pro"
    
    sql_statements = []
    
    # 3. Proses Pencocokan
    print("\nMemulai pencocokan bahan resep...", flush=True)
    for idx, item in enumerate(unlinked_items):
        ri_id = item["id"]
        raw_name = item["name"]
        raw_text = item.get("raw_text") or ""
        
        # Bersihkan string untuk pencocokan lokal
        norm_raw = normalize(raw_name)
        
        # A. Cek kecocokan persis lokal
        if norm_raw in master_map:
            ing_id = master_map[norm_raw]
            sql = f"UPDATE public.recipe_ingredients SET ingredient_id = {ing_id} WHERE id = {ri_id};"
            sql_statements.append(sql)
            print(f"[{idx+1}/{len(unlinked_items)}] '{raw_name}' -> MATCH PERSIS (id: {ing_id})", flush=True)
            continue
            
        # B. Cek kecocokan substring lokal
        matched_local = False
        for norm_m, display_m, ing_id in master_names:
            # Cegah pencocokan kata yang terlalu pendek (misal: "air" mencocokkan "air jeruk" tapi sebaliknya)
            if len(norm_m) > 2 and (norm_m in norm_raw or norm_raw in norm_m):
                sql = f"UPDATE public.recipe_ingredients SET ingredient_id = {ing_id}, name = '{display_m}' WHERE id = {ri_id};"
                sql_statements.append(sql)
                print(f"[{idx+1}/{len(unlinked_items)}] '{raw_name}' -> MATCH SUBSTRING ke '{display_m}' (id: {ing_id})", flush=True)
                matched_local = True
                break
                
        if matched_local:
            continue
            
        # C. Jika tidak cocok lokal, gunakan AI (DeepSeek V4 Pro)
        # Kita hanya kirimkan master bahan yang relevan (top 15 terdekat secara nama) untuk hemat token
        print(f"[{idx+1}/{len(unlinked_items)}] Menggunakan AI untuk: '{raw_name}' (raw: '{raw_text}')...", flush=True)
        
        prompt = f"""Anda adalah asisten data resep masakan Indonesia. 
Tugas Anda adalah memetakan bahan mentah hasil scraping berikut ke salah satu nama bahan standar (master), atau menyarankan aksi lain.

Bahan Mentah: "{raw_name}"
Teks Asli: "{raw_text}"

Instruksi:
1. Jika bahan ini sebenarnya adalah instruksi memasak atau catatan tambahan yang tidak sengaja ter-scrape sebagai bahan (misal: "Campur semua saos", "Kukus selama 10 menit"), kembalikan action "delete".
2. Jika bahan ini mengandung typo (misal: "cebe" -> cabai, "baput" -> bawang putih), perbaiki namanya ke nama standar.
3. Cari nama bahan standar Indonesia yang paling cocok dari master (misal: "bawang putih", "cabai rawit", "telur ayam", "tepung terigu", "minyak goreng", "garam").
4. Jika merupakan gabungan bahan (misal: "Garam dan merica"), pilih salah satu bahan dominan yang memiliki nilai biaya (misal: "merica" atau "garam").

Kembalikan respon HANYA dalam format JSON valid berikut tanpa penjelasan tambahan, tanpa markdown code block:
{{
  "action": "update", // pilihan: "update" atau "delete"
  "cleaned_name": "cabai rawit", // nama bahan yang sudah bersih/standar
  "suggested_master_name": "cabai rawit" // tebakan nama bahan standar di database
}}"""

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
                    timeout=60
                )
                
                if response.status_code == 200:
                    res_data = response.json()
                    content = res_data["choices"][0]["message"]["content"].strip()
                    
                    if content.startswith("```"):
                        content = re.sub(r'^```json\s*', '', content, flags=re.I)
                        content = re.sub(r'```$', '', content).strip()
                        
                    parsed = json.loads(content)
                    action = parsed.get("action", "update")
                    
                    if action == "delete":
                        sql = f"DELETE FROM public.recipe_ingredients WHERE id = {ri_id};"
                        sql_statements.append(sql)
                        print(f"  -> Aksi AI: HAPUS (karena catatan/instruksi)", flush=True)
                    else:
                        cleaned_name = parsed.get("cleaned_name", raw_name)
                        suggested_master = parsed.get("suggested_master_name", "")
                        
                        # Cari id master berdasarkan tebakan nama standar dari AI
                        norm_suggested = normalize(suggested_master)
                        ing_id = None
                        
                        # Coba cari persis
                        if norm_suggested in master_map:
                            ing_id = master_map[norm_suggested]
                        else:
                            # Cari substring terdekat di master
                            for norm_m, display_m, m_id in master_names:
                                if norm_m in norm_suggested or norm_suggested in norm_m:
                                    ing_id = m_id
                                    cleaned_name = display_m
                                    break
                                    
                        if ing_id:
                            cleaned_name_escaped = cleaned_name.replace("'", "''")
                            sql = f"UPDATE public.recipe_ingredients SET name = '{cleaned_name_escaped}', ingredient_id = {ing_id} WHERE id = {ri_id};"
                            sql_statements.append(sql)
                            print(f"  -> Aksi AI: Cocok ke '{cleaned_name}' (id: {ing_id})", flush=True)
                        else:
                            print(f"  -> Aksi AI: Pembersihan nama ke '{cleaned_name}', tapi tidak ada master yang cocok.", flush=True)
                            
                    success = True
                else:
                    print(f"  -> Gagal API (HTTP {response.status_code}): {response.text}", flush=True)
                    retries -= 1
                    time.sleep(2)
            except Exception as e:
                print(f"  -> Error: {str(e)}", flush=True)
                retries -= 1
                time.sleep(2)
                
        time.sleep(1)
        
    if sql_statements:
        output_file = "fill_ingredients.sql"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("-- SQL Pembersihan & Relink Bahan Resep\n")
            f.write("BEGIN;\n")
            for sql in sql_statements:
                f.write(sql + "\n")
            f.write("COMMIT;\n")
        print(f"\nSelesai! {len(sql_statements)} SQL update berhasil ditulis ke '{output_file}'", flush=True)
    else:
        print("\nTidak ada pembaruan SQL yang dihasilkan.", flush=True)

if __name__ == "__main__":
    main()
