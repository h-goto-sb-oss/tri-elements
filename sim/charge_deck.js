// ============================================================
// 【突撃】シナジーデッキの強さを測る。
//   突撃は「巻き込んだ隣のダメージが防御力を削る」性質を持つので、
//   防御力しきい値で破壊する炎の除去（炎の雨・流星群）と相性がいい。
//   node sim/charge_deck.js
// ============================================================
import { card, ALL_CARDS } from '../src/engine/cards.js';
import { PRESET_DECKS } from '../src/game/decks.js';
import { playGame, mulliganDecision } from './run_lib.js';

const mk = pairs => pairs.flatMap(([id, n]) => Array(n).fill(id));

export const CHARGE_DECK = mk([
  ['b_f1', 3], ['b_f3', 3], ['b_lf1', 1],          // 突撃持ち本体
  ['b_sf1', 3], ['b_sf3', 2],                       // 突撃を配る
  ['x_sf2', 2], ['z_sf2', 2], ['b_sf2', 2],         // 防御力を見る除去・巻き込みダメージ
  ['f01', 2], ['f03', 2], ['f05', 2], ['f09', 2],   // 一般的な炎の打点
  ['sf2', 2], ['sf4', 2],                            // 攻撃力を底上げ（突撃の巻き込みも伸びる）
]);

// 「2/1の突撃」＝先駆けの槍兵(b_f1)を抜いて、素の3/1(f01)に置き換えた版。
// 差だけを見れば、突撃という性質そのものの価値がわかる。
export const NO_CHARGE1_DECK = CHARGE_DECK.map(id => id).reduce((acc, id, i, arr) => {
  acc.push(id); return acc;
}, []);
{
  const d = [...CHARGE_DECK];
  let left = 3;
  for (let i = 0; i < d.length && left > 0; i++) {
    if (d[i] === 'b_f1') { d[i] = 'f01'; left--; }
  }
  NO_CHARGE1_DECK.length = 0;
  NO_CHARGE1_DECK.push(...d);
}

function winRate(deckA, deckB, games, seed0 = 1000) {
  let w = 0, turns = 0;
  for (let g = 0; g < games; g++) {
    const s = playGame(deckA, deckB, seed0 + g * 1013, {}, { noise: 1 });
    if (s.winner === 0) w++;
    turns += s.turn;
  }
  return { rate: w / games, turn: turns / games };
}

if (process.argv[1] && process.argv[1].endsWith('charge_deck.js')) {
  console.log(`突撃デッキ 30枚: ${CHARGE_DECK.length}枚\n`);
  const keys = Object.keys(PRESET_DECKS);
  console.log('=== 既存プリセットデッキとの対戦（各200戦） ===');
  for (const k of keys) {
    const r1 = winRate(CHARGE_DECK, PRESET_DECKS[k].list, 200);
    const r2 = winRate(PRESET_DECKS[k].list, CHARGE_DECK, 200);
    const avg = (r1.rate + (1 - r2.rate)) / 2;
    console.log(`  vs ${PRESET_DECKS[k].name.padEnd(10)} 先攻${(r1.rate*100).toFixed(1).padStart(5)}%  後攻${((1-r2.rate)*100).toFixed(1).padStart(5)}%  平均${(avg*100).toFixed(1)}%`);
  }

  console.log('\n=== 「2/1の突撃」(先駆けの槍兵)3枚 vs 素の3/1(ヒバナトカゲ)3枚 に差し替えた場合 ===');
  for (const k of ['starter', 'fireAggro', 'waterControl', 'grassMid']) {
    if (!PRESET_DECKS[k]) continue;
    const withCharge = winRate(CHARGE_DECK, PRESET_DECKS[k].list, 300);
    const without = winRate(NO_CHARGE1_DECK, PRESET_DECKS[k].list, 300);
    console.log(`  vs ${PRESET_DECKS[k].name.padEnd(10)} 突撃あり${(withCharge.rate*100).toFixed(1).padStart(5)}%  突撃なし${(without.rate*100).toFixed(1).padStart(5)}%  差${((withCharge.rate-without.rate)*100).toFixed(1)}pt`);
  }
}
