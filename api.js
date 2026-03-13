/**
 * LedgerBot API Services (Gemini, Google Sheets)
 */

async function callGeminiAPI(prompt, imageBase64 = null) {
    if (!GEMINI_API_KEY) throw new Error('API 키가 등록되지 않았습니다.');
    if (!userSettings.aiModels || userSettings.aiModels.length === 0) throw new Error('등록된 AI 모델이 없습니다.');

    let lastError = null;
    for (const model of userSettings.aiModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            const parts = [{ text: prompt }];
            if (imageBase64) {
                parts.push({
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: imageBase64
                    }
                });
            }
            const body = {
                contents: [{ parts }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.1
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const data = await response.json();
                let text = data.candidates[0].content.parts[0].text;
                if (text.startsWith('```json')) {
                    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                }
                return JSON.parse(text);
            } else {
                const errData = await response.json();
                const errMsg = errData.error ? errData.error.message : '알 수 없는 오류';
                if (response.status === 429) {
                    console.warn(`모델 ${model} 사용량 초과. 다음 모델 시도 중...`);
                    lastError = new Error(`모든 모델 사용량 초과 (${errMsg})`);
                    continue;
                }
                throw new Error(`API Error (${model}): ${response.status} ${errMsg}`);
            }
        } catch (error) {
            if (error.message.includes('API Error')) throw error;
            lastError = error;
            console.error(`모델 ${model} 호출 중 오류:`, error);
        }
    }
    throw lastError || new Error('AI 모델 호출에 실패했습니다.');
}

async function saveApiKey() {
    const btn = document.querySelector('button[onclick="saveApiKey()"]');
    const keyInput = document.getElementById('gemini-api-key-input').value.trim();
    if (!keyInput) {
        alert('API 키를 입력해주세요.');
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = '⌛ 검증 중...';
    btn.disabled = true;

    const oldKey = GEMINI_API_KEY;
    GEMINI_API_KEY = keyInput;

    try {
        await callGeminiAPI("hi");
        localStorage.setItem('geminiApiKey', keyInput);
        showToast('✅ API 키 검증 성공 및 저장 완료!', 'success');
    } catch (error) {
        GEMINI_API_KEY = oldKey;
        console.error("API Key Validation Error:", error);
        showToast(`❌ API 키 검증 실패: ${error.message}`, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function fetchGeminiModelsList() {
    if (!GEMINI_API_KEY) return alert('먼저 API 키를 등록하고 저장해주세요.');
    const btn = document.querySelector('button[onclick="fetchGeminiModelsList()"]');
    const originalText = btn.innerText;
    btn.innerText = '⌛ 목록 가져오는 중...';
    btn.disabled = true;

    try {
        const url = `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error ? errData.error.message : '알 수 없는 오류');
        }
        const data = await response.json();
        const validModels = data.models
            .filter(m => m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));

        renderFetchedModels(validModels);
        const container = document.getElementById('fetched-models-container');
        if (container) container.style.display = 'block';
    } catch (error) {
        console.error("Fetch Models Error:", error);
        alert(`모델 목록을 가져오지 못했습니다.\n사유: ${error.message}`);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function pushSettingsToSheet() {
    if (!GAS_WEB_APP_URL) {
        alert('❌ 구글 시트 URL이 설정되지 않았습니다.');
        return;
    }
    showLoading('📤 설정을 시트로 내보내는 중...');
    try {
        const settingsToSync = {
            geminiApiKey: GEMINI_API_KEY,
            aiModels: userSettings.aiModels,
            customCategories: userSettings.customCategories,
            budgets: userSettings.budgets,
            fixedExpenses: userSettings.fixedExpenses
        };
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_settings', settings: settingsToSync })
        });
        showToast('📤 설정 내보내기 완료!', 'success');
    } catch (error) {
        console.error("Push Settings Error:", error);
        showToast(`❌ 설정 내보내기 실패: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function pullSettingsFromSheet() {
    if (!GAS_WEB_APP_URL) {
        alert('❌ 구글 시트 URL이 설정되지 않았습니다.');
        return;
    }
    if (!confirm('📡 시트의 설정 데이터로 현재 기기의 설정을 덮어씌울까요?')) return;

    showLoading('📥 설정을 가져오는 중...');
    try {
        const response = await fetch(`${GAS_WEB_APP_URL}?action=settings`);
        if (!response.ok) throw new Error(`서버 응답 오류 (Status: ${response.status})`);
        const remoteSettings = await response.json();
        if (!remoteSettings || Object.keys(remoteSettings).length === 0) {
            alert('⚠️ 시트에 저장된 설정 데이터가 없습니다.');
            return;
        }

        if (remoteSettings.geminiApiKey) {
            GEMINI_API_KEY = remoteSettings.geminiApiKey;
            localStorage.setItem('geminiApiKey', GEMINI_API_KEY);
        }
        if (remoteSettings.aiModels) userSettings.aiModels = remoteSettings.aiModels;
        if (remoteSettings.customCategories) userSettings.customCategories = remoteSettings.customCategories;
        if (remoteSettings.budgets) userSettings.budgets = remoteSettings.budgets;
        if (remoteSettings.fixedExpenses) userSettings.fixedExpenses = remoteSettings.fixedExpenses;

        localStorage.setItem('userSettings_v4', JSON.stringify(userSettings));
        alert('✨ [가져오기 성공] 화면을 새로고침하여 적용합니다.');
        window.location.reload(); 
    } catch (error) {
        console.error("Pull Settings Error:", error);
        alert(`❌ 설정 가져오기 실패: ${error.message}`);
    } finally {
        hideLoading();
    }
}

async function fetchDataFromSheet(silent = false) {
    if (!GAS_WEB_APP_URL) {
        const urlInput = document.getElementById('gas-url-input');
        if (urlInput && urlInput.value.trim()) GAS_WEB_APP_URL = urlInput.value.trim();
    }
    if (!GAS_WEB_APP_URL) {
        if(!silent) alert('구글 시트 URL이 설정되지 않았습니다.');
        return;
    }

    try {
        if(!silent) showLoading('구글 시트 동기화 중...');
        const res = await fetch(GAS_WEB_APP_URL.trim(), { method: 'GET', mode: 'cors', cache: 'no-store' });
        if (!res.ok) throw new Error(`에러 (코드: ${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("배열 형식이 아닙니다.");

        if (data.length === 0) {
            const allTx = [...fullData.variable_transactions, ...manualData];
            if (allTx.length > 0) sendToSheet('batch_insert', allTx);
            return;
        }

        let hasChanges = false;
        const sheetIds = new Set(data.map(d => d.id.toString()));
        const initManualLen = manualData.length;
        manualData = manualData.filter(m => sheetIds.has(m.id.toString()));
        if (manualData.length !== initManualLen) hasChanges = true;

        const initVarLen = fullData.variable_transactions.length;
        fullData.variable_transactions = fullData.variable_transactions.filter(v => sheetIds.has(v.id.toString()));
        if (fullData.variable_transactions.length !== initVarLen) hasChanges = true;

        data.forEach(item => {
            const parsedAmount = parseInt(item.amount) || 0;
            const itemIdStr = item.id.toString();
            let existingM = manualData.find(m => m.id.toString() === itemIdStr);
            if (existingM) {
                if (existingM.amount !== parsedAmount || existingM.merchant !== item.merchant || existingM.category !== item.category) {
                    existingM.amount = parsedAmount; existingM.merchant = item.merchant; existingM.category = item.category;
                    hasChanges = true;
                }
            } else {
                let existingV = fullData.variable_transactions.find(v => v.id.toString() === itemIdStr);
                if (existingV) {
                    if (existingV.amount !== parsedAmount || existingV.merchant !== item.merchant || existingV.category !== item.category) {
                        existingV.amount = parsedAmount; existingV.merchant = item.merchant; existingV.category = item.category;
                        hasChanges = true;
                    }
                } else {
                    manualData.push({
                        id: item.id, date: item.date, yearMonth: item.yearMonth, fullDate: item.fullDate,
                        type: item.type, merchant: item.merchant, amount: parsedAmount,
                        category: item.category, source: item.source || '구글시트', imageBase64: item.imageBase64 || ''
                    });
                    hasChanges = true;
                }
            }
        });

        if (hasChanges || !silent) {
            if (typeof saveToLocal === 'function') saveToLocal();
            if (typeof updateByMonth === 'function') updateByMonth();
            if (typeof initTrendChart === 'function') initTrendChart();
            const manualTab = document.getElementById('manual');
            if (manualTab && manualTab.classList.contains('active')) {
                if (typeof renderManualList === 'function') renderManualList();
            }
            if(!silent) showToast(`🔄 동기화 완료! (${data.length}건)`, 'success');
            
            // Check for pending MacroDroid automation entries
            setTimeout(() => {
                if (typeof checkAutomationPending === 'function') checkAutomationPending();
            }, 1000);
        }
    } catch (err) {
        console.error("Fetch DB error:", err);
        if(!silent) alert('동기화 오류: ' + err.message);
    } finally {
        hideLoading();
    }
}

async function sendToSheet(action, dataObj) {
    if (!GAS_WEB_APP_URL) return; 
    try {
        const payload = { action, data: action === 'delete' ? undefined : dataObj, id: action === 'delete' ? dataObj : undefined };
        fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
        .catch(e => console.error("Sheet API error:", e));
    } catch (error) {
        console.error("sendToSheet error:", error);
    }
}
