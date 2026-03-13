/**
 * LedgerBot Main Application Logic
 */

// --- Global State ---
let GEMINI_API_KEY = localStorage.getItem('geminiApiKey') || '';
let GAS_WEB_APP_URL = localStorage.getItem('gasUrl') || 'https://script.google.com/macros/s/AKfycbxHHIBh4O00Xpxw-Hdgzp1_0ze5AGWHOvpoj_ur4scq79gPVSMyL-6F8faaIb0TXtgT/exec';

let fullData = JSON.parse(document.getElementById('finance-data').textContent);
let manualData = JSON.parse(localStorage.getItem('manualFinances') || '[]');
let userSettings = JSON.parse(localStorage.getItem('userSettings_v4') || localStorage.getItem('userSettings_v3') || localStorage.getItem('userSettings') || '{}');

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

    if (!dateVal || !merchantVal || isNaN(amountVal)) {
        alert('모든 필드를 올바르게 입력해주세요.');
        return;
    }

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
    document.getElementById('m-merchant').value = '';
    document.getElementById('m-amount').value = '';
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

    // 업로드 경로(버튼 클릭 vs 드래그앤드롭)에 따라 텍스트를 업데이트할 버튼 식별
    const btn = event.target.previousElementSibling || document.querySelector('button[onclick*="import-excel"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) btn.disabled = true;

    let totalAdded = 0;
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        btn.innerText = `⌛ AI 분석 중... (${i+1}/${files.length})`;
        
        try {
            const rows = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                        resolve(XLSX.utils.sheet_to_json(worksheet, { header: 1 }));
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });

            const addedCount = await processExcelData(rows, file.name, false);
            if (addedCount > 0) {
                totalAdded += addedCount;
                successCount++;
            }
        } catch (error) {
            console.error("Excel processing error:", file.name, error);
        }
    }

    if (btn) {
        btn.innerText = originalText;
        btn.disabled = false;
    }
    event.target.value = '';

    if (totalAdded > 0) {
        saveToLocal();
        init();
        alert(`✨ AI 분석 완료: ${files.length}개 파일 중 ${successCount}개 파일에서 ${totalAdded}건을 성공적으로 추가했습니다!`);
    } else {
        alert('AI가 가계부에 반영할 유효한 거래 내역을 찾지 못했습니다.');
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
    const smsText = document.getElementById('sms-input').value.trim();
    if(!smsText || !GEMINI_API_KEY) return alert('입력값 또는 API Key가 없습니다.');

    const btn = document.getElementById('btn-parse-sms');
    const originalText = btn.innerText;
    btn.innerText = '⌛ AI 분석 중...';
    btn.disabled = true;

    try {
        const prompt = `Analyze SMS and return JSON: {date, merchant, amount, type, category}. SMS:\n${smsText}`;
        const result = await callGeminiAPI(prompt);

        if(!result.amount || !result.merchant) return alert('인식 실패');

        const today = new Date();
        const finalDateStr = result.date || `${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getDate().toString().padStart(2, '0')}`;
        const currentYear = today.getFullYear();

        const newEntry = {
            id: Date.now() + Math.random(),
            date: finalDateStr,
            yearMonth: `${currentYear}.${finalDateStr.split('.')[0]}`,
            fullDate: `${currentYear}-${finalDateStr.replace('.', '-')}`,
            type: result.type || 'expense',
            merchant: result.merchant,
            amount: result.amount,
            category: result.type === 'income' ? '수입' : (result.category || '기타'),
            source: 'AI문자봇'
        };

        manualData.push(newEntry);
        saveToLocal();
        refreshAll();
        if (typeof sendToSheet === 'function') sendToSheet('insert', newEntry);
        document.getElementById('sms-input').value = '';
        alert(`✨ 등록 완료!`);
    } catch (error) {
        console.error("SMS analysis error:", error);
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

// Clipboard Paste
function initPasteHandler() {
    window.addEventListener('paste', async (e) => {
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (confirm('📋 클립보드에 이미지가 감지되었습니다. 캡쳐본을 분석하여 등록할까요?')) {
                    const mockEvent = { target: { files: [file], previousElementSibling: document.querySelector('[data-label="영수증/스크린샷"]') } };
                    handleOCRUpload(mockEvent);
                }
            } else if (item.type === 'text/plain') {
                const text = e.clipboardData.getData('text');
                if ((text.includes('원') || text.includes('승인') || text.includes('입금')) && text.length < 500) {
                    if (confirm('📋 복사한 텍스트에서 결제 내역이 감지되었습니다. 분석하여 등록할까요?')) {
                        document.getElementById('sms-input').value = text;
                        parseSmsInput();
                    }
                }
            }
        }
    });
}

// App Start
init();
