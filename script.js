/**
 * キテネマスター - JavaScript
 */

// Google Apps Script API URL
const API_URL = 'https://script.google.com/macros/s/AKfycbzuZppKM-9ZQCm5YITAN0zmLNMEAmvj6FaRXy-45ygjuz2HqLHGiCOTF8lcFMOx6QnA/exec';

// グローバル変数
let shiftData = [];
let urlData = [];
let currentEditName = null;
let currentDeleteName = null;

// ===============================
// 初期化
// ===============================

document.addEventListener('DOMContentLoaded', () => {
    // Excelアップロードイベント
    document.getElementById('excel-upload').addEventListener('change', handleExcelUpload);
    
    // データの読み込み
    loadAllData();
});

// ===============================
// ビュー切り替え
// ===============================

function showView(viewName) {
    // 全てのビューを非表示
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // 全てのナビボタンを非アクティブ
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 指定のビューを表示
    if (viewName === 'shift') {
        document.getElementById('shift-view').classList.add('active');
        document.querySelector('.nav-btn:nth-child(1)').classList.add('active');
    } else if (viewName === 'url') {
        document.getElementById('url-view').classList.add('active');
        document.querySelector('.nav-btn:nth-child(2)').classList.add('active');
        loadUrlData();
    }
}

// ===============================
// データ読み込み
// ===============================

async function loadAllData() {
    await loadShiftData();
    await loadUrlData();
}

async function loadShiftData() {
    try {
        const response = await fetch(`${API_URL}?action=getShiftData`);
        const result = await response.json();
        
        if (result.success) {
            shiftData = result.data;
            renderShiftList();
        } else {
            console.error('シフトデータ取得エラー:', result.error);
        }
    } catch (error) {
        console.error('シフトデータ取得エラー:', error);
    }
}

async function loadUrlData() {
    try {
        const response = await fetch(`${API_URL}?action=getUrlData`);
        const result = await response.json();
        
        if (result.success) {
            urlData = result.data;
            renderUrlList();
        } else {
            console.error('URL管理データ取得エラー:', result.error);
        }
    } catch (error) {
        console.error('URL管理データ取得エラー:', error);
    }
}

// ===============================
// Excelアップロード
// ===============================

async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading(true);
    
    try {
        const data = await readExcelFile(file);
        
        // ファイル名から日付を抽出
        const fileName = file.name;
        const dateMatch = fileName.match(/(\d{8})/);
        if (dateMatch) {
            const dateStr = dateMatch[1];
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            document.getElementById('date-display').textContent = `📅 ${year}年${month}月${day}日のシフト`;
        }
        
        // データをアップロード
        await uploadShiftData(data);
        
        showToast('Excelファイルをアップロードしました', 'success');
    } catch (error) {
        console.error('Excelアップロードエラー:', error);
        showToast('Excelファイルの読み込みに失敗しました', 'error');
    } finally {
        showLoading(false);
        // ファイル入力をリセット
        event.target.value = '';
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                
                // 「出勤予」のデータのみ抽出
                const filteredData = jsonData
                    .filter(row => row['シフト状態'] === '出勤予')
                    .map(row => ({
                        name: row['源氏名'] || '',
                        time: formatTime(row['出勤時間']),
                        status: row['シフト状態'] || '',
                        delidosuName: row['でりどす'] || '',
                        anecanName: row['アネキャン'] || ''
                    }))
                    .sort((a, b) => {
                        // 時間順にソート
                        const timeA = parseTime(a.time);
                        const timeB = parseTime(b.time);
                        return timeA - timeB;
                    });
                
                resolve(filteredData);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
        reader.readAsArrayBuffer(file);
    });
}

function formatTime(time) {
    if (typeof time === 'string') return time;
    if (typeof time === 'number') {
        // Excelの時間形式(0.5 = 12:00)を変換
        const hours = Math.floor(time * 24);
        const minutes = Math.floor((time * 24 * 60) % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return '';
}

function parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

async function uploadShiftData(data) {
    try {
        const response = await fetch(`${API_URL}?action=updateShiftData`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: data })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadShiftData();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        throw error;
    }
}

// ===============================
// シフトリスト表示
// ===============================

function renderShiftList() {
    const listElement = document.getElementById('shift-list');
    const emptyElement = document.getElementById('empty-state');
    
    if (shiftData.length === 0) {
        listElement.style.display = 'none';
        emptyElement.style.display = 'block';
        document.getElementById('date-display').textContent = '';
        return;
    }
    
    listElement.style.display = 'flex';
    emptyElement.style.display = 'none';
    
    listElement.innerHTML = shiftData.map(shift => {
        // URL管理データからURLを取得
        const urlInfo = urlData.find(u => u.name === shift.name);
        const delidosuUrl = urlInfo?.delidosuUrl || '';
        const anecanUrl = urlInfo?.anecanUrl || '';
        const checked = shift.checked === '済';
        
        return `
            <div class="shift-item ${checked ? 'checked' : ''}">
                <div class="shift-header">
                    <div class="shift-info">
                        <span class="shift-name">${shift.name}</span>
                        <span class="shift-time">${shift.time}</span>
                    </div>
                    <input 
                        type="checkbox" 
                        class="shift-checkbox" 
                        ${checked ? 'checked' : ''}
                        onchange="toggleCheck('${shift.name}', this.checked)"
                    >
                </div>
                <div class="shift-buttons">
                    ${delidosuUrl 
                        ? `<a href="${delidosuUrl}" target="_blank" class="btn-link btn-delidosu">でりどす</a>`
                        : `<button class="btn-link btn-delidosu" disabled>でりどす (未登録)</button>`
                    }
                    ${anecanUrl 
                        ? `<a href="${anecanUrl}" target="_blank" class="btn-link btn-anecan">アネキャン</a>`
                        : `<button class="btn-link btn-anecan" disabled>アネキャン (未登録)</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

// ===============================
// チェック機能
// ===============================

async function toggleCheck(name, checked) {
    try {
        const response = await fetch(`${API_URL}?action=updateCheckStatus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: name, checked: checked })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // ローカルデータも更新
            const index = shiftData.findIndex(s => s.name === name);
            if (index !== -1) {
                shiftData[index].checked = checked ? '済' : '';
            }
            renderShiftList();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('チェック更新エラー:', error);
        showToast('チェック状態の更新に失敗しました', 'error');
    }
}

// ===============================
// URLリスト表示
// ===============================

function renderUrlList() {
    const listElement = document.getElementById('url-list');
    const emptyElement = document.getElementById('url-empty-state');
    
    if (urlData.length === 0) {
        listElement.style.display = 'none';
        emptyElement.style.display = 'block';
        return;
    }
    
    listElement.style.display = 'flex';
    emptyElement.style.display = 'none';
    
    listElement.innerHTML = urlData.map(url => `
        <div class="url-item" data-name="${url.name}">
            <div class="url-item-header">
                <div class="url-item-name">${url.name}</div>
                <div class="url-item-actions">
                    <button class="btn-edit" onclick="showEditModal('${url.name}')">編集</button>
                    <button class="btn-delete" onclick="showDeleteModal('${url.name}')">削除</button>
                </div>
            </div>
            <div class="url-item-content">
                <div class="url-row">
                    <div class="url-label">でりどす名</div>
                    <div class="url-value ${url.delidosuName ? '' : 'empty'}">
                        ${url.delidosuName || '未設定'}
                    </div>
                </div>
                <div class="url-row">
                    <div class="url-label">でりどすURL</div>
                    <div class="url-value ${url.delidosuUrl ? '' : 'empty'}">
                        ${url.delidosuUrl || '未設定'}
                    </div>
                </div>
                <div class="url-row">
                    <div class="url-label">アネキャン名</div>
                    <div class="url-value ${url.anecanName ? '' : 'empty'}">
                        ${url.anecanName || '未設定'}
                    </div>
                </div>
                <div class="url-row">
                    <div class="url-label">アネキャンURL</div>
                    <div class="url-value ${url.anecanUrl ? '' : 'empty'}">
                        ${url.anecanUrl || '未設定'}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// ===============================
// URL検索
// ===============================

function filterUrlList() {
    const searchText = document.getElementById('search-input').value.toLowerCase();
    const items = document.querySelectorAll('.url-item');
    
    items.forEach(item => {
        const name = item.dataset.name.toLowerCase();
        if (name.includes(searchText)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// ===============================
// モーダル管理
// ===============================

function showAddModal() {
    currentEditName = null;
    document.getElementById('modal-title').textContent = 'URL情報を追加';
    document.getElementById('modal-name').value = '';
    document.getElementById('modal-name').disabled = false;
    document.getElementById('modal-deli-name').value = '';
    document.getElementById('modal-deli-url').value = '';
    document.getElementById('modal-ane-name').value = '';
    document.getElementById('modal-ane-url').value = '';
    
    document.getElementById('url-modal').classList.add('active');
}

function showEditModal(name) {
    currentEditName = name;
    const urlInfo = urlData.find(u => u.name === name);
    
    if (!urlInfo) return;
    
    document.getElementById('modal-title').textContent = 'URL情報を編集';
    document.getElementById('modal-name').value = urlInfo.name;
    document.getElementById('modal-name').disabled = true;
    document.getElementById('modal-deli-name').value = urlInfo.delidosuName || '';
    document.getElementById('modal-deli-url').value = urlInfo.delidosuUrl || '';
    document.getElementById('modal-ane-name').value = urlInfo.anecanName || '';
    document.getElementById('modal-ane-url').value = urlInfo.anecanUrl || '';
    
    document.getElementById('url-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('url-modal').classList.remove('active');
}

function showDeleteModal(name) {
    currentDeleteName = name;
    document.getElementById('delete-name').textContent = name;
    document.getElementById('delete-modal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
}

// ===============================
// URL保存
// ===============================

async function saveUrlData() {
    const name = document.getElementById('modal-name').value.trim();
    
    if (!name) {
        showToast('源氏名を入力してください', 'error');
        return;
    }
    
    const data = {
        name: name,
        delidosuName: document.getElementById('modal-deli-name').value.trim(),
        delidosuUrl: document.getElementById('modal-deli-url').value.trim(),
        anecanName: document.getElementById('modal-ane-name').value.trim(),
        anecanUrl: document.getElementById('modal-ane-url').value.trim()
    };
    
    try {
        const action = currentEditName ? 'updateUrlData' : 'addUrlData';
        
        const response = await fetch(`${API_URL}?action=${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeModal();
            await loadUrlData();
            await loadShiftData(); // シフトリストも更新
            showToast(result.message, 'success');
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        console.error('URL保存エラー:', error);
        showToast('URL情報の保存に失敗しました', 'error');
    }
}

// ===============================
// URL削除
// ===============================

async function confirmDelete() {
    if (!currentDeleteName) return;
    
    try {
        const response = await fetch(`${API_URL}?action=deleteUrlData`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: currentDeleteName })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeDeleteModal();
            await loadUrlData();
            await loadShiftData(); // シフトリストも更新
            showToast(result.message, 'success');
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        console.error('URL削除エラー:', error);
        showToast('URL情報の削除に失敗しました', 'error');
    }
}

// ===============================
// UI制御
// ===============================

function showLoading(show) {
    const loading = document.getElementById('loading');
    const shiftList = document.getElementById('shift-list');
    const emptyState = document.getElementById('empty-state');
    
    if (show) {
        loading.style.display = 'block';
        shiftList.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        loading.style.display = 'none';
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
