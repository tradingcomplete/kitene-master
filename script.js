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
    console.log('=== キテネマスター 初期化開始 ===');
    console.log('API URL:', API_URL);
    console.log('XLSXライブラリ:', typeof XLSX !== 'undefined' ? '読み込み済み' : '未読み込み');
    
    // Excelアップロードイベント
    document.getElementById('excel-upload').addEventListener('change', handleExcelUpload);
    
    // データの読み込み
    console.log('初期データをロード中...');
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
    console.log('loadAllData: 全データロード開始');
    await loadShiftData();
    await loadUrlData();
    console.log('loadAllData: 全データロード完了');
}

async function loadShiftData() {
    try {
        console.log('loadShiftData: シフトデータ取得中...');
        const response = await fetch(`${API_URL}?action=getShiftData`);
        console.log('loadShiftData: レスポンス受信', response.status);
        
        const result = await response.json();
        console.log('loadShiftData: レスポンス:', result);
        
        if (result.success) {
            shiftData = result.data;
            console.log('loadShiftData: データ件数', shiftData.length);
            renderShiftList();
        } else {
            console.error('loadShiftData: エラー:', result.error);
        }
    } catch (error) {
        console.error('loadShiftData: 例外:', error);
    }
}

async function loadUrlData() {
    try {
        console.log('loadUrlData: URL管理データ取得中...');
        const response = await fetch(`${API_URL}?action=getUrlData`);
        console.log('loadUrlData: レスポンス受信', response.status);
        
        const result = await response.json();
        console.log('loadUrlData: レスポンス:', result);
        
        if (result.success) {
            urlData = result.data;
            console.log('loadUrlData: データ件数', urlData.length);
            renderUrlList();
        } else {
            console.error('loadUrlData: エラー:', result.error);
        }
    } catch (error) {
        console.error('loadUrlData: 例外:', error);
    }
}

// ===============================
// Excelアップロード
// ===============================

async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('=== デバッグ: Excelアップロード開始 ===');
    console.log('ファイル名:', file.name);
    console.log('ファイルサイズ:', file.size, 'bytes');
    
    showLoading(true);
    
    try {
        console.log('ステップ1: Excelファイルを読み込み中...');
        const data = await readExcelFile(file);
        console.log('ステップ1完了: データ件数', data.length);
        console.log('読み込んだデータ:', data);
        
        // ファイル名から日付を抽出
        const fileName = file.name;
        const dateMatch = fileName.match(/(\d{8})/);
        if (dateMatch) {
            const dateStr = dateMatch[1];
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            document.getElementById('date-display').textContent = `📅 ${year}年${month}月${day}日のシフト`;
            console.log('日付抽出:', year, month, day);
        }
        
        // データをアップロード
        console.log('ステップ2: Googleスプレッドシートにアップロード中...');
        console.log('API URL:', API_URL);
        await uploadShiftData(data);
        console.log('ステップ2完了: アップロード成功');
        
        showToast('Excelファイルをアップロードしました', 'success');
        console.log('=== デバッグ: アップロード完了 ===');
    } catch (error) {
        console.error('=== エラー詳細 ===');
        console.error('エラーメッセージ:', error.message);
        console.error('エラースタック:', error.stack);
        console.error('エラーオブジェクト:', error);
        showToast('エラー: ' + error.message, 'error');
    } finally {
        showLoading(false);
        // ファイル入力をリセット
        event.target.value = '';
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        console.log('readExcelFile: ファイル読み込み開始');
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                console.log('readExcelFile: FileReader onload実行');
                const data = new Uint8Array(e.target.result);
                console.log('readExcelFile: データサイズ', data.length);
                
                const workbook = XLSX.read(data, { type: 'array' });
                console.log('readExcelFile: ワークブック読み込み完了');
                console.log('シート名:', workbook.SheetNames);
                
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                console.log('readExcelFile: JSON変換完了、行数:', jsonData.length);
                console.log('最初の3行:', jsonData.slice(0, 3));
                
                // 「出勤予」のデータのみ抽出
                const filteredData = jsonData
                    .filter(row => {
                        const isMatch = row['シフト状態'] === '出勤予';
                        if (!isMatch) {
                            console.log('フィルタアウト:', row['源氏名'], 'シフト状態:', row['シフト状態']);
                        }
                        return isMatch;
                    })
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
                
                console.log('readExcelFile: フィルタ後の件数', filteredData.length);
                console.log('フィルタ後のデータ:', filteredData);
                resolve(filteredData);
            } catch (error) {
                console.error('readExcelFile: エラー', error);
                reject(error);
            }
        };
        
        reader.onerror = () => {
            console.error('readExcelFile: FileReaderエラー');
            reject(new Error('ファイル読み込みエラー'));
        };
        
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
        console.log('uploadShiftData: リクエスト送信中...');
        console.log('送信データ件数:', data.length);
        
        const response = await fetch(`${API_URL}?action=updateShiftData`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: data })
        });
        
        console.log('uploadShiftData: レスポンス受信');
        console.log('ステータスコード:', response.status);
        
        const resultText = await response.text();
        console.log('レスポンステキスト:', resultText);
        
        const result = JSON.parse(resultText);
        console.log('パース済みレスポンス:', result);
        
        if (result.success) {
            console.log('uploadShiftData: 成功');
            await loadShiftData();
        } else {
            console.error('uploadShiftData: APIエラー', result.error);
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('uploadShiftData: 例外発生', error);
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
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: name, checked: checked })
        });
        
        const result = await response.json();
        
        if (result.success) {
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
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeModal();
            await loadUrlData();
            await loadShiftData();
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
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: currentDeleteName })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeDeleteModal();
            await loadUrlData();
            await loadShiftData();
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
