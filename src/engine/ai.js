// ============================================================
// AI: 1手先読みの貪欲探索
//  - 合法手を全列挙 → それぞれ適用した状態を評価 → 最良を実行
//  - 改善が無くなったらターン終了
// テストプレイ(sim)の対戦相手としてもそのまま使う
// ============================================================
import { card } from './cards.js';
import {
  legalActions, applyAction, other, fieldMonsters, effAtk, effDef,
  isMonster, matchFilter, emptySlot, hasKw,
} from './game.js';

const WIN = 100000;

export function monsterValue(m) {
  // モードによって「盤面としての価値」が変わる
  const atk = effAtk(m), def = effDef(m);
  let v = m.mode === 'attack' ? atk * 1.0 + def * 0.35 : def * 0.85 + atk * 0.3;
  if (hasKw(m, 'guard')) v += 2;
  if (hasKw(m, 'pierce')) v += 1;
  if (hasKw(m, 'double')) v += atk * 0.8;
  return v;
}

// 次の相手ターンに受けそうなダメージの見積り。
// これが無いと AI が「防御モード」「守護」の価値を一切評価できない。
export function estimateIncoming(state, pi) {
  const me = state.players[pi], op = state.players[other(pi)];
  const attackers = fieldMonsters(op).filter(({ m }) => m.mode === 'attack')
    .map(({ m }) => m).sort((a, b) => effAtk(b) - effAtk(a));
  if (!attackers.length) return 0;
  const blockers = fieldMonsters(me).map(({ m }) => ({
    atk: effAtk(m), def: effDef(m), mode: m.mode, el: card(m.id).element,
    guard: hasKw(m, 'guard'), alive: true,
  }));
  let dmg = 0;
  for (const a of attackers) {
    const alive = blockers.filter(b => b.alive);
    if (!alive.length) { dmg += effAtk(a); continue; } // 直接攻撃
    const pool = (alive.some(b => b.guard) && !hasKw(a, 'pierce')) ? alive.filter(b => b.guard) : alive;
    const aEl = card(a.id).element;
    let best = null, bestGain = -Infinity;
    for (const b of pool) {
      const bon = STRONG[aEl] === b.el ? state.rules.elementBonus : 0;
      const dmgMode = state.rules.elementBonusMode === 'damage';
      const aAtk = effAtk(a) + (dmgMode ? 0 : bon);
      const aDmg = effAtk(a) + bon;
      let d = 0, kill = false, selfDie = false;
      if (b.mode === 'attack') {
        if (aAtk > b.atk) { d = aDmg - b.atk; kill = true; }
        else if (aAtk < b.atk) { selfDie = true; }
        else { kill = true; selfDie = true; }
      } else if (aAtk > b.def) {
        kill = true;
        const mo = state.rules.defenseExcessDamage;
        if (mo === 'half') d = Math.ceil((aDmg - b.def) / 2);
        else if (mo) d = aDmg - b.def;
      } else if (state.rules.defenseKillsAttacker) {
        selfDie = true;
      }
      const gain = d * 1.0 + (kill ? b.atk * 0.6 : 0) - (selfDie ? effAtk(a) * 0.6 : 0);
      if (gain > bestGain) { bestGain = gain; best = { b, d, kill, selfDie }; }
    }
    if (best && bestGain > 0) {
      dmg += best.d * (hasKw(a, 'double') ? 1.6 : 1);
      if (best.kill) best.b.alive = false;
    }
  }
  return dmg;
}
const STRONG = { fire: 'grass', grass: 'water', water: 'fire' };

// AI の性格（重み）。バランス検証のため差し替えられるようにしてある。
export const PROFILES = {
  balanced: { lifeDiff: 2.2, closing: 0.6, myBoard: 1.6, oppBoard: 1.6, incoming: 1.7, hand: 1.6, oppHand: 1.0, deck: 0.5, cost: 0.15 },
  aggro:    { lifeDiff: 2.6, closing: 1.4, myBoard: 1.3, oppBoard: 1.3, incoming: 0.5, hand: 1.2, oppHand: 0.8, deck: 0.3, cost: 0.15 },
  turtle:   { lifeDiff: 2.0, closing: 0.2, myBoard: 1.9, oppBoard: 1.9, incoming: 2.8, hand: 1.8, oppHand: 1.0, deck: 0.7, cost: 0.15 },
};

export function evaluate(state, pi, w = PROFILES.balanced) {
  if (state.winner !== null) return state.winner === pi ? WIN : -WIN;
  const me = state.players[pi], op = state.players[other(pi)];
  let s = 0;
  s += (me.life - op.life) * w.lifeDiff;
  s += Math.max(0, 20 - op.life) * w.closing;   // 相手を削り切れる見込み
  s += fieldMonsters(me).reduce((a, { m }) => a + monsterValue(m), 0) * w.myBoard;
  s -= fieldMonsters(op).reduce((a, { m }) => a + monsterValue(m), 0) * w.oppBoard;
  s -= estimateIncoming(state, pi) * w.incoming; // 次ターン受けるダメージ
  s += me.hand.length * w.hand - op.hand.length * w.oppHand;
  s += Math.min(me.deck.length, 8) * w.deck;    // デッキ切れが近いと危険
  s -= Math.min(op.deck.length, 12) * 0.28;  // 相手の山札を削る価値
  s += me.cost * w.cost;                        // コストを余らせない
  return s;
}

// ---- ターゲット候補の展開 ----
function targetedOp(state, pi, id) {
  const c = card(id);
  const ops = c.type === 'monster' ? (c.onSummon || []) : c.effects;
  return ops.find(e => e.op === 'equip' || e.target === 'one' || e.op === 'revive'
    || e.op === 'recallSupport' || e.op === 'recallMonster');
}

export function expandTargets(state, pi, act) {
  const p = state.players[pi];
  const id = act.type === 'summon' || act.type === 'support' ? p.hand[act.hand] : null;
  if (!id) return [act];
  const e = targetedOp(state, pi, id);
  if (!e) return [act];
  if (e.op === 'equip') {
    return fieldMonsters(p).map(({ i }) => ({ ...act, target: { slot: i } }));
  }
  if (e.op === 'revive') {
    return p.grave.map((gid, i) => (isMonster(gid) && card(gid).cost <= e.maxCost ? { ...act, target: { grave: i } } : null))
      .filter(Boolean);
  }
  if (e.op === 'recallSupport') {
    return p.grave.map((gid, i) => (!isMonster(gid) ? { ...act, target: { grave: i } } : null)).filter(Boolean);
  }
  if (e.op === 'recallMonster') {
    return p.grave.map((gid, i) => (isMonster(gid) ? { ...act, target: { grave: i } } : null)).filter(Boolean);
  }
  // target: 'one'
  const side = e.side === 'enemy' ? other(pi) : pi;
  const tp = state.players[side];
  const cands = fieldMonsters(tp).filter(({ m }) => matchFilter(m, e.filter)).map(({ i }) => ({ ...act, target: { slot: i } }));
  return cands.length ? cands : [];
}

function actionKey(a) { return `${a.type}:${a.hand ?? ''}:${a.slot ?? ''}:${a.target?.slot ?? a.target?.grave ?? a.target ?? ''}:${a.mode ?? ''}`; }

// ---- 1手だけ選ぶ（UI でアニメーション表示するため分離） ----
export function aiChooseAction(state, pi, opts = {}) {
  const noise = opts.noise ?? 0;
  const rand = opts.rand ?? Math.random;
  const w = PROFILES[opts.profile || 'balanced'] || PROFILES.balanced;
  if (state.winner !== null || state.active !== pi || state.phase !== 'main') return null;
  if (state.pendingChoice?.type === 'observe' && state.pendingChoice.pi === pi) {
    let best = 0, score = -Infinity;
    state.pendingChoice.cards.forEach((id, i) => {
      const c = card(id);
      const v = c.cost * 2 + (c.type === 'monster' ? c.atk + c.def : 5);
      if (v > score) { score = v; best = i; }
    });
    return { type: 'observe', index: best };
  }
  const acts = [];
  for (const a of legalActions(state, pi)) {
    if (a.type === 'end') continue;
    for (const x of expandTargets(state, pi, a)) acts.push(x);
  }
  if (!acts.length) return null;
  let best = null, bestScore = evaluate(state, pi, w) + 0.001;
  for (const a of acts) {
    const s2 = structuredClone(state);
    applyAction(s2, pi, a);
    let sc = evaluate(s2, pi, w);
    if (noise) sc += (rand() - 0.5) * noise;
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return best;
}

// ---- 1ターン分プレイする ----
export function aiTakeTurn(state, pi, opts = {}) {
  const maxSteps = opts.maxSteps ?? 40;
  for (let step = 0; step < maxSteps; step++) {
    if (state.winner !== null || state.active !== pi) return;
    if (state.phase === 'discard') { doDiscard(state, pi); continue; }
    if (state.phase !== 'main') return;
    const best = aiChooseAction(state, pi, opts);
    if (!best) break;
    applyAction(state, pi, best);
  }
  if (state.winner === null && state.active === pi) {
    applyAction(state, pi, { type: 'end' });
    while (state.phase === 'discard' && state.active === pi && state.winner === null) doDiscard(state, pi);
  }
}

export { doDiscard as aiDiscard };

function doDiscard(state, pi) {
  const p = state.players[pi];
  // 一番役に立たないカードを捨てる: コストが払えない高コスト → 重複 → 低価値
  let worst = 0, worstScore = Infinity;
  p.hand.forEach((id, i) => {
    const c = card(id);
    let sc = c.cost * 2 + (c.type === 'monster' ? c.atk + c.def : 4);
    if (c.cost > p.maxCost + 2) sc -= 12;
    if (sc < worstScore) { worstScore = sc; worst = i; }
  });
  applyAction(state, pi, { type: 'discard', hand: worst });
}
