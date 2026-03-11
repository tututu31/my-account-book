import pandas as pd
import os

def analyze_columns(base_path):
    files = [f for f in os.listdir(base_path) if f.endswith(('.xlsx', '.xls'))]
    for file in files:
        file_path = os.path.join(base_path, file)
        print(f"\n--- Analyzing: {file} ---")
        try:
            if file.endswith('.xls'):
                df = pd.read_excel(file_path, engine='xlrd')
            else:
                df = pd.read_excel(file_path, engine='openpyxl')
            
            # Find the header row (the one containing '날짜', '내용', '금액' or similar)
            header_idx = -1
            for idx, row in df.iterrows():
                row_str = ' '.join([str(v) for v in row.values])
                if any(kw in row_str for kw in ['날짜', '거래일', '내용', '금액', '입금', '출금']):
                    header_idx = idx
                    print(f"Found header at row {idx}: {row.values.tolist()}")
                    break
            
            if header_idx != -1:
                print("First 3 data rows after header:")
                for i in range(header_idx + 1, min(header_idx + 4, len(df))):
                    print(df.iloc[i].values.tolist())
            else:
                print("No clear header found. First 5 rows:")
                print(df.head(5))
                
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    analyze_columns(r'c:\Users\PC\Desktop\ks')
