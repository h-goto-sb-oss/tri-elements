// ============================================================
// 実績・称号・アイコン（画面に依存しない部分）
//
//   実績は「セーブの中身」か「数えておいた回数（save.ach.c）」から進み具合を出す。
//   取った実績は save.ach.got[id] = 取った時刻。称号は実績のごほうび。
//   主人公のアイコンは、基本の6人に加えて、冒険で勝った敵キャラ24人を使える。
//
//   バランス：すぐ取れるものを多め、上に行くほど長い目標に。
//   「全実績解除」は、いちばん遊んでいる人でも数週間かかるくらいを目安にしている。
//   数の目安（2026-09-13 の匿名データ）：よく遊ぶ人は1日80戦・パック46個。
// ============================================================
import { AREAS, STARTER_DECK } from './campaign.js';
import { ALL_CARDS } from '../engine/cards.js';
import { L } from '../i18n/lang.js';

const cnt = (s, k) => (s.ach && s.ach.c && s.ach.c[k]) || 0;
const bossKey = ai => `${AREAS[ai].id}:${AREAS[ai].enemies.length - 1}`;
const owned = (s, f) => ALL_CARDS.filter(c => f(c) && s.collection[c.id]).length;
const dexTotal = () => ALL_CARDS.filter(c => !c.hidden).length;
const extremeWins = s => Object.values(s.freeStats || {}).reduce((a, x) => a + (x.xw || 0), 0);
const sorted = l => [...l].sort().join();
const customDeck = s => (s.decks || []).some(d => d.list && d.list.length === 30 && sorted(d.list) !== sorted(STARTER_DECK));

// 実績。v(save) が goal に届いたら取れる。title があれば称号がもらえる
// cat: story 冒険 / battle 対戦 / free フリーバトル / collect 収集 / rite 選定の儀 / meta 全体
const A = (id, cat, goal, v, name, desc, title = null) => ({ id, cat, goal, v, name, desc, title });

export const ACHIEVEMENTS = [
  // ---- 冒険 ----
  A('first_win', 'story', 1, s => (s.stats && s.stats.wins) || 0,
    () => L('はじめての勝利', 'First Victory'), () => L('冒険で1回勝つ', 'Win a battle in Adventure'), ['旅立ちし者', 'The Departed']),
  ...AREAS.map((a, i) => A(`area_${i + 1}`, 'story', 1, s => (s.cleared[bossKey(i)] ? 1 : 0),
    () => L(`${AREAS[i].name}を越えて`, `Beyond ${AREAS[i].name}`),
    () => L(`${AREAS[i].name}のボスに勝つ`, `Defeat the boss of ${AREAS[i].name}`),
    [['草原の旅人', 'Meadow Wanderer'], ['丘を焼く者', 'Hill Burner'], ['入り江の勝者', 'Victor of the Cove'], ['森を抜けし者', 'Through the Forest'],
      ['頂に立つ者', 'Summit Stander'], ['黄昏の歩み手', 'Twilight Walker'], ['星辰の門番', 'Keeper of the Stars'], ['王たちを越えし者', 'Beyond the Kings']][i])),
  A('wins_50', 'story', 50, s => (s.stats && s.stats.wins) || 0,
    () => L('歴戦の旅', 'Seasoned Journey'), () => L('冒険で通算50勝', 'Win 50 Adventure battles')),
  A('wins_300', 'story', 300, s => (s.stats && s.stats.wins) || 0,
    () => L('百戦錬磨', 'Battle-Hardened'), () => L('冒険で通算300勝', 'Win 300 Adventure battles'), ['歴戦の勇士', 'Veteran Hero']),

  // ---- 対戦の腕 ----
  A('guard_10', 'battle', 10, s => cnt(s, 'guard'),
    () => L('受け止める', 'Hold the Line'), () => L('防御モードで相手の攻撃を10回耐える', 'Survive 10 attacks in Defense Mode')),
  A('guard_100', 'battle', 100, s => cnt(s, 'guard'),
    () => L('揺るがぬ盾', 'Unshakable Shield'), () => L('防御モードで相手の攻撃を100回耐える', 'Survive 100 attacks in Defense Mode'), ['鉄壁', 'Ironwall']),
  A('adv_30', 'battle', 30, s => cnt(s, 'adv'),
    () => L('相性を知る', 'Know the Triangle'), () => L('有利な属性で30回攻撃する', 'Attack with element advantage 30 times')),
  A('adv_300', 'battle', 300, s => cnt(s, 'adv'),
    () => L('三属の理', 'Law of Three'), () => L('有利な属性で300回攻撃する', 'Attack with element advantage 300 times'), ['三属の使い手', 'Master of Three']),
  A('direct_50', 'battle', 50, s => cnt(s, 'direct'),
    () => L('がら空きを突く', 'Open Door'), () => L('直接攻撃を50回決める', 'Land 50 direct attacks')),
  A('kills_100', 'battle', 100, s => cnt(s, 'kills'),
    () => L('百の討伐', 'Hundred Down'), () => L('相手のモンスターを100体倒す', 'Destroy 100 enemy monsters')),
  A('kills_1000', 'battle', 1000, s => cnt(s, 'kills'),
    () => L('千の討伐', 'Thousand Down'), () => L('相手のモンスターを1000体倒す', 'Destroy 1,000 enemy monsters'), ['千体斬り', 'Thousandslayer']),
  A('triple', 'battle', 1, s => cnt(s, 'triple'),
    () => L('一掃', 'Clean Sweep'), () => L('自分の1ターンで相手のモンスターを3体倒す', 'Destroy 3 enemy monsters in one of your turns')),
  A('perfect', 'battle', 1, s => cnt(s, 'perfect'),
    () => L('無傷', 'Untouched'), () => L('ライフを1も減らさずに勝つ', 'Win without losing any Life'), ['無傷の勝者', 'The Untouched']),
  A('clutch', 'battle', 1, s => cnt(s, 'clutch'),
    () => L('土壇場', 'By a Thread'), () => L('ライフ3以下で勝つ', 'Win with 3 or less Life'), ['土壇場の勝者', 'Last-Stand Victor']),
  A('speed', 'battle', 1, s => cnt(s, 'speed'),
    () => L('疾風', 'Swift Wind'), () => L('10ターン以内に勝つ（ターンの数字が10まで）', 'Win by turn 10'), ['疾風', 'Gale']),
  A('mono', 'battle', 1, s => cnt(s, 'mono'),
    () => L('ひとつの色', 'One Color'), () => L('炎・水・草のうち1つの属性だけのデッキで勝つ（無属性は入れてよい）', 'Win with a deck of a single element (neutral cards allowed)'), ['単色の誇り', 'Pure Hue']),

  // ---- フリーバトル ----
  A('hard_win', 'free', 1, s => cnt(s, 'hard'),
    () => L('強化に挑む', 'Harder Now'), () => L('フリーバトルの「強化」で勝つ', 'Win a Free Battle on Hard')),
  A('extreme_win', 'free', 1, extremeWins,
    () => L('極の門', 'Gate of Extreme'), () => L('フリーバトルの「極」で勝つ', 'Win a Free Battle on Extreme')),
  A('extreme_30', 'free', 30, extremeWins,
    () => L('極めし者', 'Extreme Master'), () => L('「極」で通算30勝', 'Win 30 Free Battles on Extreme'), ['極めし者', 'The Extreme']),
  A('char_1', 'free', 1, s => owned(s, c => c.set === 9),
    () => L('はじめての絆', 'First Bond'), () => L('キャラクターカードを1枚手に入れる', 'Earn a character card')),
  A('char_12', 'free', 12, s => owned(s, c => c.set === 9),
    () => L('十二の絆', 'Twelve Bonds'), () => L('キャラクターカードを12枚手に入れる', 'Earn 12 character cards')),
  A('char_24', 'free', 24, s => owned(s, c => c.set === 9),
    () => L('すべての絆', 'Every Bond'), () => L('キャラクターカードを24枚すべて手に入れる', 'Earn all 24 character cards'), ['二十四の絆', 'Bound to All']),

  // ---- 収集 ----
  A('packs_10', 'collect', 10, s => cnt(s, 'packs'),
    () => L('開封の楽しみ', 'Joy of Opening'), () => L('パックを10個開ける', 'Open 10 packs')),
  A('packs_100', 'collect', 100, s => cnt(s, 'packs'),
    () => L('開封の達人', 'Pack Master'), () => L('パックを100個開ける', 'Open 100 packs'), ['開封の達人', 'Pack Master']),
  A('dust_100', 'collect', 100, s => cnt(s, 'dust'),
    () => L('星屑集め', 'Stardust Gatherer'), () => L('星屑を通算100集める', 'Earn 100 Stardust in total')),
  A('legend_5', 'collect', 5, s => owned(s, c => !c.hidden && c.rarity === 'legend'),
    () => L('伝説を手に', 'Legends in Hand'), () => L('レジェンドのカードを5種類持つ（パックから出るもの）', 'Own 5 different Legend cards (from packs)')),
  A('dex_half', 'collect', Math.ceil(dexTotal() / 2), s => owned(s, c => !c.hidden),
    () => L('図鑑の半分', 'Half the Library'), () => L(`図鑑のカードを半分（${Math.ceil(dexTotal() / 2)}種）集める`, `Collect half the library (${Math.ceil(dexTotal() / 2)} cards)`)),
  A('dex_all', 'collect', dexTotal(), s => owned(s, c => !c.hidden),
    () => L('図鑑コンプリート', 'Complete Library'), () => L(`図鑑のカードを全${dexTotal()}種集める`, `Collect all ${dexTotal()} library cards`), ['蒐集家', 'The Collector']),
  A('deck_custom', 'collect', 1, s => (customDeck(s) ? 1 : 0),
    () => L('自分のデッキ', 'My Own Deck'), () => L('はじめのデッキから変えた30枚のデッキを作る', 'Build a 30-card deck different from the starter')),
  A('decks_4', 'collect', 4, s => (s.decks || []).filter(d => d.list && d.list.length === 30).length,
    () => L('デッキの棚', 'Deck Shelf'), () => L('30枚のデッキを4つ保存する', 'Save 4 complete decks')),

  // ---- 選定の儀 ----
  A('rite_first', 'rite', 1, s => (s.draftStats && s.draftStats.runs) || 0,
    () => L('儀式の門をくぐる', 'Enter the Rite'), () => L('選定の儀を最後まで挑む', 'Finish a Rite of Choosing run')),
  A('rite_3', 'rite', 3, s => (s.draftStats && s.draftStats.best) || 0,
    () => L('選定を越えて', 'Past the Choosing'), () => L('選定の儀で3勝以上する', 'Win 3+ battles in one run')),
  A('rite_5', 'rite', 5, s => (s.draftStats && s.draftStats.best) || 0,
    () => L('選ばれし者', 'The Chosen'), () => L('選定の儀で5戦全勝する', 'Win all 5 battles in one run'), ['選ばれし者', 'The Chosen']),
  A('rite_runs_20', 'rite', 20, s => (s.draftStats && s.draftStats.runs) || 0,
    () => L('儀式の常連', 'Rite Regular'), () => L('選定の儀に20回挑む', 'Finish 20 runs')),
  A('rite_card_1', 'rite', 1, s => owned(s, c => c.set === 10),
    () => L('選定官との出会い', 'Met a Selector'), () => L('限定カードを1枚手に入れる', 'Earn an exclusive card')),
  A('rite_card_4', 'rite', 4, s => owned(s, c => c.set === 10),
    () => L('大祭司の祝福', 'High Priest’s Blessing'), () => L('限定カードを4枚すべて手に入れる', 'Earn all 4 exclusive cards'), ['大祭司の弟子', 'Priest’s Disciple']),

  // ---- 今日の選定の儀（ランキング） ----
  A('rank_join', 'rank', 1, s => cnt(s, 'rankJoin'),
    () => L('ランキングに名を刻む', 'On the Board'), () => L('今日の選定の儀の記録をランキングに送る', 'Post a Daily Rite score to the ranking')),
  A('rank_top10', 'rank', 1, s => cnt(s, 'rankTop10'),
    () => L('上位の常連', 'Top Ten'), () => L('今日の選定の儀で、その日の最終順位10位以内に入る（ライバル込み）', 'Finish a day in the top 10 of the Daily Rite (Rivals included)'), ['選定の上位者', 'Top Selector']),
  A('rank_1', 'rank', 1, s => cnt(s, 'rank1'),
    () => L('一日の覇者', 'Champion of the Day'), () => L('今日の選定の儀で、その日の1位になる（ライバル込み）', 'Finish a day at #1 in the Daily Rite (Rivals included)'), ['一日の覇者', 'Champion of the Day']),

  // ---- 全体（ほかの実績の数で決まる） ----
  A('ach_20', 'meta', 20, s => gotCount(s),
    () => L('積み重ね', 'Piling Up'), () => L('実績を20個解除する', 'Unlock 20 achievements')),
  A('ach_all', 'meta', 0, s => gotCount(s),
    () => L('三属の覇者', 'Sovereign of Three'), () => L('ほかの実績をすべて解除する', 'Unlock every other achievement'), ['三属の覇者', 'Sovereign of Three']),
];
// 全実績の数（自分以外）。ACHIEVEMENTS ができてから決める
ACHIEVEMENTS.find(a => a.id === 'ach_all').goal = ACHIEVEMENTS.length - 1;

function gotCount(s) {
  const got = (s.ach && s.ach.got) || {};
  return ACHIEVEMENTS.filter(a => a.id !== 'ach_all' && got[a.id]).length;
}

export const ACH_CATS = [
  ['story', ['冒険', 'Adventure']], ['battle', ['対戦の腕', 'Battle Skill']], ['free', ['フリーバトル', 'Free Battle']],
  ['collect', ['収集', 'Collection']], ['rite', ['選定の儀', 'Rite of Choosing']], ['rank', ['ランキング', 'Ranking']], ['meta', ['全体', 'Overall']],
];

/** 数える回数を足す（守った・有利で攻撃した など）。save.ach.c */
export function bump(s, key, n = 1) {
  s.ach = s.ach || { c: {}, got: {} };
  s.ach.c = s.ach.c || {};
  s.ach.c[key] = (s.ach.c[key] || 0) + n;
}

/** 実績の進み具合 [{ a, v, done }] */
export function achProgress(s) {
  const got = (s.ach && s.ach.got) || {};
  return ACHIEVEMENTS.map(a => ({ a, v: Math.min(a.v(s), a.goal), done: !!got[a.id] }));
}

/** 条件を満たしたのにまだ取っていない実績を取る。新しく取った実績を返す（全体の実績は最後にもう一度見る） */
export function checkAch(s) {
  s.ach = s.ach || { c: {}, got: {} };
  s.ach.got = s.ach.got || {};
  const now = Date.now(), fresh = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const a of ACHIEVEMENTS) {
      if (s.ach.got[a.id]) continue;
      if (a.v(s) >= a.goal) { s.ach.got[a.id] = now; fresh.push(a); }
    }
  }
  return fresh;
}

// ---- 称号 ----
/** 取れる称号 [{ id, name:[ja,en], from: 実績 }] */
export const TITLES = ACHIEVEMENTS.filter(a => a.title).map(a => ({ id: a.id, name: a.title, from: a }));
export function titleUnlocked(s, id) { return !!(s.ach && s.ach.got && s.ach.got[id]); }

// ---- アイコン ----
/** 冒険で勝った敵キャラのアイコン。id は 'c:a1:0' の形 */
export const CHAR_AVATARS = AREAS.flatMap(a => a.enemies.map((e, i) => ({ id: `c:${a.id}:${i}`, key: `${a.id}:${i}`, area: a.id, index: i })));
export function avatarUnlocked(s, id) {
  if (typeof id === 'number' || /^\d+$/.test(String(id))) return true;   // 基本の6人
  const m = /^c:(.+)$/.exec(String(id));
  return !!(m && s.cleared[m[1]]);
}
