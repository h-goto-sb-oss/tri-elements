// ============================================================
// 全カードの名前欄・効果文が枠からはみ出していないかを測る
//   node tools/check_text_fit.mjs [en|ja]
//   手札（横長／縦長）・図鑑・詳細の大きいカードの4つの見た目で調べる
// ============================================================
import { chromium } from 'playwright';

const URL = process.env.TE_URL || 'http://localhost:5180';
const lang = process.argv[2] || 'en';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(l => { localStorage.setItem('tri-elements-lang', l); }, lang);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__TE && window.__TE.app);

const result = await page.evaluate(async () => {
  const { cardHtml } = await import('/src/ui/cardview.js');
  const T = window.__TE;
  const contexts = [
    ['hand-wide', '<div class="battle"><div class="hand">', '</div></div>'],
    ['hand-portrait', '<div class="battle portrait"><div class="hand">', '</div></div>'],
    ['library', '<div class="poolcard">', '</div>'],
  ];
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;width:2000px;visibility:hidden';
  document.body.appendChild(host);
  const bad = {};
  for (const [name, pre, post] of contexts) {
    host.innerHTML = pre + T.ALL_CARDS.map(c => cardHtml(c, {})).join('') + post;
    bad[name] = [];
    host.querySelectorAll('.card').forEach(el => {
      const id = el.dataset.card;
      const body = el.querySelector('.body'), nm = el.querySelector('.cname');
      if (body && getComputedStyle(body).display !== 'none' && body.scrollHeight > body.clientHeight + 1)
        bad[name].push(`${id} body ${body.scrollHeight}>${body.clientHeight}`);
      if (nm && nm.scrollHeight > nm.clientHeight + 1)
        bad[name].push(`${id} name ${nm.scrollHeight}>${nm.clientHeight}`);
    });
  }
  host.remove();
  return bad;
});
for (const [k, v] of Object.entries(result)) {
  console.log(`${k}: ${v.length} overflow`);
  v.slice(0, 40).forEach(x => console.log('   ', x));
}
await browser.close();
