import pandas as pd
import os
import json
import re

def analyze_finances():
    base_path = r'c:\Users\PC\Desktop\ks'
    files = [f for f in os.listdir(base_path) if f.endswith(('.xlsx', '.xls'))]
    
    all_transactions = []
    rules = {
        '수입': ['급여', '월급', '상여', '입금', '월차수당', '재직자', '신한', 'Z', 'ŷ', ''],
        '고정비_항목': {
            '대출이자': ['대출이자', '원리금'],
            '월세': ['월세', '임대료'],
            '자동이체': ['자동이체'],
            '주택청약': ['주택청약', '청약제외'],
            '재직자공채': ['재직자공채', '공채'],
            '전기요금': ['전기요금', '한국전력'],
            '도시가스': ['도시가스', '가스요금'],
            '수도요금': ['수도요금', '수도료'],
            '통신비': ['LG U+', 'SKT', 'KT', '통신', '휴대폰', 'LG U플러스'],
            '보험': ['보험', '삼성화재', 'DB손해'],
            '교통비': ['교통', '지하철', '버스', '택시', '후불교통'],
            '저축': ['적금', '저축', '예금']
        },
        '변동비_카테고리': {
            '식비': ['식당', '배달', '카페', '마트', '편의점', '식재료', '쿠팡이츠', '배달의민족', '스타벅스', 'GS25', 'CU', '지에스25', '씨유', '버거킹', '맥도날드'],
            '쇼핑': ['쿠팡', '네이버페이', '지마켓', '무신사', '백화점', '의류', '택배', 'Apple'],
            '생활/미용': ['다이소', '약국', '병원', '생활용품', '헤어', '미용실', '올리브영'],
            '여가/여행': ['영화', '유튜브', '넷플릭스', '게임', '취미', '야놀자', '숙박', '여행', '강원랜드', 'SOOP'],
            '기타': []
        }
    }

    monthly_stats = {} 

    for file in files:
        file_path = os.path.join(base_path, file)
        try:
            if file.endswith('.xls'):
                df = pd.read_excel(file_path, engine='xlrd')
            else:
                df = pd.read_excel(file_path, engine='openpyxl')
            
            df = df.fillna('')
            
            # 파일명으로 은행 판별
            bank_type = "unknown"
            header_row = 0
            
            if '신한은행' in file:
                bank_type = "shinhan"
                header_row = 5
            elif 'KB' in file:
                bank_type = "kb"
                header_row = 2
            elif '우리' in file:
                bank_type = "woori"
                header_row = 0
            elif '이용대금명세서' in file:
                bank_type = "card"
                header_row = 3
            else:
                # 파일명으로 안될 경우 예전 방식 병행
                for idx, row in df.iterrows():
                    row_str = ' '.join([str(v) for v in row.values])
                    if any(kw in row_str for kw in ['날짜', '거래일', '내용', '금액']):
                        header_row = idx
                        break

            for i in range(header_row + 1, len(df)):
                row_vals = [str(v).strip() for v in df.iloc[i].values]
                if not any(v for v in row_vals if v.lower() != 'nan' and v != ''): continue
                
                date = ""
                income_val = 0
                expense_val = 0
                merchant = ""
                
                try:
                    if bank_type == "shinhan":
                        date_raw = row_vals[0]
                        expense_val = int(float(row_vals[3])) if row_vals[3] and row_vals[3] != '0' else 0
                        income_val = int(float(row_vals[4])) if row_vals[4] and row_vals[4] != '0' else 0
                        merchant = row_vals[5]
                        m_match = re.search(r'(\d{2,4})[-.](\d{2})[-.](\d{2})', date_raw)
                        if m_match: date = f"{m_match.group(2)}.{m_match.group(3)}"
                    
                    elif bank_type == "kb":
                        date_raw = row_vals[0]
                        expense_val = int(float(row_vals[4])) if row_vals[4] and row_vals[4] != '0' else 0
                        income_val = int(float(row_vals[5])) if row_vals[5] and row_vals[5] != '0' else 0
                        merchant = row_vals[2] if row_vals[2] and row_vals[2] != 'nan' else row_vals[3]
                        m_match = re.search(r'(\d{4})-(\d{2})-(\d{2})', date_raw)
                        if not m_match: m_match = re.search(r'(\d{2,4})[-.](\d{2})[-.](\d{2})', date_raw)
                        if m_match: date = f"{m_match.group(2)}.{m_match.group(3)}"
                    
                    elif bank_type == "woori":
                        date = row_vals[0]
                        expense_val = int(str(row_vals[5]).replace(',', '').split('.')[0]) if row_vals[5] else 0
                        merchant = row_vals[4]
                    
                    elif bank_type == "card" or bank_type == "unknown":
                        date = row_vals[0]
                        # 금액 필드 자동 찾기
                        nums = []
                        for v in row_vals[1:]:
                            clean = v.replace(',', '').split('.')[0].replace('-', '')
                            if clean.isdigit() and 100 < int(clean) < 10000000:
                                nums.append(int(clean))
                        expense_val = nums[0] if nums else 0
                        merchant = row_vals[4] if len(row_vals) > 4 else ""
                except: continue

                if not date or (income_val == 0 and expense_val == 0): continue
                
                # 월 추출
                date_parts = date.split('.')
                if len(date_parts) >= 2:
                    month = date_parts[0][-2:]
                else: continue
                
                if month not in monthly_stats:
                    monthly_stats[month] = {'income': 0, 'fixed': {}}
                
                row_str = " ".join(row_vals)

                # 1. 수입 처리 (사용자 지정 규칙 반영)
                if income_val > 0:
                    # 제외 대상: 조태욱 (계좌 간 이동)
                    if '조태욱' in row_str or '조태욱' in merchant or 'ŷ' in row_str: # 깨진 문자열 포함 가능성 대비
                        continue
                        
                    # 수입 인정 대상: '급여' 키워드 포함 또는 '조진선' 입금
                    is_real_income = False
                    if any(kw in row_str or kw in merchant for kw in ['급여', '월급', '상여', '월차수당']):
                        is_real_income = True
                    elif '조진선' in row_str or '조진선' in merchant:
                        is_real_income = True
                        
                    if is_real_income:
                        monthly_stats[month]['income'] += income_val
                        print(f"INFO: Detected Real Income {income_val} in {month} from {file} ({merchant})")
                        # 수입 내역도 달력/목록에 표시
                        all_transactions.append({
                            'date': date,
                            'merchant': merchant[:15] or "입금",
                            'amount': income_val,
                            'category': '수입',
                            'source': file
                        })
                    continue

                if expense_val > 0:
                    if expense_val > 50000000: continue # 노이즈 제거
                    
                    is_fixed = False
                    for item_name, keywords in rules['고정비_항목'].items():
                        if any(kw in row_str or kw in merchant for kw in keywords):
                            monthly_stats[month]['fixed'][item_name] = monthly_stats[month]['fixed'].get(item_name, 0) + expense_val
                            is_fixed = True
                            break
                    
                    if is_fixed: continue

                    cat = '기타'
                    for c, keywords in rules['변동비_카테고리'].items():
                        if any(kw.lower() in merchant.lower() or kw.lower() in row_str.lower() for kw in keywords):
                            cat = c
                            break
                    
                    all_transactions.append({
                        'date': date,
                        'merchant': merchant[:15],
                        'amount': expense_val,
                        'category': cat,
                        'source': file
                    })

        except Exception as e:
            print(f"Error processing {file}: {e}")

    # 최종 취합
    months_with_income = [m for m in sorted(monthly_stats.keys()) if monthly_stats[m]['income'] > 0]
    rep_month = months_with_income[-1] if months_with_income else '03'
    actual_income = monthly_stats.get(rep_month, {}).get('income', 2670000)

    # ... 고정비 및 unique_tx 로직 동일 ...
    default_fixed = [
        {'name': '대출이자', 'amount': 120000, 'category': '고정비'},
        {'name': '월세', 'amount': 210000, 'category': '고정비'},
        {'name': '자동이체', 'amount': 50000, 'category': '고정비'},
        {'name': '주택청약', 'amount': 20000, 'category': '고정비'},
        {'name': '재직자공채', 'amount': 500000, 'category': '저축'},
        {'name': '전기요금', 'amount': 21110, 'category': '통신/보험/공과금'},
        {'name': '도시가스', 'amount': 53240, 'category': '통신/보험/공과금'},
        {'name': '수도요금', 'amount': 10660, 'category': '통신/보험/공과금'},
        {'name': '통신비', 'amount': 93000, 'category': '통신/보험/공과금'},
        {'name': '교통비', 'amount': 50000, 'category': '교통'},
        {'name': '구독', 'amount': 50000, 'category': '여가/여행'}
    ]

    final_fixed = []
    for item in default_fixed:
        actual_val = monthly_stats.get(rep_month, {}).get('fixed', {}).get(item['name'])
        final_fixed.append({
            'name': item['name'],
            'amount': actual_val if actual_val else item['amount'],
            'category': item['category']
        })

    unique_tx = []
    seen = set()
    for tx in all_transactions:
        id_str = f"{tx['date']}_{tx['merchant']}_{tx['amount']}"
        if id_str not in seen:
            unique_tx.append(tx)
            seen.add(id_str)

    result = {
        'income': actual_income,
        'fixed_expenses': final_fixed,
        'variable_transactions': unique_tx,
        'monthly_stats': monthly_stats
    }

    with open(os.path.join(base_path, 'finances.json'), 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=4)

    html_path = os.path.join(base_path, 'dashboard.html')
    if os.path.exists(html_path):
        with open(html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        data_script = f"\n    <script id='finance-data' type='application/json'>{json.dumps(result, ensure_ascii=False, indent=4)}</script>\n"
        html_content = re.sub(r"<script id='finance-data'.*?</script>", data_script, html_content, flags=re.DOTALL)
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

    print(f"분석 완료: {rep_month}월 기준 (대표 수입: {actual_income}원).")

if __name__ == "__main__":
    analyze_finances()
