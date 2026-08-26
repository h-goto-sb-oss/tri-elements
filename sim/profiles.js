// 攻撃型AI vs 守備型AI。同一デッキで戦わせ、
// 「turtle（守り）が勝つ = ルール側が膠着を報酬にしている」かを判定する。
import { playGame } from './run_lib.js';
import { PRESET_DECKS } from '../src/game/decks.js';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const GAMES = parseInt(getArg('--games', '60'), 10);
const rules = {};
getArg('--rules', '').split(',').forEach(kv => {
  const [k, v] = kv.split('='); if (!k) return;
  rules[k] = v === 'true' ? true : v === 'false' ? false : (isNaN(Number(v)) ? v : Number(v));
});

console.log(`=== 攻撃型AI vs 守備型AI（${GAMES}戦ずつ、先後入替）ルール上書き ${JSON.stringify(rules)} ===`);
for (const k of Object.keys(PRESET_DECKS)) {
  let aggroWins = 0, n = 0, turns = 0, deckout = 0;
  for (let g = 0; g < GAMES; g++) {
    // 前半: 先攻=aggro, 後半: 先攻=turtle
    const aggroFirst = g % 2 === 0;
    const profiles = aggroFirst ? ['aggro', 'turtle'] : ['turtle', 'aggro'];
    const s = playGame(PRESET_DECKS[k].list, PRESET_DECKS[k].list, g * 977 + 5, rules, { profiles });
    const aggroSide = aggroFirst ? 0 : 1;
    if (s.winner === aggroSide) aggroWins++;
    n++; turns += s.turn; if (s.reason.includes('山札')) deckout++;
  }
  console.log(`  ${PRESET_DECKS[k].name.padEnd(10)} 攻撃型の勝率 ${(aggroWins / n * 100).toFixed(1).padStart(5)}%  平均${(turns / n).toFixed(1)}T  デッキ切れ${(deckout / n * 100).toFixed(0)}%`);
}
