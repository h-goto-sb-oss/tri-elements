// 2ピックの数値を測る: node sim/draft.js [ドラフト数] [対戦数]
//  1) AI がドラフトしたデッキのコスト配分・モンスター/サポートの比率
//  2) 属性の組どうしの勝率（ドラフト同士、AI 本気）
import { card } from '../src/engine/cards.js';
import { aiDraft, DRAFT_PAIRS } from '../src/game/draft.js';
import { playGame, mulberry } from './run_lib.js';

const N = Number(process.argv[2] || 300);
const G = Number(process.argv[3] || 400);
const rand = mulberry(20260912);
const name = p => p.map(e => ({ fire: '炎', water: '水', grass: '草' }[e])).join('×');

// 1) デッキの形
for (const pair of DRAFT_PAIRS) {
  const curve = {}, types = { monster: 0, support: 0 }, rar = {};
  let dupMax = 0, neutral = 0;
  for (let i = 0; i < N; i++) {
    const d = aiDraft(pair, rand);
    const cnt = {};
    for (const id of d) {
      const c = card(id);
      const k = Math.min(c.cost, 7);
      curve[k] = (curve[k] || 0) + 1;
      types[c.type]++;
      rar[c.rarity] = (rar[c.rarity] || 0) + 1;
      if (c.element === 'none') neutral++;
      cnt[id] = (cnt[id] || 0) + 1;
    }
    dupMax = Math.max(dupMax, ...Object.values(cnt));
  }
  const avg = o => Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, +(v / N).toFixed(1)]));
  console.log(name(pair), 'コスト', JSON.stringify(avg(curve)), '種類', JSON.stringify(avg(types)),
    '無属性', (neutral / N).toFixed(1), 'レア度', JSON.stringify(avg(rar)), '同名最大', dupMax);
}

// 2) 組どうしの勝率（先後は交互）
const decks = Object.fromEntries(DRAFT_PAIRS.map(p => [name(p), Array.from({ length: 40 }, () => aiDraft(p, rand))]));
const keys = Object.keys(decks);
for (let a = 0; a < keys.length; a++) {
  for (let b = a + 1; b < keys.length; b++) {
    let wa = 0, turns = 0;
    for (let g = 0; g < G; g++) {
      const da = decks[keys[a]][g % 40], db = decks[keys[b]][(g * 7 + 3) % 40];
      const flip = g % 2 === 1;
      const st = playGame(flip ? db : da, flip ? da : db, 1000 + g, {}, { noise: 0 });
      const aWon = flip ? st.winner === 1 : st.winner === 0;
      if (aWon) wa++;
      turns += st.turn;
    }
    console.log(`${keys[a]} vs ${keys[b]}: ${keys[a]} の勝率 ${(wa / G * 100).toFixed(1)}%  平均 ${(turns / G).toFixed(1)} ターン`);
  }
}
