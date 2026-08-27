// ============================================================
// ルール定数。原案で曖昧／未定義だった箇所はフラグ化して
// sim/run.js で数値検証できるようにしてある。
// ============================================================

export const DEFAULT_RULES = {
  startLife: 20,          // 初期ライフ
  deckSize: 30,           // デッキ枚数
  maxCopies: 3,           // 同名カード上限
  startHand: 3,           // 初期手札
  handLimit: 6,           // 手札上限（ターン終了時に捨てる）
  fieldSlots: 3,          // モンスターゾーン
  supportSlots: 3,        // サポートゾーン
  equipPerMonster: 1,     // 1体のモンスターに装備できる枚数
  maxCostCap: 10,         // 最大コストの上限（原案に無かったので追加）
  summonsPerTurn: 99,     // 1ターンの召喚回数（原案は1。コストが余って手詰まりになるため撤廃）
  replaceSummon: true,    // 【入れ替え召喚】場が満杯でも、自分のモンスター1体を墓地へ送って召喚できる
  replaceSummonCost: 1,   // そのときの追加コスト
  forgeCost: 2,           // 【鍛錬】コストを払ってカードを1枚引く
  forgePerTurn: 1,        // 鍛錬の回数/ターン（盤面が埋まってもコストの使い道を残す）
  firstPlayerNoDraw: true,// 先攻1ターン目はドローなし
  mulligan: true,         // 初期手札の引き直し（1回）
  secondPlayerExtraCard: true, // 後攻は初期手札+1枚（先攻有利の緩和）
  secondPlayerBonusCost: 1,    // 後攻の最初のターンに追加コスト（先攻勝率 55%→50%）
  elementBonus: 2,        // 属性有利のとき攻撃側に加算
  elementBonusMode: 'atk',// 'atk'=攻撃力に加算（破壊判定にも影響） / 'damage'=超過ダメージのみ

  // --- 原案では未定義だった裁定 ---
  reflectOnAttackerLoss: true,  // 攻撃モード同士で攻撃側が負けたら、差分を攻撃側プレイヤーへ
  // 防御モードを破壊したとき、超過分をプレイヤーへ。
  //   true = そのまま / 'half' = 半分（切り上げ） / false = 通さない
  // 'half' は「防御にしておけば被害が減る」という手触りを出すための設定。
  // false まで下げると盤面が膠着して試合が伸びるので half で止めている。
  defenseExcessDamage: 'half',
  defenseKillsAttacker: false, // 防御力が攻撃力以上なら攻撃側モンスターを破壊（守りに牙を与える案）
  defenseReflect: false,        // 防御力が攻撃力を上回ったとき差分を攻撃側プレイヤーへ（原案どおり=false）
  modeChangeAfterAttack: false, // 攻撃済みモンスターのモード変更を許すか（=false で禁止）
  summonModeIsFree: true,       // 召喚時のモード選択はモード変更1回を消費しない
  maxTurns: 60,                 // 引き分け回避の安全弁
};

export const clone = o => structuredClone(o);
