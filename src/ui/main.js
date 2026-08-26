// ============================================================
// UI エントリ
// ============================================================
import { ALL_CARDS, card, ELEMENTS, KEYWORDS } from '../engine/cards.js';
import {
  createGame, mulligan, applyAction, legalAttackTargets, canSummon, canPlaySupport,
  canChangeMode, canAttack, supportNeedsTarget, fieldMonsters, effAtk, effDef,
  isMonster, matchFilter, hasKw, other, emptySlot,
} from '../engine/game.js';
import { aiChooseAction, expandTargets } from '../engine/ai.js';
import { cardArtSvg } from './art.js';
import {
  AREAS, REWARD, openPack, PACK_TYPES, loadSave, writeSave, newSave,
  areaUnlocked, addCards, deckCurve, STARTER_DECK,
} from '../game/campaign.js';

const $app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const app = {
  screen: 'title',
  save: loadSave(),
  game: null,
  enemy: null,
  sel: null,        // {kind:'hand'|'attack'|'support', ...}
  hint: '',
  toast: '',
  aiTimer: null,
  result: null,
  packResult: null,
  deckDraft: null,
  logOpen: true,
};

// ============================================================
// カード描画
// ============================================================
function cardHtml(c, opts = {}) {
  const cls = ['card', c.element, opts.cls || ''].join(' ');
  const kw = c.keywords && c.keywords.length
    ? `<div class="kw">${c.keywords.map(k => KEYWORDS[k].name).join('/')}</div>` : '';
  const stats = c.type === 'monster'
    ? `<div class="stats"><span class="atk">⚔${c.atk}</span><span class="def">🛡${c.def}</span></div>` : '';
  return `<div class="${cls}" ${opts.attr || ''} title="${esc(c.name)}｜${esc(c.text || 'バニラ（能力なし）')}">
    <div class="cost">${c.cost}</div>
    <div class="cname">${esc(c.name)}</div>
    <div class="art">${cardArtSvg(c)}<div class="elem">${ELEMENTS[c.element].icon}</div></div>
    ${kw}
    <div class="body">${esc(c.text || c.flavor)}</div>
    ${stats}
  </div>`;
}

function miniHtml(m, side, slot, opts = {}) {
  const c = card(m.id);
  const cls = ['mini', c.element, m.mode === 'attack' ? 'attackmode' : 'defense',
    opts.cls || '', m.hasAttacked && side === 0 ? 'exhausted' : ''].join(' ');
  const buffed = (m.atk + m.tempAtk) > c.atk || (m.def + m.tempDef) > c.def;
  return `<div class="${cls}" data-side="${side}" data-slot="${slot}"
      title="${esc(c.name)}｜${esc(c.text || 'バニラ')}">
    <div class="mart">${cardArtSvg(c)}</div>
    <div class="mname">${esc(c.name)}</div>
    ${hasKw(m, 'guard') ? '<div class="guardmark">守護</div>' : ''}
    <div class="modebadge">${m.mode === 'attack' ? '攻' : '守'}</div>
    <div class="mstat" style="${buffed ? 'text-shadow:0 0 6px #ffd76a' : ''}">
      <span class="atk" style="color:#ff9c6b">⚔${effAtk(m)}</span>
      <span class="def" style="color:#7fc4ff">🛡${effDef(m)}</span>
    </div>
  </div>`;
}

// ============================================================
// タイトル
// ============================================================
function renderTitle() {
  return `<div class="screen">
    <div class="title-hero">
      <h1>TRI-ELEMENTS</h1>
      <p>三 属 の 戦 記</p>
      <div class="elemrow"><span>🔥</span><span>💧</span><span>🌿</span></div>
    </div>
    <div class="menu">
      <button class="btn primary" data-go="campaign">冒険へ出る</button>
      <button class="btn" data-go="deck">デッキ編集</button>
      <button class="btn" data-go="collection">カード図鑑</button>
      <button class="btn" data-go="rules">ルール説明</button>
    </div>
    <div class="hint">勝敗 ${app.save.stats.wins}勝 ${app.save.stats.losses}敗 ／ 所持カード ${Object.values(app.save.collection).reduce((a, b) => a + b, 0)}枚</div>
  </div>`;
}

// ============================================================
// キャンペーン
// ============================================================
function renderCampaign() {
  const areas = AREAS.map((a, ai) => {
    const unlocked = areaUnlocked(app.save, ai);
    const chips = a.enemies.map((e, ei) => {
      const done = app.save.cleared[`${a.id}:${ei}`];
      return `<button class="chip ${done ? 'done' : ''}" ${unlocked ? `data-fight="${ai}:${ei}"` : 'disabled'}>
        ${e.icon} ${esc(e.name)}${done ? ' ✓' : ''}</button>`;
    }).join('');
    return `<div class="areacard ${unlocked ? '' : 'locked'}">
      <div style="font-size:30px">${unlocked ? '📜' : '🔒'}</div>
      <div style="flex:1">
        <div class="an">${esc(a.name)}</div>
        <div class="ad">${esc(a.desc)}　報酬: ${PACK_TYPES[REWARD[a.id]].name}</div>
        <div class="enemychips">${chips}</div>
      </div>
    </div>`;
  }).join('');
  const packs = Object.entries(app.save.packs || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => `<button class="btn primary" data-openpack="${k}">${PACK_TYPES[k].name} ×${n} を開ける</button>`).join('');
  return `<div class="screen">
    <h2 style="color:var(--gold);letter-spacing:.1em">冒険の地図</h2>
    ${packs ? `<div style="display:flex;gap:8px">${packs}</div>` : ''}
    <div class="arealist">${areas}</div>
    <button class="btn" data-go="title">タイトルへ戻る</button>
  </div>`;
}

// ============================================================
// デッキ編集
// ============================================================
function renderDeck() {
  const draft = app.deckDraft || (app.deckDraft = [...app.save.deck]);
  const counts = {};
  draft.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const curve = deckCurve(draft);
  const maxC = Math.max(1, ...Object.values(curve));
  const bars = [1, 2, 3, 4, 5, 6, 7].map(c => {
    const n = curve[c] || 0;
    return `<div class="bar" style="height:${Math.max(3, n / maxC * 62)}px"><span>${n || ''}</span><em>${c === 7 ? '7+' : c}</em></div>`;
  }).join('');

  const owned = Object.keys(app.save.collection).filter(id => app.save.collection[id] > 0)
    .map(id => card(id)).sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
  const pool = owned.map(c => {
    const inDeck = counts[c.id] || 0;
    const own = app.save.collection[c.id];
    const full = inDeck >= Math.min(3, own) || draft.length >= 30;
    return `<div style="position:relative">
      ${cardHtml(c, { cls: `selectable ${full ? 'disabled' : ''}`, attr: `data-add="${c.id}"` })}
      <div style="position:absolute;bottom:-2px;right:2px;background:#000c;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:800">
        ${inDeck}/${own}</div>
    </div>`;
  }).join('');

  const deckList = Object.entries(counts).map(([id, n]) => {
    const c = card(id);
    return `<div style="display:flex;align-items:center;gap:6px;padding:2px 4px;border-bottom:1px solid var(--line);font-size:12px">
      <span style="width:18px;height:18px;border-radius:50%;background:#c9922f;color:#3a2600;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px">${c.cost}</span>
      <span style="flex:1">${ELEMENTS[c.element].icon} ${esc(c.name)}</span>
      <b>×${n}</b>
      <button class="btn small" data-rem="${id}">−</button>
    </div>`;
  }).sort().join('');

  return `<div class="screen">
    <div class="deckpanel">
      <div style="width:300px;flex:none">
        <h3 style="color:var(--gold)">デッキ (${draft.length}/30)</h3>
        <div style="margin:10px 0 22px">
          <div class="curve">${bars}</div>
          <div style="text-align:center;font-size:11px;color:var(--muted);margin-top:18px">コストカーブ</div>
        </div>
        <div style="max-height:46vh;overflow-y:auto">${deckList}</div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn primary" data-savedeck ${draft.length === 30 ? '' : 'disabled'}>保存</button>
          <button class="btn" data-resetdeck>初期構築に戻す</button>
          <button class="btn" data-go="title">戻る</button>
        </div>
        <div class="hint">30枚ちょうど・同名3枚まで</div>
      </div>
      <div style="flex:1">
        <h3 style="color:var(--gold)">所持カード</h3>
        <div class="grid" style="margin-top:8px">${pool}</div>
      </div>
    </div>
  </div>`;
}

// ============================================================
// 図鑑 / ルール
// ============================================================
function renderCollection() {
  const groups = [['fire', '🔥 炎'], ['water', '💧 水'], ['grass', '🌿 草'], ['none', '✦ 汎用']];
  const html = groups.map(([el, label]) => {
    const cs = ALL_CARDS.filter(c => c.element === el);
    return `<h3 style="color:var(--gold);align-self:flex-start">${label}（${cs.length}種）</h3>
      <div class="grid">${cs.map(c => {
        const own = app.save.collection[c.id] || 0;
        return `<div style="position:relative">${cardHtml(c, { cls: own ? '' : 'disabled' })}
          <div style="position:absolute;bottom:-2px;right:2px;background:#000c;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:800">${own ? '×' + own : '未所持'}</div>
        </div>`;
      }).join('')}</div>`;
  }).join('');
  return `<div class="screen">${html}<button class="btn" data-go="title">戻る</button></div>`;
}

function renderRules() {
  return `<div class="screen">
    <div style="max-width:760px;line-height:1.9;font-size:14px">
      <h2 style="color:var(--gold);margin-bottom:10px">ルール</h2>
      <p><b>勝利条件</b>：相手のライフを0にする。または相手が山札切れでドローできなくなる。</p>
      <p><b>コスト</b>：毎ターン最大コストが1ずつ増える（上限10）。使い切っても次のターンに全回復。</p>
      <p><b>召喚</b>：1ターンに1体まで。召喚酔いは無く、出したターンに攻撃できる。攻撃モードか防御モードを選んで出す。</p>
      <p><b>攻撃モード</b>：⚔で戦う。攻撃モード同士なら⚔が高い方が勝ち、差はプレイヤーへのダメージ。負けた側のプレイヤーも差分を受ける。</p>
      <p><b>防御モード</b>：🛡で受ける。相手の⚔が🛡を超えたら破壊され、<b>超えた分がプレイヤーへのダメージ</b>。🛡が⚔以上なら完全に防ぎ、両者とも場に残る。</p>
      <p><b>モード変更</b>：1体につき1ターン1回。ただし攻撃済みのモンスターは変更できない。</p>
      <p><b>直接攻撃</b>：相手の場にモンスターが1体もいないとき、⚔分をそのままライフへ。</p>
      <p><b>属性相性</b>：🔥→🌿→💧→🔥 の順に強い。有利な属性で攻撃すると戦闘時 <b>⚔+2</b>。</p>
      <p><b>キーワード</b>：【守護】相手はまずこれを攻撃対象に選ぶ／【貫通】守護を無視して攻撃対象を選べる。</p>
      <p><b>手札</b>：上限6枚。ターン終了時に超過分を捨てる。サポートはコストが続く限り何枚でも使える。</p>
    </div>
    <button class="btn" data-go="title">戻る</button>
  </div>`;
}

// ============================================================
// バトル
// ============================================================
function renderBattle() {
  const g = app.game;
  const me = g.players[0], op = g.players[1];
  const myTurn = g.active === 0 && g.winner === null;

  // --- 攻撃対象のハイライト計算 ---
  let targetSlots = [], faceTargetable = false;
  if (app.sel && app.sel.kind === 'attack') {
    const t = legalAttackTargets(g, 0, app.sel.slot);
    targetSlots = t.filter(x => x !== 'face');
    faceTargetable = t.includes('face');
  }
  let supportTargets = { self: [], enemy: [] };
  if (app.sel && app.sel.kind === 'support') {
    supportTargets = supportTargetSlots(g, app.sel.i);
  }

  const pile = (kind, n) => `<div class="pile ${kind === 'grave' ? 'grave' : ''} ${n ? '' : 'empty'}">
    <div class="stack"><i></i>${n > 1 ? '<i></i>' : ''}${n > 6 ? '<i></i>' : ''}</div>
    <div>${kind === 'grave' ? '墓地' : '山札'} <span class="n">${n}</span></div>
  </div>`;

  const enemyZone = op.field.map((m, i) => `<div class="slot">${
    m ? miniHtml(m, 1, i, { cls: targetSlots.includes(i) ? 'targetable' : (supportTargets.enemy.includes(i) ? 'targetable' : '') }) : ''
  }</div>`).join('');
  const myZone = me.field.map((m, i) => {
    let cls = '';
    if (m) {
      if (app.sel && app.sel.kind === 'attack' && app.sel.slot === i) cls = 'attacking';
      else if (myTurn && canAttack(g, 0, i)) cls = 'canattack';
      if (supportTargets.self.includes(i)) cls += ' targetable';
    }
    return `<div class="slot">${m ? miniHtml(m, 0, i, { cls }) : ''}</div>`;
  }).join('');

  const supRow = (p, side) => p.supports.map(s => `<div class="slot support">${
    s ? `<div class="mini ${card(s.id).element}" style="width:106px;height:74px">
        <div class="mart">${cardArtSvg(card(s.id))}</div>
        <div class="mname" style="font-size:10px">${esc(card(s.id).name)}</div>
      </div>` : ''
  }</div>`).join('');

  const hand = me.hand.map((id, i) => {
    const c = card(id);
    const playable = myTurn && g.phase === 'main' &&
      (isMonster(id) ? canSummon(g, 0, i) : canPlaySupport(g, 0, i));
    const isSel = app.sel && (app.sel.kind === 'hand' || app.sel.kind === 'support') && app.sel.i === i;
    const discardMode = g.phase === 'discard' && g.active === 0;
    return cardHtml(c, {
      cls: `${playable || discardMode ? 'selectable' : 'disabled'} ${isSel ? 'selected' : ''}`,
      attr: `data-hand="${i}"`,
    });
  }).join('');

  const pips = n => Array.from({ length: Math.max(op.maxCost, me.maxCost, 1) },
    (_, i) => `<div class="pip ${i < n ? 'on' : ''}"></div>`).join('');

  const logHtml = g.log.slice(-26).map(l =>
    `<div class="l ${l.kind}">${esc(l.text)}</div>`).join('');

  return `<div class="battle">
    <div class="playerbar">
      <span style="font-size:20px">${app.enemy ? app.enemy.icon : '🤖'}</span>
      <b>${esc(op.name)}</b>
      <div class="lifebox"><span class="lifeval">${op.life}</span>
        <div class="lifebar"><div style="width:${Math.max(0, Math.min(100, op.life / (app.enemy?.life || 20) * 100))}%"></div></div></div>
      <div class="costpips">${pips(op.cost)}</div>
      <span class="meta">手札 <b>${op.hand.length}</b>　山札 <b>${op.deck.length}</b>　墓地 <b>${op.grave.length}</b></span>
      <button class="btn small" data-toggle-log style="margin-left:auto">${app.logOpen ? 'ログを隠す' : 'ログ'}</button>
      <button class="btn small" data-go="campaign">投了</button>
    </div>
    <div class="boardwrap">
    <div class="zonerow">${supRow(op, 1)}</div>
    <div class="zonerow enemyfield ${faceTargetable ? 'faceopen' : ''}">
      ${pile('grave', op.grave.length)}${enemyZone}${pile('deck', op.deck.length)}
    </div>

    <div class="center">
      <span class="turnlabel">ターン ${g.turn}　${g.active === 0 ? 'あなたの番' : '相手の番'}</span>
      ${faceTargetable ? '<button class="btn danger small" data-attackface>▶ 直接攻撃！</button>' : ''}
      <span class="hint">${esc(app.hint)}</span>
    </div>

    <div class="zonerow">
      ${pile('grave', me.grave.length)}${myZone}${pile('deck', me.deck.length)}
    </div>
    <div class="zonerow">${supRow(me, 0)}</div>
    </div>

    <div class="playerbar">
      <span style="font-size:20px">🧙</span><b>${esc(me.name)}</b>
      <div class="lifebox"><span class="lifeval">${me.life}</span>
        <div class="lifebar"><div style="width:${Math.max(0, me.life / 20 * 100)}%"></div></div></div>
      <div class="costpips">${pips(me.cost)}</div>
      <span class="meta">コスト <b>${me.cost}/${me.maxCost}</b>　山札 <b>${me.deck.length}</b>　墓地 <b>${me.grave.length}</b></span>
      <span style="margin-left:auto"></span>
      ${app.sel ? '<button class="btn small" data-cancel>選択解除</button>' : ''}
      <button class="btn primary" data-endturn ${myTurn && g.phase === 'main' ? '' : 'disabled'}>ターン終了</button>
    </div>
    <div class="hand">${hand}</div>
    ${app.logOpen ? `<div class="logpane">${logHtml}</div>` : ''}
    ${app.result ? resultOverlay() : ''}
    ${app.modeChoice != null ? modeChoiceOverlay() : ''}
  </div>`;
}

function modeChoiceOverlay() {
  const c = card(app.game.players[0].hand[app.modeChoice]);
  return `<div class="overlay"><div class="modal">
    <h2>${esc(c.name)} を召喚</h2>
    <p>どちらのモードで出しますか？<br>
      <span style="color:#ff9c6b">攻撃モード ⚔${c.atk}</span>：殴れる。相手の攻撃モンスターとぶつかると弱い方が破壊。<br>
      <span style="color:#7fc4ff">防御モード 🛡${c.def}</span>：攻撃できないが、🛡分のダメージを受け止める。</p>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn primary" data-summonmode="attack">⚔ 攻撃モード</button>
      <button class="btn" data-summonmode="defense">🛡 防御モード</button>
      <button class="btn" data-cancel>やめる</button>
    </div>
  </div></div>`;
}

function resultOverlay() {
  const r = app.result;
  return `<div class="overlay"><div class="modal">
    <h2>${r.win ? '勝利！' : '敗北…'}</h2>
    <p>${esc(r.reason)}</p>
    ${r.reward ? `<p style="color:var(--gold)">報酬: ${PACK_TYPES[r.reward].name} を1つ獲得！</p>` : ''}
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn primary" data-go="campaign">地図へ戻る</button>
      <button class="btn" data-rematch>もう一度</button>
    </div>
  </div></div>`;
}

function packOverlay() {
  const cards = app.packResult.map(id => cardHtml(card(id), {})).join('');
  return `<div class="overlay"><div class="modal" style="max-width:640px">
    <h2>パック開封！</h2>
    <div class="grid" style="margin:14px 0">${cards}</div>
    <button class="btn primary" data-closepack>受け取る</button>
  </div></div>`;
}

// ============================================================
// サポートのターゲット候補
// ============================================================
function supportTargetSlots(g, handIndex) {
  const id = g.players[0].hand[handIndex];
  const c = card(id);
  const res = { self: [], enemy: [] };
  if (!c || c.type !== 'support') return res;
  const e = c.effects.find(x => x.op === 'equip' || x.target === 'one');
  if (!e) return res;
  if (e.op === 'equip') { res.self = fieldMonsters(g.players[0]).map(x => x.i); return res; }
  const sideKey = e.side === 'enemy' ? 'enemy' : 'self';
  const p = g.players[e.side === 'enemy' ? 1 : 0];
  res[sideKey] = fieldMonsters(p).filter(({ m }) => matchFilter(m, e.filter)).map(x => x.i);
  return res;
}

// ============================================================
// 入力処理
// ============================================================
function onBattleClick(ev) {
  const g = app.game;
  if (!g || g.winner !== null) return;
  const t = ev.target.closest('[data-hand],[data-side],[data-attackface],[data-endturn],[data-cancel],[data-summonmode],[data-toggle-log]');
  if (!t) return;

  if (t.dataset.toggleLog !== undefined) { app.logOpen = !app.logOpen; return render(); }
  if (t.dataset.cancel !== undefined) { app.sel = null; app.modeChoice = null; app.hint = ''; return render(); }
  if (g.active !== 0) return;

  // 手札上限で捨てるフェーズ
  if (g.phase === 'discard' && t.dataset.hand !== undefined) {
    applyAction(g, 0, { type: 'discard', hand: Number(t.dataset.hand) });
    afterAction();
    return;
  }
  if (g.phase !== 'main') return;

  if (t.dataset.summonmode) {
    const i = app.modeChoice;
    app.modeChoice = null;
    applyAction(g, 0, { type: 'summon', hand: i, mode: t.dataset.summonmode });
    app.sel = null; afterAction(); return;
  }
  if (t.dataset.endturn !== undefined) {
    app.sel = null;
    applyAction(g, 0, { type: 'end' });
    afterAction(); return;
  }
  if (t.dataset.attackface !== undefined && app.sel && app.sel.kind === 'attack') {
    applyAction(g, 0, { type: 'attack', slot: app.sel.slot, target: 'face' });
    app.sel = null; afterAction(); return;
  }

  // --- 手札クリック ---
  if (t.dataset.hand !== undefined) {
    const i = Number(t.dataset.hand);
    const id = g.players[0].hand[i];
    if (!id) return;
    if (isMonster(id)) {
      if (!canSummon(g, 0, i)) { flash('そのモンスターは今は出せません（コスト／召喚済み／場が満杯）'); return; }
      // 登場時効果でターゲットが要るか
      const c = card(id);
      const needs = (c.onSummon || []).some(e => e.target === 'one');
      if (needs) {
        app.sel = { kind: 'hand', i, needTarget: true };
        app.hint = `${c.name} の【登場時】対象を選んでください`;
        return render();
      }
      app.modeChoice = i; return render();
    }
    if (!canPlaySupport(g, 0, i)) { flash('そのサポートは今は使えません'); return; }
    if (supportNeedsTarget(id)) {
      app.sel = { kind: 'support', i };
      app.hint = `${card(id).name} の対象を選んでください`;
      return render();
    }
    applyAction(g, 0, { type: 'support', hand: i });
    app.sel = null; afterAction(); return;
  }

  // --- 盤面クリック ---
  if (t.dataset.side !== undefined) {
    const side = Number(t.dataset.side), slot = Number(t.dataset.slot);
    // サポート/登場時の対象選択
    if (app.sel && (app.sel.kind === 'support' || app.sel.needTarget)) {
      if (app.sel.kind === 'support') {
        const tg = supportTargetSlots(g, app.sel.i);
        const ok = side === 0 ? tg.self.includes(slot) : tg.enemy.includes(slot);
        if (!ok) { flash('その対象は選べません'); return; }
        applyAction(g, 0, { type: 'support', hand: app.sel.i, target: { slot } });
        app.sel = null; app.hint = ''; afterAction(); return;
      }
      // モンスターの登場時対象 → モード選択へ
      app.pendingSummonTarget = { slot };
      app.modeChoice = app.sel.i;
      app.sel = null;
      return render();
    }
    // 自分のモンスター → 攻撃 or モード変更
    if (side === 0) {
      const m = g.players[0].field[slot];
      if (!m) return;
      if (app.sel && app.sel.kind === 'attack' && app.sel.slot === slot) { app.sel = null; app.hint = ''; return render(); }
      if (canAttack(g, 0, slot)) {
        app.sel = { kind: 'attack', slot };
        app.hint = '攻撃する対象を選んでください（右クリックでモード変更）';
        return render();
      }
      if (canChangeMode(g, 0, slot)) {
        applyAction(g, 0, { type: 'mode', slot });
        afterAction(); return;
      }
      flash('このモンスターは行動できません');
      return;
    }
    // 相手のモンスター → 攻撃実行
    if (app.sel && app.sel.kind === 'attack') {
      const legal = legalAttackTargets(g, 0, app.sel.slot);
      if (!legal.includes(slot)) { flash('【守護】がいるため、そのモンスターは攻撃できません'); return; }
      applyAction(g, 0, { type: 'attack', slot: app.sel.slot, target: slot });
      app.sel = null; app.hint = ''; afterAction(); return;
    }
  }
}

function onBattleContext(ev) {
  const g = app.game;
  const t = ev.target.closest('[data-side="0"]');
  if (!t || !g || g.active !== 0 || g.phase !== 'main') return;
  ev.preventDefault();
  const slot = Number(t.dataset.slot);
  if (canChangeMode(g, 0, slot)) { applyAction(g, 0, { type: 'mode', slot }); afterAction(); }
  else flash('モード変更はできません（1ターン1回・攻撃後は不可）');
}

function flash(msg) {
  app.hint = msg;
  render();
  setTimeout(() => { if (app.hint === msg) { app.hint = ''; render(); } }, 1800);
}

function afterAction() {
  const g = app.game;
  render();
  if (g.winner !== null) return finishGame();
  if (g.active === 1 && g.phase !== 'discard') scheduleAi();
  else if (g.active === 1 && g.phase === 'discard') scheduleAi();
}

// ---------- AI ターン ----------
function scheduleAi() {
  clearTimeout(app.aiTimer);
  app.aiTimer = setTimeout(aiStep, 520);
}
function aiStep() {
  const g = app.game;
  if (!g || g.winner !== null) { render(); return finishGame(); }
  if (g.active !== 1) { render(); return; }
  if (g.phase === 'discard') {
    // AI の捨て札
    const p = g.players[1];
    let worst = 0, ws = Infinity;
    p.hand.forEach((id, i) => { const c = card(id); const s = c.cost * 2 + (c.type === 'monster' ? c.atk + c.def : 4); if (s < ws) { ws = s; worst = i; } });
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
  const key = app.enemyKey;
  let reward = null;
  if (win) {
    app.save.stats.wins++;
    if (key && !app.save.cleared[key]) {
      app.save.cleared[key] = true;
      const areaId = key.split(':')[0];
      reward = REWARD[areaId];
      app.save.packs[reward] = (app.save.packs[reward] || 0) + 1;
    }
  } else app.save.stats.losses++;
  writeSave(app.save);
  app.result = { win, reason: g.reason, reward };
  render();
}

// ============================================================
// バトル開始
// ============================================================
function startBattle(ai, ei) {
  const area = AREAS[ai], enemy = area.enemies[ei];
  app.enemy = enemy;
  app.enemyKey = `${area.id}:${ei}`;
  app.result = null; app.sel = null; app.modeChoice = null; app.hint = '';
  const seed = (Math.random() * 1e9) | 0;
  app.game = createGame({
    decks: [[...app.save.deck], [...enemy.deck]],
    seed, names: ['あなた', enemy.name],
    startCost: [0, enemy.startCost || 0],
  });
  if (enemy.life) app.game.players[1].life = enemy.life;
  // マリガン: 1〜2コストが1枚も無ければ自動で引き直す（初心者向け）
  const cheap = app.game.players[0].hand.filter(id => card(id).cost <= 2).length;
  mulligan(app.game, 0, cheap === 0);
  const ec = app.game.players[1].hand.filter(id => card(id).cost <= 2).length;
  mulligan(app.game, 1, ec === 0);
  app.screen = 'battle';
  render();
  if (app.game.active === 1) scheduleAi();
}

// ============================================================
// ルーティング
// ============================================================
function render() {
  let html;
  switch (app.screen) {
    case 'campaign': html = renderCampaign(); break;
    case 'deck': html = renderDeck(); break;
    case 'collection': html = renderCollection(); break;
    case 'rules': html = renderRules(); break;
    case 'battle': html = renderBattle(); break;
    default: html = renderTitle();
  }
  if (app.packResult) html += packOverlay();
  $app.innerHTML = html;
}

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-go],[data-fight],[data-add],[data-rem],[data-savedeck],[data-resetdeck],[data-openpack],[data-closepack],[data-rematch]');
  if (t) {
    if (t.dataset.go) {
      clearTimeout(app.aiTimer);
      app.screen = t.dataset.go; app.result = null;
      if (t.dataset.go === 'deck') app.deckDraft = [...app.save.deck];
      return render();
    }
    if (t.dataset.fight) { const [a, e] = t.dataset.fight.split(':').map(Number); return startBattle(a, e); }
    if (t.dataset.add) {
      const id = t.dataset.add, d = app.deckDraft;
      const have = d.filter(x => x === id).length;
      if (d.length < 30 && have < Math.min(3, app.save.collection[id])) d.push(id);
      return render();
    }
    if (t.dataset.rem) {
      const i = app.deckDraft.lastIndexOf(t.dataset.rem);
      if (i >= 0) app.deckDraft.splice(i, 1);
      return render();
    }
    if (t.dataset.savedeck !== undefined) {
      app.save.deck = [...app.deckDraft]; writeSave(app.save);
      app.screen = 'title'; return render();
    }
    if (t.dataset.resetdeck !== undefined) { app.deckDraft = [...STARTER_DECK]; return render(); }
    if (t.dataset.openpack) {
      const k = t.dataset.openpack;
      if ((app.save.packs[k] || 0) <= 0) return;
      app.save.packs[k]--;
      app.packResult = openPack(k);
      addCards(app.save, app.packResult); writeSave(app.save);
      return render();
    }
    if (t.dataset.closepack !== undefined) { app.packResult = null; return render(); }
    if (t.dataset.rematch !== undefined) {
      const [a, e] = app.enemyKey.split(':');
      const ai = AREAS.findIndex(x => x.id === a);
      return startBattle(ai, Number(e));
    }
  }
  if (app.screen === 'battle') onBattleClick(ev);
});
document.addEventListener('contextmenu', ev => { if (app.screen === 'battle') onBattleContext(ev); });

// ============================================================
// デバッグ／スクリーンショット用フック
// ============================================================
function makeDemo(areaIndex = 0, enemyIndex = 2) {
  startBattle(areaIndex, enemyIndex);
  const g = app.game;
  const put = (side, slot, id, mode) => {
    const p = g.players[side];
    const c = card(id);
    p.field[slot] = { uid: g.uid++, id, atk: c.atk, def: c.def, mode, hasAttacked: false, modeChanged: false, tempAtk: 0, tempDef: 0, equips: [] };
  };
  put(1, 0, 'w08', 'defense'); put(1, 1, 'f09', 'attack'); put(1, 2, 'g04', 'attack');
  put(0, 0, 'f05', 'attack'); put(0, 1, 'g05', 'defense'); put(0, 2, 'w03', 'attack');
  g.players[0].supports[0] = { uid: g.uid++, id: 'sf2', attachedTo: g.players[0].field[0].uid, slot: 0 };
  g.players[0].field[0].atk += 2;
  g.players[1].supports[0] = { uid: g.uid++, id: 'sw2', attachedTo: g.players[1].field[0].uid, slot: 0 };
  g.players[1].field[0].def += 4;
  g.players[0].life = 14; g.players[1].life = 11;
  g.players[0].maxCost = 5; g.players[0].cost = 4;
  g.players[1].maxCost = 5; g.players[1].cost = 5;
  g.turn = 9; g.active = 0; g.phase = 'main';
  g.players[0].hand = ['f09', 'sf1', 'g07', 'sn6', 'w05'];
  g.players[1].hand = ['w01', 'w03', 'sw1'];
  render();
}

window.__TE = { app, render, startBattle, makeDemo, card, ALL_CARDS, afterAction, scheduleAi, applyAction };

render();
