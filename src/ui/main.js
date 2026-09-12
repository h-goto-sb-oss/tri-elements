// ============================================================
// UI エントリ
// ============================================================
import { ALL_CARDS, card, ELEMENTS, KEYWORDS } from '../engine/cards.js';
import { RARITY } from '../engine/rarity.js';
import { CHARACTER_OF, CHARACTER_WINS_NEEDED, EXTREME_SELF_COPIES } from '../engine/cards_chars.js';
import { icon, packIcon } from './icons.js';
import {
  createGame, mulligan, applyAction, legalAttackTargets, canSummon, canPlaySupport,
  canChangeMode, canAttack, supportNeedsTarget, fieldMonsters, effAtk, effDef,
  isMonster, matchFilter, hasKw, canForge, canSummonAt, summonCostOf, canEquipTo,
} from '../engine/game.js';
import { aiChooseAction } from '../engine/ai.js';
import { cardArtSource, cardArtSvg } from './art.js';
import { cardHtml, monsterHtml, supportHtml, detailHtml, esc } from './cardview.js';
import {
  AREAS, REWARD, openPack, PACK_TYPES, loadSave, writeSave,
  areaUnlocked, addCards, deckCurve, STARTER_DECK, AVATARS,
  FREE_DIFFICULTY, DUST_SHOP, REWARD_LIMIT, shopUnlocked,
  MAX_DECKS, ensureDecks,
} from '../game/campaign.js';
import * as Audio from './audio.js';
import {
  ENEMY_ART as _ENEMY_ART, AREA_BG as _AREA_BG, PLAYER_ART as _PLAYER_ART,
} from './assets_map.js';
import { withBase } from './base_url.js';
import { renderRulesPage } from './rules.js';
import * as Fx from './fx.js';
import { L, kwb, lang, setLang, storedLang, guessLang } from '../i18n/lang.js';
import '../i18n/data.js';
import { EN_SETS } from '../i18n/en_game.js';
import { track, statsEnabled, setStatsEnabled, firstVisit, packDeck } from '../game/telemetry.js';
import {
  DRAFT_ROUNDS, DRAFT_BATTLES, DRAFT_PAIRS, newDraft, applyPick, draftPhase, draftOpponent, draftReward,
} from '../game/draft.js';

// 言語は最初に決める（カード名などのデータもここで差し替わる）。
// 一度も選んだことが無ければ、端末の言語で仮に表示して選択画面を出す。
const LANG_CHOSEN = !!storedLang();
setLang(storedLang() || guessLang(), false);
function applyDocLang() {
  document.documentElement.lang = lang();
  document.title = L('TRI-ELEMENTS ／ 三属の戦記', 'TRI-ELEMENTS: Chronicle of the Three');
}
applyDocLang();

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
  sel: null,            // {kind:'attack'|'place'|'target', ...} 選択中の操作
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
  quitArm: false,       // 投了ボタンを1度押した状態（2度押しで確定）
  quitArmAt: 0,          // 構えた時刻（ゴーストクリック対策）
  audioInfo: null,
  playLog: [],          // 直近に召喚・発動されたカード（最大2件、新しい順）
  langChosen: LANG_CHOSEN,
  battleT0: 0,          // 戦闘を始めた時刻（匿名データの「何秒かかったか」用）
};

// 匿名の遊び方データ：開いたこと。p＝突破済みの敵の数（どこまで進んだ人が戻ってきたか）
track('open', {
  l: lang(), lc: LANG_CHOSEN ? 1 : 0, n: firstVisit ? 1 : 0,
  m: window.matchMedia?.('(pointer: coarse)').matches ? 1 : 0,
  p: Object.keys(app.save.cleared || {}).length,
});
// 閉じた・裏に回した時点。最後に届いた時刻が、その回に遊んだ長さになる
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') track('hide', { sc: app.screen });
});
/** 戦闘の結果を送る。r は w（勝ち）／l（負け）／q（投了）。dk は使ったデッキの構成 */
function trackBattleEnd(r, extra = {}) {
  const g = app.game;
  track('end', {
    k: app.enemyKey, f: app.free ? 1 : 0, df: app.free ? app.free.difficulty : undefined,
    r, tn: g ? g.turn : undefined,
    sec: app.battleT0 ? Math.round((Date.now() - app.battleT0) / 1000) : undefined,
    dk: packDeck(app.draftBattle && app.save.draft ? app.save.draft.picks : app.save.deck),
    dr: app.draftBattle ? 1 : undefined,
    ...extra,
  });
}

/** スマホ幅かどうか。下メニューを出すか等の判断に使う */
function isNarrow() { return window.innerWidth <= 720; }

// ============================================================
// 場面ごとの BGM
// ============================================================
const SCENE_BGM = {
  title: 'bgm_menu', deck: 'bgm_menu', collection: 'bgm_menu', rules: 'bgm_menu', settings: 'bgm_menu',
  adventure: 'bgm_map', free: 'bgm_map', draft: 'bgm_map', battle: 'bgm_battle',
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

/** 効果音なしの知らせ（toast は失敗の音が鳴るので、うれしい知らせにはこちら） */
function notice(msg, ms = 2000) {
  app.toast = msg; render();
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { app.toast = ''; render(); }, ms);
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
// 立ち絵の中で「顔の中心」が上から何割のところにあるか。
// 後半エリアのキャラは全身寄りに描かれていて顔が上端近くにあるため、
// 画像の真ん中で切り抜くと、横長の枠（特にスマホ）で顔が見切れていた。
// この値を使って、顔が枠の上から4割あたりに来るように切り抜く（style.css の .pchar）。
const FACE_Y = {
  'a1:0': 0.45, 'a1:1': 0.43, 'a1:2': 0.43,
  'a2:0': 0.43, 'a2:1': 0.38, 'a2:2': 0.43,
  'a3:0': 0.45, 'a3:1': 0.45, 'a3:2': 0.43,
  'a4:0': 0.50, 'a4:1': 0.43, 'a4:2': 0.42,
  'a5:0': 0.40, 'a5:1': 0.42, 'a5:2': 0.40,
  'a6:0': 0.33, 'a6:1': 0.26, 'a6:2': 0.16,
  'a7:0': 0.30, 'a7:1': 0.30, 'a7:2': 0.26,
  'a8:0': 0.27, 'a8:1': 0.22, 'a8:2': 0.22,
};

function portraitHtml(areaId, index, enemy) {
  const src = ENEMY_ART[areaId + ':' + index];
  const bg = AREA_BG[areaId] || AREA_BG.common;
  const tint = AREA_TINT[areaId] || '#3a4a60';
  if (src) {
    const fy = FACE_Y[areaId + ':' + index] ?? 0.42;
    return '<div class="portrait art">'
      + (bg ? '<div class="pbg" style="background-image:url(' + bg + ')"></div>' : '')
      + '<img class="pchar" src="' + src + '" alt="" style="--fy:' + fy + '">'
      + '</div>';
  }
  const faceCard = enemy.face ? card(enemy.face) : null;
  const fallback = faceCard
    ? '<div class="pface">' + cardArtSvg(faceCard) + '</div>'
    : '<div class="emoji">' + enemy.icon + '</div>';
  return '<div class="portrait" style="background:radial-gradient(circle at 50% 35%, ' + tint + ', #070a10 74%)">'
    + fallback + '</div>';
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
const myName = () => (app.save.profile?.name || L('あなた', 'You'));
const myAvatar = () => (app.save.profile?.avatar || 1);

// ============================================================
// スマホ用の下メニュー（戦闘中は出さない）
// ============================================================
const NAV_ITEMS = [
  { go: 'adventure', icon: 'adventure', label: ['冒険', 'Adventure'] },
  { go: 'free', icon: 'freebattle', label: ['フリー', 'Free'] },
  { go: 'deck', icon: 'deck', label: ['デッキ', 'Deck'] },
  { go: 'collection', icon: 'collection', label: ['図鑑', 'Cards'] },
  { go: 'title', icon: 'home', label: ['タイトル', 'Title'] },
];
function bottomNavHtml() {
  if (app.screen === 'battle' || !isNarrow()) return '';
  return `<nav class="bottomnav">${NAV_ITEMS.map(n => `
    <button class="bnav ${app.screen === n.go ? 'on' : ''}" data-go="${n.go}">
      <span class="bn-icon">${icon(n.icon)}</span><span class="bn-label">${L(...n.label)}</span>
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
      <img class="title-logo" src="${withBase(L('/assets/ui/title-logo.svg', '/assets/ui/title-logo-en.svg'))}" alt="${L('TRI-ELEMENTS 三属の戦記', 'TRI-ELEMENTS: Chronicle of the Three')}">
      <p class="title-tagline">${L('三つの力を束ね、まだ見ぬカードと世界へ。', 'Bind the three powers. New cards and new worlds await.')}</p>
      <div class="title-elements" aria-label="${L('炎・水・草の三属性', 'The three elements: Fire, Water, Grass')}">
        <span class="fire">${icon('fire')} ${ELEMENTS.fire.name}</span><span class="water">${icon('water')} ${ELEMENTS.water.name}</span><span class="grass">${icon('grass')} ${ELEMENTS.grass.name}</span>
      </div>
    </div>
    <div class="title-panel">
      <div class="titleprof">
        <div class="tface">${avatarHtml(myAvatar())}</div>
        <div class="titleprof-text"><b>${esc(myName())}</b><div>${L(`${app.save.stats.wins}勝 ${app.save.stats.losses}敗`, `${app.save.stats.wins}W ${app.save.stats.losses}L`)}　<span>${L(`所持 ${owned}枚`, `${owned} cards`)}</span></div></div>
      </div>
      <div class="title-menu">
        <button class="title-action main" data-go="adventure"><span class="ta-icon">${icon('adventure')}</span><span><b>${L('冒険へ出る', 'Adventure')}</b><small>${L('物語を進める', 'Continue the story')}</small></span></button>
        <button class="title-action" data-go="free"><span class="ta-icon">${icon('freebattle')}</span><span><b>${L('フリーバトル', 'Free Battle')}</b><small>${L('好きな相手と対戦', 'Fight any opponent you like')}</small></span></button>
        <button class="title-action" data-go="draft"><span class="ta-icon">${icon('draft')}</span><span><b>${L('選定の儀', 'Rite of Choosing')}</b><small>${app.save.draft ? L('挑戦の続きから', 'Continue your run') : L('その場で組んで5連戦', 'Draft a deck, fight 5 rivals')}</small></span></button>
        <button class="title-action" data-go="deck"><span class="ta-icon">${icon('deck')}</span><span><b>${L('デッキ編集', 'Deck Builder')}</b><small>${L('30枚を編成', 'Build a 30-card deck')}</small></span></button>
        <button class="title-action" data-go="collection"><span class="ta-icon">${icon('collection')}</span><span><b>${L('カード図鑑', 'Card Library')}</b><small>${L(`全${ALL_CARDS.filter(c => !c.hidden).length}種を眺める`, `Browse all ${ALL_CARDS.filter(c => !c.hidden).length} cards`)}</small></span></button>
        <button class="title-action" data-go="shop"><span class="ta-icon">${icon('shop')}</span><span><b>${L('カードショップ', 'Card Shop')}</b><small>${L(`星屑 ${icon('stardust')}${app.save.stardust || 0} でパックと交換`, `Trade ${icon('stardust')}${app.save.stardust || 0} Stardust for packs`)}</small></span></button>
        <button class="title-action" data-go="rules"><span class="ta-icon">${icon('rules')}</span><span><b>${L('ルール説明', 'How to Play')}</b><small>${L('遊び方を確認', 'Learn the rules')}</small></span></button>
        <button class="title-action quiet" data-go="settings"><span class="ta-icon">${icon('settings')}</span><span><b>${L('設定', 'Settings')}</b><small>${L('音量・プロフィール・言語', 'Sound, profile, language')}</small></span></button>
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
    <span class="dp-label">${L('デッキ', 'Deck')}</span>
    <div class="dp-slots">${decks.map((d, i) => {
      const ready = d.list.length === 30;
      return `<button class="dp-slot ${i === active ? 'on' : ''} ${ready ? '' : 'short'}"
        data-usedeck="${i}" ${ready ? '' : `title="${L('30枚そろっていません', 'Not 30 cards yet')}"`}>
        <b>${esc(d.name)}</b><small>${d.list.length}/30</small></button>`;
    }).join('')}</div>
    <button class="btn tiny" data-go="deck">${L('編集', 'Edit')}</button>
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
      ${ok ? `data-area="${i}"` : 'disabled'}>${ok ? '' : icon('lock')}${esc(a.name)}${done ? ' ✓' : ''}</button>`;
  }).join('');

  const foes = area.enemies.map((e, i) => {
    const cleared = !!app.save.cleared[`${area.id}:${i}`];
    // 1体目は常に挑戦可能。2体目以降は前の敵を倒すと解放
    const prevOk = i === 0 || !!app.save.cleared[`${area.id}:${i - 1}`];
    const open = unlocked && prevOk;
    const cnt = (app.save.clearCount || {})[`${area.id}:${i}`] || 0;
    const left = Math.max(0, REWARD_LIMIT - cnt);
    return `<div class="foe ${cleared ? 'cleared' : ''} ${open ? '' : 'locked'}">
      ${cleared ? `<div class="badge">${left ? L(`報酬 あと${left}回`, `Rewards left: ${left}`) : L('クリア済', 'Cleared')}</div>` : ''}
      ${open ? '' : `<div class="lockicon">${icon('lock')}</div>`}
      ${portraitHtml(area.id, i, e)}
      <div class="fname">${esc(e.name)}</div>
      <div class="fdesc">${esc(e.desc)}</div>
      <div class="fmeta">
        <span>${L('ライフ', 'Life')} <b>${e.life || 20}</b></span>
        ${e.startCost ? `<span>${L(`開始 <b>${e.startCost}</b>コスト`, `Starts at <b>${e.startCost}</b> cost`)}</span>` : ''}
        ${e.weak ? `<span>${L(`${icon(e.weak)}が有効`, `Weak to ${icon(e.weak)}`)}</span>` : ''}
        ${i === area.enemies.length - 1 ? `<span style="color:#ffd27a">${L('ボス', 'Boss')}</span>` : ''}
      </div>
      <button class="btn ${cleared && !left ? '' : 'primary'} fbtn" ${open ? `data-fight="${ai}:${i}"` : 'disabled'}>
        ${open ? (cleared ? (left ? L(`戦う（報酬あと${left}回）`, `Fight (${left} rewards left)`) : L('もう一度戦う', 'Fight again')) : L('挑戦する', 'Challenge')) : L('前の相手を倒すと解放', 'Beat the previous opponent to unlock')}
      </button>
    </div>`;
  }).join('');

  const packs = Object.entries(app.save.packs || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => `<button class="btn primary" data-openpack="${k}">${L(`${PACK_TYPES[k].name} ×${n} を開ける`, `Open ${PACK_TYPES[k].name} ×${n}`)}</button>`).join('');

  return `<div class="adventure">
    ${deckPickerHtml()}
    <div class="adv-head">
      <h2>${esc(area.name)}</h2>
      <div class="desc">${esc(area.desc)}<br><span style="color:#9fb2c8">${L('報酬', 'Reward')}: ${PACK_TYPES[REWARD[area.id]].name}${L('　／　', ' / ')}${L('撃破', 'Defeated')} ${area.enemies.filter((_, k) => app.save.cleared[`${area.id}:${k}`]).length}/${area.enemies.length}</span></div>
      <div class="adv-tabs">${tabs}</div>
    </div>
    <div class="adv-stage adv-${area.id}" ${AREA_BG[area.id] ? `style="--bgimg:url(${AREA_BG[area.id]})"` : ''}>
      ${AREA_BG[area.id] ? '<div class="stagebg"></div>' : areaSceneSvg(area.id)}
      <div class="foes">${foes}</div>
    </div>
    <div class="adv-foot">
      ${packs}
      <button class="btn" data-go="free">${L('フリーバトル', 'Free Battle')}</button>
      <button class="btn" data-go="deck">${L('デッキ編集', 'Deck Builder')}</button>
      <button class="btn" data-go="title">${L('タイトルへ', 'Back to Title')}</button>
    </div>
  </div>`;
}

// ============================================================
// フリーバトル
// ============================================================
// ---------- カードショップ ----------
// 以前はフリーバトル画面のバーの端に押し込まれていて、まず気づけなかった。
// 星屑の貯め方と、次に何を開けば新しい弾が並ぶのかも、ここに書いておく。
const PACK_BLURB = {
  set1: ['第1弾。炎・水・草の基本が一通りそろいます。', 'Set 1. All the Fire, Water, and Grass basics.'],
  set2: ['第2弾。断末魔や装備など、仕掛けのあるカードが増えます。', 'Set 2. More tricks, like Last Breath and equipment.'],
  set3: ['第3弾。観測・加速など、引きと展開を助けるカード。', 'Set 3. Cards like Observe and Accelerate that help you draw and build up.'],
  set4: ['第4弾。隣に誰を置くかで強さが変わる、陣形のカード。', 'Set 4. Formation cards whose strength depends on who stands beside them.'],
  prism: ['全弾から、レア以上だけが5枚出ます。', '5 cards from every set, all Rare or better.'],
};

function renderShop() {
  const dust = app.save.stardust || 0;
  const items = DUST_SHOP.map(x => {
    const open = shopUnlocked(app.save, x);
    const pack = PACK_TYPES[x.pack];
    const enough = dust >= x.cost;
    const area = x.unlockAfter ? AREAS.find(a => a.id === x.unlockAfter) : null;
    return `<div class="shopitem ${open ? '' : 'locked'}">
      <div class="shopart">${open ? packIcon(x.pack) : icon('lock')}</div>
      <div class="shopname">${open ? esc(pack.name) : '？？？'}</div>
      <div class="shopdesc">${open ? esc(PACK_BLURB[x.pack] ? L(...PACK_BLURB[x.pack]) : L(`${pack.size}枚入り`, `${pack.size} cards`))
        : L(`${esc(area ? area.name : '')}の相手を全員倒すと並びます`, `Unlocks after beating everyone in ${esc(area ? area.name : '')}`)}</div>
      <button class="btn ${open && enough ? 'primary' : ''}" ${open && enough ? `data-buypack="${x.pack}"` : 'disabled'}>
        ${L(`${icon('stardust')}${x.cost} ${open ? (enough ? 'で交換' : 'ぶん足りません') : ''}`,
          `${open ? (enough ? 'Trade ' : 'Need ') : ''}${icon('stardust')}${x.cost}`)}</button>
    </div>`;
  }).join('');

  return `<div class="adventure">
    <div class="adv-head">
      <h2>${L('カードショップ', 'Card Shop')}</h2>
      <div class="desc">${L(`星屑 ${icon('stardust')} をパックと交換できます。`, `Trade Stardust ${icon('stardust')} for card packs.`)}<br>
        <span style="color:#9fb2c8">${L('星屑はフリーバトルで勝つと貯まります。難易度が高いほど多くもらえます。', 'You earn Stardust by winning Free Battles. Higher difficulties give more.')}</span></div>
      <div class="dust">${icon('stardust')} ${dust}</div>
    </div>
    <div class="adv-stage adv-shop" ${AREA_BG.common ? `style="--bgimg:url(${AREA_BG.common})"` : ''}>
      ${AREA_BG.common ? '<div class="stagebg"></div>' : ''}
      <div class="shoplist">${items}</div>
    </div>
    <div class="hint" style="font-size:13px;padding:10px 14px">
      ${L('新しい弾は、冒険を進めると並びます。手前の弾から順に覚えていくのがおすすめです。', 'New sets appear as you progress in Adventure. It helps to learn the earlier sets first.')}</div>
  </div>`;
}

function renderFree() {
  const beaten = [];
  AREAS.forEach((a, ai) => a.enemies.forEach((e, ei) => {
    if (app.save.cleared[`${a.id}:${ei}`]) beaten.push({ a, ai, e, ei, key: `${a.id}:${ei}` });
  }));

  const diffTabs = Object.entries(FREE_DIFFICULTY).map(([k, d]) => {
    const notes = [];
    if (d.life) notes.push(L(`敵ライフ+${d.life}`, `Enemy Life +${d.life}`));
    if (d.cost) notes.push(L(`開始コスト+${d.cost}`, `Start cost +${d.cost}`));
    if (k === 'extreme') notes.push(L('AIが本気で戦う', 'AI plays its best'));
    return `
    <button class="tab ${app.freeDiff === k ? 'on' : ''}" data-freediff="${k}">
      ${d.name}${notes.length ? L(`（${notes.join('・')}）`, ` (${notes.join(', ')})`) : ''}
    </button>`;
  }).join('');

  const cards = beaten.map(({ a, ai, e, ei, key }) => {
    const st = app.save.freeStats?.[key] || { w: 0, l: 0 };
    // 「極」で規定回数勝つと本人のカードが手に入る。勝った直後にしか
    // 出なかった進み具合を、相手を選ぶ画面にも常に出しておく
    const cid = CHARACTER_OF[key];
    const charLeft = cid && !app.save.collection[cid] ? CHARACTER_WINS_NEEDED - (st.xw || 0) : 0;
    return `<div class="foe free">
      ${portraitHtml(a.id, ei, e)}
      <div class="fname">${esc(e.name)}</div>
      <div class="fdesc">${esc(a.name)}</div>
      <div class="fmeta">
        <span>${L(`${st.w}勝 ${st.l}敗`, `${st.w}W ${st.l}L`)}</span>
        ${e.weak ? `<span>${L(`${icon(e.weak)}が有効`, `Weak to ${icon(e.weak)}`)}</span>` : ''}
      </div>
      ${charLeft > 0 ? `<div class="charprog">${L(`🎴「極」であと${charLeft}勝でカードを入手`, `🎴 ${charLeft} more Extreme wins to get their card`)}</div>` : ''}
      <button class="btn primary fbtn" data-freefight="${ai}:${ei}">${L('戦う', 'Fight')}</button>
    </div>`;
  }).join('');

  return `<div class="adventure">
    ${deckPickerHtml()}
    <div class="adv-head">
      <h2>${L('フリーバトル', 'Free Battle')}</h2>
      <div class="desc">${L('一度倒した相手といつでも再戦できます。ここでの勝敗は冒険の戦績には影響しません。', 'Rematch any opponent you have beaten. Results here don’t affect your Adventure record.')}<br>
        <span style="color:#9fb2c8">${L(`勝つと星屑 ${icon('stardust')} が貯まり、パックと交換できます。`, `Wins earn Stardust ${icon('stardust')}, which you can trade for packs.`)}</span></div>
      <div class="dust">${icon('stardust')} ${app.save.stardust || 0}</div>
    </div>
    <div class="freebar">
      <span class="hint" style="min-height:0">${L('難易度', 'Difficulty')}</span>
      <div class="tabs">${diffTabs}</div>
      ${app.freeDiff === 'extreme' ? `<span class="hint xrule">${L('極では、相手は自分のカードを1枚だけ必ず初手に持って現れます', 'On Extreme, each opponent always starts with their own character card in hand')}</span>` : ''}
      <span style="margin-left:auto"></span>
      <button class="btn small" data-go="shop">${icon('shop')} ${L('カードショップ', 'Card Shop')}（${icon('stardust')}${app.save.stardust || 0}）</button>
    </div>
    <div class="adv-stage adv-free" ${AREA_BG.common ? `style="--bgimg:url(${AREA_BG.common})"` : ''}>
      ${AREA_BG.common ? '<div class="stagebg"></div>' : ''}
      <div class="foes scroll">${cards || `<div class="hint" style="font-size:14px">${L('まだ誰も倒していません。冒険で1人倒すとここに並びます。', 'You haven’t beaten anyone yet. Opponents you beat in Adventure will show up here.')}</div>`}</div>
    </div>
    <div class="adv-foot">
      <button class="btn" data-go="deck">${L('デッキ編集', 'Deck Builder')}</button>
      <button class="btn" data-go="title">${L('タイトルへ', 'Back to Title')}</button>
    </div>
  </div>`;
}

// ============================================================
// 選定の儀（2ピック：その場で30枚を組んで5連戦）。計算は game/draft.js
// ============================================================
const ELEMENT_ORDER = { fire: 0, water: 1, grass: 2, none: 3 };
function pairName(pair) {
  return (pair || []).map(e => ELEMENTS[e].name).join(L('×', ' × '));
}
function pairIcons(pair) {
  return `<span class="dr-pairicons">${(pair || []).map(e => icon(e)).join('')}</span>`;
}

/** 5戦ぶんの勝ち負けを丸で並べる */
function draftPipsHtml(d) {
  const log = (d && d.log) || [];
  return `<div class="dr-pips">${Array.from({ length: DRAFT_BATTLES }, (_, i) => {
    const r = log[i];
    return `<span class="${r ? (r.win ? 'w' : 'l') : ''}">${r ? (r.win ? L('勝', 'W') : L('負', 'L')) : i + 1}</span>`;
  }).join('')}</div>`;
}

/** 組んだデッキのコスト配分と中身（名前だけの小さな一覧） */
function draftDeckHtml(picks) {
  const curve = deckCurve(picks);
  const max = Math.max(1, ...Object.values(curve));
  const bars = [1, 2, 3, 4, 5, 6, 7].map(k => `<div class="dr-cb"><i style="height:${(curve[k] || 0) / max * 100}%"></i><b>${curve[k] || ''}</b><span>${k === 7 ? '7+' : k}</span></div>`).join('');
  const count = {};
  picks.forEach(id => { count[id] = (count[id] || 0) + 1; });
  const ids = Object.keys(count).sort((a, b) => (card(a).cost - card(b).cost) || (ELEMENT_ORDER[card(a).element] - ELEMENT_ORDER[card(b).element]) || a.localeCompare(b));
  const mons = picks.filter(id => card(id).type === 'monster').length;
  const chips = ids.map(id => {
    const c = card(id);
    return `<button class="dr-chip ${c.element}" data-card="${id}"><span class="dc-cost">${c.cost}</span><span class="dc-name">${esc(c.name)}</span>${count[id] > 1 ? `<span class="dc-n">×${count[id]}</span>` : ''}</button>`;
  }).join('');
  return `<div class="dr-deck">
    <div class="dr-deckhead"><b>${L(`デッキ ${picks.length}/30`, `Deck ${picks.length}/30`)}</b><span>${L(`モンスター ${mons}・サポート ${picks.length - mons}`, `${mons} monsters · ${picks.length - mons} supports`)}</span></div>
    <div class="dr-curve">${bars}</div>
    <div class="dr-chips">${chips || `<span class="hint">${L('まだ何も取っていません', 'Nothing picked yet')}</span>`}</div>
  </div>`;
}

const PAIR_BLURB = {
  'fire,water': ['攻めの炎と、粘りの水', 'Fire’s offense, Water’s endurance'],
  'water,grass': ['守りと回復で、じっくり勝つ', 'Win slowly with walls and healing'],
  'grass,fire': ['大きく育てて、焼き払う', 'Grow big, then burn it down'],
};

function renderDraft() {
  const d = app.save.draft;
  const phase = draftPhase(d);
  const stats = app.save.draftStats || { runs: 0, best: 0 };
  let body = '';

  if (phase === 'none') {
    const pairs = DRAFT_PAIRS.map(p => `
      <button class="dr-pairbtn" data-draftpair="${p.join(',')}">
        ${pairIcons(p)}<b>${pairName(p)}</b><small>${L(...PAIR_BLURB[p.join(',')])}</small>
      </button>`).join('');
    body = `<div class="dr-intro">
      <p class="dr-lead">${L('2枚1組のセットが2つ出てくるので、どちらかを取ります。15回くり返して30枚のデッキを組み、5人のライバルと戦います。',
        'Two sets of two cards appear — take one. Repeat 15 times to build a 30-card deck, then fight 5 rivals.')}</p>
      <ul class="dr-rules">
        <li>${L('持っていないカードも使えます（無属性のカードはどの組でも出ます）', 'You can use cards you don’t own (neutral cards appear in every pair)')}</li>
        <li>${L(`勝った数で星屑 ${icon('stardust')}（最大10）。5戦全勝でプリズムパック`, `Earn Stardust ${icon('stardust')} for your wins (up to 10). Win all 5 for a Prism Pack`)}</li>
        <li>${L('途中で閉じても、続きから再開できます', 'You can close the game and pick up where you left off')}</li>
      </ul>
      <h3>${L('属性の組み合わせを選ぶ', 'Choose your element pair')}</h3>
      <div class="dr-pairs">${pairs}</div>
      ${stats.runs ? `<p class="hint dr-best">${L(`これまで ${stats.runs}回挑戦・最高 ${stats.best}勝`, `${stats.runs} runs so far · best ${stats.best} wins`)}</p>` : ''}
    </div>`;
  } else if (phase === 'pick') {
    const round = d.picks.length / 2 + 1;
    const opt = (set, i) => `
      <div class="dr-opt">
        <div class="dr-cards">${set.map(id => cardHtml(card(id), {})).join('')}</div>
        <button class="btn primary dr-take" data-draftpick="${i}">${L('このセットを取る', 'Take this set')}</button>
      </div>`;
    body = `<div class="dr-top">
        ${pairIcons(d.pair)}<b>${L(`ピック ${round} / ${DRAFT_ROUNDS}`, `Pick ${round} / ${DRAFT_ROUNDS}`)}</b>
        <div class="dr-progress"><i style="width:${(round - 1) / DRAFT_ROUNDS * 100}%"></i></div>
      </div>
      <div class="dr-options">${opt(d.options[0], 0)}<div class="dr-or">${L('または', 'or')}</div>${opt(d.options[1], 1)}</div>
      <p class="hint dr-tip">${L('カードを押すと、効果を詳しく見られます', 'Tap a card to see its details')}</p>
      ${draftDeckHtml(d.picks)}
      <div class="dr-quit"><button class="btn tiny" data-draftquit>${app.draftQuitArm ? L('もう一度押すとやめます', 'Press again to abandon') : L('この挑戦をやめる', 'Abandon this run')}</button></div>`;
  } else if (phase === 'battle') {
    const o = d.opp;
    const a = o ? AREAS[o.area] : null, e = a ? a.enemies[o.index] : null;
    body = `<div class="dr-status">
        ${pairIcons(d.pair)}<b>${L(`${d.wins}勝 ${d.losses}敗`, `${d.wins}W ${d.losses}L`)}</b>
        <span class="hint">${L(`${d.played + 1}戦目 / ${DRAFT_BATTLES}`, `Battle ${d.played + 1} of ${DRAFT_BATTLES}`)}</span>
        ${draftPipsHtml(d)}
      </div>
      ${e ? `<div class="adv-stage dr-stage" ${AREA_BG[a.id] ? `style="--bgimg:url(${AREA_BG[a.id]})"` : ''}>
        ${AREA_BG[a.id] ? '<div class="stagebg"></div>' : ''}
        <div class="foes"><div class="foe">
          ${portraitHtml(a.id, o.index, e)}
          <div class="fname">${esc(e.name)}</div>
          <div class="fdesc">${pairIcons(o.pair)} ${L(`${pairName(o.pair)}のドラフトデッキ`, `${pairName(o.pair)} draft deck`)}</div>
          <button class="btn primary fbtn" data-draftfight>${L('対戦する', 'Fight')}</button>
        </div></div>
      </div>` : ''}
      ${draftDeckHtml(d.picks)}
      <div class="dr-quit"><button class="btn tiny" data-draftquit>${app.draftQuitArm ? L('もう一度押すとやめます（報酬はもらえません）', 'Press again to abandon (no reward)') : L('この挑戦をやめる', 'Abandon this run')}</button></div>`;
  } else {
    const rw = draftReward(d.wins);
    body = `<div class="dr-done">
      <h3>${L('挑戦終了', 'Run complete')}</h3>
      <div class="dr-bigscore">${L(`${d.wins}勝 ${d.losses}敗`, `${d.wins}W ${d.losses}L`)}</div>
      ${draftPipsHtml(d)}
      <div class="dr-reward">${L('報酬', 'Reward')}：${rw.dust ? `${icon('stardust')} ${L(`星屑 ${rw.dust}`, `${rw.dust} Stardust`)}` : L('なし', 'none')}${rw.prism ? ` ＋ ${packIcon('prism')} ${PACK_TYPES.prism.name}` : ''}</div>
      <button class="btn primary" data-draftclaim>${L('受け取って終わる', 'Claim and finish')}</button>
    </div>
    ${draftDeckHtml(d.picks)}`;
  }

  return `<div class="adventure draft">
    <div class="adv-head">
      <h2>${L('選定の儀', 'Rite of Choosing')}</h2>
      <div class="desc">${L('その場でデッキを組んで、5人のライバルと連戦するモードです。', 'Draft a deck on the spot and battle 5 rivals in a row.')}</div>
      <div class="dust">${icon('stardust')} ${app.save.stardust || 0}</div>
    </div>
    ${body}
    <div class="adv-foot"><button class="btn" data-go="title">${L('タイトルへ', 'Back to Title')}</button></div>
  </div>`;
}

/** 2ピックの対戦を始める（相手がまだ決まっていなければここで決めて、セーブに残す） */
function startDraftBattle() {
  const d = app.save.draft;
  if (draftPhase(d) !== 'battle') return;
  if (!d.opp) { d.opp = draftOpponent(d.played, AREAS, Math.random, d.pair); writeSave(app.save); }
  startBattle(d.opp.area, d.opp.index, false, { draft: true });
}

/** 2ピックの1戦の結果を記録して、次の相手を決める */
function recordDraftBattle(win) {
  const d = app.save.draft;
  if (!d) return { wins: 0, losses: 0, played: 0 };
  d.log.push({ key: d.opp ? d.opp.key : null, win });
  if (win) d.wins++; else d.losses++;
  d.played++;
  d.opp = d.played < DRAFT_BATTLES ? draftOpponent(d.played, AREAS, Math.random, d.pair) : null;
  writeSave(app.save);
  return d;
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
    return toast(L('未保存の変更があります。もう一度押すと破棄して切り替えます', 'You have unsaved changes. Press again to discard them and switch'));
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
        <button class="cinfo" data-cardinfo="${c.id}" title="${L('カードの効果を見る', 'View card effect')}" aria-label="${L(`${esc(c.name)}の詳細`, `${esc(c.name)} details`)}">i</button>
      </div>`).join('');

  const owned = Object.keys(app.save.collection).filter(id => app.save.collection[id] > 0).map(id => card(id));
  const pool = sortPool(owned).map(c => {
    const inDeck = counts[c.id] || 0;
    const own = app.save.collection[c.id];
    const full = inDeck >= Math.min(3, own) || draft.length >= 30;
    return `<div class="poolcard ${full ? 'full' : ''}" data-poolcard="${c.id}">
      ${cardHtml(c, { cls: full ? '' : 'selectable' })}
      <div class="own">${inDeck}/${Math.min(3, own)}</div>
      <button class="cinfo" data-cardinfo="${c.id}" title="${L('カードの効果を見る', 'View card effect')}" aria-label="${L(`${esc(c.name)}の詳細`, `${esc(c.name)} details`)}">i</button>
    </div>`;
  }).join('');

  const decks = app.save.decks;
  const active = app.save.activeDeck;
  const slots = decks.map((d, i) => `
    <button class="dslot ${i === active ? 'on' : ''} ${app.pendingSlot === i ? 'warn' : ''}" data-deckslot="${i}">
      <b>${esc(d.name)}</b><small>${d.list.length}/30</small>
    </button>`).join('')
    + (decks.length < MAX_DECKS
      ? `<button class="dslot add" data-deckadd title="${L('新しいデッキを作る', 'New deck')}">＋</button>` : '');

  return `<div class="deckwrap">
    <div class="deckcol">
      <div class="dslots">${slots}</div>
      <div class="dnamerow">
        <input class="dname" data-deckname maxlength="14" value="${esc(decks[active].name)}"
          aria-label="${L('デッキ名', 'Deck name')}">
        <span class="dcount" style="color:${draft.length === 30 ? '#7fe0a0' : '#ff9a9a'}">${draft.length}/30</span>
        ${decks.length > 1 ? `<button class="btn tiny" data-deckdel>${L('削除', 'Delete')}</button>` : ''}
      </div>
      <div class="curve">${bars}</div>
      <div style="height:10px"></div>
      <div class="decklist" data-decklist>${deckCards || `<div class="hint" style="width:100%;padding-top:30px">${L('ここにカードをドラッグ', 'Drag cards here')}</div>`}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn primary small" data-savedeck ${draft.length === 30 ? '' : 'disabled'}>${L('保存', 'Save')}</button>
        <button class="btn small" data-resetdeck>${L('初期構築', 'Starter deck')}</button>
        <button class="btn small" data-cleardeck>${L('全部外す', 'Clear all')}</button>
        <button class="btn small" data-go="title">${L('戻る', 'Back')}</button>
      </div>
      <div class="hint"><span class="hint-mouse">${L('カードをドラッグして出し入れ／クリックでも増減', 'Drag cards in and out, or click to add/remove')}</span><span class="hint-touch">${L('カードをタップで出し入れ／「i」で効果を見る', 'Tap cards to add/remove. Tap “i” to see the effect')}</span>${
        deckDirty() ? `　<b style="color:#ffc07a">${L('未保存の変更があります', 'Unsaved changes')}</b>` : ''}</div>
    </div>
    <div class="poolcol">
      <div class="pooltools">
        <b style="color:var(--gold)">${L('所持カード', 'Your cards')}</b>
        <span class="hint" style="min-height:0">${L('並び順', 'Sort')}</span>
        <select class="sel" data-poolsort>
          <option value="element" ${app.poolSort === 'element' ? 'selected' : ''}>${L('属性順', 'Element')}</option>
          <option value="cost" ${app.poolSort === 'cost' ? 'selected' : ''}>${L('コスト順', 'Cost')}</option>
          <option value="rarity" ${app.poolSort === 'rarity' ? 'selected' : ''}>${L('レア度順', 'Rarity')}</option>
          <option value="type" ${app.poolSort === 'type' ? 'selected' : ''}>${L('種類順', 'Type')}</option>
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
  const setInfo = lang() === 'en'
    ? Object.fromEntries(Object.entries(EN_SETS).map(([k, [name, sub]]) => [k, { name, sub }]))
    : {
      1: { name: '第1弾', sub: '三属の目覚め' },
      2: { name: '第2弾', sub: '嵐の来訪者' },
      3: { name: '第3弾', sub: '星辰の門' },
      4: { name: '第4弾', sub: '鉄旗の陣' },
      9: { name: 'キャラクター', sub: '極の果てに現れる者たち' },
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
    const info = setInfo[s] || { name: L(`第${s}弾`, `Set ${s}`), sub: '' };
    return `<button class="dexset ${s === activeSet ? 'on' : ''}" data-collectionset="${s}">
      <b>${info.name}</b><small>${esc(info.sub)}　${have}/${cards.length}</small>
    </button>`;
  }).join('');
  const groups = [['fire', `${icon('fire')} ${L('炎', 'Fire')}`], ['water', `${icon('water')} ${L('水', 'Water')}`], ['grass', `${icon('grass')} ${L('草', 'Grass')}`], ['none', `${icon('none')} ${L('汎用', 'Neutral')}`]];
  const html = groups.map(([el, label]) => {
    const cs = setCards.filter(c => c.element === el);
    if (!cs.length) return '';
    const have = cs.filter(c => app.save.collection[c.id]).length;
    return `<section class="dexgroup">
      <div class="dexgroup-head"><h3>${label}</h3><span>${have}/${cs.length}${L('種', '')}</span></div>
      <div class="grid dexgrid">${cs.map(c => {
        const own = app.save.collection[c.id] || 0;
        // 隠しカードは、入手するまで中身を見せない（何が居るかも伏せる）
        if (c.hidden && !own) {
          return `<div class="poolcard"><div class="card secretcard"><div class="secretmark">？</div></div>
            <div class="own">${L('未入手', 'Not found')}</div></div>`;
        }
        return `<div class="poolcard">${cardHtml(c, { cls: own ? 'selectable' : 'disabled' })}
          <div class="own">${own ? '×' + own : L('未所持', 'Not owned')}</div></div>`;
      }).join('')}</div></section>`;
  }).join('');
  const info = setInfo[activeSet] || { name: L(`第${activeSet}弾`, `Set ${activeSet}`), sub: '' };
  return `<div class="screen collection-screen">
    <div class="dexsticky">
      <div class="dexhead">
        <button class="dexback" data-go="title" aria-label="${L('タイトルへ戻る', 'Back to title')}">← <span>${L('タイトルへ', 'Title')}</span></button>
        <div class="dextitle"><h2>${L('カード図鑑', 'Card Library')}</h2><p>${L(`${info.name}「${esc(info.sub)}」`, `${info.name}: ${esc(info.sub)}`)}</p></div>
        <div class="dexsummary"><b>${setHave}</b> / ${setCards.length}${L('種', '')}<small>${L(`所持 ${copies}枚`, `${copies} owned`)}</small></div>
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
      <label>${L('プレイヤー名', 'Player name')}</label>
      <input class="tinput" type="text" maxlength="12" value="${esc(myName())}" data-playername>
    </div>
    <div class="setrow col">
      <label>${L('アバター', 'Avatar')}</label>
      <div class="avgrid">${avatars}</div>
    </div>`;

  const sound = `
    <div class="setrow">
      <label>${L('ミュート', 'Mute')}</label>
      <input type="checkbox" data-mute ${st.muted ? 'checked' : ''}>
    </div>
    <div class="setrow">
      <label>${L('BGM 音量', 'Music volume')}</label>
      <input type="range" min="0" max="100" value="${Math.round(st.bgmVol * 100)}" data-bgmvol>
      <span class="hint" style="min-height:0">${Math.round(st.bgmVol * 100)}</span>
    </div>
    <div class="setrow">
      <label>${L('効果音 音量', 'Sound effects volume')}</label>
      <input type="range" min="0" max="100" value="${Math.round(st.seVol * 100)}" data-sevol>
      <span class="hint" style="min-height:0">${Math.round(st.seVol * 100)}</span>
    </div>`;

  // 言語タブは、読めない言語で開いてしまった人でも見つけられるよう常に2言語で書く
  const language = `
    <div class="setrow col">
      <label>言語 / Language</label>
      <div class="langpick">
        <button class="btn ${lang() === 'ja' ? 'primary' : ''}" data-setlang="ja">日本語</button>
        <button class="btn ${lang() === 'en' ? 'primary' : ''}" data-setlang="en">English</button>
      </div>
    </div>`;

  const data = `
    <div class="setrow col">
      <label>${L('引き継ぎコードを作る', 'Create a transfer code')}</label>
      <div class="hint setnote">${L('別の端末や別のサイトにデータを移すときに使います。コードをコピーして、移し先の「コードで読み込む」に貼り付けてください。',
        'Use this to move your save to another device or site. Copy the code, then paste it into “Load from code” there.')}</div>
      <button class="btn" data-makecode>${L('コードを作る', 'Create code')}</button>
      ${app.transferCode ? `<textarea class="codebox" readonly data-codeout>${esc(app.transferCode)}</textarea>
        <button class="btn small" data-copycode>${L('コピー', 'Copy')}</button>` : ''}
    </div>
    <div class="setrow col">
      <label>${L('コードで読み込む', 'Load from code')}</label>
      <textarea class="codebox" data-codein placeholder="${L('ここに引き継ぎコードを貼り付け', 'Paste your transfer code here')}">${esc(app.codeIn || '')}</textarea>
      <button class="btn danger" data-loadcode>${L('読み込む', 'Load')}</button>
      <div class="hint setnote">${L('今のデータは上書きされます。', 'Your current save will be overwritten.')}</div>
    </div>
    <div class="setrow col">
      <label class="checkrow"><input type="checkbox" data-stats ${statsEnabled() ? 'checked' : ''}>
        ${L('遊び方の統計を送る（匿名）', 'Send anonymous play statistics')}</label>
      <div class="hint setnote">${L('どのライバルで負けたか、どこまで進んだか、対戦に使ったデッキの構成、何分遊んだかだけを送り、難しさとカードの調整に使います。名前やセーブの中身は送りません。',
        'Only which rivals you lost to, how far you got, the cards in the deck you battled with, and how long you played — used to tune the difficulty and the cards. Your name and save data are never sent.')}</div>
    </div>`;

  const panels = { player, sound, language, data };
  return `<div class="screen">
    <h2 style="color:var(--gold)">${L('設定', 'Settings')}</h2>
    <div class="tabs">
      <button class="tab ${tab === 'player' ? 'on' : ''}" data-settab="player">${L('プレイヤー', 'Player')}</button>
      <button class="tab ${tab === 'sound' ? 'on' : ''}" data-settab="sound">${L('サウンド', 'Sound')}</button>
      <button class="tab ${tab === 'language' ? 'on' : ''}" data-settab="language">言語 / Language</button>
      <button class="tab ${tab === 'data' ? 'on' : ''}" data-settab="data">${L('データ', 'Data')}</button>
    </div>
    <div class="setpanel">${panels[tab] || player}</div>
    <div class="hint" style="font-size:11px">${L('ビルド', 'Build')} ${typeof __BUILD__ === 'string' ? __BUILD__ : L('開発中', 'dev')}</div>
    <button class="btn" data-go="title">${L('戻る', 'Back')}</button>
  </div>`;
}

/** 自分で名前を付けていないデッキ（「デッキ1」「Deck 1」のまま）は言語に合わせて呼び替える */
function renameDefaultDecks() {
  let changed = false;
  (app.save.decks || []).forEach(d => {
    const m = /^(?:デッキ|Deck )(\d+)$/.exec(d.name || '');
    if (!m) return;
    const nm = L(`デッキ${m[1]}`, `Deck ${m[1]}`);
    if (nm !== d.name) { d.name = nm; changed = true; }
  });
  if (changed) writeSave(app.save);
}

/** 初回起動時：表示言語を選ぶ（どちらの言語でも読めるよう2言語で書く） */
function langOverlay() {
  return `<div class="overlay"><div class="modal langmodal">
    <h2>Language / 言語</h2>
    <p>Choose a language. You can change it later in Settings.<br>表示する言語を選んでください。あとから設定で変えられます。</p>
    <div class="langpick big">
      <button class="btn primary" data-picklang="ja">日本語</button>
      <button class="btn primary" data-picklang="en">English</button>
    </div>
  </div></div>`;
}

// ============================================================
// 引き継ぎコード（セーブデータを文字列にして別の端末・別のURLへ移す）
//   保存先はURL（オリジン）ごとに分かれているので、公開先を変えたときや
//   機種変更のときはこれで持っていく。
//   TE1: … deflate圧縮してBase64 ／ TE0: … 圧縮できない環境向けにそのままBase64
// ============================================================
function b64encode(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64decode(str) {
  const s = atob(str);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
async function pipeBytes(u8, stream) {
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());
}
async function makeTransferCode() {
  const bytes = new TextEncoder().encode(JSON.stringify(app.save));
  if (typeof CompressionStream === 'function') {
    return 'TE1:' + b64encode(await pipeBytes(bytes, new CompressionStream('deflate-raw')));
  }
  return 'TE0:' + b64encode(bytes);
}
async function readTransferCode(code) {
  const s = String(code || '').replace(/\s+/g, '');
  const tag = s.slice(0, 4);
  let bytes = b64decode(s.slice(4));
  if (tag === 'TE1:') bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
  else if (tag !== 'TE0:') throw new Error('unknown code');
  const obj = JSON.parse(new TextDecoder().decode(bytes));
  if (!obj || typeof obj !== 'object' || !obj.collection || !obj.deck) throw new Error('not a save');
  return obj;
}

/** 初回起動時：名前とアバターを決める */
function onboardingOverlay() {
  const draft = app.onboard || (app.onboard = { name: '', avatar: 1 });
  const avatars = AVATARS.map(a => `
    <button class="avpick ${draft.avatar === a.id ? 'on' : ''}" data-obavatar="${a.id}">
      <div class="avimg">${avatarHtml(a.id)}</div>
    </button>`).join('');
  return `<div class="overlay"><div class="modal" style="max-width:800px">
    <h2>${L('ようこそ、三属の戦記へ', 'Welcome to TRI-ELEMENTS')}</h2>
    <p>${L('あなたの名前とアバターを決めてください。<br>あとから設定でいつでも変えられます。', 'Choose your name and avatar.<br>You can change them anytime in Settings.')}</p>
    <div class="setrow" style="justify-content:center">
      <label>${L('名前', 'Name')}</label>
      <input class="tinput" type="text" maxlength="12" placeholder="${L('名前を入力', 'Enter your name')}" value="${esc(draft.name)}" data-obname>
    </div>
    <div class="avgrid" style="margin:14px 0">${avatars}</div>
    <div class="row-btn"><button class="btn primary" data-obstart>${L('冒険をはじめる', 'Start your adventure')}</button></div>
  </div></div>`;
}

// ============================================================
// バトル
// ============================================================
function pileHtml(kind, n, side) {
  return `<div class="pile ${kind === 'grave' ? 'grave' : ''} ${n ? '' : 'empty'}"
      ${kind === 'grave' ? `data-grave="${side}"` : ''}>
    <div class="stack"><i></i>${n > 1 ? '<i></i>' : ''}${n > 6 ? '<i></i>' : ''}</div>
    <div>${kind === 'grave' ? L('墓地', 'Grave') : L('山札', 'Deck')} <span class="n">${n}</span></div>
  </div>`;
}

/** 墓地から選ぶ必要があるカードなら、選べる墓地の位置を返す */
function graveChoices(g, handIndex) {
  const id = g.players[0].hand[handIndex];
  const c = id ? card(id) : null;
  if (!c || c.type !== 'support') return null;
  const e = c.effects.find(x => x.op === 'revive' || x.op === 'recallSupport' || x.op === 'recallMonster');
  if (!e) return null;
  const grave = g.players[0].grave;
  const idx = grave.map((gid, i) => {
    if (e.op === 'revive') return (isMonster(gid) && card(gid).cost <= e.maxCost) ? i : null;
    if (e.op === 'recallMonster') return isMonster(gid) ? i : null;
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
    ? `<div class="ip-kw">${c.keywords.map(k => `<b>${kwb(KEYWORDS[k].name)}</b>${esc(KEYWORDS[k].desc)}`).join('<br>')}</div>`
    : '';
  return `<div class="ip-entry ${e.who === 1 ? 'foe' : 'mine'}">
    <div class="ip-banner">${L(`${esc(e.who === 1 ? (app.enemy?.name || '相手') : myName())} が${esc(e.verb)}`, `${esc(e.who === 1 ? (app.enemy?.name || 'Opponent') : myName())} ${esc(e.verb)}`)}</div>
    <div class="ip-row">
      ${cardHtml(c, {})}
      <div class="ip-side">
        <div class="ip-name">${esc(c.name)}</div>
        <div class="ip-meta">
          <span>${icon(c.element)}</span><span>${L('コスト', 'Cost')} ${c.cost}</span>
          ${c.type === 'monster' ? `<span class="atkc">${icon('atk')} ${c.atk}</span><span class="defc">${icon('def')} ${c.def}</span>` : `<span>${L('サポート', 'Support')}</span>`}
        </div>
        <div class="ip-text">${esc(c.text || L('効果はありません（バニラ）。', 'No effect (vanilla).'))}</div>
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
      <div class="ip-title">${L('直前に使われたカード', 'Recently played')}</div>
      ${app.playLog.slice(0, 2).map(playEntryHtml).join('')}
    </div>`;
  }
  const id = app.inspect;
  const c = id ? card(id) : null;
  if (!c) {
    return `<div class="ipanel empty">
      <div class="ip-title">${L('カード情報', 'Card info')}</div>
      <div class="ip-hint">${L('カードにカーソルを合わせると、ここに詳しい内容が出ます。', 'Hover over a card to see its details here.')}</div>
      <div class="ip-legend">
        <div><b class="atkc">${icon('atk')} ${L('攻撃モード', 'Attack Mode')}</b>${L('（縦置き）', ' (upright)')}<br>${L('殴れる。相手の攻撃モンスターとぶつかると弱い方が破壊。', 'Can attack. When two Attack Mode monsters clash, the weaker one is destroyed.')}</div>
        <div><b class="defc">${icon('def')} ${L('防御モード', 'Defense Mode')}</b>${L('（横置き）', ' (sideways)')}<br>${L(`攻撃できないが、${icon('def')}の分だけダメージを受け止める。`, `Can’t attack, but absorbs damage up to its ${icon('def')}.`)}</div>
        <div><b class="gold">${L('属性相性', 'Element advantage')}</b><br>${icon('fire')}→${icon('grass')}→${icon('water')}→${icon('fire')} ${L(`有利な属性で攻撃すると ${icon('atk')}+2。`, `Attacking with the advantaged element gives ${icon('atk')}+2.`)}</div>
      </div>
    </div>`;
  }
  const r = RARITY[c.rarity || 'common'];
  const kw = c.keywords?.length
    ? `<div class="ip-kw">${c.keywords.map(k => `<b>${kwb(KEYWORDS[k].name)}</b>${esc(KEYWORDS[k].desc)}`).join('<br>')}</div>`
    : '';
  return `<div class="ipanel">
    <div class="ip-card">${cardHtml(c, { cls: 'big' })}</div>
    <div class="ip-name">${esc(c.name)}</div>
    <div class="ip-meta">
      <span>${icon(c.element)} ${ELEMENTS[c.element].name}</span>
      <span>${L('コスト', 'Cost')} ${c.cost}</span>
      ${c.type === 'monster' ? `<span class="atkc">${icon('atk')} ${c.atk}</span><span class="defc">${icon('def')} ${c.def}</span>` : `<span>${L('サポート', 'Support')}</span>`}
      <span style="color:${r.color}">${r.name}</span>
    </div>
    <div class="ip-text">${esc(c.text || L('このカードに効果はありません（バニラ）。', 'This card has no effect (vanilla).'))}</div>
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

// 指では「長押し」でカードの詳細（中央のウィンドウ）を見られる。タップは出し入れ・攻撃に使うため。
// ブラウザ標準の contextmenu（長押しメニュー）任せだと端末によって遅く感じるので、
// 自前の短いタイマーで判定する。手札を掴む保持タイマー(TOUCH_HOLD_MS)より
// 短くして先に発動させ、動いていなければ掴む構えのほうは解除する。
const CARD_VIEW_HOLD_MS = 180;
let viewHoldTimer = null, viewHoldEl = null, viewHoldX = 0, viewHoldY = 0;
function clearViewHold() { clearTimeout(viewHoldTimer); viewHoldTimer = null; viewHoldEl = null; }
document.addEventListener('pointerdown', ev => {
  if (app.screen !== 'battle' || ev.pointerType !== 'touch') return;
  const el = ev.target.closest('[data-card]');
  if (!el || !el.dataset.card) return;
  viewHoldEl = el; viewHoldX = ev.clientX; viewHoldY = ev.clientY;
  clearTimeout(viewHoldTimer);
  viewHoldTimer = setTimeout(() => {
    viewHoldTimer = null;
    clearTimeout(app.dragHold);
    if (app.drag && !app.drag.moved) app.drag = null;
    clearPeek();
    app.detail = viewHoldEl.dataset.card;
    render();
  }, CARD_VIEW_HOLD_MS);
});
document.addEventListener('pointermove', ev => {
  if (!viewHoldTimer) return;
  if (Math.hypot(ev.clientX - viewHoldX, ev.clientY - viewHoldY) > TOUCH_SLOP) clearViewHold();
});
document.addEventListener('pointerup', clearViewHold);
document.addEventListener('pointercancel', clearViewHold);

// 上のタイマーより先に端末側の長押しメニューが出てしまった場合の保険。
// 表示先は同じ中央のカード詳細ウィンドウにする（前は左のログ欄が開いていた）。
document.addEventListener('contextmenu', ev => {
  if (app.screen !== 'battle') return;
  const el = ev.target.closest('[data-card]');
  if (!el || !el.dataset.card) return;
  ev.preventDefault();
  clearViewHold();
  app.detail = el.dataset.card;
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
  // 置ける場所・対象にできる相手を光らせる。
  // ドラッグ中だけでなく、タップで選んでいる最中も同じ見せ方にする
  let dropMonster = [], dropSelf = [], dropEnemy = [];
  const picking = app.drag && app.drag.from === 'hand' ? app.drag.index
    : app.sel && (app.sel.kind === 'place' || app.sel.kind === 'target') ? app.sel.hand : null;
  if (picking != null) {
    const id = me.hand[picking];
    if (id && isMonster(id)) {
      dropMonster = me.field.map((_, i) => i).filter(i => canSummonAt(g, 0, picking, i));
    } else if (id) {
      const t = supportTargetSlots(g, picking);
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

  // コストの玉は、相手と見比べられるよう両者とも同じ数だけ並べる。
  // ただし自分の最大を超えたぶんは「そもそも無い枠」として薄く描く。
  // これをしないと、相手の最大コストが自分より多いあいだ、
  // こちらは満タンでも玉が余って見え、回復し損ねたように見えてしまう。
  const maxPips = Math.max(op.maxCost, me.maxCost, 1);
  const pips = (cur, max) => Array.from({ length: maxPips }, (_, i) =>
    `<div class="pip ${i < cur ? 'on' : ''} ${i >= max ? 'ghost' : ''}"></div>`).join('');
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
  // 相手がガード無しで直接攻撃を通せる時、盤面中央の小さなボタンだけでなく
  // 相手の顔まわり(名前・ライフ)をタップしても直接攻撃できるようにする。
  // プレイヤーは自然に相手を狙ってタップしてくるため、その直感の方を拾う。
  const faceAttr = faceTargetable ? 'data-attackface' : '';
  const faceCls = faceTargetable ? 'atk-ready' : '';
  const enemyBar = portrait ? `
    <div class="bar enemybar">
      <div class="atktarget ${faceCls}" ${faceAttr}>
        <div class="face">${foeFace}</div>
        <div class="foeinfo">
          <span class="pname">${esc(op.name)}</span>
          ${foeLife}
          <div class="foesub"><div class="costpips">${pips(op.cost, op.maxCost)}</div><span class="meta">${L('手札', 'Hand')} <b>${op.hand.length}</b></span></div>
        </div>
      </div>
      <div class="battle-actions">
        <button class="btn tiny paneltab ${drawer === 'info' ? 'on' : ''}" data-toggle-info>${icon('info')}<small>${L('情報', 'Info')}</small></button>
        <button class="btn tiny paneltab ${drawer === 'log' ? 'on' : ''}" data-toggle-log>${icon('rules')}<small>${L('ログ', 'Log')}</small></button>
        <button class="btn tiny paneltab quit" data-surrender>${icon('surrender')}<small>${L('投了', 'Surrender')}</small></button>
      </div>
    </div>` : `
    <div class="bar enemybar">
      <div class="atktarget ${faceCls}" ${faceAttr}>
        <div class="who"><div class="face">${foeFace}</div><span class="pname">${esc(op.name)}</span></div>
        ${foeLife}
        <div class="costpips">${pips(op.cost, op.maxCost)}</div>
        <span class="meta">${L('手札', 'Hand')} <b>${op.hand.length}</b></span>
      </div>
      <div class="battle-actions">
        <button class="btn tiny" data-toggle-log>${app.logOpen ? L('ログ非表示', 'Hide log') : L('ログ', 'Log')}</button>
        <button class="btn tiny" data-surrender>${L('投了', 'Surrender')}</button>
      </div>
    </div>`;

  // portrait は最初から付けておく。
  // 後から付けると、いったん横向き用の大きさで組まれてから縦向き用に
  // 変わることになり、枠やボタンが「拡大してから縮む」動きをしてしまう。
  return `<div class="battle ${portrait ? 'portrait' : ''}" ${bg ? `style="--bgimg:url(${bg})"` : ''}>
    ${enemyBar}

    <div class="mid">
      ${portrait && drawer ? '<div class="drawerback" data-closedrawer></div>' : ''}
      ${infoOpen ? `<div class="sidecol left" data-inspectpanel>${inspectPanelHtml()}</div>` : ''}

      <div class="field">
        <div class="row">${pileHtml('grave', op.grave.length, 1)}${supRow(op)}${pileHtml('deck', op.deck.length, 1)}</div>
        <div class="row">${enemyMon}</div>
        <div class="center">
          <span class="turnlabel">${L('ターン', 'Turn')} ${g.turn}　${g.active === 0 ? L('あなたの番', 'Your turn') : L('相手の番', 'Opponent’s turn')}</span>
          ${faceTargetable ? `<button class="btn danger small" data-attackface>${L('▶ 直接攻撃！', '▶ Direct Attack!')}</button>` : ''}
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
      <div class="costpips">${pips(me.cost, me.maxCost)}</div>
      <span class="meta">${L('コスト', 'Cost')} <b>${me.cost}/${me.maxCost}</b></span>
      <div class="battle-actions">
        ${discardMode ? `<span class="hint" style="color:var(--gold)">${L('手札が多すぎます。捨てるカードを選んでください', 'Too many cards. Choose one to discard')}</span>` : ''}
        ${app.sel ? `<button class="btn small" data-cancel>${L('選択解除', 'Deselect')}</button>` : ''}
        <button class="btn small" data-forge ${myTurn && g.phase === 'main' && canForge(g, 0) ? '' : 'disabled'}
          title="${L('余ったコストでカードを1枚引く', 'Spend leftover cost to draw 1 card')}">${icon('forge')} ${L('鍛錬', 'Forge')} <small>${L(`${g.rules.forgeCost}コストで1枚引く`, `${g.rules.forgeCost} cost: draw 1`)}</small></button>
        <button class="btn primary" data-endturn ${myTurn && g.phase === 'main' ? '' : 'disabled'}>${L('ターン終了', 'End Turn')}</button>
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
      ${victim ? `<div class="tip warn">${L(`${esc(card(victim.id).name)} を墓地へ送って入れ替え<br>コスト ${cost}（+${g.rules.replaceSummonCost}）`, `Replace ${esc(card(victim.id).name)} (sent to the graveyard)<br>Cost ${cost} (+${g.rules.replaceSummonCost})`)}</div>` : ''}
      <button class="mp-atk" data-summon="attack">${icon('atk')} ${L('攻撃モード', 'Attack Mode')} <b>${c.atk}</b></button>
      <button class="mp-def" data-summon="defense">${icon('def')} ${L('防御モード', 'Defense Mode')} <b>${c.def}</b></button>
      <div class="tip">${L(`攻撃モードは縦置き・殴れる／防御モードは横置き・${icon('def')}の分だけダメージを受け止める`, `Attack Mode: upright, can attack. Defense Mode: sideways, absorbs damage up to its ${icon('def')}.`)}</div>
    </div>`;
  }
  if (p.type === 'own') {
    const g = app.game, m = g.players[0].field[p.slot];
    if (!m) return '';
    const acts = [];
    if (canAttack(g, 0, p.slot) && app.phase === 'play' && g.active === 0)
      acts.push(`<button data-act="attack">${icon('atk')} ${L('攻撃する', 'Attack')}</button>`);
    if (canChangeMode(g, 0, p.slot) && app.phase === 'play' && g.active === 0)
      acts.push(`<button data-act="mode">${icon('modeswitch')} ${m.mode === 'attack' ? L('防御モードへ', 'To Defense Mode') : L('攻撃モードへ', 'To Attack Mode')}</button>`);
    acts.push(`<button data-act="detail">${icon('info')} ${L('カードを見る', 'View card')}</button>`);
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
    <h2>${L('初期手札', 'Opening hand')}</h2>
    <p>${L('この手札で始めますか？　1回だけ引き直せます。', 'Start with this hand? You can redraw once.')}<br>
      <span style="color:#9fb2c8">${L('低コストのカードが無いと序盤に動けません。', 'Without low-cost cards, you can’t do much early on.')}</span></p>
    <div class="mull-hand">${hand}</div>
    <div class="row-btn">
      <button class="btn primary" data-mulligan="keep">${L('この手札で戦う', 'Keep this hand')}</button>
      <button class="btn" data-mulligan="redraw">${L('引き直す（1回だけ）', 'Redraw (once)')}</button>
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
        <div class="bs-desc">${L('ライフ', 'Life')} ${app.game.players[0].life}</div>
      </div>
      <div class="bs-vslabel">VS</div>
      <div class="bs-side">
        <div class="bs-face">${(() => {
          const src = ENEMY_ART[`${AREAS[app.areaIndex].id}:${Number(app.enemyKey.split(':')[1])}`];
          return src ? `<img src="${src}" alt="">` : e.icon;
        })()}</div>
        <div class="bs-name">${esc(e.name)}</div>
        <div class="bs-desc">${esc(e.desc)}<br>${L('ライフ', 'Life')} ${app.game.players[1].life}${e.startCost ? L(` ／ 開始コスト ${e.startCost}`, ` / Starts at ${e.startCost} cost`) : ''}</div>
      </div>
    </div>
    <button class="btn primary" data-startbattle>${L('戦闘開始', 'Start battle')}</button>
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
      ? `<button class="zoom-open" data-artzoom="${esc(c.id)}">${icon('info')} ${L('イラストを拡大', 'Enlarge art')}</button>`
      : `<div class="zoom-locked">${icon('lock')} ${L('入手するとイラストを拡大できます', 'Get this card to enlarge its art')}</div>`;
  return `<div class="overlay" data-closedetail><div class="modal">
    ${detailHtml(c, extra, { zoomable })}
    <div class="row-btn"><button class="btn" data-closedetail>${L('閉じる', 'Close')}</button></div>
  </div></div>`;
}

function observeOverlay() {
  const choice = app.game?.pendingChoice;
  if (!choice || choice.type !== 'observe' || choice.pi !== 0) return '';
  const cards = choice.cards.map((id, i) =>
    `<button class="observe-card" data-observe="${i}">${cardHtml(card(id), { cls: 'big selectable' })}</button>`).join('');
  return `<div class="overlay"><div class="modal observe-modal">
    <h2>${kwb(KEYWORDS.observe.name)}</h2>
    <p>${L('山札の上から見えたカードです。手札に加える1枚を選んでください。', 'These are the top cards of your deck. Choose 1 to add to your hand.')}<br>
      <span style="color:#9fb2c8">${L('残りは山札の底へ戻ります。', 'The rest go to the bottom of your deck.')}</span></p>
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
    <div class="artzoom-modal" role="dialog" aria-modal="true" aria-label="${L(`${esc(c.name)}のイラスト`, `${esc(c.name)} art`)}">
      <button class="artzoom-close" data-closeartzoom aria-label="${L('拡大表示を閉じる', 'Close')}">×</button>
      <div class="artzoom-name">${esc(c.name)}</div>
      <div class="artzoom-stage ${c.element}">${art}</div>
      <div class="artzoom-hint">${L('画面をクリック、または Esc で閉じる', 'Click anywhere or press Esc to close')}</div>
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
    <p>${L('墓地から1枚選んでください。', 'Choose 1 card from your graveyard.')}</p>
    <div class="grid" style="margin:12px 0">${cards}</div>
    <div class="row-btn"><button class="btn" data-cancelgrave>${L('やめる', 'Cancel')}</button></div>
  </div></div>`;
}

function graveOverlay() {
  const p = app.game.players[app.graveView];
  const cards = p.grave.map(id => cardHtml(card(id), { cls: 'selectable' })).join('');
  return `<div class="overlay" data-closegrave><div class="modal">
    <h2>${L(`${app.graveView === 0 ? esc(myName()) : esc(p.name)}の墓地（${p.grave.length}枚）`, `${app.graveView === 0 ? esc(myName()) : esc(p.name)}’s graveyard (${p.grave.length})`)}</h2>
    <div class="grid" style="max-width:760px;margin:10px 0">${cards || `<p>${L('まだ何もありません。', 'Nothing here yet.')}</p>`}</div>
    <div class="row-btn"><button class="btn" data-closegrave>${L('閉じる', 'Close')}</button></div>
  </div></div>`;
}

/**
 * やり込んでくれた人へのお礼（2026-09-12）。初めてキャラカードを取ったとき／ラスボスを初めて倒したときに1回ずつ。
 * 遊んでいる人には連絡できない（匿名）ので、向こうから声をかけてもらう入口を、いちばん楽しんでいる瞬間に置く。
 */
const FEEDBACK = {
  x: text => `https://x.com/intent/post?text=${encodeURIComponent(text)}`,
  itch: 'https://chicken-ball.itch.io/tri-elements',
};
function thanksHtml(kind) {
  const head = kind === 'final'
    ? L('星辰王を倒しました。ここまで遊んでくれて、本当にありがとうございます！', 'You defeated the Star King. Thank you so much for playing all the way here!')
    : L('キャラクターカード、おめでとうございます！ここまでやり込んでくれて、本当にありがとうございます！', 'Congratulations on your character card — thank you so much for playing this deep!');
  const tweet = L('「TRI-ELEMENTS 三属の戦記」遊びました！\n\n\n@ChickenBallgame #TRIELEMENTS', 'I played TRI-ELEMENTS!\n\n\n@ChickenBallgame #TRIELEMENTS');
  return `<div class="thanks">
    <div class="thanks-head">${head}</div>
    <p>${L('このゲームは個人で作っています。感想や「ここが難しかった」「このカードが好き」など、ひとことでも聞かせてもらえると、とてもうれしいです。',
      'This game is made by a solo indie developer. A few words — what you liked, what felt too hard, your favorite card — would make my day.')}</p>
    <div class="row-btn">
      <a class="btn" href="${FEEDBACK.x(tweet)}" target="_blank" rel="noopener" data-feedback="x">${L('X で感想を送る', 'Share on X')}</a>
      <a class="btn" href="${FEEDBACK.itch}" target="_blank" rel="noopener" data-feedback="itch">${L('itch.io にコメントする', 'Comment on itch.io')}</a>
    </div>
  </div>`;
}

function resultOverlay() {
  const r = app.result;
  return `<div class="overlay"><div class="modal">
    <h2 style="font-size:30px">${r.win ? L('勝利！', 'Victory!') : L('敗北…', 'Defeat…')}</h2>
    <p>${esc(r.reason)}</p>
    ${r.reward ? `<p style="color:var(--gold);font-size:15px">${L(`報酬: ${PACK_TYPES[r.reward].name} を1つ獲得！`, `Reward: 1 ${PACK_TYPES[r.reward].name}!`)}</p>` : ''}
    ${r.dust ? `<p style="color:var(--gold);font-size:15px">${L(`星屑 ${icon('stardust')}${r.dust} を獲得！（所持 ${icon('stardust')}${app.save.stardust}）`, `Got ${icon('stardust')}${r.dust} Stardust! (Total ${icon('stardust')}${app.save.stardust})`)}</p>` : ''}
    ${r.unlocked ? `<p style="color:#8fe0a8">${L(`「${esc(r.unlocked)}」が解放されました！`, `${esc(r.unlocked)} unlocked!`)}</p>` : ''}
    ${r.charCard ? `<div class="charget">
      <div class="charget-label">${icon('stardust')} ${L('キャラクターカードを入手', 'Character card get!')} ${icon('stardust')}</div>
      ${cardHtml(card(r.charCard), { cls: 'big' })}
      <div class="charget-name">${esc(card(r.charCard).name)}</div>
    </div>` : ''}
    ${r.charLeft ? `<p style="color:#c58cff;font-size:14px">${L(`「極」であと <b>${r.charLeft}</b> 回倒すと、このキャラのカードが手に入ります`, `Beat them <b>${r.charLeft}</b> more times on Extreme to get their character card`)}</p>` : ''}
    ${r.thanks ? thanksHtml(r.thanks) : ''}
    ${r.draft ? `<div class="dr-resline">${draftPipsHtml(app.save.draft)}<p>${L(`選定の儀：${r.draft.wins}勝 ${r.draft.losses}敗（${r.draft.played}/${DRAFT_BATTLES}戦）`, `Rite of Choosing: ${r.draft.wins}W ${r.draft.losses}L (${r.draft.played}/${DRAFT_BATTLES})`)}</p></div>` : ''}
    ${r.draft ? `<div class="row-btn"><button class="btn primary" data-go="draft">${r.draft.played >= DRAFT_BATTLES ? L('結果を見る', 'See results') : L('次の対戦へ', 'Next battle')}</button></div>` : `<div class="row-btn">
      <button class="btn primary" data-go="${r.free ? 'free' : 'adventure'}">${r.free ? L('フリーバトルへ戻る', 'Back to Free Battle') : L('冒険へ戻る', 'Back to Adventure')}</button>
      <button class="btn" data-rematch>${L('もう一度', 'Rematch')}</button>
    </div>`}
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
    <h2>${L('パック開封！', 'Pack opened!')}</h2>
    <div class="grid packgrid" style="margin:14px 0">${cards}</div>
    <button class="btn primary" data-closepack>${L('受け取る', 'Collect')}</button>
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
  // 縦長でなくても、横幅自体が狭いと「ワイド」用の左右パネル(固定幅計246+270px)が
  // 盤面を押しつぶして見切れてしまう。アスペクト比だけでなく絶対幅でも判定する。
  if (window.innerWidth < 900) return 'portrait';
  return window.innerWidth / window.innerHeight < 0.95 ? 'portrait' : 'wide';
}

// スマホのブラウザは、画面に触れるたびに上下のバーが出入りして
// window.innerHeight が数十pxも変わる。そのたびに倍率を計算し直すと、
// カードを持ったりタップしたりするだけで盤面がびくっと動いてしまう。
// svh（バーが出ている状態＝いちばん狭いときの高さ）で測れば、
// バーの出入りに関係なく同じ値になるので、盤面はその場から動かない。
let vhProbe = null, vhFallback = null;
function stableHeight() {
  if (window.CSS && CSS.supports && CSS.supports('height', '100svh')) {
    if (!vhProbe) {
      vhProbe = document.createElement('div');
      vhProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
      document.body.appendChild(vhProbe);
    }
    const h = vhProbe.offsetHeight;
    if (h) return h;
  }
  // svh が使えないブラウザでは、最初に測った高さを使い続ける。
  // 幅が変わったとき（＝画面の向きが変わったとき）だけ測り直す。
  if (!vhFallback || vhFallback.w !== window.innerWidth) {
    vhFallback = { w: window.innerWidth, h: window.innerHeight };
  }
  return vhFallback.h;
}

// 盤面の大きさと位置は一度決めたら動かさない。
// 画面の高さを測り直すたびに計算し直していたため、
// ブラウザのバーが少しずつ動くのに合わせて盤面もじわじわ伸び縮みし、
// サポート枠やボタンが動いて見えていた。
// 測り直すのは、画面の向きが変わったとき（＝横幅が変わったとき）だけ。
let battleGeo = null;

function battleGeometry() {
  const VW = window.innerWidth;
  const mode = battleLayout();
  if (battleGeo && battleGeo.vw === VW && battleGeo.mode === mode) return battleGeo;
  const { w: DW, h: DH } = BATTLE_SIZE[mode];
  const VH = stableHeight();
  const s = Math.min(VW / DW, VH / DH);
  // 縦持ちは横幅で倍率が決まるため、縦が余ることが多い。
  // 余ったぶんは設計上の高さを伸ばして盤面に回す（画面をぴったり使い切る）。
  const h = mode === 'portrait' ? Math.min(DH * 1.5, VH / s) : DH;
  battleGeo = {
    vw: VW, mode, s, h,
    left: Math.max(0, (VW - DW * s) / 2),
    top: Math.max(0, (VH - h * s) / 2),
  };
  return battleGeo;
}

function applyBattleScale() {
  const el = document.querySelector('.battle');
  if (!el) return;
  const g = battleGeometry();
  el.classList.toggle('portrait', g.mode === 'portrait');
  el.style.height = `${g.h}px`;
  el.style.transform = `scale(${g.s})`;
  el.style.left = `${g.left}px`;
  el.style.top = `${g.top}px`;
}
let resizeTimer = 0;
window.addEventListener('resize', () => {
  // ここで測り直さない。スマホのバーが出入りするだけで何度も呼ばれるため。
  // 縦横が入れ替わったら組み直す（横のカラムが引き出しに変わるため）
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (app.screen === 'battle' && app.battleMode !== battleLayout()) { applyBattleScale(); render(); }
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
  // 手札の横スクロール位置。描き直すたびに先頭へ戻ると、
  // めくって見ていた場所を見失う。
  const handEl = document.querySelector('.battle .hand');
  const handLeft = handEl ? handEl.scrollLeft : 0;
  let html;
  switch (app.screen) {
    case 'adventure': html = renderAdventure(); break;
    case 'free': html = renderFree(); break;
    case 'draft': html = renderDraft(); break;
    case 'deck': html = renderDeck(); break;
    case 'collection': html = renderCollection(); break;
    case 'shop': html = renderShop(); break;
    case 'rules': html = renderRules(); break;
    case 'settings': html = renderSettings(); break;
    case 'battle': html = renderBattle() + popupHtml(); break;
    default: html = renderTitle();
  }
  html += bottomNavHtml();
  html += overlays();
  if (!app.langChosen) html += langOverlay();
  else if (!app.save.profile) html += onboardingOverlay();
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
    const nh = document.querySelector('.battle .hand');
    if (nh && handLeft) nh.scrollLeft = handLeft;
    const lp = document.querySelector('[data-logpane]');
    if (lp) lp.scrollTop = lp.scrollHeight;   // 常に最新のログを表示
  }
  if (app.packResult) startPackReveal();
}

// ============================================================
// バトル進行
// ============================================================
/**
 * @param opts.draft  2ピックの対戦。自分は2ピックで組んだ30枚、相手は save.draft.opp のドラフトデッキ。
 *                    顔と名前だけ冒険のライバルを借りる（強さは draft.opp.noise、ライフは20で揃える）
 */
function startBattle(areaIndex, enemyIndex, free = false, opts = {}) {
  // 勝敗の効果音がまだ鳴っている途中で「もう一度」を押した場合に備えて、
  // 鳴りかけの音を止め、下げたままのBGM音量を戻しておく
  Audio.stopSe();
  Audio.unduckBgm(0);
  const dr = opts.draft ? app.save.draft : null;
  // 複数スロットのせいで、30枚に満たないデッキを選んだまま挑めてしまわないように
  if (!dr && app.save.deck.length !== 30) {
    const d = app.save.decks[app.save.activeDeck];
    toast(L(`「${d ? d.name : 'デッキ'}」は${app.save.deck.length}枚です。30枚にしてください`, `“${d ? d.name : 'Deck'}” has ${app.save.deck.length} cards. It needs exactly 30`));
    return go('deck');
  }
  const area = AREAS[areaIndex];
  const enemy = dr
    ? { ...area.enemies[enemyIndex], deck: dr.opp.deck, noise: dr.opp.noise, life: 20, startCost: 0, profile: 'balanced',
        desc: L(`${pairName(dr.opp.pair)}のドラフトデッキ`, `${pairName(dr.opp.pair)} draft deck`) }
    : area.enemies[enemyIndex];
  const diff = free ? FREE_DIFFICULTY[app.freeDiff] : null;
  app.free = free ? { difficulty: app.freeDiff } : null;
  app.draftBattle = !!dr;
  app.areaIndex = areaIndex;
  app.enemy = enemy;
  app.enemyKey = `${area.id}:${enemyIndex}`;
  app.result = null; app.sel = null; app.popup = null; app.hint = ''; app.detail = null;
  const seed = (Math.random() * 1e9) | 0;
  // フリーバトルの「極」では、そのキャラ自身のカードを1枚だけ持ってくる。
  // 狙っているカードを手に入れる前に見られる、という導線でもある。
  // 枚数を増やすと同じキャラが場に並んでしまうので、枚数は1枚のまま
  // 「必ず初手にある」ことを保証して、毎試合ちょうど1回出てくるようにする。
  let foeDeck = [...enemy.deck], foeSig = null;
  const selfCard = CHARACTER_OF[app.enemyKey];
  if (free && app.freeDiff === 'extreme' && selfCard) {
    foeDeck = [...Array(EXTREME_SELF_COPIES).fill(selfCard), ...foeDeck.slice(EXTREME_SELF_COPIES)];
    foeSig = selfCard;
  }
  app.game = createGame({
    decks: [[...(dr ? dr.picks : app.save.deck)], foeDeck],
    seed, names: [myName(), enemy.name],
    startCost: [0, (enemy.startCost || 0) + (diff ? diff.cost : 0)],
    signature: [null, foeSig],
  });
  app.game.players[1].life = (enemy.life || 20) + (diff ? diff.life : 0);
  app.enemyLifeMax = app.game.players[1].life;
  app.battleT0 = Date.now();
  track('start', { k: app.enemyKey, f: free ? 1 : 0, df: free ? app.freeDiff : undefined, dr: dr ? 1 : undefined });
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
  Fx.fxBanner(app.game.active === 0 ? L('あなたのターン', 'Your Turn') : L(`${esc(app.enemy.name)} のターン`, `${esc(app.enemy.name)}’s Turn`), '', 750);
  if (app.game.active === 1) scheduleAi();
}

let lastBannerTurn = 0;
function maybeTurnBanner() {
  const g = app.game;
  if (!g || g.winner !== null || app.phase !== 'play') return;
  if (g.turn === lastBannerTurn) return;
  lastBannerTurn = g.turn;
  Audio.playSe('se_turn');
  Fx.fxBanner(g.active === 0 ? L('あなたのターン', 'Your Turn') : L(`${esc(app.enemy?.name || '相手')} のターン`, `${esc(app.enemy?.name || 'Opponent')}’s Turn`),
    L(`ターン ${g.turn}`, `Turn ${g.turn}`), 700);
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
  if (supCard) pushPlay(supCard.id, supCard.equip ? L('装備した', 'equipped') : L('発動した', 'played'), pi);
  else if (sumCard) pushPlay(sumCard.id, L('召喚した', 'summoned'), pi);

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
      if (hasKw(attacker, 'pierce') && action.target !== 'face') kws.push([KEYWORDS.pierce.name, '#ff9a6b']);
      if (hasKw(attacker, 'double')) kws.push([KEYWORDS.double.name, '#e79aff']);
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
    render();
    // 手札上限オーバーで捨てている間に手番が実際に切り替わることがある。
    // ここでも見ておかないと、次に自分が何か操作するまでバナーが出ず、
    // 「行動した後に急にターンバナーが出る」という変なタイミングになる
    maybeTurnBanner();
    return scheduleAi();
  }
  // 「極」はミスをしない全力のAIにする（キャラごとのnoiseは弱め設定なので上書き）
  const aiNoise = app.free?.difficulty === 'extreme' ? 0 : (app.enemy?.noise || 0);
  const act = aiChooseAction(g, 1, { noise: aiNoise, profile: app.enemy?.profile || 'balanced' });
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

/** お礼の欄は種類ごとに1回だけ。出したらセーブに印を付ける（writeSave は呼び出し側で） */
function takeThanks(kind) {
  app.save.thanked = app.save.thanked || {};
  if (app.save.thanked[kind]) return null;
  app.save.thanked[kind] = true;
  return kind;
}

function finishGame() {
  const g = app.game;
  if (!g || g.winner === null || app.result) return;
  const win = g.winner === 0;
  let reward = null, unlocked = null, dust = 0, firstClear = false;

  if (app.draftBattle) {
    // 2ピック：勝ち負けを数えて次の相手を決める（冒険・フリーの戦績には入れない）
    const d = recordDraftBattle(win);
    trackBattleEnd(win ? 'w' : 'l');
    app.result = { win, reason: g.reason, draft: { wins: d.wins, losses: d.losses, played: d.played } };
    Audio.playSe(win ? 'se_win' : 'se_lose', { duckBgm: 0.14 });
    return render();
  }

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
    const thanks = charCard ? takeThanks('char') : null;
    writeSave(app.save);
    trackBattleEnd(win ? 'w' : 'l', { cc: charCard ? 1 : undefined });
    if (thanks) track('thanks', { k: thanks });
    app.result = { win, reason: g.reason, reward: null, unlocked: null, dust, free: true, charCard, charLeft, thanks };
    Audio.playSe(win ? 'se_win' : 'se_lose', { duckBgm: 0.14 });
    return render();
  }

  if (win) {
    app.save.stats.wins++;
    const key = app.enemyKey;
    app.save.clearCount = app.save.clearCount || {};
    const before = app.save.clearCount[key] || 0;
    app.save.clearCount[key] = before + 1;
    const first = !app.save.cleared[key];
    firstClear = first;
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
  // ラスボス（最後のエリアの最後の敵）を初めて倒したとき
  const lastArea = AREAS[AREAS.length - 1];
  const thanks = firstClear && app.enemyKey === `${lastArea.id}:${lastArea.enemies.length - 1}` ? takeThanks('final') : null;
  writeSave(app.save);
  trackBattleEnd(win ? 'w' : 'l', { fc: firstClear ? 1 : undefined });
  if (thanks) track('thanks', { k: thanks });
  app.result = { win, reason: g.reason, reward, unlocked, thanks };
  Audio.playSe(win ? 'se_win' : 'se_lose', { duckBgm: 0.14 });
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

/** 押さえている手札を前に出す（重なって隠れていても中身を確かめられる） */
function setPeek(el) {
  clearPeek();
  if (el) el.classList.add('peek');
}
function clearPeek() {
  document.querySelectorAll('.hand .card.peek').forEach(e => e.classList.remove('peek'));
}

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
  if (handCard) setPeek(handCard);
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
      clearPeek();
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
      || label.includes('戻る') || /^(閉じる|やめる|キャンセル|選択解除|投了)/.test(label)
      || /^(Back|Close|Cancel|Deselect|Surrender)\b/i.test(label);
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
  clearPeek();
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
  clearPeek();
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
        if (g.players[0].field[slot]) toast(L('コストが足りません（入れ替え召喚は+1コスト）', 'Not enough cost (replacing a monster costs +1)'));
      }
      render(); return;
    }
    // サポート
    const gc = graveChoices(g, d.index);
    if (gc) {
      if (!gc.indices.length) { toast(L('墓地に対象がありません', 'No valid target in your graveyard')); render(); return; }
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
        toast(L('そのカードは対象にできません', 'That card can’t be targeted'));
      } else toast(L('対象のモンスターにドロップしてください', 'Drop it on a target monster'));
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
      toast(L('【守護】がいるため、そのモンスターは攻撃できません', 'A [Guard] monster is in the way. You can’t attack that one'));
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
  if (d.length >= 30) { toast(L('デッキは30枚までです', 'A deck can have up to 30 cards')); return; }
  if (have >= Math.min(limit, own)) {
    toast(limit === 1 ? L('レジェンドは同名1枚までです', 'Only 1 copy of each Legend') : L('これ以上は入れられません（同名3枚・所持数まで）', 'Can’t add more (up to 3 copies, and only as many as you own)')); return;
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
    if (!(app.save.collection[zid] || 0)) return toast(L('まだ入手していないカードです', 'You don’t own this card yet'));
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
    toast(d.list.length === 30 ? L(`「${d.name}」で戦います`, `Using “${d.name}”`) : L(`「${d.name}」は${d.list.length}/30枚です`, `“${d.name}” has ${d.list.length}/30 cards`));
    return render();
  }

  // --- お礼の欄のリンク（外のページを開く。ここでは記録だけして、既定の動作は止めない）---
  const fb = hit('[data-feedback]');
  if (fb) { track('fb', { to: fb.dataset.feedback }); return; }

  // --- 2ピック ---
  const dp = hit('[data-draftpair]');
  if (dp) {
    app.save.draft = newDraft(dp.dataset.draftpair.split(','));
    app.draftQuitArm = 0;
    writeSave(app.save);
    track('draft', { st: 'start', pr: dp.dataset.draftpair });
    return render({ resetScroll: true });
  }
  const pk = hit('[data-draftpick]');
  if (pk && app.save.draft && app.save.draft.options) {
    const d = applyPick(app.save.draft, Number(pk.dataset.draftpick));
    // 30枚そろったら、1戦目の相手をここで決めて残す（読み込み直しで相手が変わらないように）
    if (draftPhase(d) === 'battle' && !d.opp) d.opp = draftOpponent(0, AREAS, Math.random, d.pair);
    writeSave(app.save);
    Audio.playSe('se_draw');
    return render({ resetScroll: true });
  }
  if (hit('[data-draftfight]')) return startDraftBattle();
  if (hit('[data-draftquit]')) {
    // 取り返しがつかないので2回押させる（投了と同じ作法）
    const now = Date.now();
    if (!app.draftQuitArm || now - app.draftQuitArm > 5000) { app.draftQuitArm = now; return render(); }
    app.draftQuitArm = 0;
    track('draft', { st: 'quit', w: app.save.draft ? app.save.draft.wins : 0, n: app.save.draft ? app.save.draft.picks.length : 0 });
    app.save.draft = null;
    writeSave(app.save);
    return render({ resetScroll: true });
  }
  if (hit('[data-draftclaim]')) {
    const d = app.save.draft;
    if (!d) return;
    const rw = draftReward(d.wins);
    app.save.stardust = (app.save.stardust || 0) + rw.dust;
    if (rw.prism) app.save.packs.prism = (app.save.packs.prism || 0) + 1;
    const st = app.save.draftStats || { runs: 0, best: 0, wins: 0 };
    st.runs++; st.best = Math.max(st.best, d.wins); st.wins = (st.wins || 0) + d.wins;
    app.save.draftStats = st;
    track('draft', { st: 'done', w: d.wins, pr: d.pair.join(',') });
    app.save.draft = null;
    writeSave(app.save);
    Audio.playSe(rw.prism ? 'se_rare' : 'se_confirm');
    notice(rw.prism
      ? L('プリズムパックは、冒険の画面で開けられます', 'Open your Prism Pack from the Adventure screen')
      : L(`星屑 ${rw.dust} を受け取りました`, `Received ${rw.dust} Stardust`), 2600);
    return render({ resetScroll: true });
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
    if (!item || !shopUnlocked(app.save, item) || (app.save.stardust || 0) < item.cost) return;
    app.save.stardust -= item.cost;
    app.packResult = openPack(item.pack);
    addCards(app.save, app.packResult); writeSave(app.save);
    track('pack', { p: item.pack, shop: 1 });
    return render();
  }
  if (hit('[data-openpack]')) {
    const k = hit('[data-openpack]').dataset.openpack;
    if ((app.save.packs[k] || 0) <= 0) return;
    app.save.packs[k]--;
    app.packResult = openPack(k);
    addCards(app.save, app.packResult); writeSave(app.save);
    track('pack', { p: k });
    return render();
  }
  if (hit('[data-closepack]')) { app.packResult = null; app.packRevealing = false; app.packRevealed = 0; return render(); }
  if (hit('[data-rematch]')) {
    const [a, e] = app.enemyKey.split(':');
    const ai = AREAS.findIndex(x => x.id === a);
    return startBattle(ai, Number(e), !!app.free);
  }

  // --- 言語 ---
  const pl = hit('[data-picklang]');
  if (pl) {
    setLang(pl.dataset.picklang); applyDocLang(); renameDefaultDecks(); app.langChosen = true;
    track('lang', { l: pl.dataset.picklang });
    return render();
  }
  const sl = hit('[data-setlang]');
  if (sl) { setLang(sl.dataset.setlang); applyDocLang(); renameDefaultDecks(); return render(); }

  // --- 引き継ぎコード ---
  if (hit('[data-makecode]')) {
    makeTransferCode().then(code => { app.transferCode = code; render(); })
      .catch(() => toast(L('コードを作れませんでした', 'Could not create a code')));
    return;
  }
  if (hit('[data-copycode]')) {
    const box = document.querySelector('[data-codeout]');
    const fallback = () => {
      if (box) { box.focus(); box.select(); }
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { /* 使えない環境もある */ }
      toast(ok ? L('コピーしました', 'Copied') : L('コードを長押ししてコピーしてください', 'Press and hold the code to copy it'));
    };
    if (navigator.clipboard && app.transferCode) {
      navigator.clipboard.writeText(app.transferCode).then(() => toast(L('コピーしました', 'Copied')), fallback);
    } else fallback();
    return;
  }
  if (hit('[data-loadcode]')) {
    const code = (document.querySelector('[data-codein]')?.value || app.codeIn || '').trim();
    if (!code) return toast(L('コードを貼り付けてください', 'Paste a code first'));
    // 上書きなので2回押させる（投了・デッキ切り替えと同じ作法）
    const now = Date.now();
    if (!app.loadArm || now - app.loadArm > 6000) {
      app.loadArm = now;
      return toast(L('もう一度押すと、今のデータを上書きして読み込みます', 'Press again to overwrite your current save'), 2600);
    }
    app.loadArm = 0;
    readTransferCode(code).then(obj => {
      writeSave(obj);
      app.save = loadSave();
      app.codeIn = ''; app.transferCode = '';
      toast(L('データを読み込みました', 'Save loaded'));
      render();
    }).catch(() => toast(L('コードが正しくありません', 'That code is not valid'), 2400));
    return;
  }

  // --- 設定 ---
  if (t.matches('[data-mute]')) { Audio.setMuted(t.checked); return; }
  if (t.matches('[data-stats]')) {
    if (!t.checked) track('optout');
    setStatsEnabled(t.checked);
    return;
  }
  const st = hit('[data-settab]');
  if (st) { app.settingsTab = st.dataset.settab; return render(); }
  const av = hit('[data-avatar]');
  if (av) {
    app.save.profile = { ...(app.save.profile || { name: L('あなた', 'You') }), avatar: Number(av.dataset.avatar) };
    writeSave(app.save); return render();
  }
  // --- 初回の名前入力 ---
  const oba = hit('[data-obavatar]');
  if (oba) { app.onboard.avatar = Number(oba.dataset.obavatar); return render(); }
  if (hit('[data-obstart]')) {
    const nm = (document.querySelector('[data-obname]')?.value || '').trim();
    app.save.profile = { name: nm || L('名もなき挑戦者', 'Nameless Challenger'), avatar: app.onboard.avatar };
    writeSave(app.save); app.onboard = null; toast(L('ようこそ！', 'Welcome!')); return render();
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
      if (app.save.decks.length >= MAX_DECKS) return toast(L(`デッキは${MAX_DECKS}個までです`, `You can have up to ${MAX_DECKS} decks`));
      app.save.decks.push({ name: L(`デッキ${app.save.decks.length + 1}`, `Deck ${app.save.decks.length + 1}`), list: [] });
      app.pendingSlot = null;
      app.save.activeDeck = app.save.decks.length - 1;
      app.save.deck = [];
      app.deckDraft = [];
      writeSave(app.save);
      Audio.playSe('se_click');
      return render();
    }
    if (hit('[data-deckdel]')) {
      if (app.save.decks.length <= 1) return toast(L('デッキは1つ以上必要です', 'You need at least 1 deck'));
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
      toast(L(`「${app.save.decks[app.save.activeDeck].name}」を保存しました`, `Saved “${app.save.decks[app.save.activeDeck].name}”`));
      return render();
    }
    if (hit('[data-resetdeck]')) { app.deckDraft = [...STARTER_DECK]; return render(); }
    if (hit('[data-cleardeck]')) { app.deckDraft = []; return render(); }
  }

  // --- 図鑑・デッキ編集でカードをクリック → 詳細 ---
  if ((app.screen === 'collection' || app.screen === 'draft') && hit('[data-card]')) {
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
  if (hit('[data-surrender]')) {
    // 誤爆すると即敗北なので、2回押させる（デッキ切り替えと同じ作法）。
    // 端末によっては1回のタップが2つのクリックとして届くことがあるので、
    // 構えた直後すぐの2回目は「同じタップの誤検知」とみなして構え直しにする
    const now = Date.now();
    if (!app.quitArm || now - (app.quitArmAt || 0) < 300) {
      app.quitArm = true; app.quitArmAt = now;
      toast(L('もう一度押すと投了します', 'Press again to surrender'));
      setTimeout(() => { app.quitArm = false; }, 4000);
      return;
    }
    app.quitArm = false;
    clearTimeout(app.aiTimer);
    trackBattleEnd('q');
    if (app.draftBattle) { recordDraftBattle(false); app.draftBattle = false; return go('draft'); }
    return go(app.free ? 'free' : 'adventure');
  }
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
    if (act.dataset.act === 'attack') { app.sel = { kind: 'attack', slot: p.slot }; app.hint = L('攻撃する相手を選んでください', 'Choose a target to attack'); return render(); }
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
      if (!canSummon(g, 0, i)) { toast(L('今は出せません（コストが足りません）', 'Can’t summon now (not enough cost)')); return; }
      // どの枠に置くかで強さが変わる（【隊列】【旗】）。
      // 勝手に空き枠へ置かず、必ず自分で選んでもらう
      app.sel = { kind: 'place', hand: i };
      app.hint = L('どの枠に出しますか？　隣に誰がいるかで強さが変わります', 'Which slot? Some cards get stronger depending on their neighbors');
      return render();
    } else {
      if (!canPlaySupport(g, 0, i)) { toast(L('今は使えません', 'Can’t use that now')); return; }
      const gc = graveChoices(g, i);
      if (gc) {
        if (!gc.indices.length) { toast(L('墓地に対象がありません', 'No valid target in your graveyard')); return; }
        app.gravePick = { hand: i, indices: gc.indices };
        return render();
      }
      if (supportNeedsTarget(id)) {
        const t = supportTargetSlots(g, i);
        if (!t.self.length && !t.enemy.length) { toast(L('対象にできるモンスターがいません', 'No monster can be targeted')); return; }
        app.sel = { kind: 'target', hand: i };
        app.hint = L('効果をかける相手を選んでください', 'Choose a target for the effect');
        return render();
      }
      return actWithFx(0, { type: 'support', hand: i }).then(afterAction);
    }
    return;
  }

  // --- 置き場所を選んでいる最中 ---
  if (app.sel && app.sel.kind === 'place') {
    const slotEl = hit('[data-mslot]');
    if (slotEl) {
      const slot = Number(slotEl.dataset.mslot);
      if (!canSummonAt(g, 0, app.sel.hand, slot)) {
        toast(g.players[0].field[slot]
          ? L(`そこは埋まっています。入れ替えるにはコスト+1が必要です（あと${
              summonCostOf(g, 0, app.sel.hand, slot) - g.players[0].cost}足りません）`,
            `That slot is taken. Replacing costs +1 (you need ${summonCostOf(g, 0, app.sel.hand, slot) - g.players[0].cost} more)`)
          : L('そこには出せません', 'Can’t summon there'));
        return;
      }
      const hand = app.sel.hand;
      app.sel = null; app.hint = '';
      return openModePick(hand, slotEl);
    }
  }
  // --- サポートの対象を選んでいる最中 ---
  if (app.sel && app.sel.kind === 'target') {
    const mEl = hit('.mini');
    if (mEl) {
      const side = Number(mEl.dataset.side), slot = Number(mEl.dataset.slot);
      const t = supportTargetSlots(g, app.sel.hand);
      if (!(side === 0 ? t.self : t.enemy).includes(slot)) {
        toast(L('そのモンスターは対象にできません', 'That monster can’t be targeted')); return;
      }
      const hand = app.sel.hand;
      app.sel = null; app.hint = '';
      return actWithFx(0, { type: 'support', hand, target: { slot } }).then(afterAction);
    }
  }

  // --- 盤面 ---
  const mini = hit('.mini');
  if (mini) {
    const side = Number(mini.dataset.side), slot = Number(mini.dataset.slot);
    if (side === 1) {
      if (app.sel && app.sel.kind === 'attack') {
        const legal = legalAttackTargets(g, 0, app.sel.slot);
        if (!legal.includes(slot)) { toast(L('【守護】がいるため攻撃できません', 'A [Guard] monster is in the way')); return; }
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
    app.save.profile = { ...(app.save.profile || { avatar: 1 }), name: v || L('あなた', 'You') };
    writeSave(app.save);
  }
  // 再描画（トーストなど）で貼り付けた中身が消えないよう控えておく
  if (ev.target.matches('[data-codein]')) app.codeIn = ev.target.value;
  if (ev.target.matches('[data-obname]') && app.onboard) app.onboard.name = ev.target.value;
  // デッキ名は打つたびに保存する（再描画すると入力欄からフォーカスが外れるので render しない）
  if (ev.target.matches('[data-deckname]')) {
    const d = app.save.decks[app.save.activeDeck];
    if (d) {
      d.name = ev.target.value.slice(0, 14) || L(`デッキ${app.save.activeDeck + 1}`, `Deck ${app.save.activeDeck + 1}`);
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
  if (ev.target.matches('[data-stats]')) {
    // 止める直前の1回だけは送る（何人が止めたかは知っておきたい）。止めたあとは何も送らない
    if (!ev.target.checked) track('optout');
    setStatsEnabled(ev.target.checked);
  }
});
document.addEventListener('contextmenu', ev => {
  if (app.screen !== 'battle') return;
  const mini = ev.target.closest('.mini[data-side="0"]');
  if (!mini) return;
  ev.preventDefault();
  const slot = Number(mini.dataset.slot);
  if (canChangeMode(app.game, 0, slot)) actWithFx(0, { type: 'mode', slot }).then(afterAction);
  else toast(L('モード変更はできません（1ターン1回・攻撃後は不可）', 'Can’t switch mode (once per turn, not after attacking)'));
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
if (app.langChosen) renameDefaultDecks();
syncBgm();
render();
