// 属性ごとに「全カード一覧」を1枚の画像として書き出す（イラスト制作用）
//   node tools/sheets.js
import fs from 'node:fs';
import { chromium } from 'playwright';
import { ALL_CARDS, ELEMENTS, KEYWORDS } from '../src/engine/cards.js';
import { cardArtSvg } from '../src/ui/art.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const cardHtml = c => {
  const kw = c.keywords?.length ? `<div class="kw">${c.keywords.map(k => KEYWORDS[k].name).join(' / ')}</div>` : '';
  const stats = c.type === 'monster'
    ? `<div class="stats"><span class="atk">⚔ ${c.atk}</span><span class="def">🛡 ${c.def}</span></div>`
    : '<div class="stats sup">サポート</div>';
  return `<div class="card ${c.element}">
    <div class="hdr"><span class="nm">${esc(c.name)}</span><span class="cost">${c.cost}</span></div>
    <div class="art">${cardArtSvg(c)}</div>
    ${kw}
    <div class="txt">${esc(c.text || c.flavor)}</div>
    ${stats}
    <div class="id">${c.id}${c.set === 2 ? ' ・第2弾' : ''}</div>
  </div>`;
};

const GROUPS = [
  ['fire', '炎属性', '🔥'],
  ['water', '水属性', '💧'],
  ['grass', '草属性', '🌿'],
  ['none', '汎用サポート', '✦'],
];

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e8eef6;font-family:"Yu Gothic UI","Noto Sans JP",system-ui,sans-serif;padding:24px 26px 30px;width:1560px}
h1{font-size:30px;margin-bottom:2px;letter-spacing:.06em}
.sub{color:#93a3b8;font-size:13px;margin-bottom:18px}
.grid{display:flex;flex-wrap:wrap;gap:14px}
.card{width:174px;border-radius:11px;position:relative;flex:none;overflow:hidden;
  background:linear-gradient(180deg,#28313f,#161d27);border:2px solid #3a4657;box-shadow:0 4px 14px #0009}
.card.fire{border-color:#a24a24;background:linear-gradient(180deg,#3a251d,#1c1310)}
.card.water{border-color:#2470a8;background:linear-gradient(180deg,#1a2c3c,#101923)}
.card.grass{border-color:#31803f;background:linear-gradient(180deg,#1d3120,#111a12)}
.card.none{border-color:#7d6b3c;background:linear-gradient(180deg,#302b21,#191510)}
.hdr{display:flex;align-items:center;gap:6px;padding:6px 7px 4px}
.nm{font-size:12.5px;font-weight:800;line-height:1.2;flex:1;text-shadow:0 1px 2px #000}
.cost{width:24px;height:24px;flex:none;border-radius:50%;font-size:14px;font-weight:900;color:#3a2600;
  background:radial-gradient(circle at 35% 30%,#ffe9a8,#c9922f);border:1px solid #6b4c10;
  display:flex;align-items:center;justify-content:center}
.art{height:147px;background:#0a0d12;position:relative}
.card-art-svg{width:100%;height:100%;display:block}
.kw{position:absolute;top:36px;right:6px;font-size:10px;background:#000c;color:#f2c15b;padding:2px 5px;border-radius:4px}
.txt{padding:6px 8px;font-size:10.5px;line-height:1.4;color:#c9d6e4;min-height:52px}
.stats{display:flex;justify-content:space-between;padding:4px 9px 5px;font-size:15px;font-weight:900;
  background:linear-gradient(0deg,#0009,transparent)}
.stats.sup{justify-content:center;font-size:11px;font-weight:700;color:#93a3b8}
.atk{color:#ff9c6b}.def{color:#7fc4ff}
.id{position:absolute;bottom:2px;right:6px;font-size:8.5px;color:#5f7align}
.id{color:#63758c}
`;

const browser = await chromium.launch();
for (const [el, label, icon] of GROUPS) {
  const cs = ALL_CARDS.filter(c => c.element === el)
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'monster' ? -1 : 1) || a.set - b.set || a.cost - b.cost);
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <h1>${icon} ${label}　全${cs.length}種</h1>
    <div class="sub">TRI-ELEMENTS ／ 三属の戦記　カード一覧（モンスター → サポートの順、第1弾 → 第2弾、コスト順）</div>
    <div class="grid">${cs.map(cardHtml).join('')}</div></body></html>`;
  const file = `sheet_${el}.html`;
  fs.writeFileSync(file, html, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto(`file:///${process.cwd().replace(/\\/g, '/')}/${file}`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/cards_${el}.png`, fullPage: true });
  await page.close();
  fs.unlinkSync(file);
  console.log('  ->', `shots/cards_${el}.png`, `(${cs.length}種)`);
}
await browser.close();
