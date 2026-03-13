/**
 * LedgerBot Main Application Logic
 */

// --- Global State ---
let GEMINI_API_KEY = localStorage.getItem('geminiApiKey') || '';
let GAS_WEB_APP_URL = localStorage.getItem('gasUrl') || 'https://script.google.com/macros/s/AKfycbxHHIBh4O00Xpxw-Hdgzp1_0ze5AGWHOvpoj_ur4scq79gPVSMyL-6F8faaIb0TXtgT/exec';

let fullData = JSON.parse(document.getElementById('finance-data').textContent);
let manualData = JSON.parse(localStorage.getItem('manualFinances') || '[]');
let userSettings = JSON.parse(localStorage.getItem('userSettings_v4') || localStorage.getItem('userSettings_v3') || localStorage.getItem('userSettings') || '{}');

let tempExcelData = null; // 엑셀 매핑용 임시 데이터
let tempExcelFilename = "";
let mappingPresets = JSON.parse(localStorage.getItem('mappingPresets') || '{}');

const SYSTEM_PRESETS = {
    'SYSTEM_SHINHAN_CARD': {
        name: '신한카드 명세서 (표준)',
        findHeader: '이용일자',
        colDate: '0', 
        colMerchant: '2', 
        colAmount: '3',
        colCategory: '',
        colType: ''
    }
};

const defaultSettings = {
    budgets: { "식비": 600000, "교통": 150000, "쇼핑": 200000, "생활_미용": 100000, "통신_보험_공과금": 300000, "기타": 100000 },
    fixedExpenses: [],
    customCategories: [],
    aiModels: ['gemini-1.5-flash', 'gemini-1.5-pro']
};

userSettings = { ...defaultSettings, ...userSettings };
if (!userSettings.aiModels || userSettings.aiModels.length === 0) userSettings.aiModels = [...defaultSettings.aiModels];
if (!userSettings.customCategories) userSettings.customCategories = [];
if (!userSettings.budgets) userSettings.budgets = { ...defaultSettings.budgets };
if (!userSettings.fixedExpenses) userSettings.fixedExpenses = [];

let categoryChart, trendChart;
const defaultCategories = ['식비', '교통', '쇼핑', '생활/미용', '여가/여행', '통신/보험/공과금', '기타'];

function getAllCategories() {
    return [...defaultCategories, ...userSettings.customCategories];
}

// --- Persistence ---
function saveToLocal() {
    localStorage.setItem('finance_data_v4', JSON.stringify(fullData));
    localStorage.setItem('manualFinances', JSON.stringify(manualData));
    const dataTag = document.getElementById('finance-data');
    if (dataTag) dataTag.textContent = JSON.stringify(fullData);
}

function saveSettings() {
    localStorage.setItem('userSettings_v4', JSON.stringify(userSettings));
}

// --- Initialization ---
function init() {
    const savedData = localStorage.getItem('finance_data_v4');
    const savedManual = localStorage.getItem('manualFinances');
    if (savedData) fullData = JSON.parse(savedData);
    if (savedManual) manualData = JSON.parse(savedManual);

    if (typeof initTrendChart === 'function') initTrendChart();
    if (typeof renderManualList === 'function') renderManualList();
    if (typeof renderSettings === 'function') renderSettings();
    if (typeof updateByMonth === 'function') updateByMonth();

    const today = new Date();
    const mDateInput = document.getElementById('m-date');
    if (mDateInput) mDateInput.value = today.toISOString().split('T')[0];

    document.querySelectorAll('.tab-content').forEach(tc => {
        if (!tc.classList.contains('active')) tc.style.display = 'none';
    });

    if (typeof initGlobalHandlers === 'function') initGlobalHandlers();
    initPasteHandler();

    if (GAS_WEB_APP_URL) {
        const urlInput = document.getElementById('gas-url-input');
        if(urlInput) urlInput.value = GAS_WEB_APP_URL;
    }

    setTimeout(() => {
        if (typeof fetchDataFromSheet === 'function' && GAS_WEB_APP_URL) {
            fetchDataFromSheet(true); 
        }
    }, 1500);
}

// --- Data Operations ---
function addManualEntry() {
    const dateVal = document.getElementById('m-date').value;
    const typeVal = document.getElementById('m-type').value;
    const merchantVal = document.getElementById('m-merchant').value;
    const amountVal = parseInt(document.getElementById('m-amount').value);
    const categoryVal = document.getElementById('m-category').value;
    const installmentMonths = parseInt(document.getElementById('m-installment').value) || 1;
    const interestRate = parseFloat(document.getElementById('m-interest').value) || 0;

    if (!dateVal || !merchantVal || isNaN(amountVal)) {
        alert('모든 필드를 올바르게 입력해주세요.');
        return;
    }

    if (installmentMonths > 1) {
        processInstallment({
            date: dateVal.split('-').slice(1).join('.'), // YYYY-MM-DD -> MM.DD
            type: typeVal,
            merchant: merchantVal,
            amount: amountVal,
            category: categoryVal,
            installmentMonths,
            interestRate
        });
        showToast('🕒 할부 내역이 생성되었습니다.');
    } else {
        const dateParts = dateVal.split('-');
        const newEntry = {
            id: Date.now(),
            date: `${dateParts[1]}.${dateParts[2]}`,
            yearMonth: `${dateParts[0]}.${dateParts[1]}`,
            fullDate: dateVal,
            type: typeVal,
            merchant: merchantVal,
            amount: amountVal,
            category: categoryVal,
            source: '수동입력'
        };

        manualData.push(newEntry);
        saveToLocal();
        refreshAll();
        if (typeof sendToSheet === 'function') sendToSheet('insert', newEntry);
        showToast('✅ 내역이 추가되었습니다.');
    }

    document.getElementById('m-merchant').value = '';
    document.getElementById('m-amount').value = '';
    document.getElementById('m-installment').value = '1';
    document.getElementById('m-interest').value = '0';
}

function deleteManualEntry(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    manualData = manualData.filter(m => m.id !== id);
    saveToLocal();
    refreshAll();
    if (typeof sendToSheet === 'function') sendToSheet('delete', id);
    showToast('🗑️ 삭제되었습니다.');
}

function deleteTx(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    let found = false;
    const initialLen = fullData.variable_transactions.length;
    fullData.variable_transactions = fullData.variable_transactions.filter(t => t.id != id);
    if (fullData.variable_transactions.length !== initialLen) found = true;

    if (!found) {
        const initialManualLen = manualData.length;
        manualData = manualData.filter(m => m.id != id);
        if (manualData.length !== initialManualLen) found = true;
    }

    if (found) {
        saveToLocal();
        refreshAll();
        if (typeof sendToSheet === 'function') sendToSheet('delete', id);
        showToast('🗑️ 삭제되었습니다.');
    }
}

function startEditTx(id, btn) {
    const tr = document.getElementById(`row-${id}`);
    const raw = JSON.parse(tr.dataset.rawJson);

    const tdDate = tr.querySelector('.tx-date');
    const tdMerchant = tr.querySelector('.tx-merchant');
    const tdAmount = tr.querySelector('.tx-amount');
    const tdCategory = tr.querySelector('.tx-category');
    const tdAction = btn.parentElement;

    tdDate.innerHTML = `<input type="text" class="edit-input" style="width:60px; padding:2px; color:black;" value="${raw.date}">`;
    tdMerchant.innerHTML = `<input type="text" class="edit-input" style="width:100px; padding:2px; color:black;" value="${raw.merchant}">`;
    tdAmount.innerHTML = `<input type="number" class="edit-input" style="width:80px; padding:2px; color:black;" value="${raw.amount}">`;
    tdCategory.innerHTML = `<input type="text" class="edit-input" style="width:80px; padding:2px; color:black;" value="${raw.category}">`;

    tdAction.innerHTML = `
        <button onclick="saveEditTx('${id}', this)" style="background:none; border:none; color:var(--success); cursor:pointer; margin-right:8px;">저장</button>
        <button onclick="updateByMonth()" style="background:none; border:none; color:var(--text-secondary); cursor:pointer;">취소</button>
    `;
}

function saveEditTx(id, btn) {
    const tr = document.getElementById(`row-${id}`);
    const inputs = tr.querySelectorAll('.edit-input');
    const newDate = inputs[0].value.trim();
    const newMerchant = inputs[1].value.trim();
    const newAmount = parseInt(inputs[2].value.trim()) || 0;
    const newCategory = inputs[3].value.trim() || '기타';
    
    let target = fullData.variable_transactions.find(t => t.id == id);
    let isManual = false;
    if (!target) {
        target = manualData.find(t => t.id == id);
        isManual = true;
    }

    if (target) {
        target.date = newDate;
        target.merchant = newMerchant;
        target.amount = newAmount;
        target.category = newCategory;
        if (newCategory === '수입') target.type = 'income'; 
        else if (target.type === 'income') target.category = '수입';

        saveToLocal();
        refreshAll();
        if (typeof sendToSheet === 'function') sendToSheet('update', target);
        showToast('✅ 수정되었습니다.');
    }
}

function refreshAll() {
    if (typeof updateByMonth === 'function') updateByMonth();
    if (typeof renderManualList === 'function') renderManualList();
    if (typeof initTrendChart === 'function') initTrendChart();
}

// Settings updates
function updateBudget(cat, val) {
    userSettings.budgets[cat] = parseInt(val) || 0;
    saveSettings();
    if (typeof updateByMonth === 'function') updateByMonth();
}

function addFixedExpense() {
    const name = document.getElementById('f-name').value;
    const amount = parseInt(document.getElementById('f-amount').value);
    if (!name || isNaN(amount)) return alert('올바른 값을 입력하세요.');

    userSettings.fixedExpenses.push({ name, amount, category: '고정비' });
    saveSettings();
    if (typeof renderSettings === 'function') renderSettings();
    if (typeof updateByMonth === 'function') updateByMonth();
    document.getElementById('f-name').value = '';
    document.getElementById('f-amount').value = '';
}

function deleteFixedExpense(idx) {
    userSettings.fixedExpenses.splice(idx, 1);
    saveSettings();
    if (typeof renderSettings === 'function') renderSettings();
    if (typeof updateByMonth === 'function') updateByMonth();
}

function addCustomCategory() {
    const nameInput = document.getElementById('c-name');
    const name = nameInput.value.trim();
    if(!name) return;
    if(getAllCategories().includes(name)) return alert('이미 존재하는 카테고리입니다.');
    
    userSettings.customCategories.push(name);
    const safeName = name.replace(/\//g, '_');
    if(userSettings.budgets[safeName] === undefined) userSettings.budgets[safeName] = 0;

    saveSettings();
    if (typeof renderSettings === 'function') renderSettings();
    nameInput.value = '';
}

function deleteCustomCategory(idx) {
    const name = userSettings.customCategories[idx];
    if(confirm(`'${name}' 카테고리를 삭제하시겠습니까?`)) {
        userSettings.customCategories.splice(idx, 1);
        const safeName = name.replace(/\//g, '_');
        delete userSettings.budgets[safeName];
        saveSettings();
        if (typeof renderSettings === 'function') renderSettings();
    }
}

function addAiModel() {
    const input = document.getElementById('ai-model-input');
    const modelName = input.value.trim();
    if(!modelName) return;
    if(userSettings.aiModels.includes(modelName)) return alert('이미 등록된 모델입니다.');
    
    userSettings.aiModels.push(modelName);
    saveSettings();
    if (typeof renderAiModels === 'function') renderAiModels();
    input.value = '';
}

function deleteAiModel(idx) {
    if(userSettings.aiModels.length <= 1) return alert('최소 한 개의 모델은 등록되어 있어야 합니다.');
    if(confirm('이 모델을 삭제하시겠습니까?')) {
        userSettings.aiModels.splice(idx, 1);
        saveSettings();
        if (typeof renderAiModels === 'function') renderAiModels();
    }
}

// AI Analysis Handlers
async function handleExcelUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (rows.length < 2) return alert('엑셀 데이터가 너무 적습니다.');
            
            tempExcelData = rows;
            tempExcelFilename = file.name;
            showExcelMappingModal(rows);
        } catch (error) {
            console.error("Excel Read Error:", error);
            alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function showExcelMappingModal(rows, headerIndex = null) {
    const modal = document.getElementById('excel-mapping-modal');
    const table = document.getElementById('excel-preview-table');
    const selectors = ['map-date', 'map-merchant', 'map-amount', 'map-category', 'map-type'];
    const headerInput = document.getElementById('map-header-row');
    
    // 프리셋 드롭다운 채우기
    const presetSelect = document.getElementById('mapping-preset-select');
    if (presetSelect) {
        // 내 프리셋 그룹만 비우고 채우기
        const userGroup = document.getElementById('user-presets-group');
        if (userGroup) {
            userGroup.innerHTML = '';
            Object.keys(mappingPresets).forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.text = name;
                userGroup.appendChild(opt);
            });
        }
    }

    // 헤더 행 결정
    let headerRowIndex = 0;
    if (headerIndex !== null) {
        headerRowIndex = headerIndex;
    } else {
        // 자동 감지: 데이터가 2개 이상 있는 첫 번째 행을 헤더로 추정
        for (let i = 0; i < Math.min(rows.length, 50); i++) {
            if (rows[i] && rows[i].filter(cell => cell !== null && cell !== '').length >= 3) {
                headerRowIndex = i;
                break;
            }
        }
    }
    
    if (headerInput) headerInput.value = headerRowIndex + 1; // 1-based display
    
    const headers = (rows[headerRowIndex] || []).map((h, idx) => h || `Column ${idx + 1}`);
    const maxCols = Math.max(...rows.slice(0, 100).map(r => r ? r.length : 0));
    
    // 셀렉터 채우기
    selectors.forEach(id => {
        const select = document.getElementById(id);
        select.innerHTML = '';
        
        // 기본 옵션 (없음 등) 추가
        if (id === 'map-category' || id === 'map-type') {
            const opt = document.createElement('option');
            opt.value = "";
            opt.text = id === 'map-category' ? "(없음 - AI 자동 분류)" : "(없음 - 기본 지출)";
            select.appendChild(opt);
        } else {
            const opt = document.createElement('option');
            opt.value = "";
            opt.text = "-- 열 선택 --";
            select.appendChild(opt);
        }

        headers.forEach((h, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.text = `${String.fromCharCode(65 + idx)}열: ${h}`;
            select.appendChild(opt);
        });
    });

    // 미리보기 테이블 채우기 (최대 50행 보여줌)
    let html = '<thead><tr style="background: rgba(56, 189, 248, 0.2); color: white;"><th>번호</th>';
    for (let j = 0; j < maxCols; j++) {
        html += `<th>${String.fromCharCode(65 + j)}열</th>`;
    }
    html += '</tr></thead><tbody>';
    
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const isHeader = i === headerRowIndex;
        const style = isHeader ? 'background: rgba(56, 189, 248, 0.3); font-weight: bold; color: yellow;' : '';
        html += `<tr style="${style}"><td>${i + 1}</td>`;
        for (let j = 0; j < maxCols; j++) {
            html += `<td>${rows[i] && rows[i][j] !== undefined ? rows[i][j] : ''}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody>';
    table.innerHTML = html;

    // AI 추천 매핑 (간단한 헤더 키워드 매칭)
    headers.forEach((h, idx) => {
        const text = String(h).toLowerCase();
        if (text.includes('일자') || text.includes('날짜') || text.includes('date')) document.getElementById('map-date').value = idx;
        if (text.includes('내용') || text.includes('가맹점') || text.includes('상호') || text.includes('merchant')) document.getElementById('map-merchant').value = idx;
        if (text.includes('금액') || text.includes('승인금액') || text.includes('거래금액') || text.includes('amount')) document.getElementById('map-amount').value = idx;
        if (text.includes('카테고리') || text.includes('분류') || text.includes('category')) document.getElementById('map-category').value = idx;
        if (text.includes('구분') || text.includes('유형') || text.includes('type')) document.getElementById('map-type').value = idx;
    });

    modal.style.display = 'block';
}

function saveCurrentMappingAsPreset() {
    const nameInput = document.getElementById('new-preset-name');
    const name = nameInput.value.trim();
    if (!name) return alert('프리셋 이름을 입력해주세요.');

    const mapping = {
        colDate: document.getElementById('map-date').value,
        colMerchant: document.getElementById('map-merchant').value,
        colAmount: document.getElementById('map-amount').value,
        colCategory: document.getElementById('map-category').value,
        colType: document.getElementById('map-type').value
    };

    mappingPresets[name] = mapping;
    localStorage.setItem('mappingPresets', JSON.stringify(mappingPresets));
    
    // 드롭다운 갱신
    const presetSelect = document.getElementById('mapping-preset-select');
    const opt = document.createElement('option');
    opt.value = name;
    opt.text = name;
    presetSelect.appendChild(opt);
    presetSelect.value = name;
    
    nameInput.value = '';
    showToast(`⭐ '${name}' 프리셋이 저장되었습니다.`);
}

function loadMappingPreset(name) {
    if (!name) return;
    
    let mapping = null;
    if (name.startsWith('SYSTEM_')) {
        mapping = SYSTEM_PRESETS[name];
        // 시스템 프리셋은 헤더 행도 자동 탐색
        if (mapping.findHeader && tempExcelData) {
            for (let i = 0; i < Math.min(tempExcelData.length, 100); i++) {
                if (tempExcelData[i] && tempExcelData[i].some(cell => String(cell).includes(mapping.findHeader))) {
                    document.getElementById('map-header-row').value = i + 1;
                    updateExcelHeaderRow(i + 1);
                    break;
                }
            }
        }
    } else {
        mapping = mappingPresets[name];
    }
    
    if (!mapping) return;
    
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    
    setVal('map-date', mapping.colDate);
    setVal('map-merchant', mapping.colMerchant);
    setVal('map-amount', mapping.colAmount);
    setVal('map-category', mapping.colCategory || '');
    setVal('map-type', mapping.colType || '');
    
    showToast(`📂 '${mapping.name || name}' 설정을 적용했습니다.`);
}

function deleteMappingPreset() {
    const presetSelect = document.getElementById('mapping-preset-select');
    const name = presetSelect.value;
    if (!name) return alert('삭제할 프리셋을 선택해주세요.');
    
    if (confirm(`'${name}' 프리셋을 삭제하시겠습니까?`)) {
        delete mappingPresets[name];
        localStorage.setItem('mappingPresets', JSON.stringify(mappingPresets));
        presetSelect.remove(presetSelect.selectedIndex);
        presetSelect.value = "";
        showToast('🗑️ 프리셋이 삭제되었습니다.');
    }
}

function updateExcelHeaderRow(rowNum) {
    const idx = parseInt(rowNum) - 1;
    if (isNaN(idx) || idx < 0 || !tempExcelData) return;
    showExcelMappingModal(tempExcelData, idx);
}

async function confirmExcelMapping() {
    const headerIdx = (parseInt(document.getElementById('map-header-row').value) || 1) - 1;
    const colDate = document.getElementById('map-date').value;
    const colMerchant = document.getElementById('map-merchant').value;
    const colAmount = document.getElementById('map-amount').value;
    const colCategory = document.getElementById('map-category').value;
    const colType = document.getElementById('map-type').value;

    if (colDate === "" || colMerchant === "" || colAmount === "") {
        return alert('날짜, 가맹점, 금액 열은 반드시 지정해야 합니다.');
    }

    const btn = document.getElementById('btn-confirm-mapping');
    btn.innerText = '⌛ 처리 중...';
    btn.disabled = true;

    try {
        const rows = tempExcelData;
        const currentYear = new Date().getFullYear();
        let addedItems = [];

        for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const rawDate = row[colDate];
            const rawAmount = String(row[colAmount]).replace(/[^0-9.-]/g, '');
            
            if (!rawDate || !rawAmount || isNaN(parseFloat(rawAmount))) continue;

            let itemDate = { y: currentYear, m: 1, d: 1 };
            let dateParsed = false;

            if (rawDate instanceof Date) {
                itemDate.y = rawDate.getFullYear();
                itemDate.m = rawDate.getMonth() + 1;
                itemDate.d = rawDate.getDate();
                dateParsed = true;
            } else {
                const dateStrRaw = String(rawDate).trim();
                // YYYY.MM.DD 등 긴 형식 우선
                const longMatch = dateStrRaw.match(/(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
                if (longMatch) {
                    itemDate.y = parseInt(longMatch[1]);
                    itemDate.m = parseInt(longMatch[2]);
                    itemDate.d = parseInt(longMatch[3]);
                    dateParsed = true;
                } else {
                    // MM.DD 등 짧은 형식
                    const shortMatch = dateStrRaw.match(/(\d{1,2})[\.\-\/](\d{1,2})/);
                    if (shortMatch) {
                        itemDate.m = parseInt(shortMatch[1]);
                        itemDate.d = parseInt(shortMatch[2]);
                        dateParsed = true;
                    }
                }
            }
            
            if (!dateParsed) continue;

            const mm = String(itemDate.m).padStart(2, '0');
            const dd = String(itemDate.d).padStart(2, '0');
            const dateStr = `${mm}.${dd}`;

            const entry = {
                id: Date.now() + Math.random(),
                date: dateStr,
                yearMonth: `${itemDate.y}.${mm}`,
                fullDate: `${itemDate.y}-${mm}-${dd}`,
                type: (colType !== "" && row[colType]) ? (String(row[colType]).includes('수입') ? 'income' : 'expense') : 'expense',
                merchant: row[colMerchant],
                amount: Math.abs(parseInt(rawAmount)),
                category: (colCategory !== "" && row[colCategory]) ? row[colCategory] : '기타',
                source: `엑셀(${tempExcelFilename})`
            };
            addedItems.push(entry);
        }

        if (addedItems.length > 0) {
            manualData = [...addedItems, ...manualData];
            saveToLocal();
            
            if (typeof sendToSheet === 'function') {
                showToast(`🚀 ${addedItems.length}건을 구글 시트로 업로드합니다...`);
                await sendToSheet('batch_insert', addedItems);
            }
            
            refreshAll();
            closeModal('excel-mapping-modal');
            alert(`✨ 성공! ${addedItems.length}건의 거래 내역을 업로드했습니다.`);
        } else {
            alert('인식된 유효한 거래 내역이 없습니다. 열 선택이 올바른지 확인해주세요.');
        }
    } catch (error) {
        console.error("Confirm Excel Error:", error);
        alert('처리 중 오류가 발생했습니다.');
    } finally {
        btn.innerText = '🚀 최종 업로드 시작';
        btn.disabled = false;
    }
}

async function processExcelData(allRows, filename, showAlerts = true) {
    if (!allRows || allRows.length === 0) return 0;
    if (!GEMINI_API_KEY) {
        if (showAlerts) alert('API Key를 먼저 등록해주세요.');
        return 0;
    }

    try {
        let csvContent = "";
        const maxRows = Math.min(allRows.length, 100);
        for (let i = 0; i < maxRows; i++) {
            const row = allRows[i];
            if (row && row.length > 0 && row.some(cell => cell !== null && cell !== '')) { 
                csvContent += row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(",") + "\n";
            }
        }

        const prompt = `
당신은 가계부 데이터 분석 전문가입니다. 제공된 엑셀(CSV) 데이터를 분석하여 거래 내역을 추출해주세요.

규칙:
1. 결과는 반드시 JSON 배열 형식으로만 응답하세요. (마크다운 백틱 제외)
2. 각 객체는 다음 필드를 가져야 합니다:
   - "date": "MM.DD" 형식 (예: 03.12)
   - "merchant": 가맹점명 또는 거래 내용
   - "amount": 숫자만 (콤마 제외)
   - "type": "expense" (지출) 또는 "income" (수입)
   - "category": [식비, 교통, 쇼핑, 생활/미용, 여가/여행, 통신/보험/공과금, 기타] 중 하나로 분류

CSV 데이터 요약:
${csvContent}
`;
        const result = await callGeminiAPI(prompt);

        if (result && Array.isArray(result)) {
            const currentYear = new Date().getFullYear();
            let addedCount = 0;

            result.forEach(item => {
                if (!item.amount || !item.merchant) return;

                const newEntry = {
                    id: Date.now() + Math.random(),
                    date: item.date || '01.01',
                    yearMonth: `${currentYear}.${(item.date || '01.01').split('.')[0]}`,
                    fullDate: `${currentYear}-${(item.date || '01.01').replace('.', '-')}`,
                    type: item.type || 'expense',
                    merchant: item.merchant,
                    amount: parseInt(item.amount),
                    category: item.type === 'income' ? '수입' : (item.category || '기타'),
                    source: `엑셀(${filename})`
                };

                manualData.push(newEntry);
                addedCount++;
                if (typeof sendToSheet === 'function') sendToSheet('insert', newEntry);
            });

            if (addedCount > 0) {
                localStorage.setItem('manualFinances', JSON.stringify(manualData));
            }
            return addedCount;
        }
        return 0;
    } catch (error) {
        console.error("Excel analysis error:", error);
        return 0;
    }
}

async function handleOCRUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!GEMINI_API_KEY) return alert('API Key를 먼저 등록해주세요.');

    const btn = event.target.previousElementSibling || document.querySelector('button[onclick*="ocr-upload"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) {
        btn.innerText = '⌛ AI 분석 중...';
        btn.disabled = true;
    }

    try {
        const base64Data = await compressImage(file, 1024, 1024, 0.7);
        const prompt = "Extract receipt info as JSON array: [{date, merchant, amount}]. Exclude transactions with '조태욱'.";
        let result = await callGeminiAPI(prompt, base64Data);

        if (!Array.isArray(result)) result = [result];

        let addedItems = [];
        result.forEach(item => {
            if (item.amount > 0 && !(item.merchant || '').includes("조태욱")) {
                const dateVal = item.date || new Date().toISOString().split('T')[0];
                const parts = dateVal.split('-');
                addedItems.push({
                    id: Date.now() + Math.random(),
                    date: `${parts[1]}.${parts[2]}`,
                    yearMonth: `${parts[0]}.${parts[1]}`, 
                    fullDate: dateVal,
                    type: 'expense',
                    merchant: item.merchant || '알 수 없음',
                    amount: item.amount,
                    category: '기타',
                    source: 'AI사진봇',
                    imageBase64: base64Data
                });
            }
        });

        if (addedItems.length > 0) {
            manualData = [...addedItems, ...manualData];
            saveToLocal();
            refreshAll();
            if (typeof sendToSheet === 'function') sendToSheet('batch_insert', addedItems);
            alert(`✨ ${addedItems.length}건을 자동 추가했습니다!`);
        } else {
            alert('인식된 내역이 없습니다.');
        }
    } catch (error) {
        console.error("OCR analysis error:", error);
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
        event.target.value = '';
    }
}

async function parseSmsInput() {
    const smsInput = document.getElementById('sms-input').value.trim();
    if(!smsInput || !GEMINI_API_KEY) return alert('입력값 또는 API Key가 없습니다.');

    const btn = document.getElementById('btn-parse-sms');
    const originalText = btn.innerText;
    btn.innerText = '⌛ AI 분석 중...';
    btn.disabled = true;

    const prompt = `가계부 문자 분석입니다. 다음 텍스트에서 날짜, 가맹점, 금액, 지출/수입 여부, 카테고리, 그리고 '할부 개월(installmentMonths)' 및 '할부 이율(interestRate)' 정보를 추출해서 JSON 객체로 응답해줘. 
        규칙:
        1. 할부 언급이 없으면 installmentMonths는 1, interestRate는 0입니다. "무이자"면 interestRate는 0입니다.
        2. 날짜는 MM.DD 형식(예: 03.12)으로 응답해줘.
        3. 금액은 숫자만 응답해줘.
        형식: { date, merchant, amount, type: "income"|"expense", category, installmentMonths, interestRate }.
        텍스트: "${smsInput}"`;

    try {
        const result = await callGeminiAPI(prompt);
        if (result && result.amount && result.merchant) {
            if (parseInt(result.installmentMonths) > 1) {
                await processInstallment(result);
                showToast('🕒 할부 내역이 생성되었습니다.');
            } else {
                const today = new Date();
                const year = today.getFullYear();
                const newEntry = {
                    id: Date.now(),
                    date: result.date || `${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`,
                    yearMonth: `${year}.${result.date ? result.date.split('.')[0] : String(today.getMonth() + 1).padStart(2, '0')}`,
                    fullDate: result.date ? `${year}.${result.date}` : `${year}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`,
                    type: result.type || 'expense',
                    merchant: result.merchant || 'AI 분석',
                    amount: parseInt(result.amount) || 0,
                    category: result.category || '기타',
                    source: 'AI문자',
                    imageBase64: ''
                };
                manualData.push(newEntry);
                if (typeof sendToSheet === 'function') sendToSheet('insert', newEntry);
                saveToLocal();
                refreshAll();
                showToast('✨ 등록 완료!');
            }
            document.getElementById('sms-input').value = '';
        } else {
            alert('인식 실패: 필수 항목(금액, 가맹점)을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error("SMS analysis error:", error);
        alert('분석 중 오류가 발생했습니다.');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let { width, height } = img;
                const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
                const canvas = document.createElement('canvas');
                canvas.width = width * ratio;
                canvas.height = height * ratio;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            };
        };
    });
}

// Backup & Reset
function exportData() {
    const blob = new Blob([JSON.stringify({ manualData, userSettings, fullData })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `가계부_백업_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importData(e) {
    const reader = new FileReader();
    reader.onload = evt => {
        const data = JSON.parse(evt.target.result);
        if (data.manualData) manualData = data.manualData;
        if (data.userSettings) userSettings = data.userSettings;
        if (data.fullData) fullData = data.fullData;
        saveToLocal();
        saveSettings();
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
}

function resetToInitial() {
    if (confirm('모든 데이터를 초기화하시겠습니까?')) {
        localStorage.clear();
        location.reload();
    }
}

function saveGasUrl() {
    const urlInput = document.getElementById('gas-url-input');
    const url = urlInput.value.trim();
    if (url) {
        GAS_WEB_APP_URL = url;
        localStorage.setItem('gasUrl', url);
        showToast('✅ 구글 시트 URL 저장 완료!');
    } else {
        alert('URL을 입력해주세요.');
    }
}

// Event Listeners
document.getElementById('m-merchant')?.addEventListener('input', (e) => {
    if (typeof suggestCategory === 'function') suggestCategory(e.target.value);
});

// Voice Recognition
let recognition;
function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('죄송합니다. 이 브라우저는 음성 인식을 지원하지 않습니다.');

    recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;

    recognition.onstart = () => {
        document.getElementById('recording-status').classList.add('active');
    };

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('recording-text').innerText = '분석 중...';
        showToast(`🎙️ 인식됨: "${transcript}"`);
        
        try {
            const prompt = `가계부 음성 입력입니다. 다음 문장에서 날짜, 가맹점, 금액, 지출/수입 여부, 카테고리를 분석해서 JSON 객체로 응답해줘. 
                형식: {date: "MM.DD", merchant, amount, type, category}. 문장: "${transcript}"`;
            const result = await callGeminiAPI(prompt);
            
            if (result && result.amount) {
                const today = new Date();
                const newEntry = {
                    id: Date.now(),
                    date: result.date || `${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`,
                    yearMonth: `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}`,
                    fullDate: today.toISOString().split('T')[0],
                    type: result.type || 'expense',
                    merchant: result.merchant || '음성 입력',
                    amount: result.amount,
                    category: result.category || '기타',
                    source: 'AI음성봇'
                };
                manualData.push(newEntry);
                saveToLocal();
                refreshAll();
                if (typeof sendToSheet === 'function') sendToSheet('insert', newEntry);
                showToast('✅ 음성으로 등록되었습니다!');
            }
        } catch (e) {
            console.error("Voice analysis error:", e);
        } finally {
            stopVoiceRecognition();
        }
    };

    recognition.onerror = () => stopVoiceRecognition();
    recognition.onend = () => stopVoiceRecognition();

    recognition.start();
}

function stopVoiceRecognition() {
    if (recognition) recognition.stop();
    document.getElementById('recording-status').classList.remove('active');
    document.getElementById('recording-text').innerText = '듣고 있어요...';
}

// Automation (MacroDroid) processing
async function checkAutomationPending() {
    const pending = manualData.filter(m => m.source === 'MacroDroid' && (m.merchant === '자동화(인식대기)' || m.amount === 0));
    if (pending.length > 0) {
        if (confirm(`🤖 MacroDroid로부터 ${pending.length}건의 새로운 알림 내역이 도착했습니다. AI로 분석하여 가계부에 등록할까요?`)) {
            showLoading(`AI 분석 중... (0/${pending.length})`);
            let count = 0;
            for (const item of pending) {
                try {
                    const rawText = item.merchant === '자동화(인식대기)' ? item.category : item.merchant;
                    const prompt = `가계부 자동화 입력입니다. 다음 원문에서 날짜, 가맹점, 금액, 지출/수입 여부, 카테고리, 그리고 '할부 개월(installmentMonths)' 및 '할부 이율(interestRate)'을 분석해서 JSON 객체로 응답해줘. 
                        형식: {date, merchant, amount, type, category, installmentMonths, interestRate}. 원문: "${rawText}"`;
                    
                    const result = await callGeminiAPI(prompt);
                    
                    if (result && result.amount) {
                        if (parseInt(result.installmentMonths) > 1) {
                            await processInstallment(result);
                        } else {
                            const today = new Date();
                            item.date = result.date || `${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;
                            item.merchant = result.merchant || '자동화 분석';
                            item.amount = result.amount;
                            item.category = result.category || '기타';
                            item.type = result.type || 'expense';
                            item.source = 'AI자동화봇';
                            if (typeof sendToSheet === 'function') sendToSheet('update', item);
                        }
                    }
                } catch (e) {
                    console.error("Automation analysis failed for item:", item.id, e);
                }
                count++;
                const loadingText = document.getElementById('loading-text');
                if (loadingText) loadingText.innerText = `AI 분석 중... (${count}/${pending.length})`;
            }
            saveToLocal();
            refreshAll();
            hideLoading();
            showToast(`✅ ${pending.length}건의 내역이 자동으로 정리되었습니다.`);
        }
    }
}

// Installment Logic
async function processInstallment(data) {
    const months = parseInt(data.installmentMonths) || 1;
    const rate = parseFloat(data.interestRate) || 0;
    const totalPrincipal = parseInt(data.amount) || 0;
    const baseDate = data.date || `${String(new Date().getMonth()+1).padStart(2,'0')}.${String(new Date().getDate()).padStart(2,'0')}`;
    
    // Monthly payment calculation (Amortization)
    let monthlyPayments = [];
    if (rate === 0) {
        const amt = Math.floor(totalPrincipal / months);
        for (let i = 0; i < months; i++) {
            let currentAmt = amt;
            if (i === months - 1) currentAmt = totalPrincipal - (amt * (months - 1)); // Adjust last month for floor diff
            monthlyPayments.push(currentAmt);
        }
    } else {
        const r = rate / 12 / 100;
        const pmt = Math.floor(totalPrincipal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
        for (let i = 0; i < months; i++) {
            monthlyPayments.push(pmt);
        }
    }

    const entries = [];
    const [m, d] = baseDate.split('.').map(n => parseInt(n));
    const year = new Date().getFullYear();
    
    for (let i = 0; i < months; i++) {
        let currentMonth = m + i;
        let currentYear = year;
        while (currentMonth > 12) {
            currentMonth -= 12;
            currentYear += 1;
        }
        
        const dateStr = `${String(currentMonth).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
        const entry = {
            id: Date.now() + i,
            date: dateStr,
            yearMonth: `${currentYear}.${String(currentMonth).padStart(2, '0')}`,
            fullDate: `${currentYear}.${dateStr}`,
            type: data.type || 'expense',
            merchant: `${data.merchant} (${i + 1}/${months})`,
            amount: monthlyPayments[i],
            category: data.category || '할부',
            source: 'AI할부봇',
            imageBase64: ''
        };
        entries.push(entry);
    }

    // Add to local and sync
    entries.forEach(e => manualData.push(e));
    if (typeof sendToSheet === 'function') {
        showLoading(`할부 내역 ${months}개월치 등록 중...`);
        // We can use batch_insert if GAS supports it, or just loop simple inserts. 
        // Let's use batch_insert for efficiency if possible.
        await sendToSheet('batch_insert', entries);
    }
    saveToLocal();
    refreshAll();
    hideLoading();
}

// App Start
init();
