import os
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
    env = load_env()
    url = f"{env['VITE_SUPABASE_URL']}/rest/v1/ingredients?select=id,name"
    headers = {
        "apikey": env['VITE_SUPABASE_ANON_KEY'],
        "Authorization": f"Bearer {env['VITE_SUPABASE_ANON_KEY']}"
    }
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        names = sorted([f"{x['id']}: {x['name']}" for x in r.json()])
        with open("master_ingredients.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(names))
        print("Success! Written to master_ingredients.txt")
    else:
        print("Error:", r.status_code, r.text)

if __name__ == "__main__":
    main()
