// RouteLogger - UI 共通機能

import { isTracking } from './state.js';

// Save/Load中のスリープ防止用Wake Lock
let _busyWakeLock = null;

// メッセージ自動非表示用タイマー
let _statusHideTimer = null;
const STATUS_AUTO_HIDE_MS = 10000;

// メッセージ履歴（localStorage キー）
const MESSAGE_HISTORY_KEY = 'routeLogger_messageHistory';
const MESSAGE_HISTORY_MAX = 200;

// 現在のアプリバージョン（キャッシュ名）。起動時に解決される。
let _appVersionCache = null;

/**
 * アプリバージョン（Service Workerキャッシュ名）を取得
 * @returns {Promise<string>}
 */
async function resolveAppVersion() {
    if (_appVersionCache) return _appVersionCache;
    if ('caches' in window) {
        try {
            const keys = await caches.keys();
            const swCache = keys.find(k => k.startsWith('routelogger-') || k.startsWith('RLog-'));
            _appVersionCache = swCache || (keys[0] || '不明');
        } catch (e) {
            _appVersionCache = '取得失敗';
        }
    } else {
        _appVersionCache = '非対応';
    }
    return _appVersionCache;
}

/**
 * メッセージを履歴に追加
 * @param {string} message
 */
function appendMessageHistory(message) {
    if (!message) return;
    try {
        const raw = localStorage.getItem(MESSAGE_HISTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        // 直前と同じ内容は重複保存しない
        const last = list.length > 0 ? list[list.length - 1] : null;
        if (last && last.message === message) return;
        list.push({
            timestamp: Date.now(),
            version: _appVersionCache || '',
            message: message
        });
        // 件数上限を超えたら古いものから削除
        while (list.length > MESSAGE_HISTORY_MAX) list.shift();
        localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn('メッセージ履歴保存エラー:', e);
    }
}

/**
 * メッセージ履歴を取得（新しい順）
 * @returns {Array<{timestamp:number, version:string, message:string}>}
 */
export function getMessageHistory() {
    try {
        const raw = localStorage.getItem(MESSAGE_HISTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return list.slice().reverse();
    } catch (e) {
        return [];
    }
}

/**
 * メッセージ履歴をクリア
 */
export function clearMessageHistory() {
    try {
        localStorage.removeItem(MESSAGE_HISTORY_KEY);
    } catch (e) { /* 無視 */ }
}

// 起動時にアプリバージョンを解決しておく
resolveAppVersion();

/**
 * iOS「シェイクで取り消し」ダイアログ防止のため、テキスト入力のundoヒストリをクリア。
 * - 全テキスト系入力をblur
 * - disabledトグル＋value再設定でundoスタックを実効的にリセット
 * - 編集中(activeElement)はスキップ
 *
 * トラッキング中はWake Lockで画面が消えないため visibilitychange が発火しない。
 * よって、ポケット歩行前に呼び出されるトリガー（記録開始時・ダイアログ閉時等）から
 * 明示的に呼ぶ必要がある。
 */
export function clearInputUndoHistory() {
    const selector = 'input[type="text"], input[type="email"], input[type="search"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"], textarea';
    document.querySelectorAll(selector).forEach(el => {
        // 現在編集中の入力は触らない
        if (document.activeElement === el) return;
        try {
            const val = el.value;
            el.blur();
            // disabledを一瞬トグルしてiOSの編集状態を解除
            const wasDisabled = el.disabled;
            el.disabled = true;
            el.value = '';
            el.disabled = wasDisabled;
            el.value = val;
        } catch (e) {
            /* 無視 */
        }
    });
}

/**
 * UIのビジー状態を設定（Save/Load中など）
 * @param {boolean} isBusy
 */
export function setUiBusy(isBusy) {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const photoBtn = document.getElementById('photoBtn');
    const dataBtn = document.getElementById('dataBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const dataSaveBtn = document.getElementById('dataSaveBtn');
    const dataReloadBtn = document.getElementById('dataReloadBtn');

    if (isBusy) {
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
        if (photoBtn) photoBtn.disabled = true;
        if (dataBtn) dataBtn.disabled = true;
        if (settingsBtn) settingsBtn.disabled = true;
        if (dataSaveBtn) dataSaveBtn.disabled = true;
        if (dataReloadBtn) dataReloadBtn.disabled = true;
        // Save/Load中のスリープを防止
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').then(lock => {
                _busyWakeLock = lock;
            }).catch(err => {
                console.warn('Wake Lock取得エラー (busy):', err);
            });
        }
    } else {
        updateUiForTrackingState();
        // Save/Load完了後にWake Lockを解放
        if (_busyWakeLock !== null) {
            _busyWakeLock.release().catch(err => {
                console.warn('Wake Lock解放エラー (busy):', err);
            });
            _busyWakeLock = null;
        }
    }
}

/**
 * トラッキング状態に基づいてUIを更新
 */
export function updateUiForTrackingState() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const photoBtn = document.getElementById('photoBtn');
    const dataBtn = document.getElementById('dataBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const dataSaveBtn = document.getElementById('dataSaveBtn');
    const dataReloadBtn = document.getElementById('dataReloadBtn');

    if (isTracking) {
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (photoBtn) photoBtn.disabled = false;
        if (dataBtn) dataBtn.disabled = false;
        if (settingsBtn) settingsBtn.disabled = false;
        if (dataSaveBtn) dataSaveBtn.disabled = true;
        if (dataReloadBtn) dataReloadBtn.disabled = true;
    } else {
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (photoBtn) photoBtn.disabled = true;
        if (dataBtn) dataBtn.disabled = false;
        if (settingsBtn) settingsBtn.disabled = false;
        if (dataSaveBtn) dataSaveBtn.disabled = false;
        if (dataReloadBtn) dataReloadBtn.disabled = false;
    }
}

/**
 * HTML要素の表示・非表示を切り替え
 * @param {string} elementId - 要素ID
 * @param {boolean} isVisible - 表示するかどうか
 */
export function toggleVisibility(elementId, isVisible) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (isVisible) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

/**
 * ステータス表示を更新
 * 表示後10秒経過するとメッセージは自動的に消える。
 * 表示したメッセージは履歴に追加される。
 * @param {string} message - メッセージ
 */
export function updateStatus(message) {
    const textEl = document.getElementById('statusText');
    const statusEl = document.getElementById('status');
    if (textEl) {
        textEl.textContent = message;
    }
    // 表示中であることを保証
    if (statusEl) {
        statusEl.classList.remove('hidden');
    }
    // 履歴に追加（GPS記録中は除外）
    if (!isTracking) {
        appendMessageHistory(message);
    }
    // 10秒後にメッセージを消す（座標表示が無ければステータスバー全体を非表示）
    if (_statusHideTimer) {
        clearTimeout(_statusHideTimer);
        _statusHideTimer = null;
    }
    _statusHideTimer = setTimeout(() => {
        if (textEl) textEl.textContent = '';
        const coordsDiv = document.getElementById('coordinates');
        const hasCoords = coordsDiv && coordsDiv.innerHTML.trim() !== '';
        if (!hasCoords && statusEl) {
            statusEl.classList.add('hidden');
        }
        _statusHideTimer = null;
    }, STATUS_AUTO_HIDE_MS);
}

/**
 * 座標表示を更新
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @param {number} accuracy - 精度
 * @param {number} [distance] - 移動距離 (m)
 * @param {number} [elapsed] - 経過時間 (秒)
 */
export function updateCoordinates(lat, lng, accuracy, distance, elapsed) {
    const coordsDiv = document.getElementById('coordinates');
    if (!coordsDiv) return;

    const distText = distance !== undefined ? ` / 移動: ${Math.floor(distance)}m` : '';
    const timeText = elapsed !== undefined ? ` / 経過: ${Math.floor(elapsed)}秒` : '';

    coordsDiv.innerHTML = `
        <div style="display: flex; justify-content: center; gap: 10px;">
            <span>緯度: ${lat.toFixed(5)}</span>
            <span>経度: ${lng.toFixed(5)}</span>
        </div>
        <div>
            精度: ±${accuracy.toFixed(1)}m${distText}${timeText}
        </div>
    `;
    // 座標が更新されたらステータスバーを表示
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.classList.remove('hidden');
    }
}
