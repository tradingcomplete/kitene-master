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
let currentShiftDate = '';

// ===============================
// 初期化
// ===============================

document.addEventListener('DOMContentLoaded', () => {
    console.log('=== キテネマスター 初期化開始 ===');
    console.log('API URL:', API_URL);
    console.log('XLSXライブラリ:', typeof XLSX !== 'undefined' ? '読み込み済み' : '未読み込み');
    
    // Excelアップロードイベント
    document.getElementById('excel-upload').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            handleExcelUpload(file);
        }
        // ファイル入力をリセット
        event.target.value = '';
    });
    
    // ★★★ メイン店舗チェックボックスの排他制御を追加 ★★★
    document.querySelectorAll('.main-store-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // 他のチェックボックスを外す
                document.querySelectorAll('.main-store-checkbox').forEach(cb => {
                    if (cb !== e.target) {
                        cb.checked = false;
                    }
                });
            }
        });
    });
    
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
    } else if (viewName === 'all') {
        // ★★★ 全キャストタブを追加 ★★★
        document.getElementById('all-view').classList.add('active');
        document.querySelector('.nav-btn:nth-child(2)').classList.add('active');
        renderAllCastList();
    } else if (viewName === 'url') {
        document.getElementById('url-view').classList.add('active');
        document.querySelector('.nav-btn:nth-child(3)').classList.add('active');
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
            return result.data; // 戻り値を追加
        } else {
            console.error('loadUrlData: エラー:', result.error);
            return []; // エラー時は空配列を返す
        }
    } catch (error) {
        console.error('loadUrlData: 例外:', error);
        return []; // 例外時も空配列を返す
    }
}

// ===============================
// Excelアップロード
// ===============================

async function handleExcelUpload(file) {
    try {
        console.log('=== デバッグ: Excelアップロード開始 ===');
        console.log('ファイル名:', file.name);
        console.log('ファイルサイズ:', file.size, 'bytes');
        
        showLoading();
        
        // ステップ1: Excelファイルを読み込み
        console.log('ステップ1: Excelファイルを読み込み中...');
        const shiftData = await readExcelFile(file);
        console.log('ステップ1完了: データ件数', shiftData.length);
        console.log('読み込んだデータ:', shiftData);
        
        if (!shiftData || shiftData.length === 0) {
            throw new Error('出勤予定のデータが見つかりませんでした');
        }
        
        // 日付を抽出
        const dateMatch = file.name.match(/(\d{4})(\d{2})(\d{2})/);
        if (dateMatch) {
            const [, year, month, day] = dateMatch;
            console.log('日付抽出:', year, month, day);
            currentShiftDate = `${year}年${month}月${day}日`;
        }
        
        // ★★★ ステップ2: URL管理データを取得（追加） ★★★
        console.log('ステップ2: URL管理データを取得中...');
        const urlData = await loadUrlData();
        console.log('ステップ2完了: URL管理データ取得完了', urlData.length, '件');
        
        // ★★★ ステップ3: URL照合（追加） ★★★
        console.log('ステップ3: URL照合中...');
        const dataWithUrls = shiftData.map(employee => {
            // 源氏名で照合
            const urlInfo = urlData.find(u => u.name === employee.name);
            
            if (urlInfo) {
                console.log(`URL照合成功: ${employee.name} → でりどす: ${urlInfo.delidosuUrl ? 'あり' : 'なし'}, アネキャン: ${urlInfo.anecanUrl ? 'あり' : 'なし'}, 愛のしずく: ${urlInfo.ainoshizukuUrl ? 'あり' : 'なし'}`);
            } else {
                console.log(`URL照合失敗: ${employee.name} → URL管理に未登録`);
            }
            
            return {
                ...employee,
                delidosuUrl: urlInfo?.delidosuUrl || '',
                anecanUrl: urlInfo?.anecanUrl || '',
                ainoshizukuUrl: urlInfo?.ainoshizukuUrl || ''
            };
        });
        console.log('ステップ3完了: URL照合完了');
        console.log('URL付きデータ:', dataWithUrls);
        
        // ステップ4: Googleスプレッドシートにアップロード（URL情報も含む）
        console.log('ステップ4: Googleスプレッドシートにアップロード中...');
        console.log('API URL:', API_URL);
        await uploadShiftData(dataWithUrls);
        console.log('ステップ4完了: アップロード成功');
        
        // ステップ5: データをリロード
        await loadShiftData();
        
        hideLoading();
        console.log('=== デバッグ: アップロード完了 ===');
        
    } catch (error) {
        console.error('Excelアップロードエラー:', error);
        hideLoading();
        alert(`エラーが発生しました: ${error.message}`);
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
                        anecanName: row['アネキャン'] || '',
                        ainoshizukuName: row['人妻本舗愛のしずく'] || ''
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

function formatTime(timeValue) {
    if (!timeValue) return '';
    
    // 既に "HH:MM" 形式の場合はそのまま返す
    if (typeof timeValue === 'string' && /^\d{1,2}:\d{2}$/.test(timeValue)) {
        return timeValue;
    }
    
    // ★★★ ISO 8601形式（例: "1899-12-29T16:00:00.000Z"）の場合 ★★★
    if (typeof timeValue === 'string' && timeValue.includes('T')) {
        const date = new Date(timeValue);
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    // Excelシリアルナンバーの場合
    if (typeof timeValue === 'number') {
        const totalMinutes = Math.round(timeValue * 24 * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    // それ以外は文字列化
    return String(timeValue);
}

function parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// ===============================
// あいうえお順グループ化
// ===============================

const KANA_GROUPS = {
    'あ': ['あ', 'い', 'う', 'え', 'お'],
    'か': ['か', 'き', 'く', 'け', 'こ', 'が', 'ぎ', 'ぐ', 'げ', 'ご'],
    'さ': ['さ', 'し', 'す', 'せ', 'そ', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
    'た': ['た', 'ち', 'つ', 'て', 'と', 'だ', 'ぢ', 'づ', 'で', 'ど'],
    'な': ['な', 'に', 'ぬ', 'ね', 'の'],
    'は': ['は', 'ひ', 'ふ', 'へ', 'ほ', 'ば', 'び', 'ぶ', 'べ', 'ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
    'ま': ['ま', 'み', 'む', 'め', 'も'],
    'や': ['や', 'ゆ', 'よ'],
    'ら': ['ら', 'り', 'る', 'れ', 'ろ'],
    'わ': ['わ', 'を', 'ん']
};

function getKanaGroup(name) {
    if (!name) return 'その他';
    const firstChar = name.charAt(0);
    
    for (const [group, chars] of Object.entries(KANA_GROUPS)) {
        if (chars.includes(firstChar)) {
            return group;
        }
    }
    
    return 'その他';
}


async function uploadShiftData(data) {
    try {
        console.log('uploadShiftData: リクエスト送信中...');
        console.log('送信データ件数:', data.length);
        
        // シンプルリクエストにするため、Content-Type: text/plain を使用
        const response = await fetch(`${API_URL}?action=updateShiftData`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
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
    console.log('renderShiftList: シフトリスト描画開始');
    console.log('シフトデータ件数:', shiftData.length);
    
    const listElement = document.getElementById('shift-list');
    const emptyElement = document.getElementById('empty-state');
    
    if (!listElement) {
        console.error('shift-list要素が見つかりません');
        return;
    }
    
    if (shiftData.length === 0) {
        listElement.style.display = 'none';
        emptyElement.style.display = 'block';
        if (document.getElementById('date-display')) {
            document.getElementById('date-display').textContent = '';
        }
        return;
    }
    
    listElement.style.display = 'flex';
    emptyElement.style.display = 'none';
    
    // ★★★ URL管理データを取得してチェック状態を反映 ★★★
    const mergedData = shiftData.map(shift => {
        const urlInfo = urlData.find(u => u.name === shift.name);
        return {
            ...shift,
            checked: urlInfo?.checked || '',
            mainStore: urlInfo?.mainStore || ''
        };
    });
    
    // ★★★ 出勤時間順にソート ★★★
    mergedData.sort((a, b) => {
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
        return a.name.localeCompare(b.name, 'ja');
    });
    
    listElement.innerHTML = mergedData.map(shift => {
        // ★★★ メイン店舗バッジの生成 ★★★
        let mainBadge = '';
        if (shift.mainStore) {
            const storeNames = {
                'delidosu': 'でりどす',
                'anecan': 'アネキャン',
                'ainoshizuku': 'しずく'
            };
            const storeName = storeNames[shift.mainStore] || '';
            if (storeName) {
                mainBadge = `<span class="main-store-badge ${shift.mainStore}">${storeName}</span>`;
            }
        }
        
        return `
            <div class="shift-item ${shift.checked === '済' ? 'checked' : ''}">
                <div class="shift-header">
                    <div class="shift-info">
                        <input type="checkbox" class="shift-checkbox" 
                               ${shift.checked === '済' ? 'checked' : ''} 
                               onchange="toggleCheck('${shift.name}', this.checked)">
                        <span class="shift-name">${shift.name}</span>
                        <span class="shift-time">${shift.time}</span>
                        ${mainBadge}
                    </div>
                </div>
                <div class="shift-buttons">
                    <button class="btn-link btn-delidosu" 
                            onclick="window.open('${shift.delidosuUrl}', '_blank')"
                            ${!shift.delidosuUrl ? 'disabled' : ''}>
                        ${shift.delidosuUrl ? 'でりどす' : '未登録'}
                    </button>
                    <button class="btn-link btn-anecan" 
                            onclick="window.open('${shift.anecanUrl}', '_blank')"
                            ${!shift.anecanUrl ? 'disabled' : ''}>
                        ${shift.anecanUrl ? 'アネキャン' : '未登録'}
                    </button>
                    <button class="btn-link btn-ainoshizuku" 
                            onclick="window.open('${shift.ainoshizukuUrl}', '_blank')"
                            ${!shift.ainoshizukuUrl ? 'disabled' : ''}>
                        ${shift.ainoshizukuUrl ? '愛のしずく' : '未登録'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('renderShiftList: 描画完了');
}

// ===============================
// 全キャストリスト表示
// ===============================

function renderAllCastList() {
    console.log('renderAllCastList: 全キャストリスト描画開始');
    console.log('URLデータ件数:', urlData.length);
    
    const listElement = document.getElementById('all-cast-list');
    const emptyElement = document.getElementById('all-empty-state');
    
    if (!listElement) {
        console.error('all-cast-list要素が見つかりません');
        return;
    }
    
    if (urlData.length === 0) {
        listElement.style.display = 'none';
        if (emptyElement) emptyElement.style.display = 'block';
        return;
    }
    
    listElement.style.display = 'flex';
    if (emptyElement) emptyElement.style.display = 'none';
    
    // あいうえお順にグループ化
    const groupedData = {};
    urlData.forEach(cast => {
        const group = getKanaGroup(cast.name);
        if (!groupedData[group]) {
            groupedData[group] = [];
        }
        groupedData[group].push(cast);
    });
    
    // 各グループ内で名前順にソート
    Object.keys(groupedData).forEach(group => {
        groupedData[group].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    });
    
    // HTML生成
    const groupOrder = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ', 'その他'];
    listElement.innerHTML = groupOrder.map(group => {
        const casts = groupedData[group];
        if (!casts || casts.length === 0) return '';
        
        return `
            <div class="kana-group">
                <div class="kana-group-header">${group}</div>
                ${casts.map(cast => {
                    // クラスバッジ
                    let classBadge = '';
                    if (cast.class === '姫デコ') {
                        classBadge = '<span class="class-badge himedeco">姫デコ</span>';
                    } else if (cast.class === '新人') {
                        classBadge = '<span class="class-badge newbie">新人</span>';
                    }
                    
                    // メイン店舗バッジ
                    let mainBadge = '';
                    if (cast.mainStore) {
                        const storeNames = {
                            'delidosu': 'でりどす',
                            'anecan': 'アネキャン',
                            'ainoshizuku': 'しずく'
                        };
                        const storeName = storeNames[cast.mainStore] || '';
                        if (storeName) {
                            mainBadge = `<span class="main-store-badge ${cast.mainStore}">${storeName}</span>`;
                        }
                    }
                    
                    return `
                        <div class="cast-item ${cast.checked === '済' ? 'checked' : ''}" data-name="${cast.name}">
                            <div class="cast-header">
                                <div class="cast-info">
                                    <input type="checkbox" class="cast-checkbox" 
                                           ${cast.checked === '済' ? 'checked' : ''} 
                                           onchange="toggleCheck('${cast.name}', this.checked)">
                                    <span class="cast-name">${cast.name}</span>
                                    ${classBadge}
                                    ${mainBadge}
                                </div>
                                <button class="btn-edit-small" onclick="showEditModal('${cast.name}')">編集</button>
                            </div>
                            <div class="cast-buttons">
                                <button class="btn-link btn-delidosu btn-small" 
                                        onclick="window.open('${cast.delidosuUrl}', '_blank')"
                                        ${!cast.delidosuUrl ? 'disabled' : ''}>
                                    ${cast.delidosuUrl ? 'でりどす' : '未登録'}
                                </button>
                                <button class="btn-link btn-anecan btn-small" 
                                        onclick="window.open('${cast.anecanUrl}', '_blank')"
                                        ${!cast.anecanUrl ? 'disabled' : ''}>
                                    ${cast.anecanUrl ? 'アネキャン' : '未登録'}
                                </button>
                                <button class="btn-link btn-ainoshizuku btn-small" 
                                        onclick="window.open('${cast.ainoshizukuUrl}', '_blank')"
                                        ${!cast.ainoshizukuUrl ? 'disabled' : ''}>
                                    ${cast.ainoshizukuUrl ? '愛のしずく' : '未登録'}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
    
    console.log('renderAllCastList: 描画完了');
}

function filterAllCastList() {
    const searchText = document.getElementById('all-search-input').value.toLowerCase();
    const items = document.querySelectorAll('.cast-item');
    
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
// チェック機能
// ===============================

async function toggleCheck(name, checked) {
    try {
        const response = await fetch(`${API_URL}?action=updateCheckStatus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({ name: name, checked: checked })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // ★★★ シフトデータを更新 ★★★
            const shiftIndex = shiftData.findIndex(s => s.name === name);
            if (shiftIndex !== -1) {
                shiftData[shiftIndex].checked = checked ? '済' : '';
            }
            
            // ★★★ URL管理データを更新 ★★★
            const urlIndex = urlData.findIndex(u => u.name === name);
            if (urlIndex !== -1) {
                urlData[urlIndex].checked = checked ? '済' : '';
            }
            
            // ★★★ 両方の画面を再描画 ★★★
            renderShiftList();
            renderAllCastList();
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
                <div class="url-row">
                    <div class="url-label">愛の雫名</div>
                    <div class="url-value ${url.ainoshizukuName ? '' : 'empty'}">
                        ${url.ainoshizukuName || '未設定'}
                    </div>
                </div>
                <div class="url-row">
                    <div class="url-label">愛の雫URL</div>
                    <div class="url-value ${url.ainoshizukuUrl ? '' : 'empty'}">
                        ${url.ainoshizukuUrl || '未設定'}
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
    
    // ★★★ クラスを初期値に設定 ★★★
    document.getElementById('modal-class').value = '通常';
    
    // ★★★ 各店舗の情報をクリア ★★★
    document.getElementById('modal-deli-name').value = '';
    document.getElementById('modal-deli-url').value = '';
    document.getElementById('modal-ane-name').value = '';
    document.getElementById('modal-ane-url').value = '';
    document.getElementById('modal-aino-name').value = '';
    document.getElementById('modal-aino-url').value = '';
    
    // ★★★ メイン店舗チェックボックスをクリア ★★★
    document.getElementById('modal-deli-main').checked = false;
    document.getElementById('modal-ane-main').checked = false;
    document.getElementById('modal-aino-main').checked = false;
    
    document.getElementById('url-modal').classList.add('active');
}

function showEditModal(name) {
    currentEditName = name;
    const urlInfo = urlData.find(u => u.name === name);
    
    if (!urlInfo) return;
    
    document.getElementById('modal-title').textContent = 'URL情報を編集';
    document.getElementById('modal-name').value = urlInfo.name;
    document.getElementById('modal-name').disabled = true;
    
    // ★★★ クラスを設定 ★★★
    document.getElementById('modal-class').value = urlInfo.class || '通常';
    
    // ★★★ 各店舗の情報を設定 ★★★
    document.getElementById('modal-deli-name').value = urlInfo.delidosuName || '';
    document.getElementById('modal-deli-url').value = urlInfo.delidosuUrl || '';
    document.getElementById('modal-ane-name').value = urlInfo.anecanName || '';
    document.getElementById('modal-ane-url').value = urlInfo.anecanUrl || '';
    document.getElementById('modal-aino-name').value = urlInfo.ainoshizukuName || '';
    document.getElementById('modal-aino-url').value = urlInfo.ainoshizukuUrl || '';
    
    // ★★★ メイン店舗チェックボックスを設定 ★★★
    document.getElementById('modal-deli-main').checked = (urlInfo.mainStore === 'delidosu');
    document.getElementById('modal-ane-main').checked = (urlInfo.mainStore === 'anecan');
    document.getElementById('modal-aino-main').checked = (urlInfo.mainStore === 'ainoshizuku');
    
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
    
    // ★★★ メイン店舗の判定 ★★★
    let mainStore = '';
    if (document.getElementById('modal-deli-main').checked) {
        mainStore = 'delidosu';
    } else if (document.getElementById('modal-ane-main').checked) {
        mainStore = 'anecan';
    } else if (document.getElementById('modal-aino-main').checked) {
        mainStore = 'ainoshizuku';
    }
    
    const data = {
        name: name,
        class: document.getElementById('modal-class').value, // ★★★ クラスを追加 ★★★
        delidosuName: document.getElementById('modal-deli-name').value.trim(),
        delidosuUrl: document.getElementById('modal-deli-url').value.trim(),
        anecanName: document.getElementById('modal-ane-name').value.trim(),
        anecanUrl: document.getElementById('modal-ane-url').value.trim(),
        ainoshizukuName: document.getElementById('modal-aino-name').value.trim(),
        ainoshizukuUrl: document.getElementById('modal-aino-url').value.trim(),
        mainStore: mainStore // ★★★ メイン店舗を追加 ★★★
    };
    
    try {
        const action = currentEditName ? 'updateUrlData' : 'addUrlData';
        
        const response = await fetch(`${API_URL}?action=${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
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
            headers: {
                'Content-Type': 'text/plain',
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
    
    if (show === undefined || show === true) {
        loading.style.display = 'block';
        shiftList.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        loading.style.display = 'none';
    }
}

function hideLoading() {
    showLoading(false);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
