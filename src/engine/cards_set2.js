// ============================================================
// 第2弾『嵐の来訪者』 — 強化パック用カード
//   設計方針: 第1弾の弱点（水に除去と打点が無い／草に打点が無い）を埋め、
//   完全上位互換にならないよう「別の役割」を持たせる。
// ============================================================
import { M, S } from './cardbuild.js';

export const SET2 = [
  // ---------- 炎 8 ----------
  M('x_f1', '溶岩の申し子', 'fire', 1, 2, 1, 'spirit', {
    set: 2, tier: 2, text: '【断末魔】相手モンスター1体の防御力を-2する。',
    onDeath: [{ op: 'buff', side: 'enemy', target: 'one', atk: 0, def: -2, duration: 'permanent' }],
    flavor: '火口から生まれ、火口へ還る。',
  }),
  M('x_f2', '火喰い鳥 ヒクイ', 'fire', 3, 3, 3, 'bird', {
    set: 2, tier: 2, keywords: ['double'], text: '【連撃】',
    flavor: '一度で足りたためしがない。',
  }),
  M('x_f3', '火山の巫女', 'fire', 3, 2, 4, 'witch', {
    set: 2, tier: 2, text: '【ターン開始時】相手プレイヤーに1ダメージ。',
    onTurnStart: [{ op: 'damageFace', side: 'enemy', v: 1 }],
    flavor: '祈るたび、山が少し目を覚ます。',
  }),
  M('x_f4', 'ツインフレイム', 'fire', 4, 4, 3, 'oni', {
    set: 2, tier: 2, keywords: ['double'], text: '【連撃】',
    flavor: '片方が斬り、もう片方が焼く。',
  }),
  M('x_f5', '炎獣キマイラ', 'fire', 5, 6, 5, 'beast', {
    set: 2, tier: 3, text: '【登場時】防御力4以下の相手モンスター1体を破壊する。',
    onSummon: [{ op: 'destroy', side: 'enemy', target: 'one', filter: { maxDef: 4 } }],
    flavor: '三つの口が別々に吼える。',
  }),
  M('x_f6', '焦土の王 イグナ', 'fire', 6, 7, 6, 'dragon', {
    set: 2, tier: 3, keywords: ['pierce'],
    text: '【貫通】【登場時】相手プレイヤーに2ダメージ。【断末魔】相手プレイヤーに4ダメージ。',
    onSummon: [{ op: 'damageFace', side: 'enemy', v: 2 }],
    onDeath: [{ op: 'damageFace', side: 'enemy', v: 4 }],
    flavor: '倒れたあとに、本当の火が来る。',
  }),
  S('x_sf1', '決戦の狼煙', 'fire', 1, 'banner', {
    set: 2, tier: 2, text: 'このターン、自分の炎モンスター1体を+3/+0する。',
    effects: [{ op: 'buff', side: 'self', target: 'one', atk: 3, def: 0, duration: 'turn', filter: { element: 'fire' } }],
    flavor: '合図はひとつ。前へ。',
  }),
  S('x_sf3', '炎の共鳴', 'fire', 3, 'banner', {
    set: 2, tier: 2, text: 'このターン、自分の炎モンスター全てを+3/+0する。',
    effects: [{ op: 'buff', side: 'self', target: 'all', atk: 3, def: 0, duration: 'turn', filter: { element: 'fire' } }],
    flavor: '火は、火に呼ばれてさらに燃える。',
  }),
  S('x_sf2', '炎の雨', 'fire', 3, 'meteor', {
    set: 2, tier: 3, text: '防御力3以下の相手モンスターを全て破壊する。',
    effects: [{ op: 'destroyAllFiltered', side: 'enemy', filter: { maxDef: 3 } }],
    flavor: '空が割れて、赤が落ちてきた。',
  }),

  // ---------- 水 8 ----------
  M('x_w1', 'テンタクルス', 'water', 2, 2, 3, 'kraken', {
    set: 2, tier: 2, text: '【登場時】攻撃力が最も高い相手モンスター1体の攻撃力を-2する。',
    onSummon: [{ op: 'buff', side: 'enemy', target: 'one', atk: -2, def: 0, duration: 'permanent' }],
    flavor: '掴まれた腕は、二度と上がらない。',
  }),
  M('x_w2', '泡の道化師', 'water', 2, 2, 2, 'humanoid', {
    set: 2, tier: 2, text: '【断末魔】カードを1枚引き、ライフを1回復。',
    onDeath: [{ op: 'draw', side: 'self', n: 1 }, { op: 'heal', side: 'self', v: 1 }],
    flavor: '割れる音まで芸のうち。',
  }),
  M('x_w3', '潮騒の守護者', 'water', 3, 2, 5, 'golem', {
    set: 2, tier: 2, keywords: ['guard'], text: '【守護】【ターン開始時】自分のライフを1回復。',
    onTurnStart: [{ op: 'heal', side: 'self', v: 1 }],
    flavor: '満ち引きのあいだ、ずっと立っている。',
  }),
  M('x_w4', 'フロストウィッチ', 'water', 4, 3, 4, 'witch', {
    set: 2, tier: 3, text: '【登場時】攻撃力3以下の相手モンスター1体を破壊する。',
    onSummon: [{ op: 'destroy', side: 'enemy', target: 'one', filter: { maxAtk: 3 } }],
    flavor: '息を吐くだけで足が止まる。',
  }),
  M('x_w5', '海竜レヴィオン', 'water', 5, 7, 5, 'serpent', {
    set: 2, tier: 3, flavor: '水面が割れる前に、もう来ている。',
  }),
  M('x_w6', '深海王 アビスガルド', 'water', 6, 6, 7, 'kraken', {
    set: 2, tier: 3, keywords: ['guard'],
    text: '【守護】【登場時】相手モンスター1体を持ち主の手札に戻し、カードを2枚引く。',
    onSummon: [{ op: 'bounce', side: 'enemy', target: 'one' }, { op: 'draw', side: 'self', n: 2 }],
    flavor: '光の届かない場所にも、玉座はある。',
  }),
  S('x_sw1', '静かな水面', 'water', 2, 'wave', {
    set: 2, tier: 2, text: 'カードを1枚引き、自分のライフを2回復する。',
    effects: [{ op: 'draw', side: 'self', n: 1 }, { op: 'heal', side: 'self', v: 2 }],
    flavor: '波がないときほど、深い。',
  }),
  S('x_sw2', '大渦のうねり', 'water', 4, 'wave', {
    set: 2, tier: 3, text: '相手モンスターを全て持ち主の手札に戻す。',
    effects: [{ op: 'bounce', side: 'enemy', target: 'all' }],
    flavor: '海はいちど、全部やり直させる。',
  }),

  M('x_w7', '忘却のクラゲ', 'water', 3, 2, 4, 'jelly', {
    set: 2, tier: 2, text: '【ターン開始時】相手の山札を上から1枚 墓地へ送る。',
    onTurnStart: [{ op: 'mill', side: 'enemy', n: 1 }],
    flavor: '触れられた記憶から順に消えていく。',
  }),
  S('x_sw5', '潮の共鳴', 'water', 3, 'wave', {
    set: 2, tier: 2, text: '自分の水モンスター全てを+1/+2する。',
    effects: [{ op: 'buff', side: 'self', target: 'all', atk: 1, def: 2, duration: 'permanent', filter: { element: 'water' } }],
    flavor: '一滴ずつが、同じ流れになる。',
  }),
  S('x_sw3', '静寂の海溝', 'water', 2, 'eye', {
    set: 2, tier: 2, text: '相手の山札を上から4枚 墓地へ送る。',
    effects: [{ op: 'mill', side: 'enemy', n: 4 }],
    flavor: '深く沈んだものは、もう戻らない。',
  }),
  S('x_sw4', '渦の底', 'water', 4, 'wave', {
    set: 2, tier: 3, text: '相手の山札を上から8枚 墓地へ送る。',
    effects: [{ op: 'mill', side: 'enemy', n: 8 }],
    flavor: '底に着く頃には、何も残っていない。',
  }),

  // ---------- 草 8 ----------
  M('x_g1', '種まきの精', 'grass', 1, 1, 2, 'spirit', {
    set: 2, tier: 2, text: '【断末魔】カードを1枚引く。',
    onDeath: [{ op: 'draw', side: 'self', n: 1 }],
    flavor: '踏まれた場所から芽が出る。',
  }),
  M('x_g2', '若木の戦士', 'grass', 2, 3, 3, 'plant', {
    set: 2, tier: 2, text: '【登場時】攻撃力が最も高い自分のモンスター1体を+0/+2する。',
    onSummon: [{ op: 'buff', side: 'self', target: 'one', atk: 0, def: 2, duration: 'permanent' }],
    flavor: 'まだ細いが、折れない。',
  }),
  M('x_g3', 'ペタルダンサー', 'grass', 3, 5, 3, 'spirit', {
    set: 2, tier: 2, text: '【断末魔】自分のモンスター全てを+1/+1する。',
    onDeath: [{ op: 'buff', side: 'self', target: 'all', atk: 1, def: 1, duration: 'permanent' }],
    flavor: '散り際がいちばん美しい。',
  }),
  M('x_g4', '苔むす古兵', 'grass', 4, 5, 6, 'giant', {
    set: 2, tier: 2, keywords: ['guard'], text: '【守護】',
    flavor: '何度も死にかけて、まだ立っている。',
  }),
  M('x_g5', '棘竜ソーンドレイク', 'grass', 5, 8, 6, 'dragon', {
    set: 2, tier: 3, flavor: '森が牙を持ったらこうなる。',
  }),
  M('x_g6', '大地竜ガイオン', 'grass', 6, 8, 7, 'giant', {
    set: 2, tier: 3,
    text: '【登場時】自分の墓地からコスト4以下のモンスター1体を場に出す。',
    onSummon: [{ op: 'revive', maxCost: 4 }],
    flavor: '歩けば地形が変わり、踏まれた者も起き上がる。',
  }),
  S('x_sg1', '大樹の抱擁', 'grass', 3, 'ward', {
    set: 2, tier: 2, text: '自分の草モンスター1体を+2/+4する。',
    effects: [{ op: 'buff', side: 'self', target: 'one', atk: 2, def: 4, duration: 'permanent', filter: { element: 'grass' } }],
    flavor: '包まれると、少し強くなる。',
  }),
  S('x_sg5', '樹皮の砦', 'grass', 3, 'armor', {
    set: 2, tier: 2, text: '自分の草モンスター全てを+0/+3する。',
    effects: [{ op: 'buff', side: 'self', target: 'all', atk: 0, def: 3, duration: 'permanent', filter: { element: 'grass' } }],
    flavor: '木々が並ぶだけで、そこは砦になる。',
  }),
  S('x_sg6', '茨の報復', 'grass', 2, 'ward', {
    set: 2, tier: 2, text: '相手モンスター1体の攻撃力を-3する。',
    effects: [{ op: 'buff', side: 'enemy', target: 'one', atk: -3, def: 0, duration: 'permanent' }],
    flavor: '触れた手のほうが深く裂ける。',
  }),
  S('x_sg4', '森の共鳴', 'grass', 3, 'leaf', {
    set: 2, tier: 2, text: '自分の草モンスター全てを+2/+2する。',
    effects: [{ op: 'buff', side: 'self', target: 'all', atk: 2, def: 2, duration: 'permanent', filter: { element: 'grass' } }],
    flavor: '根がつながっている限り、一緒に育つ。',
  }),
  S('x_sg2', '甦りの森', 'grass', 4, 'sprout', {
    set: 2, tier: 3, text: '自分の墓地からコスト5以下の草モンスターを2体まで場に出す。',
    effects: [{ op: 'revive', maxCost: 5, element: 'grass' }, { op: 'revive', maxCost: 5, element: 'grass' }],
    flavor: '倒れた木の上に、次の森が育つ。',
  }),

  S('x_sg3', '大地の反撃', 'grass', 3, 'ward', {
    set: 2, tier: 2, text: 'このターン、自分の草モンスター1体は防御力を攻撃力として扱う。',
    effects: [{ op: 'defAsAtk', side: 'self', target: 'one', duration: 'turn', filter: { element: 'grass' } }],
    flavor: '守っていた腕が、そのまま拳になる。',
  }),

  // ---------- 汎用 2 ----------
  S('x_sn1', '英雄の紋章', 'none', 3, 'crystal', {
    set: 2, tier: 3, equip: true,
    text: '装備：自分のモンスター1体を+2/+2し、【守護】を与える。場に残る。',
    effects: [{ op: 'equip', atk: 2, def: 2, grants: ['guard'] }],
    flavor: '背負った者は、前に立つと決まっている。',
  }),
  S('x_sn2', '入れ替えの符', 'none', 2, 'scroll', {
    set: 2, tier: 2, text: '自分のモンスター1体を手札に戻す。',
    effects: [{ op: 'bounce', side: 'self', target: 'one' }],
    flavor: 'もう一度、登場からやり直す。',
  }),
];
