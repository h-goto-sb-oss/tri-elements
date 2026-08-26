// ============================================================
// ゲームエンジン（純粋ロジック / ブラウザ・Node 両対応）
// 状態は plain object。structuredClone でコピーできる形に保つ。
// ============================================================
import { card, STRONG_AGAINST } from './cards.js';
import { DEFAULT_RULES } from './rules.js';

// ---------- RNG (mulberry32) ----------
export function rngNext(state) {
  let t = (state.rngState += 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- 初期化 ----------
export function createGame({ decks, seed = 1, rules = {}, names = ['あなた', '相手'], startCost = null }) {
  const R = { ...DEFAULT_RULES, ...rules };
  const state = {
    rules: R, rngState: seed >>> 0, uid: 1,
    turn: 0, active: 0, phase: 'mulligan', winner: null, reason: '',
    log: [], pendingDiscard: 0, names,
    players: [0, 1].map(i => ({
      name: names[i], life: R.startLife, cost: 0, maxCost: 0,
      deck: shuffle({ rngState: (seed + i * 7919) >>> 0 }, [...decks[i]]),
      hand: [], field: Array(R.fieldSlots).fill(null), supports: Array(R.supportSlots).fill(null),
      grave: [], summoned: false, summons: 0, forges: 0, fogUntil: -1, mulliganed: false,
    })),
  };
  // デッキは state の rng でシャッフルし直す（決定性のため）
  state.players.forEach(p => shuffle(state, p.deck));
  state.players.forEach((p, i) => {
    const n = R.startHand + (R.secondPlayerExtraCard && i === 1 ? 1 : 0);
    for (let k = 0; k < n; k++) p.hand.push(p.deck.pop());
  });
  if (startCost) startCost.forEach((v, i) => { if (v) state.players[i].maxCost = v - 1; });
  log(state, 'sys', `対戦開始。先攻: ${names[0]}`);
  return state;
}

function log(state, kind, text, extra = {}) {
  state.log.push({ kind, text, turn: state.turn, ...extra });
  if (state.log.length > 2000) state.log.shift();
}

// ---------- 補助 ----------
export const other = i => 1 - i;
export const isMonster = id => card(id).type === 'monster';

export function makeMonster(state, id, mode = 'attack') {
  const c = card(id);
  return {
    uid: state.uid++, id, atk: c.atk, def: c.def, mode,
    hasAttacked: false, attacks: 0, modeChanged: false, tempAtk: 0, tempDef: 0,
    equips: [], grants: [],
  };
}
export const eff = m => ({ atk: Math.max(0, m.atk + m.tempAtk), def: Math.max(0, m.def + m.tempDef) });
export const effAtk = m => Math.max(0, m.atk + m.tempAtk);
export const effDef = m => Math.max(0, m.def + m.tempDef);

export function elementBonus(state, atkM, defM) {
  const a = card(atkM.id).element, d = card(defM.id).element;
  return STRONG_AGAINST[a] === d ? state.rules.elementBonus : 0;
}
export const hasKw = (m, kw) => card(m.id).keywords.includes(kw) || (m.grants || []).includes(kw);
export const maxAttacks = m => (hasKw(m, 'double') ? 2 : 1);
export const fieldMonsters = p => p.field.map((m, i) => (m ? { m, i } : null)).filter(Boolean);
export const emptySlot = p => p.field.findIndex(x => x === null);

// ---------- ドロー ----------
function draw(state, pi, n = 1) {
  const p = state.players[pi];
  for (let k = 0; k < n; k++) {
    if (p.deck.length === 0) {
      endGame(state, other(pi), `${p.name} は山札が尽きた（デッキ切れ）`);
      return;
    }
    const id = p.deck.pop();
    p.hand.push(id);
    log(state, 'draw', `${p.name} がドロー`, { p: pi, cardId: id });
  }
}

function endGame(state, winner, reason) {
  if (state.winner !== null) return;
  state.winner = winner; state.reason = reason; state.phase = 'over';
  log(state, 'end', `${reason} → ${state.players[winner].name} の勝ち`);
}

function checkLife(state) {
  const [a, b] = state.players;
  if (a.life <= 0 && b.life <= 0) endGame(state, state.active, '相打ち');
  else if (a.life <= 0) endGame(state, 1, `${a.name} のライフが0`);
  else if (b.life <= 0) endGame(state, 0, `${b.name} のライフが0`);
}

export function damagePlayer(state, pi, v, src = '') {
  if (v <= 0) return;
  const p = state.players[pi];
  p.life -= v;
  log(state, 'damage', `${p.name} に ${v} ダメージ${src ? `（${src}）` : ''}`, { p: pi, v, src });
  checkLife(state);
}
export function healPlayer(state, pi, v) {
  const p = state.players[pi];
  p.life += v;
  log(state, 'heal', `${p.name} がライフ ${v} 回復`, { p: pi, v });
}

// ---------- 破壊 ----------
export function destroyMonster(state, pi, slot, opts = {}) {
  const p = state.players[pi];
  const m = p.field[slot];
  if (!m) return;
  if (!opts.ignoreFog && opts.byCombat && state.turn <= p.fogUntil) {
    log(state, 'info', `${card(m.id).name} は【森の加護】で破壊されなかった`);
    return;
  }
  p.field[slot] = null;
  // 装備サポートも一緒に墓地へ
  p.supports.forEach((s, si) => {
    if (s && s.attachedTo === m.uid) { p.grave.push(s.id); p.supports[si] = null; }
  });
  p.grave.push(m.id);
  log(state, 'destroy', `${card(m.id).name} が破壊された`, { p: pi, cardId: m.id });
  const od = card(m.id).onDeath;
  if (od) runEffects(state, pi, od, { auto: true, sourceName: card(m.id).name });
}

// ---------- 効果処理 ----------
// ctx: { target: {side,slot} | {grave:n} | null, auto: bool }
export function runEffects(state, pi, ops, ctx = {}) {
  for (const op of ops) {
    if (state.winner !== null) return;
    applyOp(state, pi, op, ctx);
  }
}

function resolveSide(pi, side) { return side === 'enemy' ? other(pi) : pi; }

function pickAuto(state, pi, side, filter) {
  // 自動ターゲット（断末魔など）: 相手なら最も攻撃力が高い、自分なら最も攻撃力が高い
  const tp = state.players[resolveSide(pi, side)];
  const cands = fieldMonsters(tp).filter(({ m }) => matchFilter(m, filter));
  if (!cands.length) return null;
  cands.sort((a, b) => effAtk(b.m) - effAtk(a.m));
  return { side, slot: cands[0].i };
}

export function matchFilter(m, filter) {
  if (!filter) return true;
  if (filter.maxAtk != null && effAtk(m) > filter.maxAtk) return false;
  if (filter.maxDef != null && effDef(m) > filter.maxDef) return false;
  if (filter.minCost != null && card(m.id).cost < filter.minCost) return false;
  if (filter.mode && m.mode !== filter.mode) return false;
  if (filter.element && card(m.id).element !== filter.element) return false;
  return true;
}

function applyOp(state, pi, op, ctx) {
  const me = state.players[pi], opp = state.players[other(pi)];
  switch (op.op) {
    case 'damageFace':
      damagePlayer(state, resolveSide(pi, op.side), op.v, ctx.sourceName);
      break;
    case 'heal':
      healPlayer(state, resolveSide(pi, op.side), op.v);
      break;
    case 'draw':
      draw(state, resolveSide(pi, op.side), op.n);
      break;
    case 'drawIfLowLife':
      if (me.life <= op.threshold) draw(state, pi, op.n);
      break;
    case 'setMode': {
      const tps = resolveSide(pi, op.side), tp = state.players[tps];
      const list = op.target === 'all'
        ? fieldMonsters(tp).map(x => x.i)
        : [pickSlot(state, pi, op, ctx)].filter(x => x != null);
      list.forEach(sl => {
        const m = tp.field[sl]; if (!m) return;
        if (m.mode !== op.mode) { m.mode = op.mode; if (!op.free && tps === pi) m.modeChanged = true; }
        log(state, 'info', `${card(m.id).name} が${op.mode === 'attack' ? '攻撃' : '防御'}モードになった`);
      });
      break;
    }
    case 'buff': {
      const tps = resolveSide(pi, op.side), tp = state.players[tps];
      const list = op.target === 'all'
        ? fieldMonsters(tp).filter(({ m }) => matchFilter(m, op.filter)).map(x => x.i)
        : [pickSlot(state, pi, op, ctx)].filter(x => x != null);
      list.forEach(sl => {
        const m = tp.field[sl]; if (!m) return;
        if (op.duration === 'turn') { m.tempAtk += op.atk; m.tempDef += op.def; }
        else { m.atk += op.atk; m.def += op.def; }
        log(state, 'buff', `${card(m.id).name} が +${op.atk}/+${op.def}`, { p: tps });
      });
      break;
    }
    case 'destroy': {
      const tps = resolveSide(pi, op.side);
      const sl = pickSlot(state, pi, op, ctx);
      if (sl != null) destroyMonster(state, tps, sl);
      break;
    }
    case 'mill': {
      const tps = resolveSide(pi, op.side), tp = state.players[tps];
      let n = 0;
      for (let k = 0; k < op.n && tp.deck.length; k++) { tp.grave.push(tp.deck.pop()); n++; }
      log(state, 'info', `${tp.name} の山札を ${n} 枚 墓地へ送った（残り ${tp.deck.length}）`);
      break;
    }
    case 'defAsAtk': {
      const tps = resolveSide(pi, op.side || 'self'), tp = state.players[tps];
      const list = op.target === 'all' ? fieldMonsters(tp).map(x => x.i)
        : [pickSlot(state, pi, { ...op, side: op.side || 'self' }, ctx)].filter(x => x != null);
      list.forEach(sl => {
        const m = tp.field[sl]; if (!m) return;
        const gain = effDef(m) - effAtk(m);
        if (gain > 0) m.tempAtk += gain;
        log(state, 'info', `${card(m.id).name} は防御力で殴る（⚔${effAtk(m)}）`);
      });
      break;
    }
    case 'destroyAll':
      [0, 1].forEach(x => state.players[x].field.forEach((m, i) => m && destroyMonster(state, x, i)));
      break;
    case 'destroyAllFiltered': {
      const tps = resolveSide(pi, op.side), tp = state.players[tps];
      tp.field.forEach((m, i) => { if (m && matchFilter(m, op.filter)) destroyMonster(state, tps, i); });
      break;
    }
    case 'bounce': {
      const tps = resolveSide(pi, op.side), tp = state.players[tps];
      const slots = op.target === 'all'
        ? fieldMonsters(tp).map(x => x.i)
        : [pickSlot(state, pi, op, ctx)].filter(x => x != null);
      slots.forEach(sl => {
        const m = tp.field[sl]; if (!m) return;
        tp.field[sl] = null;
        tp.supports.forEach((s, si) => { if (s && s.attachedTo === m.uid) { tp.grave.push(s.id); tp.supports[si] = null; } });
        tp.hand.push(m.id);
        log(state, 'info', `${card(m.id).name} が手札に戻った`);
      });
      break;
    }
    case 'invuln':
      me.fogUntil = state.turn + 1; // このターン + 次の相手ターン
      log(state, 'info', `${me.name} のモンスターは次の相手ターン終了まで戦闘で破壊されない`);
      break;
    case 'revive': {
      const gi = ctx.target && ctx.target.grave != null ? ctx.target.grave : autoGraveMonster(me, op.maxCost);
      if (gi == null) break;
      const slot = emptySlot(me); if (slot < 0) break;
      const id = me.grave[gi];
      if (!id || !isMonster(id) || card(id).cost > op.maxCost) break;
      me.grave.splice(gi, 1);
      me.field[slot] = makeMonster(state, id, 'attack');
      log(state, 'summon', `${card(id).name} が墓地から蘇った`, { p: pi, cardId: id });
      const os = card(id).onSummon;
      if (os) runEffects(state, pi, os, { auto: true, sourceName: card(id).name });
      break;
    }
    case 'recallSupport': {
      const gi = ctx.target && ctx.target.grave != null ? ctx.target.grave
        : me.grave.map((id, i) => (!isMonster(id) ? i : null)).filter(x => x != null).pop();
      if (gi == null) break;
      const id = me.grave[gi]; if (!id || isMonster(id)) break;
      me.grave.splice(gi, 1); me.hand.push(id);
      log(state, 'info', `${card(id).name} を手札に戻した`);
      break;
    }
    case 'sacrificeBurn': {
      const sl = pickSlot(state, pi, { ...op, side: 'self' }, ctx);
      if (sl == null) break;
      const m = me.field[sl]; if (!m) break;
      const dmg = effAtk(m);
      destroyMonster(state, pi, sl, { ignoreFog: true });
      damagePlayer(state, other(pi), dmg, '決死の一撃');
      break;
    }
    default:
      console.warn('unknown op', op.op);
  }
}

function autoGraveMonster(p, maxCost) {
  let best = null, bestCost = -1;
  p.grave.forEach((id, i) => {
    if (isMonster(id) && card(id).cost <= maxCost && card(id).cost > bestCost) { best = i; bestCost = card(id).cost; }
  });
  return best;
}

function pickSlot(state, pi, op, ctx) {
  if (ctx.target && ctx.target.slot != null && !ctx.auto) return ctx.target.slot;
  if (ctx.target && ctx.target.slot != null) return ctx.target.slot;
  const auto = pickAuto(state, pi, op.side || 'enemy', op.filter);
  return auto ? auto.slot : null;
}

// ============================================================
// ターン進行
// ============================================================
export function startTurn(state) {
  const R = state.rules;
  state.turn++;
  if (state.turn > R.maxTurns) { endGame(state, state.players[0].life >= state.players[1].life ? 0 : 1, 'ターン数上限'); return; }
  const pi = state.active, p = state.players[pi];
  p.maxCost = Math.min(p.maxCost + 1, R.maxCostCap);
  p.cost = p.maxCost;
  if (R.secondPlayerBonusCost && pi === 1 && state.turn === 2) p.cost += R.secondPlayerBonusCost;
  p.summoned = false; p.summons = 0; p.forges = 0;
  p.field.forEach(m => { if (m) { m.hasAttacked = false; m.attacks = 0; m.modeChanged = false; m.tempAtk = 0; m.tempDef = 0; } });
  log(state, 'turn', `── ${p.name} のターン ${state.turn}（コスト ${p.cost}）`, { p: pi });

  // ターン開始時トリガー
  p.field.forEach(m => {
    if (m && card(m.id).onTurnStart) runEffects(state, pi, card(m.id).onTurnStart, { auto: true, sourceName: card(m.id).name });
  });
  if (state.winner !== null) return;

  const isFirstPlayerFirstTurn = state.turn === 1 && pi === 0;
  if (!(R.firstPlayerNoDraw && isFirstPlayerFirstTurn)) draw(state, pi, 1);
  state.phase = 'main';
}

export function endTurn(state) {
  const pi = state.active, p = state.players[pi], R = state.rules;
  if (p.hand.length > R.handLimit) { state.pendingDiscard = p.hand.length - R.handLimit; state.phase = 'discard'; return false; }
  // 相手ターンへ
  p.field.forEach(m => { if (m) { m.tempAtk = 0; m.tempDef = 0; } });
  state.active = other(pi);
  startTurn(state);
  return true;
}

export function discardCard(state, handIndex) {
  const p = state.players[state.active];
  const id = p.hand.splice(handIndex, 1)[0];
  p.grave.push(id);
  log(state, 'info', `${p.name} が ${card(id).name} を捨てた（手札上限）`);
  state.pendingDiscard--;
  if (state.pendingDiscard <= 0) { state.phase = 'main'; endTurn(state); }
}

// ============================================================
// アクション
// ============================================================
export function canSummon(state, pi, handIndex) {
  const p = state.players[pi], id = p.hand[handIndex];
  if (!id || !isMonster(id)) return false;
  if ((p.summons || 0) >= state.rules.summonsPerTurn) return false;
  if (card(id).cost > p.cost) return false;
  return emptySlot(p) >= 0;
}

export function canForge(state, pi) {
  const p = state.players[pi], R = state.rules;
  return p.cost >= R.forgeCost && (p.forges || 0) < R.forgePerTurn && p.deck.length > 0;
}
export function forge(state, pi) {
  if (!canForge(state, pi)) return false;
  const p = state.players[pi];
  p.cost -= state.rules.forgeCost;
  p.forges = (p.forges || 0) + 1;
  log(state, 'info', `${p.name} が鍛錬（コスト${state.rules.forgeCost}）でカードを1枚引いた`, { p: pi });
  draw(state, pi, 1);
  return true;
}

export function summon(state, pi, handIndex, mode = 'attack', wantSlot = null) {
  if (!canSummon(state, pi, handIndex)) return false;
  const p = state.players[pi], id = p.hand.splice(handIndex, 1)[0];
  p.cost -= card(id).cost;
  p.summons = (p.summons || 0) + 1;
  p.summoned = true;
  const slot = (wantSlot != null && p.field[wantSlot] === null) ? wantSlot : emptySlot(p);
  const m = makeMonster(state, id, mode);
  if (!state.rules.summonModeIsFree && mode === 'defense') m.modeChanged = true;
  p.field[slot] = m;
  log(state, 'summon', `${p.name} が ${card(id).name} を${mode === 'attack' ? '攻撃' : '防御'}モードで召喚`, { p: pi, cardId: id, mode });
  const os = card(id).onSummon;
  if (os) runEffects(state, pi, os, { sourceName: card(id).name, target: state.pendingTarget || null });
  state.pendingTarget = null;
  return true;
}

export function supportNeedsTarget(id) {
  const c = card(id);
  if (c.type !== 'support') return false;
  return c.effects.some(e => e.op === 'equip' || (e.target === 'one') || e.op === 'revive' || e.op === 'recallSupport');
}

export function canPlaySupport(state, pi, handIndex) {
  const p = state.players[pi], id = p.hand[handIndex];
  if (!id || isMonster(id)) return false;
  const c = card(id);
  if (c.cost > p.cost) return false;
  if (c.equip) {
    if (p.supports.findIndex(s => s === null) < 0) return false;
    if (fieldMonsters(p).length === 0) return false;
  }
  // ターゲットが必須なのに対象がいない場合は使えない
  for (const e of c.effects) {
    if (e.target === 'one') {
      const tp = state.players[resolveSide(pi, e.side)];
      if (!fieldMonsters(tp).some(({ m }) => matchFilter(m, e.filter))) return false;
    }
    if (e.op === 'revive') {
      if (emptySlot(p) < 0) return false;
      if (!p.grave.some(gid => isMonster(gid) && card(gid).cost <= e.maxCost)) return false;
    }
    if (e.op === 'recallSupport' && !p.grave.some(gid => !isMonster(gid))) return false;
  }
  return true;
}

export function playSupport(state, pi, handIndex, target = null) {
  if (!canPlaySupport(state, pi, handIndex)) return false;
  const p = state.players[pi], id = p.hand[handIndex], c = card(id);
  p.hand.splice(handIndex, 1);
  p.cost -= c.cost;
  log(state, 'support', `${p.name} が ${c.name} を使用`, { p: pi, cardId: id });
  if (c.equip) {
    const e = c.effects.find(x => x.op === 'equip');
    let slot = target && target.slot != null ? target.slot : null;
    if (slot == null || !p.field[slot]) {
      const cands = fieldMonsters(p).sort((a, b) => effAtk(b.m) - effAtk(a.m));
      slot = cands.length ? cands[0].i : null;
    }
    if (slot == null) { p.grave.push(id); return true; }
    const m = p.field[slot];
    m.atk += e.atk; m.def += e.def;
    if (e.grants) { m.grants = [...(m.grants || []), ...e.grants]; }
    const si = p.supports.findIndex(s => s === null);
    p.supports[si] = { uid: state.uid++, id, attachedTo: m.uid, slot: si };
    log(state, 'buff', `${card(m.id).name} に ${c.name} を装備 (+${e.atk}/+${e.def})`, { p: pi });
  } else {
    runEffects(state, pi, c.effects, { target, sourceName: c.name });
    p.grave.push(id);
  }
  return true;
}

export function canChangeMode(state, pi, slot) {
  const m = state.players[pi].field[slot];
  if (!m) return false;
  if (m.modeChanged) return false;
  if (!state.rules.modeChangeAfterAttack && (m.attacks || 0) > 0) return false;
  return true;
}
export function changeMode(state, pi, slot) {
  if (!canChangeMode(state, pi, slot)) return false;
  const m = state.players[pi].field[slot];
  m.mode = m.mode === 'attack' ? 'defense' : 'attack';
  m.modeChanged = true;
  log(state, 'mode', `${card(m.id).name} を${m.mode === 'attack' ? '攻撃' : '防御'}モードに変更`, { p: pi, mode: m.mode });
  return true;
}

export function legalAttackTargets(state, pi, attackerSlot = null) {
  const opp = state.players[other(pi)];
  const ms = fieldMonsters(opp);
  if (ms.length === 0) return ['face'];
  const attacker = attackerSlot != null ? state.players[pi].field[attackerSlot] : null;
  const ignoreGuard = !!attacker && hasKw(attacker, 'pierce'); // 【貫通】は守護を無視
  const guards = ms.filter(({ m }) => hasKw(m, 'guard'));
  return (guards.length && !ignoreGuard ? guards : ms).map(x => x.i);
}

export function canAttack(state, pi, slot) {
  const m = state.players[pi].field[slot];
  return !!m && m.mode === 'attack' && (m.attacks || 0) < maxAttacks(m);
}

export function attack(state, pi, slot, target) {
  if (!canAttack(state, pi, slot)) return false;
  const R = state.rules, me = state.players[pi], oi = other(pi), opp = state.players[oi];
  const A = me.field[slot];
  const targets = legalAttackTargets(state, pi, slot);
  if (!targets.includes(target)) return false;
  A.attacks = (A.attacks || 0) + 1;
  A.hasAttacked = true;

  if (target === 'face') {
    const dmg = effAtk(A);
    log(state, 'attack', `${card(A.id).name} が直接攻撃！`, { p: pi, direct: true });
    damagePlayer(state, oi, dmg, card(A.id).name);
    return true;
  }
  const D = opp.field[target];
  const bonus = elementBonus(state, A, D);
  const dmgMode = R.elementBonusMode === 'damage';
  // 破壊判定に使う攻撃力（'damage' モードでは属性ボーナスを乗せない）
  const aAtk = effAtk(A) + (dmgMode ? 0 : bonus);
  // ダメージ計算に使う攻撃力（常にボーナス込み）
  const aDmg = effAtk(A) + bonus;
  log(state, 'attack', `${card(A.id).name}(${aAtk}${bonus ? ' 属性有利' : ''}) → ${card(D.id).name}`, { p: pi });

  if (D.mode === 'attack') {
    const dAtk = effAtk(D);
    if (aAtk > dAtk) {
      destroyMonster(state, oi, target, { byCombat: true });
      damagePlayer(state, oi, aDmg - dAtk, '超過ダメージ');
    } else if (aAtk < dAtk) {
      destroyMonster(state, pi, slot, { byCombat: true });
      if (R.reflectOnAttackerLoss) damagePlayer(state, pi, dAtk - aAtk, '返り討ち');
    } else {
      destroyMonster(state, oi, target, { byCombat: true });
      destroyMonster(state, pi, slot, { byCombat: true });
    }
  } else {
    const dDef = effDef(D);
    if (aAtk > dDef) {
      destroyMonster(state, oi, target, { byCombat: true });
      const exc = aDmg - dDef;
      const mode = R.defenseExcessDamage;   // false | 'half' | true(=full)
      if (mode === 'half') damagePlayer(state, oi, Math.ceil(exc / 2), '守備貫通(半減)');
      else if (mode) damagePlayer(state, oi, exc, '守備貫通');
      else if (hasKw(A, 'pierce2')) damagePlayer(state, oi, exc, '貫通');
    } else {
      log(state, 'info', `${card(D.id).name} は耐えた（防御 ${dDef}）`);
      if (R.defenseKillsAttacker) {
        destroyMonster(state, pi, slot, { byCombat: true });
        log(state, 'info', `${card(A.id).name} は跳ね返された`);
      }
      if (R.defenseReflect && dDef > aAtk) damagePlayer(state, pi, dDef - aAtk, '反射');
    }
  }
  return true;
}

// ---------- マリガン ----------
export function mulligan(state, pi, doIt) {
  const p = state.players[pi];
  if (p.mulliganed) return;
  p.mulliganed = true;
  if (doIt) {
    p.deck.push(...p.hand); p.hand = [];
    shuffle(state, p.deck);
    for (let i = 0; i < state.rules.startHand; i++) p.hand.push(p.deck.pop());
    log(state, 'info', `${p.name} が手札を引き直した`);
  }
  if (state.players.every(x => x.mulliganed)) { state.active = 0; startTurn(state); }
}

// ---------- 便利: 全合法手の列挙（AI用） ----------
export function legalActions(state, pi) {
  const acts = [];
  if (state.phase !== 'main' || state.active !== pi || state.winner !== null) return acts;
  const p = state.players[pi];
  p.hand.forEach((id, i) => {
    if (isMonster(id)) {
      if (canSummon(state, pi, i)) {
        acts.push({ type: 'summon', hand: i, mode: 'attack' });
        acts.push({ type: 'summon', hand: i, mode: 'defense' });
      }
    } else if (canPlaySupport(state, pi, i)) {
      acts.push({ type: 'support', hand: i });
    }
  });
  p.field.forEach((m, i) => { if (m && canChangeMode(state, pi, i)) acts.push({ type: 'mode', slot: i }); });
  if (canForge(state, pi)) acts.push({ type: 'forge' });
  p.field.forEach((m, i) => {
    if (m && canAttack(state, pi, i)) {
      legalAttackTargets(state, pi, i).forEach(t => acts.push({ type: 'attack', slot: i, target: t }));
    }
  });
  acts.push({ type: 'end' });
  return acts;
}

export function applyAction(state, pi, act) {
  switch (act.type) {
    case 'summon': state.pendingTarget = act.target || null; return summon(state, pi, act.hand, act.mode, act.slot);
    case 'support': return playSupport(state, pi, act.hand, act.target || null);
    case 'mode': return changeMode(state, pi, act.slot);
    case 'attack': return attack(state, pi, act.slot, act.target);
    case 'forge': return forge(state, pi);
    case 'end': return endTurn(state);
    case 'discard': discardCard(state, act.hand); return true;
    default: return false;
  }
}
