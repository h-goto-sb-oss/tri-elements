// ============================================================
// ルール組み合わせのスイープ。各案について
//   ・平均ターン数（テンポ）
//   ・デッキ切れ決着率（膠着の指標）
//   ・攻撃型AI vs 守備型AI の勝率（守りが報われすぎていないか）
//   ・先攻勝率（先後バランス）
// を一覧で出す。
// ============================================================
import { playGame } from './run_lib.js';
import { PRESET_DECKS } from '../src/game/decks.js';

const keys = Object.keys(PRESET_DECKS);
const N = parseInt(process.argv[2] || '16', 10);

function evalRules(rules) {
  let turns = 0, n = 0, deckout = 0, p0 = 0, timeout = 0;
  for (let i = 0; i < keys.length; i++) {
    for (let j = 0; j < keys.length; j++) {
      for (let g = 0; g < N; g++) {
        const s = playGame(PRESET_DECKS[keys[i]].list, PRESET_DECKS[keys[j]].list, g * 7717 + i * 131 + j * 17, rules);
        turns += s.turn; n++;
        if (s.reason.includes('山札')) deckout++;
        if (s.reason.includes('ターン数上限') || s.reason.includes('打ち切り')) timeout++;
        if (s.winner === 0) p0++;
      }
    }
  }
  // 守りが報われるか
  let aw = 0, an = 0;
  for (const k of keys) {
    for (let g = 0; g < N; g++) {
      const aggroFirst = g % 2 === 0;
      const profiles = aggroFirst ? ['aggro', 'turtle'] : ['turtle', 'aggro'];
      const s = playGame(PRESET_DECKS[k].list, PRESET_DECKS[k].list, g * 977 + 5, rules, { profiles });
      if (s.winner === (aggroFirst ? 0 : 1)) aw++;
      an++;
    }
  }
  return {
    turns: turns / n, deckout: deckout / n, p0: p0 / n, timeout: timeout / n, aggro: aw / an,
  };
}

const CASES = [
  ['現行(手札6)', {}],
  ['手札5', { handLimit: 5 }],
  ['手札7', { handLimit: 7 }],
  ['攻撃後もモード変更可', { modeChangeAfterAttack: true }],
  ['属性ボーナス3', { elementBonus: 3 }],
  ['属性ボーナス0', { elementBonus: 0 }],
  ['ライフ25', { startLife: 25 }],
  ['ライフ16', { startLife: 16 }],
  ['返り討ちなし', { reflectOnAttackerLoss: false }],
  ['後攻+1枚なし', { secondPlayerExtraCard: false }],
];

console.log('案'.padEnd(26) + '平均T  デッキ切れ  時間切れ  先攻勝率  攻撃型勝率');
for (const [name, rules] of CASES) {
  const r = evalRules(rules);
  console.log(
    name.padEnd(26) +
    r.turns.toFixed(1).padStart(5) +
    (r.deckout * 100).toFixed(0).padStart(8) + '%' +
    (r.timeout * 100).toFixed(0).padStart(8) + '%' +
    (r.p0 * 100).toFixed(1).padStart(9) + '%' +
    (r.aggro * 100).toFixed(1).padStart(10) + '%'
  );
}
