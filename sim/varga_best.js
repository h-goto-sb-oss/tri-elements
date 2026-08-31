// ============================================================
// 極・炎皇バルガに対して、今のカードプールで最も勝てる30枚を探す。
//   まず型ごとの叩き台を比べ、勝ったものからカードを1枚ずつ入れ替えて
//   勝率が上がらなくなるまで登り続ける（山登り法）。
//   node sim/varga_best.js --games 240 --steps 400
// ============================================================
import { card, ALL_CARDS } from '../src/engine/cards.js';
import { winRate } from './varga.js';
import { mulberry } from './run_lib.js';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const GAMES = parseInt(getArg('--games', '240'), 10);
const STEPS = parseInt(getArg('--steps', '400'), 10);
const NO_CHAR = argv.includes('--nochar');

const POOL = ALL_CARDS.filter(c => !NO_CHAR || c.set !== 9);
const CAP = Object.fromEntries(POOL.map(c => [c.id, c.maxCopies || 3]));
const mk = pairs => pairs.flatMap(([id, n]) => Array(n).fill(id));
const size = d => d.length;

// ---- 型の叩き台 ----
const SEEDS = {
  '水・隊列': mk([
    ['b_w1', 3], ['b_w2', 3], ['b_w3', 3], ['b_w4', 3], ['b_w5', 3], ['b_lw1', 1],
    ['w03', 3], ['w08', 2], ['x_w4', 3], ['b_sw1', 2], ['b_sw3', 2], ['sw4', 2],
  ]),
  '水・守護コントロール': mk([
    ['w01', 3], ['w05', 3], ['w08', 3], ['x_w3', 3], ['x_w4', 3], ['w09', 2], ['w10', 2],
    ['sw2', 2], ['sw4', 3], ['sw3', 3], ['sn5', 3],
  ]),
  '水草': mk([
    ['w03', 3], ['w05', 2], ['w08', 3], ['x_w4', 3], ['w09', 2],
    ['g03', 3], ['g05', 2], ['b_g3', 3], ['b_g5', 2],
    ['sw4', 3], ['sn5', 2], ['sg3', 2],
  ]),
  '草・旗': mk([
    ['b_g1', 3], ['b_g2', 3], ['b_g3', 3], ['b_g4', 3], ['b_g5', 3], ['b_lg1', 1],
    ['g03', 3], ['g05', 3], ['g07', 2], ['b_sg1', 2], ['sg3', 2], ['sn5', 2],
  ]),
  '炎・突撃': mk([
    ['b_f1', 3], ['b_f2', 3], ['b_f3', 3], ['b_f4', 3], ['b_f5', 2], ['b_lf1', 1],
    ['f05', 3], ['f09', 2], ['f03', 3], ['b_sf1', 2], ['b_sf2', 3], ['sf2', 2],
  ]),
  '無・傭兵': mk([
    ['b_n1', 3], ['b_n2', 3], ['b_n3', 3], ['b_n4', 3], ['b_ln1', 1],
    ['w03', 3], ['w08', 2], ['x_w4', 3], ['b_sn1', 2], ['b_sn2', 2], ['sw4', 3], ['sn5', 2],
  ]),
};

function valid(d) {
  if (size(d) !== 30) return false;
  const c = {};
  for (const id of d) { c[id] = (c[id] || 0) + 1; if (c[id] > (CAP[id] || 3)) return false; }
  return true;
}
function show(d) {
  const c = {};
  d.forEach(id => { c[id] = (c[id] || 0) + 1; });
  return Object.entries(c)
    .sort((a, b) => card(a[0]).cost - card(b[0]).cost || a[0].localeCompare(b[0]))
    .map(([id, n]) => `${card(id).name}×${n}`).join(' / ');
}

console.log(`=== 極・炎皇バルガ  ${GAMES}戦ずつ ===\n`);
const scored = [];
for (const [name, d] of Object.entries(SEEDS)) {
  if (!valid(d)) { console.log(`${name}: 枚数不正 ${size(d)}枚`); continue; }
  const r = winRate(d, GAMES);
  scored.push([name, d, r.rate]);
  console.log(`${name.padEnd(12)} 勝率 ${(r.rate * 100).toFixed(1).padStart(5)}%  平均${r.turn.toFixed(1)}T  勝ったとき残ライフ${r.life.toFixed(1)}`);
}
scored.sort((a, b) => b[2] - a[2]);
let [bestName, best, bestRate] = scored[0];
console.log(`\n--- 「${bestName}」を土台に入れ替えを開始（${(bestRate * 100).toFixed(1)}%） ---`);

const rand = mulberry(20260831);
let since = 0;
for (let step = 0; step < STEPS && since < 90; step++) {
  const d = [...best];
  const out = Math.floor(rand() * d.length);
  const inId = POOL[Math.floor(rand() * POOL.length)].id;
  d[out] = inId;
  if (!valid(d)) { since++; continue; }
  const r = winRate(d, GAMES).rate;
  if (r > bestRate + 0.001) {
    console.log(`  ${String(step).padStart(3)}: ${card(best[out]).name} → ${card(inId).name}  ${(bestRate * 100).toFixed(1)}% → ${(r * 100).toFixed(1)}%`);
    best = d; bestRate = r; since = 0;
  } else since++;
}

const final = winRate(best, GAMES * 3);
console.log(`\n=== 完成 ===`);
console.log(`勝率 ${(final.rate * 100).toFixed(1)}%（${GAMES * 3}戦）  平均${final.turn.toFixed(1)}ターン  勝ったとき残ライフ${final.life.toFixed(1)}`);
console.log(show(best));
