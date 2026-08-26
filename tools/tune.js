// sim/cardpower.js の実測結果に基づく数値調整を cards.js / cards_set2.js に適用する。
// 変更内容をここに集約しておき、後から履歴として追える形にしておく。
import fs from 'node:fs';

const STAT_CHANGES = {
  // id: [atk, def]  ※★有意に強すぎ／弱すぎだったものを補正
  f05: [5, 4],   // 灼熱の剣士 6/3 → 5/4   (+7.5 だがc3最高打点すぎた)
  f06: [4, 5],   // マグマゴーレム 3/5 → 4/5 (-6.5 全カード最弱)
  f07: [3, 2],   // 灰かぶりの魔女 2/2 → 3/2 (-1.8)
  f08: [5, 4],   // 双炎の戦鬼 6/4 → 5/4    (+12.2)
  f09: [8, 4],   // 業火のドラゴン 9/4 → 8/4 (+19.0 全カード最強)
  f10: [7, 5],   // 煉獄竜 8/5 → 7/5        (+13.5)
  w05: [3, 5],   // 氷結の番人 3/4 → 3/5    (-0.8 守護の壁として物足りない)
  g03: [3, 5],   // キノコ戦士 3/4 → 3/5    (-2.7)
  g05: [2, 5],   // 森羅の守り手 2/4 → 2/5  (-1.8)
  g07: [5, 6],   // 大樹のトレント 6/6 → 5/6 (+11.2)
};

const COST_CHANGES = {
  sw3: 2,   // 導きの潮流 3 → 2  （ドローは原案想定より弱い）
  sw5: 3,   // 深淵の予言 4 → 3
  sn2: 1,   // 戦術の書  2 → 1
  sn9: 1,   // 記憶の欠片 2 → 1
  sg3: 2,   // 森の加護  3 → 2
  sg5: 5,   // 世界樹の実 4 → 5  （+11.0）
};

let s = fs.readFileSync('src/engine/cards.js', 'utf8');

for (const [id, [a, d]] of Object.entries(STAT_CHANGES)) {
  const re = new RegExp(`(M\\('${id}', '[^']*', '\\w+', \\d+), \\d+, \\d+,`);
  if (!re.test(s)) throw new Error('stat pattern not found: ' + id);
  s = s.replace(re, `$1, ${a}, ${d},`);
}
for (const [id, c] of Object.entries(COST_CHANGES)) {
  const re = new RegExp(`(S\\('${id}', '[^']*', '\\w+'), \\d+,`);
  if (!re.test(s)) throw new Error('cost pattern not found: ' + id);
  s = s.replace(re, `$1, ${c},`);
}

// 装備サポートの数値（攻撃力1 ≒ 防御力2 の実測値に合わせる）
s = s.replace(
  "effects: [{ op: 'equip', atk: 3, def: 0 }], flavor: '柄まで焼けるが、構わない。'",
  "effects: [{ op: 'equip', atk: 2, def: 0 }], flavor: '柄まで焼けるが、構わない。'");
s = s.replace("text: '装備：自分のモンスター1体を+3/+0する。場に残る。'",
  "text: '装備：自分のモンスター1体を+2/+0する。場に残る。'");
s = s.replace(
  "effects: [{ op: 'equip', atk: 2, def: 1 }], flavor: '二本目は保険だ。'",
  "effects: [{ op: 'equip', atk: 1, def: 2 }], flavor: '二本目は保険だ。'");
s = s.replace("text: '装備：自分のモンスター1体を+2/+1する。場に残る。'",
  "text: '装備：自分のモンスター1体を+1/+2する。場に残る。'");

// 潮見の巫女: 回復2 → 3
s = s.replace("text: '【登場時】自分のライフを2回復。',\n    onSummon: [{ op: 'heal', side: 'self', v: 2 }]",
  "text: '【登場時】自分のライフを3回復。',\n    onSummon: [{ op: 'heal', side: 'self', v: 3 }]");

fs.writeFileSync('src/engine/cards.js', s, 'utf8');
console.log('applied', Object.keys(STAT_CHANGES).length, 'stat changes and',
  Object.keys(COST_CHANGES).length, 'cost changes');
