import os

def chunk_sql():
    source_file = "supabase/migrations/20260703160000_recalibrate_recipe_ingredients.sql"
    output_dir = "scratch"
    os.makedirs(output_dir, exist_ok=True)
    
    with open(source_file, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    # Ambil baris UPDATE saja
    updates = [line.strip() for line in lines if line.strip().startswith("UPDATE ")]
    print(f"Total update statements: {len(updates)}")
    
    chunk_size = 500
    num_chunks = (len(updates) + chunk_size - 1) // chunk_size
    
    for i in range(num_chunks):
        chunk_updates = updates[i*chunk_size : (i+1)*chunk_size]
        chunk_file = os.path.join(output_dir, f"chunk_{i+1}.sql")
        with open(chunk_file, "w", encoding="utf-8") as out:
            out.write("BEGIN;\n")
            for up in chunk_updates:
                out.write(up + "\n")
            out.write("COMMIT;\n")
        print(f"Wrote chunk {i+1} to {chunk_file} with {len(chunk_updates)} lines.")

if __name__ == "__main__":
    chunk_sql()
