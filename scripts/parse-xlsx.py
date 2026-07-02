import pandas as pd

def main():
    file_path = "Database resep.xlsx"
    print("Loading Excel file...")
    
    # Load Excel file
    xls = pd.ExcelFile(file_path)
    print(f"Sheet names: {xls.sheet_names}")
    
    for sheet_name in xls.sheet_names:
        print(f"\n--- Sheet: {sheet_name} ---")
        df = pd.read_excel(xls, sheet_name=sheet_name, nrows=5)
        print("Columns:")
        print(df.columns.tolist())
        print("\nFirst 2 rows:")
        print(df.head(2).to_string())

if __name__ == "__main__":
    main()
