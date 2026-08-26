// ============================================================
// 詳細スタッツ: 防御モードは使われているか / ダメージはどこから来るか
//   node sim/stats.js [--games 200] [--rules k=v,k=v]
// ============================================================
import { playGame } from './run_lib.js';
import { PRESET_DECKS } from '../src/game/decks.js';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const GAMES = parseInt(getArg('--games', '120'), 10);
const rules = {};
getArg('--rules', '').split(',').forEach(kv => {
  const [k, v] = kv.split('=');
  if (!k) return;
  rules[k] = v === 'true' ? true : v === 'false' ? false : (isNaN(Number(v)) ? v : Number(v));
});

const keys = Object.keys(PRESET_DECKS);
const agg = {
  games: 0, turns: 0, summons: 0, defSummons: 0, modeChanges: 0,
  dmg: {}, attacks: 0, directAttacks: 0, destroys: 0,
  deckLeft: 0, discards: 0, p0wins: 0, deckout: 0, lifeSwingWin: 0,
  turnHist: {},
};

function collect(s) {
  agg.games++; agg.turns += s.turn;
  if (s.winner === 0) agg.p0wins++;
  if (s.reason.includes('山札')) agg.deckout++;
  agg.turnHist[s.turn] = (agg.turnHist[s.turn] || 0) + 1;
  agg.deckLeft += (s.players[0].deck.length + s.players[1].deck.length) / 2;
  for (const e of s.log) {
    if (e.kind === 'summon' && e.mode) { agg.summons++; if (e.mode === 'defense') agg.defSummons++; }
    if (e.kind === 'mode') agg.modeChanges++;
    if (e.kind === 'attack') { agg.attacks++; if (e.direct) agg.directAttacks++; }
    if (e.kind === 'destroy') agg.destroys++;
    if (e.kind === 'damage') {
      const src = e.src || '(不明)';
      agg.dmg[src] = (agg.dmg[src] || 0) + e.v;
    }
    if (e.kind === 'info' && e.text.includes('手札上限')) agg.discards++;
  }
}

let pairs = 0;
for (let i = 0; i < keys.length; i++) {
  for (let j = 0; j < keys.length; j++) {
    if (i === j) continue;
    pairs++;
    for (let g = 0; g < Math.max(8, Math.floor(GAMES / (keys.length * (keys.length - 1)))); g++) {
      collect(playGame(PRESET_DECKS[keys[i]].list, PRESET_DECKS[keys[j]].list, g * 7717 + i * 31 + j, rules));
    }
  }
}

const pg = x => (x / agg.games).toFixed(2);
console.log(`=== 詳細スタッツ (${agg.games}戦, ルール上書き ${JSON.stringify(rules)}) ===`);
console.log(`平均ターン数        : ${pg(agg.turns)}`);
console.log(`先攻勝率            : ${(agg.p0wins / agg.games * 100).toFixed(1)}%`);
console.log(`デッキ切れ決着       : ${(agg.deckout / agg.games * 100).toFixed(1)}%`);
console.log(`決着時の平均残り山札  : ${pg(agg.deckLeft)} 枚 / 27`);
console.log(`召喚回数/試合        : ${pg(agg.summons)}   うち防御モード召喚 ${(agg.defSummons / agg.summons * 100).toFixed(1)}%`);
console.log(`モード変更/試合      : ${pg(agg.modeChanges)}`);
console.log(`攻撃宣言/試合        : ${pg(agg.attacks)}   うち直接攻撃 ${(agg.directAttacks / agg.attacks * 100).toFixed(1)}%`);
console.log(`モンスター破壊/試合   : ${pg(agg.destroys)}`);
console.log(`手札上限で捨てた枚数  : ${pg(agg.discards)}`);
console.log('\n--- ライフダメージの内訳（1試合あたり） ---');
const total = Object.values(agg.dmg).reduce((a, b) => a + b, 0);
Object.entries(agg.dmg).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k.padEnd(16)} ${(v / agg.games).toFixed(2).padStart(6)}  (${(v / total * 100).toFixed(1)}%)`);
});
console.log('\n--- 決着ターンの分布 ---');
const hist = Object.entries(agg.turnHist).map(([t, n]) => [Number(t), n]).sort((a, b) => a[0] - b[0]);
hist.forEach(([t, n]) => console.log(`  ${String(t).padStart(3)}T ${'█'.repeat(Math.round(n / agg.games * 200))} ${(n / agg.games * 100).toFixed(1)}%`));
