// ============================================================
// public/ 以下の素材は "/assets/..." のようなルート絶対パスで
// art_map.js / assets_map.js に登録されている。
// ローカル開発（base: '/'）ではそれで問題ないが、GitHub Pages の
// https://<user>.github.io/tri-elements/ のようなサブパス配信では
// ルート直下を指してしまい404になる。Viteのbase設定を焼き込む。
// ============================================================
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// 素材はファイル名が変わらないので、絵を差し替えても端末に残った古い画像が
// そのまま使われ続けてしまう（index.html だけ毎回取りに行っても直らない）。
// ビルド日時を問い合わせに付けて、公開するたびに取り直させる。
// 同じ版のあいだは URL が変わらないので、キャッシュはきちんと効く。
const V = typeof __BUILD__ === 'string' ? __BUILD__.replace(/\D/g, '') : '';

/** "/assets/..." のようなルート絶対パスに配信base（サブパス）と版を付ける */
export function withBase(path) {
  if (!path) return path;
  const url = BASE + path;
  return V ? url + (url.includes('?') ? '&' : '?') + 'v=' + V : url;
}
