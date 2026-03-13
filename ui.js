/**
 * LedgerBot UI Manager
 */

function toggleSpeedDial() {
    const fab = document.getElementById('fab');
    const menu = document.getElementById('speed-dial-menu');
    if (fab && menu) {
        fab.classList.toggle('active');
        menu.classList.toggle('active');
    }
}

function initGlobalHandlers() {
    const dropZone = document.getElementById('drop-zone');
    
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone?.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null) {
            dropZone?.classList.remove('active');
        }
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone?.classList.remove('active');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleGlobalFileDrop(files);
        }
    });
}

function handleGlobalFileDrop(files) {
    const file = files[0];
    if (file.type.startsWith('image/')) {
        const mockEvent = { target: { files: [file], previousElementSibling: document.querySelector('[data-label="영수증/스크린샷"]') } };
        if (typeof handleOCRUpload === 'function') handleOCRUpload(mockEvent);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const mockEvent = { target: { files: files, previousElementSibling: document.querySelector('[data-label="엑셀 업로드"]') } };
        if (typeof handleExcelUpload === 'function') handleExcelUpload(mockEvent);
    } else {
        showToast('❌ 지원하지 않는 파일 형식입니다.', 'error');
    }
}

function openTab(evt, tabName) {
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) {
        contents[i].style.display = "none";
        contents[i].classList.remove("active");
    }

    const buttons = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < buttons.length; i++) buttons[i].classList.remove("active");

    const target = document.getElementById(tabName);
    if (target) {
        target.style.display = "block";
        target.classList.add("active");
    }

    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add("active");
    } else {
        const btn = Array.from(buttons).find(b => b.getAttribute('onclick')?.includes(tabName));
        if (btn) btn.classList.add("active");
    }

    if (tabName === 'details' && typeof renderTables === 'function') {
        const selectedMonth = document.getElementById('month-selector').value;
        const combinedTx = [...fullData.variable_transactions, ...manualData];
        const filteredTx = selectedMonth === 'all'
            ? combinedTx
            : combinedTx.filter(tr => tr.date && String(tr.date).startsWith(selectedMonth));
        renderTables(filteredTx);
    }
}

function filterTable() {
    const search = document.getElementById('search-tx').value.toLowerCase();
    const cat = document.getElementById('filter-cat').value;
    const rows = document.getElementById('all-expenses').querySelector('tbody').rows;

    for (let row of rows) {
        const merchant = row.querySelector('.tx-merchant').innerText.toLowerCase();
        const category = row.querySelector('.tx-category').innerText;
        const matchesSearch = merchant.includes(search);
        const matchesCat = cat === 'all' || category === cat;
        row.style.display = (matchesSearch && matchesCat) ? '' : 'none';
    }
}

function toggleSelectAll(masterCb) {
    const cbs = document.querySelectorAll('.tx-checkbox');
    cbs.forEach(cb => {
        if(cb.closest('tr').style.display !== 'none') {
            cb.checked = masterCb.checked;
        }
    });
}

function deleteSelectedTx() {
    const checked = document.querySelectorAll('.tx-checkbox:checked');
    if(checked.length === 0) return alert('삭제할 내역을 선택해주세요.');
    if(!confirm(`선택한 ${checked.length}건의 내역을 정말로 삭제하시겠습니까?`)) return;

    let manualChanged = false;
    let anyChanged = false;

    checked.forEach(cb => {
        const id = cb.value;
        const vIdx = fullData.variable_transactions.findIndex(t => t.id == id);
        if (vIdx !== -1) {
            fullData.variable_transactions.splice(vIdx, 1);
            anyChanged = true;
        } else {
            const mIdx = manualData.findIndex(t => t.id == id);
            if (mIdx !== -1) {
                manualData.splice(mIdx, 1);
                manualChanged = true;
                anyChanged = true;
                if (typeof sendToSheet === 'function') sendToSheet('delete', id);
            }
        }
    });

    if(anyChanged) {
        if (typeof saveToLocal === 'function') saveToLocal();
        if (typeof updateByMonth === 'function') updateByMonth();
        const master = document.getElementById('selectAllTx');
        if(master) master.checked = false;
        showToast('🗑️ 삭제되었습니다.');
    }
}

function renderManualList() {
    const body = document.getElementById('manual-entries-body');
    if (!body) return;
    body.innerHTML = '';
    manualData.sort((a, b) => b.id - a.id).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-date">${formatDate(item.fullDate || item.date)}</td>
            <td class="col-merchant">${item.merchant}</td>
            <td class="col-amount" style="color:${item.type === 'income' ? 'var(--success)' : 'white'}">${formatNum(item.amount)}</td>
            <td class="col-action"><span class="delete-btn" onclick="deleteManualEntry(${item.id})">삭제</span></td>
        `;
        body.appendChild(tr);
    });
}

function renderSettings() {
    // 예산 설정 리스트
    const bList = document.getElementById('budget-settings-list');
    if (bList) {
        bList.innerHTML = '';
        Object.keys(userSettings.budgets).forEach(cat => {
            const item = document.createElement('div');
            item.className = 'budget-item';
            item.innerHTML = `
                <span style="font-weight:600;">${cat.replace('_', '/')}</span>
                <input type="number" class="form-control" style="width:150px;" 
                    value="${userSettings.budgets[cat]}" 
                    onchange="updateBudget('${cat}', this.value)">
            `;
            bList.appendChild(item);
        });
    }

    // 고정비 설정 리스트
    const fList = document.getElementById('fixed-settings-list');
    if (fList) {
        fList.innerHTML = '';
        userSettings.fixedExpenses.forEach((fe, idx) => {
            const item = document.createElement('div');
            item.style = "display:flex; justify-content:space-between; margin-bottom:0.5rem; padding:0.5rem; background:rgba(255,255,255,0.02); border-radius:4px;";
            item.innerHTML = `
                <span>${fe.name} (${formatNum(fe.amount)})</span>
                <span class="delete-btn" onclick="deleteFixedExpense(${idx})">삭제</span>
            `;
            fList.appendChild(item);
        });
    }
    
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        const keyInput = document.getElementById('gemini-api-key-input');
        if (keyInput) keyInput.value = savedKey;
    }

    renderCategories();
    renderAiModels();

    const gasInput = document.getElementById('gas-url-input');
    if (gasInput) gasInput.value = GAS_WEB_APP_URL;
}

function renderAiModels() {
    const list = document.getElementById('ai-models-list');
    if(!list) return;
    list.innerHTML = '';
    
    userSettings.aiModels.forEach((model, idx) => {
        const item = document.createElement('div');
        item.style = "display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; background:rgba(255,255,255,0.03); border-radius:6px; border:1px solid rgba(255,255,255,0.05);";
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.6rem;">
                <span style="color:var(--text-secondary); font-size:0.8rem;">#${idx+1}</span>
                <code style="color:#38bdf8;">${model}</code>
            </div>
            <span class="delete-btn" onclick="deleteAiModel(${idx})" style="font-size:0.8rem;">삭제</span>
        `;
        list.appendChild(item);
    });
}

function renderCategories() {
    const list = document.getElementById('custom-categories-list');
    if (!list) return;
    list.innerHTML = '';
    
    const defaultCategories = ['식비', '교통', '쇼핑', '생활/미용', '여가/여행', '통신/보험/공과금', '기타'];

    // 기본 카테고리 (삭제 불가)
    defaultCategories.forEach(cat => {
        const item = document.createElement('span');
        item.style = "padding:0.4rem 0.8rem; background:rgba(255,255,255,0.05); border-radius:1rem; font-size:0.85rem; color:var(--text-secondary);";
        item.innerText = cat;
        list.appendChild(item);
    });

    // 커스텀 카테고리 (삭제 가능)
    userSettings.customCategories.forEach((cat, idx) => {
        const item = document.createElement('span');
        item.style = "padding:0.4rem 0.8rem; background:rgba(56, 189, 248, 0.2); border-radius:1rem; font-size:0.85rem; color:#38bdf8; display:flex; align-items:center; gap:0.4rem;";
        item.innerHTML = `${cat} <i onclick="deleteCustomCategory(${idx})" style="cursor:pointer; color:#ef4444; font-style:normal; font-weight:bold; margin-left:2px;">&times;</i>`;
        list.appendChild(item);
    });

    // 수동 입력 카테고리 목록 리렌더링
    const select = document.getElementById('m-category');
    if (select) {
        select.innerHTML = '';
        const allCats = [...defaultCategories, ...userSettings.customCategories];
        allCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat; opt.innerText = cat;
            select.appendChild(opt);
        });
    }
}

function suggestCategory(merchant) {
    if (!merchant || merchant.length < 2) return;
    let match = manualData.find(m => m.merchant.toLowerCase().includes(merchant.toLowerCase()));
    if (!match) {
        const allTx = fullData.variable_transactions || [];
        match = allTx.find(t => t.merchant && t.merchant.toLowerCase().includes(merchant.toLowerCase()));
    }
    
    if (match && match.category) {
        const catSelect = document.getElementById('m-category');
        if (catSelect) {
            const exists = Array.from(catSelect.options).some(opt => opt.value === match.category);
            if (exists) {
                catSelect.value = match.category;
                showToast(`🤖 '${match.merchant}' 내역을 기반으로 카테고리를 추천했습니다.`, 'info');
            }
        }
    }
}

function updateByMonth() {
    const monthSelector = document.getElementById('month-selector');
    if (!monthSelector) return;
    const selectedMonth = monthSelector.value;

    let currentIncome = fullData.income;
    let currentFixedExpenses = userSettings.fixedExpenses;

    if (selectedMonth !== 'all' && fullData.monthly_stats && fullData.monthly_stats[selectedMonth]) {
        const stats = fullData.monthly_stats[selectedMonth];
        if (stats.income > 0) currentIncome = stats.income;
    }

    const combinedTx = [...fullData.variable_transactions, ...manualData];
    const filteredTx = selectedMonth === 'all'
        ? combinedTx
        : combinedTx.filter(tr => tr.date && String(tr.date).startsWith(selectedMonth));

    const manualIncomes = manualData.filter(m => m.type === 'income');
    const filteredManualIncomes = selectedMonth === 'all'
        ? manualIncomes
        : manualIncomes.filter(m => m.date && String(m.date).startsWith(selectedMonth));

    let monthTotalIncome = currentIncome;
    if (selectedMonth !== 'all') {
        const manualIncomeForMonth = filteredManualIncomes.reduce((acc, curr) => acc + curr.amount, 0);
        monthTotalIncome = currentIncome + manualIncomeForMonth;
    }

    const fixedTotal = currentFixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const variableTotal = filteredTx.filter(t => t.category !== '수입').reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpense = fixedTotal + variableTotal;

    renderInsights(monthTotalIncome, totalExpense, filteredTx);

    document.getElementById('total-income').innerText = formatNum(monthTotalIncome);
    document.getElementById('total-expense').innerText = formatNum(totalExpense);
    document.getElementById('balance').innerText = formatNum(monthTotalIncome - totalExpense);

    // 카테고리 차트
    const catMap = {};
    [...currentFixedExpenses, ...filteredTx].forEach(item => {
        if (item.category === '수입') return;
        catMap[item.category] = (catMap[item.category] || 0) + item.amount;
    });

    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(document.getElementById('categoryChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(catMap).map(k => k.replace('_', '/')),
            datasets: [{
                data: Object.values(catMap),
                backgroundColor: ['#38bdf8', '#22c55e', '#a855f7', '#ec4899', '#f59e0b', '#3b82f6', '#14b8a6', '#94a3b8'],
                borderWidth: 0
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }
    });

    // 고정비 리스트
    const list = document.getElementById('fixed-expenses-list');
    list.innerHTML = '';
    currentFixedExpenses.forEach(ex => {
        const row = document.createElement('div');
        row.style = "display:flex; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid rgba(255,255,255,0.05);";
        row.innerHTML = `<span>${ex.name} <small style="color:var(--text-secondary)">(${ex.category})</small></span><b>${formatNum(ex.amount)}</b>`;
        list.appendChild(row);
    });

    renderTables(filteredTx);
    renderCalendar(selectedMonth, filteredTx);
}

function renderInsights(income, expense, txList) {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const selectedMonthStr = document.getElementById('month-selector').value;

    let insightHtml = "";
    const dailyAvg = expense / currentDay;
    const projectedExpense = Math.floor(dailyAvg * daysInMonth);

    insightHtml += `💡 <b>스마트 지출 레포트:</b> 현재 하루 평균 <b>${formatNum(Math.floor(dailyAvg))}</b>를 소비하고 있습니다.<br>`;
    insightHtml += `월말까지 이 추세가 계속되면 총 <b>${formatNum(projectedExpense)}</b>를 지출할 것으로 예측됩니다.`;
    if (projectedExpense > income) insightHtml += ` <span style="color:#ef4444; font-weight:700;">(수입 초과 경보!)</span>`;

    const currentMonthStr = `${today.getFullYear()}.${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    if (selectedMonthStr === 'all' || selectedMonthStr.replace('-', '.') === currentMonthStr) {
        const pm = (new Date(today.getFullYear(), today.getMonth() - 1, 1).getMonth() + 1).toString().padStart(2, '0');
        const prevMonthStr = `${today.getFullYear()}.${pm}`;
        const combinedAll = [...fullData.variable_transactions, ...manualData];
        const prevMonthTx = combinedAll.filter(t => {
            const parts = t.date.split('.');
            const tDay = parseInt(parts[1]);
            return (t.date.startsWith(pm + '.') || t.yearMonth === prevMonthStr) && tDay <= currentDay;
        });

        const prevFixedTotal = userSettings.fixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
        const prevVariableTotal = prevMonthTx.filter(t => t.category !== '수입').reduce((acc, curr) => acc + curr.amount, 0);
        const prevTotalSamePeriod = prevFixedTotal + prevVariableTotal;

        const diff = expense - prevTotalSamePeriod;
        const diffPct = prevTotalSamePeriod > 0 ? (diff / prevTotalSamePeriod * 100) : 0;

        insightHtml += `<br>📊 <b>전월 동기간 대비:</b> 지난달 같은 날짜(${currentDay}일)까지보다 `;
        if (diff > 0) insightHtml += `<span style="color:#ef4444; font-weight:700;">${formatNum(diff)} (${diffPct.toFixed(1)}%) 더 많이</span> 쓰고 있습니다.`;
        else if (diff < 0) insightHtml += `<span style="color:#22c55e; font-weight:700;">${formatNum(Math.abs(diff))} (${Math.abs(diffPct).toFixed(1)}%) 더 적게</span> 쓰고 있습니다.`;
        else insightHtml += `정확히 동일한 금액을 쓰고 있습니다.`;
    }

    const insightBox = document.getElementById('smart-insight');
    insightBox.style.display = 'block';
    insightBox.innerHTML = insightHtml;

    // 예산 바
    const bList = document.getElementById('budget-progress-list');
    bList.innerHTML = '';
    const spendingByCat = {};
    txList.forEach(t => {
        if (t.category === '수입') return;
        const key = t.category.replace('/', '_');
        spendingByCat[key] = (spendingByCat[key] || 0) + t.amount;
    });

    Object.keys(userSettings.budgets).forEach(cat => {
        const spent = spendingByCat[cat] || 0;
        const budget = userSettings.budgets[cat];
        const pct = Math.min(100, (spent / budget) * 100);
        const color = pct > 90 ? '#ef4444' : (pct > 70 ? '#f59e0b' : '#38bdf8');

        const div = document.createElement('div');
        div.style.marginBottom = '1.2rem';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
                <span>${cat.replace('_', '/')}</span>
                <span>${formatNum(spent)} / ${formatNum(budget)} (${Math.floor(pct)}%)</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width:${pct}%; background:${color};"></div>
            </div>
        `;
        bList.appendChild(div);
    });
}

function renderTables(txList) {
    const topTable = document.getElementById('top-expenses').querySelector('tbody');
    const allTable = document.getElementById('all-expenses').querySelector('tbody');
    topTable.innerHTML = '';
    allTable.innerHTML = '';

    const sortedTx = [...txList].sort((a, b) => b.amount - a.amount);

    sortedTx.forEach((tr, idx) => {
        const isIncome = tr.type === 'income' || tr.category === '수입';
        const safeCat = tr.category.replace(/\//g, '_');
        const amtColor = isIncome ? 'var(--success)' : 'white';
        const prefix = isIncome ? '<b>[입금]</b> ' : '';

        const rowHTMLTop = `
            <td class="col-date">${formatDate(tr.date)}</td>
            <td class="col-merchant">${prefix}${tr.merchant}</td>
            <td class="col-amount" style="font-weight:600; color:${amtColor};">${formatNum(tr.amount)}</td>
            <td class="col-category"><span class="category-tag cat-${safeCat}">${tr.category}</span></td>
        `;

        const rowHTMLAll = `
            <td class="col-check"><input type="checkbox" class="tx-checkbox" value="${tr.id}"></td>
            <td class="tx-date col-date">${formatDate(tr.date)}</td>
            <td class="tx-merchant col-merchant">${prefix}${tr.merchant}</td>
            <td class="tx-amount col-amount" style="font-weight:600; color:${amtColor};" data-val="${tr.amount}">${formatNum(tr.amount)}</td>
            <td class="tx-category col-category"><span class="category-tag cat-${safeCat}">${tr.category}</span></td>
            <td class="col-action">
                <button onclick="startEditTx('${tr.id}', this)" style="background:none; border:none; color:#38bdf8; cursor:pointer; margin-right:8px;">수정</button>
                <button onclick="deleteTx('${tr.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
            </td>
        `;

        if (idx < 5) {
            const row = document.createElement('tr');
            row.innerHTML = rowHTMLTop;
            topTable.appendChild(row);
        }

        const rowAll = document.createElement('tr');
        rowAll.id = `row-${tr.id}`;
        rowAll.innerHTML = rowHTMLAll;
        rowAll.dataset.rawJson = JSON.stringify(tr);
        allTable.appendChild(rowAll);
    });

    const catSet = new Set(txList.map(t => t.category));
    const filterSelect = document.getElementById('filter-cat');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="all">모든 카테고리</option>';
        catSet.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.innerText = c;
            filterSelect.appendChild(opt);
        });
    }
}

function initTrendChart() {
    const monthlyData = { '12월': 0, '1월': 0, '2월': 0, '3월': 0 };
    const combinedTx = [...fullData.variable_transactions, ...manualData];

    combinedTx.forEach(tr => {
        if (tr.category === '수입') return;
        const m = String(tr.date || "").split('.')[0];
        if (m === '12') monthlyData['12월'] += tr.amount;
        else if (m === '01') monthlyData['1월'] += tr.amount;
        else if (m === '02') monthlyData['2월'] += tr.amount;
        else if (m === '03') monthlyData['3월'] += tr.amount;
    });

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: Object.keys(monthlyData),
            datasets: [{
                label: '변동 지출액',
                data: Object.values(monthlyData),
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function renderFetchedModels(models) {
    const list = document.getElementById('fetched-models-list');
    if (!list) return;
    list.innerHTML = '';
    
    models.forEach(model => {
        const badge = document.createElement('span');
        badge.style = "padding:0.3rem 0.6rem; background:rgba(168, 85, 247, 0.2); color:#c084fc; border:1px solid rgba(168, 85, 247, 0.3); border-radius:4px; font-size:0.75rem; cursor:pointer;";
        badge.innerText = model;
        badge.onclick = () => {
            if (userSettings.aiModels.includes(model)) return alert('이미 리스트에 포함된 모델입니다.');
            userSettings.aiModels.push(model);
            if (typeof saveSettings === 'function') saveSettings();
            renderAiModels();
        };
        list.appendChild(badge);
    });
}

function renderCalendar(month, txList) {
    const calendarBody = document.getElementById('calendar-body');
    if (!calendarBody) return;
    calendarBody.innerHTML = '';

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    weekDays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.innerText = day;
        calendarBody.appendChild(header);
    });

    const year = 2026;
    const targetMonth = month === 'all' ? 3 : parseInt(month);
    const firstDay = new Date(year, targetMonth - 1, 1).getDay();
    const daysInMonth = new Date(year, targetMonth, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day other-month';
        calendarBody.appendChild(empty);
    }

    const dayMap = {};
    txList.forEach(tr => {
        const parts = tr.date.split('.');
        if (parts.length < 2) return;
        const m = parseInt(parts[0]);
        const d = parseInt(parts[1]);
        if (m === targetMonth) {
            if (!dayMap[d]) dayMap[d] = { in: 0, out: 0, items: [] };
            if (tr.category === '수입') dayMap[d].in += tr.amount;
            else dayMap[d].out += tr.amount;
            dayMap[d].items.push(tr);
        }
    });

    for (let d = 1; d <= daysInMonth; d++) {
        const dayNode = document.createElement('div');
        dayNode.className = 'calendar-day';
        dayNode.onclick = () => showDayDetails(d, dayMap[d]);
        const info = dayMap[d] || { in: 0, out: 0 };
        dayNode.innerHTML = `
            <div class="day-number">${d}</div>
            <div class="day-info">
                ${info.in > 0 ? `<div class="amount-in">+${info.in.toLocaleString()}</div>` : ''}
                ${info.out > 0 ? `<div class="amount-out">-${info.out.toLocaleString()}</div>` : ''}
            </div>
        `;
        calendarBody.appendChild(dayNode);
    }
}
function refreshAll() {
    if (typeof updateByMonth === 'function') updateByMonth();
    if (typeof renderManualList === 'function') renderManualList();
    if (typeof initTrendChart === 'function') initTrendChart();
    if (typeof renderSettings === 'function') renderSettings();
}
