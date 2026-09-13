// ============================================================
// 今日の選定の儀（毎日のランキング）— 画面に依存しない部分
//
//   その日（日本時間の0時で切り替え）は、全員が同じ条件で選定の儀に挑む：
//     ・属性の組はその日のお題で決まっている
//     ・ピックの候補は「日付＋何回目のピックか」で決まる乱数から作る
//       （同じ選び方をすれば同じ候補が出る。選び方が違えば、その先の候補も変わる）
//     ・5人の相手と、その対戦の山札の混ぜ方も日付で決まる
//   何回でも挑めて、その日の最高点がランキングに載る（博史さんの決定）。
//   星屑・限定カードの勝ち数は増えない（何度も同じ日に挑めるので、稼ぎ場にしない）。
//
//   サーバー（/opt/te-stats/game）でも同じファイルで敵キャラ24人の点数を計算するので、
//   ブラウザの物（DOM・localStorage）には触れないこと。
// ============================================================
import { DRAFT_PAIRS, DRAFT_BATTLES, makeOptions, draftOpponent } from './draft.js';
import { AREAS } from './campaign.js';

/** 日本時間の日付 'YYYY-MM-DD' */
export function dayKey(now = Date.now()) {
  return new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
}
export function prevDay(day) {
  return new Date(Date.parse(day + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
}

/** 文字列 → 32bit（FNV-1a） */
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const dayRand = (day, tag) => mulberry(hash32(`tri-daily:${day}:${tag}`));

/** その日のお題（属性の組） */
export function dailyPair(day) {
  return DRAFT_PAIRS[hash32(`tri-daily:${day}:pair`) % DRAFT_PAIRS.length];
}
/** ピックの候補：何回目のピックかで乱数を決める（途中から再開しても同じ候補） */
export function dailyOptions(day, pair, picks) {
  return makeOptions(pair, picks, dayRand(day, `pick${picks.length / 2}`));
}
/** n 戦目（0〜4）の相手 */
export function dailyOpponent(day, n, pair) {
  return draftOpponent(n, AREAS, dayRand(day, `opp${n}`), pair);
}
/** n 戦目の対戦の乱数の種（山札の混ぜ方） */
export function dailyBattleSeed(day, n) {
  return hash32(`tri-daily:${day}:battle${n}`) % 1e9;
}

// ---- 点数 ----
// 勝ちがいちばん大事。同じ勝ち数なら「うまく勝った人」が上に来るように、残りライフと早さを足す。
// 負けても、削った相手のライフのぶんは入る。5戦全勝でボーナス。
export const SCORE = { win: 1000, life: 20, lifeCap: 30, speedFrom: 20, speed: 25, chip: 10, perfectRun: 1000 };
export const SCORE_MAX = DRAFT_BATTLES * (SCORE.win + SCORE.life * SCORE.lifeCap + SCORE.speed * SCORE.speedFrom) + SCORE.perfectRun;

/** 1戦の点数。win、自分の残りライフ、何ターン目で決着したか、相手の最初と最後のライフ */
export function battleScore({ win, myLife, turn, foeStart, foeLife }) {
  if (win) {
    return SCORE.win + SCORE.life * Math.max(0, Math.min(SCORE.lifeCap, myLife))
      + SCORE.speed * Math.max(0, SCORE.speedFrom - turn);
  }
  return SCORE.chip * Math.max(0, Math.min(foeStart, foeStart - Math.max(0, foeLife)));
}
export function runScore(battleScores, wins) {
  return battleScores.reduce((a, b) => a + b, 0) + (wins >= DRAFT_BATTLES ? SCORE.perfectRun : 0);
}

// ---- 敵キャラ（ライバル）：サーバーで毎日 AI に遊ばせる ----
/** 敵キャラ24人。noise は冒険での手加減の強さをそのまま使う（小さいほど本気） */
export const RIVALS = AREAS.flatMap(a => a.enemies.map((e, i) => ({ key: `${a.id}:${i}`, noise: e.noise || 0 })));

// ---- 名前 ----
// ランキングに出る名前。長さを揃え、ひどい言葉は「旅人」に置き換える（最低限。サーバーでも同じことをする）
const NG = ['死ね', 'しね', '殺す', 'ころす', 'ちんこ', 'まんこ', 'セックス', 'レイプ', 'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'rape', 'sex', 'penis', 'pussy', 'kill yourself', 'kys'];
export function cleanName(name) {
  // 制御文字と < > は消す（表に HTML として入り込まないように。表示側でもエスケープする）
  const n = String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 12);
  const low = n.toLowerCase().replace(/\s+/g, ' ');
  if (!n || NG.some(w => low.includes(w))) return null;
  return n;
}
