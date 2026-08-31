// ============================================================
// 探索で出てきたデッキを、探索に使っていない別の乱数で検証する。
//   山登り法は同じ乱数の並びに合わせ込んでしまうので、
//   本当の実力は「見たことのない試合」で測る必要がある。
//   使い方: node sim/varga_check.js "先駆けの槍兵×3 / 焔旗の伝令×2 ..."
// ============================================================
import { ALL_CARDS, card } from '../src/engine/cards.js';
import { winRate } from './varga.js';

const text = process.argv.slice(2).join(' ');
const byName = Object.fromEntries(ALL_CARDS.map(c => [c.name, c.id]));
const deck = [];
for (const part of text.split('/')) {
  const m = part.trim().match(/^(.+?)×(\d+)$/);
  if (!m) continue;
  const id = byName[m[1].trim()];
  if (!id) throw new Error('知らないカード名: ' + m[1]);
  for (let i = 0; i < Number(m[2]); i++) deck.push(id);
}
if (deck.length !== 30) throw new Error(`${deck.length}枚になりました（30枚必要）`);

const train = winRate(deck, 600, 1000);      // 探索に使った乱数を含む
const test = winRate(deck, 600, 777000);     // まったく別の乱数
const test2 = winRate(deck, 600, 5150000);
console.log(`探索に使った乱数   勝率 ${(train.rate * 100).toFixed(1)}%  平均${train.turn.toFixed(1)}T`);
console.log(`初見の乱数 その1   勝率 ${(test.rate * 100).toFixed(1)}%  平均${test.turn.toFixed(1)}T`);
console.log(`初見の乱数 その2   勝率 ${(test2.rate * 100).toFixed(1)}%  平均${test2.turn.toFixed(1)}T`);
const cost = deck.map(id => card(id).cost);
const curve = {};
cost.forEach(c => { curve[c] = (curve[c] || 0) + 1; });
console.log('コスト分布 ' + Object.keys(curve).sort((a, b) => a - b).map(k => `${k}:${curve[k]}`).join(' '));
const el = {};
deck.forEach(id => { const e = card(id).element; el[e] = (el[e] || 0) + 1; });
console.log('属性 ' + Object.entries(el).map(([k, v]) => `${k}:${v}`).join(' '));
