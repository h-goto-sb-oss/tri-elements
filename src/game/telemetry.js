// ============================================================
// 匿名の遊び方データ（どこまで進んだか・どこで負けたか・何分遊んだか）
//
// 送るのは track() に渡す短い値だけ。**名前・セーブの中身は送らない。**
// デッキは「対戦に使った30枚の構成」だけ送る（カードの採用率・勝率を見るため。2026-09-12〜）。
// 人の区別は、この端末で最初に作る乱数の id だけ（誰かは分からない）。
// 受け口はサーバーの Caddy が 204 を返して1行記録するだけ（IP は記録から消している）。
// 集計は tools/stats_report.py。設定→データで止められる。
// ============================================================

const ENDPOINT = 'https://te.161-33-217-165.nip.io/e';
const KEY_ID = 'tri-elements-anon';      // { id, first: 'YYYY-MM-DD' }
const KEY_OFF = 'tri-elements-stats';    // 'off' で送らない

const SESSION = Math.random().toString(36).slice(2, 8);
const T0 = Date.now();

function readId() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_ID) || 'null');
    if (v && v.id) return { ...v, fresh: false };
  } catch { /* 壊れていたら作り直す */ }
  const v = { id: Math.random().toString(36).slice(2, 10), first: new Date().toISOString().slice(0, 10) };
  try { localStorage.setItem(KEY_ID, JSON.stringify(v)); } catch { /* 保存できない環境でも送れる */ }
  return { ...v, fresh: true };
}
const ME = readId();

export function statsEnabled() {
  try { return localStorage.getItem(KEY_OFF) !== 'off'; } catch { return false; }
}
export function setStatsEnabled(on) {
  try { on ? localStorage.removeItem(KEY_OFF) : localStorage.setItem(KEY_OFF, 'off'); } catch { /* 無視 */ }
}

/** どこで遊ばれているか（itch.io の埋め込み／GitHub Pages／それ以外） */
function where() {
  const h = location.hostname;
  if (/itch\.(zone|io)$/.test(h)) return 'itch';
  if (h.endsWith('github.io')) return 'gh';
  return 'other';
}

/** 初めて開いた日から何日目か（0＝初日） */
function dayIndex() {
  const d = (Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(ME.first)) / 864e5;
  return Number.isFinite(d) ? Math.max(0, Math.round(d)) : 0;
}

export function track(ev, data = {}) {
  // 開発中（vite の dev サーバー）は送らない。数字が自分の試しプレイで汚れるので
  if (!import.meta.env.PROD || !statsEnabled()) return;
  const q = new URLSearchParams({
    v: '1', u: ME.id, s: SESSION, e: ev,
    t: String(Math.round((Date.now() - T0) / 1000)),
    d: String(dayIndex()), h: where(),
    b: typeof __BUILD__ === 'string' ? __BUILD__ : '',
  });
  for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== null) q.set(k, String(v));
  const url = `${ENDPOINT}?${q}`;
  // 画面を閉じる瞬間でも届くよう sendBeacon を先に使う。使えなければ画像の読み込みで送る
  try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch { /* 次へ */ }
  try { new Image().src = url; } catch { /* 送れなくても遊ぶ邪魔はしない */ }
}

/** デッキを「f05-3.w02-2.x_g3」の形に詰める（id に - と . は使われていない）。並びは id 順 */
export function packDeck(deck) {
  const n = {};
  for (const id of deck || []) n[id] = (n[id] || 0) + 1;
  return Object.keys(n).sort().map(id => (n[id] > 1 ? `${id}-${n[id]}` : id)).join('.');
}

/** 初めてこの端末で開いたか（id を今作ったか） */
export const firstVisit = ME.fresh;
