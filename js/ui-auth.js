// RouteLogger - ユーザー接続UI（設定ダイアログ内）

import { signInAnonymously, getUserByUsername, registerUser } from './auth.js';

const USERNAME_KEY = 'routeLogger_username';

/**
 * 通常表示に戻す
 */
function showNormalView() {
    document.getElementById('userNormalView')?.classList.remove('hidden');
    document.getElementById('userChangeForm')?.classList.add('hidden');
    document.getElementById('userRegisterForm')?.classList.add('hidden');
}

/**
 * ユーザー名表示を更新（通常表示状態に戻す）
 */
export function updateUserConnectUI() {
    const savedUsername = localStorage.getItem(USERNAME_KEY);
    const usernameDisplay = document.getElementById('settingsUsernameDisplay');
    const changeBtn = document.getElementById('userChangeBtn');

    if (usernameDisplay) {
        usernameDisplay.textContent = savedUsername ? `@${savedUsername}` : '（未設定）';
    }
    if (changeBtn) {
        changeBtn.classList.toggle('hidden', !savedUsername);
    }
    showNormalView();
}

/**
 * 認証UIのイベントリスナーを初期化
 */
export function initAuthUI() {
    // [変更] ボタン → 変更フォームを表示
    document.getElementById('userChangeBtn')?.addEventListener('click', () => {
        const savedUsername = localStorage.getItem(USERNAME_KEY);
        const input = document.getElementById('settingsUsernameInput');
        const msg = document.getElementById('userChangeMsg');
        if (input) input.value = savedUsername || '';
        if (msg) msg.textContent = '';
        document.getElementById('userNormalView')?.classList.add('hidden');
        document.getElementById('userChangeForm')?.classList.remove('hidden');
    });

    // [変更フォーム] 保存 → userAdminチェック後にlocalStorage更新
    document.getElementById('userChangeSaveBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('settingsUsernameInput');
        const msg = document.getElementById('userChangeMsg');
        const username = input?.value?.trim();
        if (msg) msg.textContent = '';

        if (!username) {
            if (msg) msg.textContent = 'ユーザー名を入力してください';
            return;
        }
        if (!/^[a-zA-Z0-9]+$/.test(username)) {
            if (msg) msg.textContent = 'ユーザー名は英数字のみ使用できます';
            return;
        }

        const saveBtn = document.getElementById('userChangeSaveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = '確認中...';
        try {
            await signInAnonymously();
            const userInfo = await getUserByUsername(username);
            if (!userInfo) {
                if (msg) msg.textContent = 'このユーザー名はuserAdminに登録されていません';
                return;
            }
            if (userInfo.status === 'denied' || userInfo.status === 'disabled') {
                if (msg) msg.textContent = 'このユーザーは無効化されています';
                return;
            }
            localStorage.setItem(USERNAME_KEY, username);
            updateUserConnectUI();
        } catch (e) {
            if (msg) msg.textContent = e.message;
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '保存';
        }
    });

    // [変更フォーム] キャンセル
    document.getElementById('userChangeCancelBtn')?.addEventListener('click', showNormalView);

    // [新規登録] ボタン → 登録フォームを表示（ユーザー名をデフォルト入力）
    document.getElementById('userRegisterBtn')?.addEventListener('click', () => {
        const savedUsername = localStorage.getItem(USERNAME_KEY);
        const usernameInput = document.getElementById('registerUsernameInput');
        const emailInput = document.getElementById('registerEmailInput');
        const displayNameInput = document.getElementById('registerDisplayNameInput');
        const msg = document.getElementById('userRegisterMsg');
        if (usernameInput) usernameInput.value = savedUsername || '';
        if (emailInput) emailInput.value = '';
        if (displayNameInput) displayNameInput.value = '';
        if (msg) msg.textContent = '';
        document.getElementById('userNormalView')?.classList.add('hidden');
        document.getElementById('userRegisterForm')?.classList.remove('hidden');
    });

    // [新規登録フォーム] 登録 → 重複チェック後にFirestore登録
    document.getElementById('userRegisterSaveBtn')?.addEventListener('click', async () => {
        const username = document.getElementById('registerUsernameInput')?.value?.trim();
        const email = document.getElementById('registerEmailInput')?.value?.trim();
        const displayName = document.getElementById('registerDisplayNameInput')?.value?.trim();
        const msg = document.getElementById('userRegisterMsg');
        if (msg) msg.textContent = '';

        if (!username) { if (msg) msg.textContent = 'ユーザー名を入力してください'; return; }
        if (!/^[a-zA-Z0-9]+$/.test(username)) { if (msg) msg.textContent = 'ユーザー名は英数字のみ使用できます'; return; }
        if (!email) { if (msg) msg.textContent = 'メールアドレスを入力してください'; return; }
        if (!displayName) { if (msg) msg.textContent = '氏名を入力してください'; return; }

        const saveBtn = document.getElementById('userRegisterSaveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = '登録中...';
        try {
            await signInAnonymously();
            await registerUser(username, email, displayName);
            localStorage.setItem(USERNAME_KEY, username);
            updateUserConnectUI();
        } catch (e) {
            if (msg) msg.textContent = e.message;
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '登録';
        }
    });

    // [新規登録フォーム] キャンセル
    document.getElementById('userRegisterCancelBtn')?.addEventListener('click', showNormalView);
}
