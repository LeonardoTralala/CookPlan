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
    url = f"{env['VITE_SUPABASE_URL']}/rest/v1/ingredients?limit=1"
    headers = {
        "apikey": env['VITE_SUPABASE_ANON_KEY'],
        "Authorization": f"Bearer {env['VITE_SUPABASE_ANON_KEY']}"
    }
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        data = r.json()
        if data:
            print("Columns and values:", data[0])
        else:
            print("No data found.")
    else:
        print("Error:", r.status_code, r.text)

if __name__ == "__main__":
    main()
