// RouteLogger - 設定・定数

// IndexedDB設定
export const DB_NAME = 'RouteLoggerDB';
export const DB_VERSION = 4;
export const STORE_TRACKS = 'tracks';
export const STORE_PHOTOS = 'photos';
export const STORE_SETTINGS = 'settings';
export const STORE_EXTERNALS = 'externals';
export const STORE_EXTERNAL_PHOTOS = 'external_photos';

// デフォルト位置（箕面大滝）
export const DEFAULT_POSITION = {
    lat: 34.853667,
    lng: 135.472041,
    zoom: 15
};

// GPS記録条件
export const GPS_RECORD_INTERVAL_SEC = 60;  // 記録間隔（秒）
export const GPS_RECORD_DISTANCE_M = 20;    // 記録距離（メートル）

// 写真解像度
export const PHOTO_WIDTH = 360;
export const PHOTO_HEIGHT = 640;
export const PHOTO_QUALITY = 0.7;

// 画像設定の規定値
export const DEFAULT_PHOTO_RESOLUTION_LEVEL = 1; // 360×640px（中）
export const DEFAULT_PHOTO_QUALITY = 70;          // 70%
export const DEFAULT_THUMBNAIL_SIZE = 160;        // 160px

// マーカー色の規定値
export const DEFAULT_MARKER_COLOR_EMERGENCY = '#00AA00'; // 緊急ポイント
export const DEFAULT_MARKER_COLOR_ROUTE     = '#FF8C00'; // ハイキングルート
export const DEFAULT_MARKER_COLOR_SPOT      = '#1E90FF'; // スポット
export const DEFAULT_MARKER_COLOR_TRACK     = '#000080'; // トラック
export const DEFAULT_MARKER_COLOR_PHOTO     = '#000080'; // 写真撮影場所

// マーカーサイズの規定値
export const DEFAULT_MARKER_SIZE_EMERGENCY = 7; // 緊急ポイント（半径 px）
export const DEFAULT_MARKER_SIZE_ROUTE     = 3; // ハイキングルート（線幅 px）
export const DEFAULT_MARKER_SIZE_SPOT      = 5; // スポット（一辺の半分 px）
export const DEFAULT_MARKER_SIZE_TRACK     = 4; // トラック（線幅 px）
export const DEFAULT_MARKER_SIZE_PHOTO     = 6; // 写真撮影場所（半径 px）

// 隠し設定セクション解除トリガー（アプリバージョン表示をn回タップ）
export const HIDDEN_SETTINGS_TAP_COUNT = 5;  // 必要タップ回数
export const HIDDEN_SETTINGS_TAP_SEC = 3;    // 判定時間ウィンドウ（秒）

// 地図タイル設定
export const GSI_TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
export const GSI_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>';
export const MAP_MAX_NATIVE_ZOOM = 18;
export const MAP_MAX_ZOOM = 20;
export const MAP_MIN_ZOOM = 5;
