// ============================================================
// 戦闘演出（DOMを直接いじる軽量なエフェクト層）
//   盤面は毎回描き直すので、演出は「描き直しの前に位置を控えておいて、
//   その座標で独立したレイヤーに描く」方式にしている。
// ============================================================

let layer = null;
function getLayer() {
  if (!layer || !document.body.contains(layer)) {
    layer = document.createElement('div');
    layer.id = 'fxlayer';
    document.body.appendChild(layer);
  }
  return layer;
}

export const wait = ms => new Promise(r => setTimeout(r, ms));
const cx = r => r.left + r.width / 2;
const cy = r => r.top + r.height / 2;

function spawn(html, style = '') {
  const el = document.createElement('div');
  el.innerHTML = html;
  const node = el.firstElementChild;
  node.style.cssText += style;
  getLayer().appendChild(node);
  return node;
}
function kill(node, ms) { setTimeout(() => node.remove(), ms); }

/** 盤面と両プレイヤーの位置を控える（描き直し前に呼ぶ） */
export function snapshotRects() {
  const snap = { mons: {}, bar: {}, sup: {} };
  document.querySelectorAll('.mini[data-side]').forEach(el => {
    snap.mons[`${el.dataset.side}:${el.dataset.slot}`] = el.getBoundingClientRect();
  });
  const bars = document.querySelectorAll('.battle > .bar');
  // ライフの数字の位置を基準にする（バー全体だと画面中央になってしまう）
  const lifeRect = bar => (bar.querySelector('.lifebox') || bar).getBoundingClientRect();
  if (bars[0]) snap.bar[1] = lifeRect(bars[0]);
  if (bars[1]) snap.bar[0] = lifeRect(bars[1]);
  const bt = document.querySelector('.battle');
  snap.battle = bt ? bt.getBoundingClientRect() : null;
  return snap;
}

/** 数字が浮き上がる（ダメージ・回復） */
export function fxNumber(rect, value, kind = 'damage') {
  if (!rect) return;
  const sign = kind === 'heal' ? '+' : '−';
  // 画面上端に近いときは下向きに浮かせる（相手のライフは一番上にあるため）
  const up = cy(rect) > 120;
  const node = spawn(`<div class="fxnum ${kind} ${up ? '' : 'down'}">${sign}${value}</div>`,
    `left:${cx(rect)}px;top:${Math.max(46, cy(rect))}px;`);
  kill(node, 1000);
}

/** 破壊の閃光 */
export function fxBurst(rect, color = '#ffb27a') {
  if (!rect) return;
  const node = spawn(`<div class="fxburst"></div>`,
    `left:${cx(rect)}px;top:${cy(rect)}px;--fxc:${color};`);
  kill(node, 800);
  const ring = spawn(`<div class="fxshatter"></div>`,
    `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;--fxc:${color};`);
  kill(ring, 800);
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
    const d = 46 + Math.random() * 40;
    const p = spawn(`<div class="fxpiece"></div>`,
      `left:${cx(rect)}px;top:${cy(rect)}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--fxc:${color};`);
    kill(p, 620);
  }
}

/** 攻撃の突進：カードの影が相手へ飛んで戻る */
export async function fxLunge(from, to, html) {
  if (!from || !to) { await wait(120); return; }
  const node = spawn(`<div class="fxcard">${html}</div>`,
    `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;`);
  const dx = cx(to) - cx(from), dy = cy(to) - cy(from);
  // 対象の手前まで踏み込む
  await node.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx * 0.18}px,${dy * 0.18}px) scale(1.04)`, offset: 0.22 },
    { transform: `translate(${dx * 0.82}px,${dy * 0.82}px) scale(1.1)`, offset: 0.52 },
    { transform: 'translate(0,0) scale(1)' },
  ], { duration: 430, easing: 'cubic-bezier(.3,.9,.3,1)' }).finished.catch(() => {});
  node.remove();
}

/** 直接攻撃の斬撃線 */
export function fxSlash(rect) {
  if (!rect) return;
  const node = spawn(`<div class="fxslash"></div>`, `left:${cx(rect)}px;top:${cy(rect)}px;`);
  kill(node, 420);
}

/** 画面を揺らす */
export function fxShake(power = 1) {
  const el = document.querySelector('.battle');
  if (!el) return;
  const p = Math.min(14, 4 + power * 2);
  el.animate([
    { transform: 'translate(0,0)' },
    { transform: `translate(${p}px,${-p * 0.6}px)` },
    { transform: `translate(${-p * 0.8}px,${p * 0.5}px)` },
    { transform: `translate(${p * 0.5}px,${p * 0.3}px)` },
    { transform: 'translate(0,0)' },
  ], { duration: 260, easing: 'ease-out' });
}

/** 中央のバナー（ターン開始など） */
export async function fxBanner(text, sub = '', ms = 900) {
  const node = spawn(`<div class="fxbanner"><div class="t">${text}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`);
  await wait(ms);
  node.classList.add('out');
  kill(node, 320);
}

/** 召喚したマスを光らせる */
export function fxSummon(side, slot) {
  const el = document.querySelector(`.mini[data-side="${side}"][data-slot="${slot}"]`);
  if (!el) return;
  el.classList.add('justplayed');
  const r = el.getBoundingClientRect();
  const node = spawn(`<div class="fxring"></div>`, `left:${cx(r)}px;top:${cy(r)}px;`);
  kill(node, 620);
}

/** ライフバーを光らせる */
export function fxHit(side, snap) {
  const r = snap.bar[side];
  if (!r) return;
  const node = spawn(`<div class="fxhit"></div>`,
    `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`);
  kill(node, 420);
}
