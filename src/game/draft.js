// ============================================================
// 選定の儀（2ピック・ドラフト）— 画面に依存しない部分
//
//   1. 属性の組み合わせを1つ選ぶ（炎×水／水×草／草×炎）。無属性はどれでも出る
//   2. 「2枚1組」のセットが2つ出るので片方を取る、を DRAFT_ROUNDS 回 → 30枚
//   3. 同じやり方でデッキを組んだライバルと DRAFT_BATTLES 戦
//   4. 勝った数で報酬（DRAFT_REWARD）
//
// 出てくるカードは「今のデッキで足りないコスト帯・種類」を出やすくする。
// 30枚・コスト制なので、完全ランダムだと重いカードばかり・サポートばかりの
// 事故が起きる（2ピックが面白いのは、選ぶ理由がある二択のとき）。
//
// キャラカード（隠し）は出さない。極で5勝して手に入る特別なごほうびなので。
// 持っていないカードは使える（2ピックはその場で組むモード）。
// sim/draft.js から同じ関数で数値を測れるよう、乱数は引数で渡す。
// ============================================================
import { ALL_CARDS, card } from '../engine/cards.js';

export const DRAFT_ROUNDS = 15;
export const DRAFT_BATTLES = 5;
export const DRAFT_PAIRS = [['fire', 'water'], ['water', 'grass'], ['grass', 'fire']];
/** 勝ち数 → 星屑。全勝でプリズムパックも */
export const DRAFT_REWARD = [0, 1, 3, 5, 7, 10];
export const DRAFT_PRISM_AT = 5;
/** 何戦目の相手ほど本気か（AI の noise。0＝本気） */
export const DRAFT_NOISE = [5, 3, 2, 1, 0];

// レア度の出やすさ（1枚ごと）
const RARITY_W = { common: 34, uncommon: 32, rare: 22, epic: 7, legend: 5 };
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legend'];
// 相手の属性の組。三すくみの当たり方で、水×草 と 草×炎 の対戦だけが大きく偏る
// （sim/draft.js：AI が適当に選んでも 水×草 の勝率は24〜30%。ほかの組み合わせは45〜55%）。
// レアを出やすくして釣り合わせる案は効かなかった（30%のまま）ので、この2つは当てない。
// これで、どの組を選んでもランダムな相手への期待勝率が 47〜53% に収まる。
export const OPPONENT_PAIRS = {
  'fire,water': [['fire', 'water'], ['water', 'grass'], ['grass', 'fire']],
  'water,grass': [['water', 'grass'], ['fire', 'water']],
  'grass,fire': [['grass', 'fire'], ['fire', 'water']],
};
// 30枚のコスト配分の目安（7 は 7以上）と、モンスター／サポートの目安
const CURVE_TARGET = { 1: 4, 2: 7, 3: 6, 4: 4, 5: 4, 6: 3, 7: 2 };
// v1（〜2026-09-13）：目安 20:10、候補は全部同じ引き方 → 実測 17.4:12.6 でサポートが多すぎた
// v2：目安 21:9、2枚1組のうち1枚は必ずモンスター（博史さんの指摘「モンスター多めのほうがいい」）
// 今日の選定の儀は日付で版を切り替える（同じ日の途中で候補が変わると不公平なので。daily.js の draftVer）
export const DRAFT_VER = 2;
const TYPE_TARGETS = { 1: { monster: 20, support: 10 }, 2: { monster: 21, support: 9 } };

const costKey = c => Math.min(c.cost, 7);

export function draftPool(pair) {
  return ALL_CARDS.filter(c => !c.hidden && (c.element === 'none' || pair.includes(c.element)));
}

/** AI がピックするときのカードの価値（ざっくり）。ATK1 ≒ DEF2（シミュレーターの実測） */
export function cardScore(c) {
  const rar = { common: 0, uncommon: 0.35, rare: 0.7, epic: 1.0, legend: 1.4 }[c.rarity] || 0;
  let s = (c.tier || 1) * 1.1 + rar;
  if (c.type === 'monster') s += ((2 * (c.atk || 0) + (c.def || 0)) - (3 * c.cost + 2)) * 0.12;
  else s += 0.4;
  return s;
}

/** このカードが、今のデッキにどれだけ「欲しい」か（1前後の倍率） */
function needFactor(picks, c, v = DRAFT_VER) {
  const TYPE_TARGET = TYPE_TARGETS[v] || TYPE_TARGETS[DRAFT_VER];
  const have = { cost: {}, type: { monster: 0, support: 0 } };
  for (const id of picks) {
    const x = card(id);
    have.cost[costKey(x)] = (have.cost[costKey(x)] || 0) + 1;
    have.type[x.type] = (have.type[x.type] || 0) + 1;
  }
  const k = costKey(c);
  const cNeed = (CURVE_TARGET[k] - (have.cost[k] || 0)) / CURVE_TARGET[k];
  const tNeed = (TYPE_TARGET[c.type] - (have.type[c.type] || 0)) / TYPE_TARGET[c.type];
  // 足りていれば上がり、埋まっていれば下がる（0 にはしない：あえて偏らせる選択も残す）
  return Math.max(0.15, 0.55 + 0.6 * cNeed) * Math.max(0.2, 0.6 + 0.5 * tNeed);
}

function pickWeighted(items, weightOf, rand) {
  const ws = items.map(weightOf);
  const total = ws.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return items[Math.floor(rand() * items.length)];
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

/** 1枚引く。taken＝このデッキ（＋今出している候補）に既にある枚数 */
function drawOne(pool, picks, taken, rand, v = DRAFT_VER) {
  const rarity = pickWeighted(Object.keys(RARITY_W), k => RARITY_W[k], rand);
  const want = RARITY_ORDER.indexOf(rarity);
  const ok = c => (taken[c.id] || 0) < (c.maxCopies || 3);
  let cand = [];
  // そのレア度が属性の組に無いときは、近いレア度へ寄せる
  for (let d = 0; d < RARITY_ORDER.length && !cand.length; d++) {
    for (const k of [want - d, want + d]) {
      if (k < 0 || k >= RARITY_ORDER.length) continue;
      cand = pool.filter(c => c.rarity === RARITY_ORDER[k] && ok(c));
      if (cand.length) break;
    }
  }
  if (!cand.length) cand = pool.filter(ok);
  const c = pickWeighted(cand, x => needFactor(picks, x, v), rand);
  taken[c.id] = (taken[c.id] || 0) + 1;
  return c.id;
}

/** 次のピックの候補：[[id, id], [id, id]] */
export function makeOptions(pair, picks, rand = Math.random, v = DRAFT_VER) {
  const pool = draftPool(pair);
  const mons = pool.filter(c => c.type === 'monster');
  const taken = {};
  for (const id of picks) taken[id] = (taken[id] || 0) + 1;
  // v2 は1枚目を必ずモンスターから引く（2枚ともサポートのセットを出さない）
  const set = () => [drawOne(v >= 2 ? mons : pool, picks, taken, rand, v), drawOne(pool, picks, taken, rand, v)];
  const opts = [set(), set()];
  // 2つのセットがまったく同じ中身なら、片方を引き直す（選ぶ意味がないので）
  const same = (a, b) => [...a].sort().join() === [...b].sort().join();
  for (let t = 0; t < 4 && same(opts[0], opts[1]); t++) {
    opts[1].forEach(id => { taken[id]--; });
    opts[1] = set();
  }
  return opts;
}

/** AI のピック：セットの価値＋今のデッキに合うか。少しだけ揺らす */
export function aiChoose(options, picks, rand = Math.random, v = DRAFT_VER) {
  const val = set => set.reduce((s, id) => { const c = card(id); return s + cardScore(c) * needFactor(picks, c, v); }, 0);
  const a = val(options[0]) + (rand() - 0.5) * 0.6;
  const b = val(options[1]) + (rand() - 0.5) * 0.6;
  return a >= b ? 0 : 1;
}

/** AI が1本ドラフトする（ライバルのデッキ・シミュレーター用） */
export function aiDraft(pair, rand = Math.random, v = DRAFT_VER) {
  const picks = [];
  for (let r = 0; r < DRAFT_ROUNDS; r++) {
    const opts = makeOptions(pair, picks, rand, v);
    picks.push(...opts[aiChoose(opts, picks, rand, v)]);
  }
  return picks;
}

/** 何戦目の相手か → ライバル（冒険の顔ぶれから、戦うほど後半のエリアの人に） */
export function draftOpponent(battleNo, areas, rand = Math.random, myPair = DRAFT_PAIRS[0], v = DRAFT_VER) {
  const bands = [[0, 1], [2, 3], [4, 5], [6, 6], [7, 7]];
  const [lo, hi] = bands[Math.min(battleNo, bands.length - 1)];
  const ai = Math.min(areas.length - 1, lo + Math.floor(rand() * (hi - lo + 1)));
  const ei = Math.floor(rand() * areas[ai].enemies.length);
  const allowed = OPPONENT_PAIRS[myPair.join(',')] || DRAFT_PAIRS;
  const pair = allowed[Math.floor(rand() * allowed.length)];
  return {
    area: ai, index: ei, key: `${areas[ai].id}:${ei}`, pair,
    deck: aiDraft(pair, rand, v), noise: DRAFT_NOISE[Math.min(battleNo, DRAFT_NOISE.length - 1)],
  };
}

// ---- 限定カード（engine/cards_rite.js）----
// 選定官は「その組で勝った数の合計」、大祭司は「選定官3人をそろえて、全部の組で勝った数の合計」で手に入る。
// 全勝を条件にしない：5戦全勝は数%しか出ないので、ほとんどの人が届かずにやめてしまう。
export const RITE_PAIR_CARD = { 'fire,water': 'r_shiena', 'water,grass': 'r_mirte', 'grass,fire': 'r_kagura' };
export const RITE_PAIR_WINS = 5;
export const RITE_FINAL_CARD = 'r_elsion';
export const RITE_FINAL_WINS = 20;

/** 限定カードそれぞれの進み具合：[{ id, pair, have, need, owned }]（pair が null なのは大祭司） */
export function riteProgress(stats, collection) {
  const pw = (stats && stats.pw) || {};
  const total = (stats && stats.wins) || 0;
  const rows = DRAFT_PAIRS.map(p => {
    const key = p.join(',');
    const id = RITE_PAIR_CARD[key];
    return { id, pair: p, have: Math.min(pw[key] || 0, RITE_PAIR_WINS), need: RITE_PAIR_WINS, owned: !!collection[id] };
  });
  const allThree = rows.every(r => r.owned);
  rows.push({ id: RITE_FINAL_CARD, pair: null, have: Math.min(total, RITE_FINAL_WINS), need: RITE_FINAL_WINS,
    owned: !!collection[RITE_FINAL_CARD], locked: !allThree });
  return rows;
}

/** いま条件を満たしていて、まだ持っていない限定カード（選定官が先、大祭司は同じ勝利でそろったらその後に） */
export function riteUnlocks(stats, collection) {
  const got = [];
  const have = { ...collection };
  for (const r of riteProgress(stats, have).slice(0, 3)) {
    if (!r.owned && r.have >= r.need) { got.push(r.id); have[r.id] = 1; }
  }
  const fin = riteProgress(stats, have)[3];
  if (!fin.owned && !fin.locked && fin.have >= fin.need) got.push(fin.id);
  return got;
}

/** 1勝ぶんを戦績に足す（組ごとの勝ち数 pw と、全体の勝ち数 wins） */
export function addDraftWin(stats, pair) {
  const st = stats || { runs: 0, best: 0, wins: 0 };
  st.pw = st.pw || {};
  const key = pair.join(',');
  st.pw[key] = (st.pw[key] || 0) + 1;
  st.wins = (st.wins || 0) + 1;
  return st;
}

export function draftReward(wins) {
  return { dust: DRAFT_REWARD[Math.max(0, Math.min(wins, DRAFT_REWARD.length - 1))], prism: wins >= DRAFT_PRISM_AT };
}

/** 新しい挑戦を始める */
export function newDraft(pair, rand = Math.random) {
  return { v: 1, pair, picks: [], options: makeOptions(pair, [], rand), wins: 0, losses: 0, played: 0, opp: null, log: [] };
}

/** 1つ選ぶ。30枚そろったら options は null */
export function applyPick(d, which, rand = Math.random) {
  if (!d || !d.options) return d;
  d.picks.push(...d.options[which]);
  d.options = d.picks.length >= DRAFT_ROUNDS * 2 ? null : makeOptions(d.pair, d.picks, rand);
  return d;
}

export function draftPhase(d) {
  if (!d) return 'none';
  if (d.picks.length < DRAFT_ROUNDS * 2) return 'pick';
  if (d.played < DRAFT_BATTLES) return 'battle';
  return 'done';
}
