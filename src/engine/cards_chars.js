// ============================================================
// キャラクターカード（第4弾あつかい・隠しカード24種）
//   冒険で戦う敵24人をそのままカードにしたもの。
//   ・全てレジェンド、デッキには1枚まで（無銘の剣士だけ例外）
//   ・パックからは出ない。フリーバトルの「極」で本人を規定回数倒すと入手
//   ・入手するまで図鑑には載らない（hidden）
//
//   属性の割り当ては、そのキャラが冒険で使ってくるデッキと
//   「有効な属性」のヒントに合わせてある。
//   見た目に色味の無いキャラは無属性にして、そのぶん効果を尖らせた。
// ============================================================
import { M } from './cardbuild.js';

const C = (opt = {}) => ({ set: 4, hidden: true, maxCopies: 1, tier: 3, ...opt });

export const CHARACTERS = [
  // ---------- はじまりの草原 ----------
  M('c_toto', '見習いのトト', 'grass', 2, 2, 2, 'humanoid', C({
    text: '【登場時】カードを1枚引く。【断末魔】カードを1枚引く。',
    onSummon: [{ op: 'draw', side: 'self', n: 1 }],
    onDeath: [{ op: 'draw', side: 'self', n: 1 }],
    flavor: '失敗するたび、手帳のページが増えていく。',
  })),
  M('c_garo', '罠師のガロ', 'grass', 3, 2, 4, 'humanoid', C({
    keywords: ['guard'],
    text: '【守護】【登場時】相手のモンスター1体を防御モードにする。',
    onSummon: [{ op: 'setMode', side: 'enemy', mode: 'defense', target: 'one', free: true }],
    flavor: '足元は、いつだって見られていない。',
  })),
  M('c_morley', '草原の主 モーリー', 'grass', 5, 3, 7, 'beast', C({
    keywords: ['pierce'],
    text: '【貫通】このカードは、攻撃力ではなく防御力の値で攻撃する。',
    onSummon: [{ op: 'defAsAtk', side: 'self', target: 'self' }],
    onTurnStart: [{ op: 'defAsAtk', side: 'self', target: 'self' }],
    flavor: 'その巨体は、走り出すと止まらない。',
  })),

  // ---------- 燃える丘 ----------
  M('c_pirika', '火の子ピリカ', 'fire', 2, 3, 1, 'humanoid', C({
    keywords: ['double'],
    text: '【連撃】【断末魔】相手プレイヤーに2ダメージ。',
    onDeath: [{ op: 'damageFace', side: 'enemy', v: 2 }],
    flavor: '消える瞬間がいちばん熱い。',
  })),
  M('c_gou', '溶岩守りゴウ', 'fire', 5, 5, 6, 'golem', C({
    keywords: ['guard', 'pierce'],
    text: '【守護】【貫通】',
    flavor: '守るために、まず壁を割って出る。',
  })),
  M('c_varga', '炎皇バルガ', 'fire', 7, 7, 5, 'demon', C({
    keywords: ['pierce'],
    text: '【貫通】【登場時】相手のモンスター全てを攻撃モードにし、自分の炎モンスター全てを+2/+0する。',
    onSummon: [
      { op: 'setMode', side: 'enemy', mode: 'attack', target: 'all', free: true },
      { op: 'buff', side: 'self', target: 'all', atk: 2, def: 0, duration: 'permanent', filter: { element: 'fire' } },
    ],
    flavor: '隠れる者に用は無い。全員、前へ出ろ。',
  })),

  // ---------- 凍る入り江 ----------
  M('c_mina', '潮見のミナ', 'water', 3, 2, 4, 'humanoid', C({
    text: '【登場時】カードを2枚引く。【ターン開始時】自分のライフを1回復。',
    onSummon: [{ op: 'draw', side: 'self', n: 2 }],
    onTurnStart: [{ op: 'heal', side: 'self', v: 1 }],
    flavor: '潮の高さで、明日の天気まで当ててみせる。',
  })),
  M('c_val', '氷壁のヴァル', 'water', 5, 3, 8, 'golem', C({
    keywords: ['guard'],
    text: '【守護】【登場時】相手のモンスター1体を停止させる。',
    onSummon: [{ op: 'stun', side: 'enemy', target: 'one' }],
    flavor: '凍った時間の中では、誰も一歩も進めない。',
  })),
  M('c_nept', '海皇ネプト', 'water', 7, 6, 7, 'humanoid', C({
    text: '【登場時】相手のモンスターを全て手札に戻す。',
    onSummon: [{ op: 'bounce', side: 'enemy', target: 'all' }],
    flavor: '押し流されたものは、また岸に並べ直せばいい。',
  })),

  // ---------- 古代の森 ----------
  M('c_rim', '蔦使いリム', 'grass', 4, 3, 5, 'humanoid', C({
    text: '【登場時】自分のモンスター全てを+1/+1する。【ターン開始時】攻撃力が最も高い自分のモンスター1体を+1/+1する。',
    onSummon: [{ op: 'buff', side: 'self', target: 'all', atk: 1, def: 1, duration: 'permanent' }],
    onTurnStart: [{ op: 'buff', side: 'self', target: 'one', atk: 1, def: 1, duration: 'permanent' }],
    flavor: '結び目はほどけない。育つだけだ。',
  })),
  M('c_yona', '森の狩人ヨナ', 'fire', 5, 5, 3, 'humanoid', C({
    text: '【登場時】攻撃力が最も高い相手モンスター1体を破壊する。',
    onSummon: [{ op: 'destroy', side: 'enemy', target: 'one' }],
    flavor: '大物から狙う。それが森の作法。',
  })),
  M('c_verda', '世界樹の守護者 ヴェルダ', 'grass', 6, 5, 9, 'treant', C({
    keywords: ['guard'],
    text: '【守護】【断末魔】自分の墓地からコスト5以下のモンスターを2体まで場に出す。',
    onDeath: [{ op: 'reviveMany', maxCost: 5, count: 2 }],
    flavor: '倒れた幹から、次の森がはじまる。',
  })),

  // ---------- 三属の頂 ----------
  M('c_twins', '双子の術士 フレア & ミスト', 'fire', 5, 4, 4, 'humanoid', C({
    elements: ['fire', 'water'],
    text: '【双属】【登場時】カードを2枚引き、相手プレイヤーに2ダメージ。',
    onSummon: [{ op: 'draw', side: 'self', n: 2 }, { op: 'damageFace', side: 'enemy', v: 2 }],
    flavor: '片方が唱え、片方が返す。詠唱はいつも二重になる。',
  })),
  // 3枚積めるぶん影響が大きい。4コスト6/2だと勝率が15ポイント跳ね上がったので5コストに。
  M('c_nameless', '無銘の剣士', 'none', 5, 6, 2, 'humanoid', C({
    maxCopies: 3,
    keywords: ['double'],
    text: '【連撃】名を持たないため、このカードだけはデッキに3枚まで入れられる。',
    flavor: '名乗る相手も、名乗る理由も、とうに無くした。',
  })),
  M('c_triades', '三属の王 トリアデス', 'fire', 7, 6, 6, 'humanoid', C({
    elements: ['fire', 'water', 'grass'],
    text: '【三属】【登場時】相手のモンスター1体を破壊し、カードを1枚引き、自分のライフを3回復。',
    onSummon: [
      { op: 'destroy', side: 'enemy', target: 'one' },
      { op: 'draw', side: 'self', n: 1 },
      { op: 'heal', side: 'self', v: 3 },
    ],
    flavor: '三つの力を束ねる者は、三つの弱さも同時に背負う。',
  })),

  // ---------- 黄昏の回廊 ----------
  M('c_riina', '観測者リィナ', 'water', 4, 3, 5, 'humanoid', C({
    keywords: ['observe'],
    text: '【観測】【登場時】相手の手札を1枚捨てさせる。',
    onSummon: [{ op: 'observe', n: 3 }, { op: 'discardHand', side: 'enemy', n: 1 }],
    flavor: '観測した未来は、観測した時点でもう変わっている。',
  })),
  M('c_cardan', '歯車の巡礼者 カルダン', 'none', 5, 4, 5, 'golem', C({
    keywords: ['accelerate'],
    text: '【加速】【登場時】自分の墓地からサポートを1枚手札に戻す。【断末魔】自分の最大コストを1増やす。',
    onSummon: [{ op: 'increaseMaxCost', n: 1 }, { op: 'recallSupport' }],
    onDeath: [{ op: 'increaseMaxCost', n: 1 }],
    flavor: '止まった歯車も、次の歯車を回してから止まる。',
  })),
  M('c_ordo', '黄昏の門番 オルド', 'grass', 6, 4, 9, 'ward', C({
    keywords: ['guard'],
    text: '【守護】【登場時】相手のモンスターを全て防御モードにする。',
    onSummon: [{ op: 'setMode', side: 'enemy', mode: 'defense', target: 'all', free: true }],
    flavor: '門が閉じている間、誰ひとり前へは出られない。',
  })),

  // ---------- 星辰の門 ----------
  M('c_yue', '星読みのユエ', 'water', 5, 3, 6, 'humanoid', C({
    text: '【登場時】山札の上から5枚を見て1枚を手札に加え、さらにカードを1枚引く。',
    onSummon: [{ op: 'observe', n: 5 }, { op: 'draw', side: 'self', n: 1 }],
    flavor: '空に散らばった文字を、順番どおりに読み上げるだけ。',
  })),
  M('c_kairos', '彗星騎士 カイロス', 'fire', 5, 7, 2, 'humanoid', C({
    keywords: ['pierce', 'double'],
    text: '【貫通】【連撃】【断末魔】相手プレイヤーに3ダメージ。',
    onDeath: [{ op: 'damageFace', side: 'enemy', v: 3 }],
    flavor: '墜ちることまで含めて、ひとつの軌道だ。',
  })),
  M('c_astel', '門の守り手 アステル', 'none', 6, 5, 6, 'ward', C({
    keywords: ['guard'],
    text: '【守護】【登場時】自分の墓地のカードを全て山札に戻してシャッフルし、カードを2枚引く。',
    onSummon: [{ op: 'shuffleGrave' }, { op: 'draw', side: 'self', n: 2 }],
    flavor: '守るとは、閉ざすことではなく、もう一度開けること。',
  })),

  // ---------- 王たちの座 ----------
  M('c_nox', '無貌の使者 ノクス', 'none', 6, 3, 3, 'humanoid', C({
    text: '【登場時】攻撃力が最も高い相手モンスター1体の攻撃力・防御力を写し取り、+1/+1する。',
    onSummon: [{ op: 'copyStats', atk: 1, def: 1, baseAtk: 3, baseDef: 3 }],
    flavor: '向かい合った相手の顔を、そのまま被って返す。',
  })),
  M('c_dione', '双極の女王 ディオーネ', 'fire', 7, 6, 6, 'humanoid', C({
    elements: ['fire', 'water'],
    text: '【双属】【登場時】相手のモンスターを全て攻撃モードにし、その後、防御力3以下の相手モンスターを全て破壊する。',
    onSummon: [
      { op: 'setMode', side: 'enemy', mode: 'attack', target: 'all', free: true },
      { op: 'destroyAllFiltered', side: 'enemy', filter: { maxDef: 3 } },
    ],
    flavor: '両の手で、灼くことと凍らせることを同時にやってのける。',
  })),
  M('c_astralis', '星辰王 アストラリス', 'none', 8, 7, 7, 'humanoid', C({
    text: '【登場時】相手のモンスターを全て停止させる。【ターン開始時】相手プレイヤーに1ダメージ。',
    onSummon: [{ op: 'stun', side: 'enemy', target: 'all' }],
    onTurnStart: [{ op: 'damageFace', side: 'enemy', v: 1 }],
    flavor: '王が座に着くと、星も人も、しばらく動けない。',
  })),
];

/** 敵キー（エリアID:番号）→ そのキャラのカードID */
export const CHARACTER_OF = {
  'a1:0': 'c_toto', 'a1:1': 'c_garo', 'a1:2': 'c_morley',
  'a2:0': 'c_pirika', 'a2:1': 'c_gou', 'a2:2': 'c_varga',
  'a3:0': 'c_mina', 'a3:1': 'c_val', 'a3:2': 'c_nept',
  'a4:0': 'c_rim', 'a4:1': 'c_yona', 'a4:2': 'c_verda',
  'a5:0': 'c_twins', 'a5:1': 'c_nameless', 'a5:2': 'c_triades',
  'a6:0': 'c_riina', 'a6:1': 'c_cardan', 'a6:2': 'c_ordo',
  'a7:0': 'c_yue', 'a7:1': 'c_kairos', 'a7:2': 'c_astel',
  'a8:0': 'c_nox', 'a8:1': 'c_dione', 'a8:2': 'c_astralis',
};

/** 「極」で本人を何回倒すと、そのキャラのカードが手に入るか */
export const CHARACTER_WINS_NEEDED = 5;
