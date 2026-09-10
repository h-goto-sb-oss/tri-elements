// ============================================================
// フリーバトル「極」の総当たり検証
//   全24キャラ × 「極」の実際の設定
//   （敵ライフ+10・開始コスト+0・AI noise=0・本人シグネチャカードを
//    必ず初手に持たせる）で、プレイヤー側の代表的なデッキが
//   ちゃんと勝負になるかを見る。
//   開始コスト+2の廃止と、シグネチャカード（例: 蔦使いリムのような
//   増殖型モンスター）の早期召喚が噛み合って詰みゲーになっていないか
//   の確認が主目的。
//   node sim/extreme.js [--games 60]
// ============================================================
import { playGame } from './run_lib.js';
import { AREAS, STARTER_DECK, FREE_DIFFICULTY } from '../src/game/campaign.js';
import { PRESET_DECKS } from '../src/game/decks.js';
import { CHARACTER_OF, EXTREME_SELF_COPIES } from '../src/engine/cards_chars.js';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const N = parseInt(getArg('--games', '60'), 10);
const diff = FREE_DIFFICULTY.extreme;

const PLAYER_DECKS = [
  ['初期デッキ', STARTER_DECK],
  ['強化後(炎)', PRESET_DECKS.fireDouble.list],
  ['強化後(水)', PRESET_DECKS.waterTempo.list],
  ['強化後(草)', PRESET_DECKS.grassBest.list],
];

function extremeFoeDeck(e, key) {
  const selfCard = CHARACTER_OF[key];
  if (!selfCard) return { deck: e.deck, sig: null };
  const deck = [...Array(EXTREME_SELF_COPIES).fill(selfCard), ...e.deck.slice(EXTREME_SELF_COPIES)];
  return { deck, sig: selfCard };
}

const low = []; // 目立って苦戦・楽勝なマッチアップを最後にまとめる
for (const [pname, pdeck] of PLAYER_DECKS) {
  console.log(`\n=== ${pname} ===`);
  for (const area of AREAS) {
    const cells = area.enemies.map((e, ei) => {
      const key = `${area.id}:${ei}`;
      const { deck: foeDeck, sig } = extremeFoeDeck(e, key);
      const foeLife = (e.life || 20) + diff.life;
      const foeStart = (e.startCost || 0) + diff.cost;
      let w = 0, n = 0, turns = 0;
      for (let g = 0; g < N; g++) {
        const first = g % 2 === 0;
        const s = first
          ? playGame(pdeck, foeDeck, g * 3301 + 11, {}, {
              profiles: ['balanced', e.profile], noise: 0,
              lives: [null, foeLife], startCost: [0, foeStart], signature: [null, sig],
            })
          : playGame(foeDeck, pdeck, g * 3301 + 11, {}, {
              profiles: [e.profile, 'balanced'], noise: 0,
              lives: [foeLife, null], startCost: [foeStart, 0], signature: [sig, null],
            });
        if (s.winner === (first ? 0 : 1)) w++;
        n++; turns += s.turn;
      }
      const rate = w / n;
      if (rate <= 0.2 || rate >= 0.9) low.push({ pname, area: area.name, enemy: e.name, rate });
      return `${e.icon}${e.name.slice(0, 6).padEnd(6, '　')} ${(rate * 100).toFixed(0).padStart(3)}%(${(turns / n).toFixed(0)}T)`;
    });
    console.log(`  ${area.name.padEnd(8)} ${cells.join('  ')}`);
  }
}

if (low.length) {
  console.log('\n=== 目立つマッチアップ（勝率20%以下 or 90%以上） ===');
  low.forEach(x => console.log(`  ${x.pname} vs ${x.area}/${x.enemy}: ${(x.rate * 100).toFixed(0)}%`));
} else {
  console.log('\n極端な勝率のマッチアップなし。');
}
