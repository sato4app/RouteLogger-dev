// RouteLogger - Settings & Clock UI

import * as state from './state.js';
import {
    DEFAULT_PHOTO_RESOLUTION_LEVEL, DEFAULT_PHOTO_QUALITY, DEFAULT_THUMBNAIL_SIZE,
    DEFAULT_MARKER_COLOR_EMERGENCY, DEFAULT_MARKER_COLOR_ROUTE, DEFAULT_MARKER_COLOR_SPOT,
    DEFAULT_MARKER_COLOR_TRACK, DEFAULT_MARKER_COLOR_PHOTO,
    DEFAULT_MARKER_SIZE_EMERGENCY, DEFAULT_MARKER_SIZE_ROUTE, DEFAULT_MARKER_SIZE_SPOT,
    DEFAULT_MARKER_SIZE_TRACK, DEFAULT_MARKER_SIZE_PHOTO,
    HIDDEN_SETTINGS_TAP_COUNT, HIDDEN_SETTINGS_TAP_SEC
} from './config.js';
import { toggleVisibility } from './ui-common.js';
import { checkAndUpdateUserStatus } from './ui-auth.js';
import {
    displayEmergencyPoints, clearEmergencyPoints,
    displayHikingRoute, clearHikingRoute,
    applyTrackingPathStyle, refreshPhotoMarkerIcons
} from './map.js';


/**
 * 時計をclearBtnの横位置に合わせる
 */
function alignClockToClearBtn() {
    const clockDisplay = document.getElementById('clockDisplay');
    const startBtn = document.getElementById('startBtn');
    if (!clockDisplay || !startBtn) return;
    const rect = startBtn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    clockDisplay.style.left = centerX + 'px';
}

/**
 * 時計表示の初期化
 */
export function initClock() {
    updateClock();
    alignClockToClearBtn();
    window.addEventListener('resize', alignClockToClearBtn);

    setInterval(updateClock, 1000);
}

/**
 * 時計表示の更新
 */
function updateClock() {
    const clockDisplay = document.getElementById('clockDisplay');
    if (!clockDisplay) return;

    if (!state.isClockVisible) {
        clockDisplay.classList.add('hidden');
        return;
    } else {
        clockDisplay.classList.remove('hidden');
    }

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    clockDisplay.textContent = `${hours}:${minutes}`;
}

/**
 * ユーザー接続UIを更新（ui-auth.jsに委譲）
 */
export function updateSettingsUserInfo() {
    checkAndUpdateUserStatus();
}

/**
 * 設定ダイアログを表示
 */
export function showSettingsDialog() {
    // Use Firebase ON の場合、登録状態を確認して更新
    if (state.isFirebaseEnabled) {
        checkAndUpdateUserStatus();
    }

    // 現在の設定値をUIに反映
    const showClockToggle = document.getElementById('showClockToggle');
    if (showClockToggle) {
        showClockToggle.checked = state.isClockVisible;
    }

    const useFirebaseToggle = document.getElementById('useFirebaseToggle');
    if (useFirebaseToggle) {
        useFirebaseToggle.checked = state.isFirebaseEnabled;
    }

    const userConnectSection = document.getElementById('userConnectSection');
    if (userConnectSection) {
        userConnectSection.classList.toggle('hidden', !state.isFirebaseEnabled);
    }

    const showFacingToggle = document.getElementById('showFacingToggle');
    if (showFacingToggle) {
        showFacingToggle.checked = state.isShowFacingButtons;
    }

    const minooEmergencyToggle = document.getElementById('minooEmergencyToggle');
    if (minooEmergencyToggle) {
        minooEmergencyToggle.checked = state.isMinooEmergencyEnabled;
    }

    const minooHikingRouteToggle = document.getElementById('minooHikingRouteToggle');
    if (minooHikingRouteToggle) {
        minooHikingRouteToggle.checked = state.isMinooHikingRouteEnabled;
    }

    // アプリバージョン（ブラウザに存在するキャッシュ名）を表示
    const appVersionDisplay = document.getElementById('appVersionDisplay');
    if (appVersionDisplay) {
        if ('caches' in window) {
            caches.keys()
                .then(keys => {
                    appVersionDisplay.textContent = keys.length > 0 ? keys.join(', ') : '不明';
                })
                .catch(() => {
                    appVersionDisplay.textContent = '取得失敗';
                });
        } else {
            appVersionDisplay.textContent = '非対応';
        }
    }

    toggleVisibility('settingsDialog', true);
}

/**
 * 設定ダイアログを閉じる
 */
export function closeSettingsDialog() {
    // 画面設定等を非表示に戻す
    const advSection = document.getElementById('advancedSettingsSection');
    if (advSection) advSection.classList.add('hidden');
    toggleVisibility('settingsDialog', false);
}

/**
 * 設定関連のイベント初期化
 */
export function initSettings() {
    // Toggle Switch
    const showClockToggle = document.getElementById('showClockToggle');
    if (showClockToggle) {
        showClockToggle.addEventListener('change', (e) => {
            state.setIsClockVisible(e.target.checked);
            updateClock();

            // 設定を保存（簡易的にlocalStorage使用）
            localStorage.setItem('routeLogger_showClock', e.target.checked);
        });
    }

    // Close Button
    const closeBtn = document.getElementById('closeSettingsBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSettingsDialog);
    }

    // アプリバージョンのラベル部分を連続タップで「画面設定等」を表示
    const appVersionLabel = document.getElementById('appVersionLabel');
    if (appVersionLabel) {
        let _tapTimestamps = [];
        appVersionLabel.addEventListener('click', () => {
            const now = Date.now();
            _tapTimestamps.push(now);
            // 判定ウィンドウ外のタップを除去
            _tapTimestamps = _tapTimestamps.filter(t => now - t <= HIDDEN_SETTINGS_TAP_SEC * 1000);
            if (_tapTimestamps.length >= HIDDEN_SETTINGS_TAP_COUNT) {
                _tapTimestamps = [];
                const advSection = document.getElementById('advancedSettingsSection');
                if (advSection) advSection.classList.remove('hidden');
            }
        });
    }

    // Load saved settings
    const savedClockSetting = localStorage.getItem('routeLogger_showClock');
    if (savedClockSetting !== null) {
        state.setIsClockVisible(savedClockSetting === 'true');
        // updateClock() will be called by initClock() later
    }

    // Firebase Toggle
    const useFirebaseToggle = document.getElementById('useFirebaseToggle');
    if (useFirebaseToggle) {
        useFirebaseToggle.addEventListener('change', (e) => {
            state.setIsFirebaseEnabled(e.target.checked);
            localStorage.setItem('routeLogger_useFirebase', e.target.checked);
            const userConnectSection = document.getElementById('userConnectSection');
            if (userConnectSection) {
                userConnectSection.classList.toggle('hidden', !e.target.checked);
            }
            // チェックON時: userAdminの登録状態を確認
            if (e.target.checked) {
                checkAndUpdateUserStatus();
            }
        });
    }
    const savedFirebaseSetting = localStorage.getItem('routeLogger_useFirebase');
    if (savedFirebaseSetting !== null) {
        state.setIsFirebaseEnabled(savedFirebaseSetting === 'true');
    }

    // Show Facing Buttons Toggle
    const showFacingToggle = document.getElementById('showFacingToggle');
    if (showFacingToggle) {
        showFacingToggle.addEventListener('change', (e) => {
            state.setIsShowFacingButtons(e.target.checked);
            localStorage.setItem('routeLogger_showFacingButtons', e.target.checked);
        });
    }
    const savedFacingSetting = localStorage.getItem('routeLogger_showFacingButtons');
    if (savedFacingSetting !== null) {
        state.setIsShowFacingButtons(savedFacingSetting === 'true');
    }

    // Minoo Emergency Toggle
    const minooEmergencyToggle = document.getElementById('minooEmergencyToggle');
    if (minooEmergencyToggle) {
        minooEmergencyToggle.addEventListener('change', (e) => {
            state.setIsMinooEmergencyEnabled(e.target.checked);
            localStorage.setItem('routeLogger_minooEmergency', e.target.checked);
        });
    }
    const savedMinooEmergency = localStorage.getItem('routeLogger_minooEmergency');
    if (savedMinooEmergency !== null) {
        state.setIsMinooEmergencyEnabled(savedMinooEmergency === 'true');
    }

    // Minoo Hiking Route Toggle
    const minooHikingRouteToggle = document.getElementById('minooHikingRouteToggle');
    if (minooHikingRouteToggle) {
        minooHikingRouteToggle.addEventListener('change', (e) => {
            state.setIsMinooHikingRouteEnabled(e.target.checked);
            localStorage.setItem('routeLogger_minooHikingRoute', e.target.checked);
        });
    }
    const savedMinooHikingRoute = localStorage.getItem('routeLogger_minooHikingRoute');
    if (savedMinooHikingRoute !== null) {
        state.setIsMinooHikingRouteEnabled(savedMinooHikingRoute === 'true');
    }

    // ── 画像設定パネル ──────────────────────────────────────────────────────────
    const resolutionLabels = ['720×1280px（高）', '360×640px（中）', '180×320px（低）'];
    const photoResolutionSlider = document.getElementById('photoResolutionSlider');
    const photoResolutionLabel  = document.getElementById('photoResolutionLabel');
    const photoQualitySlider    = document.getElementById('photoQualitySlider');
    const photoQualityInput     = document.getElementById('photoQualityInput');
    const thumbnailSizeSlider   = document.getElementById('thumbnailSizeSlider');
    const thumbnailSizeInput    = document.getElementById('thumbnailSizeInput');

    // パネル内スライダーのUI同期（stateには反映しない）
    if (photoResolutionSlider) {
        photoResolutionSlider.addEventListener('input', (e) => {
            if (photoResolutionLabel) photoResolutionLabel.textContent = resolutionLabels[parseInt(e.target.value)];
        });
    }
    if (photoQualitySlider) {
        photoQualitySlider.addEventListener('input', (e) => {
            if (photoQualityInput) photoQualityInput.value = e.target.value;
        });
    }
    if (photoQualityInput) {
        photoQualityInput.addEventListener('change', (e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) {
                if (photoQualitySlider) photoQualitySlider.value = Math.min(80, Math.max(60, v));
            }
        });
    }
    if (thumbnailSizeSlider) {
        thumbnailSizeSlider.addEventListener('input', (e) => {
            if (thumbnailSizeInput) thumbnailSizeInput.value = e.target.value;
        });
    }
    if (thumbnailSizeInput) {
        thumbnailSizeInput.addEventListener('change', (e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) {
                if (thumbnailSizeSlider) thumbnailSizeSlider.value = Math.min(320, Math.max(80, v));
            }
        });
    }

    // パネル切替ボタン
    const imageSettingsBtn = document.getElementById('imageSettingsBtn');
    const markerColorBtn   = document.getElementById('markerColorBtn');

    // パネルを開く: 現在のstateをスライダーに反映
    function openImageSettingsPanel() {
        if (photoResolutionSlider) photoResolutionSlider.value = state.photoResolutionLevel;
        if (photoResolutionLabel)  photoResolutionLabel.textContent = resolutionLabels[state.photoResolutionLevel];
        if (photoQualitySlider)    photoQualitySlider.value = state.photoQuality;
        if (photoQualityInput)     photoQualityInput.value  = state.photoQuality;
        if (thumbnailSizeSlider)   thumbnailSizeSlider.value = state.thumbnailSize;
        if (thumbnailSizeInput)    thumbnailSizeInput.value  = state.thumbnailSize;
        const section = document.getElementById('imageSettingsSection');
        if (section) section.classList.remove('hidden');
        imageSettingsBtn?.classList.replace('secondary-btn', 'primary-btn');
    }

    // パネルを閉じる
    function closeImageSettingsPanel() {
        const section = document.getElementById('imageSettingsSection');
        if (section) section.classList.add('hidden');
        imageSettingsBtn?.classList.replace('primary-btn', 'secondary-btn');
    }

    // スライダー・テキスト入力値をstateとlocalStorageに確定保存
    function applyImageSettings() {
        const level = parseInt(photoResolutionSlider?.value ?? state.photoResolutionLevel);
        const rawQuality = parseInt(photoQualityInput?.value ?? photoQualitySlider?.value ?? state.photoQuality);
        const quality = isNaN(rawQuality) ? state.photoQuality : rawQuality;
        const rawThumb = parseInt(thumbnailSizeInput?.value ?? thumbnailSizeSlider?.value ?? state.thumbnailSize);
        const thumb = isNaN(rawThumb) ? state.thumbnailSize : rawThumb;
        state.setPhotoResolutionLevel(level);
        state.setPhotoQuality(quality);
        state.setThumbnailSize(thumb);
        localStorage.setItem('routeLogger_photoResolution', level);
        localStorage.setItem('routeLogger_photoQuality', quality);
        localStorage.setItem('routeLogger_thumbnailSize', thumb);
    }

    // 規定値をスライダーに反映（stateには反映しない）
    function resetImageSettingsToDefaults() {
        if (photoResolutionSlider) photoResolutionSlider.value = DEFAULT_PHOTO_RESOLUTION_LEVEL;
        if (photoResolutionLabel)  photoResolutionLabel.textContent = resolutionLabels[DEFAULT_PHOTO_RESOLUTION_LEVEL];
        if (photoQualitySlider)    photoQualitySlider.value = DEFAULT_PHOTO_QUALITY;
        if (photoQualityInput)     photoQualityInput.value  = DEFAULT_PHOTO_QUALITY;
        if (thumbnailSizeSlider)   thumbnailSizeSlider.value = DEFAULT_THUMBNAIL_SIZE;
        if (thumbnailSizeInput)    thumbnailSizeInput.value  = DEFAULT_THUMBNAIL_SIZE;
    }

    // ── マーカー色設定パネル ────────────────────────────────────────────────────
    const emergencyColorPicker = document.getElementById('emergencyColorPicker');
    const emergencyColorInput  = document.getElementById('emergencyColorInput');
    const emergencySizeInput   = document.getElementById('emergencySizeInput');
    const routeColorPicker     = document.getElementById('routeColorPicker');
    const routeColorInput      = document.getElementById('routeColorInput');
    const routeSizeInput       = document.getElementById('routeSizeInput');
    const spotColorPicker      = document.getElementById('spotColorPicker');
    const spotColorInput       = document.getElementById('spotColorInput');
    const spotSizeInput        = document.getElementById('spotSizeInput');
    const trackColorPicker     = document.getElementById('trackColorPicker');
    const trackColorInput      = document.getElementById('trackColorInput');
    const trackSizeInput       = document.getElementById('trackSizeInput');
    const photoColorPicker     = document.getElementById('photoColorPicker');
    const photoColorInput      = document.getElementById('photoColorInput');
    const photoSizeInput       = document.getElementById('photoSizeInput');

    // カラーピッカー ↔ テキスト入力の双方向同期
    function syncColorPair(picker, input) {
        if (picker && input) {
            picker.addEventListener('input', (e) => { input.value = e.target.value; });
            input.addEventListener('change', (e) => {
                const v = e.target.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(v)) picker.value = v.toLowerCase();
            });
        }
    }
    syncColorPair(emergencyColorPicker, emergencyColorInput);
    syncColorPair(routeColorPicker, routeColorInput);
    syncColorPair(spotColorPicker, spotColorInput);
    syncColorPair(trackColorPicker, trackColorInput);
    syncColorPair(photoColorPicker, photoColorInput);

    function openMarkerColorPanel() {
        if (emergencyColorPicker) emergencyColorPicker.value = state.markerColorEmergency;
        if (emergencyColorInput)  emergencyColorInput.value  = state.markerColorEmergency;
        if (emergencySizeInput)   emergencySizeInput.value   = state.markerSizeEmergency;
        if (routeColorPicker)     routeColorPicker.value     = state.markerColorRoute;
        if (routeColorInput)      routeColorInput.value      = state.markerColorRoute;
        if (routeSizeInput)       routeSizeInput.value       = state.markerSizeRoute;
        if (spotColorPicker)      spotColorPicker.value      = state.markerColorSpot;
        if (spotColorInput)       spotColorInput.value       = state.markerColorSpot;
        if (spotSizeInput)        spotSizeInput.value        = state.markerSizeSpot;
        if (trackColorPicker)     trackColorPicker.value     = state.markerColorTrack;
        if (trackColorInput)      trackColorInput.value      = state.markerColorTrack;
        if (trackSizeInput)       trackSizeInput.value       = state.markerSizeTrack;
        if (photoColorPicker)     photoColorPicker.value     = state.markerColorPhoto;
        if (photoColorInput)      photoColorInput.value      = state.markerColorPhoto;
        if (photoSizeInput)       photoSizeInput.value       = state.markerSizePhoto;
        document.getElementById('markerColorSection')?.classList.remove('hidden');
        markerColorBtn?.classList.replace('secondary-btn', 'primary-btn');
    }

    function closeMarkerColorPanel() {
        document.getElementById('markerColorSection')?.classList.add('hidden');
        markerColorBtn?.classList.replace('primary-btn', 'secondary-btn');
    }

    async function applyMarkerColors() {
        const hexRe = /^#[0-9a-fA-F]{6}$/;
        const pick = (textEl, pickerEl, current) => {
            const v = textEl?.value.trim();
            if (hexRe.test(v)) return v;
            return pickerEl?.value || current;
        };
        const eColor = pick(emergencyColorInput, emergencyColorPicker, state.markerColorEmergency);
        const rColor = pick(routeColorInput,     routeColorPicker,     state.markerColorRoute);
        const sColor = pick(spotColorInput,      spotColorPicker,      state.markerColorSpot);
        const tColor = pick(trackColorInput,     trackColorPicker,     state.markerColorTrack);
        const pColor = pick(photoColorInput,     photoColorPicker,     state.markerColorPhoto);
        state.setMarkerColorEmergency(eColor);
        state.setMarkerColorRoute(rColor);
        state.setMarkerColorSpot(sColor);
        state.setMarkerColorTrack(tColor);
        state.setMarkerColorPhoto(pColor);
        localStorage.setItem('routeLogger_markerColorEmergency', eColor);
        localStorage.setItem('routeLogger_markerColorRoute',     rColor);
        localStorage.setItem('routeLogger_markerColorSpot',      sColor);
        localStorage.setItem('routeLogger_markerColorTrack',     tColor);
        localStorage.setItem('routeLogger_markerColorPhoto',     pColor);

        const eSize = parseInt(emergencySizeInput?.value) || state.markerSizeEmergency;
        const rSize = parseInt(routeSizeInput?.value)     || state.markerSizeRoute;
        const sSize = parseInt(spotSizeInput?.value)      || state.markerSizeSpot;
        const tSize = parseInt(trackSizeInput?.value)     || state.markerSizeTrack;
        const pSize = parseInt(photoSizeInput?.value)     || state.markerSizePhoto;
        state.setMarkerSizeEmergency(eSize);
        state.setMarkerSizeRoute(rSize);
        state.setMarkerSizeSpot(sSize);
        state.setMarkerSizeTrack(tSize);
        state.setMarkerSizePhoto(pSize);
        localStorage.setItem('routeLogger_markerSizeEmergency', eSize);
        localStorage.setItem('routeLogger_markerSizeRoute',     rSize);
        localStorage.setItem('routeLogger_markerSizeSpot',      sSize);
        localStorage.setItem('routeLogger_markerSizeTrack',     tSize);
        localStorage.setItem('routeLogger_markerSizePhoto',     pSize);

        // 表示中のレイヤーを再描画して変更を反映
        if (state.isMinooEmergencyEnabled) {
            clearEmergencyPoints();
            await displayEmergencyPoints();
        }
        if (state.isMinooHikingRouteEnabled) {
            clearHikingRoute();
            await displayHikingRoute();
        }
        applyTrackingPathStyle();
        refreshPhotoMarkerIcons();
    }

    function resetMarkerColorsToDefaults() {
        if (emergencyColorPicker) emergencyColorPicker.value = DEFAULT_MARKER_COLOR_EMERGENCY;
        if (emergencyColorInput)  emergencyColorInput.value  = DEFAULT_MARKER_COLOR_EMERGENCY;
        if (emergencySizeInput)   emergencySizeInput.value   = DEFAULT_MARKER_SIZE_EMERGENCY;
        if (routeColorPicker)     routeColorPicker.value     = DEFAULT_MARKER_COLOR_ROUTE;
        if (routeColorInput)      routeColorInput.value      = DEFAULT_MARKER_COLOR_ROUTE;
        if (routeSizeInput)       routeSizeInput.value       = DEFAULT_MARKER_SIZE_ROUTE;
        if (spotColorPicker)      spotColorPicker.value      = DEFAULT_MARKER_COLOR_SPOT;
        if (spotColorInput)       spotColorInput.value       = DEFAULT_MARKER_COLOR_SPOT;
        if (spotSizeInput)        spotSizeInput.value        = DEFAULT_MARKER_SIZE_SPOT;
        if (trackColorPicker)     trackColorPicker.value     = DEFAULT_MARKER_COLOR_TRACK;
        if (trackColorInput)      trackColorInput.value      = DEFAULT_MARKER_COLOR_TRACK;
        if (trackSizeInput)       trackSizeInput.value       = DEFAULT_MARKER_SIZE_TRACK;
        if (photoColorPicker)     photoColorPicker.value     = DEFAULT_MARKER_COLOR_PHOTO;
        if (photoColorInput)      photoColorInput.value      = DEFAULT_MARKER_COLOR_PHOTO;
        if (photoSizeInput)       photoSizeInput.value       = DEFAULT_MARKER_SIZE_PHOTO;
    }

    // ── パネル切替 ─────────────────────────────────────────────────────────────
    if (imageSettingsBtn) {
        imageSettingsBtn.addEventListener('click', () => {
            closeMarkerColorPanel();
            openImageSettingsPanel();
        });
    }
    if (markerColorBtn) {
        markerColorBtn.addEventListener('click', () => {
            closeImageSettingsPanel();
            openMarkerColorPanel();
        });
    }

    // ── 共通 Save / Default / Cancel ────────────────────────────────────────────
    const imageSettingsSaveBtn = document.getElementById('imageSettingsSaveBtn');
    const imageSettingsDefaultBtn = document.getElementById('imageSettingsDefaultBtn');
    const imageSettingsCancelBtn  = document.getElementById('imageSettingsCancelBtn');

    function isImagePanelOpen() {
        return !document.getElementById('imageSettingsSection')?.classList.contains('hidden');
    }
    function isColorPanelOpen() {
        return !document.getElementById('markerColorSection')?.classList.contains('hidden');
    }

    if (imageSettingsSaveBtn) imageSettingsSaveBtn.addEventListener('click', async () => {
        if (isImagePanelOpen()) {
            applyImageSettings();
            closeImageSettingsPanel();
        } else if (isColorPanelOpen()) {
            await applyMarkerColors();
            closeMarkerColorPanel();
        }
        document.getElementById('advancedSettingsSection')?.classList.add('hidden');
    });
    if (imageSettingsDefaultBtn) imageSettingsDefaultBtn.addEventListener('click', () => {
        if (isImagePanelOpen())       resetImageSettingsToDefaults();
        else if (isColorPanelOpen())  resetMarkerColorsToDefaults();
    });
    if (imageSettingsCancelBtn) imageSettingsCancelBtn.addEventListener('click', () => {
        closeImageSettingsPanel();
        closeMarkerColorPanel();
        document.getElementById('advancedSettingsSection')?.classList.add('hidden');
    });

    // ── 過去データDrive移行 ──────────────────────────────────────────────────────
    let _migrateListLoaded = false;

    function _renderMigrateList(names) {
        const listEl = document.getElementById('migrateList');
        if (!listEl) return;
        if (names.length === 0) {
            listEl.innerHTML = '<span style="font-size:0.8em;color:#888;">該当なし</span>';
            return;
        }
        listEl.innerHTML = names.map(name =>
            `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:0.85em;cursor:pointer;">` +
            `<input type="checkbox" class="migrate-check" value="${name}">` +
            `<span>${name}</span></label>`
        ).join('');
    }

    async function _loadMigrateList(prefix = '') {
        const listEl = document.getElementById('migrateList');
        const msg = document.getElementById('migrateToDriveMsg');
        if (!listEl) return;
        listEl.innerHTML = '<span style="font-size:0.8em;color:#888;">読み込み中...</span>';
        if (msg) msg.textContent = '';
        try {
            const snapshot = await firebase.firestore().collection('tracks')
                .orderBy(firebase.firestore.FieldPath.documentId())
                .get();
            let names = snapshot.docs.map(d => d.id);
            if (prefix) names = names.filter(n => n.startsWith(prefix));
            _renderMigrateList(names);
        } catch (e) {
            listEl.innerHTML = '';
            if (msg) msg.textContent = `読み込みエラー: ${e.message}`;
        }
    }

    const migrateToggleBtn   = document.getElementById('migrateToggleBtn');
    const migrateSearchBtn   = document.getElementById('migrateSearchBtn');
    const migrateSelectAllBtn = document.getElementById('migrateSelectAllBtn');
    const migrateExecBtn     = document.getElementById('migrateExecBtn');

    if (migrateToggleBtn) {
        migrateToggleBtn.addEventListener('click', async () => {
            const panel = document.getElementById('migratePanel');
            if (!panel) return;
            const isOpen = !panel.classList.contains('hidden');
            if (isOpen) {
                panel.classList.add('hidden');
                migrateToggleBtn.textContent = '▶';
            } else {
                panel.classList.remove('hidden');
                migrateToggleBtn.textContent = '▼';
                if (!_migrateListLoaded) {
                    await _loadMigrateList();
                    _migrateListLoaded = true;
                }
            }
        });
    }

    if (migrateSearchBtn) {
        migrateSearchBtn.addEventListener('click', async () => {
            const prefix = document.getElementById('migratePrefixInput')?.value?.trim() ?? '';
            await _loadMigrateList(prefix);
        });
    }

    document.getElementById('migratePrefixInput')?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const prefix = e.target.value.trim();
            await _loadMigrateList(prefix);
        }
    });

    if (migrateSelectAllBtn) {
        migrateSelectAllBtn.addEventListener('click', () => {
            const checks = document.querySelectorAll('.migrate-check');
            const allChecked = [...checks].every(c => c.checked);
            checks.forEach(c => c.checked = !allChecked);
            migrateSelectAllBtn.textContent = allChecked ? '全選択' : '全解除';
        });
    }

    if (migrateExecBtn) {
        migrateExecBtn.addEventListener('click', async () => {
            const msg = document.getElementById('migrateToDriveMsg');
            const selected = [...document.querySelectorAll('.migrate-check:checked')].map(c => c.value);
            if (selected.length === 0) { if (msg) msg.textContent = 'routelogを選択してください'; return; }

            migrateExecBtn.disabled = true;
            const fn = firebase.app().functions('asia-northeast1').httpsCallable('migrateRoutesToDrive', { timeout: 540000 });
            let ok = 0, ng = 0;
            for (let i = 0; i < selected.length; i++) {
                if (msg) msg.textContent = `実行中... (${i + 1}/${selected.length})`;
                try {
                    await fn({ projectName: selected[i] });
                    ok++;
                } catch (e) {
                    ng++;
                    console.warn(`${selected[i]} 移行失敗:`, e.message);
                }
            }
            if (msg) msg.textContent = `完了: 成功 ${ok}件${ng > 0 ? `、失敗 ${ng}件` : ''}`;
            migrateExecBtn.disabled = false;
        });
    }

    // 起動時: localStorageの保存値をstateに反映
    const savedResolution = localStorage.getItem('routeLogger_photoResolution');
    if (savedResolution !== null) state.setPhotoResolutionLevel(parseInt(savedResolution));

    const savedQuality = localStorage.getItem('routeLogger_photoQuality');
    if (savedQuality !== null) state.setPhotoQuality(parseInt(savedQuality));

    const savedThumbnail = localStorage.getItem('routeLogger_thumbnailSize');
    if (savedThumbnail !== null) state.setThumbnailSize(parseInt(savedThumbnail));

    const savedEmergencyColor = localStorage.getItem('routeLogger_markerColorEmergency');
    if (savedEmergencyColor) state.setMarkerColorEmergency(savedEmergencyColor);
    const savedRouteColor = localStorage.getItem('routeLogger_markerColorRoute');
    if (savedRouteColor) state.setMarkerColorRoute(savedRouteColor);
    const savedSpotColor = localStorage.getItem('routeLogger_markerColorSpot');
    if (savedSpotColor) state.setMarkerColorSpot(savedSpotColor);
    const savedTrackColor = localStorage.getItem('routeLogger_markerColorTrack');
    if (savedTrackColor) state.setMarkerColorTrack(savedTrackColor);
    const savedPhotoColor = localStorage.getItem('routeLogger_markerColorPhoto');
    if (savedPhotoColor) state.setMarkerColorPhoto(savedPhotoColor);

    const savedEmergencySize = localStorage.getItem('routeLogger_markerSizeEmergency');
    if (savedEmergencySize !== null) state.setMarkerSizeEmergency(parseInt(savedEmergencySize));
    const savedRouteSize = localStorage.getItem('routeLogger_markerSizeRoute');
    if (savedRouteSize !== null) state.setMarkerSizeRoute(parseInt(savedRouteSize));
    const savedSpotSize = localStorage.getItem('routeLogger_markerSizeSpot');
    if (savedSpotSize !== null) state.setMarkerSizeSpot(parseInt(savedSpotSize));
    const savedTrackSize = localStorage.getItem('routeLogger_markerSizeTrack');
    if (savedTrackSize !== null) state.setMarkerSizeTrack(parseInt(savedTrackSize));
    const savedPhotoSize = localStorage.getItem('routeLogger_markerSizePhoto');
    if (savedPhotoSize !== null) state.setMarkerSizePhoto(parseInt(savedPhotoSize));
}
