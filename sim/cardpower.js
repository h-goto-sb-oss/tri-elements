// ============================================================
// カード単体の強さ測定（1枚差し替え法）
//   固定の27枚 + 「測りたいカード×3」で30枚デッキを作り、
//   固定ガントレット4種と戦わせて勝率を出す。
//   基準カード（応急手当×3）との差＝そのカードの実効パワー。
//   node sim/cardpower.js [--games 16]
// ============================================================
import { playGame } from './run_lib.js';
import { PRESET_DECKS } from '../src/game/decks.js';
import { ALL_CARDS, card } from '../src/engine/cards.js';
import { mk } from '../src/game/decks.js';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const N = parseInt(getArg('--games', '100'), 10);

// 三属性どれでも動く中立ベース27枚
const BASE27 = mk([
  ['f01', 3], ['g01', 3], ['w01', 3],
  ['f03', 3], ['w03', 3], ['g03', 3],
  ['f05', 2], ['w05', 2], ['g05', 1],
  ['sn2', 2], ['sn5', 2],
]);
if (BASE27.length !== 27) throw new Error('base=' + BASE27.length);

const GAUNTLET = ['fireAggro', 'waterControl', 'grassMid', 'starter'];

function testDeck(id) {
  const base = [...BASE27];
  // 同名4枚以上にならないよう、ベースに既にある場合は別カードを抜く
  let deck = base.filter(x => x !== id);
  while (deck.length > 27) deck.pop();
  while (deck.length < 27) deck.push('sn1');
  return [...deck, id, id, id];
}

function winRate(deck) {
  let w = 0, n = 0, turns = 0;
  for (const g of GAUNTLET) {
    for (let i = 0; i < N; i++) {
      const first = i % 2 === 0;
      const s = first
        ? playGame(deck, PRESET_DECKS[g].list, i * 5171 + 3)
        : playGame(PRESET_DECKS[g].list, deck, i * 5171 + 3);
      const mySide = first ? 0 : 1;
      if (s.winner === mySide) w++;
      n++; turns += s.turn;
    }
  }
  const rate = w / n;
  return { rate, turns: turns / n, se: Math.sqrt(rate * (1 - rate) / n) };
}

const baseline = winRate([...BASE27, 'sn1', 'sn1', 'sn1']);
console.log(`基準（応急手当×3）勝率 ${(baseline.rate * 100).toFixed(1)}% ±${(baseline.se * 200).toFixed(1)}  平均${baseline.turns.toFixed(1)}T`);
console.log(`ガントレット: ${GAUNTLET.join(' / ')}  各${N}戦\n`);

const rows = [];
for (const c of ALL_CARDS) {
  const r = winRate(testDeck(c.id));
  rows.push({ c, ...r, delta: (r.rate - baseline.rate) * 100 });
}
rows.sort((a, b) => b.delta - a.delta);

const line = r => `${(r.c.element + '  ').slice(0, 2)} ${r.c.name.padEnd(13)} c${r.c.cost} ` +
  `${r.c.type === 'monster' ? `${r.c.atk}/${r.c.def}`.padEnd(5) : '     '} ` +
  `勝率${(r.rate * 100).toFixed(1).padStart(5)}%  差${((r.delta >= 0 ? '+' : '') + r.delta.toFixed(1)).padStart(6)}` +
  `${Math.abs(r.delta) > 2 * Math.sqrt(r.se ** 2 + baseline.se ** 2) * 100 ? '  ★有意' : ''}`;

console.log('=== 強い順 ===');
rows.slice(0, 14).forEach(r => console.log('  ' + line(r)));
console.log('\n=== 弱い順 ===');
rows.slice(-14).reverse().forEach(r => console.log('  ' + line(r)));

console.log('\n=== 全カード（属性別） ===');
for (const el of ['fire', 'water', 'grass', 'none']) {
  const sub = rows.filter(r => r.c.element === el);
  const avg = sub.reduce((a, b) => a + b.delta, 0) / sub.length;
  console.log(`\n[${el}] 平均差 ${avg >= 0 ? '+' : ''}${avg.toFixed(1)}`);
  sub.sort((a, b) => a.c.cost - b.c.cost || b.delta - a.delta)
    .forEach(r => console.log('  ' + line(r)));
}
