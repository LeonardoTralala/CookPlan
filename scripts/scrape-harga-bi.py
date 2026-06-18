"""
Scraper harga bahan pangan dari PIHPS Bank Indonesia.
Endpoint: https://www.bi.go.id/hargapangan/WebSite/TabelHarga/GetGridDataKomoditas

Output: scripts/output/harga_bi_pihps.csv

Jalankan:
    pip install requests
    python scripts/scrape-harga-bi.py
"""

import requests
import csv
import json
import time
from datetime import date, timedelta
from pathlib import Path

# Mapping cat_id -> nama komoditas (hasil reverse-engineer dari endpoint)
KOMODITAS = {
    "cat_1":  "Beras Medium",
    "cat_2":  "Beras Kualitas Bawah",
    "cat_3":  "Beras Kualitas Super",
    "cat_4":  "Bawang Merah",
    "cat_5":  "Bawang Putih",
    "cat_6":  "Cabai Merah",
    "cat_7":  "Daging Ayam Ras",
    "cat_8":  "Daging Sapi Kualitas 1",
    "cat_9":  "Gula Pasir",
    "cat_10": "Telur Ayam Ras",
    "cat_11": "Cabai Rawit",
    "cat_12": "Minyak Goreng",
    "cat_13": "Ikan Bandeng",
    "cat_14": "Ikan Kembung",
    "cat_15": "Ikan Tongkol/Tuna",
}

BASE_URL = "https://www.bi.go.id/hargapangan/WebSite/TabelHarga/GetGridDataKomoditas"

def fetch_harga(cat_id: str, start: str, end: str) -> dict | None:
    """Fetch harga nasional (Semua Provinsi, level 0) untuk satu komoditas."""
    params = {
        "price_type_id": 1,       # 1 = pasar tradisional
        "comcat_id": cat_id,
        "province_id": "",
        "regency_id": "",
        "showKota": "false",
        "showPasar": "false",
        "tipe_laporan": 1,
        "start_date": start,
        "end_date": end,
        "_": "1781744556907",     # timestamp cache-bust, boleh tetap
    }

    headers = {
        "Referer": "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalKomoditas",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "X-Requested-With": "XMLHttpRequest",
    }

    try:
        resp = requests.get(BASE_URL, params=params, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json().get("data", [])
    except Exception as e:
        print(f"  ERROR {cat_id}: {e}")
        return None

    # Ambil baris level 0 = agregat nasional "Semua Provinsi"
    nasional = next((row for row in data if row.get("level") == 0), None)
    return nasional


def parse_harga(nasional: dict, end_date: str) -> int | None:
    """Ambil harga terakhir yang valid (bukan '-') dari baris nasional."""
    if not nasional:
        return None
    # Coba dari tanggal terbaru ke terlama
    for key, val in reversed(list(nasional.items())):
        if key in ("no", "name", "level"):
            continue
        val_clean = str(val).replace(",", "").replace(".", "").strip()
        if val_clean and val_clean != "-":
            try:
                return int(val_clean)
            except ValueError:
                continue
    return None


def main():
    today = date.today()
    start = (today - timedelta(days=14)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")

    print(f"Periode: {start} s/d {end}")
    print(f"Fetching {len(KOMODITAS)} komoditas dari BI PIHPS...\n")

    output_dir = Path("scripts/output")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "harga_bi_pihps.csv"

    results = []

    for cat_id, nama in KOMODITAS.items():
        print(f"  {cat_id:7s} {nama}...", end=" ", flush=True)
        nasional = fetch_harga(cat_id, start, end)
        harga = parse_harga(nasional, end)

        if harga:
            print(f"Rp {harga:,}/kg")
            results.append({
                "cat_id": cat_id,
                "nama": nama,
                "harga_per_kg": harga,
                "satuan": "kg",
                "sumber": "BI PIHPS",
                "tanggal": end,
            })
        else:
            print("tidak ada data")

        time.sleep(0.5)  # jangan flood server

    # Simpan ke CSV
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["cat_id", "nama", "harga_per_kg", "satuan", "sumber", "tanggal"])
        writer.writeheader()
        writer.writerows(results)

    print(f"\nSelesai! {len(results)}/{len(KOMODITAS)} komoditas berhasil.")
    print(f"Output: {output_path.resolve()}")

    # Tampilkan juga sebagai tabel ringkas
    print("\n--- HASIL ---")
    for r in results:
        per_100g = r["harga_per_kg"] // 10
        print(f"  {r['nama']:30s} Rp {r['harga_per_kg']:>7,}/kg  (~Rp {per_100g:>5,}/100g)")


if __name__ == "__main__":
    main()
