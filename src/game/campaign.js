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

export const AREAS = [
  {
    id: 'a1', name: 'はじまりの草原', desc: '旅の始まり。まだ手加減してくれる相手ばかり。',
    enemies: [
      E('見習いのトト', '🧒', mk([
        ['g01', 3], ['g03', 3], ['w01', 3], ['w04', 3], ['f01', 3], ['f02', 3],
        ['g04', 2], ['w02', 2], ['sn1', 3], ['sg1', 3], ['sn2', 2],
      ]), { face: 'g01', noise: 7, life: 18, desc: 'まだカードの使い方を覚えたて。' }),
      E('罠師のガロ', '🪤', mk([
        ['g02', 3], ['g03', 3], ['g05', 3], ['w01', 3], ['w05', 3], ['g04', 3],
        ['sn8', 2], ['sg1', 3], ['sn5', 3], ['sg2', 3], ['sn3', 1],
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
      E('世界樹の守護者', '🌳', mk([
        ['g01', 2], ['x_g2', 3], ['x_g3', 3], ['g07', 3], ['x_g4', 2], ['x_g5', 3], ['g09', 3], ['g10', 2],
        ['x_sg4', 3], ['x_sg1', 3], ['sg1', 3],
      ]), { face: 'g10', weak: 'fire', noise: 0, life: 26, startCost: 1, desc: 'エリアボス。ユグドラの加護を受ける。' }),
    ],
  },
  {
    id: 'a5', name: '三属の頂', desc: '三つの属性が交わる最果て。ここまでのカードでは足りない。',
    enemies: [
      E('双子の術士', '👯', mk([
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
];

// ---------- パック ----------
// パックの中身は第2弾『嵐の来訪者』が中心。
// 第1弾のカードも一定割合で出る（デッキの土台を厚くするため）。
export const PACK_TYPES = {
  bronze: {
    name: 'ブロンズパック', size: 5, set2Rate: 0.30,
    weights: { common: 68, uncommon: 27, rare: 5, epic: 0 },
    lastSlot: { common: 0, uncommon: 78, rare: 20, epic: 2 },
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
    const wantSet2 = rand() < t.set2Rate;
    let pool = ALL_CARDS.filter(c => c.rarity === rarity && (wantSet2 ? c.set === 2 : c.set === 1));
    if (!pool.length) pool = ALL_CARDS.filter(c => c.rarity === rarity);
    if (!pool.length) pool = ALL_CARDS.filter(c => c.rarity === 'common');
    out.push(pool[Math.floor(rand() * pool.length)].id);
  }
  return out;
}

// エリアクリア報酬
export const REWARD = { a1: 'bronze', a2: 'silver', a3: 'silver', a4: 'gold', a5: 'gold' };

// ---------- セーブ ----------
const KEY = 'tri-elements-save-v1';
export function newSave() {
  return {
    collection: { ...STARTER_COLLECTION },
    deck: [...STARTER_DECK],
    cleared: {},        // `${areaId}:${enemyIndex}` -> true
    packs: {},          // 未開封パック
    stats: { wins: 0, losses: 0 },
  };
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const s = JSON.parse(raw);
    if (!s.collection || !s.deck) return newSave();
    return s;
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
