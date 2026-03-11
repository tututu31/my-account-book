import pandas as pd
import os

def debug_xls(file_path):
    print(f"Checking file: {file_path}")
    try:
        # Try reading with xlrd (standard XLS)
        df = pd.read_excel(file_path, engine='xlrd')
        print("Successfully read with xlrd")
        print("Columns:", df.columns.tolist())
        print("Full Content (First 10 rows):")
        print(df.head(10))
    except Exception as e:
        print(f"Failed with xlrd: {e}")
        try:
            # Maybe it's an HTML table?
            dfs = pd.read_html(file_path)
            print("Successfully read with read_html")
            print(f"Found {len(dfs)} tables")
            for i, d in enumerate(dfs):
                print(f"Table {i}:")
                print(d.head(10))
        except Exception as e2:
            print(f"Failed with read_html: {e2}")
            # Just read as text to see what it is
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                print("First 200 chars:")
                print(f.read(200))

if __name__ == "__main__":
    debug_xls(r'c:\Users\PC\Desktop\ks\신한은행_거래내역조회_20260310154907.xls')
