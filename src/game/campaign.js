// ============================================================
// ソロRPG進行：エリア／敵／報酬パック／セーブデータ
// ============================================================
import { mk } from './decks.js';
import { ALL_CARDS, SET2_CARDS, card } from '../engine/cards.js';

// ---------- 初期配布デッキ（コストカーブを見て30枚） ----------
// c1:8  c2:8  c3:5  c4:2  c5:1  サポート:6
export const STARTER_DECK = mk([
  ['f01', 2], ['g01', 2], ['w01', 2],              // 1コスト モンスター6
  ['f03', 3], ['w03', 2], ['g03', 3],              // 2コスト モンスター8
  ['f05', 3], ['w05', 2], ['g05', 1],              // 3コスト モンスター6
  ['g07', 3],                                       // 4コスト 3
  ['f09', 1],                                       // 5コスト 1
  ['sf1', 2], ['sn2', 1], ['sn5', 2], ['sn8', 1],  // サポート 6（1コスト3・2コスト3）
]);

export const STARTER_COLLECTION = (() => {
  const col = {};
  STARTER_DECK.forEach(id => { col[id] = (col[id] || 0) + 1; });
  return col;
})();

// ---------- 敵デッキ ----------
const E = (name, icon, deck, opt = {}) => ({
  name, icon, deck, noise: opt.noise ?? 0, profile: opt.profile || 'balanced',
  life: opt.life, startCost: opt.startCost || 0, desc: opt.desc || '',
  face: opt.face || null,        // 立ち絵に使うカードID（assets/enemy/<area>_<i>.png があればそちら優先）
  weak: opt.weak || null,        // 有効な属性のヒント
});

// ---- 第3弾エリア（6〜8）の敵デッキ ----
// 1体ずつ役割を分けた30枚。カーブは 1c:4 2c:5 3c:4-5 4c:4-5 5c:2-3 6c:2-3 が基本。

// A6-1 観測者リィナ：観測とドローで手札を整える水。壁は薄い。
const D_RIINA = mk([
  ['z_w1', 2], ['w02', 2],
  ['w03', 3], ['z_w2', 2],
  ['w07', 2], ['w06', 2],
  ['z_w4', 2], ['w08', 2],
  ['x_w5', 2], ['z_w5', 2],
  ['x_w6', 1],
  ['z_sw1', 2], ['z_sw2', 2], ['sw3', 2], ['z_sn2', 2],
]);
// A6-2 歯車の巡礼者：【加速】と装備で星具を回す混成。
const D_PILGRIM = mk([
  ['z_f1', 2], ['z_g1', 2],
  ['z_f2', 2], ['z_g2', 3],
  ['z_g3', 2], ['z_f3', 2],
  ['z_f4', 2], ['z_g4', 2],
  ['z_g5', 2],
  ['z_w6', 1], ['z_f6', 1],
  ['z_sn1', 3], ['z_sn2', 3], ['x_sn1', 2], ['sn2', 1],
]);
// A6-3 黄昏の門番 オルド：守護を並べて全体強化で押し返す草。
const D_ORDO = mk([
  ['z_g1', 2], ['x_g1', 2],
  ['z_g2', 3], ['x_g2', 2],
  ['z_g3', 2], ['g05', 1],
  ['z_g4', 2], ['x_g4', 2],
  ['z_g5', 2], ['x_g5', 2],
  ['z_g6', 2], ['x_g6', 1],
  ['z_sg1', 2], ['x_sg4', 2], ['sg2', 2], ['z_sn1', 1],
]);

// A7-1 星読みのユエ：静止の月で足を止めて上から殴る水コントロール。
const D_YUE = mk([
  ['z_w1', 2], ['w02', 2],
  ['w03', 3], ['z_w2', 2],
  ['z_w3', 2], ['w07', 2],
  ['z_w4', 2], ['w08', 2],
  ['x_w5', 3], ['z_w5', 2],
  ['z_w6', 1], ['w10', 1],
  ['z_sw2', 3], ['sw3', 2], ['z_sn2', 1],
]);
// A7-2 彗星騎士 カイロス：【貫通】【連撃】で守護を無視して走る炎アグロ。
const D_KAIROS = mk([
  ['z_f1', 3], ['x_f1', 2],
  ['f03', 3], ['z_f2', 2],
  ['z_f3', 3], ['x_f2', 2],
  ['f08', 2], ['z_f4', 2],
  ['f09', 2],
  ['z_f6', 1],
  ['z_sf1', 3], ['x_sf1', 2], ['z_sf2', 1], ['sn2', 2],
]);
// A7-3 門の守り手 アステル：三属性を平均的に使う総合力型。
const D_ASTEL = mk([
  ['z_f1', 2], ['z_w1', 2],
  ['z_g2', 3], ['w03', 2],
  ['z_f3', 2], ['z_g3', 2], ['z_w3', 1],
  ['z_f4', 2], ['z_g4', 2], ['z_w4', 1],
  ['z_g5', 2],
  ['z_g6', 1], ['z_f6', 1],
  ['z_sn1', 1], ['z_sn2', 3], ['z_sg1', 2], ['sn2', 1],
]);

// A8-1 無貌の使者：天秤の裁定で手札を平らにしてくる混成。
const D_FACELESS = mk([
  ['z_f1', 2], ['z_g1', 2],
  ['z_f2', 2], ['z_g2', 2], ['w03', 1],
  ['z_f3', 2], ['z_g3', 2], ['z_w3', 1],
  ['z_f4', 2], ['z_g4', 2], ['z_w4', 1],
  ['z_g5', 1], ['x_g5', 1],
  ['z_f6', 2], ['z_w6', 1],
  ['z_sn3', 2], ['z_sn1', 1], ['z_sn2', 2], ['z_sf2', 1],
]);
// A8-2 双極の女王：炎の打点と水の妨害を半身ずつ。
const D_QUEEN = mk([
  ['z_f1', 2], ['z_w1', 2],
  ['z_f2', 2], ['w03', 2],
  ['z_f3', 2], ['z_w3', 2],
  ['z_f4', 2], ['z_w4', 2], ['x_w4', 1],
  ['f09', 2], ['z_w5', 2],
  ['z_f6', 2], ['z_w6', 1],
  ['z_sf2', 1], ['z_sw2', 2], ['z_sn2', 2], ['z_sn1', 1],
]);
// A8-3 星辰王 アストラリス：【門の鍵】で伸ばしてレジェンドを着地させる最終ボス。
const D_ASTRALIS = mk([
  ['z_g1', 2], ['z_f1', 1],
  ['z_g2', 3], ['z_f2', 2],
  ['z_g3', 2], ['z_f3', 2],
  ['z_f4', 2], ['z_g4', 2], ['z_w4', 1],
  ['z_g5', 2],
  ['z_f6', 2], ['z_g6', 1],
  ['z_lf1', 1], ['z_lg1', 1], ['z_lw1', 1],
  ['z_sn1', 3], ['z_sf3', 2],
]);

export const AREAS = [
  {
    id: 'a1', name: 'はじまりの草原', desc: '旅の始まり。まだ手加減してくれる相手ばかり。',
    enemies: [
      E('見習いのトト', '🧒', mk([
        ['g01', 3], ['g03', 3], ['w01', 3], ['w04', 3], ['f01', 3], ['f02', 3],
        ['g04', 2], ['w02', 2], ['sn1', 3], ['sg1', 3], ['sn2', 2],
      ]), { face: 'g01', noise: 7, life: 18, desc: 'まだカードの使い方を覚えたて。' }),
      E('罠師のガロ', '🪤', mk([
        ['g02', 3], ['g03', 3], ['g05', 3], ['w01', 3], ['w05', 3], ['g04', 3], ['g07', 2], ['g01', 1],
        ['sn8', 2], ['sg1', 3], ['sn5', 1], ['sg2', 2], ['sn3', 1],
      ]), { face: 'g02', weak: 'fire', noise: 5, life: 20, profile: 'turtle', desc: '守りを固めてじっくり削ってくる。' }),
      E('草原の主 モーリー', '🐗', mk([
        ['g01', 3], ['g03', 3], ['g04', 3], ['g06', 3], ['g07', 3], ['g09', 2],
        ['sg1', 3], ['sg2', 3], ['sn5', 3], ['sn2', 2], ['sn1', 2],
      ]), { face: 'g09', weak: 'fire', noise: 4, life: 20, desc: 'エリアボス。草の力で押してくる。' }),
    ],
  },
  {
    id: 'a2', name: '燃える丘', desc: '炎の民が住まう乾いた丘。速攻に注意。水の力が有効。',
    enemies: [
      E('火の子ピリカ', '🔥', mk([
        ['f01', 3], ['f02', 3], ['f03', 3], ['f04', 3], ['f05', 3], ['f07', 2],
        ['sf1', 3], ['sf2', 2], ['sn6', 2], ['sf4', 3], ['sn1', 3],
      ]), { face: 'f02', weak: 'water', noise: 4, life: 20, profile: 'aggro', desc: 'とにかく速い。序盤で殴り切られる。' }),
      E('溶岩守りゴウ', '🌋', mk([
        ['f06', 3], ['f05', 3], ['f03', 3], ['f08', 3], ['f01', 2], ['g03', 3], ['g05', 2],
        ['sf2', 3], ['sn5', 3], ['sf3', 3], ['sn6', 2],
      ]), { face: 'f06', weak: 'water', noise: 3, life: 20, desc: '【貫通】で守護を無視してくる。' }),
      E('炎皇バルガ', '👹', mk([
        ['f03', 3], ['f05', 3], ['f07', 3], ['f08', 3], ['f09', 3], ['f10', 2],
        ['sf1', 3], ['sf2', 3], ['sf3', 3], ['sf4', 2], ['sn6', 2],
      ]), { face: 'f10', weak: 'water', noise: 2, life: 22, profile: 'aggro', desc: 'エリアボス。煉獄竜を従える。' }),
    ],
  },
  {
    id: 'a3', name: '凍る入り江', desc: '潮の民の領海。除去と長期戦を挑まれる。草の力が有効。',
    enemies: [
      E('潮見のミナ', '🌊', mk([
        ['w03', 3], ['w04', 3], ['w07', 3], ['x_w1', 3], ['x_w2', 3], ['w09', 2],
        ['sw1', 2], ['sw3', 3], ['sw4', 3], ['x_sw1', 3], ['sn2', 2],
      ]), { face: 'w04', weak: 'grass', noise: 1, life: 22, startCost: 1, desc: '回復とドローで粘りながら削ってくる。' }),
      E('氷壁のヴァル', '🧊', mk([
        ['w05', 3], ['w08', 3], ['x_w3', 3], ['x_w7', 3], ['w01', 2], ['x_w4', 3],
        ['sw2', 3], ['x_sw3', 3], ['x_sw4', 2], ['sn5', 3], ['sn8', 2],
      ]), { face: 'w08', weak: 'grass', noise: 0, life: 22, startCost: 1, profile: 'turtle', desc: '守護の壁を並べ、山札まで削ってくる。' }),
      E('海皇ネプト', '🔱', mk([
        ['w01', 2], ['w03', 3], ['w07', 3], ['x_w1', 2], ['x_w4', 3], ['x_w5', 3], ['w09', 2], ['x_w6', 2], ['w10', 2],
        ['sw4', 3], ['x_sw5', 3], ['sw3', 2],
      ]), { face: 'w10', weak: 'grass', noise: 0, life: 22, startCost: 1, desc: 'エリアボス。大海嘯の王を呼ぶ。' }),
    ],
  },
  {
    id: 'a4', name: '古代の森', desc: '世界樹の根が張る森。強化されたモンスターが襲う。炎の力が有効。',
    enemies: [
      E('蔦使いリム', '🌿', mk([
        ['g01', 3], ['x_g2', 3], ['x_g3', 3], ['g06', 3], ['g07', 3], ['x_g5', 2],
        ['sg1', 3], ['x_sg1', 3], ['x_sg4', 3], ['sn5', 2], ['sn6', 2],
      ]), { face: 'x_g3', weak: 'fire', noise: 0, life: 24, startCost: 1, desc: '強化を重ねて巨大化させてくる。' }),
      E('森の狩人ヨナ', '🏹', mk([
        ['f01', 3], ['f03', 3], ['f05', 3], ['f08', 2], ['f09', 2],
        ['g01', 3], ['g03', 3], ['x_g2', 2], ['g07', 2],
        ['sf2', 2], ['sg1', 3], ['sn6', 2],
      ]), { face: 'g07', weak: 'water', noise: 0, life: 22, profile: 'aggro', desc: '炎と草の合わせ技。隙がない。' }),
      E('世界樹の守護者 ヴェルダ', '🌳', mk([
        ['g01', 2], ['x_g2', 3], ['x_g3', 3], ['g07', 3], ['x_g4', 2], ['x_g5', 3], ['g09', 3], ['g10', 2],
        ['x_sg4', 3], ['x_sg1', 3], ['sg1', 3],
      ]), { face: 'g10', weak: 'fire', noise: 0, life: 26, startCost: 1, desc: 'エリアボス。ユグドラの加護を受ける。' }),
    ],
  },
  {
    id: 'a5', name: '三属の頂', desc: '三つの属性が交わる最果て。ここまでのカードでは足りない。',
    enemies: [
      E('双子の術士 フレア & ミスト', '👯', mk([
        ['f01', 3], ['f03', 3], ['f05', 3], ['x_f2', 2], ['f09', 2],
        ['x_w1', 3], ['x_w4', 3], ['x_g3', 3],
        ['sf3', 3], ['x_sf1', 3], ['sn6', 2],
      ]), { face: 'x_f3', noise: 0, life: 24, startCost: 1, desc: '三属性を器用に使い分ける。' }),
      E('無銘の剣士', '⚔️', mk([
        ['f01', 3], ['f03', 3], ['f05', 3], ['x_f2', 3], ['x_f4', 3], ['f08', 2], ['f09', 2],
        ['sf2', 3], ['x_sf1', 3], ['x_sf3', 3], ['sf1', 2],
      ]), { face: 'x_f4', noise: 0, life: 24, startCost: 1, profile: 'aggro', desc: '純粋な殴り合いを挑んでくる。連撃に注意。' }),
      E('三属の王 トリアデス', '👑', mk([
        ['f01', 3], ['f03', 2], ['f05', 3], ['x_f2', 2], ['x_f5', 2], ['f09', 2], ['f10', 2],
        ['x_w4', 2], ['x_w5', 2], ['x_g5', 2], ['x_g6', 2],
        ['x_sf3', 3], ['sf2', 3],
      ]), { face: 'f10', noise: 0, life: 26, startCost: 1, desc: '最終ボス。三属性の切り札を全て操る。' }),
    ],
  },
  {
    id: 'a6', name: '黄昏の回廊', desc: '星辰の門へ続く崩れた石の回廊。無機の星具が目を覚ます。',
    enemies: [
      E('観測者リィナ', '🔭', [...D_RIINA], {
        face: 'z_w4', weak: 'grass', noise: 1, life: 28, startCost: 1,
        desc: '【観測】で必要な星具を探し当ててくる。壁は薄いので押し切れる。',
      }),
      E('歯車の巡礼者 カルダン', '⚙️', [...D_PILGRIM], {
        face: 'z_sn1', noise: 0, life: 26, startCost: 1,
        desc: '【加速】と装備で星具を回す。育ちきる前に叩きたい。',
      }),
      E('黄昏の門番 オルド', '🗿', [...D_ORDO], {
        face: 'z_g6', weak: 'fire', noise: 0, life: 27, startCost: 1,
        desc: 'エリアボス。守護を並べ、全体強化で一気に押し返してくる。',
      }),
    ],
  },
  {
    id: 'a7', name: '星辰の門', desc: '空が近い高原に、世界を隔てる巨大な門が立つ。',
    enemies: [
      E('星読みのユエ', '🌙', [...D_YUE], {
        face: 'z_w5', weak: 'grass', noise: 0, life: 32, startCost: 1,
        desc: '【静止の月】で足を止め、上から殴ってくる。長期戦は不利。',
      }),
      E('彗星騎士 カイロス', '☄️', [...D_KAIROS], {
        face: 'z_f3', weak: 'water', noise: 0, life: 22, startCost: 1, profile: 'aggro',
        desc: '【貫通】【連撃】で守護を無視して走る。速度勝負を挑まれる。',
      }),
      E('門の守り手 アステル', '✨', [...D_ASTEL], {
        face: 'z_ln1', noise: 0, life: 26, startCost: 1,
        desc: 'エリアボス。三属性を平均的に使いこなす総合力型。',
      }),
    ],
  },
  {
    id: 'a8', name: '王たちの座', desc: '門の向こう側。足元も空も星に満ちた、王たちの終着点。',
    enemies: [
      E('無貌の使者 ノクス', '🎭', [...D_FACELESS], {
        face: 'z_sn3', noise: 0, life: 28, startCost: 1,
        desc: '【天秤の裁定】で手札を平らにしてくる。溜め込む戦い方は通じない。',
      }),
      E('双極の女王 ディオーネ', '♊', [...D_QUEEN], {
        face: 'z_lw1', noise: 0, life: 30, startCost: 1,
        desc: '炎の打点と水の妨害を半身ずつ宿す。攻守どちらも隙がない。',
      }),
      E('星辰王 アストラリス', '👑', [...D_ASTRALIS], {
        face: 'z_lf1', noise: 0, life: 30, startCost: 1,
        desc: '最終ボス。【門の鍵】でコストを伸ばし、レジェンドを着地させてくる。',
      }),
    ],
  },
];

// ---------- パック ----------
// パックの中身は第2弾『嵐の来訪者』が中心。
// 第1弾のカードも一定割合で出る（デッキの土台を厚くするため）。
export const PACK_TYPES = {
  // ブロンズは第1弾のみ。第2弾はシルバー（燃える丘クリア）から解禁する
  bronze: {
    name: 'ブロンズパック', size: 5, set2Rate: 0,
    weights: { common: 68, uncommon: 27, rare: 5, epic: 0 },
    lastSlot: { common: 0, uncommon: 80, rare: 20, epic: 0 },
  },
  silver: {
    name: 'シルバーパック', size: 5, set2Rate: 0.55,
    weights: { common: 45, uncommon: 38, rare: 16, epic: 1 },
    lastSlot: { common: 0, uncommon: 55, rare: 38, epic: 7 },
  },
  gold: {
    name: 'ゴールドパック', size: 5, set2Rate: 0.75,
    weights: { common: 22, uncommon: 42, rare: 32, epic: 4 },
    lastSlot: { common: 0, uncommon: 20, rare: 62, epic: 18 },
  },
  prism: {
    name: 'プリズムパック', size: 5, set: 3,
    weights: { common: 28, uncommon: 38, rare: 25, epic: 8, legend: 1 },
    lastSlot: { common: 0, uncommon: 22, rare: 48, epic: 24, legend: 6 },
  },
};

function pickWeighted(w, rand) {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; }
  return Object.keys(w)[0];
}

export function openPack(type, rand = Math.random) {
  const t = PACK_TYPES[type] || PACK_TYPES.bronze;
  const out = [];
  for (let i = 0; i < t.size; i++) {
    // 最後の1枚は必ずアンコモン以上（当たり枠）
    const rarity = pickWeighted(i === t.size - 1 ? t.lastSlot : t.weights, rand);
    const wantSet2 = rand() < (t.set2Rate || 0);
    const wantSet = t.set || (wantSet2 ? 2 : 1);
    // キャラクターカードは隠しなのでパックからは絶対に出さない
    const packable = ALL_CARDS.filter(c => !c.hidden);
    let pool = packable.filter(c => c.rarity === rarity && c.set === wantSet);
    // その弾に該当レア度が無ければ、同じ弾の1段下のレア度へ落とす（弾の壁は越えない）
    const order = ['legend', 'epic', 'rare', 'uncommon', 'common'];
    for (let k = order.indexOf(rarity) + 1; !pool.length && k < order.length; k++) {
      pool = packable.filter(c => c.rarity === order[k] && c.set === wantSet);
    }
    if (!pool.length) pool = packable.filter(c => c.rarity === 'common');
    out.push(pool[Math.floor(rand() * pool.length)].id);
  }
  return out;
}

// エリアクリア報酬
// フリーバトルの難易度と、勝ったときにもらえる星屑
export const FREE_DIFFICULTY = {
  normal:  { name: 'ノーマル', life: 0, cost: 0, dust: 1, color: '#8fa0b6' },
  hard:    { name: '強化',     life: 4, cost: 1, dust: 2, color: '#67b6ff' },
  extreme: { name: '極',       life: 8, cost: 2, dust: 4, color: '#c58cff' },
};

// 星屑とパックの交換レート
export const DUST_SHOP = [
  { pack: 'bronze', cost: 2 },
  { pack: 'silver', cost: 5 },
  { pack: 'gold', cost: 8 },
  { pack: 'prism', cost: 10, unlockAfter: 'a5' },
];

// 同じ相手からパックをもらえる回数
export const REWARD_LIMIT = 3;

export const REWARD = {
  a1: 'bronze', a2: 'silver', a3: 'silver', a4: 'gold', a5: 'gold',
  a6: 'prism', a7: 'prism', a8: 'prism',
};

export function prismUnlocked(save) {
  const area = AREAS.find(a => a.id === 'a5');
  return !!area && area.enemies.every((_, i) => save.cleared?.[`a5:${i}`]);
}

// ---------- セーブ ----------
const KEY = 'tri-elements-save-v1';
export const AVATARS = [
  { id: 1, name: '少年', emoji: '🧒', tint: '#a2492a' },
  { id: 2, name: '少女', emoji: '👧', tint: '#8a4a7a' },
  { id: 3, name: '10代 男', emoji: '👦', tint: '#2a6ea8' },
  { id: 4, name: '10代 女', emoji: '👩', tint: '#357f47' },
  { id: 5, name: '大人 男性', emoji: '🧔', tint: '#6a4a8a' },
  { id: 6, name: '大人 女性', emoji: '👩‍🦰', tint: '#8a5a2a' },
];

// 保存できるデッキの数
export const MAX_DECKS = 8;

/**
 * decks（複数スロット）と deck（実際に対戦で使う1つ）を整合させる。
 * 古いセーブには decks が無いので、その場合は今の deck を1枠目にする。
 */
export function ensureDecks(s) {
  if (!Array.isArray(s.decks) || !s.decks.length) {
    s.decks = [{ name: 'デッキ1', list: [...(s.deck || STARTER_DECK)] }];
  }
  s.decks = s.decks.slice(0, MAX_DECKS).map((d, i) => ({
    name: String((d && d.name) || `デッキ${i + 1}`).slice(0, 14),
    list: Array.isArray(d && d.list) ? [...d.list] : [],
  }));
  if (typeof s.activeDeck !== 'number' || !s.decks[s.activeDeck]) s.activeDeck = 0;
  s.deck = [...s.decks[s.activeDeck].list];   // 対戦で使うのは常に選択中のスロット
  return s;
}

export function newSave() {
  return {
    profile: null,      // { name, avatar } — 未設定なら初回の名前入力へ
    collection: { ...STARTER_COLLECTION },
    deck: [...STARTER_DECK],
    decks: [{ name: 'デッキ1', list: [...STARTER_DECK] }],
    activeDeck: 0,
    cleared: {},        // `${areaId}:${enemyIndex}` -> true（解放判定）
    clearCount: {},     // 同じ相手を倒した回数（報酬は REWARD_LIMIT 回まで）
    packs: {},          // 未開封パック
    stats: { wins: 0, losses: 0 },
    freeStats: {},      // フリーバトルの相手ごとの戦績 { 'a1:0': {w,l} }
    stardust: 0,        // フリーバトルで貯まる交換用ポイント
  };
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const s = JSON.parse(raw);
    if (!s.collection || !s.deck) return newSave();
    // 古いセーブの補完
    s.freeStats = s.freeStats || {};
    s.stardust = s.stardust || 0;
    if (!s.clearCount) {
      s.clearCount = {};
      Object.keys(s.cleared || {}).forEach(k => { s.clearCount[k] = 1; });
    }
    return ensureDecks(s);
  } catch { return newSave(); }
}
export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function areaUnlocked(save, index) {
  if (index === 0) return true;
  const prev = AREAS[index - 1];
  return prev.enemies.every((_, i) => save.cleared[`${prev.id}:${i}`]);
}
export function addCards(save, ids) {
  ids.forEach(id => { save.collection[id] = (save.collection[id] || 0) + 1; });
}
export function deckCurve(deck) {
  const c = {};
  deck.forEach(id => { const k = Math.min(card(id).cost, 7); c[k] = (c[k] || 0) + 1; });
  return c;
}
