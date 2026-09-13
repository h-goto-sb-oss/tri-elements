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

/** 端末の暦での今日（YYYY-MM-DD）。toISOString は世界標準時なので、日本の0〜9時に前日になってしまう */
function today() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function readId() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_ID) || 'null');
    if (v && v.id) return { ...v, fresh: false };
  } catch { /* 壊れていたら作り直す */ }
  const v = { id: Math.random().toString(36).slice(2, 10), first: today() };
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
  // PLiCy はゲーム本体を別のドメインから配信することがあるので、埋め込み元（親ページ）も見る
  let parent = '';
  try { parent = [document.referrer, ...(location.ancestorOrigins ? [...location.ancestorOrigins] : [])].join(' '); } catch { /* 見られなくてもよい */ }
  if (/plicy/i.test(h) || /plicy\.net/i.test(parent)) return 'plicy';
  return 'other';
}

/** 初めて開いた日から何日目か（0＝初日） */
function dayIndex() {
  // 両方とも「YYYY-MM-DD」を同じ規則で読むので、差はちょうど日数になる
  const d = (Date.parse(today()) - Date.parse(ME.first)) / 864e5;
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
