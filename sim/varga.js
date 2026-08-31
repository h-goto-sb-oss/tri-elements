// ============================================================
// 極・炎皇バルガ 専用のテストプレイ
//   極の条件を再現する: 相手ライフ+8 / 相手の初期コスト+2 /
//   バルガ本人のカードが必ず初手にある
//   node sim/varga.js --games 400            … 手持ちの型を総当たり
//   node sim/varga.js --tune --games 240     … 勝率が上がるまでカードを入れ替える
// ============================================================
import { createGame, mulligan } from '../src/engine/game.js';
import { aiTakeTurn } from '../src/engine/ai.js';
import { card, ALL_CARDS } from '../src/engine/cards.js';
import { AREAS, FREE_DIFFICULTY } from '../src/game/campaign.js';
import { CHARACTER_OF } from '../src/engine/cards_chars.js';
import { mulliganDecision, mulberry } from './run_lib.js';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const GAMES = parseInt(getArg('--games', '300'), 10);

// ---- 極バルガの設定を campaign.js から拾う ----
const area = AREAS.find(a => a.id === 'a2');
const idx = area.enemies.findIndex(e => e.name.includes('バルガ'));
const enemy = area.enemies[idx];
const diff = FREE_DIFFICULTY.extreme;
const sig = CHARACTER_OF[`a2:${idx}`];
const FOE_DECK = [sig, ...enemy.deck.slice(1)];
const FOE_LIFE = (enemy.life || 20) + diff.life;
const FOE_COST = (enemy.startCost || 0) + diff.cost;

export function play(deck, seed) {
  const state = createGame({
    decks: [[...deck], [...FOE_DECK]], seed, names: ['自分', 'バルガ'],
    startCost: [0, FOE_COST], signature: [null, sig],
  });
  state.players[1].life = FOE_LIFE;
  mulligan(state, 0, mulliganDecision(state, 0));
  mulligan(state, 1, mulliganDecision(state, 1));
  const rand = mulberry(seed * 31 + 7);
  let guard = 0;
  while (state.winner === null && guard++ < 400) {
    aiTakeTurn(state, state.active, {
      noise: state.active === 1 ? (enemy.noise || 0) : 0,
      rand, profile: state.active === 1 ? (enemy.profile || 'balanced') : 'balanced',
    });
  }
  if (state.winner === null) { state.winner = state.players[0].life >= state.players[1].life ? 0 : 1; }
  return state;
}

export function winRate(deck, games = GAMES, seed0 = 1000) {
  let w = 0, turns = 0, life = 0;
  for (let g = 0; g < games; g++) {
    const s = play(deck, seed0 + g * 1013);
    if (s.winner === 0) { w++; life += s.players[0].life; }
    turns += s.turn;
  }
  return { rate: w / games, turn: turns / games, life: w ? life / w : 0 };
}

export { FOE_LIFE, FOE_COST, sig, enemy };
