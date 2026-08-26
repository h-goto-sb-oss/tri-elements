// イラスト表現の比較ページを出力する
//   A: 現状のフラットSVG
//   B: 陰影・輪郭を足したSVG（描き込み版）
//   C: ドット絵化（SVGを低解像度キャンバスに描いて拡大）
import fs from 'node:fs';
import { ALL_CARDS, card } from '../src/engine/cards.js';
import { cardArtSvg } from '../src/ui/art.js';

const PICK = ['f09', 'f10', 'w08', 'w03', 'g07', 'g09', 'f05', 'w01'];
const cells = PICK.map(id => {
  const c = card(id);
  const svg = cardArtSvg(c);
  return { id, name: c.name, el: c.element, svg };
});

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>イラスト表現の比較</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e8eef6;font-family:"Yu Gothic UI",system-ui,sans-serif;padding:22px}
h1{font-size:22px;color:#f2c15b;margin-bottom:4px}
p.note{color:#93a3b8;font-size:13px;margin-bottom:18px}
table{border-collapse:collapse}
th{font-size:13px;color:#f2c15b;padding:6px 10px;text-align:center}
th.sub{color:#93a3b8;font-weight:400;font-size:11px}
td{padding:6px 10px;text-align:center}
.frame{width:170px;height:120px;border-radius:8px;overflow:hidden;border:2px solid #3a4657;background:#0a0d12}
.frame svg,.frame canvas{width:100%;height:100%;display:block}
.frame canvas{image-rendering:pixelated}
.nm{font-size:12px;color:#c8d4e2;margin-top:4px}
.fire{border-color:#8c3a1c}.water{border-color:#1c5b8c}.grass{border-color:#2a6b39}
</style></head><body>
<h1>カードイラスト 表現の比較</h1>
<p class="note">A＝現状のフラットSVG　B＝陰影・輪郭を足したSVG　C＝ドット絵化（同じ図形を低解像度で描いて拡大）</p>
<table>
<tr><th></th><th>A：フラットSVG<div class="sub">現状</div></th><th>B：陰影つきSVG<div class="sub">輪郭＋グラデ＋ハイライト</div></th><th>C：ドット絵<div class="sub">36×26 を拡大</div></th></tr>
${cells.map((c, i) => `<tr>
  <td style="text-align:right;font-size:13px;color:#c8d4e2">${c.name}</td>
  <td><div class="frame ${c.el}" id="a${i}">${c.svg}</div></td>
  <td><div class="frame ${c.el}" id="b${i}">${c.svg}</div></td>
  <td><div class="frame ${c.el}"><canvas id="c${i}" width="36" height="26"></canvas></div></td>
</tr>`).join('')}
</table>
<script>
const N = ${cells.length};
// --- B: 影・輪郭・ハイライトのフィルタを後付けする ---
for (let i = 0; i < N; i++) {
  const box = document.getElementById('b' + i);
  const svg = box.querySelector('svg');
  const ns = 'http://www.w3.org/2000/svg';
  const defs = svg.querySelector('defs');
  defs.insertAdjacentHTML('beforeend', \`
    <filter id="sh\${i}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.6" stdDeviation="1.1" flood-color="#000" flood-opacity="0.55"/>
    </filter>
    <linearGradient id="gl\${i}" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.30"/>
      <stop offset="55%" stop-color="#fff" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.30"/>
    </linearGradient>\`);
  // 背景の rect 以外に影と細い輪郭を付ける
  [...svg.children].forEach((el, k) => {
    if (el.tagName === 'defs' || (el.tagName === 'rect' && k <= 1)) return;
    el.setAttribute('filter', 'url(#sh' + i + ')');
    if (!el.getAttribute('stroke')) {
      el.setAttribute('stroke', 'rgba(0,0,0,0.45)');
      el.setAttribute('stroke-width', '1.6');
      el.setAttribute('paint-order', 'stroke');
    }
  });
  // 上からライティング用のオーバーレイ
  const ov = document.createElementNS(ns, 'rect');
  ov.setAttribute('width', '100'); ov.setAttribute('height', '70');
  ov.setAttribute('fill', 'url(#gl' + i + ')');
  svg.appendChild(ov);
}
// --- C: SVG を小さいキャンバスに描いてドット絵化 ---
for (let i = 0; i < N; i++) {
  const svgEl = document.getElementById('a' + i).querySelector('svg').cloneNode(true);
  svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgEl.setAttribute('width', '216'); svgEl.setAttribute('height', '156');
  const src = new XMLSerializer().serializeToString(svgEl);
  const blobUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  const img = new Image();
  img.onerror = e => { document.title = 'IMGERR'; console.error('img fail', i); };
  img.onload = () => {
    const cv = document.getElementById('c' + i);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, cv.width, cv.height);
    // 色数を落として"ドット絵らしさ"を出す
    const d = g.getImageData(0, 0, cv.width, cv.height);
    for (let p = 0; p < d.data.length; p += 4) {
      for (let q = 0; q < 3; q++) d.data[p + q] = Math.round(d.data[p + q] / 36) * 36;
    }
    g.putImageData(d, 0, 0);
  };
  img.src = blobUrl;
}
</script></body></html>`;

fs.writeFileSync('compare.html', html, 'utf8');
console.log('wrote compare.html');
