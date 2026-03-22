// RouteLogger - 認証UI（ログイン/登録ダイアログ）

import { sendSignInLink, registerUser } from './auth.js';
import { toggleVisibility } from './ui-common.js';

/**
 * ログインダイアログを表示
 */
export function showLoginDialog() {
    const emailInput = document.getElementById('loginEmailInput');
    const sentMsg = document.getElementById('loginSentMsg');
    const sendBtn = document.getElementById('loginSendBtn');

    if (emailInput) emailInput.value = localStorage.getItem('routeLogger_emailForSignIn') || '';
    if (sentMsg) sentMsg.classList.add('hidden');
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Sign-in Link';
    }

    toggleVisibility('loginDialog', true);
}

/**
 * ログインダイアログを閉じる
 */
export function closeLoginDialog() {
    toggleVisibility('loginDialog', false);
}

/**
 * ユーザー登録ダイアログを表示
 * @param {string} email - サインイン済みのメールアドレス
 */
export function showRegisterDialog(email) {
    const emailDisplay = document.getElementById('registerEmailDisplay');
    const usernameInput = document.getElementById('registerUsernameInput');
    const displayNameInput = document.getElementById('registerDisplayNameInput');
    const errorMsg = document.getElementById('registerErrorMsg');
    const submitBtn = document.getElementById('registerSubmitBtn');

    if (emailDisplay) emailDisplay.value = email || '';
    if (usernameInput) usernameInput.value = '';
    if (displayNameInput) displayNameInput.value = '';
    if (errorMsg) errorMsg.textContent = '';
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
    }

    toggleVisibility('registerDialog', true);
}

/**
 * ユーザー登録ダイアログを閉じる
 */
export function closeRegisterDialog() {
    toggleVisibility('registerDialog', false);
}

/**
 * 認証UIのイベントリスナーを初期化
 * @param {Function} onRegisterComplete - 登録完了時のコールバック(userInfo)
 */
export function initAuthUI(onRegisterComplete) {
    // ログインダイアログ - 送信ボタン
    const loginSendBtn = document.getElementById('loginSendBtn');
    if (loginSendBtn) {
        loginSendBtn.addEventListener('click', async () => {
            const email = document.getElementById('loginEmailInput')?.value?.trim();
            if (!email) {
                alert('メールアドレスを入力してください');
                return;
            }
            loginSendBtn.disabled = true;
            loginSendBtn.textContent = 'Sending...';
            try {
                await sendSignInLink(email);
                document.getElementById('loginSentMsg')?.classList.remove('hidden');
                loginSendBtn.textContent = 'Send Sign-in Link';
            } catch (error) {
                console.error('サインインリンク送信エラー:', error);
                alert('送信に失敗しました: ' + error.message);
                loginSendBtn.disabled = false;
                loginSendBtn.textContent = 'Send Sign-in Link';
            }
        });
    }

    // ログインダイアログ - 再送信ボタン
    const loginResendBtn = document.getElementById('loginResendBtn');
    if (loginResendBtn) {
        loginResendBtn.addEventListener('click', async () => {
            const email = document.getElementById('loginEmailInput')?.value?.trim();
            if (!email) return;
            loginResendBtn.disabled = true;
            try {
                await sendSignInLink(email);
                alert('サインインリンクを再送信しました');
            } catch (error) {
                alert('再送信に失敗しました: ' + error.message);
            } finally {
                loginResendBtn.disabled = false;
            }
        });
    }

    // 登録ダイアログ - 登録ボタン
    const registerSubmitBtn = document.getElementById('registerSubmitBtn');
    if (registerSubmitBtn) {
        registerSubmitBtn.addEventListener('click', async () => {
            const username = document.getElementById('registerUsernameInput')?.value?.trim();
            const displayName = document.getElementById('registerDisplayNameInput')?.value?.trim();
            const errorMsg = document.getElementById('registerErrorMsg');

            if (errorMsg) errorMsg.textContent = '';
            registerSubmitBtn.disabled = true;
            registerSubmitBtn.textContent = 'Registering...';
            try {
                const userInfo = await registerUser(username, displayName);
                closeRegisterDialog();
                if (onRegisterComplete) onRegisterComplete(userInfo);
            } catch (error) {
                if (errorMsg) errorMsg.textContent = error.message;
                registerSubmitBtn.disabled = false;
                registerSubmitBtn.textContent = 'Register';
            }
        });
    }
}
