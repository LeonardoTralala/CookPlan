import os
import re
import sys
import json
import time
import requests
import pandas as pd

# .env loader
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

def clean_title(t):
    if not isinstance(t, str):
        return ""
    return re.sub(r'\s+', ' ', t.strip().lower())

def load_completed_ids(filename):
    completed = set()
    if os.path.exists(filename):
        with open(filename, "r", encoding="utf-8") as f:
            for line in f:
                match = re.search(r"WHERE id = (\d+);", line)
                if match:
                    completed.add(int(match.group(1)))
    return completed

def to_postgres_array(instructions_list):
    escaped_items = []
    for item in instructions_list:
        if not item:
            continue
        # Bersihkan spasi berlebih dan escape petik tunggal
        clean_item = re.sub(r'\s+', ' ', item.strip())
        escaped = clean_item.replace("'", "''")
        escaped_items.append(f"'{escaped}'")
    return "ARRAY[" + ", ".join(escaped_items) + "]"

def main():
    env = load_env()
    supabase_url = env.get("VITE_SUPABASE_URL")
    anon_key = env.get("VITE_SUPABASE_ANON_KEY")
    
    if not supabase_url or not anon_key:
        print("Error: VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan di .env", flush=True)
        sys.exit(1)
        
    output_file = "fill_metadata.sql"
    completed_ids = load_completed_ids(output_file)
    
    # Karena kita ingin memproses ulang agar instruksinya ter-split bersih dengan AI,
    # kita abaikan resume jika kita ingin membersihkan semuanya dari awal.
    # Namun, agar aman, kita biarkan mode resume jika filenya sudah berisi format array instruksi baru.
    # Kita cek jika file sudah ada dan ingin di-reset, kita buat baru:
    print("Menghapus/mereset file 'fill_metadata.sql' agar semua resep mendapatkan pembersihan instruksi lengkap...", flush=True)
    completed_ids = set()
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("-- SQL Backfill untuk melengkapi resep metadata & memecah instruksi\n")
        f.flush()
            
    print("Membaca file Excel 'Database resep.xlsx'...", flush=True)
    df_excel = pd.read_excel("Database resep.xlsx")
    print(f"Selesai membaca Excel. Total resep di Excel: {len(df_excel)}", flush=True)
    
    # Map title_cleaned -> row
    excel_map = {}
    for idx, row in df_excel.iterrows():
        title = row.get("Title")
        if pd.notna(title):
            excel_map[clean_title(title)] = row
            
    print("Mengambil data resep yang belum lengkap dari database...", flush=True)
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    url = f"{supabase_url}/rest/v1/recipes?select=id,title,ingredients_text,instructions&or=(calories.is.null,calories.eq.0,ready_in_minutes.is.null,ready_in_minutes.eq.0,difficulty.is.null)"
    
    res = requests.get(url, headers=headers)
    if res.status_code != 200:
        print(f"Gagal mengambil resep dari database: {res.status_code} {res.text}", flush=True)
        sys.exit(1)
        
    recipes_to_update = res.json()
    print(f"Ditemukan {len(recipes_to_update)} resep di database yang memerlukan pembaruan.", flush=True)
    
    recipes_to_process = [r for r in recipes_to_update if r["id"] not in completed_ids]
    
    if not recipes_to_process:
        print("Semua resep sudah lengkap dan diproses!", flush=True)
        return

    # DeepSeek API Configuration (dari database)
    api_key = "sk-7cf886d503e64ad090a5ca18bea1a973"
    api_url = "https://api.deepseek.com/chat/completions"
    model = "deepseek-v4-pro"
    
    print("\nMemulai proses estimasi & pembersihan instruksi menggunakan DeepSeek V4 Pro...", flush=True)
    for idx, recipe in enumerate(recipes_to_process):
        r_id = recipe["id"]
        title = recipe["title"]
        cleaned = clean_title(title)
        
        excel_row = excel_map.get(cleaned)
        
        ingredients = ""
        steps = ""
        
        if excel_row is not None:
            ingredients = str(excel_row.get("Ingredients", ""))
            steps = str(excel_row.get("Steps", ""))
            print(f"[{idx+1}/{len(recipes_to_process)}] Cocok di Excel: '{title}'", flush=True)
        else:
            ingredients = recipe.get("ingredients_text") or ""
            steps = "  ".join(recipe.get("instructions") or [])
            print(f"[{idx+1}/{len(recipes_to_process)}] Menggunakan data DB (tidak ada di Excel): '{title}'", flush=True)
            
        steps_clean = steps.replace("\n", " ").strip()
        
        prompt = f"""Anda adalah koki profesional dan ahli gizi Indonesia. Lengkapi data resep berikut. Pecah bagian "Langkah" yang masih berupa satu paragraf panjang atau gabungan langkah menjadi beberapa langkah berurutan (array of strings) yang terpisah, logis, dan mudah diikuti (hilangkan penomoran manual seperti "1) " atau "Langkah 1" di dalam string langkahnya).
Selain itu, berikan estimasi kalori (total per resep porsi 2), waktu memasak (dalam menit), dan tingkat kesulitan (easy, medium, hard).

Judul: {title}
Bahan: {ingredients}
Langkah: {steps_clean}

Kembalikan respon HANYA dalam format JSON valid berikut tanpa penjelasan tambahan, tanpa markdown code block:
{{
  "calories": 250,
  "ready_in_minutes": 35,
  "difficulty": "easy",
  "instructions": [
    "Tumis bawang putih dan bawang merah hingga harum.",
    "Masukkan campuran sayuran beku, garam, gula, dan merica bubuk.",
    "Tambahkan sedikit air, lalu masak hingga airnya surut dan sayuran matang.",
    "Masukkan daun bawang dan telur, lalu langsung acak-acak bersama sayurannya.",
    "Masak sampai telur matang, kemudian angkat dan sajikan."
  ]
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
                        "temperature": 0.2
                    },
                    timeout=120
                )
                
                if response.status_code == 200:
                    res_data = response.json()
                    content = res_data["choices"][0]["message"]["content"].strip()
                    
                    if content.startswith("```"):
                        content = re.sub(r'^```json\s*', '', content, flags=re.I)
                        content = re.sub(r'```$', '', content).strip()
                        
                    parsed = json.loads(content)
                    calories = int(parsed.get("calories", 0))
                    ready_in_minutes = int(parsed.get("ready_in_minutes", 0))
                    difficulty = parsed.get("difficulty", "easy")
                    instructions_list = parsed.get("instructions", [])
                    
                    if difficulty not in ["easy", "medium", "hard"]:
                        difficulty = "easy"
                        
                    if not isinstance(instructions_list, list) or len(instructions_list) == 0:
                        # Fallback jika instruksi tidak berbentuk list
                        instructions_list = [steps_clean]
                        
                    pg_array = to_postgres_array(instructions_list)
                    sql = f"UPDATE public.recipes SET calories = {calories}, ready_in_minutes = {ready_in_minutes}, difficulty = '{difficulty}', instructions = {pg_array} WHERE id = {r_id};"
                    
                    with open(output_file, "a", encoding="utf-8") as out_f:
                        out_f.write(sql + "\n")
                        out_f.flush()
                        
                    print(f"  -> Sukses: Kalori {calories} kcal, Waktu {ready_in_minutes} m, Kesulitan '{difficulty}', {len(instructions_list)} langkah.", flush=True)
                    success = True
                else:
                    print(f"  -> Gagal (HTTP {response.status_code}): {response.text}", flush=True)
                    retries -= 1
                    time.sleep(2)
            except Exception as e:
                print(f"  -> Error: {str(e)}", flush=True)
                retries -= 1
                time.sleep(2)
                
        time.sleep(1)
        
    print("\nProses selesai!", flush=True)

if __name__ == "__main__":
    main()
