// ============================================================
// 選定の儀の限定カード案の強さ測定（1枚差し替え法・cardpower.js と同じ条件）
//   候補をここで仮に定義して CARD_MAP に差し込み、
//   キャラカード（同じレジェンド・1枚制限）と並べて比べる。
//   node sim/draft_rewards.js [--games 100]
// ============================================================
import { playGame } from './run_lib.js';
import { PRESET_DECKS, mk } from '../src/game/decks.js';
import { CARD_MAP, card } from '../src/engine/cards.js';
import { M } from '../src/engine/cardbuild.js';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const N = parseInt(getArg('--games', '100'), 10);
const ONLY = getArg('--only', null);

const SEL = { op: 'observe', n: 2 };   // 【選定】山札の上から2枚を見て1枚を手札に
const D = (opt) => ({ set: 10, hidden: true, maxCopies: 1, tier: 3, ...opt });
const CANDIDATES = [
  M('d_fw', '夕凪の選定官 シエナ', 'fire', 4, 4, 3, 'humanoid', D({ elements: ['fire', 'water'],
    onSummon: [SEL, { op: 'damageFace', side: 'enemy', v: 2 }] })),
  M('d_fw2', 'シエナ案B 5c5/4', 'fire', 5, 5, 4, 'humanoid', D({ elements: ['fire', 'water'],
    onSummon: [SEL, { op: 'damageFace', side: 'enemy', v: 2 }] })),
  M('d_wg', '潮森の選定官 ミルテ', 'water', 4, 3, 5, 'humanoid', D({ elements: ['water', 'grass'], keywords: ['guard'],
    onSummon: [SEL], onTurnStart: [{ op: 'heal', side: 'self', v: 1 }] })),
  M('d_wg2', 'ミルテ案B 守護なし4/4', 'water', 4, 4, 4, 'humanoid', D({ elements: ['water', 'grass'],
    onSummon: [SEL], onTurnStart: [{ op: 'heal', side: 'self', v: 1 }] })),
  M('d_gf', '燎原の選定官 カグラ', 'grass', 4, 4, 4, 'humanoid', D({ elements: ['grass', 'fire'],
    onSummon: [SEL, { op: 'buff', side: 'self', target: 'all', atk: 1, def: 0 }] })),
  M('d_gf2', 'カグラ案B 3/4', 'grass', 4, 3, 4, 'humanoid', D({ elements: ['grass', 'fire'],
    onSummon: [SEL, { op: 'buff', side: 'self', target: 'all', atk: 1, def: 0 }] })),
  M('d_gf3', 'カグラ案C 4c3/3', 'grass', 4, 3, 3, 'humanoid', D({ elements: ['grass', 'fire'],
    onSummon: [SEL, { op: 'buff', side: 'self', target: 'all', atk: 1, def: 0 }] })),
  M('d_gf4', 'カグラ案D 5c4/4', 'grass', 5, 4, 4, 'humanoid', D({ elements: ['grass', 'fire'],
    onSummon: [SEL, { op: 'buff', side: 'self', target: 'all', atk: 1, def: 0 }] })),
  M('d_x', '三晶の大祭司 エルシオン', 'fire', 6, 5, 5, 'humanoid', D({ elements: ['fire', 'water', 'grass'],
    onSummon: [SEL, { op: 'buff', side: 'self', target: 'all', atk: 1, def: 1 }] })),
  M('d_x2', 'エルシオン案B 7c6/6', 'fire', 7, 6, 6, 'humanoid', D({ elements: ['fire', 'water', 'grass'],
    onSummon: [SEL, { op: 'buff', side: 'self', target: 'all', atk: 1, def: 1 }] })),
  // 【選定】だけの価値を見るための対照（効果なしの 4c 4/4 と、それに【選定】を足したもの）
  M('d_v', '対照 4c4/4 効果なし', 'none', 4, 4, 4, 'humanoid', D({})),
  M('d_vs', '対照 4c4/4＋選定', 'none', 4, 4, 4, 'humanoid', D({ onSummon: [SEL] })),
].map(c => ({ ...c, rarity: 'legend' }));
CANDIDATES.forEach(c => { CARD_MAP[c.id] = c; });

// 比べる相手：キャラカード（同じレジェンド・1枚制限）
const REFS = ['c_toto', 'c_twins', 'c_nox', 'c_triades', 'c_dione', 'c_astralis'];

const BASE27 = mk([
  ['f01', 3], ['g01', 3], ['w01', 3],
  ['f03', 3], ['w03', 3], ['g03', 3],
  ['f05', 2], ['w05', 2], ['g05', 1],
  ['sn2', 2], ['sn5', 2],
]);
const GAUNTLET = ['fireAggro', 'waterControl', 'grassMid', 'starter'];

function winRate(deck) {
  let w = 0, n = 0, turns = 0;
  for (const g of GAUNTLET) {
    for (let i = 0; i < N; i++) {
      const first = i % 2 === 0;
      const s = first
        ? playGame(deck, PRESET_DECKS[g].list, i * 5171 + 3)
        : playGame(PRESET_DECKS[g].list, deck, i * 5171 + 3);
      if (s.winner === (first ? 0 : 1)) w++;
      n++; turns += s.turn;
    }
  }
  const rate = w / n;
  return { rate, turns: turns / n, se: Math.sqrt(rate * (1 - rate) / n) };
}

const baseline = winRate([...BASE27, 'sn1', 'sn1', 'sn1']);
console.log(`基準（応急手当×3）${(baseline.rate * 100).toFixed(1)}%  平均${baseline.turns.toFixed(1)}T  各${N}戦×${GAUNTLET.length}`);
const ids = [...REFS, ...CANDIDATES.map(c => c.id)].filter(id => !ONLY || id.startsWith(ONLY));
for (const id of ids) {
  const c = card(id);
  const r = winRate([...BASE27, id, id, id]);
  const d = (r.rate - baseline.rate) * 100;
  console.log(`${id.padEnd(11)} ${c.name.padEnd(16)} c${c.cost} ${c.atk}/${c.def}  勝率${(r.rate * 100).toFixed(1).padStart(5)}%  差${(d >= 0 ? '+' : '') + d.toFixed(1)}  ${r.turns.toFixed(1)}T`);
}
