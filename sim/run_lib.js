// テストプレイ共通ロジック
import { createGame, mulligan } from '../src/engine/game.js';
import { aiTakeTurn } from '../src/engine/ai.js';
import { card } from '../src/engine/cards.js';

export function mulliganDecision(state, pi) {
  // 1〜2コスト圏が0枚、または4コスト以上が2枚以上なら引き直す
  const hand = state.players[pi].hand.map(card);
  const cheap = hand.filter(c => c.cost <= 2).length;
  return cheap === 0 || hand.filter(c => c.cost >= 4).length >= 2;
}

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playGame(deckA, deckB, seed, rules = {}, opts = {}) {
  const state = createGame({ decks: [deckA, deckB], seed, rules, names: ['A', 'B'], startCost: opts.startCost });
  if (opts.lives) opts.lives.forEach((v, i) => { if (v) state.players[i].life = v; });
  if (state.rules.mulligan) {
    mulligan(state, 0, mulliganDecision(state, 0));
    mulligan(state, 1, mulliganDecision(state, 1));
  } else {
    mulligan(state, 0, false); mulligan(state, 1, false);
  }
  const rand = mulberry(seed * 31 + 7);
  let guard = 0;
  while (state.winner === null && guard++ < 400) {
    const prof = (opts.profiles && opts.profiles[state.active]) || opts.profile || 'balanced';
    aiTakeTurn(state, state.active, { noise: opts.noise || 0, rand, profile: prof });
  }
  if (state.winner === null) { state.winner = state.players[0].life >= state.players[1].life ? 0 : 1; state.reason = '打ち切り'; }
  return state;
}
