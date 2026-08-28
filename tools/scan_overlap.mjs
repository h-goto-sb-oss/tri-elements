// ============================================================
// 似すぎているカードを機械的に洗い出す
//   カード名や説明文ではなく、実際の効果データ（effects / onSummon）の
//   かたちで突き合わせるので、言い回しが違っても取りこぼさない。
//   node tools/scan_overlap.mjs
// ============================================================
import { ALL_CARDS, KEYWORDS } from '../src/engine/cards.js';

/** 効果の「かたち」。数値と対象条件は別に見るため、ここでは落とす */
const shape = ops => (ops || []).map(o =>
  [o.op, o.side || 'self', o.target || '-', o.duration || '-', o.mode || '-'].join(':')
).join(' + ');

/** 数値の合計。大きいほど強い、というざっくりした目安 */
const power = ops => (ops || []).reduce((s, o) =>
  s + Math.abs(o.atk || 0) + Math.abs(o.def || 0) + Math.abs(o.v || 0)
    + (o.n || 0) * 2 + (o.maxCost || 0), 0);

/**
 * 条件の厳しさ。条件が無い方が使いやすい。
 * maxAtk / maxDef のような数値のしきい値は「小さいほど厳しい」ので、
 * 属性しばりとは別に数えて比較できるようにする。
 */
const restrict = ops => (ops || []).reduce((s, o) => {
  const f = o.filter || {};
  let n = 0;
  if (f.element) n += 2;                 // 属性しばりは重い
  if (f.mode) n += 4;                    // 相手の状態頼みなので、そもそも撃てない場面が多い
  if (f.maxAtk != null) n += 10 / (f.maxAtk + 1);   // しきい値が低いほど厳しい
  if (f.maxDef != null) n += 10 / (f.maxDef + 1);
  if (f.minCost != null) n += f.minCost;
  return s + n;
}, 0);

/** 効かせる相手の属性しばり。違えば別のデッキ向けなので、比べても意味がない */
const filterEl = ops => (ops || []).map(o => (o.filter || {}).element || '-').join(',');

/** 付与するキーワード。違えば役割が違うので、数値だけでは比べられない */
const grants = ops => (ops || []).flatMap(o => o.grants || []).sort().join(',');

/** 攻撃寄り・守り寄りの振り分け。合計が同じでも役割が違う */
const atkSum = ops => (ops || []).reduce((s, o) => s + (o.atk || 0), 0);
const defSum = ops => (ops || []).reduce((s, o) => s + (o.def || 0), 0);

const ops = c => (c.effects || []).concat(c.onSummon || []);
const desc = c => `${c.id} ${c.name}（${c.cost}c${c.type === 'monster' ? ` ${c.atk}/${c.def}` : ''}）`;

const groups = new Map();
for (const c of ALL_CARDS) {
  const s = shape(ops(c));
  if (!s) continue;                       // 効果なしのバニラは対象外
  if (!groups.has(s)) groups.set(s, []);
  groups.get(s).push(c);
}

let hits = 0;
for (const [s, cs] of groups) {
  if (cs.length < 2) continue;
  for (const a of cs) {
    for (const b of cs) {
      if (a.id >= b.id) continue;
      // 効かせる相手の属性が違うカードは、そもそも入るデッキが違う
      if (filterEl(ops(a)) !== filterEl(ops(b))) continue;
      // 付けるキーワードが違えば、数値の大小では優劣を決められない
      if (grants(ops(a)) !== grants(ops(b))) continue;
      const kwA = (a.keywords || []).slice().sort().join(),
            kwB = (b.keywords || []).slice().sort().join();
      const pa = power(ops(a)), pb = power(ops(b));
      const ra = restrict(ops(a)), rb = restrict(ops(b));
      // 効果の攻守も個別に見る。合計が同じでも +0/+3 と +1/+2 は役割が違う
      const aA = atkSum(ops(a)), aD = defSum(ops(a));
      const bA = atkSum(ops(b)), bD = defSum(ops(b));
      // 完全に同じ
      if (a.cost === b.cost && pa === pb && ra === rb && kwA === kwB
          && aA === bA && aD === bD
          && a.type === b.type
          && (a.type !== 'monster' || (a.atk === b.atk && a.def === b.def))) {
        console.log(`■ ほぼ同一  ${desc(a)}  ≒  ${desc(b)}`);
        console.log(`   効果: ${s}`);
        hits++; continue;
      }
      // 片方が上位互換（コスト以下・効果同等以上・条件同等以下）
      const better = (x, y, px, py, rx, ry, xA, xD, yA, yD) =>
        x.cost <= y.cost && px >= py && rx <= ry && x.type === y.type
        && xA >= yA && xD >= yD
        && (x.type !== 'monster' || (x.atk >= y.atk && x.def >= y.def))
        && (x.cost < y.cost || px > py || rx < ry
            || (x.type === 'monster' && (x.atk > y.atk || x.def > y.def)));
      if (better(a, b, pa, pb, ra, rb, aA, aD, bA, bD) && kwA === kwB) {
        console.log(`■ 上位互換  ${desc(a)}  >  ${desc(b)}`);
        console.log(`   効果: ${s}  （数値 ${pa} vs ${pb} / 条件 ${ra} vs ${rb}）`);
        hits++;
      } else if (better(b, a, pb, pa, rb, ra, bA, bD, aA, aD) && kwA === kwB) {
        console.log(`■ 上位互換  ${desc(b)}  >  ${desc(a)}`);
        console.log(`   効果: ${s}  （数値 ${pb} vs ${pa} / 条件 ${rb} vs ${ra}）`);
        hits++;
      }
    }
  }
}
console.log(hits ? `\n合計 ${hits} 件` : '\n重なりは見つかりませんでした');
