/**
 * LedgerBot Utilities
 */

function formatNum(num) {
    return new Intl.NumberFormat('ko-KR').format(num) + '원';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    if (typeof dateStr !== 'string') dateStr = String(dateStr);
    
    // ISO string handling
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    
    // Split by . or -
    const parts = dateStr.split(/[.-]/);
    if (parts.length === 2) {
        // MM.DD -> 2026-MM-DD
        return `2026-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    } else if (parts.length === 3) {
        // YYYY.MM.DD -> YYYY-MM-DD
        let y = parts[0];
        if (y.length === 2) y = '20' + y;
        return `${y}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return dateStr;
}

async function forceSystemUpdate() {
    if (!confirm('시스템을 강제로 업데이트하시겠습니까?\n모든 캐시가 삭제되고 페이지가 새로고침됩니다.')) return;
    
    try {
        // 1. Unregister all service workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
        
        // 2. Clear all caches
        const cacheNames = await caches.keys();
        for (let name of cacheNames) {
            await caches.delete(name);
        }
        
        // 3. Clear session/local storage related to version if any (optional)
        
        alert('캐시 삭제 완료! 최신 버전을 불러옵니다.');
        window.location.reload(true); // Force reload from server
    } catch (e) {
        console.error('Update failed:', e);
        alert('업데이트 중 오류가 발생했습니다. 브라우저 설정을 통해 캐시를 직접 비워주세요.');
    }
}

function showLoading(msg) {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (overlay && text) {
        text.innerText = msg || '처리 중...';
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
