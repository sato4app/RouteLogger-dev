// RouteLogger - Firebase認証・ユーザー管理

const EMAIL_KEY = 'routeLogger_emailForSignIn';
const COLLECTION = 'userAdmin';

/**
 * サインインリンクをメールで送信
 * @param {string} email
 */
export async function sendSignInLink(email) {
    const actionCodeSettings = {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: true,
    };
    await firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
    localStorage.setItem(EMAIL_KEY, email);
}

/**
 * URLにサインインリンクが含まれているか確認し、サインインを完了する
 * @returns {firebase.auth.UserCredential|null}
 */
export async function tryCompleteEmailLinkSignIn() {
    if (!firebase.auth().isSignInWithEmailLink(window.location.href)) return null;

    let email = localStorage.getItem(EMAIL_KEY);
    if (!email) {
        email = prompt('確認のためメールアドレスを入力してください:');
        if (!email) return null;
    }

    const result = await firebase.auth().signInWithEmailLink(email, window.location.href);
    localStorage.removeItem(EMAIL_KEY);
    window.history.replaceState(null, '', window.location.origin + window.location.pathname);
    return result;
}

/**
 * Firebase Auth UIDからuserAdminのユーザー情報を取得
 * @param {string} uid
 * @returns {Promise<{username:string, email:string, displayName:string, status:string}|null>}
 */
export async function getUserByUid(uid) {
    const db = firebase.firestore();
    const snapshot = await db.collection(COLLECTION).where('uid', '==', uid).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { username: doc.id, ...doc.data() };
}

/**
 * ユーザー名が利用可能かチェック（doc IDが存在しない = 利用可能）
 * @param {string} username
 * @returns {Promise<boolean>}
 */
export async function isUsernameAvailable(username) {
    const db = firebase.firestore();
    const doc = await db.collection(COLLECTION).doc(username).get();
    return !doc.exists;
}

/**
 * 新規ユーザーをuserAdminコレクションに登録
 * ユーザー名がdoc IDとなり変更不可
 * @param {string} username 英数字のみ
 * @param {string} displayName 氏名
 * @returns {Promise<{username:string, email:string, displayName:string, status:string}>}
 */
export async function registerUser(username, displayName) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) throw new Error('認証されていません');
    if (!username) throw new Error('ユーザー名を入力してください');
    if (!/^[a-zA-Z0-9]+$/.test(username)) throw new Error('ユーザー名は英数字のみ使用できます');
    if (!displayName) throw new Error('氏名を入力してください');

    const available = await isUsernameAvailable(username);
    if (!available) throw new Error('このユーザー名はすでに使用されています');

    const db = firebase.firestore();
    await db.collection(COLLECTION).doc(username).set({
        email: currentUser.email,
        displayName: displayName,
        uid: currentUser.uid,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { username, email: currentUser.email, displayName, status: 'pending' };
}

/**
 * lastLoginAtを更新
 * @param {string} username
 */
export async function updateLastLogin(username) {
    const db = firebase.firestore();
    await db.collection(COLLECTION).doc(username).update({
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * サインアウト
 */
export async function signOutUser() {
    await firebase.auth().signOut();
}
