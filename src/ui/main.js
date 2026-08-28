// ============================================================
// UI エントリ
// ============================================================
import { ALL_CARDS, card, ELEMENTS, KEYWORDS } from '../engine/cards.js';
import { RARITY } from '../engine/rarity.js';
import { CHARACTER_OF, CHARACTER_WINS_NEEDED } from '../engine/cards_chars.js';
import {
  createGame, mulligan, applyAction, legalAttackTargets, canSummon, canPlaySupport,
  canChangeMode, canAttack, supportNeedsTarget, fieldMonsters, effAtk, effDef,
  isMonster, matchFilter, hasKw, emptySlot, canForge, canSummonAt, summonCostOf, canEquipTo,
} from '../engine/game.js';
import { aiChooseAction } from '../engine/ai.js';
import { cardArtSource, cardArtSvg } from './art.js';
import { cardHtml, monsterHtml, supportHtml, detailHtml, esc } from './cardview.js';
import {
  AREAS, REWARD, openPack, PACK_TYPES, loadSave, writeSave,
  areaUnlocked, addCards, deckCurve, STARTER_DECK, AVATARS,
  FREE_DIFFICULTY, DUST_SHOP, REWARD_LIMIT, prismUnlocked,
  MAX_DECKS, ensureDecks,
} from '../game/campaign.js';
import * as Audio from './audio.js';
import {
  ENEMY_ART as _ENEMY_ART, AREA_BG as _AREA_BG, PLAYER_ART as _PLAYER_ART,
} from './assets_map.js';
import { withBase } from './base_url.js';
import { renderRulesPage } from './rules.js';
import * as Fx from './fx.js';

// assets_map.js のパスはルート絶対（"/assets/..."）で保存されている。
// GitHub Pages のサブパス配信（/tri-elements/ 配下）でも解決できるよう、
// 使う前にここで一括して配信baseを付けておく。
const withBaseMap = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, withBase(v)]));
const ENEMY_ART = withBaseMap(_ENEMY_ART);
const AREA_BG = withBaseMap(_AREA_BG);
const PLAYER_ART = withBaseMap(_PLAYER_ART);

const $app = document.getElementById('app');

const app = {
  screen: 'title',
  save: loadSave(),
  game: null,
  enemy: null, enemyKey: null, areaIndex: 0,
  phase: null,          // 'mulligan' | 'start' | 'play'
  sel: null,            // {kind:'attack', slot} 攻撃対象選択中
  popup: null,          // {type, x, y, ...} 盤面の小ポップアップ
  detail: null,         // 詳細表示中のカードID
  artZoom: null,        // 図鑑で拡大表示中のカードID
  graveView: null,      // 0|1 墓地を見ている
  hint: '', toast: '',
  aiTimer: null, result: null, packResult: null,
  deckDraft: null, poolSort: 'element',
  collectionSet: 1,
  free: null,           // フリーバトル中 { difficulty }
  freeDiff: 'normal',
  logOpen: false,       // 戦闘開始時は畳んでおく（盤面を隠さない）
  drag: null,           // ドラッグ中の情報
  audioInfo: null,
  playLog: [],          // 直近に召喚・発動されたカード（最大2件、新しい順）
};

/** スマホ幅かどうか。下メニューを出すか等の判断に使う */
function isNarrow() { return window.innerWidth <= 720; }

// ============================================================
// 場面ごとの BGM
// ============================================================
const SCENE_BGM = {
  title: 'bgm_menu', deck: 'bgm_menu', collection: 'bgm_menu', rules: 'bgm_menu', settings: 'bgm_menu',
  adventure: 'bgm_map', free: 'bgm_map', battle: 'bgm_battle',
};
/** ここから先の戦闘は後半用の曲に切り替える（黄昏の回廊＝6番目のエリア） */
const LATE_AREA_FROM = 5;
function syncBgm() {
  let key = SCENE_BGM[app.screen] || 'bgm_menu';
  if (key === 'bgm_battle' && !app.free && app.areaIndex >= LATE_AREA_FROM) key = 'bgm_battle_late';
  Audio.playBgm(key);
}

function go(screen) {
  clearTimeout(app.aiTimer);
  Audio.stopSe();
  app.screen = screen; app.result = null; app.popup = null; app.sel = null; app.detail = null; app.artZoom = null;
  if (screen === 'deck') app.deckDraft = [...app.save.deck];
  syncBgm(); render({ resetScroll: true });   // 画面を変えたときは先頭から
}

function toast(msg, ms = 1700) {
  Audio.playSe('se_error', { gap: 300 });
  app.toast = msg; render();
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { app.toast = ''; render(); }, ms);
}

// ============================================================
// 敵の立ち絵（assets/enemy/<key>.png があれば差し替え）
// ============================================================
const AREA_TINT = { a1: '#4a7a3a', a2: '#9a4020', a3: '#2b6a9a', a4: '#2f7048', a5: '#6a4a8a' };

/** 敵の立ち絵。assets/enemies の実素材があればそれ、無ければ代表カードの絵を使う。 */
function portraitHtml(areaId, index, enemy) {
  const src = ENEMY_ART[areaId + ':' + index];
  const bg = AREA_BG[areaId] || AREA_BG.common;
  const tint = AREA_TINT[areaId] || '#3a4a60';
  if (src) {
    return '<div class="portrait art">'
      + (bg ? '<div class="pbg" style="background-image:url(' + bg + ')"></div>' : '')
      + '<img class="pchar" src="' + src + '" alt="">'
      + '<div class="picon">' + enemy.icon + '</div></div>';
  }
  const faceCard = enemy.face ? card(enemy.face) : null;
  const fallback = faceCard
    ? '<div class="pface">' + cardArtSvg(faceCard) + '</div>'
    : '<div class="emoji">' + enemy.icon + '</div>';
  return '<div class="portrait" style="background:radial-gradient(circle at 50% 35%, ' + tint + ', #070a10 74%)">'
    + fallback + '<div class="picon">' + enemy.icon + '</div></div>';
}

/** エリアごとの背景。奥行きのあるシルエットを重ねる。 */
function areaSceneSvg(id) {
  const trees = [120, 250, 700, 900, 1080].map((x, i) =>
    '<g transform="translate(' + x + ' ' + (352 + (i % 2) * 14) + ')">'
    + '<rect x="-6" y="-6" width="12" height="46" fill="#3a2a16"/>'
    + '<circle cx="0" cy="-26" r="34" fill="#2f6a28"/>'
    + '<circle cx="-22" cy="-8" r="24" fill="#3a7d31"/>'
    + '<circle cx="22" cy="-8" r="24" fill="#3a7d31"/></g>').join('');
  const rocks = [80, 200, 1000, 1120].map(x =>
    '<path d="M' + x + ' 500 L' + (x + 26) + ' 400 L' + (x + 52) + ' 500z" fill="#20100a"/>').join('');
  const bergs = [[160, 300, 120], [420, 260, 170], [760, 300, 140], [1040, 275, 110]].map(a => {
    const x = a[0], y = a[1], h = a[2];
    return '<path d="M' + (x - h * 0.7) + ' 430 L' + x + ' ' + y + ' L' + (x + h * 0.7) + ' 430z" fill="#dff2ff" opacity=".92"/>'
      + '<path d="M' + x + ' ' + y + ' L' + (x + h * 0.7) + ' 430 L' + (x + h * 0.2) + ' 430z" fill="#9fd0ea"/>';
  }).join('');
  const bigTrees = [100, 330, 620, 900, 1120].map((x, i) =>
    '<g opacity="' + (0.5 + i * 0.1) + '"><rect x="' + (x - 22) + '" y="120" width="44" height="380" fill="#14351f"/>'
    + '<ellipse cx="' + x + '" cy="130" rx="120" ry="66" fill="#1d4a2a"/></g>').join('');
  const mist = [200, 500, 800, 1050].map(x =>
    '<ellipse cx="' + x + '" cy="360" rx="180" ry="26" fill="#cfe8bc"/>').join('');

  const scenes = {
    a1: '<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="#8fd0e8"/><stop offset="52%" stop-color="#cfe9b8"/><stop offset="100%" stop-color="#5f9a4a"/></linearGradient></defs>'
      + '<rect width="1200" height="500" fill="url(#sk)"/>'
      + '<circle cx="980" cy="96" r="52" fill="#fff6c9" opacity=".85"/>'
      + '<path d="M0 330 Q200 250 420 320 T860 300 T1200 340 L1200 500 L0 500z" fill="#4e8a3c" opacity=".85"/>'
      + '<path d="M0 390 Q260 330 520 386 T1200 400 L1200 500 L0 500z" fill="#356b2a"/>' + trees,
    a2: '<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="#5b1d16"/><stop offset="55%" stop-color="#b8471f"/><stop offset="100%" stop-color="#ffb454"/></linearGradient></defs>'
      + '<rect width="1200" height="500" fill="url(#sk)"/>'
      + '<circle cx="240" cy="120" r="60" fill="#ffd27a" opacity=".55"/>'
      + '<path d="M320 500 L600 150 L880 500z" fill="#3a1a10"/>'
      + '<path d="M540 240 Q600 190 660 240 Q640 300 600 300 Q560 300 540 240z" fill="#ff8a3c" opacity=".9"/>'
      + '<path d="M0 430 Q180 370 380 425 T760 430 T1200 415 L1200 500 L0 500z" fill="#2a120b"/>' + rocks,
    a3: '<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="#0d2a4a"/><stop offset="55%" stop-color="#3f86b8"/><stop offset="100%" stop-color="#bfe8f7"/></linearGradient></defs>'
      + '<rect width="1200" height="500" fill="url(#sk)"/>'
      + '<circle cx="900" cy="110" r="46" fill="#eaf7ff" opacity=".75"/>' + bergs
      + '<path d="M0 430 Q200 405 400 430 T800 430 T1200 425 L1200 500 L0 500z" fill="#2f6f9c"/>'
      + '<path d="M0 462 Q220 442 440 462 T880 462 T1200 458 L1200 500 L0 500z" fill="#1d4f75"/>',
    a4: '<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="#0e2a1a"/><stop offset="60%" stop-color="#2f6b40"/><stop offset="100%" stop-color="#87c06d"/></linearGradient></defs>'
      + '<rect width="1200" height="500" fill="url(#sk)"/>' + bigTrees
      + '<ellipse cx="600" cy="470" rx="700" ry="70" fill="#0d2416" opacity=".8"/>'
      + '<g opacity=".35">' + mist + '</g>',
    a5: '<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="#120a24"/><stop offset="55%" stop-color="#4b2f74"/><stop offset="100%" stop-color="#b98fd8"/></linearGradient></defs>'
      + '<rect width="1200" height="500" fill="url(#sk)"/>'
      + '<g opacity=".55"><path d="M0 130 Q300 40 600 120 T1200 90" stroke="#7ff0d0" stroke-width="16" fill="none"/>'
      + '<path d="M0 175 Q300 90 600 165 T1200 140" stroke="#8fb8ff" stroke-width="10" fill="none"/></g>'
      + '<path d="M120 500 L360 190 L600 500z" fill="#2a1b45"/>'
      + '<path d="M420 500 L700 130 L980 500z" fill="#1d1233"/>'
      + '<path d="M760 500 L980 220 L1200 500z" fill="#2a1b45"/>'
      + '<circle cx="700" cy="150" r="26" fill="#ffd98a" opacity=".9"/>',
  };
  return '<svg class="scene" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice">' + (scenes[id] || '') + '</svg>';
}

/** プレイヤーのアバター。assets/players に画像があればそれを使う */
export function avatarHtml(idx) {
  const src = PLAYER_ART[String(idx)];
  if (src) return `<img src="${src}" alt="">`;
  const a = AVATARS.find(x => x.id === Number(idx)) || AVATARS[0];
  return `<div class="avfb" style="background:radial-gradient(circle at 50% 34%, ${a.tint}, #0a0f18 76%)">${a.emoji}</div>`;
}
const myName = () => (app.save.profile?.name || 'あなた');
const myAvatar = () => (app.save.profile?.avatar || 1);

// ============================================================
// スマホ用の下メニュー（戦闘中は出さない）
// ============================================================
const NAV_ITEMS = [
  { go: 'adventure', icon: '⚔️', label: '冒険' },
  { go: 'free', icon: '🏟️', label: 'フリー' },
  { go: 'deck', icon: '🃏', label: 'デッキ' },
  { go: 'collection', icon: '📖', label: '図鑑' },
  { go: 'title', icon: '🏠', label: 'タイトル' },
];
function bottomNavHtml() {
  if (app.screen === 'battle' || !isNarrow()) return '';
  return `<nav class="bottomnav">${NAV_ITEMS.map(n => `
    <button class="bnav ${app.screen === n.go ? 'on' : ''}" data-go="${n.go}">
      <span class="bn-icon">${n.icon}</span><span class="bn-label">${n.label}</span>
    </button>`).join('')}</nav>`;
}

// ============================================================
// タイトル
// ============================================================
function renderTitle() {
  const owned = Object.values(app.save.collection).reduce((a, b) => a + b, 0);
  return `<div class="screen title-screen">
    <div class="title-bg" style="--titlebg:url(${withBase('/assets/backgrounds/title-bg.webp')})" aria-hidden="true"></div>
    <div class="title-shade" aria-hidden="true"></div>
    <div class="title-hero">
      <img class="title-logo" src="${withBase('/assets/ui/title-logo.svg')}" alt="TRI-ELEMENTS 三属の戦記">
      <p class="title-tagline">三つの力を束ね、まだ見ぬカードと世界へ。</p>
      <div class="title-elements" aria-label="炎・水・草の三属性">
        <span class="fire">🔥 炎</span><span class="water">💧 水</span><span class="grass">🌿 草</span>
      </div>
    </div>
    <div class="title-panel">
      <div class="titleprof">
        <div class="tface">${avatarHtml(myAvatar())}</div>
        <div class="titleprof-text"><b>${esc(myName())}</b><div>${app.save.stats.wins}勝 ${app.save.stats.losses}敗　<span>所持 ${owned}枚</span></div></div>
      </div>
      <div class="title-menu">
        <button class="title-action main" data-go="adventure"><span class="ta-icon">⚔️</span><span><b>冒険へ出る</b><small>物語を進める</small></span></button>
        <button class="title-action" data-go="free"><span class="ta-icon">🏟️</span><span><b>フリーバトル</b><small>好きな相手と対戦</small></span></button>
        <button class="title-action" data-go="deck"><span class="ta-icon">🃏</span><span><b>デッキ編集</b><small>30枚を編成</small></span></button>
        <button class="title-action" data-go="collection"><span class="ta-icon">📖</span><span><b>カード図鑑</b><small>全${ALL_CARDS.filter(c => !c.hidden).length}種を眺める</small></span></button>
        <button class="title-action" data-go="rules"><span class="ta-icon">📜</span><span><b>ルール説明</b><small>遊び方を確認</small></span></button>
        <button class="title-action quiet" data-go="settings"><span class="ta-icon">⚙️</span><span><b>設定</b><small>音量・プロフィール</small></span></button>
      </div>
    </div>
  </div>`;
}

/**
 * 保存してあるデッキの切り替え。
 * 戦う前にここで選べるようにして、いちいちデッキ編集へ行かなくていいようにする。
 */
function deckPickerHtml() {
  const decks = app.save.decks || [];
  if (decks.length < 1) return '';
  const active = app.save.activeDeck;
  return `<div class="deckpick">
    <span class="dp-label">デッキ</span>
    <div class="dp-slots">${decks.map((d, i) => {
      const ready = d.list.length === 30;
      return `<button class="dp-slot ${i === active ? 'on' : ''} ${ready ? '' : 'short'}"
        data-usedeck="${i}" ${ready ? '' : 'title="30枚そろっていません"'}>
        <b>${esc(d.name)}</b><small>${d.list.length}/30</small></button>`;
    }).join('')}</div>
    <button class="btn tiny" data-go="deck">編集</button>
  </div>`;
}

// ============================================================
// 冒険（エリアごとに1ページ）
// ============================================================
function renderAdventure() {
  const ai = Math.min(app.areaIndex, AREAS.length - 1);
  const area = AREAS[ai];
  const unlocked = areaUnlocked(app.save, ai);

  const tabs = AREAS.map((a, i) => {
    const ok = areaUnlocked(app.save, i);
    const done = a.enemies.every((_, k) => app.save.cleared[`${a.id}:${k}`]);
    return `<button class="adv-tab ${i === ai ? 'on' : ''} ${ok ? '' : 'locked'}"
      ${ok ? `data-area="${i}"` : 'disabled'}>${ok ? '' : '🔒'}${esc(a.name)}${done ? ' ✓' : ''}</button>`;
  }).join('');

  const foes = area.enemies.map((e, i) => {
    const cleared = !!app.save.cleared[`${area.id}:${i}`];
    // 1体目は常に挑戦可能。2体目以降は前の敵を倒すと解放
    const prevOk = i === 0 || !!app.save.cleared[`${area.id}:${i - 1}`];
    const open = unlocked && prevOk;
    const cnt = (app.save.clearCount || {})[`${area.id}:${i}`] || 0;
    const left = Math.max(0, REWARD_LIMIT - cnt);
    return `<div class="foe ${cleared ? 'cleared' : ''} ${open ? '' : 'locked'}">
      ${cleared ? `<div class="badge">${left ? `報酬 あと${left}回` : 'クリア済'}</div>` : ''}
      ${open ? '' : '<div class="lockicon">🔒</div>'}
      ${portraitHtml(area.id, i, e)}
      <div class="fname">${esc(e.name)}</div>
      <div class="fdesc">${esc(e.desc)}</div>
      <div class="fmeta">
        <span>ライフ <b>${e.life || 20}</b></span>
        ${e.startCost ? `<span>開始 <b>${e.startCost}</b>コスト</span>` : ''}
        ${e.weak ? `<span>${ELEMENTS[e.weak].icon}が有効</span>` : ''}
        ${i === area.enemies.length - 1 ? '<span style="color:#ffd27a">ボス</span>' : ''}
      </div>
      <button class="btn ${cleared && !left ? '' : 'primary'} fbtn" ${open ? `data-fight="${ai}:${i}"` : 'disabled'}>
        ${open ? (cleared ? (left ? `戦う（報酬あと${left}回）` : 'もう一度戦う') : '挑戦する') : '前の相手を倒すと解放'}
      </button>
    </div>`;
  }).join('');

  const packs = Object.entries(app.save.packs || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => `<button class="btn primary" data-openpack="${k}">${PACK_TYPES[k].name} ×${n} を開ける</button>`).join('');

  return `<div class="adventure">
    ${deckPickerHtml()}
    <div class="adv-head">
      <h2>${esc(area.name)}</h2>
      <div class="desc">${esc(area.desc)}<br><span style="color:#9fb2c8">報酬: ${PACK_TYPES[REWARD[area.id]].name}　／　撃破 ${area.enemies.filter((_, k) => app.save.cleared[`${area.id}:${k}`]).length}/${area.enemies.length}</span></div>
      <div class="adv-tabs">${tabs}</div>
    </div>
    <div class="adv-stage adv-${area.id}" ${AREA_BG[area.id] ? `style="--bgimg:url(${AREA_BG[area.id]})"` : ''}>
      ${AREA_BG[area.id] ? '<div class="stagebg"></div>' : areaSceneSvg(area.id)}
      <div class="foes">${foes}</div>
    </div>
    <div class="adv-foot">
      ${packs}
      <button class="btn" data-go="free">フリーバトル</button>
      <button class="btn" data-go="deck">デッキ編集</button>
      <button class="btn" data-go="title">タイトルへ</button>
    </div>
  </div>`;
}

// ============================================================
// フリーバトル
// ============================================================
function renderFree() {
  const beaten = [];
  AREAS.forEach((a, ai) => a.enemies.forEach((e, ei) => {
    if (app.save.cleared[`${a.id}:${ei}`]) beaten.push({ a, ai, e, ei, key: `${a.id}:${ei}` });
  }));

  const diffTabs = Object.entries(FREE_DIFFICULTY).map(([k, d]) => `
    <button class="tab ${app.freeDiff === k ? 'on' : ''}" data-freediff="${k}">
      ${d.name}${d.life ? `（敵ライフ+${d.life}・開始コスト+${d.cost}）` : ''}
    </button>`).join('');

  const shop = DUST_SHOP.map(x => {
    const unlocked = !x.unlockAfter || prismUnlocked(app.save);
    const ok = unlocked && (app.save.stardust || 0) >= x.cost;
    return `<button class="btn small ${ok ? 'primary' : ''}" ${ok ? `data-buypack="${x.pack}"` : 'disabled'}>
      ${unlocked ? PACK_TYPES[x.pack].name : '🔒 プリズム（エリア5クリア）'} ／ ✦${x.cost}</button>`;
  }).join('');

  const cards = beaten.map(({ a, ai, e, ei, key }) => {
    const st = app.save.freeStats?.[key] || { w: 0, l: 0 };
    return `<div class="foe free">
      ${portraitHtml(a.id, ei, e)}
      <div class="fname">${esc(e.name)}</div>
      <div class="fdesc">${esc(a.name)}</div>
      <div class="fmeta">
        <span>${st.w}勝 ${st.l}敗</span>
        ${e.weak ? `<span>${ELEMENTS[e.weak].icon}が有効</span>` : ''}
      </div>
      <button class="btn primary fbtn" data-freefight="${ai}:${ei}">戦う</button>
    </div>`;
  }).join('');

  return `<div class="adventure">
    ${deckPickerHtml()}
    <div class="adv-head">
      <h2>フリーバトル</h2>
      <div class="desc">一度倒した相手といつでも再戦できます。ここでの勝敗は冒険の戦績には影響しません。<br>
        <span style="color:#9fb2c8">勝つと星屑 ✦ が貯まり、パックと交換できます。</span></div>
      <div class="dust">✦ ${app.save.stardust || 0}</div>
    </div>
    <div class="freebar">
      <span class="hint" style="min-height:0">難易度</span>
      <div class="tabs">${diffTabs}</div>
      <span style="margin-left:auto"></span>
      <span class="hint" style="min-height:0">交換</span>
      ${shop}
    </div>
    <div class="adv-stage adv-free" ${AREA_BG.common ? `style="--bgimg:url(${AREA_BG.common})"` : ''}>
      ${AREA_BG.common ? '<div class="stagebg"></div>' : ''}
      <div class="foes scroll">${cards || '<div class="hint" style="font-size:14px">まだ誰も倒していません。冒険で1人倒すとここに並びます。</div>'}</div>
    </div>
    <div class="adv-foot">
      <button class="btn" data-go="deck">デッキ編集</button>
      <button class="btn" data-go="title">タイトルへ</button>
    </div>
  </div>`;
}

// ============================================================
// デッキ編集
// ============================================================
function sortPool(cards) {
  const elOrder = { fire: 0, water: 1, grass: 2, none: 3 };
  const s = app.poolSort;
  return [...cards].sort((a, b) => {
    if (s === 'element') return (elOrder[a.element] - elOrder[b.element]) || (a.cost - b.cost) || a.id.localeCompare(b.id);
    if (s === 'cost') return (a.cost - b.cost) || (elOrder[a.element] - elOrder[b.element]);
    if (s === 'rarity') return (RARITY[b.rarity].order - RARITY[a.rarity].order) || (a.cost - b.cost);
    if (s === 'type') return (a.type === b.type ? 0 : a.type === 'monster' ? -1 : 1) || (a.cost - b.cost);
    return 0;
  });
}

/** 編集中の内容が、選択中スロットの保存内容と違うか */
function deckDirty() {
  const saved = app.save.decks[app.save.activeDeck];
  if (!saved || !app.deckDraft) return false;
  const a = [...app.deckDraft].sort().join(',');
  const b = [...saved.list].sort().join(',');
  return a !== b;
}

/** スロットを切り替える。未保存なら1度目は警告して止める。 */
function switchDeckSlot(i) {
  if (i === app.save.activeDeck) return;
  if (deckDirty() && app.pendingSlot !== i) {
    app.pendingSlot = i;
    render();
    return toast('未保存の変更があります。もう一度押すと破棄して切り替えます');
  }
  app.pendingSlot = null;
  app.save.activeDeck = i;
  app.save.deck = [...app.save.decks[i].list];
  app.deckDraft = [...app.save.decks[i].list];
  writeSave(app.save);
  Audio.playSe('se_click');
  render();
}

function renderDeck() {
  const draft = app.deckDraft || (app.deckDraft = [...app.save.deck]);
  const counts = {};
  draft.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const curve = deckCurve(draft);
  const maxC = Math.max(1, ...Object.values(curve));
  const bars = [1, 2, 3, 4, 5, 6, 7].map(c =>
    `<div class="cbar" style="height:${Math.max(3, (curve[c] || 0) / maxC * 48)}px">
      <span>${curve[c] || ''}</span><em>${c === 7 ? '7+' : c}</em></div>`).join('');

  const deckCards = Object.keys(counts).map(id => card(id))
    .sort((a, b) => a.cost - b.cost || a.element.localeCompare(b.element) || a.id.localeCompare(b.id))
    .map(c => `<div class="dcard" data-deckcard="${c.id}" draggable="false">
        ${cardHtml(c, {})}<div class="cnt">×${counts[c.id]}</div>
        <button class="cinfo" data-cardinfo="${c.id}" title="カードの効果を見る" aria-label="${esc(c.name)}の詳細">i</button>
      </div>`).join('');

  const owned = Object.keys(app.save.collection).filter(id => app.save.collection[id] > 0).map(id => card(id));
  const pool = sortPool(owned).map(c => {
    const inDeck = counts[c.id] || 0;
    const own = app.save.collection[c.id];
    const full = inDeck >= Math.min(3, own) || draft.length >= 30;
    return `<div class="poolcard ${full ? 'full' : ''}" data-poolcard="${c.id}">
      ${cardHtml(c, { cls: full ? '' : 'selectable' })}
      <div class="own">${inDeck}/${Math.min(3, own)}</div>
      <button class="cinfo" data-cardinfo="${c.id}" title="カードの効果を見る" aria-label="${esc(c.name)}の詳細">i</button>
    </div>`;
  }).join('');

  const decks = app.save.decks;
  const active = app.save.activeDeck;
  const slots = decks.map((d, i) => `
    <button class="dslot ${i === active ? 'on' : ''} ${app.pendingSlot === i ? 'warn' : ''}" data-deckslot="${i}">
      <b>${esc(d.name)}</b><small>${d.list.length}/30</small>
    </button>`).join('')
    + (decks.length < MAX_DECKS
      ? `<button class="dslot add" data-deckadd title="新しいデッキを作る">＋</button>` : '');

  return `<div class="deckwrap">
    <div class="deckcol">
      <div class="dslots">${slots}</div>
      <div class="dnamerow">
        <input class="dname" data-deckname maxlength="14" value="${esc(decks[active].name)}"
          aria-label="デッキ名">
        <span class="dcount" style="color:${draft.length === 30 ? '#7fe0a0' : '#ff9a9a'}">${draft.length}/30</span>
        ${decks.length > 1 ? '<button class="btn tiny" data-deckdel>削除</button>' : ''}
      </div>
      <div class="curve">${bars}</div>
      <div style="height:10px"></div>
      <div class="decklist" data-decklist>${deckCards || '<div class="hint" style="width:100%;padding-top:30px">ここにカードをドラッグ</div>'}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn primary small" data-savedeck ${draft.length === 30 ? '' : 'disabled'}>保存</button>
        <button class="btn small" data-resetdeck>初期構築</button>
        <button class="btn small" data-cleardeck>全部外す</button>
        <button class="btn small" data-go="title">戻る</button>
      </div>
      <div class="hint"><span class="hint-mouse">カードをドラッグして出し入れ／クリックでも増減</span><span class="hint-touch">カードをタップで出し入れ／「i」で効果を見る</span>${
        deckDirty() ? '　<b style="color:#ffc07a">未保存の変更があります</b>' : ''}</div>
    </div>
    <div class="poolcol">
      <div class="pooltools">
        <b style="color:var(--gold)">所持カード</b>
        <span class="hint" style="min-height:0">並び順</span>
        <select class="sel" data-poolsort>
          <option value="element" ${app.poolSort === 'element' ? 'selected' : ''}>属性順</option>
          <option value="cost" ${app.poolSort === 'cost' ? 'selected' : ''}>コスト順</option>
          <option value="rarity" ${app.poolSort === 'rarity' ? 'selected' : ''}>レア度順</option>
          <option value="type" ${app.poolSort === 'type' ? 'selected' : ''}>種類順</option>
        </select>
      </div>
      <div class="pool" data-pool>${pool}</div>
    </div>
  </div>`;
}

// ============================================================
// 図鑑・ルール・サウンド
// ============================================================
function renderCollection() {
  const setInfo = {
    1: { name: '第1弾', sub: '三属の目覚め' },
    2: { name: '第2弾', sub: '嵐の来訪者' },
    3: { name: '第3弾', sub: '星辰の門' },
    4: { name: 'キャラクター', sub: '極の果てに現れる者たち' },
  };
  // キャラクターカードは隠し。1枚でも入手するまで弾のタブごと出さない
  const charOwned = ALL_CARDS.filter(c => c.hidden && app.save.collection[c.id]).length;
  const visible = ALL_CARDS.filter(c => !c.hidden || charOwned);
  const sets = [...new Set(visible.map(c => c.set || 1))].sort((a, b) => a - b);
  const activeSet = sets.includes(app.collectionSet) ? app.collectionSet : sets[0];
  const setCards = visible.filter(c => (c.set || 1) === activeSet);
  const setHave = setCards.filter(c => app.save.collection[c.id]).length;
  const copies = setCards.reduce((n, c) => n + (app.save.collection[c.id] || 0), 0);
  const tabs = sets.map(s => {
    const cards = visible.filter(c => (c.set || 1) === s);
    const have = cards.filter(c => app.save.collection[c.id]).length;
    const info = setInfo[s] || { name: `第${s}弾`, sub: '' };
    return `<button class="dexset ${s === activeSet ? 'on' : ''}" data-collectionset="${s}">
      <b>${info.name}</b><small>${esc(info.sub)}　${have}/${cards.length}</small>
    </button>`;
  }).join('');
  const groups = [['fire', '🔥 炎'], ['water', '💧 水'], ['grass', '🌿 草'], ['none', '✦ 汎用']];
  const html = groups.map(([el, label]) => {
    const cs = setCards.filter(c => c.element === el);
    if (!cs.length) return '';
    const have = cs.filter(c => app.save.collection[c.id]).length;
    return `<section class="dexgroup">
      <div class="dexgroup-head"><h3>${label}</h3><span>${have}/${cs.length}種</span></div>
      <div class="grid dexgrid">${cs.map(c => {
        const own = app.save.collection[c.id] || 0;
        // 隠しカードは、入手するまで中身を見せない（何が居るかも伏せる）
        if (c.hidden && !own) {
          return `<div class="poolcard"><div class="card secretcard"><div class="secretmark">？</div></div>
            <div class="own">未入手</div></div>`;
        }
        return `<div class="poolcard">${cardHtml(c, { cls: own ? 'selectable' : 'disabled' })}
          <div class="own">${own ? '×' + own : '未所持'}</div></div>`;
      }).join('')}</div></section>`;
  }).join('');
  const info = setInfo[activeSet] || { name: `第${activeSet}弾`, sub: '' };
  return `<div class="screen collection-screen">
    <div class="dexsticky">
      <div class="dexhead">
        <button class="dexback" data-go="title" aria-label="タイトルへ戻る">← <span>タイトルへ</span></button>
        <div class="dextitle"><h2>カード図鑑</h2><p>${info.name}「${esc(info.sub)}」</p></div>
        <div class="dexsummary"><b>${setHave}</b> / ${setCards.length}種<small>所持 ${copies}枚</small></div>
      </div>
      <div class="dexsets">${tabs}</div>
    </div>
    <div class="dexcontent">${html}</div>
  </div>`;
}

const renderRules = () => renderRulesPage();

function renderSettings() {
  const st = Audio.audioState;
  const tab = app.settingsTab || 'player';
  const avatars = AVATARS.map(a => `
    <button class="avpick ${myAvatar() === a.id ? 'on' : ''}" data-avatar="${a.id}">
      <div class="avimg">${avatarHtml(a.id)}</div>
    </button>`).join('');

  const player = `
    <div class="setrow">
      <label>プレイヤー名</label>
      <input class="tinput" type="text" maxlength="12" value="${esc(myName())}" data-playername>
    </div>
    <div class="setrow col">
      <label>アバター</label>
      <div class="avgrid">${avatars}</div>
    </div>`;

  const sound = `
    <div class="setrow">
      <label>ミュート</label>
      <input type="checkbox" data-mute ${st.muted ? 'checked' : ''}>
    </div>
    <div class="setrow">
      <label>BGM 音量</label>
      <input type="range" min="0" max="100" value="${Math.round(st.bgmVol * 100)}" data-bgmvol>
      <span class="hint" style="min-height:0">${Math.round(st.bgmVol * 100)}</span>
    </div>
    <div class="setrow">
      <label>効果音 音量</label>
      <input type="range" min="0" max="100" value="${Math.round(st.seVol * 100)}" data-sevol>
      <span class="hint" style="min-height:0">${Math.round(st.seVol * 100)}</span>
    </div>`;

  return `<div class="screen">
    <h2 style="color:var(--gold)">設定</h2>
    <div class="tabs">
      <button class="tab ${tab === 'player' ? 'on' : ''}" data-settab="player">プレイヤー</button>
      <button class="tab ${tab === 'sound' ? 'on' : ''}" data-settab="sound">サウンド</button>
    </div>
    <div class="setpanel">${tab === 'player' ? player : sound}</div>
    <button class="btn" data-go="title">戻る</button>
  </div>`;
}

/** 初回起動時：名前とアバターを決める */
function onboardingOverlay() {
  const draft = app.onboard || (app.onboard = { name: '', avatar: 1 });
  const avatars = AVATARS.map(a => `
    <button class="avpick ${draft.avatar === a.id ? 'on' : ''}" data-obavatar="${a.id}">
      <div class="avimg">${avatarHtml(a.id)}</div>
    </button>`).join('');
  return `<div class="overlay"><div class="modal" style="max-width:800px">
    <h2>ようこそ、三属の戦記へ</h2>
    <p>あなたの名前とアバターを決めてください。<br>あとから設定でいつでも変えられます。</p>
    <div class="setrow" style="justify-content:center">
      <label>名前</label>
      <input class="tinput" type="text" maxlength="12" placeholder="名前を入力" value="${esc(draft.name)}" data-obname>
    </div>
    <div class="avgrid" style="margin:14px 0">${avatars}</div>
    <div class="row-btn"><button class="btn primary" data-obstart>冒険をはじめる</button></div>
  </div></div>`;
}

// ============================================================
// バトル
// ============================================================
function pileHtml(kind, n, side) {
  return `<div class="pile ${kind === 'grave' ? 'grave' : ''} ${n ? '' : 'empty'}"
      ${kind === 'grave' ? `data-grave="${side}"` : ''}>
    <div class="stack"><i></i>${n > 1 ? '<i></i>' : ''}${n > 6 ? '<i></i>' : ''}</div>
    <div>${kind === 'grave' ? '墓地' : '山札'} <span class="n">${n}</span></div>
  </div>`;
}

/** 墓地から選ぶ必要があるカードなら、選べる墓地の位置を返す */
function graveChoices(g, handIndex) {
  const id = g.players[0].hand[handIndex];
  const c = id ? card(id) : null;
  if (!c || c.type !== 'support') return null;
  const e = c.effects.find(x => x.op === 'revive' || x.op === 'recallSupport');
  if (!e) return null;
  const grave = g.players[0].grave;
  const idx = grave.map((gid, i) => {
    if (e.op === 'revive') return (isMonster(gid) && card(gid).cost <= e.maxCost) ? i : null;
    return !isMonster(gid) ? i : null;
  }).filter(i => i !== null);
  return { effect: e, indices: idx };
}

function supportTargetSlots(g, handIndex) {
  const id = g.players[0].hand[handIndex];
  const c = card(id);
  const res = { self: [], enemy: [] };
  if (!c || c.type !== 'support') return res;
  const e = c.effects.find(x => x.op === 'equip' || x.target === 'one');
  if (!e) return res;
  if (e.op === 'equip') {
    res.self = fieldMonsters(g.players[0]).filter(({ m }) => canEquipTo(g, 0, m)).map(x => x.i);
    return res;
  }
  const key = e.side === 'enemy' ? 'enemy' : 'self';
  const p = g.players[e.side === 'enemy' ? 1 : 0];
  res[key] = fieldMonsters(p).filter(({ m }) => matchFilter(m, e.filter)).map(x => x.i);
  return res;
}

/** 左カラム：いま見ているカードの情報 */
/** 履歴1件ぶんの見出し＋カード。2段構成の1段として使う */
function playEntryHtml(e) {
  const c = card(e.id);
  if (!c) return '';
  const kw = c.keywords?.length
    ? `<div class="ip-kw">${c.keywords.map(k => `<b>【${KEYWORDS[k].name}】</b>${esc(KEYWORDS[k].desc)}`).join('<br>')}</div>`
    : '';
  return `<div class="ip-entry ${e.who === 1 ? 'foe' : 'mine'}">
    <div class="ip-banner">${esc(e.who === 1 ? (app.enemy?.name || '相手') : myName())} が${esc(e.verb)}</div>
    <div class="ip-row">
      ${cardHtml(c, {})}
      <div class="ip-side">
        <div class="ip-name">${esc(c.name)}</div>
        <div class="ip-meta">
          <span>${ELEMENTS[c.element].icon}</span><span>コスト ${c.cost}</span>
          ${c.type === 'monster' ? `<span class="atkc">⚔ ${c.atk}</span><span class="defc">🛡 ${c.def}</span>` : '<span>サポート</span>'}
        </div>
        <div class="ip-text">${esc(c.text || '効果はありません（バニラ）。')}</div>
        ${kw}
      </div>
    </div>
  </div>`;
}

function inspectPanelHtml() {
  // 直前に出されたカードを2件まで残す。
  // 盤面から消えるサポートは、これが無いと何をされたのか分からない。
  // 自分から別のカードを見に行った場合は履歴を捨てて、そのカードだけを出す。
  if (!app.inspect && app.playLog.length) {
    return `<div class="ipanel history">
      <div class="ip-title">直前に使われたカード</div>
      ${app.playLog.slice(0, 2).map(playEntryHtml).join('')}
    </div>`;
  }
  const id = app.inspect;
  const c = id ? card(id) : null;
  if (!c) {
    return `<div class="ipanel empty">
      <div class="ip-title">カード情報</div>
      <div class="ip-hint">カードにカーソルを合わせると、ここに詳しい内容が出ます。</div>
      <div class="ip-legend">
        <div><b class="atkc">⚔ 攻撃モード</b>（縦置き）<br>殴れる。相手の攻撃モンスターとぶつかると弱い方が破壊。</div>
        <div><b class="defc">🛡 防御モード</b>（横置き）<br>攻撃できないが、🛡の分だけダメージを受け止める。</div>
        <div><b class="gold">属性相性</b><br>🔥→🌿→💧→🔥 有利な属性で攻撃すると ⚔+2。</div>
      </div>
    </div>`;
  }
  const r = RARITY[c.rarity || 'common'];
  const kw = c.keywords?.length
    ? `<div class="ip-kw">${c.keywords.map(k => `<b>【${KEYWORDS[k].name}】</b>${esc(KEYWORDS[k].desc)}`).join('<br>')}</div>`
    : '';
  return `<div class="ipanel">
    <div class="ip-card">${cardHtml(c, { cls: 'big' })}</div>
    <div class="ip-name">${esc(c.name)}</div>
    <div class="ip-meta">
      <span>${ELEMENTS[c.element].icon} ${ELEMENTS[c.element].name}</span>
      <span>コスト ${c.cost}</span>
      ${c.type === 'monster' ? `<span class="atkc">⚔ ${c.atk}</span><span class="defc">🛡 ${c.def}</span>` : '<span>サポート</span>'}
      <span style="color:${r.color}">${r.name}</span>
    </div>
    <div class="ip-text">${esc(c.text || 'このカードに効果はありません（バニラ）。')}</div>
    ${kw}
    <div class="ip-flavor">${esc(c.flavor)}</div>
  </div>`;
}

/** ホバーしたカードを左パネルに出す（全体を描き直さずパネルだけ差し替える） */
function setInspect(id) {
  if (app.inspect === id && !app.playLog.length) return;
  app.inspect = id;
  app.playLog = [];        // 他のカードを参照したら履歴はリセット
  const el = document.querySelector('[data-inspectpanel]');
  if (el) el.innerHTML = inspectPanelHtml();
}
document.addEventListener('pointerover', ev => {
  if (app.screen !== 'battle' || ev.pointerType === 'touch') return;
  const el = ev.target.closest('[data-card]');
  if (el && el.dataset.card) setInspect(el.dataset.card);
});

// 指では「重ねて長押し」でカードを覗く。タップは出し入れ・攻撃に使うため。
document.addEventListener('contextmenu', ev => {
  if (app.screen !== 'battle') return;
  const el = ev.target.closest('[data-card]');
  if (!el || !el.dataset.card) return;
  ev.preventDefault();
  setInspect(el.dataset.card);
  if (battleLayout() === 'portrait') app.drawer = 'info';
  render();
});

function renderBattle() {
  const g = app.game;
  const me = g.players[0], op = g.players[1];
  const myTurn = g.active === 0 && g.winner === null && app.phase === 'play';

  let targetSlots = [], faceTargetable = false;
  if (app.sel && app.sel.kind === 'attack') {
    const t = legalAttackTargets(g, 0, app.sel.slot);
    targetSlots = t.filter(x => x !== 'face');
    faceTargetable = t.includes('face');
  }
  // ドラッグ中のドロップ候補
  let dropMonster = [], dropSelf = [], dropEnemy = [];
  if (app.drag && app.drag.from === 'hand') {
    const id = me.hand[app.drag.index];
    if (id && isMonster(id)) {
      dropMonster = me.field.map((_, i) => i).filter(i => canSummonAt(g, 0, app.drag.index, i));
    } else if (id) {
      const t = supportTargetSlots(g, app.drag.index);
      dropSelf = t.self; dropEnemy = t.enemy;
    }
  }

  const enemyMon = op.field.map((m, i) => {
    const cls = targetSlots.includes(i) || dropEnemy.includes(i) ? 'targetable' : '';
    return `<div class="slot ${dropEnemy.includes(i) ? 'drop' : ''}" data-eslot="${i}">${m ? monsterHtml(m, 1, i, { cls }) : ''}</div>`;
  }).join('');

  const myMon = me.field.map((m, i) => {
    let cls = '';
    if (m) {
      if (app.sel && app.sel.kind === 'attack' && app.sel.slot === i) cls = 'attacking';
      else if (myTurn && (canAttack(g, 0, i) || canChangeMode(g, 0, i))) cls = 'canact';
      if (dropSelf.includes(i)) cls += ' targetable';
    }
    const drop = dropMonster.includes(i) || (m && dropSelf.includes(i));
    return `<div class="slot ${drop ? 'drop' : ''}" data-mslot="${i}">${m ? monsterHtml(m, 0, i, { cls }) : ''}</div>`;
  }).join('');

  const supRow = p => p.supports.map(s =>
    `<div class="slot sup">${s ? supportHtml(s) : ''}</div>`).join('');

  const discardMode = g.phase === 'discard' && g.active === 0;
  const hand = me.hand.map((id, i) => {
    const c = card(id);
    const playable = myTurn && g.phase === 'main' &&
      (isMonster(id) ? canSummon(g, 0, i) : canPlaySupport(g, 0, i));
    return cardHtml(c, {
      cls: `${playable || discardMode ? 'selectable' : 'disabled'} ${app.drag && app.drag.from === 'hand' && app.drag.index === i ? 'dragging' : ''}`,
      attr: `data-hand="${i}"`,
    });
  }).join('');

  const maxPips = Math.max(op.maxCost, me.maxCost, 1);
  const pips = n => Array.from({ length: maxPips }, (_, i) => `<div class="pip ${i < n ? 'on' : ''}"></div>`).join('');
  const logHtml = g.log.slice(-60).map(l => `<div class="l ${l.kind}">${esc(l.text)}</div>`).join('');

  const bg = app.free ? (AREA_BG.common || AREA_BG[AREAS[app.areaIndex]?.id])
    : (AREA_BG[AREAS[app.areaIndex]?.id] || AREA_BG.common);
  // 縦持ちでは「カード情報」と「ログ」は盤面に重なる引き出しにする。
  // 同時に2つ出ると盤面が完全に隠れてしまうので、開くのは常にどちらか一方だけ。
  const portrait = battleLayout() === 'portrait';
  const drawer = portrait ? (app.drawer || null) : null;   // 'info' | 'log' | null
  const infoOpen = portrait ? drawer === 'info' : app.infoOpen !== false;
  const logOpen = portrait ? drawer === 'log' : app.logOpen;

  const foeFace = (() => {
    const src = ENEMY_ART[`${AREAS[app.areaIndex]?.id}:${Number((app.enemyKey || ':0').split(':')[1])}`];
    return src ? `<img src="${src}" alt="">` : (app.enemy ? app.enemy.icon : '🤖');
  })();
  const foeLife = `<div class="lifebox"><span class="lifeval">${op.life}</span>
    <div class="lifebar"><div style="width:${Math.max(0, Math.min(100, op.life / (app.enemyLifeMax || 20) * 100))}%"></div></div></div>`;

  // 縦持ちは幅が足りず名前が縦書きのように折れてしまうので、
  // 顔の右に「名前／ライフ／コスト」を縦に積む形にする。
  const enemyBar = portrait ? `
    <div class="bar enemybar">
      <div class="face">${foeFace}</div>
      <div class="foeinfo">
        <span class="pname">${esc(op.name)}</span>
        ${foeLife}
        <div class="foesub"><div class="costpips">${pips(op.cost)}</div><span class="meta">手札 <b>${op.hand.length}</b></span></div>
      </div>
      <div class="battle-actions">
        <button class="btn tiny paneltab ${drawer === 'info' ? 'on' : ''}" data-toggle-info>🔍<small>情報</small></button>
        <button class="btn tiny paneltab ${drawer === 'log' ? 'on' : ''}" data-toggle-log>📜<small>ログ</small></button>
        <button class="btn tiny paneltab quit" data-surrender>🏳<small>投了</small></button>
      </div>
    </div>` : `
    <div class="bar enemybar">
      <div class="who"><div class="face">${foeFace}</div><span class="pname">${esc(op.name)}</span></div>
      ${foeLife}
      <div class="costpips">${pips(op.cost)}</div>
      <span class="meta">手札 <b>${op.hand.length}</b></span>
      <div class="battle-actions">
        <button class="btn tiny" data-toggle-log>${app.logOpen ? 'ログ非表示' : 'ログ'}</button>
        <button class="btn tiny" data-surrender>投了</button>
      </div>
    </div>`;

  return `<div class="battle" ${bg ? `style="--bgimg:url(${bg})"` : ''}>
    ${enemyBar}

    <div class="mid">
      ${portrait && drawer ? '<div class="drawerback" data-closedrawer></div>' : ''}
      ${infoOpen ? `<div class="sidecol left" data-inspectpanel>${inspectPanelHtml()}</div>` : ''}

      <div class="field">
        <div class="row">${pileHtml('grave', op.grave.length, 1)}${supRow(op)}${pileHtml('deck', op.deck.length, 1)}</div>
        <div class="row">${enemyMon}</div>
        <div class="center">
          <span class="turnlabel">ターン ${g.turn}　${g.active === 0 ? 'あなたの番' : '相手の番'}</span>
          ${faceTargetable ? '<button class="btn danger small" data-attackface>▶ 直接攻撃！</button>' : ''}
          <span class="hint">${esc(app.hint)}</span>
        </div>
        <div class="row">${myMon}</div>
        <div class="row">${pileHtml('grave', me.grave.length, 0)}${supRow(me)}${pileHtml('deck', me.deck.length, 0)}</div>
      </div>

      ${logOpen ? `<div class="sidecol right"><div class="logpane" data-logpane>${logHtml}</div></div>` : ''}
    </div>

    <div class="bar playerbar">
      <div class="who"><div class="face">${avatarHtml(myAvatar())}</div>${esc(myName())}</div>
      <div class="lifebox"><span class="lifeval">${me.life}</span>
        <div class="lifebar"><div style="width:${Math.max(0, Math.min(100, me.life / 20 * 100))}%"></div></div></div>
      <div class="costpips">${pips(me.cost)}</div>
      <span class="meta">コスト <b>${me.cost}/${me.maxCost}</b></span>
      <div class="battle-actions">
        ${discardMode ? '<span class="hint" style="color:var(--gold)">手札が多すぎます。捨てるカードを選んでください</span>' : ''}
        ${app.sel ? '<button class="btn small" data-cancel>選択解除</button>' : ''}
        <button class="btn small" data-forge ${myTurn && g.phase === 'main' && canForge(g, 0) ? '' : 'disabled'}
          title="余ったコストでカードを1枚引く">🔨 鍛錬 ${g.rules.forgeCost}→1枚</button>
        <button class="btn primary" data-endturn ${myTurn && g.phase === 'main' ? '' : 'disabled'}>ターン終了</button>
      </div>
    </div>
    <div class="hand">${hand}</div>
  </div>`;
}

// ---------- 盤面の小ポップアップ ----------
function popupHtml() {
  const p = app.popup;
  if (!p) return '';
  const style = `left:${p.x}px;top:${p.y}px`;
  if (p.type === 'mode') {
    const g = app.game;
    const c = card(g.players[0].hand[p.hand]);
    const victim = g.players[0].field[p.slot];
    const cost = summonCostOf(g, 0, p.hand, p.slot);
    return `<div class="modepick" style="${style}">
      ${victim ? `<div class="tip warn">${esc(card(victim.id).name)} を墓地へ送って入れ替え<br>コスト ${cost}（+${g.rules.replaceSummonCost}）</div>` : ''}
      <button class="mp-atk" data-summon="attack">⚔ 攻撃モード <b>${c.atk}</b></button>
      <button class="mp-def" data-summon="defense">🛡 防御モード <b>${c.def}</b></button>
      <div class="tip">攻撃モードは縦置き・殴れる／防御モードは横置き・🛡でダメージを受け止める</div>
    </div>`;
  }
  if (p.type === 'own') {
    const g = app.game, m = g.players[0].field[p.slot];
    if (!m) return '';
    const acts = [];
    if (canAttack(g, 0, p.slot) && app.phase === 'play' && g.active === 0)
      acts.push('<button data-act="attack">⚔ 攻撃する</button>');
    if (canChangeMode(g, 0, p.slot) && app.phase === 'play' && g.active === 0)
      acts.push(`<button data-act="mode">🔄 ${m.mode === 'attack' ? '防御' : '攻撃'}モードへ</button>`);
    acts.push('<button data-act="detail">🔍 カードを見る</button>');
    return `<div class="modepick" style="${style}">${acts.join('')}</div>`;
  }
  return '';
}

function overlays() {
  let h = '';
  if (app.phase === 'mulligan') h += mulliganOverlay();
  if (app.phase === 'start') h += battleStartOverlay();
  if (app.detail) h += detailOverlay();
  if (app.artZoom) h += artZoomOverlay();
  if (app.graveView !== null) h += graveOverlay();
  if (app.gravePick) h += gravePickOverlay();
  if (app.game?.pendingChoice?.type === 'observe') h += observeOverlay();
  if (app.result) h += resultOverlay();
  if (app.packResult) h += packOverlay();
  return h;
}

function mulliganOverlay() {
  const hand = app.game.players[0].hand.map(id => cardHtml(card(id), { cls: 'big' })).join('');
  return `<div class="overlay"><div class="modal">
    <h2>初期手札</h2>
    <p>この手札で始めますか？　1回だけ引き直せます。<br>
      <span style="color:#9fb2c8">低コストのカードが無いと序盤に動けません。</span></p>
    <div class="mull-hand">${hand}</div>
    <div class="row-btn">
      <button class="btn primary" data-mulligan="keep">この手札で戦う</button>
      <button class="btn" data-mulligan="redraw">引き直す（1回だけ）</button>
    </div>
  </div></div>`;
}

function battleStartOverlay() {
  const e = app.enemy;
  return `<div class="battlestart"><div class="bs-inner">
    <div class="bs-title">BATTLE START</div>
    <div class="hint" style="margin-bottom:18px">${esc(AREAS[app.areaIndex].name)}</div>
    <div class="bs-vs">
      <div class="bs-side">
        <div class="bs-face">${avatarHtml(myAvatar())}</div>
        <div class="bs-name">${esc(myName())}</div>
        <div class="bs-desc">ライフ ${app.game.players[0].life}</div>
      </div>
      <div class="bs-vslabel">VS</div>
      <div class="bs-side">
        <div class="bs-face">${(() => {
          const src = ENEMY_ART[`${AREAS[app.areaIndex].id}:${Number(app.enemyKey.split(':')[1])}`];
          return src ? `<img src="${src}" alt="">` : e.icon;
        })()}</div>
        <div class="bs-name">${esc(e.name)}</div>
        <div class="bs-desc">${esc(e.desc)}<br>ライフ ${app.game.players[1].life}${e.startCost ? ` ／ 開始コスト ${e.startCost}` : ''}</div>
      </div>
    </div>
    <button class="btn primary" data-startbattle>戦闘開始</button>
  </div></div>`;
}

function detailOverlay() {
  const c = card(app.detail);
  if (!c) return '';
  // 拡大できるのは入手済みのカードだけ（集める動機になるように）
  const owned = (app.save.collection[c.id] || 0) > 0;
  const zoomable = app.screen === 'collection' && owned;
  const extra = app.screen !== 'collection' ? ''
    : owned
      ? `<button class="zoom-open" data-artzoom="${esc(c.id)}">🔍 イラストを拡大</button>`
      : '<div class="zoom-locked">🔒 入手するとイラストを拡大できます</div>';
  return `<div class="overlay" data-closedetail><div class="modal">
    ${detailHtml(c, extra, { zoomable })}
    <div class="row-btn"><button class="btn" data-closedetail>閉じる</button></div>
  </div></div>`;
}

function observeOverlay() {
  const choice = app.game?.pendingChoice;
  if (!choice || choice.type !== 'observe' || choice.pi !== 0) return '';
  const cards = choice.cards.map((id, i) =>
    `<button class="observe-card" data-observe="${i}">${cardHtml(card(id), { cls: 'big selectable' })}</button>`).join('');
  return `<div class="overlay"><div class="modal observe-modal">
    <h2>【観測】</h2>
    <p>山札の上から見えたカードです。手札に加える1枚を選んでください。<br>
      <span style="color:#9fb2c8">残りは山札の底へ戻ります。</span></p>
    <div class="observe-list">${cards}</div>
  </div></div>`;
}

function artZoomOverlay() {
  const c = card(app.artZoom);
  if (!c) return '';
  const src = cardArtSource(c);
  const art = src
    ? `<img src="${src}" alt="${esc(c.name)}">`
    : cardArtSvg(c);
  return `<div class="overlay artzoom-overlay" data-closeartzoom>
    <div class="artzoom-modal" role="dialog" aria-modal="true" aria-label="${esc(c.name)}のイラスト">
      <button class="artzoom-close" data-closeartzoom aria-label="拡大表示を閉じる">×</button>
      <div class="artzoom-name">${esc(c.name)}</div>
      <div class="artzoom-stage ${c.element}">${art}</div>
      <div class="artzoom-hint">画面をクリック、または Esc で閉じる</div>
    </div>
  </div>`;
}

function gravePickOverlay() {
  const gp = app.gravePick;
  const g = app.game;
  if (!gp || !g) return '';
  const c = card(g.players[0].hand[gp.hand]);
  const cards = gp.indices.map(i =>
    `<div class="gpick" data-gravepick="${i}">${cardHtml(card(g.players[0].grave[i]), { cls: 'selectable' })}</div>`).join('');
  return `<div class="overlay"><div class="modal" style="max-width:840px">
    <h2>${esc(c.name)}</h2>
    <p>墓地から1枚選んでください。</p>
    <div class="grid" style="margin:12px 0">${cards}</div>
    <div class="row-btn"><button class="btn" data-cancelgrave>やめる</button></div>
  </div></div>`;
}

function graveOverlay() {
  const p = app.game.players[app.graveView];
  const cards = p.grave.map(id => cardHtml(card(id), { cls: 'selectable' })).join('');
  return `<div class="overlay" data-closegrave><div class="modal">
    <h2>${app.graveView === 0 ? esc(myName()) : esc(p.name)}の墓地（${p.grave.length}枚）</h2>
    <div class="grid" style="max-width:760px;margin:10px 0">${cards || '<p>まだ何もありません。</p>'}</div>
    <div class="row-btn"><button class="btn" data-closegrave>閉じる</button></div>
  </div></div>`;
}

function resultOverlay() {
  const r = app.result;
  return `<div class="overlay"><div class="modal">
    <h2 style="font-size:30px">${r.win ? '勝利！' : '敗北…'}</h2>
    <p>${esc(r.reason)}</p>
    ${r.reward ? `<p style="color:var(--gold);font-size:15px">報酬: ${PACK_TYPES[r.reward].name} を1つ獲得！</p>` : ''}
    ${r.dust ? `<p style="color:var(--gold);font-size:15px">星屑 ✦${r.dust} を獲得！（所持 ✦${app.save.stardust}）</p>` : ''}
    ${r.unlocked ? `<p style="color:#8fe0a8">「${esc(r.unlocked)}」が解放されました！</p>` : ''}
    ${r.charCard ? `<div class="charget">
      <div class="charget-label">✦ キャラクターカードを入手 ✦</div>
      ${cardHtml(card(r.charCard), { cls: 'big' })}
      <div class="charget-name">${esc(card(r.charCard).name)}</div>
    </div>` : ''}
    ${r.charLeft ? `<p style="color:#c58cff;font-size:14px">「極」であと <b>${r.charLeft}</b> 回倒すと、このキャラのカードが手に入ります</p>` : ''}
    <div class="row-btn">
      <button class="btn primary" data-go="${r.free ? 'free' : 'adventure'}">${r.free ? 'フリーバトルへ戻る' : '冒険へ戻る'}</button>
      <button class="btn" data-rematch>もう一度</button>
    </div>
  </div></div>`;
}

/** パックを1枚ずつめくる演出（描き直しに強いよう、めくった枚数を状態で持つ） */
function startPackReveal() {
  if (!app.packResult || app.packRevealing) return;
  app.packRevealing = true;
  app.packRevealed = 0;
  Audio.playSe('se_pack');
  const ids = [...app.packResult];
  const step = i => {
    if (!app.packResult || app.packResult !== ids && app.packResult.join() !== ids.join()) return;
    app.packRevealed = i + 1;
    const r = card(ids[i]).rarity;
    Audio.playSe('se_reveal', { gap: 0 });
    if (r === 'rare' || r === 'epic' || r === 'legend') {
      setTimeout(() => Audio.playSe('se_rare', { gap: 0 }), 150);
    }
    render();
    if (i + 1 < ids.length) setTimeout(() => step(i + 1), 430);
    else app.packRevealing = false;
  };
  setTimeout(() => step(0), 260);
}

function packOverlay() {
  const shown = app.packRevealed || 0;
  const cards = app.packResult.map((id, i) => {
    const open = i < shown;
    const r = card(id).rarity;
    const glow = open && (r === 'rare' || r === 'epic' || r === 'legend') ? 'shinein' : '';
    return `<div class="packcard ${open ? 'open' : 'facedown'} ${glow}" data-packidx="${i}">
      <div class="pcback"></div>
      <div class="pcfront">${cardHtml(card(id), { cls: 'big' })}</div>
    </div>`;
  }).join('');
  return `<div class="overlay"><div class="modal" style="max-width:880px">
    <h2>パック開封！</h2>
    <div class="grid" style="margin:14px 0">${cards}</div>
    <button class="btn primary" data-closepack>受け取る</button>
  </div></div>`;
}

// ============================================================
// 描画
// ============================================================
/** 戦闘画面は16:9の固定レイアウトで作り、画面幅いっぱいまで拡大する */
// 戦闘画面は固定サイズで組んで丸ごと拡大縮小する。
// 横長の画面と縦長の画面では入る形が違うので、設計サイズを2つ持つ。
const BATTLE_SIZE = {
  wide:     { w: 1440, h: 900 },
  portrait: { w: 520, h: 980 },
};
/** いまの画面の形に合う方を選ぶ */
function battleLayout() {
  return window.innerWidth / window.innerHeight < 0.95 ? 'portrait' : 'wide';
}

function applyBattleScale() {
  const el = document.querySelector('.battle');
  if (!el) return;
  const mode = battleLayout();
  const { w: DW, h: DH } = BATTLE_SIZE[mode];
  el.classList.toggle('portrait', mode === 'portrait');
  const s = Math.min(window.innerWidth / DW, window.innerHeight / DH);
  // 縦持ちは横幅で倍率が決まるため、縦が余ることが多い。
  // 余ったぶんは設計上の高さを伸ばして盤面に回す（画面をぴったり使い切る）。
  const h = mode === 'portrait' ? Math.min(DH * 1.5, window.innerHeight / s) : DH;
  el.style.height = `${h}px`;
  el.style.transform = `scale(${s})`;
  el.style.left = `${Math.max(0, (window.innerWidth - DW * s) / 2)}px`;
  el.style.top = `${Math.max(0, (window.innerHeight - h * s) / 2)}px`;
}
let resizeTimer = 0;
window.addEventListener('resize', () => {
  applyBattleScale();
  // 縦横が入れ替わったら組み直す（横のカラムが引き出しに変わるため）
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (app.screen === 'battle' && app.battleMode !== battleLayout()) render();
    else if (app.screen !== 'battle' && app.navNarrow !== isNarrow()) render();
  }, 160);
});

// innerHTML を丸ごと差し替えるので、スクロール位置は自前で持ち越す。
// （デッキ編集で1枚足すたびに所持カード一覧が先頭へ戻るのを防ぐ）
// 描き直しでスクロール位置を戻す対象。スマホでは .deckwrap ごと縦に流れる
// レイアウトになるので、内側のプールだけでなく外側も見る。
const SCROLL_KEEP = ['.deckwrap', '[data-pool]', '[data-decklist]', '.adventure'];

function render(opts = {}) {
  const keep = {};
  if (!opts.resetScroll) {
    SCROLL_KEEP.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) keep[sel] = el.scrollTop;
    });
  }
  let html;
  switch (app.screen) {
    case 'adventure': html = renderAdventure(); break;
    case 'free': html = renderFree(); break;
    case 'deck': html = renderDeck(); break;
    case 'collection': html = renderCollection(); break;
    case 'rules': html = renderRules(); break;
    case 'settings': html = renderSettings(); break;
    case 'battle': html = renderBattle() + popupHtml(); break;
    default: html = renderTitle();
  }
  html += bottomNavHtml();
  html += overlays();
  if (!app.save.profile) html += onboardingOverlay();
  if (app.toast) html += `<div class="toast">${esc(app.toast)}</div>`;
  $app.innerHTML = html;
  Object.entries(keep).forEach(([sel, top]) => {
    const el = document.querySelector(sel);
    if (el) el.scrollTop = top;
  });
  app.navNarrow = isNarrow();
  if (app.screen === 'battle') {
    app.battleMode = battleLayout();
    applyBattleScale();
    const lp = document.querySelector('[data-logpane]');
    if (lp) lp.scrollTop = lp.scrollHeight;   // 常に最新のログを表示
  }
  if (app.packResult) startPackReveal();
}

// ============================================================
// バトル進行
// ============================================================
function startBattle(areaIndex, enemyIndex, free = false) {
  // 複数スロットのせいで、30枚に満たないデッキを選んだまま挑めてしまわないように
  if (app.save.deck.length !== 30) {
    const d = app.save.decks[app.save.activeDeck];
    toast(`「${d ? d.name : 'デッキ'}」は${app.save.deck.length}枚です。30枚にしてください`);
    return go('deck');
  }
  const area = AREAS[areaIndex], enemy = area.enemies[enemyIndex];
  const diff = free ? FREE_DIFFICULTY[app.freeDiff] : null;
  app.free = free ? { difficulty: app.freeDiff } : null;
  app.areaIndex = areaIndex;
  app.enemy = enemy;
  app.enemyKey = `${area.id}:${enemyIndex}`;
  app.result = null; app.sel = null; app.popup = null; app.hint = ''; app.detail = null;
  const seed = (Math.random() * 1e9) | 0;
  // フリーバトルの「極」では、そのキャラ自身のカードをデッキに混ぜてくる。
  // 狙っているカードを手に入れる前に見られる、という導線でもある。
  let foeDeck = [...enemy.deck];
  const selfCard = CHARACTER_OF[app.enemyKey];
  if (free && app.freeDiff === 'extreme' && selfCard) {
    foeDeck = [selfCard, ...foeDeck.slice(1)];
  }
  app.game = createGame({
    decks: [[...app.save.deck], foeDeck],
    seed, names: [myName(), enemy.name],
    startCost: [0, (enemy.startCost || 0) + (diff ? diff.cost : 0)],
  });
  app.game.players[1].life = (enemy.life || 20) + (diff ? diff.life : 0);
  app.enemyLifeMax = app.game.players[1].life;
  lastBannerTurn = 0;
  app.phase = 'mulligan';
  app.screen = 'battle';
  // 戦闘開始時はログもカード情報も畳んでおく（盤面を隠さない）
  app.drawer = null;
  app.logOpen = false;
  app.playLog = [];
  app.inspect = null;
  syncBgm();
  render();
}

function doMulligan(redraw) {
  const g = app.game;
  mulligan(g, 0, redraw);
  const ec = g.players[1].hand.filter(id => card(id).cost <= 2).length;
  mulligan(g, 1, ec === 0);
  app.phase = 'start';
  render();
}

function beginPlay() {
  app.phase = 'play';
  render();
  lastBannerTurn = app.game.turn;
  Audio.playSe('se_battle');
  Fx.fxBanner(app.game.active === 0 ? 'あなたのターン' : `${esc(app.enemy.name)} のターン`, '', 750);
  if (app.game.active === 1) scheduleAi();
}

let lastBannerTurn = 0;
function maybeTurnBanner() {
  const g = app.game;
  if (!g || g.winner !== null || app.phase !== 'play') return;
  if (g.turn === lastBannerTurn) return;
  lastBannerTurn = g.turn;
  Audio.playSe('se_turn');
  Fx.fxBanner(g.active === 0 ? 'あなたのターン' : `${esc(app.enemy?.name || '相手')} のターン`,
    `ターン ${g.turn}`, 700);
}

/**
 * アクションを実行して、増えたログから演出を再生する。
 * 盤面は描き直されるので、実行前に座標を控えておく。
 */
async function actWithFx(pi, action) {
  const g = app.game;
  if (!g || app.fxBusy) return false;
  app.fxBusy = true;
  try {
    return await runActionFx(g, pi, action);
  } finally {
    // 演出が途中で転んでも盤面を操作不能のままにしない
    app.fxBusy = false;
  }
}

/**
 * 召喚・発動されたカードをカード情報欄の履歴に積む（新しい順に最大2件）。
 * 盤面から消えるサポートは、これが無いと何をされたのか分からない。
 */
function pushPlay(id, verb, who) {
  app.inspect = null;
  app.playLog = [{ id, verb, who }, ...app.playLog].slice(0, 2);
  const el = document.querySelector('[data-inspectpanel]');
  if (el) el.innerHTML = inspectPanelHtml();
}

async function runActionFx(g, pi, action) {
  const snap = Fx.snapshotRects();
  const from = action.type === 'attack' ? snap.mons[`${pi}:${action.slot}`] : null;
  const target = action.type === 'attack'
    ? (action.target === 'face' ? snap.bar[1 - pi] : snap.mons[`${1 - pi}:${action.target}`])
    : null;
  const attackerHtml = action.type === 'attack'
    ? (() => { const m = g.players[pi].field[action.slot]; return m ? cardHtml(card(m.id), {}) : ''; })() : '';
  // サポートは使うと手札から消えるので、先に控えておく
  const supCard = action.type === 'support' ? card(g.players[pi].hand[action.hand]) : null;
  const sumCard = action.type === 'summon' ? card(g.players[pi].hand[action.hand]) : null;
  const attacker = action.type === 'attack' ? g.players[pi].field[action.slot] : null;
  const mark = g.log.length;

  // 召喚・発動されたカードは、どちらの手番でもカード情報欄の履歴に積む
  if (supCard) pushPlay(supCard.id, supCard.equip ? '装備した' : '発動した', pi);
  else if (sumCard) pushPlay(sumCard.id, '召喚した', pi);

  // 行動そのものの音
  if (action.type === 'attack') Audio.playSe(action.target === 'face' ? 'se_direct' : 'se_attack');
  else if (action.type === 'summon') Audio.playSe('se_summon');
  else if (action.type === 'support') Audio.playSe(supCard && supCard.equip ? 'se_equip' : 'se_support');
  else if (action.type === 'mode') Audio.playSe('se_mode');
  else if (action.type === 'forge') Audio.playSe('se_forge');

  // サポートは発動そのものを見せてから結果を出す
  if (action.type === 'support' && supCard && !supCard.equip) {
    await Fx.fxSupportCast(cardHtml(supCard, {}), supCard.element);
  }

  const ok = applyAction(g, pi, action);
  const entries = g.log.slice(mark);
  render();

  // 攻撃の突進。属性有利なら踏み込む前に見せる
  if (action.type === 'attack') {
    const atkLog = entries.find(e => e.kind === 'attack');
    if (atkLog && atkLog.bonus) {
      Audio.playSe('se_effect');
      Fx.fxElementBonus(target, atkLog.element);
      await Fx.wait(320);
    }
    if (attacker) {
      const kws = [];
      if (hasKw(attacker, 'pierce') && action.target !== 'face') kws.push(['貫通', '#ff9a6b']);
      if (hasKw(attacker, 'double')) kws.push(['連撃', '#e79aff']);
      kws.forEach(([label, color], i) => setTimeout(() => Fx.fxKeyword(from, label, color), i * 130));
    }
    if (action.target === 'face') Fx.fxSlash(target);
    await Fx.fxLunge(from, target, attackerHtml);
  }
  if (action.type === 'summon') {
    const slot = g.players[pi].field.findIndex(m => m && m.uid === Math.max(
      ...g.players[pi].field.filter(Boolean).map(x => x.uid)));
    // レジェンドだけは専用の召喚演出にする
    if (slot >= 0 && sumCard && sumCard.rarity === 'legend') {
      Audio.playSe('se_rare', { gap: 0 });
      await Fx.fxLegendSummon(pi, slot, sumCard.name);
    } else if (slot >= 0) Fx.fxSummon(pi, slot);
    // 【登場時】が仕事をしたら効果音を足す
    if (entries.some(e => e.kind !== 'summon' && e.kind !== 'endturn')) {
      Audio.playSe('se_effect', { gap: 120 });
    }
  }
  if (action.type === 'forge') {
    Fx.fxDraw(snap.pile[`deck:${pi}`], snap.hand);
  }

  // ログを順に演出へ
  let shook = 0;
  for (const e of entries) {
    if (e.kind === 'destroy') {
      Audio.playSe('se_destroy');
      Fx.fxBurst(snap.mons[`${e.p}:${e.slot}`] || snap.mons[`${e.p}:0`]);
      await Fx.wait(90);
    } else if (e.kind === 'guard') {
      Audio.playSe('se_guard');
      Fx.fxGuard(snap.mons[`${e.p}:${e.slot}`]);
      await Fx.wait(180);
    } else if (e.kind === 'damage') {
      Audio.playSe('se_hit');
      Fx.fxNumber(snap.bar[e.p], e.v, 'damage');
      Fx.fxHit(e.p, snap);
      // 大ダメージは画面を拡大せず、衝撃の演出を強めて「間」で見せる
      if (e.v >= 4 && !shook) { Fx.fxHeavyHit(snap.bar[e.p], e.v); shook = 1; }
      await Fx.wait(e.v >= 4 ? 260 + Math.min(420, e.v * 45) : 150);
    } else if (e.kind === 'heal') {
      Audio.playSe('se_heal');
      Fx.fxNumber(snap.bar[e.p], e.v, 'heal');
      Fx.fxHeal(snap.bar[e.p]);
      await Fx.wait(120);
    } else if (e.kind === 'buff') {
      Audio.playSe('se_buff');
      // 盤面のモンスターを強化したときだけ光らせる（最大コスト増加などは対象が無い）
      if (e.slot != null) Fx.fxBuff(snap.mons[`${e.p}:${e.slot}`], e.atk || 0, e.def || 0);
      await Fx.wait(e.slot != null ? 140 : 60);
    } else if (e.kind === 'mode') {
      if (e.slot != null) Fx.fxFlip(e.p, e.slot);
      await Fx.wait(120);
    } else if (e.kind === 'draw') {
      if (e.p === 0) Audio.playSe('se_draw');
      Fx.fxDraw(snap.pile[`deck:${e.p}`], e.p === 0 ? snap.hand : null);
      await Fx.wait(70);
    }
  }

  // とどめ
  if (g.winner !== null) await Fx.fxLethal();

  return ok;
}

function afterAction() {
  const g = app.game;
  render();
  maybeTurnBanner();
  if (g.winner !== null) return finishGame();
  if (g.active === 1) scheduleAi();
}

// 相手が何をしているか目で追えるだけの間を置く。
// 攻撃は演出自体が長いので短め、サポートは読む時間が要るので長め。
const AI_PACE = { think: 560, summon: 420, support: 900, equip: 700, mode: 380, attack: 260, forge: 380 };

function scheduleAi(extra = 0) {
  clearTimeout(app.aiTimer);
  app.aiTimer = setTimeout(aiStep, AI_PACE.think + extra);
}
/** 直前の行動を見せておきたい時間 */
function aiPauseFor(g, act) {
  if (!act) return 0;
  if (act.type === 'support') {
    const c = card(g.players[1].hand[act.hand]);
    return c && c.equip ? AI_PACE.equip : AI_PACE.support;
  }
  return AI_PACE[act.type] ?? 0;
}
function aiStep() {
  const g = app.game;
  if (!g || g.winner !== null) { render(); return finishGame(); }
  if (g.active !== 1) { render(); return; }
  if (g.phase === 'discard') {
    const p = g.players[1];
    let worst = 0, ws = Infinity;
    p.hand.forEach((id, i) => {
      const c = card(id);
      const s = c.cost * 2 + (c.type === 'monster' ? c.atk + c.def : 4);
      if (s < ws) { ws = s; worst = i; }
    });
    applyAction(g, 1, { type: 'discard', hand: worst });
    render(); return scheduleAi();
  }
  const act = aiChooseAction(g, 1, { noise: app.enemy?.noise || 0, profile: app.enemy?.profile || 'balanced' });
  if (act) {
    const pause = aiPauseFor(g, act);
    actWithFx(1, act).then(() => scheduleAi(pause));
    return;
  }
  applyAction(g, 1, { type: 'end' });
  render();
  maybeTurnBanner();
  if (g.winner !== null) return finishGame();
  if (g.active === 1) return scheduleAi();
}

function finishGame() {
  const g = app.game;
  if (!g || g.winner === null || app.result) return;
  const win = g.winner === 0;
  let reward = null, unlocked = null, dust = 0;

  if (app.free) {
    // フリーバトル: 戦績は別枠、勝てば星屑
    const key = app.enemyKey;
    app.save.freeStats = app.save.freeStats || {};
    const st = app.save.freeStats[key] || { w: 0, l: 0 };
    let charCard = null, charLeft = 0;
    if (win) {
      st.w++;
      dust = FREE_DIFFICULTY[app.free.difficulty].dust;
      app.save.stardust = (app.save.stardust || 0) + dust;
      // 「極」で本人を規定回数倒すと、そのキャラのカードが手に入る
      if (app.free.difficulty === 'extreme') {
        st.xw = (st.xw || 0) + 1;
        const cid = CHARACTER_OF[key];
        if (cid && !app.save.collection[cid]) {
          if (st.xw >= CHARACTER_WINS_NEEDED) {
            app.save.collection[cid] = 1;
            charCard = cid;
          } else {
            charLeft = CHARACTER_WINS_NEEDED - st.xw;
          }
        }
      }
    } else st.l++;
    app.save.freeStats[key] = st;
    writeSave(app.save);
    app.result = { win, reason: g.reason, reward: null, unlocked: null, dust, free: true, charCard, charLeft };
    Audio.playSe(win ? 'se_win' : 'se_lose');
    return render();
  }

  if (win) {
    app.save.stats.wins++;
    const key = app.enemyKey;
    app.save.clearCount = app.save.clearCount || {};
    const before = app.save.clearCount[key] || 0;
    app.save.clearCount[key] = before + 1;
    const first = !app.save.cleared[key];
    app.save.cleared[key] = true;
    const [areaId, idx] = key.split(':');
    if (before < REWARD_LIMIT) {
      reward = REWARD[areaId];
      app.save.packs[reward] = (app.save.packs[reward] || 0) + 1;
    }
    if (first) {
      const area = AREAS.find(a => a.id === areaId);
      const next = area.enemies[Number(idx) + 1];
      if (next) unlocked = next.name;
      else {
        const ai = AREAS.indexOf(area);
        if (AREAS[ai + 1] && areaUnlocked(app.save, ai + 1)) unlocked = AREAS[ai + 1].name;
      }
    }
  } else app.save.stats.losses++;
  writeSave(app.save);
  app.result = { win, reason: g.reason, reward, unlocked };
  Audio.playSe(win ? 'se_win' : 'se_lose');
  render();
}

// ============================================================
// 入力：ドラッグ＆ドロップ
// ============================================================
let ghost = null;
function makeGhost(html, x, y) {
  killGhost();                       // 前の残像が残っていれば必ず先に消す
  ghost = document.createElement('div');
  ghost.className = 'dragghost';
  ghost.innerHTML = html;
  ghost.style.left = x + 'px'; ghost.style.top = y + 'px';
  document.body.appendChild(ghost);
}
function moveGhost(x, y) { if (ghost) { ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; } }
/**
 * 変数で覚えている1枚だけでなく、DOM に居る残像を全部消す。
 * 以前は上書きで参照を失った残像が二度と消せず、画面に残り続けていた。
 */
function killGhost() {
  document.querySelectorAll('.dragghost').forEach(g => g.remove());
  ghost = null;
}

function elementUnder(x, y, selector) {
  killGhostPointerEvents();
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(selector) : null;
}
function killGhostPointerEvents() { /* ghost は pointer-events:none なので何もしなくてよい */ }

// ------------------------------------------------------------
// 指で手札を触るときの判定
//   手札は横スクロールするので、「めくりたい」のか「カードを持ちたい」のかを
//   分けないと、少し払っただけでカードを掴んでスクロールできなくなる。
//     ・横にすっと払った        → 手札のスクロール（掴まない）
//     ・そのまま少し押さえた    → カードを掴む
//     ・盤面へ向けて縦に動かした → カードを掴む
// ------------------------------------------------------------
const TOUCH_HOLD_MS = 200;   // これだけ押さえ続けたら掴む
const TOUCH_SLOP = 10;       // これ以内は「まだ動いていない」扱い
const TOUCH_VERT = 14;       // 縦にこれだけ動いたら、運ぶ意図とみなす

/** 実際に掴む（残像を出して盤面をドロップ待ちの表示にする） */
function armDrag(d, x, y) {
  d.moved = true;
  let html = '';
  if (d.from === 'hand') html = cardHtml(card(app.game.players[0].hand[d.index]), {});
  else if (d.cardId) html = cardHtml(card(d.cardId), {});
  else if (d.from === 'board') {
    const m = app.game.players[0].field[d.slot];
    if (m) html = cardHtml(card(m.id), {});
  }
  if (html) makeGhost(html, x, y);
  if (d.pointerType === 'touch' && navigator.vibrate) navigator.vibrate(8);  // 掴んだ合図
  render();
}

document.addEventListener('pointerdown', ev => {
  if (app.drag) return;         // すでに掴んでいる指がある（2本目は無視する）
  killGhost();                  // 何かの拍子に残った残像があれば、ここで必ず消す
  clearTimeout(app.dragHold);
  const handCard = ev.target.closest('[data-hand]');
  const deckCard = ev.target.closest('[data-deckcard]');
  const poolCard = ev.target.closest('[data-poolcard]');
  const boardMon = ev.target.closest('.mini[data-side="0"]');
  if (!handCard && !deckCard && !poolCard && !boardMon) return;
  if (ev.button !== 0) return;
  // デッキ編集を指で触るときは、ドラッグより縦スクロールを優先する。
  // （出し入れはタップでできるので、指でのドラッグは無くても困らない）
  if (ev.pointerType === 'touch' && app.screen === 'deck') return;
  // 指で手札を触ったときだけ、掴むかどうかを保留する
  const pending = ev.pointerType === 'touch' && !!handCard;
  app.drag = {
    from: handCard ? 'hand' : deckCard ? 'deck' : poolCard ? 'pool' : 'board',
    index: handCard ? Number(handCard.dataset.hand) : undefined,
    cardId: deckCard?.dataset.deckcard || poolCard?.dataset.poolcard,
    slot: boardMon ? Number(boardMon.dataset.slot) : undefined,
    x0: ev.clientX, y0: ev.clientY, moved: false,
    pending, pointerType: ev.pointerType, lastX: ev.clientX, lastY: ev.clientY,
  };
  if (pending) {
    app.dragHold = setTimeout(() => {
      const d = app.drag;
      if (!d || !d.pending) return;
      d.pending = false;
      armDrag(d, d.lastX, d.lastY);
    }, TOUCH_HOLD_MS);
  }
});

document.addEventListener('pointermove', ev => {
  const d = app.drag;
  if (!d) return;
  d.lastX = ev.clientX; d.lastY = ev.clientY;
  const dx = ev.clientX - d.x0, dy = ev.clientY - d.y0;

  if (d.pending) {
    // 横に払った → 手札をめくりたいので、掴まずブラウザのスクロールに譲る
    if (Math.abs(dx) > TOUCH_SLOP && Math.abs(dx) > Math.abs(dy)) {
      clearTimeout(app.dragHold);
      app.drag = null;
      return;
    }
    // 盤面へ向かって縦に動いた → 運ぶ意図なので、押さえる時間を待たずに掴む
    if (Math.abs(dy) > TOUCH_VERT && Math.abs(dy) >= Math.abs(dx)) {
      clearTimeout(app.dragHold);
      d.pending = false;
      armDrag(d, ev.clientX, ev.clientY);
    } else {
      return;                                   // まだ様子見
    }
  }

  if (!d.moved && Math.hypot(dx, dy) > 7) armDrag(d, ev.clientX, ev.clientY);
  if (d.moved) {
    moveGhost(ev.clientX, ev.clientY);
    document.querySelectorAll('.slot.hot').forEach(e => e.classList.remove('hot'));
    const t = elementUnder(ev.clientX, ev.clientY, '.slot.drop, .decklist, .pool, .mini');
    if (t) t.classList.add('hot');
  }
});

let suppressClick = false;
document.addEventListener('click', ev => {
  if (suppressClick) { suppressClick = false; return; }
  // 選択・決定・戻るを耳でも区別できるようにする。
  const btn = ev.target.closest('.btn, .tab, .adv-tab, .avpick, .card, .chip, .foe .fbtn, .modepick button, .title-action, .dexback, .artzoom-close');
  if (btn) {
    const label = (btn.textContent || '').trim();
    const back = btn.matches('[data-go="title"],[data-closedetail],[data-closeartzoom],[data-closegrave],[data-cancelgrave],[data-cancel],[data-surrender],.dexback,.artzoom-close')
      || label.includes('戻る') || /^(閉じる|やめる|キャンセル|選択解除|投了)/.test(label);
    const confirm = btn.matches('.primary,.title-action.main,[data-fight],[data-freefight],[data-startbattle],[data-obstart],[data-savedeck],[data-openpack],[data-buypack],[data-rematch],[data-closepack]');
    Audio.playSe(back ? 'se_back' : confirm ? 'se_confirm' : 'se_click', { gap: 40 });
  }
  handleClick(ev);
});

document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (app.artZoom) { Audio.playSe('se_back'); app.artZoom = null; render(); return; }
  if (app.detail) { Audio.playSe('se_back'); app.detail = null; render(); }
});

// ブラウザがジェスチャを横取りすると pointerup が来ない。
// その場合ここで後始末しないと、掴んだカードの残像が画面に残ってしまう。
// 画面が隠れている間は BGM を止める（裏で鳴り続けないように）
document.addEventListener('visibilitychange', () => {
  const el = Audio.audioState.el;
  if (!el) return;
  if (document.hidden) el.pause();
  else if (!Audio.audioState.muted) el.play().catch(() => {});
});

// 掴んだままタブを離れる等でも残像を残さない
['blur', 'visibilitychange'].forEach(t => window.addEventListener(t, () => {
  clearTimeout(app.dragHold);
  if (!app.drag && !ghost) return;
  const moved = app.drag && app.drag.moved;
  app.drag = null;
  killGhost();
  if (moved) render();
}));

document.addEventListener('pointercancel', () => {
  clearTimeout(app.dragHold);
  if (!app.drag) return;
  const moved = app.drag.moved;
  app.drag = null;
  killGhost();
  document.querySelectorAll('.slot.hot').forEach(e => e.classList.remove('hot'));
  if (moved) render();
});

document.addEventListener('pointerup', ev => {
  const d = app.drag;
  app.drag = null;
  clearTimeout(app.dragHold);
  killGhost();
  document.querySelectorAll('.slot.hot').forEach(e => e.classList.remove('hot'));
  if (!d) return;
  if (!d.moved) return;      // 動いていなければ click 側で処理する
  // 長押しで掴んだものの実際には動かさずに離した場合は、ただのタップとして通す
  if (Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) <= TOUCH_SLOP) { render(); return; }
  // ドラッグ完了時に発生するクリックだけを無視する（次の操作まで残さない）
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 0);

  const x = ev.clientX, y = ev.clientY;
  // --- デッキ編集 ---
  if (d.from === 'pool') {
    if (elementUnder(x, y, '.decklist')) addToDeck(d.cardId);
    render(); return;
  }
  if (d.from === 'deck') {
    if (elementUnder(x, y, '.pool') || !elementUnder(x, y, '.decklist')) removeFromDeck(d.cardId);
    render(); return;
  }
  // --- 手札からフィールドへ ---
  if (d.from === 'hand' && app.screen === 'battle') {
    const g = app.game;
    const id = g.players[0].hand[d.index];
    if (!id) { render(); return; }
    if (isMonster(id)) {
      const slotEl = elementUnder(x, y, '[data-mslot]');
      if (slotEl) {
        const slot = Number(slotEl.dataset.mslot);
        if (canSummonAt(g, 0, d.index, slot)) { openModePick(d.index, slotEl); return; }
        if (g.players[0].field[slot]) toast('コストが足りません（入れ替え召喚は+1コスト）');
      }
      render(); return;
    }
    // サポート
    const gc = graveChoices(g, d.index);
    if (gc) {
      if (!gc.indices.length) { toast('墓地に対象がありません'); render(); return; }
      app.gravePick = { hand: d.index, indices: gc.indices };
      render(); return;
    }
    const t = supportTargetSlots(g, d.index);
    const needsTarget = supportNeedsTarget(id);
    if (needsTarget) {
      const mEl = elementUnder(x, y, '.mini');
      if (mEl) {
        const side = Number(mEl.dataset.side), slot = Number(mEl.dataset.slot);
        const ok = side === 0 ? t.self.includes(slot) : t.enemy.includes(slot);
        if (ok) { actWithFx(0, { type: 'support', hand: d.index, target: { slot } }).then(afterAction); return; }
        toast('そのカードは対象にできません');
      } else toast('対象のモンスターにドロップしてください');
      render(); return;
    }
    if (elementUnder(x, y, '.field') && canPlaySupport(g, 0, d.index)) {
      actWithFx(0, { type: 'support', hand: d.index }).then(afterAction); return;
    }
    render(); return;
  }
  // --- 盤面のモンスターを敵にドラッグ = 攻撃 ---
  if (d.from === 'board' && app.screen === 'battle' && app.phase === 'play') {
    const g = app.game;
    if (!canAttack(g, 0, d.slot)) { render(); return; }
    const mEl = elementUnder(x, y, '.mini[data-side="1"]');
    const legal = legalAttackTargets(g, 0, d.slot);
    if (mEl) {
      const slot = Number(mEl.dataset.slot);
      if (legal.includes(slot)) { actWithFx(0, { type: 'attack', slot: d.slot, target: slot }).then(afterAction); return; }
      toast('【守護】がいるため、そのモンスターは攻撃できません');
    } else if (legal.includes('face') && y < window.innerHeight * 0.42) {
      actWithFx(0, { type: 'attack', slot: d.slot, target: 'face' }).then(afterAction); return;
    }
    render(); return;
  }
  render();
});

function openModePick(handIndex, slotEl) {
  const r = slotEl.getBoundingClientRect();
  app.popup = {
    type: 'mode', hand: handIndex, slot: Number(slotEl.dataset.mslot),
    x: Math.min(window.innerWidth - 170, r.right + 6), y: Math.max(8, r.top + 8),
  };
  render();
}

function addToDeck(id) {
  const d = app.deckDraft;
  const have = d.filter(x => x === id).length;
  const own = app.save.collection[id] || 0;
  const limit = card(id).maxCopies || 3;
  if (d.length >= 30) { toast('デッキは30枚までです'); return; }
  if (have >= Math.min(limit, own)) {
    toast(limit === 1 ? 'レジェンドは同名1枚までです' : 'これ以上は入れられません（同名3枚・所持数まで）'); return;
  }
  d.push(id);
}
function removeFromDeck(id) {
  const i = app.deckDraft.lastIndexOf(id);
  if (i >= 0) app.deckDraft.splice(i, 1);
}

// ============================================================
// 入力：クリック
// ============================================================
function handleClick(ev) {
  const t = ev.target;
  const hit = sel => t.closest(sel);

  const observe = hit('[data-observe]');
  if (observe && app.game?.pendingChoice) {
    applyAction(app.game, 0, { type: 'observe', index: Number(observe.dataset.observe) });
    return afterAction();
  }

  // --- 図鑑のイラスト拡大 ---
  if (hit('[data-closeartzoom]')) { app.artZoom = null; return render(); }
  const artZoomEl = hit('[data-artzoom]');
  if (artZoomEl) {
    const zid = artZoomEl.dataset.artzoom;
    if (!(app.save.collection[zid] || 0)) return toast('まだ入手していないカードです');
    app.artZoom = zid; return render();
  }

  // --- 冒険・フリーバトルでのデッキ切り替え ---
  const useDeck = hit('[data-usedeck]');
  if (useDeck) {
    const i = Number(useDeck.dataset.usedeck);
    const d = app.save.decks[i];
    if (!d) return;
    app.save.activeDeck = i;
    app.save.deck = [...d.list];
    app.deckDraft = null;           // デッキ編集の下書きは作り直す
    writeSave(app.save);
    Audio.playSe('se_click');
    toast(d.list.length === 30 ? `「${d.name}」で戦います` : `「${d.name}」は${d.list.length}/30枚です`);
    return render();
  }

  // --- 画面遷移など ---
  const goEl = hit('[data-go]');
  if (goEl) return go(goEl.dataset.go);
  const areaEl = hit('[data-area]');
  if (areaEl) { app.areaIndex = Number(areaEl.dataset.area); return render(); }
  const fightEl = hit('[data-fight]');
  if (fightEl) { const [a, e] = fightEl.dataset.fight.split(':').map(Number); return startBattle(a, e, false); }
  const freeEl = hit('[data-freefight]');
  if (freeEl) { const [a, e] = freeEl.dataset.freefight.split(':').map(Number); return startBattle(a, e, true); }
  const fd = hit('[data-freediff]');
  if (fd) { app.freeDiff = fd.dataset.freediff; return render(); }
  const collectionSet = hit('[data-collectionset]');
  if (collectionSet) { app.collectionSet = Number(collectionSet.dataset.collectionset); return render(); }
  const bp = hit('[data-buypack]');
  if (bp) {
    const item = DUST_SHOP.find(x => x.pack === bp.dataset.buypack);
    if (!item || (item.unlockAfter && !prismUnlocked(app.save)) || (app.save.stardust || 0) < item.cost) return;
    app.save.stardust -= item.cost;
    app.packResult = openPack(item.pack);
    addCards(app.save, app.packResult); writeSave(app.save);
    return render();
  }
  if (hit('[data-openpack]')) {
    const k = hit('[data-openpack]').dataset.openpack;
    if ((app.save.packs[k] || 0) <= 0) return;
    app.save.packs[k]--;
    app.packResult = openPack(k);
    addCards(app.save, app.packResult); writeSave(app.save);
    return render();
  }
  if (hit('[data-closepack]')) { app.packResult = null; app.packRevealing = false; app.packRevealed = 0; return render(); }
  if (hit('[data-rematch]')) {
    const [a, e] = app.enemyKey.split(':');
    const ai = AREAS.findIndex(x => x.id === a);
    return startBattle(ai, Number(e), !!app.free);
  }

  // --- 設定 ---
  if (t.matches('[data-mute]')) { Audio.setMuted(t.checked); return; }
  const st = hit('[data-settab]');
  if (st) { app.settingsTab = st.dataset.settab; return render(); }
  const av = hit('[data-avatar]');
  if (av) {
    app.save.profile = { ...(app.save.profile || { name: 'あなた' }), avatar: Number(av.dataset.avatar) };
    writeSave(app.save); return render();
  }
  // --- 初回の名前入力 ---
  const oba = hit('[data-obavatar]');
  if (oba) { app.onboard.avatar = Number(oba.dataset.obavatar); return render(); }
  if (hit('[data-obstart]')) {
    const nm = (document.querySelector('[data-obname]')?.value || '').trim();
    app.save.profile = { name: nm || '名もなき挑戦者', avatar: app.onboard.avatar };
    writeSave(app.save); app.onboard = null; toast('ようこそ！'); return render();
  }

  // --- デッキ編集 ---
  if (app.screen === 'deck') {
    // クリックは出し入れに使うので、効果は「i」ボタンから見る
    const info = hit('[data-cardinfo]');
    if (info) { app.detail = info.dataset.cardinfo; return render(); }
    const pc = hit('[data-poolcard]');
    if (pc) { addToDeck(pc.dataset.poolcard); return render(); }
    const dc = hit('[data-deckcard]');
    if (dc) { removeFromDeck(dc.dataset.deckcard); return render(); }
    const slot = hit('[data-deckslot]');
    if (slot) return switchDeckSlot(Number(slot.dataset.deckslot));
    if (hit('[data-deckadd]')) {
      if (app.save.decks.length >= MAX_DECKS) return toast(`デッキは${MAX_DECKS}個までです`);
      app.save.decks.push({ name: `デッキ${app.save.decks.length + 1}`, list: [] });
      app.pendingSlot = null;
      app.save.activeDeck = app.save.decks.length - 1;
      app.save.deck = [];
      app.deckDraft = [];
      writeSave(app.save);
      Audio.playSe('se_click');
      return render();
    }
    if (hit('[data-deckdel]')) {
      if (app.save.decks.length <= 1) return toast('デッキは1つ以上必要です');
      app.save.decks.splice(app.save.activeDeck, 1);
      app.save.activeDeck = Math.max(0, app.save.activeDeck - 1);
      app.save.deck = [...app.save.decks[app.save.activeDeck].list];
      app.deckDraft = [...app.save.deck];
      app.pendingSlot = null;
      writeSave(app.save);
      return render();
    }
    if (hit('[data-savedeck]')) {
      app.save.decks[app.save.activeDeck].list = [...app.deckDraft];
      app.save.deck = [...app.deckDraft];
      app.pendingSlot = null;
      writeSave(app.save);
      toast(`「${app.save.decks[app.save.activeDeck].name}」を保存しました`);
      return render();
    }
    if (hit('[data-resetdeck]')) { app.deckDraft = [...STARTER_DECK]; return render(); }
    if (hit('[data-cleardeck]')) { app.deckDraft = []; return render(); }
  }

  // --- 図鑑・デッキ編集でカードをクリック → 詳細 ---
  if ((app.screen === 'collection') && hit('[data-card]')) {
    app.detail = hit('[data-card]').dataset.card; return render();
  }

  // --- オーバーレイ ---
  if (hit('[data-closedetail]')) { app.detail = null; return render(); }
  if (hit('[data-closegrave]')) { app.graveView = null; return render(); }
  if (hit('[data-cancelgrave]')) { app.gravePick = null; return render(); }
  const gpk = hit('[data-gravepick]');
  if (gpk && app.gravePick) {
    const gi = Number(gpk.dataset.gravepick), h = app.gravePick.hand;
    app.gravePick = null;
    return actWithFx(0, { type: 'support', hand: h, target: { grave: gi } }).then(afterAction);
  }
  const mull = hit('[data-mulligan]');
  if (mull) return doMulligan(mull.dataset.mulligan === 'redraw');
  if (hit('[data-startbattle]')) return beginPlay();

  if (app.screen !== 'battle') return;
  const g = app.game;
  if (!g) return;

  // 縦持ちの引き出しは常にどちらか一方だけ。もう一方が開いていれば入れ替わる。
  if (hit('[data-toggle-log]')) {
    if (battleLayout() === 'portrait') app.drawer = app.drawer === 'log' ? null : 'log';
    else app.logOpen = !app.logOpen;
    return render();
  }
  if (hit('[data-toggle-info]')) {
    if (battleLayout() === 'portrait') app.drawer = app.drawer === 'info' ? null : 'info';
    else app.infoOpen = app.infoOpen === false;
    return render();
  }
  if (hit('[data-closedrawer]')) { app.drawer = null; return render(); }
  if (hit('[data-surrender]')) { clearTimeout(app.aiTimer); return go(app.free ? 'free' : 'adventure'); }
  const gv = hit('[data-grave]');
  if (gv) { app.graveView = Number(gv.dataset.grave); return render(); }

  // --- 召喚モード選択 ---
  const sm = hit('[data-summon]');
  if (sm) {
    const p = app.popup; app.popup = null;
    return actWithFx(0, { type: 'summon', hand: p.hand, mode: sm.dataset.summon, slot: p.slot }).then(afterAction);
  }
  // --- 自分モンスターの操作メニュー ---
  const act = hit('[data-act]');
  if (act) {
    const p = app.popup; app.popup = null;
    if (act.dataset.act === 'attack') { app.sel = { kind: 'attack', slot: p.slot }; app.hint = '攻撃する相手を選んでください'; return render(); }
    if (act.dataset.act === 'mode') return actWithFx(0, { type: 'mode', slot: p.slot }).then(afterAction);
    if (act.dataset.act === 'detail') { app.detail = g.players[0].field[p.slot].id; return render(); }
  }
  if (app.popup) { app.popup = null; render(); }

  if (hit('[data-cancel]')) { app.sel = null; app.hint = ''; return render(); }
  if (hit('[data-forge]')) return actWithFx(0, { type: 'forge' }).then(afterAction);
  if (hit('[data-endturn]')) { app.sel = null; applyAction(g, 0, { type: 'end' }); return afterAction(); }
  if (hit('[data-attackface]') && app.sel) {
    const act = { type: 'attack', slot: app.sel.slot, target: 'face' };
    app.sel = null;
    return actWithFx(0, act).then(afterAction);
  }

  // --- 手札 ---
  const handEl = hit('[data-hand]');
  if (handEl) {
    const i = Number(handEl.dataset.hand);
    if (g.phase === 'discard' && g.active === 0) { applyAction(g, 0, { type: 'discard', hand: i }); return afterAction(); }
    if (app.phase !== 'play' || g.active !== 0) return;
    const id = g.players[0].hand[i];
    if (!id) return;
    if (isMonster(id)) {
      if (!canSummon(g, 0, i)) { toast('今は出せません（コストが足りません）'); return; }
      const empty = emptySlot(g.players[0]);
      if (empty < 0) { toast('場が満杯です。入れ替えたいモンスターにドラッグしてください'); return; }
      const slotEl = document.querySelector(`[data-mslot="${empty}"]`);
      if (slotEl) return openModePick(i, slotEl);
    } else {
      if (!canPlaySupport(g, 0, i)) { toast('今は使えません'); return; }
      const gc = graveChoices(g, i);
      if (gc) {
        if (!gc.indices.length) { toast('墓地に対象がありません'); return; }
        app.gravePick = { hand: i, indices: gc.indices };
        return render();
      }
      if (supportNeedsTarget(id)) { toast('対象のモンスターにドラッグしてください'); return; }
      return actWithFx(0, { type: 'support', hand: i }).then(afterAction);
    }
    return;
  }

  // --- 盤面 ---
  const mini = hit('.mini');
  if (mini) {
    const side = Number(mini.dataset.side), slot = Number(mini.dataset.slot);
    if (side === 1) {
      if (app.sel && app.sel.kind === 'attack') {
        const legal = legalAttackTargets(g, 0, app.sel.slot);
        if (!legal.includes(slot)) { toast('【守護】がいるため攻撃できません'); return; }
        const act = { type: 'attack', slot: app.sel.slot, target: slot };
        app.sel = null; app.hint = '';
        return actWithFx(0, act).then(afterAction);
      }
      app.detail = g.players[1].field[slot]?.id; return render();
    }
    if (app.sel && app.sel.kind === 'attack' && app.sel.slot === slot) { app.sel = null; app.hint = ''; return render(); }
    const r = mini.getBoundingClientRect();
    app.popup = { type: 'own', slot, x: Math.min(window.innerWidth - 170, r.right + 6), y: r.top };
    return render();
  }
  const sup = hit('.sup');
  if (sup) { app.detail = sup.dataset.card; return render(); }
}

document.addEventListener('input', ev => {
  if (ev.target.matches('[data-playername]')) {
    const v = ev.target.value.trim();
    app.save.profile = { ...(app.save.profile || { avatar: 1 }), name: v || 'あなた' };
    writeSave(app.save);
  }
  if (ev.target.matches('[data-obname]') && app.onboard) app.onboard.name = ev.target.value;
  // デッキ名は打つたびに保存する（再描画すると入力欄からフォーカスが外れるので render しない）
  if (ev.target.matches('[data-deckname]')) {
    const d = app.save.decks[app.save.activeDeck];
    if (d) {
      d.name = ev.target.value.slice(0, 14) || `デッキ${app.save.activeDeck + 1}`;
      writeSave(app.save);
      const tab = document.querySelector(`[data-deckslot="${app.save.activeDeck}"] b`);
      if (tab) tab.textContent = d.name;
    }
  }
});
// デッキ編集では右クリックでも効果を見られるようにする
document.addEventListener('contextmenu', ev => {
  if (app.screen !== 'deck') return;
  const el = ev.target.closest('[data-poolcard],[data-deckcard]');
  if (!el) return;
  ev.preventDefault();
  app.detail = el.dataset.poolcard || el.dataset.deckcard;
  render();
});
document.addEventListener('change', ev => {
  if (ev.target.matches('[data-poolsort]')) { app.poolSort = ev.target.value; render(); }
  if (ev.target.matches('[data-bgmvol]')) Audio.setBgmVolume(ev.target.value / 100);
  if (ev.target.matches('[data-sevol]')) Audio.setSeVolume(ev.target.value / 100);
  if (ev.target.matches('[data-mute]')) Audio.setMuted(ev.target.checked);
});
document.addEventListener('contextmenu', ev => {
  if (app.screen !== 'battle') return;
  const mini = ev.target.closest('.mini[data-side="0"]');
  if (!mini) return;
  ev.preventDefault();
  const slot = Number(mini.dataset.slot);
  if (canChangeMode(app.game, 0, slot)) actWithFx(0, { type: 'mode', slot }).then(afterAction);
  else toast('モード変更はできません（1ターン1回・攻撃後は不可）');
});

// ============================================================
// デバッグ／スクリーンショット用フック
// ============================================================
function makeDemo(areaIndex = 1, enemyIndex = 2) {
  startBattle(areaIndex, enemyIndex);
  const g = app.game;
  const put = (side, slot, id, mode) => {
    const c = card(id);
    g.players[side].field[slot] = {
      uid: g.uid++, id, atk: c.atk, def: c.def, mode, hasAttacked: false, attacks: 0,
      modeChanged: false, tempAtk: 0, tempDef: 0, equips: [], grants: [],
    };
  };
  put(1, 0, 'w08', 'defense'); put(1, 1, 'f09', 'attack'); put(1, 2, 'x_g3', 'attack');
  put(0, 0, 'f05', 'attack'); put(0, 1, 'g05', 'defense'); put(0, 2, 'w03', 'attack');
  g.players[0].supports[0] = { uid: g.uid++, id: 'sf2', attachedTo: g.players[0].field[0].uid, slot: 0 };
  g.players[0].field[0].atk += 2;
  g.players[0].supports[1] = { uid: g.uid++, id: 'sn5', attachedTo: g.players[0].field[1].uid, slot: 1 };
  g.players[1].supports[0] = { uid: g.uid++, id: 'sw2', attachedTo: g.players[1].field[0].uid, slot: 0 };
  g.players[1].field[0].def += 4;
  g.players[0].life = 14; g.players[1].life = 17;
  g.players[0].maxCost = 5; g.players[0].cost = 4;
  g.players[1].maxCost = 5; g.players[1].cost = 5;
  g.players[0].grave = ['f01', 'g01', 'sf1'];
  g.players[1].grave = ['f03', 'f02'];
  g.turn = 9; g.active = 0; g.phase = 'main';
  g.players[0].hand = ['f09', 'sf1', 'x_g5', 'sn6', 'w05'];
  g.players[1].hand = ['w01', 'w03', 'sw1'];
  app.phase = 'play';
  lastBannerTurn = g.turn;
  render();
}
window.__TE = { app, render, startBattle, makeDemo, card, ALL_CARDS, applyAction, afterAction, beginPlay, doMulligan, actWithFx, Fx };

// ============================================================
Audio.scanAudio().then(info => { app.audioInfo = info; });
syncBgm();
render();
