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

/**
 * アニメーションの終了を待つ。ただし必ず終わる。
 * タブを裏に回すとブラウザが Web Animations を止めてしまい .finished が
 * 永久に解決しない。待ちっぱなしになると盤面が操作不能になるので、
 * 想定時間を過ぎたら打ち切る。
 */
function settle(anim, ms) {
  return Promise.race([
    anim.finished.catch(() => {}),
    wait(ms + 120),
  ]);
}
// 端末側で「動きを減らす」が有効なら、画面を揺らす系はやらない
const calm = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const snap = { mons: {}, bar: {}, sup: {}, pile: {} };
  document.querySelectorAll('.mini[data-side]').forEach(el => {
    snap.mons[`${el.dataset.side}:${el.dataset.slot}`] = el.getBoundingClientRect();
  });
  // 山札の位置（ドロー演出の出発点）。上段が相手・下段が自分。
  const piles = document.querySelectorAll('.field .pile:not(.grave) .stack');
  if (piles[0]) snap.pile['deck:1'] = piles[0].getBoundingClientRect();
  if (piles[1]) snap.pile['deck:0'] = piles[1].getBoundingClientRect();
  const hand = document.querySelector('.hand');
  if (hand) {
    const r = hand.getBoundingClientRect();
    snap.hand = { left: r.left + r.width / 2 - 30, top: r.top + 10, width: 60, height: 92 };
  }
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
  const big = kind === 'damage' && value >= 4 ? ' big' : '';
  const node = spawn(`<div class="fxnum ${kind}${big} ${up ? '' : 'down'}">${sign}${value}</div>`,
    `left:${cx(rect)}px;top:${Math.max(46, cy(rect))}px;`);
  kill(node, 1200);
}

/**
 * 大ダメージの一撃。画面を拡大する代わりに、衝撃波と亀裂で重さを出す。
 * value が大きいほど強く、長く見せる。
 */
export function fxHeavyHit(rect, value = 4) {
  if (!rect) return;
  const power = Math.max(0, Math.min(1, (value - 3) / 7));   // 4 → 0.14, 10 → 1
  const wave = spawn('<div class="fxwave"></div>',
    `left:${cx(rect)}px;top:${cy(rect)}px;--fxp:${1 + power};`);
  kill(wave, 760);
  if (!calm()) {
    const flash = spawn('<div class="fxvignette"></div>', `--fxo:${0.28 + power * 0.4};`);
    kill(flash, 620);
    // 破片を放射状に飛ばす
    const n = 8 + Math.round(power * 10);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const d = (60 + Math.random() * 70) * (1 + power);
      const p = spawn('<div class="fxshard"></div>',
        `left:${cx(rect)}px;top:${cy(rect)}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;`);
      kill(p, 720);
    }
  }
  fxShake(1 + power * 4);
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
  await settle(node.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx * 0.18}px,${dy * 0.18}px) scale(1.04)`, offset: 0.22 },
    { transform: `translate(${dx * 0.82}px,${dy * 0.82}px) scale(1.1)`, offset: 0.52 },
    { transform: 'translate(0,0) scale(1)' },
  ], { duration: 430, easing: 'cubic-bezier(.3,.9,.3,1)' }), 430);
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
  if (!el || calm()) return;
  // 盤面は scale(...) で画面に合わせてあるので、その倍率を足したまま揺らす。
  // 以前は translate だけを指定していて倍率が消え、揺れるたびに
  // 盤面が原寸へ跳ね上がる（画面アップに見える）不具合になっていた。
  const base = el.style.transform || '';
  const p = Math.min(14, 4 + power * 2);
  el.animate([
    { transform: `${base} translate(0,0)` },
    { transform: `${base} translate(${p}px,${-p * 0.6}px)` },
    { transform: `${base} translate(${-p * 0.8}px,${p * 0.5}px)` },
    { transform: `${base} translate(${p * 0.5}px,${p * 0.3}px)` },
    { transform: `${base} translate(0,0)` },
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

/**
 * レジェンドの召喚。
 * 金の紋章が割れて、光の柱と星が降りてくる。
 */
export async function fxLegendSummon(side, slot, name = '') {
  const el = document.querySelector(`.mini[data-side="${side}"][data-slot="${slot}"]`);
  const r = el ? el.getBoundingClientRect() : null;
  if (!r) return;
  const veil = spawn('<div class="fxlegveil"></div>');
  kill(veil, 1400);
  const pillar = spawn('<div class="fxlegpillar"></div>',
    `left:${cx(r)}px;top:${cy(r)}px;height:${Math.max(window.innerHeight, 900)}px;`);
  kill(pillar, 1100);
  const seal = spawn('<div class="fxlegseal"></div>', `left:${cx(r)}px;top:${cy(r)}px;`);
  kill(seal, 1100);
  if (!calm()) {
    for (let i = 0; i < 18; i++) {
      const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
      const d = 70 + Math.random() * 90;
      const p = spawn('<div class="fxlegstar"></div>',
        `left:${cx(r)}px;top:${cy(r)}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;` +
        `animation-delay:${(i % 6) * 40}ms;`);
      kill(p, 1100);
    }
  }
  if (name) {
    const label = spawn(`<div class="fxlegname">${name}</div>`, `left:${cx(r)}px;top:${r.top - 18}px;`);
    kill(label, 1300);
  }
  fxShake(2);
  await wait(760);
}

/** ライフバーを光らせる */
export function fxHit(side, snap) {
  const r = snap.bar[side];
  if (!r) return;
  const node = spawn(`<div class="fxhit"></div>`,
    `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`);
  kill(node, 420);
}

// ============================================================
// ここから追加の演出
// ============================================================

const EL_COLOR = { fire: '#ff8a4c', water: '#5fbcff', grass: '#6fdc84', none: '#ffd98a' };
export const elementColor = el => EL_COLOR[el] || EL_COLOR.none;

/** 属性有利：対象を属性色で殴り、「属性有利」の札を出す */
export function fxElementBonus(rect, element) {
  if (!rect) return;
  const c = elementColor(element);
  const node = spawn(`<div class="fxelem"><span>属性有利</span></div>`,
    `left:${cx(rect)}px;top:${cy(rect)}px;--fxc:${c};`);
  kill(node, 900);
  for (let i = 0; i < 3; i++) {
    const ring = spawn(`<div class="fxelemring"></div>`,
      `left:${cx(rect)}px;top:${cy(rect)}px;--fxc:${c};animation-delay:${i * 90}ms;`);
    kill(ring, 760 + i * 90);
  }
}

/** 守りきった：盾のリングを張る */
export function fxGuard(rect) {
  if (!rect) return;
  const node = spawn(`<div class="fxguard"><span>防御</span></div>`,
    `left:${cx(rect)}px;top:${cy(rect)}px;`);
  kill(node, 760);
}

/** 強化：上向きの矢印と増分 */
export function fxBuff(rect, atk = 0, def = 0) {
  if (!rect) return;
  const label = [atk ? `⚔+${atk}` : '', def ? `🛡+${def}` : ''].filter(Boolean).join(' ') || '強化';
  const node = spawn(`<div class="fxbuff">${label}</div>`,
    `left:${cx(rect)}px;top:${cy(rect)}px;`);
  kill(node, 900);
  const glow = spawn(`<div class="fxbuffglow"></div>`,
    `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`);
  kill(glow, 700);
  for (let i = 0; i < 6; i++) {
    const dx = (Math.random() - 0.5) * rect.width * 0.8;
    const mote = spawn(`<div class="fxmote"></div>`,
      `left:${cx(rect) + dx}px;top:${rect.bottom - 6}px;animation-delay:${i * 60}ms;`);
    kill(mote, 900 + i * 60);
  }
}

/** 回復：緑の光が立ちのぼる */
export function fxHeal(rect) {
  if (!rect) return;
  for (let i = 0; i < 7; i++) {
    const dx = (Math.random() - 0.5) * 80;
    const mote = spawn(`<div class="fxmote heal"></div>`,
      `left:${cx(rect) + dx}px;top:${cy(rect) + 10}px;animation-delay:${i * 55}ms;`);
    kill(mote, 950 + i * 55);
  }
}

/** モード変更：枠が縦横に回る */
export function fxFlip(side, slot) {
  const el = document.querySelector(`.mini[data-side="${side}"][data-slot="${slot}"]`);
  if (!el) return;
  el.animate([
    { transform: 'rotateY(0deg) scale(1)' },
    { transform: 'rotateY(90deg) scale(1.06)', offset: 0.5 },
    { transform: 'rotateY(0deg) scale(1)' },
  ], { duration: 340, easing: 'ease-in-out' });
  const r = el.getBoundingClientRect();
  const node = spawn(`<div class="fxring mode"></div>`, `left:${cx(r)}px;top:${cy(r)}px;`);
  kill(node, 560);
}

/** ドロー：山札から手札へカードが滑る */
export function fxDraw(fromRect, toRect) {
  if (!fromRect) return;
  const to = toRect || { left: fromRect.left, top: fromRect.top + 200, width: fromRect.width, height: fromRect.height };
  const node = spawn(`<div class="fxdrawcard"></div>`,
    `left:${fromRect.left}px;top:${fromRect.top}px;width:${fromRect.width}px;height:${fromRect.height}px;`);
  const dx = cx(to) - cx(fromRect), dy = cy(to) - cy(fromRect);
  node.animate([
    { transform: 'translate(0,0) scale(.9) rotate(-6deg)', opacity: 0 },
    { transform: `translate(${dx * 0.4}px,${dy * 0.4}px) scale(1.05) rotate(2deg)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px,${dy}px) scale(.85) rotate(0deg)`, opacity: 0 },
  ], { duration: 460, easing: 'cubic-bezier(.25,.8,.35,1)' });
  kill(node, 500);
}

/** サポート発動：カードが浮き上がって光る */
export async function fxSupportCast(html, element = 'none') {
  const c = elementColor(element);
  const node = spawn(`<div class="fxcast" style="--fxc:${c}">${html}</div>`);
  await settle(node.animate([
    { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.06)', opacity: 1, offset: 0.3 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.68 },
    { transform: 'translate(-50%,-58%) scale(.92)', opacity: 0 },
  ], { duration: 620, easing: 'ease-out' }), 620);
  node.remove();
}

/** キーワードの発動を短く見せる（貫通・連撃など） */
export function fxKeyword(rect, label, color = '#ffd36a') {
  if (!rect) return;
  const node = spawn(`<div class="fxkw">${label}</div>`,
    `left:${cx(rect)}px;top:${rect.top - 6}px;--fxc:${color};`);
  kill(node, 780);
}

/** とどめ：画面が白く飛んで、ゆっくり収まる */
export async function fxLethal() {
  const node = spawn(`<div class="fxlethal"></div>`);
  const el = calm() ? null : document.querySelector('.battle');
  if (el) {
    el.animate([
      { filter: 'brightness(1)' },
      { filter: 'brightness(1.8) saturate(.4)', offset: 0.12 },
      { filter: 'brightness(1)' },
    ], { duration: 700, easing: 'ease-out' });
  }
  fxShake(4);
  await wait(560);
  node.remove();
}
