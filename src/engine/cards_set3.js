// ============================================================
// 第3弾『星辰の門』
//   星の力を宿した無機物・天体・門を中心にした34種。
// ============================================================
import { M, S } from './cardbuild.js';

// イラストは第1・2弾と同じく art_map.js（カードID → assets/art/<id>.png）から引く。
// 第2引数の名前は呼び出し側の見出しとして残してあるだけで、パスには使わない。
const O = (_name, opt = {}) => ({ set: 3, ...opt });

export const SET3 = [
  // ---------- 炎：恒星・彗星・炉 ----------
  // f01 ヒバナトカゲ(1コスト 3/1)と数値まで同じだったので、
  // 攻めのトカゲ／守れる星屑と役割を分ける。
  M('z_f1', '火の星屑', 'fire', 1, 2, 2, 'crystal', O('火の星屑', {
    flavor: '掌ほどの恒星が、静かに宙を漂う。',
  })),
  M('z_f2', '灯火の燭台', 'fire', 2, 2, 3, 'torch', O('灯火の燭台', {
    text: '【登場時】相手プレイヤーに1ダメージ。',
    onSummon: [{ op: 'damageFace', side: 'enemy', v: 1 }],
    flavor: '誰もいない回廊を、星の火だけが歩いている。',
  })),
  M('z_f3', 'コメットシャード', 'fire', 3, 5, 2, 'meteor', O('彗星の欠片', {
    keywords: ['pierce'], text: '【貫通】',
    flavor: '落ちたあとも、まだ空を目指して燃えている。',
  })),
  M('z_f4', 'ソーラーリング', 'fire', 4, 4, 5, 'orb', O('恒星の環', {
    keywords: ['accelerate'], text: '【加速】',
    onSummon: [{ op: 'increaseMaxCost', n: 1 }],
    flavor: '二重の軌道が、新しい力の巡りを生む。',
  })),
  M('z_f5', '紅蓮の観測儀', 'fire', 4, 3, 4, 'eye', O('紅蓮の観測儀', {
    keywords: ['observe'], text: '【観測】',
    onSummon: [{ op: 'observe', n: 3 }],
    flavor: 'そのレンズは、まだ生まれていない炎を見る。',
  })),
  M('z_f6', '炉心の巨像', 'fire', 6, 9, 6, 'golem', O('炉心の巨像', {
    keywords: ['pierce'],
    text: '【貫通】【登場時】防御力5以下の相手モンスター1体を破壊する。',
    onSummon: [{ op: 'destroy', side: 'enemy', target: 'one', filter: { maxDef: 5 } }],
    flavor: '胸の炉が開くと、石さえ灰になる。',
  })),

  // ---------- 水：月・氷晶・鏡 ----------
  // w01 シズククラゲ(1コスト 1/3)と数値まで同じだったので、
  // 壁のクラゲ／小突ける結晶と役割を分ける。
  M('z_w1', '雫の結晶', 'water', 1, 2, 2, 'crystal', O('雫の結晶', {
    flavor: '透明な殻の内側で、小さな海が巡っている。',
  })),
  M('z_w2', '月光の灯', 'water', 2, 2, 2, 'orb', O('月光の灯', {
    text: '【登場時】自分のライフを3回復。',
    onSummon: [{ op: 'heal', side: 'self', v: 3 }],
    flavor: '月の無い夜にも、潮はこれを見て満ちる。',
  })),
  M('z_w3', '氷晶の門柱', 'water', 3, 2, 5, 'golem', O('氷晶の門柱', {
    keywords: ['guard'], text: '【守護】',
    flavor: '片割れを失っても、門を守る役目は終わらない。',
  })),
  M('z_w4', 'タイドグラス', 'water', 4, 3, 4, 'orb', O('潮汐の砂時計', {
    keywords: ['observe'], text: '【観測】',
    onSummon: [{ op: 'observe', n: 3 }],
    flavor: '落ちる海の中を、未来の魚影が泳ぐ。',
  })),
  M('z_w5', 'ムーンミラージュ', 'water', 5, 5, 6, 'eye', O('蒼月の鏡像', {
    text: '【登場時】相手モンスター1体を持ち主の山札の一番上に戻す。',
    onSummon: [{ op: 'topdeck', side: 'enemy', target: 'one' }],
    flavor: '鏡に触れた者は、出会う前の場所へ戻される。',
  })),
  M('z_w6', '深淵の天球儀', 'water', 6, 4, 8, 'orb', O('深淵の天球儀', {
    keywords: ['guard', 'accelerate'], text: '【守護】【加速】',
    onSummon: [{ op: 'increaseMaxCost', n: 1 }],
    flavor: '深海も星空も、ひとつの球の中では同じ闇だ。',
  })),

  // ---------- 草：星種・結晶樹・環 ----------
  M('z_g1', '星種', 'grass', 1, 3, 2, 'crystal', O('星種', {
    flavor: '殻に刻まれた星図どおりに、根を伸ばす。',
  })),
  M('z_g2', '芽吹きの環', 'grass', 2, 3, 3, 'ward', O('芽吹きの環', {
    text: '【登場時】攻撃力が最も高い自分のモンスター1体を+2/+0する。',
    onSummon: [{ op: 'buff', side: 'self', target: 'one', atk: 2, def: 0, duration: 'permanent' }],
    flavor: '円は閉じ、命はその内側で芽吹く。',
  })),
  M('z_g3', 'クリスタルツイッグ', 'grass', 3, 4, 3, 'treant', O('結晶樹の若枝', {
    keywords: ['accelerate'], text: '【加速】',
    onSummon: [{ op: 'increaseMaxCost', n: 1 }],
    flavor: '一枚の葉が、森ひとつ分の光を集める。',
  })),
  M('z_g4', '大地の羅針盤', 'grass', 4, 4, 5, 'orb', O('大地の羅針盤', {
    keywords: ['observe'], text: '【観測】',
    onSummon: [{ op: 'observe', n: 3 }],
    flavor: '針が示すのは北ではなく、次に芽吹く場所。',
  })),
  M('z_g5', '群生する尖塔', 'grass', 5, 6, 8, 'crystal', O('群生する尖塔', {
    flavor: '星の雨が落ちた跡に、緑の城壁が生まれた。',
  })),
  M('z_g6', '星環の門', 'grass', 6, 5, 9, 'ward', O('世界環の門', {
    keywords: ['guard'],
    text: '【守護】【登場時】自分のモンスター全てを+2/+2する。',
    onSummon: [{ op: 'buff', side: 'self', target: 'all', atk: 2, def: 2, duration: 'permanent' }],
    flavor: '門が開くたび、世界はひとまわり大きくなる。',
  })),

  // ---------- サポート ----------
  S('z_sf1', '点火', 'fire', 1, 'bolt', O('点火', {
    text: 'このターン、自分のモンスター1体を+3/+0する。',
    effects: [{ op: 'buff', side: 'self', target: 'one', atk: 3, def: 0, duration: 'turn' }],
    flavor: '最初の火花だけは、小さくていい。',
  })),
  S('z_sf2', '流星群', 'fire', 4, 'meteor', O('流星群', {
    text: '防御力4以下の相手モンスターを全て破壊する。',
    effects: [{ op: 'destroyAllFiltered', side: 'enemy', filter: { maxDef: 4 } }],
    flavor: '願いを唱えるより先に、空が落ちてきた。',
  })),
  S('z_sf3', '超新星', 'fire', 6, 'meteor', O('超新星', {
    text: '相手モンスターを全て破壊し、破壊した数だけ相手プレイヤーにダメージ。',
    effects: [{ op: 'destroyAllDamage', side: 'enemy', multiplier: 1 }],
    flavor: '白い光の中では、悲鳴さえ影になる。',
  })),

  S('z_sw1', '星図の解読', 'water', 2, 'scroll', O('星図の解読', {
    text: '山札の上から3枚を見て1枚を手札に加え、残りを山札の底へ戻す。',
    effects: [{ op: 'observe', n: 3 }],
    flavor: '星は答えではなく、選択肢を示す。',
  })),
  S('z_sw2', '静止の月', 'water', 2, 'orb', O('静止の月', {
    text: '相手モンスター1体を防御モードにし、次の相手ターン攻撃できない。',
    effects: [
      { op: 'setMode', side: 'enemy', mode: 'defense', target: 'one' },
      { op: 'stun', side: 'enemy', target: 'one' },
    ],
    flavor: '月が止まり、波も刃も動きを忘れる。',
  })),
  S('z_sw3', '万象の鏡', 'water', 5, 'eye', O('万象の鏡', {
    text: '相手モンスターを全て持ち主の手札に戻し、カードを1枚引く。',
    effects: [{ op: 'bounce', side: 'enemy', target: 'all' }, { op: 'draw', side: 'self', n: 1 }],
    flavor: '砕けた鏡の一片ごとに、違う結末が映る。',
  })),

  S('z_sg1', '星土の恵み', 'grass', 2, 'sprout', O('星土の恵み', {
    text: '自分のモンスター1体を+2/+2する。',
    effects: [{ op: 'buff', side: 'self', target: 'one', atk: 2, def: 2, duration: 'permanent' }],
    flavor: '星屑を混ぜた土は、夜のうちにも育つ。',
  })),
  S('z_sg2', '輪廻の環', 'grass', 3, 'ward', O('輪廻の環', {
    text: '自分の墓地からモンスター1体を手札に戻し、カードを1枚引く。',
    effects: [{ op: 'recallMonster' }, { op: 'draw', side: 'self', n: 1 }],
    flavor: '終わりを一周すれば、また始まりに触れられる。',
  })),
  S('z_sg3', '星環の芽', 'grass', 5, 'sprout', O('世界環の芽', {
    text: '自分の最大コストを2増やし、カードを2枚引く。',
    effects: [{ op: 'increaseMaxCost', n: 2 }, { op: 'draw', side: 'self', n: 2 }],
    flavor: '大地のひび割れから、次の世界が芽を出した。',
  })),

  S('z_sn1', '門の鍵', 'none', 1, 'crystal', O('門の鍵', {
    text: '自分の最大コストを1増やす。',
    effects: [{ op: 'increaseMaxCost', n: 1 }],
    flavor: '鍵穴は無い。それでも門は、この形を覚えている。',
  })),
  S('z_sn2', '星屑の護符', 'none', 3, 'armor', O('星屑の護符', {
    equip: true, text: '装備：自分のモンスター1体を+2/+2する。場に残る。',
    effects: [{ op: 'equip', atk: 2, def: 2 }],
    flavor: '砕けた星をひと粒、胸元に。',
  })),
  S('z_sn3', '天秤の裁定', 'none', 3, 'orb', O('天秤の裁定', {
    text: 'お互いのプレイヤーは手札が4枚になるように引く／捨てる。',
    effects: [{ op: 'balanceHand', n: 4 }],
    flavor: '光も闇も、四枚ぶんだけ等しく量る。',
  })),

  // ---------- レジェンド：同名1枚まで ----------
  M('z_lf1', '恒星炉 イグニシス', 'fire', 8, 10, 7, 'golem', O('恒星炉 イグニシス', {
    maxCopies: 1, keywords: ['pierce'],
    text: '【貫通】【登場時】相手モンスターを全て破壊し、破壊した数×2ダメージ。',
    onSummon: [{ op: 'destroyAllDamage', side: 'enemy', multiplier: 2 }],
    flavor: '王ではない。太陽を炉として歩かせる装置だ。',
  })),
  M('z_lw1', '蒼月の鏡 セレスティア', 'water', 7, 5, 9, 'eye', O('蒼月の鏡 セレスティア', {
    maxCopies: 1, keywords: ['guard'],
    text: '【守護】【登場時】3枚引き、ライフを5回復。【ターン開始時】相手の山札を2枚墓地へ送る。',
    onSummon: [{ op: 'draw', side: 'self', n: 3 }, { op: 'heal', side: 'self', v: 5 }],
    onTurnStart: [{ op: 'mill', side: 'enemy', n: 2 }],
    flavor: '鏡の向こうには、沈まない月が無数にある。',
  })),
  M('z_lg1', '星環 イルミナリス', 'grass', 8, 8, 8, 'ward', O('世界環 イルミナリス', {
    maxCopies: 1,
    text: '【登場時】自分の墓地からコスト6以下のモンスターを2体まで場に出す。',
    onSummon: [{ op: 'reviveMany', maxCost: 6, count: 2 }],
    flavor: '環の内側では、滅びた森さえ季節を取り戻す。',
  })),
  S('z_ln1', '星辰の門', 'none', 6, 'ward', O('星辰の門', {
    maxCopies: 1,
    text: '自分の墓地のカードを全て山札に戻してシャッフルし、カードを2枚引く。',
    effects: [{ op: 'shuffleGrave' }, { op: 'draw', side: 'self', n: 2 }],
    flavor: '終わりの先にあるのは、もう一度めくるための入口。',
  })),
];
