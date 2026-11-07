// DoMate の設定ファイル
// ------------------------------------------------------------
// 2つとも空のまま → 「デモモード」（データはこのブラウザの中だけに保存）
// Supabase の値を入れる → 「本番モード」（ログインあり・みんなで投稿を共有）
//
// 値は Supabase の管理画面 → Project Settings → API（または Data API / API Keys）で確認できます。
// ここに入れる Publishable key（anon key）は公開しても大丈夫なキーです。
// ※「service_role」や「secret」と書かれたキーは絶対に入れないでください。
// ------------------------------------------------------------
window.DOMATE_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
