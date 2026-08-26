// カード一覧を自己完結HTMLに書き出す（確認用）
//   node tools/gallery.js [出力パス]
import fs from 'node:fs';
import { ALL_CARDS, ELEMENTS, KEYWORDS } from '../src/engine/cards.js';
import { cardArtSvg } from '../src/ui/art.js';

const out = process.argv[2] || 'gallery.html';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const cardHtml = c => {
  const kw = c.keywords && c.keywords.length
    ? `<div class="kw">${c.keywords.map(k => KEYWORDS[k].name).join('/')}</div>` : '';
  const stats = c.type === 'monster'
    ? `<div class="stats"><span class="atk">⚔${c.atk}</span><span class="def">🛡${c.def}</span></div>` : '';
  return `<div class="card ${c.element}">
    <div class="cost">${c.cost}</div>
    <div class="cname">${esc(c.name)}</div>
    <div class="art">${cardArtSvg(c)}<div class="elem">${ELEMENTS[c.element].icon}</div></div>
    ${kw}
    <div class="body">${esc(c.text || c.flavor)}</div>
    ${stats}
  </div>`;
};

const groups = [
  ['fire', '🔥 炎', 'monster'], ['water', '💧 水', 'monster'], ['grass', '🌿 草', 'monster'],
  ['fire', '🔥 炎サポート', 'support'], ['water', '💧 水サポート', 'support'],
  ['grass', '🌿 草サポート', 'support'], ['none', '✦ 汎用サポート', 'support'],
];

const body = groups.map(([el, label, type]) => {
  const cs = ALL_CARDS.filter(c => c.element === el && c.type === type);
  if (!cs.length) return '';
  return `<h2>${label}　<small>${cs.length}種</small></h2><div class="grid">${cs.map(cardHtml).join('')}</div>`;
}).join('');

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>TRI-ELEMENTS カード一覧</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(1000px 600px at 50% -10%,#1b2740,#0d1117 60%);color:#e8eef6;
  font-family:"Yu Gothic UI","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif;padding:26px 30px 60px}
h1{font-size:34px;letter-spacing:.18em;background:linear-gradient(180deg,#fff2cf,#e0a93c 60%,#a2701a);
  -webkit-background-clip:text;background-clip:text;color:transparent;text-align:center;margin-bottom:4px}
.sub{text-align:center;color:#93a3b8;letter-spacing:.25em;font-size:12px;margin-bottom:24px}
h2{font-size:17px;color:#f2c15b;margin:26px 0 10px;border-bottom:1px solid #2e3b4d;padding-bottom:6px}
h2 small{color:#93a3b8;font-size:12px;font-weight:400}
.grid{display:flex;flex-wrap:wrap;gap:12px}
.card{width:150px;height:232px;border-radius:10px;position:relative;flex:none;
  background:linear-gradient(180deg,#28313f,#161d27);border:2px solid #3a4657;
  box-shadow:0 4px 12px rgba(0,0,0,.55);overflow:hidden}
.card.fire{border-color:#8c3a1c;background:linear-gradient(180deg,#33211c,#1a1210)}
.card.water{border-color:#1c5b8c;background:linear-gradient(180deg,#182836,#101820)}
.card.grass{border-color:#2a6b39;background:linear-gradient(180deg,#1b2c1e,#101810)}
.card.none{border-color:#6b5c34;background:linear-gradient(180deg,#2c2820,#171410)}
.cname{font-size:12px;font-weight:800;padding:4px 24px 3px 6px;line-height:1.15;height:31px;
  display:flex;align-items:center;text-shadow:0 1px 2px #000}
.cost{position:absolute;top:3px;right:3px;width:24px;height:24px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#ffe9a8,#c9922f);color:#3a2600;font-size:14px;font-weight:900;
  display:flex;align-items:center;justify-content:center;border:1px solid #6b4c10;z-index:2}
.art{height:127px;position:relative;background:#0a0d12}
.card-art-svg{width:100%;height:100%;display:block}
.elem{position:absolute;left:4px;bottom:3px;font-size:13px;filter:drop-shadow(0 1px 1px #000)}
.body{padding:5px 7px;font-size:10.4px;line-height:1.34;color:#c8d4e2;height:56px;overflow:hidden}
.stats{position:absolute;bottom:0;left:0;right:0;height:24px;display:flex;align-items:center;
  justify-content:space-between;padding:0 7px;font-weight:900;font-size:14px;
  background:linear-gradient(0deg,rgba(0,0,0,.8),transparent)}
.atk{color:#ff9c6b}.def{color:#7fc4ff}
.kw{position:absolute;top:35px;right:4px;font-size:9px;background:#000b;padding:1px 4px;border-radius:3px;color:#f2c15b}
</style></head><body>
<h1>TRI-ELEMENTS</h1><div class="sub">カード一覧　全${ALL_CARDS.length}種</div>
${body}
</body></html>`;

fs.writeFileSync(out, html, 'utf8');
console.log('wrote', out, html.length, 'bytes');
