// ============================================================
// 第4弾『鉄旗の陣』（34枚）
//   場の3枠の「位置」に意味を与える弾。
//   両隣がそろうのは中央だけなので、どこへ出すかが毎ターンの判断になる。
//
//   炎【突撃】 攻撃したとき、その隣にも攻撃力の半分
//   水【隊列】 隣1体につき攻撃力+1・防御力+2
//   草【旗】   隣のモンスターは攻撃力+1
//   無【傭兵】 隣のモンスターの属性としても扱う（双属・三属と同じ仕組み）
//
//   シリーズで初めて無属性のモンスターを入れる。
//   属性の有利不利を受けないぶん、数値は同コスト帯より一回り控えめ。
// ============================================================
import { M, S } from './cardbuild.js';

const F = (opt = {}) => ({ set: 4, ...opt });

export const SET4 = [
  // ---------------- 炎：突撃 ----------------
  M('b_f1', '先駆けの槍兵', 'fire', 1, 2, 1, 'humanoid', F({
    keywords: ['charge'], text: '【突撃】',
    flavor: 'まっすぐ駆ける。曲がり方は教わっていない。',
  })),
  M('b_f2', '焔旗の伝令', 'fire', 2, 2, 2, 'flagred', F({
    text: '【登場時】隣のモンスター1体を+2/+0する。',
    onSummon: [{ op: 'buffAdj', atk: 2, def: 0, n: 1 }],
    flavor: '旗が上がった。あとは走るだけだ。',
  })),
  M('b_f3', '紅蓮の騎兵', 'fire', 3, 4, 2, 'beast', F({
    keywords: ['charge'], text: '【突撃】',
    flavor: '蹄の跡が、そのまま道になる。',
  })),
  M('b_f4', '鉄靴の擲弾兵', 'fire', 4, 3, 4, 'humanoid', F({
    text: '【登場時】相手モンスター1体と、その隣のモンスターに2ダメージずつ。',
    onSummon: [{ op: 'splashDamage', side: 'enemy', v: 2, adjV: 2 }],
    flavor: '投げたら伏せろ。二度は言わん。',
  })),
  M('b_f5', '陣中の鍛冶 ドルグ', 'fire', 5, 4, 5, 'oni', F({
    text: '【ターン開始時】隣のモンスターを+1/+0する。',
    onTurnStart: [{ op: 'buffAdj', atk: 1, def: 0 }],
    flavor: '刃は毎晩よく研がれ、毎朝また欠けて戻る。',
  })),
  M('b_lf1', '紅蓮の総大将 ガルダイン', 'fire', 8, 9, 6, 'oni', F({
    maxCopies: 1,
    keywords: ['charge', 'double'],
    text: '【突撃】【連撃】【登場時】自分の他のモンスター全てに【突撃】を与える。',
    onSummon: [{ op: 'grantKw', kw: 'charge', side: 'self', target: 'others' }],
    flavor: '陣形は捨てろ。全部まとめて薙ぐ。',
  })),
  S('b_sf1', '突撃合図', 'fire', 1, 'banner', F({
    text: 'このターン、自分のモンスター1体に【突撃】を与える。',
    effects: [{ op: 'grantKw', kw: 'charge', side: 'self', target: 'one', duration: 'turn' }],
    flavor: '狼煙がまっすぐ立つ日は、風が味方だ。',
  })),
  S('b_sf2', '挟撃の一手', 'fire', 3, 'meteor', F({
    text: '相手モンスター1体に4ダメージ。その隣のモンスターにも2ダメージ。',
    effects: [{ op: 'splashDamage', side: 'enemy', v: 4, adjV: 2 }],
    flavor: '前から来ると思わせて、横から。',
  })),
  S('b_sf3', '焦土の進軍', 'fire', 5, 'banner', F({
    text: '自分のモンスター全てに【突撃】を与え、このターン+2/+0する。',
    effects: [
      { op: 'grantKw', kw: 'charge', side: 'self', target: 'all', duration: 'turn' },
      { op: 'buff', side: 'self', target: 'all', atk: 2, def: 0, duration: 'turn' },
    ],
    flavor: '通ったあとには、道しか残らない。',
  })),

  // ---------------- 水：隊列 ----------------
  M('b_w1', '氷盾の歩兵', 'water', 1, 1, 3, 'shield', F({
    keywords: ['rank'], text: '【隊列】',
    flavor: '盾は隣のためにある。',
  })),
  M('b_w2', '整列の水兵', 'water', 2, 3, 2, 'humanoid', F({
    keywords: ['rank'], text: '【隊列】',
    flavor: '号令の前に、もう足がそろっている。',
  })),
  M('b_w3', '霧衛の副官', 'water', 3, 2, 4, 'witch', F({
    keywords: ['rank', 'guard'], text: '【隊列】【守護】',
    flavor: '霧が晴れるころには、列はもう組み終わっている。',
  })),
  M('b_w4', '号令の潮騎士', 'water', 4, 3, 4, 'armor', F({
    text: '【登場時】自分のモンスター全てに【隊列】を与える。',
    onSummon: [{ op: 'grantKw', kw: 'rank', side: 'self', target: 'all' }],
    flavor: '潮が引くまで、誰も一歩も下がるな。',
  })),
  M('b_w5', '氷壁の軍師 セルカ', 'water', 5, 3, 7, 'witch', F({
    keywords: ['guard', 'rank', 'warden'],
    text: '【守護】【隊列】隣のモンスターも【守護】を持つ。',
    flavor: '崩れる場所を先に決めておく。それが陣というものです。',
  })),
  M('b_lw1', '不凍の総督 リヴィエル', 'water', 7, 4, 9, 'armor', F({
    maxCopies: 1,
    keywords: ['guard', 'rank'],
    text: '【守護】【隊列】【登場時】自分のモンスター全てに【隊列】を与え、カードを2枚引く。',
    onSummon: [
      { op: 'grantKw', kw: 'rank', side: 'self', target: 'all' },
      { op: 'draw', side: 'self', n: 2 },
    ],
    flavor: 'この海が凍ったという記録は、まだ一度もない。',
  })),
  S('b_sw1', '隊列を組め', 'water', 2, 'scroll', F({
    text: '自分のモンスター1体に【隊列】を与え、カードを1枚引く。',
    effects: [
      { op: 'grantKw', kw: 'rank', side: 'self', target: 'one' },
      { op: 'draw', side: 'self', n: 1 },
    ],
    flavor: '線を引く。あとはそこに立つだけ。',
  })),
  S('b_sw2', '氷の防壁', 'water', 3, 'ward', F({
    text: 'このターン、隣にモンスターがいる自分のモンスターは戦闘で破壊されない。',
    effects: [{ op: 'invulnAdj', side: 'self' }],
    flavor: '独りぼっちの壁は、ただの氷だ。',
  })),
  S('b_sw3', '陣崩し', 'water', 4, 'wave', F({
    text: '相手モンスター全ての防御力を-2する。相手の場が3体そろっているなら、さらに-2する。',
    effects: [{ op: 'buffCond', side: 'enemy', atk: 0, def: -2, bonusAtk: 0, bonusDef: -2, cond: 'full' }],
    flavor: '揃った列ほど、崩れ方はきれいだ。',
  })),

  // ---------------- 草：旗 ----------------
  M('b_g1', '苗床の旗手', 'grass', 1, 1, 2, 'sprout', F({
    keywords: ['banner'], text: '【旗】',
    flavor: 'まだ何も生えていない土地に、先に旗だけ立てた。',
  })),
  M('b_g2', '蔦の伝令', 'grass', 2, 3, 3, 'plant', F({
    text: '【登場時】隣のモンスターを+1/+1する。',
    onSummon: [{ op: 'buffAdj', atk: 1, def: 1 }],
    flavor: '言葉より先に、根が届く。',
  })),
  M('b_g3', '大樹の旗手', 'grass', 3, 3, 4, 'treant', F({
    keywords: ['banner', 'guard'], text: '【旗】【守護】',
    flavor: '旗は倒れない。倒れるときは根ごとだ。',
  })),
  M('b_g4', '根伝いの守り手', 'grass', 4, 4, 5, 'treant', F({
    keywords: ['rooted'],
    text: '隣にモンスターがいるあいだ、【守護】を持つ。',
    flavor: 'ひとりのときは、ただの木だ。',
  })),
  M('b_g5', '豊穣の旗頭 ミノリ', 'grass', 5, 5, 5, 'spirit', F({
    keywords: ['banner'],
    text: '【旗】【ターン開始時】隣のモンスターを+1/+1する。',
    onTurnStart: [{ op: 'buffAdj', atk: 1, def: 1 }],
    flavor: '旗の下は、いつも少しだけ実りが早い。',
  })),
  M('b_lg1', '千年樹の旗将 ユグドライン', 'grass', 8, 7, 9, 'giant', F({
    maxCopies: 1,
    keywords: ['banner', 'guard'],
    text: '【旗】【守護】【登場時】自分のモンスター全てに【旗】を与える。',
    onSummon: [{ op: 'grantKw', kw: 'banner', side: 'self', target: 'all' }],
    flavor: '千年ぶんの旗が、いま一斉に立った。',
  })),
  S('b_sg1', '陣を張る', 'grass', 2, 'banner', F({
    text: '自分のモンスター1体に【旗】を与える。',
    effects: [{ op: 'grantKw', kw: 'banner', side: 'self', target: 'one' }],
    flavor: '草が旗のほうへ傾きはじめる。',
  })),
  S('b_sg2', '根を絡める', 'grass', 3, 'leaf', F({
    text: '隣り合う自分のモンスター2体を+2/+2する。',
    effects: [{ op: 'buffPairAdj', atk: 2, def: 2 }],
    flavor: '離れないなら、いっそ繋いでしまえ。',
  })),
  S('b_sg3', '森の総攻め', 'grass', 5, 'treant', F({
    text: '自分のモンスター全てを+1/+1する。隣にモンスターがいるものは、さらに+1/+1する。',
    effects: [{ op: 'buffCond', side: 'self', atk: 1, def: 1, bonusAtk: 1, bonusDef: 1, cond: 'adjacent' }],
    flavor: '森が動くとき、木は一本ずつ動かない。',
  })),

  // ---------------- 無属性：傭兵 ----------------
  M('b_n1', '流浪の傭兵', 'none', 2, 3, 2, 'sword', F({
    keywords: ['mercenary'], text: '【傭兵】',
    flavor: '旗の色は気にしない。払いのいい方につく。',
  })),
  M('b_n2', '陣抜けの斧兵', 'none', 3, 3, 3, 'humanoid', F({
    keywords: ['pierce'], text: '【貫通】',
    flavor: '列の切れ目は、いつも同じところにできる。',
  })),
  M('b_n3', '一騎打ちのカイ', 'none', 4, 4, 3, 'sword', F({
    keywords: ['lone'],
    text: '【単騎】自分の場に他のモンスターがいないとき、+3/+2する。',
    flavor: '隣がいると、どうも調子が狂う。',
  })),
  M('b_n4', '無名の傭兵団長', 'none', 5, 5, 4, 'humanoid', F({
    keywords: ['mercenary'],
    text: '【傭兵】【登場時】自分の場のモンスター1体につき、+1/+0する。',
    onSummon: [{ op: 'buffPerAlly', atk: 1, def: 0 }],
    flavor: '名前を売らないのが、この団の売りだ。',
  })),
  M('b_ln1', '旗竿の巨兵 オベリス', 'none', 7, 6, 8, 'golem', F({
    maxCopies: 1,
    keywords: ['mercenary', 'guard', 'standard'],
    text: '【傭兵】【守護】自分のモンスター全ては、隣にいるモンスター1体につき+1/+1する。',
    flavor: '誰の旗も掲げる。掲げたからには、折らせない。',
  })),
  S('b_sn1', '傭兵契約', 'none', 2, 'scroll', F({
    text: '自分のモンスター1体に【傭兵】を与え、+1/+1する。',
    effects: [
      { op: 'grantKw', kw: 'mercenary', side: 'self', target: 'one' },
      { op: 'buff', side: 'self', target: 'one', atk: 1, def: 1 },
    ],
    flavor: '署名の下に、銀貨の音。',
  })),
  S('b_sn2', '決戦の陣', 'none', 4, 'banner', F({
    text: '自分のモンスターが3体そろっているなら、全てに【貫通】を与え、このターン+2/+0する。',
    effects: [
      { op: 'grantKw', kw: 'pierce', side: 'self', target: 'all', duration: 'turn', cond: 'full' },
      { op: 'buffCond', side: 'self', atk: 0, def: 0, bonusAtk: 2, bonusDef: 0, cond: 'full', duration: 'turn' },
    ],
    flavor: '三つの影が、丘の上で一列になる。',
  })),
];
