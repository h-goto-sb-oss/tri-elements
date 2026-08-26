// ============================================================
// カードデータベース
//   monster: cost / atk / def / element / keywords / effects
//   support: cost / element / effects  (equip=true ならサポートゾーンに残る)
// effect DSL は engine/effects.js が解釈する
// ============================================================
import { M, S } from './cardbuild.js';
import { SET2 } from './cards_set2.js';

export const ELEMENTS = {
  fire:  { key: 'fire',  name: '炎', icon: '🔥', color: '#ff6a3d' },
  water: { key: 'water', name: '水', icon: '💧', color: '#3da9ff' },
  grass: { key: 'grass', name: '草', icon: '🌿', color: '#4cc46a' },
  none:  { key: 'none',  name: '無', icon: '✦', color: '#b9a77a' },
};

// 相性: 炎 → 草 → 水 → 炎（攻撃側が有利属性なら戦闘時 +ELEMENT_BONUS）
export const STRONG_AGAINST = { fire: 'grass', grass: 'water', water: 'fire' };

export const KEYWORDS = {
  guard:  { name: '守護', desc: '相手はまず守護モンスターを攻撃対象に選ぶ。' },
  pierce: { name: '貫通', desc: '【守護】を無視して攻撃対象を選べる。' },
  double: { name: '連撃', desc: '1ターンに2回攻撃できる。' },
};

// ------------------------------------------------------------
// 炎モンスター (10) — 火力・直接ダメージ・貫通
// ------------------------------------------------------------
const FIRE_MONSTERS = [
  M('f01', 'ヒバナトカゲ', 'fire', 1, 3, 1, 'lizard', { tier: 1, flavor: '尻尾の先で小さな火花が弾ける。' }),
  M('f02', '火吹きヒナ', 'fire', 1, 1, 1, 'bird', {
    tier: 1, text: '【登場時】相手プレイヤーに1ダメージ。',
    onSummon: [{ op: 'damageFace', side: 'enemy', v: 1 }], flavor: 'くしゃみひとつが山火事になる。',
  }),
  M('f03', 'フレイムウルフ', 'fire', 2, 4, 2, 'beast', { tier: 1, flavor: '燃える鬣が夜を裂く。' }),
  M('f04', '爆炎コウモリ', 'fire', 2, 2, 1, 'bat', {
    tier: 1, text: '【断末魔】相手プレイヤーに2ダメージ。',
    onDeath: [{ op: 'damageFace', side: 'enemy', v: 2 }], flavor: '死してなお爆ぜる。',
  }),
  M('f05', '灼熱の剣士', 'fire', 3, 5, 4, 'humanoid', { tier: 1, flavor: '刃はいつも赤い。' }),
  M('f06', 'マグマゴーレム', 'fire', 3, 4, 5, 'golem', {
    tier: 2, keywords: ['pierce'], text: '【貫通】', flavor: '歩いた跡が溶岩の川になる。',
  }),
  M('f07', '灰かぶりの魔女', 'fire', 3, 3, 2, 'witch', {
    tier: 2, text: '【登場時】相手プレイヤーに3ダメージ。',
    onSummon: [{ op: 'damageFace', side: 'enemy', v: 3 }], flavor: '灰の中から呪いを掬う。',
  }),
  M('f08', '双炎の戦鬼', 'fire', 4, 5, 4, 'oni', {
    tier: 2, keywords: ['pierce'], text: '【貫通】', flavor: '二振りの炎、二度の絶叫。',
  }),
  M('f09', '業火のドラゴン', 'fire', 5, 8, 4, 'dragon', { tier: 2, flavor: '空が焦げる音がした。' }),
  M('f10', '煉獄竜 ヴォルカニス', 'fire', 6, 7, 5, 'dragon', {
    tier: 3, keywords: ['pierce'], text: '【貫通】【登場時】相手プレイヤーに3ダメージ。',
    onSummon: [{ op: 'damageFace', side: 'enemy', v: 3 }], flavor: '火口の底で千年、目を開けていた。',
  }),
];

// ------------------------------------------------------------
// 水モンスター (10) — ドロー・回復・防御・盤面操作
// ------------------------------------------------------------
const WATER_MONSTERS = [
  M('w01', 'シズククラゲ', 'water', 1, 1, 3, 'jelly', { tier: 1, flavor: 'ゆらゆら、けれど硬い。' }),
  M('w02', '潮見の巫女', 'water', 1, 1, 2, 'humanoid', {
    tier: 1, text: '【登場時】自分のライフを3回復。',
    onSummon: [{ op: 'heal', side: 'self', v: 3 }], flavor: '波の高さで明日を読む。',
  }),
  M('w03', 'アイスシャーク', 'water', 2, 4, 3, 'fish', { tier: 1, flavor: '氷の下から来る。' }),
  M('w04', '泡沫のセイレーン', 'water', 2, 2, 2, 'humanoid', {
    tier: 1, text: '【登場時】カードを1枚引く。',
    onSummon: [{ op: 'draw', side: 'self', n: 1 }], flavor: '歌は泡になって消える。',
  }),
  M('w05', '氷結の番人', 'water', 3, 3, 4, 'golem', {
    tier: 1, keywords: ['guard'], text: '【守護】', flavor: '門は凍りついたまま千年。',
  }),
  M('w06', '深海の伝令', 'water', 3, 3, 3, 'fish', {
    tier: 2, text: '【登場時】相手モンスター1体を防御モードにする。',
    onSummon: [{ op: 'setMode', side: 'enemy', mode: 'defense', target: 'one' }],
    flavor: '深海の命令に逆らえる者はいない。',
  }),
  M('w07', '霧隠れのウナギ', 'water', 3, 4, 3, 'serpent', {
    tier: 2, text: '【断末魔】カードを1枚引く。',
    onDeath: [{ op: 'draw', side: 'self', n: 1 }], flavor: '霧が晴れた頃にはもういない。',
  }),
  M('w08', '氷壁のクラーケン', 'water', 4, 4, 5, 'kraken', {
    tier: 2, keywords: ['guard'], text: '【守護】', flavor: '触腕そのものが城壁。',
  }),
  M('w09', '海淵のリヴァイアサン', 'water', 5, 5, 6, 'serpent', {
    tier: 2, text: '【登場時】カードを1枚引き、ライフを3回復。',
    onSummon: [{ op: 'draw', side: 'self', n: 1 }, { op: 'heal', side: 'self', v: 3 }], flavor: '深さは測れなかった。',
  }),
  M('w10', '大海嘯の王 ネプチューナ', 'water', 6, 5, 6, 'kraken', {
    tier: 3, keywords: ['guard'],
    text: '【守護】【登場時】相手モンスター全てを防御モードにし、カードを1枚引く。',
    onSummon: [{ op: 'setMode', side: 'enemy', mode: 'defense', target: 'all' }, { op: 'draw', side: 'self', n: 1 }],
    flavor: '王が身じろぎすると、岸が消える。',
  }),
];

// ------------------------------------------------------------
// 草モンスター (10) — 強化・耐久・盤面維持
// ------------------------------------------------------------
const GRASS_MONSTERS = [
  M('g01', 'ふたばウサギ', 'grass', 1, 2, 3, 'beast', { tier: 1, flavor: '双葉の耳がぴくりと動く。' }),
  M('g02', 'トゲの門番', 'grass', 1, 0, 3, 'plant', {
    tier: 1, keywords: ['guard'], text: '【守護】', flavor: '通りたければ痛い思いをしろ。',
  }),
  M('g03', 'キノコ戦士', 'grass', 2, 3, 4, 'plant', { tier: 1, flavor: '胞子まみれの小さな盾。' }),
  M('g04', '蔦絡みの精霊', 'grass', 2, 2, 3, 'spirit', {
    tier: 1, text: '【登場時】自分のモンスター1体を+1/+1する。',
    onSummon: [{ op: 'buff', side: 'self', target: 'one', atk: 1, def: 1, duration: 'permanent' }],
    flavor: '絡まれた者は、なぜか強くなる。',
  }),
  M('g05', '森羅の守り手', 'grass', 3, 2, 4, 'treant', {
    tier: 1, keywords: ['guard'], text: '【守護】', flavor: '森の外周はいつも静かだ。',
  }),
  M('g06', '花咲く癒し手', 'grass', 3, 4, 3, 'spirit', {
    tier: 2, text: '【ターン開始時】自分のライフを1回復。',
    onTurnStart: [{ op: 'heal', side: 'self', v: 1 }], flavor: '咲くたびに誰かの傷が閉じる。',
  }),
  M('g07', '大樹のトレント', 'grass', 4, 6, 6, 'treant', { tier: 2, flavor: '年輪の数だけ戦を見てきた。' }),
  M('g08', '猛毒のマンドラゴラ', 'grass', 4, 3, 4, 'plant', {
    tier: 2, text: '【断末魔】相手モンスター1体を破壊する。',
    onDeath: [{ op: 'destroy', side: 'enemy', target: 'one' }], flavor: '抜かれた時の叫びが毒になる。',
  }),
  M('g09', '古森の巨人', 'grass', 5, 7, 7, 'giant', { tier: 2, flavor: '苔むした拳が地面を割る。' }),
  M('g10', '世界樹の化身 ユグドラ', 'grass', 6, 5, 7, 'treant', {
    tier: 3, text: '【登場時】自分のモンスター全てを+2/+2する。',
    onSummon: [{ op: 'buff', side: 'self', target: 'all', atk: 2, def: 2, duration: 'permanent' }],
    flavor: '根は世界の裏側までのびている。',
  }),
];

// ------------------------------------------------------------
// サポート (25)
// ------------------------------------------------------------
const SUPPORTS = [
  // 炎 5
  S('sf1', '火炎弾', 'fire', 1, 'bolt', {
    tier: 1, text: '相手プレイヤーに2ダメージを与える。',
    effects: [{ op: 'damageFace', side: 'enemy', v: 2 }], flavor: '真っ直ぐ、それだけ。',
  }),
  S('sf2', '灼熱の刃', 'fire', 2, 'sword', {
    tier: 1, equip: true, text: '装備：自分のモンスター1体を+2/+0する。場に残る。',
    effects: [{ op: 'equip', atk: 2, def: 0 }], flavor: '柄まで焼けるが、構わない。',
  }),
  S('sf3', '火球', 'fire', 3, 'orb', {
    tier: 2, text: '攻撃力4以下の相手モンスター1体を破壊する。',
    effects: [{ op: 'destroy', side: 'enemy', target: 'one', filter: { maxAtk: 4 } }], flavor: '狙いは小物で十分。',
  }),
  S('sf4', '猛火の号令', 'fire', 2, 'banner', {
    tier: 2, text: 'このターン、自分のモンスター全てを+2/+0する。',
    effects: [{ op: 'buff', side: 'self', target: 'all', atk: 2, def: 0, duration: 'turn' }], flavor: '全軍、焼き払え。',
  }),
  S('sf5', '業火の裁き', 'fire', 5, 'meteor', {
    tier: 3, text: 'お互いのモンスターを全て破壊する。',
    effects: [{ op: 'destroyAll' }], flavor: '公平とは、等しく灰になることだ。',
  }),

  // 水 5
  S('sw1', '潮のしずく', 'water', 1, 'potion', {
    tier: 1, text: '自分のライフを3回復する。',
    effects: [{ op: 'heal', side: 'self', v: 3 }], flavor: 'ひと雫で喉が潤う。',
  }),
  S('sw2', '氷の護り', 'water', 2, 'shield', {
    tier: 1, equip: true, text: '装備：自分のモンスター1体を+0/+4する。場に残る。',
    effects: [{ op: 'equip', atk: 0, def: 4 }], flavor: '溶けない氷で編んだ鎧。',
  }),
  S('sw3', '導きの潮流', 'water', 2, 'scroll', {
    tier: 2, text: 'カードを2枚引く。',
    effects: [{ op: 'draw', side: 'self', n: 2 }], flavor: '流れに乗れば、答えの方から来る。',
  }),
  S('sw4', '渦潮の呼び声', 'water', 3, 'wave', {
    tier: 2, text: '相手モンスター1体を持ち主の手札に戻す。',
    effects: [{ op: 'bounce', side: 'enemy', target: 'one' }], flavor: '海はいつでも返品を受け付ける。',
  }),
  S('sw5', '深淵の予言', 'water', 3, 'eye', {
    tier: 3, text: 'カードを2枚引き、ライフを2回復する。',
    effects: [{ op: 'draw', side: 'self', n: 2 }, { op: 'heal', side: 'self', v: 2 }], flavor: '深いほどよく見える。',
  }),

  // 草 5
  S('sg1', '光合成', 'grass', 1, 'leaf', {
    tier: 1, text: '自分のモンスター1体を+1/+1する。',
    effects: [{ op: 'buff', side: 'self', target: 'one', atk: 1, def: 1, duration: 'permanent' }],
    flavor: '陽の光は無料の食事。',
  }),
  S('sg2', '茨の鎧', 'grass', 2, 'armor', {
    tier: 1, equip: true, text: '装備：自分のモンスター1体を+1/+3する。場に残る。',
    effects: [{ op: 'equip', atk: 1, def: 3 }], flavor: '守りながら、少し刺す。',
  }),
  S('sg3', '森の加護', 'grass', 2, 'ward', {
    tier: 2, text: '次の相手ターンが終わるまで、自分のモンスターは戦闘で破壊されない。',
    effects: [{ op: 'invuln', side: 'self' }], flavor: '森が味方をしている間は、誰も倒れない。',
  }),
  S('sg4', '再生の芽吹き', 'grass', 3, 'sprout', {
    tier: 2, text: '自分の墓地からコスト3以下のモンスター1体を場に出す。',
    effects: [{ op: 'revive', maxCost: 3 }], flavor: '土に還ったものは、また芽を出す。',
  }),
  S('sg5', '世界樹の実', 'grass', 5, 'fruit', {
    tier: 3, text: '自分のモンスター全てを+2/+2する。',
    effects: [{ op: 'buff', side: 'self', target: 'all', atk: 2, def: 2, duration: 'permanent' }],
    flavor: 'ひと齧りで背が伸びる。',
  }),

  // 汎用 10
  S('sn1', '応急手当', 'none', 1, 'potion', {
    tier: 1, text: '自分のライフを2回復する。',
    effects: [{ op: 'heal', side: 'self', v: 2 }], flavor: 'とりあえず巻いておけ。',
  }),
  S('sn2', '戦術の書', 'none', 1, 'book', {
    tier: 1, text: 'カードを1枚引く。',
    effects: [{ op: 'draw', side: 'self', n: 1 }], flavor: '次の一手は、めくれば分かる。',
  }),
  S('sn3', '防御指令', 'none', 1, 'flagblue', {
    tier: 1, text: '自分のモンスター1体を防御モードにする（モード変更回数を消費しない）。',
    effects: [{ op: 'setMode', side: 'self', mode: 'defense', target: 'one', free: true }], flavor: '構えろ！',
  }),
  S('sn4', '突撃指令', 'none', 1, 'flagred', {
    tier: 1, text: '自分のモンスター1体を攻撃モードにする（モード変更回数を消費しない）。',
    effects: [{ op: 'setMode', side: 'self', mode: 'attack', target: 'one', free: true }], flavor: '走れ！',
  }),
  S('sn5', '鋼の盾', 'none', 2, 'shield', {
    tier: 1, equip: true, text: '装備：自分のモンスター1体を+0/+3する。場に残る。',
    effects: [{ op: 'equip', atk: 0, def: 3 }], flavor: '重いが、割れない。',
  }),
  S('sn6', '双剣', 'none', 2, 'sword', {
    tier: 1, equip: true, text: '装備：自分のモンスター1体を+1/+2する。場に残る。',
    effects: [{ op: 'equip', atk: 1, def: 2 }], flavor: '二本目は保険だ。',
  }),
  S('sn7', '決死の一撃', 'none', 3, 'skull', {
    tier: 2, text: '自分のモンスター1体を破壊し、その攻撃力分のダメージを相手プレイヤーに与える。',
    effects: [{ op: 'sacrificeBurn', target: 'one' }], flavor: '最後の一歩は、いつも前へ。',
  }),
  S('sn8', '落とし穴', 'none', 2, 'pit', {
    tier: 2, text: '防御モードの相手モンスター1体を破壊する。',
    effects: [{ op: 'destroy', side: 'enemy', target: 'one', filter: { mode: 'defense' } }],
    flavor: '守っている者ほど足元を見ない。',
  }),
  S('sn9', '記憶の欠片', 'none', 1, 'crystal', {
    tier: 2, text: '自分の墓地からサポートカード1枚を手札に戻す。',
    effects: [{ op: 'recallSupport' }], flavor: '一度使った手は、二度使える。',
  }),
  S('sn10', '最後の抵抗', 'none', 1, 'torch', {
    tier: 3, text: 'カードを1枚引く。自分のライフが8以下ならさらに1枚引く。',
    effects: [{ op: 'draw', side: 'self', n: 1 }, { op: 'drawIfLowLife', threshold: 8, n: 1 }],
    flavor: '追い詰められてからが本番。',
  }),
];

export const ALL_CARDS = [...FIRE_MONSTERS, ...WATER_MONSTERS, ...GRASS_MONSTERS, ...SUPPORTS, ...SET2];
export const SET1_CARDS = ALL_CARDS.filter(c => c.set === 1);
export const SET2_CARDS = ALL_CARDS.filter(c => c.set === 2);
export const CARD_MAP = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]));
export const card = id => CARD_MAP[id];
