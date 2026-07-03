import os
import requests
import json

def test():
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    api_url = "https://api.deepseek.com/chat/completions"
    model = "deepseek-v4-pro"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    data = {
        "model": model,
        "messages": [
            {"role": "user", "content": "Say hello in Indonesian"}
        ],
        "temperature": 0.1,
        "max_tokens": 10
    }
    
    print("Testing DeepSeek connection...")
    try:
        response = requests.post(api_url, headers=headers, json=data, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
