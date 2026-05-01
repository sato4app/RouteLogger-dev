# RouteLogger 機能仕様書

**バージョン:** RLog-v10.7
**最終更新日:** 2026年5月1日

---

## 1. 概要

### 1.1 アプリケーション名
RouteLogger - GPS位置記録

### 1.2 目的
国土地理院地図上に現在地と移動経路を表示しながら、GPS位置・写真・テキストメモを同時に記録できるPWA（Progressive Web App）。ハイキング・散歩・サイクリングなど、屋外で経路と現地写真を記録する用途を想定する。記録データは端末内（IndexedDB）に保持し、必要に応じてKMZファイルへエクスポート、またはFirebase / Google Drive へアップロードできる。

### 1.3 動作環境
- **プラットフォーム:** Webブラウザ（PWA対応）
- **対応ブラウザ:** Chrome、Safari、Firefox（Geolocation API、Camera API、IndexedDB対応ブラウザ）
- **必須環境:** HTTPS環境またはlocalhost（Geolocation API、Camera API、Wake Lock API、Service Worker の要件）
- **オフライン:** 地図タイルとデータのCloud保存以外はオフラインでも動作可能

### 1.4 技術スタック
| 項目 | 技術 |
|------|------|
| 地図 | Leaflet.js 1.9.4 + 国土地理院標準地図タイル |
| フロントエンド | Vanilla JavaScript (ES6モジュール) |
| スタイル | カスタムCSS（レスポンシブ対応） |
| ローカルストレージ | IndexedDB (RouteLoggerDB v4) + localStorage（設定値・メッセージ履歴） |
| クラウドストレージ | Firebase（Firestore + Storage） |
| 認証 | Firebase Anonymous Authentication + 自前ユーザー名管理（`userAdmin` コレクション） |
| サーバー処理 | Cloud Functions for Firebase（asia-northeast1, Node.js） |
| メール送信 | Nodemailer (SMTP / Gmail) |
| ファイル処理 | JSZip 3.10.1（KMZ）、togeojson 0.16.0（KML→GeoJSON）、SheetJSは未使用 |
| PWA | Service Worker + Web App Manifest |

---

## 2. 画面構成

### 2.1 メイン画面
- **時計表示:** 地図上部・Startボタンの真上に現在時刻（HH:mm）を表示（設定でON/OFF可能）
- **地図表示領域:** 国土地理院標準地図を全画面表示
- **ステータスバー:** 画面上部にステータス文（自動非表示）と座標情報を表示
- **メインコントロールパネル:** 画面下部にStart/Stop/Photo/Data/Settingsボタンを配置
- **データ管理パネル:** Dataボタンで表示切替（Clear/Photos/Size/Save/Loadボタン）

### 2.2 ダイアログ・サブ画面
| ダイアログ名 | 用途 |
|-------------|------|
| 写真一覧ダイアログ | 「撮影写真」「外部写真」の2タブで保存写真をグリッド表示 |
| 写真拡大ダイアログ | 拡大表示・ナビゲーション・Forward/Backwardトグル・メモ編集・削除 |
| 写真ライトボックス | 外部リンク写真（Google Drive 等）を全画面表示。読み込み失敗時は埋め込み iframe に自動フォールバック |
| カメラダイアログ | 写真撮影UI（方向ダイアル・facing選択・メモ入力） |
| 統計ダイアログ | データサイズ・記録件数の表示 |
| ドキュメント選択ダイアログ | クラウド保存データの読み込み選択（写真同梱有無を選択可能） |
| ドキュメント名入力ダイアログ | 保存時のファイル/ドキュメント名入力（タイトルが保存先に応じて変わる） |
| データ初期化確認ダイアログ | Start時の既存データ確認（初期化／追記／キャンセル） |
| 設定ダイアログ | アプリ設定（時計・Firebase・ユーザー登録・方向ボタン・箕面オーバーレイ・隠し詳細設定） |
| メッセージ履歴ダイアログ | ステータスバーの履歴を時刻・バージョン付きで一覧表示 |

---

## 3. 機能詳細

### 3.1 GPS追跡機能

#### 3.1.1 GPS追跡開始（Startボタン）
- **状態:** 初期状態で有効、追跡中は無効
- **動作:**
  1. IndexedDB の既存トラック・写真を確認し、確認ダイアログを表示
     - データがある場合: 「Start New (Clear Data)」「Continue (Append)」「Cancel」
     - データがない場合: 「Start」「Cancel」
  2. 「Start New」を選択した場合は地図上の表示と `tracks` / `photos` ストアをクリア（外部レイヤー `externals` / `external_photos` は保持）
  3. 「Continue」を選択した場合は `previousTotalPoints` に既存記録点数を保持し、表示は累計として継続
  4. 新規 `tracks` ドキュメントを `createInitialTrack()` で作成し、`currentTrackId` を保持
  5. Wake Lock API で画面スリープを防止
  6. テキスト入力欄の Undo ヒストリをクリア（iOS シェイクで取り消し対策）
  7. iOS 13以降では `DeviceOrientationEvent.requestPermission()` で許可要求
  8. Geolocation API（`watchPosition`）で GPS 追跡開始（オプション: `enableHighAccuracy: true`, `timeout: 10000ms`, `maximumAge: 0`）

#### 3.1.2 GPS位置の記録条件
位置更新ごとに以下を判定し、記録するか決定する。
- 初回は必ず記録
- 直前記録から **5秒未満** は記録しない（高頻度防止）
- 直前記録から **60秒以上経過** または **20m以上 かつ 精度を超える距離移動** で記録
- 記録時、`tracks[].points` にプッシュした上で `saveTrackingDataRealtime()` により IndexedDB を即時更新
- 初回記録時に開始マーカー（四角）を地図に追加
- 記録中はパンで現在地を地図中心に追従

#### 3.1.3 GPS追跡停止（Stopボタン）
- **状態:** 追跡開始後に有効
- **動作:**
  1. `clearWatch()` で GPS 監視停止
  2. Wake Lock を解放
  3. 最終 `points` を IndexedDB に上書き保存
  4. ステータスに合計記録点数を表示

#### 3.1.4 記録点数の表示
- ステータスは `previousTotalPoints + 当セッションの点数` を「合計記録点数」として表示

#### 3.1.5 位置データ形式（`tracks.points[]`）
```javascript
{
    lat: number,                   // 緯度（小数点以下5桁）
    lng: number,                   // 経度（小数点以下5桁）
    timestamp: string,             // ISO 8601
    accuracy: number,              // 精度（小数点以下1桁、メートル）
    altitude: number | null,       // 標高（m、利用可能時）
    altitudeAccuracy: number | null
}
```

### 3.2 写真撮影機能

#### 3.2.1 撮影フロー（Photoボタン）
- **状態:** GPS追跡中のみ有効
- **動作:**
  1. カメラダイアログを開き、背面カメラ（`facingMode: 'environment'`、`width:ideal 1920`、`height:ideal 1080`）でプレビュー
  2. シャッターボタンタップで現在のプレビューを設定された解像度（後述）にクロップ・リサイズ
  3. 撮影直後に **direction=0・facing='forward'** でデフォルト保存（方向ボタン未操作のままセーブされても `null` にならない）
  4. プレビュー確認画面に移行：
     - **方向ダイアル**: ドラッグまたは ◀ ▶ ボタンで -180°〜+180°（10°単位スナップ）を設定
     - **Forward / Backward** ボタン: それぞれ独立したオン/オフトグル。両方ON時は `forward/backward`、両方OFFは `null`
     - **Memo** ボタン: テキストメモ入力（メモ入力済みは `primary` クラスで強調）
     - **Retake**: 現在の撮影写真をDBから削除し、地図上のマーカーも除去してプレビュー画面に戻る
     - **✕（クローズ）**: カメラを終了して GPS 状態に応じたステータスを表示
  5. 方向ダイアルの操作完了時／Forward/Backward タップ時／メモ更新時はその場で IndexedDB を上書き保存し、地図マーカーを追加または更新
  6. プレビュー画面は連続編集できるよう、保存後も自動で閉じない

#### 3.2.2 方向ダイアル仕様
- 角度範囲: -180°〜+180°（10°単位スナップ、表示は `+30°` / `-30°` 形式）
- ドラッグ操作（タッチ／マウス）はダイアル中心からの角度を `Math.atan2(dx, -dy)` で計算
- ◀ ▶ ボタンで 10° 単位の増減
- Forward/Backward の表示は設定「進行方向ボタンを表示」がOFFの場合は非表示

#### 3.2.3 写真データ形式（`photos`）
```javascript
{
    id: number,                    // 自動採番
    data: string,                  // Base64 JPEG（矢印スタンプ済み）
    timestamp: string,             // ISO 8601
    direction: number | string,    // 角度（度数）。後方互換で 'left' / 'up' / 'right' も読み込み可能
    facing: 'forward' | 'backward' | 'forward/backward' | null,
    location: {                    // 撮影時の現在位置
        lat: number,               // 小数点以下5桁
        lng: number,
        accuracy?: number
    } | null,
    text: string | null            // メモテキスト
}
```

#### 3.2.4 写真マーカータップ時の表示
- 地図上の写真マーカーをタップすると拡大ビューアを開く
- マーカーに保持した `photo` ではなく **必ず IndexedDB から最新データを取得** して表示する（マーカー作成後に方向・メモを変更しても反映される）

#### 3.2.5 矢印スタンプ
- 画像下部中央に半透明の白いカプセル背景＋黒い矢印を描画
- 矢印は `direction` の度数だけ回転（旧文字列 `left` / `right` / `up` も度数換算）
- JPEG 出力品質は設定値（既定 70%）

### 3.3 写真一覧・拡大ビューア機能

#### 3.3.1 写真一覧（Photosボタン）
- 上部に「撮影写真 (n)」「外部写真 (n)」の切り替えタブ
- 「撮影写真」タブ:
  - 各サムネールには方向バッジ（角度数値＋矢印アイコン）が表示される
  - サムネール下にはメモテキストのみ（ラベルなし、メモが無ければ非表示）
- 「外部写真」タブ:
  - インポートした KMZ/GeoJSON に紐づく写真を結合して表示
  - サムネール参照（`thumb_xxx`）は元写真と差し替えて表示
  - ファイル名と、Google Drive 等のリンクがあれば「元の写真を表示」リンクをサムネール下に表示
- タブ初期表示: 撮影写真があるときは撮影写真タブ、なければ外部写真タブを優先

#### 3.3.2 写真拡大ビューア
- 画像表示 + ピンチ／ホイールズーム + パン操作（最大10倍）
- 撮影日時・緯度経度・テキストメモを下部に表示
- ナビゲーション: 前後ボタン（先頭/末尾では非表示）、`n of m` カウンタ
- アクションボタン:
  - **Forward / Backward**: 独立トグル（両方ON＝`forward/backward`）。タップすると `updatePhoto()` で即座に Firestore→IndexedDB を更新。マーカーアイコンも更新される
  - **Edit Memo**: テキストエリアを表示し、保存（pointerdown）／キャンセル／Ctrl+Enter保存／Esc取消をサポート。仮想キーボード表示時はビューアの高さを `visualViewport.height` に追従
  - **Delete**: 確認ダイアログ後、写真とマーカーを削除し、リストの次の写真を表示。最後の1枚を削除した場合はビューアを閉じる
- 外部写真ビューア: 編集／削除／Forward/Backward ボタンを非表示にして読み取り専用表示
- Google Drive リンク付き外部写真は `lh3.googleusercontent.com/d/<id>` で直接表示し、失敗時は blob にフォールバック

#### 3.3.3 写真ライトボックス
- ポップアップ内 `<img>` リンクのタップで開く全画面表示
- Google Drive URL は `uc?export=view&id=<id>` で表示し、失敗時は `<iframe>` (`/preview`) にフォールバック
- 表示成功時はバックグラウンドで `external_photos` (`importId='drive_cache'`) にキャッシュ保存

### 3.4 データ管理機能

#### 3.4.1 データサイズ表示（Sizeボタン）
- 表示項目:
  - 記録点数（合計）
  - GPS データサイズ（10MB以下KB、10MB超MB、1GB超GB）
  - 写真枚数
  - 写真データサイズ
  - 最後に保存した写真の解像度

#### 3.4.2 データ保存（Saveボタン）

**「Use Firebase」OFFの場合（KMZファイルとしてダウンロード）:**
- 前提条件: トラックが1件以上存在する（Save前にチェックし、なければ「保存するルートログがありません」と表示）
- ダイアログタイトル: **`Save to file as...`**
- デフォルト名: `RLog-YYYYMMDD`（JST）
- 出力内容:
  - `doc.kml`: GPS トラック（LineString）と写真位置（Point、`<img src="images/photo_<id>.jpg" width="300">`）
  - `images/photo_<id>.jpg`: 写真ファイル（Base64→Binary）
- 保存中は Wake Lock を取得（Save/Load 用 `_busyWakeLock`）し、メインボタン群を一時的に無効化

**「Use Firebase」ONの場合（クラウド保存）:**
- 前提条件: トラックが1件以上 + ユーザー名（`routeLogger_username`）が設定済み + Firebase 匿名認証成功
- ユーザー名未設定時はアラートを出して設定ダイアログを開く
- ダイアログタイトル: **`Save to cloud as...`**
- 動作:
  1. Firestore `tracks` コレクションで重複チェックし、`name_2`, `name_3` … と自動採番（最大100まで、超えるとエラー）
  2. ステータスに `クラウドに保存中: "{name}"...` を表示
  3. 写真を Firebase Storage（`tracks/{name}/photos/{timestamp}.jpg`）に逐次アップロード
  4. Firestore `tracks/{name}` ドキュメントに `userId`, `username`, `startTime`, `createdAt`, `tracks[]`, `photos[]`, `tracksCount`, `photosCount` を保存
  5. Cloud Function `generateKmzAndSendEmail` を呼び出し、KMZ生成・Google Drive アップロード・メール送信を非同期実行
- Save/Load中は Wake Lock を取得し、ボタン群を無効化

#### 3.4.3 データ読み込み（Loadボタン）

**Firebase設定に関わらず、常にファイルから読み込む。**
- ファイル選択ダイアログ。対応拡張子: `.kmz`, `.kml`, `.geojson`, `.json`, `.zip`
- KMZ/KML/zip → `importKmz()`、GeoJSON/JSON → `importGeoJson()` で処理
- KMLに `<atom:name>RouteLogger</atom:name>` がある or GeoJSON `creator='RouteLogger'` の場合は **RouteLogger製データ** として処理
  - 確認ダイアログ後に `tracks` / `photos` をクリアし、トラックと写真を復元
  - 完了後 `localStorage.routeLogger_loadedData='true'` をセットしてページをリロード（再表示時にネイビー色で描画）
- それ以外は **外部データ** として処理
  - `externals` ストアに GeoJSON 全体を保存
  - 同梱画像は `external_photos` ストアに `importId` 付きで保存
  - 地図上に青色（`#0055ff`）でレイヤー表示
- Save/Load中は Wake Lock を取得し、ボタン群を無効化

#### 3.4.4 データクリア（Clearボタン）
- 確認ダイアログ表示
- OK で地図上のルート・マーカーを消去し、IndexedDB を全削除→再初期化（`clearIndexedDBSilent()`）
- 外部レイヤー（`externals` / `external_photos`）も含めて初期化される

### 3.5 外部データ表示機能

#### 3.5.1 外部KMZ/GeoJSONインポート
- RouteLogger製以外のKMZ/KML/GeoJSON/JSON を外部レイヤーとして表示
- 永続化先:
  - GeoJSON 本体 → `externals` ストア
  - 同梱画像 → `external_photos` ストア（`importId` で紐付け）
- アプリ起動時に `getAllExternalData()` の結果を順次 `displayExternalGeoJSON()` で復元
- 表示色: ライン `#0055ff`（幅4px、透明度0.7）、ポイント `#0055ff`（半径6px）
- 開始/終了マーカーはトラック色 `#4682b4` で別途追加

#### 3.5.2 ポップアップ画像のレイジーロード
- ポップアップHTML内の相対パス `<img src="...">` は `data-lazysrc` に置換され、ポップアップを開いたタイミングで `external_photos` から該当 blob を読み出して表示
- 外部リンク `<a href="https://...">` は `window._showPhotoLightbox()` を起動するよう書き換える

### 3.6 箕面オーバーレイ機能

#### 3.6.1 箕面緊急ポイント表示
- 設定「箕面緊急ポイントを表示」ON で `data/minoo-emergency-points.geojson`（約170点）を読み込み、専用ペイン `emergencyPane`（z-index 350）に CircleMarker で表示
- マーカー色・半径は設定の「マーカー設定 > 緊急ポイント」で変更可能（既定 `#00AA00`、半径 7px）
- 各マーカーには ID + 名前のポップアップを設定

#### 3.6.2 ハイキングルート（公式）表示
- 設定「ハイキングルート(公式)を表示」ON で `data/minoo-hiking-route-spot.geojson` を読み込み、専用ペイン `hikingRoutePane`（z-index 340）に表示
- LineString はポリライン（既定 `#FF8C00`、太さ 3px）、Point は四角アイコン（既定 `#1E90FF`、一辺 10px）として描画
- マーカー色・サイズは設定の「マーカー設定」で変更可能

### 3.7 設定機能

#### 3.7.1 通常設定項目
| 設定名 | 種別 | 既定 | 永続化キー |
|--------|------|------|-----------|
| 時刻を表示 | トグル | ON | `routeLogger_showClock` |
| 保存時にクラウドのデータベースを使用 | トグル | OFF | `routeLogger_useFirebase` |
| ユーザー接続（Firebase ON時のみ表示） | フォーム | - | `routeLogger_username` 等 |
| 進行方向ボタンを表示 | トグル | ON | `routeLogger_showFacingButtons` |
| 箕面緊急ポイントを表示 | トグル | ON | `routeLogger_minooEmergency` |
| ハイキングルート(公式)を表示 | トグル | OFF | `routeLogger_minooHikingRoute` |
| アプリバージョン | 表示 | - | （Service Worker から取得） |
| メッセージ履歴 | ボタン | - | `routeLogger_messageHistory` |

#### 3.7.2 ユーザー接続（Firebase ON時のみ表示）
- 通常表示: `@<username>` と「（ユーザー登録確認済み）」「（ユーザー登録なし）」の状態表示
- タップで編集フォームを展開：
  - ユーザー名（半角英数字、入力時に自動で小文字化と除去）
  - メールアドレス（全角→半角に自動変換）
  - 氏名（姓のみ可）
  - 「私は箕面ハイキングアプリ開発の協力者です。」同意チェック（チェックがONになるまで [登録] ボタン無効）
- [登録]: 既存ユーザーなら `userAdmin/<username>` を確認し displayName を更新、新規ユーザーなら `userAdmin/<username>` を作成（`uid`, `email`, `displayName`, `status='active'`, `createdAt`, `lastLoginAt`）
- [クリア]: 全入力欄と localStorage の `routeLogger_username/email/displayName` をクリア
- [キャンセル]: 通常表示に戻す

#### 3.7.3 アプリバージョン表示
- 動作中の Service Worker に `MessageChannel` で `GET_CACHE_NAME` を送信し、応答された `CACHE_NAME` を表示
- タイムアウト（1.5秒）／SW 未制御時は `caches.keys()` の先頭をフォールバック表示
- ラベル部分を **3秒以内に5回タップ** で「画面設定等」（隠し詳細設定セクション）を表示

#### 3.7.4 メッセージ履歴
- ステータスバーに表示したメッセージは `routeLogger_messageHistory`（最大200件）に保存
- GPS記録中のステータス更新は履歴に追記しない（`isTracking` 判定）
- メッセージ履歴ダイアログでは時刻・アプリバージョン・本文を一覧表示
- 「クリア」ボタンで全削除（確認あり）

#### 3.7.5 隠し詳細設定（画面設定等）
**画像解像度の設定パネル**
| 項目 | 範囲 | 既定 | 永続化キー |
|------|------|------|-----------|
| 写真解像度 | 0=720×1280 / 1=360×640 / 2=180×320 | 1（中） | `routeLogger_photoResolution` |
| JPEG画像品質 | 60–80 % (10刻み) | 70 | `routeLogger_photoQuality` |
| サムネール | 80–320 px (40刻み) | 160 | `routeLogger_thumbnailSize` |

**マーカーの設定パネル**
| 対象 | 色キー（既定） | サイズキー（既定） |
|------|----------------|-------------------|
| 緊急ポイント | `routeLogger_markerColorEmergency` (`#00AA00`) | `routeLogger_markerSizeEmergency` (7) |
| ハイキングルート | `routeLogger_markerColorRoute` (`#FF8C00`) | `routeLogger_markerSizeRoute` (3) |
| スポット | `routeLogger_markerColorSpot` (`#1E90FF`) | `routeLogger_markerSizeSpot` (5) |
| トラック | `routeLogger_markerColorTrack` (`#000080`) | `routeLogger_markerSizeTrack` (4) |
| 写真撮影場所 | `routeLogger_markerColorPhoto` (`#000080`) | `routeLogger_markerSizePhoto` (6) |

- 共通アクション: 「設定」（state と localStorage に保存し、表示中レイヤーを再描画）／「規定値」（既定値をスライダーへ反映、保存はしない）／「キャンセル」

**過去データを Drive に移行**
- 「▶」ボタンで展開し、Firestore `tracks` コレクションのドキュメント一覧を取得
- 前方一致テキストで絞り込み、複数選択して [実行] で `migrateRoutesToDrive` Cloud Function（`asia-northeast1`、タイムアウト540秒）を呼び出し
- 進捗（`実行中... (i/n)`）・成功/失敗件数を表示

### 3.8 時計表示機能
- 地図上に現在時刻（HH:mm）を表示、1秒ごとに更新
- Start ボタンの真上に位置を合わせ、`window.resize` でも追従
- 設定「時刻を表示」で表示／非表示

### 3.9 地図表示機能

#### 3.9.1 地図設定
| 項目 | 値 |
|------|-----|
| タイルソース | 国土地理院標準地図 (`https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png`) |
| 最小ズーム | 5 |
| 最大ズーム | 20（最大ネイティブ 18） |
| 初期位置 | 箕面大滝（34.853667, 135.472041、ズーム 15） |
| デフォルトズーム制御 | 無効（左上に独自配置） |
| コントロール | スケール（メートル）、ズーム |

#### 3.9.2 マーカー表示
| マーカー種別 | 外観 | 用途 |
|-------------|------|------|
| 現在位置マーカー | 矢印型 SVG（既定色 `#000080` ＋濃いネイビー縁） | 現在地と進行方向 |
| 写真マーカー | 円形（半径 `markerSizePhoto` × 2、既定 `#000080`） | 写真撮影位置 |
| ルート開始マーカー | ネイビー四角（14×14） | トラック開始地点 |
| ルート終了マーカー | ネイビー矢印（30×30） | トラック終了地点と進行方向 |
| 外部レイヤー開始/終了マーカー | スチールブルー (`#4682b4`) | 外部 GeoJSON のトラック端点 |

#### 3.9.3 軌跡・外部レイヤー表示色
| データ種別 | 色 | 備考 |
|-----------|-----|------|
| 通常GPS記録ライン | `markerColorTrack`（既定 `#000080`） | 幅 `markerSizeTrack`（既定 4px）、透明度 0.7 |
| KMZインポート復元データ（RouteLogger製） | `#000080`（ネイビー） | 起動時 `routeLogger_loadedData` フラグで判定 |
| 外部KMZ/GeoJSONライン | `#0055ff`（青） | 幅4px、透明度0.7 |
| 外部KMZ/GeoJSONポイント | `#0055ff`（青） | circleMarker 半径6px |
| 箕面緊急ポイント | `markerColorEmergency`（既定 `#00AA00`） | CircleMarker 半径 `markerSizeEmergency` |
| 箕面ハイキングルート | `markerColorRoute`（既定 `#FF8C00`） | Polyline 太さ `markerSizeRoute` |
| 箕面スポット | `markerColorSpot`（既定 `#1E90FF`） | 正方形アイコン |

### 3.10 デバイス方向取得機能
- iOS Safari: `webkitCompassHeading`
- Android Chrome 等: `360 - alpha`
- GPS の `position.coords.heading` が利用可能な場合はそちらを優先
- iOS 13以降は `startTracking()` 内で `requestPermission()` を実行

### 3.11 画面スリープ防止機能（Wake Lock）
| 場面 | Wake Lock | 解放タイミング |
|------|----------|-------------|
| GPS追跡中 | `state.wakeLock` | Stop時／ページ非表示時／タブクローズ |
| Save/Load中 | `_busyWakeLock`（ui-common 内） | 操作完了時 |

- ページが再表示された際、追跡中であれば Wake Lock を自動再取得

### 3.12 iOS Shake to Undo 防止
- iOS Safari の「シェイクで取り消し」（Undo Typing）ダイアログを抑制
- `clearInputUndoHistory()` を以下のタイミングで呼び出す:
  - `tracking.startTracking()` 直前（ポケット歩行突入時）
  - 各ダイアログ close 時（`closeSettingsDialog`、`showDocNameDialog` cleanup 等）
  - `visibilitychange`（hidden）／ `pagehide`
- 実装: 全テキスト入力をループし、編集中以外の要素について `blur()` →`disabled` トグル → value 再設定で iOS の編集状態を確実にリセット
- `visibilitychange`(hidden) でアクティブ要素を `blur()` する保険処理も維持

---

## 4. データ永続化

### 4.1 IndexedDB構成

#### 4.1.1 データベース情報
| 項目 | 値 |
|------|-----|
| データベース名 | RouteLoggerDB |
| バージョン | 4 |

#### 4.1.2 オブジェクトストア
| ストア名 | キー | インデックス | 用途 |
|----------|------|-------------|------|
| tracks | id (autoIncrement) | timestamp | トラッキングデータ |
| photos | id (autoIncrement) | timestamp | 撮影写真 |
| settings | key | - | 設定（最終位置など、現状は使用箇所なし） |
| externals | id (autoIncrement) | - | 外部 GeoJSON データ |
| external_photos | id (autoIncrement) | importId | 外部インポート画像／Drive キャッシュ |

#### 4.1.3 tracks データ構造
```javascript
{
    id: number,
    timestamp: string,                // セッション開始時刻
    points: [ /* §3.1.5 形式 */ ],
    totalPoints: number
}
```

#### 4.1.4 photos データ構造
§3.2.3 参照。

#### 4.1.5 externals データ構造
```javascript
{
    id: number,
    type: 'geojson',
    name: string,                     // 元ファイル名
    data: object,                     // GeoJSON 本体（properties.importId を付加）
    timestamp: string
}
```

#### 4.1.6 external_photos データ構造
```javascript
{
    id: number,
    importId: string,                 // インポート毎のID、または 'drive_cache'
    fileName: string,                 // ファイル名 / Drive ファイルID
    blob: Blob,
    timestamp: string
}
```

### 4.2 Firebase構成

#### 4.2.1 Firestore コレクション
```
tracks/
  └── {projectName}/
        ├── userId: string             // Firebase 匿名認証 UID
        ├── username: string | null    // routeLogger_username
        ├── startTime: string
        ├── createdAt: timestamp
        ├── tracks: []                 // 各 timestamp / points / totalPoints
        ├── photos: []                 // §4.2.3
        ├── tracksCount: number
        └── photosCount: number

userAdmin/
  └── {username}/
        ├── uid: string                // Firebase Auth UID
        ├── email: string
        ├── displayName: string
        ├── status: 'active' | 'denied' | 'disabled'
        ├── createdAt: timestamp
        └── lastLoginAt: timestamp
```

#### 4.2.2 Firebase Storage 構造
```
tracks/{projectName}/photos/{timestamp}.jpg
```
カスタムメタデータに `timestamp`, `lat`, `lng` を保持。

#### 4.2.3 写真メタデータ（Firestore 内 `photos[]`）
```javascript
{
    url: string,              // Firebase Storage ダウンロード URL
    storagePath: string,      // tracks/{name}/photos/{ts}.jpg
    timestamp: string,
    direction: number | null, // ''は null に正規化
    facing: string | null,
    location: { lat, lng, accuracy },
    text: string | null
}
```

### 4.3 localStorage キー一覧
| キー | 用途 |
|------|------|
| `routeLogger_showClock` | 時刻表示ON/OFF |
| `routeLogger_useFirebase` | Firebase 使用ON/OFF |
| `routeLogger_showFacingButtons` | Forward/Backwardボタン表示 |
| `routeLogger_minooEmergency` | 箕面緊急ポイント表示 |
| `routeLogger_minooHikingRoute` | 箕面ハイキングルート表示 |
| `routeLogger_username` | ユーザー名 |
| `routeLogger_email` | メールアドレス |
| `routeLogger_displayName` | 表示名（氏名） |
| `routeLogger_photoResolution` | 写真解像度レベル |
| `routeLogger_photoQuality` | JPEG品質 |
| `routeLogger_thumbnailSize` | サムネールサイズ |
| `routeLogger_markerColor*` / `routeLogger_markerSize*` | マーカー色・サイズ（5種） |
| `routeLogger_loadedData` | KMZインポート復元状態フラグ |
| `routeLogger_messageHistory` | ステータスメッセージ履歴（JSON配列、最大200件） |

---

## 5. PWA機能

### 5.1 Service Worker

#### 5.1.1 キャッシュ対象（プリキャッシュ）
- アプリ本体: `./`, `./index.html`, `./styles.css`, `./manifest.json`
- JSモジュール: `js/firebase-config.js`, `js/app-main.js`, `js/config.js`, `js/state.js`, `js/utils.js`, `js/db.js`, `js/map.js`, `js/tracking.js`, `js/camera.js`, `js/firebase-ops.js`, `js/ui.js`
- 静的データ: `data/minoo-emergency-points.geojson`, `data/minoo-hiking-route-spot.geojson`
- 外部CDN: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`, `leaflet.js`
- アイコン: `icons/icon-180.png`, `icon-192.png`, `icon-512.png`

#### 5.1.2 キャッシュ戦略
| リソース種別 | 戦略 |
|-------------|------|
| 国土地理院タイル (`cyberjapandata.gsi.go.jp`) | ネットワーク優先（オフライン時は空レスポンス） |
| その他リソース | キャッシュ優先（キャッシュミス時はネットワーク取得して保存） |

#### 5.1.3 キャッシュバージョン
- 現在: `RLog-v10.7`
- アクティベート時に旧キャッシュを削除し、`clients.claim()` で即時制御
- 旧キャッシュが存在した場合は全クライアントに `SW_UPDATED` メッセージを送信し、ページを自動リロードさせる
- `install` 時に `skipWaiting()` を呼び出し新バージョンを即座に適用
- `message` ハンドラで `GET_CACHE_NAME` を受け取り、現在の `CACHE_NAME` を MessageChannel で返す（Settings の「アプリバージョン」表示で使用）

### 5.2 Web App Manifest
| 項目 | 値 |
|------|-----|
| name | RouteLogger - GPS位置記録 |
| short_name | RouteLogger |
| description | 地理院地図上でGPS位置を記録し、写真を撮影できるアプリ |
| display | standalone |
| orientation | portrait-primary |
| theme_color | #4CAF50 |
| background_color | #ffffff |
| lang | ja |
| start_url | ./index.html |
| categories | navigation, utilities |

### 5.3 アイコン
| サイズ | ファイル |
|--------|----------|
| 180x180 | icons/icon-180.png |
| 192x192 | icons/icon-192.png |
| 512x512 | icons/icon-512.png |

---

## 6. UIコンポーネント

### 6.1 メインコントロールパネル
| ボタン | 機能 | 主な無効条件 |
|--------|------|------------|
| Start | GPS追跡開始 | 追跡中／Save/Load中 |
| Stop | GPS追跡停止 | 待機中／Save/Load中 |
| Photo | 写真撮影 | 待機中／Save/Load中 |
| Data | データ管理パネル切替 | Save/Load中 |
| Settings | 設定ダイアログ表示 | Save/Load中 |

### 6.2 データ管理パネル
| ボタン | 機能 | 備考 |
|--------|------|------|
| Clear | 表示データとローカルデータを初期化 | 確認ダイアログあり |
| Photos | 写真一覧表示 | タブ切替で外部写真も閲覧 |
| Size | データサイズ・件数表示 | 統計ダイアログ |
| Save | Firebase 保存 or KMZ エクスポート | 設定により切替 |
| Load | KMZ/KML/GeoJSON ファイル取込（クラウドからの読み込みは廃止） | RouteLogger 製は復元、外部は外部レイヤー表示 |

> Save/Load 中は両ボタンが無効化され、トラッキング状態に応じて Start/Stop/Photo もロックされる。

### 6.3 設定ダイアログ
| 設定項目 | 種別 | 既定 |
|---------|------|------|
| 時刻を表示 | トグルスイッチ | ON |
| 保存時にクラウドのデータベースを使用 | トグルスイッチ | OFF |
| ユーザー接続（Firebase ON時のみ） | フォーム | - |
| 進行方向ボタンを表示 | トグルスイッチ | ON |
| 箕面緊急ポイントを表示 | トグルスイッチ | ON |
| ハイキングルート(公式)を表示 | トグルスイッチ | OFF |
| アプリバージョン | 表示 | - |
| メッセージ履歴 | ボタン | - |
| 画面設定等（隠し） | パネル | アプリバージョンを連続タップで表示 |

### 6.4 カメラUI
| 状態 | 表示要素 |
|------|----------|
| 撮影前 | プレビュー、シャッターボタン（白丸）、Cancel |
| 撮影後 | キャプチャ画像、方向ダイアル（SVG＋ドラッグ可）、◀ ▶ 角度ボタン、角度表示、Forward/Backward（設定でON時）、Memo、Retake、✕ |

### 6.5 ドキュメント名入力ダイアログ
| 保存先 | ダイアログタイトル |
|--------|----------------|
| Firebase（クラウド） | Save to cloud as... |
| KMZファイル | Save to file as... |

---

## 7. Cloud Functions

### 7.1 generateKmzAndSendEmail（onCall, asia-northeast1）
- **入力:** `{ projectName, thumbnailSize?: 160 }` ＋認証コンテキスト
- **処理:**
  1. Firestore `tracks/{projectName}` を取得（無ければ NotFound）
  2. `userAdmin/{username}` から送信先メールを取得（無ければエラー）
  3. 写真URLからバイナリを取得し、`sharp` で `thumbnailSize × thumbnailSize` の正方形にクロップ＋方向バッジを合成
     - サムネールファイル名は `thumb_<元のJPEGファイル名>`（取得不可なら `thumb_001.jpg`）
  4. `uploadProjectToDrive()` で Google Drive `<GDRIVE_FOLDER_ID>/<projectName>/` に以下を保存
     - `{projectName}.kmz`（写真URLは Firebase Storage の元URLを使用）
     - `photos/{timestamp}.jpg`（オリジナル）
     - `images/{thumbFile}`（サムネール）
  5. SMTP（Gmail）でユーザーへ KMZ 添付メール送信
- **タイムアウト/メモリ:** 300秒 / 512MB

### 7.2 migrateRoutesToDrive（onCall, asia-northeast1）
- **入力:** `{ projectName?, prefix?, all?, thumbnailSize?: 160 }` ＋認証コンテキスト
- **処理:** Firestore `tracks` から対象を抽出して、既存データのサムネール生成・Drive 移行を逐次実行
- **タイムアウト/メモリ:** 540秒 / 1GB
- **クライアント:** Settings の「過去データを Drive に移行」パネル（隠し詳細設定）から呼び出し

### 7.3 KMZ 内 KML 構造（Cloud Function 生成版）
- `<atom:name>` は付与しない（外部互換のため）。読み込み側はこの KML を「外部データ」として扱う。
- 各写真 Placemark の description（CDATA）:
  - `<img src="images/<thumbFile>" width="320">`
  - `<a href="<photoUrl>">元の写真を表示</a>`
  - タイムスタンプ `yyyy/MM/dd HH:mm` （JST、ラベルなし）
  - 方向＋facing `130° (Backward)` 形式（ラベルなし、片方しかない場合はある方のみ）
  - メモ（ラベルなし）
- Compass・サイズ情報は出力しない

### 7.4 環境変数（functions/.env）
| 変数 | 用途 |
|------|------|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | メール送信設定（実装は Gmail サービスを使用） |
| `GDRIVE_FOLDER_ID` | アップロード先 Drive フォルダID |
| `GDRIVE_CLIENT_ID` / `GDRIVE_CLIENT_SECRET` / `GDRIVE_REFRESH_TOKEN` | OAuth2 ユーザー認証 |

---

## 8. エラーハンドリング

### 8.1 GPS関連
| エラーコード | メッセージ |
|-------------|-----------|
| PERMISSION_DENIED | 位置情報の使用が許可されていません |
| POSITION_UNAVAILABLE | 位置情報が利用できません |
| TIMEOUT | 位置情報の取得がタイムアウトしました |

### 8.2 カメラ関連
| エラー名 | メッセージ |
|---------|-----------|
| NotAllowedError | カメラの使用が許可されていません |
| NotFoundError | カメラが見つかりません |
| その他 | カメラの起動に失敗しました: ... |

### 8.3 Firebase関連
- 未認証時は保存処理を中断しアラート
- 写真アップロード失敗は1件目のみアラート、以降はサイレントに次へ進む。`{success}件成功、{fail}件失敗` を最後に表示
- KMZ 生成・メール送信は非同期実行なので、失敗時はステータスバーに `KMZ送信失敗: ...` を表示するのみで保存自体は成功扱い

### 8.4 IndexedDB関連
- 起動時の初期化失敗はアラート＋再読み込み案内
- Start ボタン押下時に未初期化を検出した場合は自動で再初期化を試行

### 8.5 KMZ/GeoJSON インポート関連
- 未対応拡張子はアラート
- KML 変換ライブラリ未読込時はエラー

---

## 9. 座標系・単位

### 9.1 座標系
- **測地系:** WGS84
- **形式:** 10進数度
- **精度:** 緯度・経度ともに小数点以下5桁

### 9.2 データサイズ表示
- 1KB未満: B
- 10MB以下: KB
- 1GB未満: MB
- 1GB以上: GB

### 9.3 距離計算
- Haversine 公式（地球半径 6,371,000m）

---

## 10. 制限事項

### 10.1 ブラウザ制限
- Geolocation API: HTTPS必須（localhost除く）
- Camera API: HTTPS必須
- Wake Lock API: 一部ブラウザ非対応（非対応時はコンソール警告のみ、機能は継続）
- DeviceOrientation API: iOS 13以降は許可要求必須

### 10.2 Firebase制限
- 写真アップロードには Firebase 匿名認証＋ユーザー名登録が必要
- ドキュメント名連番: 同名 `_2`〜`_100` まで自動採番、超えた場合はエラー
- `generateKmzAndSendEmail`: 300秒・512MB
- `migrateRoutesToDrive`: 540秒・1GB

### 10.3 記録条件
- GPS位置は5秒以上の間隔をおいて、60秒経過 または 20m かつ 精度を超える距離移動で記録
- 写真撮影は GPS 追跡中のみ可能
- Firebase OFF 時の Save は「トラックが1件以上」必要（写真のみは保存不可）

---

## 11. ファイル構成

```
RouteLogger/
├── index.html
├── styles.css
├── manifest.json
├── service-worker.js
├── firebase.json
├── .firebaserc
├── data/
│   ├── minoo-emergency-points.geojson
│   └── minoo-hiking-route-spot.geojson
├── icons/
│   ├── icon-180.png
│   ├── icon-192.png
│   └── icon-512.png
├── js/
│   ├── app-main.js          # メイン初期化・イベント設定
│   ├── config.js            # 定数・既定値
│   ├── state.js             # グローバル状態管理
│   ├── utils.js             # 汎用ユーティリティ
│   ├── db.js                # IndexedDB操作
│   ├── map.js               # 地図表示・マーカー管理・外部レイヤー表示
│   ├── tracking.js          # GPS追跡・Wake Lock
│   ├── camera.js            # カメラ・写真撮影・矢印スタンプ
│   ├── firebase-config.js   # Firebase設定（公開用）
│   ├── firebase-config.template.js
│   ├── firebase-ops.js      # Firestore/Storage 保存・読込
│   ├── kmz-handler.js       # KMZ/KML/GeoJSON エクスポート・インポート
│   ├── auth.js              # Firebase 匿名認証＋userAdmin 操作
│   ├── ui.js                # UIモジュール統合 (re-export)
│   ├── ui-common.js         # 共通UI・Wake Lock・メッセージ履歴
│   ├── ui-photo.js          # 写真一覧・拡大ビューア
│   ├── ui-dialog.js         # ダイアログ・データサイズ
│   ├── ui-settings.js       # 設定・時計・隠し詳細設定
│   └── ui-auth.js           # ユーザー登録UI
├── functions/               # Cloud Functions
│   ├── index.js             # generateKmzAndSendEmail / migrateRoutesToDrive
│   ├── package.json
│   └── package-lock.json
├── docs/
│   ├── funcspec-202604.md   # 機能仕様書（本書）
│   ├── UsersGuide-202604.md # 利用者の手引
│   ├── FIREBASE_SETUP.md
│   ├── firebase.json
│   ├── firestore.rules
│   └── storage.rules
└── README.md
```

### 11.1 モジュール構成

| モジュール | 役割 | 主要エクスポート |
|-----------|------|----------------|
| config.js | 定数・既定値 | `DB_NAME`, `GPS_RECORD_*`, `PHOTO_*`, `DEFAULT_MARKER_*`, `HIDDEN_SETTINGS_*` |
| state.js | 状態管理 | `map`, `isTracking`, `trackingData`, `isFirebaseEnabled`, `markerColor*`, `markerSize*`, `getPhotoSize` 等 |
| utils.js | 汎用関数 | `formatDateTime`, `calculateDistance`, `calculateHeading`, `formatDataSize`, `base64ToBlob` 等 |
| db.js | DB操作 | `initIndexedDB`, `saveTrack`, `getAllPhotos`, `restoreTrack`, `clearRouteLogData`, `saveExternalData`, `getDataCounts` 等 |
| map.js | 地図機能 | `initMap`, `updateCurrentMarker`, `displayExternalGeoJSON`, `displayEmergencyPoints`, `displayHikingRoute`, `applyTrackingPathStyle`, `refreshPhotoMarkerIcons` 等 |
| tracking.js | GPS追跡 | `startTracking`, `stopTracking`, `handleVisibilityChange`, `handleDeviceOrientation`, `requestWakeLock` |
| camera.js | カメラ | `takePhoto`, `capturePhoto`, `savePhotoWithDirection`, `retakePhoto`, `handleTextButton`, `drawArrowStamp` |
| firebase-ops.js | Firebase | `saveToFirebase`, `reloadFromFirebase`, `loadDocument` |
| kmz-handler.js | KMZ/GeoJSON | `exportToKmz`, `importKmz`, `importGeoJson` |
| auth.js | 認証 | `signInAnonymously`, `getUserByUsername`, `registerUser`, `updateDisplayName`, `updateLastLogin` |
| ui.js | UI統合 | （各UIモジュールの re-export） |
| ui-common.js | 共通UI | `updateStatus`, `setUiBusy`, `toggleVisibility`, `clearInputUndoHistory`, `getMessageHistory`, `clearMessageHistory` |
| ui-photo.js | 写真UI | `showPhotoList`, `showPhotoViewer`, `showPhotoFromMarker`, `initPhotoViewerControls` |
| ui-dialog.js | ダイアログ | `showDocNameDialog`, `showDocumentListDialog`, `showDataSize`, `showClearDataDialog` |
| ui-settings.js | 設定・時計 | `initClock`, `initSettings`, `showSettingsDialog`, `showMessageHistoryDialog` |
| ui-auth.js | ユーザー登録 | `initAuthUI`, `checkAndUpdateUserStatus` |
| app-main.js | 初期化・配線 | `initApp`, `setupEventListeners` |

---

## 12. 変更履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-01-22 | 202601 | 初版作成 |
| 2026-01-24 | 202601 | GPS記録条件・写真解像度・ES6モジュール構成更新 |
| 2026-01-29 | 202601 | テキストメモ機能追加 |
| 2026-02-01 | 202601 | 写真撮影フロー改善（上書き保存・保存後画面維持） |
| 2026-02-02 | 202602 | アプリ名をRouteLoggerに変更、IndexedDB名更新 |
| 2026-02-28 | 202602 | 写真方向をダイアル式に変更、KMZ export/import 機能、外部レイヤー表示、設定パネル拡充、Wake Lock を Save/Load にも適用、IndexedDB v4 |
| 2026-03-07 | 202603 | Load機能改善、写真解像度／サムネール／品質設定追加、ユーザー認証UI、Saveダイアログタイトル切替、写真マーカータップ時にIndexedDB最新データを使用 |
| 2026-04-01 | 202604 | サムネールファイル名を元JPEGベースに変更、Loadはファイルのみに、KMLポップアップ表示形式変更、写真一覧グリッドをメモのみ表示に変更 |
| 2026-04-09 | RLog-v11 | 撮影直後に direction=0/facing='forward' でデフォルト保存、KMZ復元のラインを `#000080` に、外部レイヤーを `#0055ff` に変更 |
| 2026-05-01 | RLog-v10.7 | 写真ビューアに Edit Memo / Delete / Forward+Backward 独立トグルを追加、写真一覧に方向バッジ表示、写真ライトボックスを追加（Google Drive対応・iframeフォールバック）、外部写真タブを追加、メッセージ履歴機能を追加（最大200件、GPS記録中は除外）、ステータスバー自動非表示（10秒）、設定にユーザー登録UI（`userAdmin`コレクション）を追加、箕面緊急ポイント／ハイキングルートのオーバーレイ機能を追加、隠し詳細設定（写真解像度・JPEG品質・サムネール・マーカー色サイズ・過去データDrive移行）を追加、Cloud Functions（`generateKmzAndSendEmail` / `migrateRoutesToDrive`）を追加、Service Worker キャッシュ名を `RLog-v10.7` に、地図初期位置を箕面大滝固定に変更 |
