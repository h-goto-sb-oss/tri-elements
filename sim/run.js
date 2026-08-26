// ============================================================
// ヘッドレス・テストプレイ（AI vs AI）
//   node sim/run.js                  … 全デッキ総当たり
//   node sim/run.js --games 300      … 試合数
//   node sim/run.js --rules key=val  … ルールを上書きして比較
// ============================================================
import { playGame } from './run_lib.js';
import { PRESET_DECKS } from '../src/game/decks.js';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const GAMES = parseInt(getArg('--games', '200'), 10);
const RULE_OVERRIDES = {};
getArg('--rules', '').split(',').forEach(kv => {
  const [k, v] = kv.split('=');
  if (!k) return;
  RULE_OVERRIDES[k] = v === 'true' ? true : v === 'false' ? false : (isNaN(Number(v)) ? v : Number(v));
});

function summarize(label, results) {
  const n = results.length;
  const p0 = results.filter(r => r.winner === 0).length;
  const turns = results.map(r => r.turn);
  const deckouts = results.filter(r => r.reason.includes('山札')).length;
  const timeouts = results.filter(r => r.reason.includes('ターン数上限')).length;
  const avg = a => (a.reduce((x, y) => x + y, 0) / a.length);
  const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(
    `${label.padEnd(28)} 先攻勝率 ${(p0 / n * 100).toFixed(1).padStart(5)}%  ` +
    `平均${avg(turns).toFixed(1).padStart(5)}T 中央${String(med(turns)).padStart(3)}T ` +
    `最短${Math.min(...turns)}T 最長${Math.max(...turns)}T  ` +
    `デッキ切れ ${(deckouts / n * 100).toFixed(0)}%  時間切れ ${(timeouts / n * 100).toFixed(0)}%  ` +
    `残ライフ勝者 ${avg(results.map(r => r.winnerLife)).toFixed(1)}`
  );
  return { p0: p0 / n, avgTurn: avg(turns), deckouts: deckouts / n };
}

function runMatch(a, b, games, rules, noise = 0) {
  const results = [];
  for (let g = 0; g < games; g++) {
    const s = playGame(PRESET_DECKS[a].list, PRESET_DECKS[b].list, g * 1013 + 17, rules, { noise });
    results.push({ winner: s.winner, turn: s.turn, reason: s.reason, winnerLife: s.players[s.winner ?? 0].life });
  }
  return results;
}

const keys = Object.keys(PRESET_DECKS);
const rules = RULE_OVERRIDES;
console.log(`=== テストプレイ ${GAMES}戦/組  ルール上書き: ${JSON.stringify(rules)} ===\n`);

const winTable = {};
keys.forEach(k => { winTable[k] = { w: 0, n: 0 }; });

for (let i = 0; i < keys.length; i++) {
  for (let j = 0; j < keys.length; j++) {
    if (i === j) continue;
    const res = runMatch(keys[i], keys[j], GAMES, rules);
    summarize(`${PRESET_DECKS[keys[i]].name} vs ${PRESET_DECKS[keys[j]].name}`, res);
    winTable[keys[i]].w += res.filter(r => r.winner === 0).length;
    winTable[keys[i]].n += res.length;
    winTable[keys[j]].w += res.filter(r => r.winner === 1).length;
    winTable[keys[j]].n += res.length;
  }
}
console.log('\n--- デッキ別 総合勝率 ---');
Object.entries(winTable)
  .sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)
  .forEach(([k, v]) => console.log(`  ${PRESET_DECKS[k].name.padEnd(10)} ${(v.w / v.n * 100).toFixed(1)}%  (${v.w}/${v.n})`));

// ミラー戦で先攻有利を測る
console.log('\n--- 先攻/後攻バランス（同一デッキのミラー戦） ---');
keys.forEach(k => summarize(`ミラー: ${PRESET_DECKS[k].name}`, runMatch(k, k, GAMES, rules)));
