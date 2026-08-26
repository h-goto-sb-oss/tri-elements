// ============================================================
// UI エントリ
// ============================================================
import { ALL_CARDS, card, ELEMENTS, KEYWORDS } from '../engine/cards.js';
import { RARITY } from '../engine/rarity.js';
import {
  createGame, mulligan, applyAction, legalAttackTargets, canSummon, canPlaySupport,
  canChangeMode, canAttack, supportNeedsTarget, fieldMonsters, effAtk, effDef,
  isMonster, matchFilter, hasKw, emptySlot, canForge, canSummonAt, summonCostOf,
} from '../engine/game.js';
import { aiChooseAction } from '../engine/ai.js';
import { cardArtSvg } from './art.js';
import { cardHtml, monsterHtml, supportHtml, detailHtml, esc } from './cardview.js';
import {
  AREAS, REWARD, openPack, PACK_TYPES, loadSave, writeSave,
  areaUnlocked, addCards, deckCurve, STARTER_DECK,
} from '../game/campaign.js';
import * as Audio from './audio.js';
import { ENEMY_ART, AREA_BG } from './assets_map.js';

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
  graveView: null,      // 0|1 墓地を見ている
  hint: '', toast: '',
  aiTimer: null, result: null, packResult: null,
  deckDraft: null, poolSort: 'element',
  logOpen: true,
  drag: null,           // ドラッグ中の情報
  audioInfo: null,
};

// ============================================================
// 場面ごとの BGM
// ============================================================
const SCENE_BGM = {
  title: 'bgm_menu', deck: 'bgm_menu', collection: 'bgm_menu', rules: 'bgm_menu', audio: 'bgm_menu',
  adventure: 'bgm_map', battle: 'bgm_battle',
};
function syncBgm() { Audio.playBgm(SCENE_BGM[app.screen] || 'bgm_menu'); }

function go(screen) {
  clearTimeout(app.aiTimer);
  app.screen = screen; app.result = null; app.popup = null; app.sel = null; app.detail = null;
  if (screen === 'deck') app.deckDraft = [...app.save.deck];
  syncBgm(); render();
}

function toast(msg, ms = 1700) {
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

// ============================================================
// タイトル
// ============================================================
function renderTitle() {
  const owned = Object.values(app.save.collection).reduce((a, b) => a + b, 0);
  return `<div class="screen">
    <div class="title-hero">
      <h1>TRI-ELEMENTS</h1>
      <p>三 属 の 戦 記</p>
      <div class="elemrow"><span>🔥</span><span>💧</span><span>🌿</span></div>
    </div>
    <div class="menu">
      <button class="btn primary" data-go="adventure">冒険へ出る</button>
      <button class="btn" data-go="deck">デッキ編集</button>
      <button class="btn" data-go="collection">カード図鑑</button>
      <button class="btn" data-go="rules">ルール説明</button>
      <button class="btn" data-go="audio">サウンド設定</button>
    </div>
    <div class="hint">${app.save.stats.wins}勝 ${app.save.stats.losses}敗 ／ 所持カード ${owned}枚 ／ 全${ALL_CARDS.length}種</div>
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
    return `<div class="foe ${cleared ? 'cleared' : ''} ${open ? '' : 'locked'}">
      ${cleared ? '<div class="badge">クリア</div>' : ''}
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
      <button class="btn ${cleared ? '' : 'primary'} fbtn" ${open ? `data-fight="${ai}:${i}"` : 'disabled'}>
        ${open ? (cleared ? 'もう一度戦う' : '挑戦する') : '前の相手を倒すと解放'}
      </button>
    </div>`;
  }).join('');

  const packs = Object.entries(app.save.packs || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => `<button class="btn primary" data-openpack="${k}">${PACK_TYPES[k].name} ×${n} を開ける</button>`).join('');

  return `<div class="adventure">
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

function renderDeck() {
  const draft = app.deckDraft || (app.deckDraft = [...app.save.deck]);
  const counts = {};
  draft.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const curve = deckCurve(draft);
  const maxC = Math.max(1, ...Object.values(curve));
  const bars = [1, 2, 3, 4, 5, 6, 7].map(c =>
    `<div class="bar" style="height:${Math.max(3, (curve[c] || 0) / maxC * 48)}px">
      <span>${curve[c] || ''}</span><em>${c === 7 ? '7+' : c}</em></div>`).join('');

  const deckCards = Object.keys(counts).map(id => card(id))
    .sort((a, b) => a.cost - b.cost || a.element.localeCompare(b.element) || a.id.localeCompare(b.id))
    .map(c => `<div class="dcard" data-deckcard="${c.id}" draggable="false">
        ${cardHtml(c, {})}<div class="cnt">×${counts[c.id]}</div>
      </div>`).join('');

  const owned = Object.keys(app.save.collection).filter(id => app.save.collection[id] > 0).map(id => card(id));
  const pool = sortPool(owned).map(c => {
    const inDeck = counts[c.id] || 0;
    const own = app.save.collection[c.id];
    const full = inDeck >= Math.min(3, own) || draft.length >= 30;
    return `<div class="poolcard ${full ? 'full' : ''}" data-poolcard="${c.id}">
      ${cardHtml(c, { cls: full ? '' : 'selectable' })}
      <div class="own">${inDeck}/${Math.min(3, own)}</div>
    </div>`;
  }).join('');

  return `<div class="deckwrap">
    <div class="deckcol">
      <h3>デッキ <span style="color:${draft.length === 30 ? '#7fe0a0' : '#ff9a9a'}">${draft.length}</span>/30</h3>
      <div class="curve">${bars}</div>
      <div style="height:16px"></div>
      <div class="decklist" data-decklist>${deckCards || '<div class="hint" style="width:100%;padding-top:30px">ここにカードをドラッグ</div>'}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn primary small" data-savedeck ${draft.length === 30 ? '' : 'disabled'}>保存</button>
        <button class="btn small" data-resetdeck>初期構築</button>
        <button class="btn small" data-cleardeck>全部外す</button>
        <button class="btn small" data-go="title">戻る</button>
      </div>
      <div class="hint">カードをドラッグして出し入れ／クリックでも増減</div>
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
  const groups = [['fire', '🔥 炎'], ['water', '💧 水'], ['grass', '🌿 草'], ['none', '✦ 汎用']];
  const html = groups.map(([el, label]) => {
    const cs = ALL_CARDS.filter(c => c.element === el);
    const have = cs.filter(c => app.save.collection[c.id]).length;
    return `<h3 style="color:var(--gold);align-self:flex-start">${label}　${have}/${cs.length}種</h3>
      <div class="grid">${cs.map(c => {
        const own = app.save.collection[c.id] || 0;
        return `<div class="poolcard">${cardHtml(c, { cls: own ? 'selectable' : 'disabled' })}
          <div class="own">${own ? '×' + own : '未所持'}</div></div>`;
      }).join('')}</div>`;
  }).join('');
  return `<div class="screen">${html}<button class="btn" data-go="title">戻る</button></div>`;
}

function renderRules() {
  return `<div class="screen">
    <div style="max-width:780px;line-height:1.95;font-size:13.5px">
      <h2 style="color:var(--gold);margin-bottom:10px">ルール</h2>
      <p><b>勝利条件</b>：相手のライフを0にする。または相手が山札切れでドローできなくなる。</p>
      <p><b>コスト</b>：毎ターン最大コストが1ずつ増える（上限10）。使い切っても次のターンに全回復。</p>
      <p><b>召喚</b>：コストが払える限り何体でも召喚できる。召喚酔いは無く、出したターンに攻撃できる。</p>
      <p><b>入れ替え召喚</b>：場が3体で埋まっていても、自分のモンスター1体を墓地へ送れば召喚できる（コスト+1）。手札の大型が腐りません。</p>
      <p><b>鍛錬</b>：1ターンに1回、2コストでカードを1枚引ける。余ったコストの使い道。</p>
      <p><b>攻撃モード（縦置き）</b>：⚔で戦う。攻撃モード同士なら⚔が高い方が勝ち、差はプレイヤーへのダメージ。負けた側のプレイヤーも差分を受ける。</p>
      <p><b>防御モード（横置き）</b>：🛡で受ける。相手の⚔が🛡を超えたら破壊され、<b>超えた分がプレイヤーへのダメージ</b>。🛡が⚔以上なら完全に防ぎ、両者とも場に残る。</p>
      <p><b>モード変更</b>：1体につき1ターン1回。ただし攻撃済みのモンスターは変更できない。</p>
      <p><b>直接攻撃</b>：相手の場にモンスターが1体もいないとき、⚔分をそのままライフへ。</p>
      <p><b>属性相性</b>：🔥→🌿→💧→🔥 の順に強い。有利な属性で攻撃すると戦闘時 <b>⚔+2</b>。</p>
      <p><b>キーワード</b>：【守護】相手はまずこれを攻撃対象に選ぶ／【貫通】守護を無視できる／【連撃】1ターンに2回攻撃できる。</p>
      <p><b>手札</b>：上限6枚。ターン終了時に超過分を捨てる。サポートはコストが続く限り何枚でも使える。</p>
      <p><b>レア度</b>：${Object.values(RARITY).filter(r => r.key !== 'legend')
        .map(r => `<span style="color:${r.color}">${r.name}</span>`).join(' ＜ ')} ＜ <span style="color:#ffcf5a">レジェンド（未実装）</span></p>
    </div>
    <button class="btn" data-go="title">戻る</button>
  </div>`;
}

function renderAudioSettings() {
  const f = app.audioInfo || {};
  const rows = Audio.AUDIO_FILES.map(([k, label]) => {
    const found = f[k];
    return `<tr>
      <td style="padding:5px 12px 5px 0"><code style="color:var(--gold)">assets/audio/${k}.mp3</code></td>
      <td style="padding:5px 12px 5px 0;color:var(--muted)">${label}</td>
      <td style="padding:5px 0;color:${found ? '#7fe0a0' : '#8fa0b6'}">${found ? '読み込み済み' : '未配置'}</td>
    </tr>`;
  }).join('');
  const st = Audio.audioState;
  return `<div class="screen">
    <h2 style="color:var(--gold)">サウンド設定</h2>
    <div style="max-width:640px;text-align:left;font-size:13px;line-height:1.8">
      <p style="color:var(--muted)">下のファイル名で <code>assets/audio/</code> に置くと自動で鳴ります。
      拡張子は .mp3 / .ogg / .m4a / .wav のいずれでも構いません。</p>
      <table style="margin:12px 0;font-size:12.5px">${rows}</table>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
        <label style="display:flex;gap:8px;align-items:center">
          <input type="checkbox" data-mute ${st.muted ? 'checked' : ''}> ミュート</label>
        <label style="display:flex;gap:8px;align-items:center">BGM
          <input type="range" min="0" max="100" value="${Math.round(st.bgmVol * 100)}" data-bgmvol></label>
        <label style="display:flex;gap:8px;align-items:center">効果音
          <input type="range" min="0" max="100" value="${Math.round(st.seVol * 100)}" data-sevol></label>
        <button class="btn small" data-rescan>再スキャン</button>
      </div>
    </div>
    <button class="btn" data-go="title">戻る</button>
  </div>`;
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

function supportTargetSlots(g, handIndex) {
  const id = g.players[0].hand[handIndex];
  const c = card(id);
  const res = { self: [], enemy: [] };
  if (!c || c.type !== 'support') return res;
  const e = c.effects.find(x => x.op === 'equip' || x.target === 'one');
  if (!e) return res;
  if (e.op === 'equip') { res.self = fieldMonsters(g.players[0]).map(x => x.i); return res; }
  const key = e.side === 'enemy' ? 'enemy' : 'self';
  const p = g.players[e.side === 'enemy' ? 1 : 0];
  res[key] = fieldMonsters(p).filter(({ m }) => matchFilter(m, e.filter)).map(x => x.i);
  return res;
}

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
  const logHtml = g.log.slice(-24).map(l => `<div class="l ${l.kind}">${esc(l.text)}</div>`).join('');

  const bg = AREA_BG[AREAS[app.areaIndex]?.id] || AREA_BG.common;
  return `<div class="battle" ${bg ? `style="--bgimg:url(${bg})"` : ''}>
    <div class="bar">
      <div class="who"><div class="face">${(() => {
        const src = ENEMY_ART[`${AREAS[app.areaIndex]?.id}:${Number((app.enemyKey || ':0').split(':')[1])}`];
        return src ? `<img src="${src}" alt="">` : (app.enemy ? app.enemy.icon : '🤖');
      })()}</div>${esc(op.name)}</div>
      <div class="lifebox"><span class="lifeval">${op.life}</span>
        <div class="lifebar"><div style="width:${Math.max(0, Math.min(100, op.life / (app.enemy?.life || 20) * 100))}%"></div></div></div>
      <div class="costpips">${pips(op.cost)}</div>
      <span class="meta">手札 <b>${op.hand.length}</b></span>
      <span style="margin-left:auto"></span>
      <button class="btn tiny" data-toggle-log>${app.logOpen ? 'ログ非表示' : 'ログ'}</button>
      <button class="btn tiny" data-surrender>投了</button>
    </div>

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

    <div class="bar">
      <div class="who"><div class="face">🧙</div>あなた</div>
      <div class="lifebox"><span class="lifeval">${me.life}</span>
        <div class="lifebar"><div style="width:${Math.max(0, Math.min(100, me.life / 20 * 100))}%"></div></div></div>
      <div class="costpips">${pips(me.cost)}</div>
      <span class="meta">コスト <b>${me.cost}/${me.maxCost}</b></span>
      <span style="margin-left:auto"></span>
      ${discardMode ? '<span class="hint" style="color:var(--gold)">手札が多すぎます。捨てるカードを選んでください</span>' : ''}
      ${app.sel ? '<button class="btn small" data-cancel>選択解除</button>' : ''}
      <button class="btn small" data-forge ${myTurn && g.phase === 'main' && canForge(g, 0) ? '' : 'disabled'}
        title="余ったコストでカードを引く">🔨 鍛錬（${g.rules.forgeCost}コスト→1ドロー）</button>
      <button class="btn primary" data-endturn ${myTurn && g.phase === 'main' ? '' : 'disabled'}>ターン終了</button>
    </div>
    <div class="hand">${hand}</div>
    ${app.logOpen ? `<div class="logpane">${logHtml}</div>` : ''}
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
  if (app.graveView !== null) h += graveOverlay();
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
        <div class="bs-face">🧙</div>
        <div class="bs-name">あなた</div>
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
  return `<div class="overlay" data-closedetail><div class="modal">
    ${detailHtml(c)}
    <div class="row-btn"><button class="btn" data-closedetail>閉じる</button></div>
  </div></div>`;
}

function graveOverlay() {
  const p = app.game.players[app.graveView];
  const cards = p.grave.map(id => cardHtml(card(id), { cls: 'selectable' })).join('');
  return `<div class="overlay" data-closegrave><div class="modal">
    <h2>${app.graveView === 0 ? 'あなた' : esc(p.name)}の墓地（${p.grave.length}枚）</h2>
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
    ${r.unlocked ? `<p style="color:#8fe0a8">「${esc(r.unlocked)}」が解放されました！</p>` : ''}
    <div class="row-btn">
      <button class="btn primary" data-go="adventure">冒険へ戻る</button>
      <button class="btn" data-rematch>もう一度</button>
    </div>
  </div></div>`;
}

function packOverlay() {
  const cards = app.packResult.map((id, i) =>
    `<div style="animation:bspop .4s ${i * 0.12}s both">${cardHtml(card(id), { cls: 'big' })}</div>`).join('');
  return `<div class="overlay"><div class="modal" style="max-width:880px">
    <h2>パック開封！</h2>
    <div class="grid" style="margin:14px 0">${cards}</div>
    <button class="btn primary" data-closepack>受け取る</button>
  </div></div>`;
}

// ============================================================
// 描画
// ============================================================
function render() {
  let html;
  switch (app.screen) {
    case 'adventure': html = renderAdventure(); break;
    case 'deck': html = renderDeck(); break;
    case 'collection': html = renderCollection(); break;
    case 'rules': html = renderRules(); break;
    case 'audio': html = renderAudioSettings(); break;
    case 'battle': html = renderBattle() + popupHtml(); break;
    default: html = renderTitle();
  }
  html += overlays();
  if (app.toast) html += `<div class="toast">${esc(app.toast)}</div>`;
  $app.innerHTML = html;
}

// ============================================================
// バトル進行
// ============================================================
function startBattle(areaIndex, enemyIndex) {
  const area = AREAS[areaIndex], enemy = area.enemies[enemyIndex];
  app.areaIndex = areaIndex;
  app.enemy = enemy;
  app.enemyKey = `${area.id}:${enemyIndex}`;
  app.result = null; app.sel = null; app.popup = null; app.hint = ''; app.detail = null;
  const seed = (Math.random() * 1e9) | 0;
  app.game = createGame({
    decks: [[...app.save.deck], [...enemy.deck]],
    seed, names: ['あなた', enemy.name],
    startCost: [0, enemy.startCost || 0],
  });
  if (enemy.life) app.game.players[1].life = enemy.life;
  app.phase = 'mulligan';
  app.screen = 'battle';
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
  if (app.game.active === 1) scheduleAi();
}

function afterAction() {
  const g = app.game;
  render();
  if (g.winner !== null) return finishGame();
  if (g.active === 1) scheduleAi();
}

function scheduleAi() {
  clearTimeout(app.aiTimer);
  app.aiTimer = setTimeout(aiStep, 460);
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
  if (act) { applyAction(g, 1, act); render(); return scheduleAi(); }
  applyAction(g, 1, { type: 'end' });
  render();
  if (g.winner !== null) return finishGame();
  if (g.active === 1) return scheduleAi();
}

function finishGame() {
  const g = app.game;
  if (!g || g.winner === null || app.result) return;
  const win = g.winner === 0;
  let reward = null, unlocked = null;
  if (win) {
    app.save.stats.wins++;
    if (app.enemyKey && !app.save.cleared[app.enemyKey]) {
      app.save.cleared[app.enemyKey] = true;
      const [areaId, idx] = app.enemyKey.split(':');
      reward = REWARD[areaId];
      app.save.packs[reward] = (app.save.packs[reward] || 0) + 1;
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
  ghost = document.createElement('div');
  ghost.className = 'dragghost';
  ghost.innerHTML = html;
  ghost.style.left = x + 'px'; ghost.style.top = y + 'px';
  document.body.appendChild(ghost);
}
function moveGhost(x, y) { if (ghost) { ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; } }
function killGhost() { if (ghost) { ghost.remove(); ghost = null; } }

function elementUnder(x, y, selector) {
  killGhostPointerEvents();
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(selector) : null;
}
function killGhostPointerEvents() { /* ghost は pointer-events:none なので何もしなくてよい */ }

document.addEventListener('pointerdown', ev => {
  const handCard = ev.target.closest('[data-hand]');
  const deckCard = ev.target.closest('[data-deckcard]');
  const poolCard = ev.target.closest('[data-poolcard]');
  const boardMon = ev.target.closest('.mini[data-side="0"]');
  if (!handCard && !deckCard && !poolCard && !boardMon) return;
  if (ev.button !== 0) return;
  app.drag = {
    from: handCard ? 'hand' : deckCard ? 'deck' : poolCard ? 'pool' : 'board',
    index: handCard ? Number(handCard.dataset.hand) : undefined,
    cardId: deckCard?.dataset.deckcard || poolCard?.dataset.poolcard,
    slot: boardMon ? Number(boardMon.dataset.slot) : undefined,
    x0: ev.clientX, y0: ev.clientY, moved: false,
  };
});

document.addEventListener('pointermove', ev => {
  const d = app.drag;
  if (!d) return;
  const dist = Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0);
  if (!d.moved && dist > 7) {
    d.moved = true;
    let html = '';
    if (d.from === 'hand') html = cardHtml(card(app.game.players[0].hand[d.index]), {});
    else if (d.cardId) html = cardHtml(card(d.cardId), {});
    else if (d.from === 'board') {
      const m = app.game.players[0].field[d.slot];
      if (m) html = cardHtml(card(m.id), {});
    }
    if (html) makeGhost(html, ev.clientX, ev.clientY);
    render();
  }
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
  handleClick(ev);
});

document.addEventListener('pointerup', ev => {
  const d = app.drag;
  app.drag = null;
  killGhost();
  document.querySelectorAll('.slot.hot').forEach(e => e.classList.remove('hot'));
  if (!d) return;
  if (!d.moved) return;      // 動いていなければ click 側で処理する
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
    const t = supportTargetSlots(g, d.index);
    const needsTarget = supportNeedsTarget(id);
    if (needsTarget) {
      const mEl = elementUnder(x, y, '.mini');
      if (mEl) {
        const side = Number(mEl.dataset.side), slot = Number(mEl.dataset.slot);
        const ok = side === 0 ? t.self.includes(slot) : t.enemy.includes(slot);
        if (ok) { applyAction(g, 0, { type: 'support', hand: d.index, target: { slot } }); afterAction(); return; }
        toast('そのカードは対象にできません');
      } else toast('対象のモンスターにドロップしてください');
      render(); return;
    }
    if (elementUnder(x, y, '.field') && canPlaySupport(g, 0, d.index)) {
      applyAction(g, 0, { type: 'support', hand: d.index });
      afterAction(); return;
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
      if (legal.includes(slot)) { applyAction(g, 0, { type: 'attack', slot: d.slot, target: slot }); afterAction(); return; }
      toast('【守護】がいるため、そのモンスターは攻撃できません');
    } else if (legal.includes('face') && y < window.innerHeight * 0.42) {
      applyAction(g, 0, { type: 'attack', slot: d.slot, target: 'face' }); afterAction(); return;
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
  if (d.length >= 30) { toast('デッキは30枚までです'); return; }
  if (have >= Math.min(3, own)) { toast('これ以上は入れられません（同名3枚・所持数まで）'); return; }
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

  // --- 画面遷移など ---
  const goEl = hit('[data-go]');
  if (goEl) return go(goEl.dataset.go);
  const areaEl = hit('[data-area]');
  if (areaEl) { app.areaIndex = Number(areaEl.dataset.area); return render(); }
  const fightEl = hit('[data-fight]');
  if (fightEl) { const [a, e] = fightEl.dataset.fight.split(':').map(Number); return startBattle(a, e); }
  if (hit('[data-openpack]')) {
    const k = hit('[data-openpack]').dataset.openpack;
    if ((app.save.packs[k] || 0) <= 0) return;
    app.save.packs[k]--;
    app.packResult = openPack(k);
    addCards(app.save, app.packResult); writeSave(app.save);
    return render();
  }
  if (hit('[data-closepack]')) { app.packResult = null; return render(); }
  if (hit('[data-rematch]')) { const [a, e] = app.enemyKey.split(':'); const ai = AREAS.findIndex(x => x.id === a); return startBattle(ai, Number(e)); }

  // --- サウンド設定 ---
  if (t.matches('[data-mute]')) { Audio.setMuted(t.checked); return; }
  if (hit('[data-rescan]')) { Audio.scanAudio().then(info => { app.audioInfo = info; toast('再スキャンしました'); }); return; }

  // --- デッキ編集 ---
  if (app.screen === 'deck') {
    const pc = hit('[data-poolcard]');
    if (pc) { addToDeck(pc.dataset.poolcard); return render(); }
    const dc = hit('[data-deckcard]');
    if (dc) { removeFromDeck(dc.dataset.deckcard); return render(); }
    if (hit('[data-savedeck]')) { app.save.deck = [...app.deckDraft]; writeSave(app.save); toast('デッキを保存しました'); return go('title'); }
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
  const mull = hit('[data-mulligan]');
  if (mull) return doMulligan(mull.dataset.mulligan === 'redraw');
  if (hit('[data-startbattle]')) return beginPlay();

  if (app.screen !== 'battle') return;
  const g = app.game;
  if (!g) return;

  if (hit('[data-toggle-log]')) { app.logOpen = !app.logOpen; return render(); }
  if (hit('[data-surrender]')) { clearTimeout(app.aiTimer); return go('adventure'); }
  const gv = hit('[data-grave]');
  if (gv) { app.graveView = Number(gv.dataset.grave); return render(); }

  // --- 召喚モード選択 ---
  const sm = hit('[data-summon]');
  if (sm) {
    const p = app.popup; app.popup = null;
    applyAction(g, 0, { type: 'summon', hand: p.hand, mode: sm.dataset.summon, slot: p.slot });
    return afterAction();
  }
  // --- 自分モンスターの操作メニュー ---
  const act = hit('[data-act]');
  if (act) {
    const p = app.popup; app.popup = null;
    if (act.dataset.act === 'attack') { app.sel = { kind: 'attack', slot: p.slot }; app.hint = '攻撃する相手を選んでください'; return render(); }
    if (act.dataset.act === 'mode') { applyAction(g, 0, { type: 'mode', slot: p.slot }); return afterAction(); }
    if (act.dataset.act === 'detail') { app.detail = g.players[0].field[p.slot].id; return render(); }
  }
  if (app.popup) { app.popup = null; render(); }

  if (hit('[data-cancel]')) { app.sel = null; app.hint = ''; return render(); }
  if (hit('[data-forge]')) { applyAction(g, 0, { type: 'forge' }); return afterAction(); }
  if (hit('[data-endturn]')) { app.sel = null; applyAction(g, 0, { type: 'end' }); return afterAction(); }
  if (hit('[data-attackface]') && app.sel) {
    applyAction(g, 0, { type: 'attack', slot: app.sel.slot, target: 'face' });
    app.sel = null; return afterAction();
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
      if (supportNeedsTarget(id)) { toast('対象のモンスターにドラッグしてください'); return; }
      applyAction(g, 0, { type: 'support', hand: i });
      return afterAction();
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
        applyAction(g, 0, { type: 'attack', slot: app.sel.slot, target: slot });
        app.sel = null; app.hint = ''; return afterAction();
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
  if (canChangeMode(app.game, 0, slot)) { applyAction(app.game, 0, { type: 'mode', slot }); afterAction(); }
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
  render();
}
window.__TE = { app, render, startBattle, makeDemo, card, ALL_CARDS, applyAction, afterAction, beginPlay, doMulligan };

// ============================================================
Audio.scanAudio().then(info => { app.audioInfo = info; });
syncBgm();
render();
