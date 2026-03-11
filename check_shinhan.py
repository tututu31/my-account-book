import pandas as pd
import os

def check_shinhan_income(file_path):
    print(f"Analyzing: {file_path}")
    try:
        df = pd.read_excel(file_path, engine='xlrd')
        for idx, row in df.iterrows():
            row_vals = [str(v) for v in row.values]
            row_str = " ".join(row_vals)
            # Look for large numbers or keywords
            for v in row.values:
                try:
                    num = float(v)
                    if num > 1000000:
                        print(f"Found large amount {num} at row {idx}: {row_vals}")
                except: pass
            
            # Print any row that might be income
            if '입금' in row_str or 'Ա' in row_str or '수입' in row_str:
                print(f"Potential income row {idx}: {row_vals}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_shinhan_income(r'c:\Users\PC\Desktop\ks\신한은행_거래내역조회_20260310154907.xls')
    check_shinhan_income(r'c:\Users\PC\Desktop\ks\신한은행_거래내역조회_20260310154941.xls')
