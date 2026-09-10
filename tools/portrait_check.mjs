// ============================================================
// 冒険・フリーバトルの敵の顔枠を全員分撮って、1枚に並べる
//   node tools/portrait_check.mjs [出力png]
//   行 = PC冒険 / PC フリー / スマホ冒険 / スマホ フリー、列 = 敵24人
// ============================================================
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.TE_URL || 'http://localhost:5180';
const OUT = process.argv[2] || 'release/portrait_check.png';

const browser = await chromium.launch();
const shots = {};   // `${row}:${key}` -> base64

async function setup(page) {
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.setItem('tri-elements-lang', 'ja'); localStorage.setItem('tri-elements-audio', '{"muted":true,"bgmVol":0,"seVol":0}'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__TE && window.__TE.app);
  await page.evaluate(() => {
    const T = window.__TE, s = T.app.save;
    s.profile = { name: 'ヒロ', avatar: 1 };
    for (let a = 1; a <= 8; a++) for (let i = 0; i < 3; i++) s.cleared[`a${a}:${i}`] = true;
    T.render();
  });
}

async function grab(page, row, screen) {
  const areas = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
  if (screen === 'adventure') {
    for (let ai = 0; ai < 8; ai++) {
      await page.evaluate(ai => { const T = window.__TE; T.app.screen = 'adventure'; T.app.areaIndex = ai; T.render(); }, ai);
      await page.waitForTimeout(250);
      await page.waitForFunction(() => [...document.querySelectorAll('.foe .pchar')].every(i => i.complete && i.naturalWidth > 0));
      const els = await page.$$('.adv-stage .foe .portrait');
      for (let i = 0; i < els.length; i++) {
        await els[i].scrollIntoViewIfNeeded();
        shots[`${row}:${areas[ai]}:${i}`] = (await els[i].screenshot()).toString('base64');
      }
    }
  } else {
    await page.evaluate(() => { const T = window.__TE; T.app.screen = 'free'; T.render(); });
    await page.waitForTimeout(600);
    const els = await page.$$('.adv-stage .foe .portrait');
    await page.waitForFunction(() => [...document.querySelectorAll('.foe .pchar')].every(i => i.complete && i.naturalWidth > 0));
    for (let k = 0; k < els.length; k++) {
      await els[k].scrollIntoViewIfNeeded();
      shots[`${row}:${areas[Math.floor(k / 3)]}:${k % 3}`] = (await els[k].screenshot()).toString('base64');
    }
  }
}

const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await setup(pc);
await grab(pc, 'pc-adv', 'adventure');
await grab(pc, 'pc-free', 'free');
await pc.close();
const sp = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await setup(sp);
await grab(sp, 'sp-adv', 'adventure');
await grab(sp, 'sp-free', 'free');
await sp.close();

// 1枚に並べる（ブラウザで合成して書き出す）
const sheet = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
const rows = ['pc-adv', 'pc-free', 'sp-adv', 'sp-free'];
const FROM = Number(process.env.FROM_AREA || 1), TO = Number(process.env.TO_AREA || 8);
const H = Number(process.env.THUMB_H || 110);
const keys = [];
for (let a = FROM; a <= TO; a++) for (let i = 0; i < 3; i++) keys.push(`a${a}:${i}`);
const html = `<body style="margin:0;background:#222;font:12px sans-serif;color:#fff">
  <table style="border-collapse:collapse">${rows.map(r => `<tr><td style="padding:4px;writing-mode:vertical-rl">${r}</td>${
    keys.map(k => `<td style="padding:3px;vertical-align:top;text-align:center">${shots[`${r}:${k}`]
      ? `<img src="data:image/png;base64,${shots[`${r}:${k}`]}" style="height:${H}px;display:block">` : '—'}<div>${k}</div></td>`).join('')}</tr>`).join('')}
  </table></body>`;
await sheet.setContent(html);
await sheet.waitForTimeout(300);
const size = await sheet.evaluate(() => [document.body.scrollWidth, document.body.scrollHeight]);
await sheet.setViewportSize({ width: size[0], height: size[1] });
await sheet.screenshot({ path: OUT });
console.log('->', OUT, size);
await browser.close();
