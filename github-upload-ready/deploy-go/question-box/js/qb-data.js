/**
 * 質問フロー用の定数（料金・Cloudinary・デモコーチ一覧）
 * アップロード設定を変える場合は CLOUD_NAME / UPLOAD_PRESET を編集
 */
export const CLOUD_NAME = "doipeut1j";
export const UPLOAD_PRESET = "sprint_preset";

export const CHECKOUT_BASE_URL = "";

export const PRICES = {
  standard: { text: 100, plus: 150 },
  premium: { text: 200, plus: 250 },
};

export const COACHES = [
  { id: "c1", name: "田中 翔", bio: "短距離・スタートを専門に、フォームを丁寧にフィードバック。" },
  { id: "c2", name: "佐藤 凛", bio: "中間加速やピッチなど、走りの細部までアドバイス。" },
  { id: "c3", name: "鈴木 大輔", bio: "ラストスパートとメンタル面の両方をサポート。" },
];
