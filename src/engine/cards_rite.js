// ============================================================
// 選定の儀の限定カード（隠しカード4種）
//   選定の儀を取り仕切る「選定官」3人と、その上に立つ大祭司。
//   ・全てレジェンド、デッキには1枚まで。パックからは出ない
//   ・選定の儀で勝つと手に入る（条件は game/draft.js の RITE_*）
//   ・入手するまで図鑑には載らない（hidden）
//
//   強さはキャラカードの中くらいに合わせてある（sim/draft_rewards.js）。
//   選定官はディオーネ（+12）より少し下、大祭司はアストラリス（+14）と同じくらい。
//   ミルテに【守護】＋防御5を付けると試合が長引いてむしろ弱くなった（DEFを上げると膠着する）。
//   カグラは 4/4 だと「全員の攻撃+1」が強すぎてトリアデス並みになったので 3/3。
// ============================================================
import { M } from './cardbuild.js';

// set 10 は図鑑の「選定の儀」枠
const R = (opt = {}) => ({ set: 10, hidden: true, maxCopies: 1, tier: 3, ...opt });
// 【選定】山札の上から2枚を見て1枚を手札に（【観測】の2枚版）
const SELECT = { op: 'observe', n: 2, kw: 'select' };

export const RITE_CARDS = [
  M('r_shiena', '夕凪の選定官 シエナ', 'fire', 4, 4, 3, 'humanoid', R({
    elements: ['fire', 'water'], keywords: ['select'],
    text: '【双属】【選定】【登場時】相手プレイヤーに2ダメージ。',
    onSummon: [SELECT, { op: 'damageFace', side: 'enemy', v: 2 }],
    flavor: '水の中でも、灯は消えない。夕凪は、ふたつの力が争うのをやめる時刻。',
  })),
  M('r_mirte', '潮森の選定官 ミルテ', 'water', 4, 4, 4, 'humanoid', R({
    elements: ['water', 'grass'], keywords: ['select'],
    text: '【双属】【選定】【ターン開始時】自分のライフを1回復。',
    onSummon: [SELECT],
    onTurnStart: [{ op: 'heal', side: 'self', v: 1 }],
    flavor: '注いだ水の数だけ、若葉が挨拶を返してくれる。',
  })),
  M('r_kagura', '燎原の選定官 カグラ', 'grass', 4, 3, 3, 'humanoid', R({
    elements: ['grass', 'fire'], keywords: ['select'],
    text: '【双属】【選定】【登場時】自分のモンスター全ての攻撃力を+1する。',
    onSummon: [SELECT, { op: 'buff', side: 'self', target: 'all', atk: 1, def: 0 }],
    flavor: '焼けた野にこそ、次の芽が出る。鈴が鳴るたび、火の粉が踊る。',
  })),
  M('r_elsion', '三晶の大祭司 エルシオン', 'fire', 6, 5, 5, 'humanoid', R({
    elements: ['fire', 'water', 'grass'], keywords: ['select'],
    text: '【三属】【選定】【登場時】自分のモンスター全てを+1/+1する。',
    onSummon: [SELECT, { op: 'buff', side: 'self', target: 'all', atk: 1, def: 1 }],
    flavor: '選ばれし者よ。選んできた道の数だけ、おまえは強い。',
  })),
];
