// ============================================================
// Playwright でアプリのスクリーンショットを撮る
//   node tools/shots.js [出力ディレクトリ]
// dev サーバー(5180)が起動している前提。
// ============================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'shots';
const URL = process.env.TE_URL || 'http://localhost:5180';
fs.mkdirSync(OUT, { recursive: true });

const shots = [];
async function shot(page, name, opts = {}) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: !!opts.full });
  shots.push(p);
  console.log('  ->', p);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

console.log('screenshots:');
await shot(page, '01-title');

await page.click('[data-go="campaign"]');
await page.waitForTimeout(200);
await shot(page, '02-campaign');

await page.click('[data-go="title"]');
await page.click('[data-go="deck"]');
await page.waitForTimeout(200);
await shot(page, '03-deck');

await page.click('[data-go="title"]');
await page.click('[data-go="collection"]');
await page.waitForTimeout(300);
await shot(page, '04-collection', { full: true });

await page.click('[data-go="title"]');
await page.click('[data-go="rules"]');
await page.waitForTimeout(150);
await shot(page, '05-rules');

// --- 戦闘（デモ盤面） ---
await page.click('[data-go="title"]');
await page.evaluate(() => window.__TE.makeDemo(1, 2));
await page.waitForTimeout(400);
await shot(page, '06-battle');

// 攻撃対象の選択中
await page.click('.mini[data-side="0"][data-slot="0"]');
await page.waitForTimeout(250);
await shot(page, '07-attack-target');

// 実際に攻撃してログを出す
await page.click('.mini[data-side="1"][data-slot="1"]');
await page.waitForTimeout(450);
await shot(page, '08-after-attack');

// 召喚モード選択
await page.click('.card[data-hand="2"]');
await page.waitForTimeout(250);
await shot(page, '09-summon-mode');

await browser.close();
if (errors.length) { console.log('\n[ページエラー]'); errors.slice(0, 10).forEach(e => console.log('  ', e)); }
else console.log('\nページエラーなし');
