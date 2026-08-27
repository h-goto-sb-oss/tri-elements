// ============================================================
// public/ 以下の素材は "/assets/..." のようなルート絶対パスで
// art_map.js / assets_map.js に登録されている。
// ローカル開発（base: '/'）ではそれで問題ないが、GitHub Pages の
// https://<user>.github.io/tri-elements/ のようなサブパス配信では
// ルート直下を指してしまい404になる。Viteのbase設定を焼き込む。
// ============================================================
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** "/assets/..." のようなルート絶対パスに配信base（サブパス）を付ける */
export function withBase(path) {
  return path ? BASE + path : path;
}
