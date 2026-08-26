// ============================================================
// キャンペーンの難易度カーブ検証
//   初期デッキ（および強化後デッキ）で各エリアの敵と戦って勝率を出す。
//   狙い: エリア1は勝てる → 先に進むほど厳しく → パックで強化して突破
//   node sim/campaign.js [--games 60]
// ============================================================
import { playGame } from './run_lib.js';
import { AREAS, STARTER_DECK } from '../src/game/campaign.js';
import { PRESET_DECKS } from '../src/game/decks.js';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const N = parseInt(getArg('--games', '60'), 10);

const PLAYER_DECKS = [
  ['初期デッキ', STARTER_DECK],
  ['強化後(炎)', PRESET_DECKS.fireDouble.list],
  ['強化後(水)', PRESET_DECKS.waterTempo.list],
  ['強化後(草)', PRESET_DECKS.grassBest.list],
];

for (const [pname, deck] of PLAYER_DECKS) {
  console.log(`\n=== ${pname} ===`);
  for (const area of AREAS) {
    const cells = area.enemies.map(e => {
      let w = 0, n = 0, turns = 0;
      for (let g = 0; g < N; g++) {
        const first = g % 2 === 0;   // 先攻・後攻を半々に
        const s = first
          ? playGame(deck, e.deck, g * 3301 + 11, {}, { profiles: ['balanced', e.profile], noise: e.noise, lives: [null, e.life], startCost: [0, e.startCost] })
          : playGame(e.deck, deck, g * 3301 + 11, {}, { profiles: [e.profile, 'balanced'], noise: e.noise, lives: [e.life, null], startCost: [e.startCost, 0] });
        if (s.winner === (first ? 0 : 1)) w++;
        n++; turns += s.turn;
      }
      return `${e.icon}${e.name.slice(0, 6).padEnd(6, '　')} ${(w / n * 100).toFixed(0).padStart(3)}%(${(turns / n).toFixed(0)}T)`;
    });
    console.log(`  ${area.name.padEnd(8)} ${cells.join('  ')}`);
  }
}
