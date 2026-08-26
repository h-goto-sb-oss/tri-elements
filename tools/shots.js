// Playwright でアプリのスクリーンショットを撮る
//   node tools/shots.js [出力ディレクトリ]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'shots';
const URL = process.env.TE_URL || 'http://localhost:5180';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const shot = async (name, ms = 260) => {
  await page.waitForTimeout(ms);
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p });
  console.log('  ->', p);
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// 初回の名前入力を済ませる
if (await page.$('[data-obstart]')) {
  await page.fill('[data-obname]', 'テスター');
  await page.click('[data-obstart]');
  await page.waitForTimeout(300);
}

console.log('screenshots:');
await shot('01-title');

await page.click('[data-go="adventure"]');
await shot('02-adventure');

await page.click('[data-go="title"]');
await page.click('[data-go="deck"]');
await shot('03-deck');

await page.click('[data-go="title"]');
await page.click('[data-go="collection"]');
await shot('04-collection');

await page.click('[data-go="title"]');
await page.click('[data-go="audio"]');
await shot('05-audio');

// --- 戦闘: マリガン → 開始演出 → 盤面 ---
await page.click('[data-go="title"]');
await page.click('[data-go="adventure"]');
await page.click('[data-fight="0:0"]');
await shot('06-mulligan', 500);
await page.click('[data-mulligan="keep"]');
await shot('07-battlestart', 400);
await page.click('[data-startbattle]');
await shot('08-battle-early', 600);

// デモ盤面
await page.evaluate(() => window.__TE.makeDemo(1, 2));
await shot('09-battle', 500);

// 手札から場へドラッグ → モード選択ポップアップ
await page.evaluate(() => {
  const g = window.__TE.app.game;
  g.players[0].field[2] = null; g.players[0].cost = 6; g.players[0].maxCost = 6;
  window.__TE.render();
});
const hidx = await page.evaluate(() => {
  const g = window.__TE.app.game;
  return g.players[0].hand.findIndex(id => window.__TE.card(id).type === 'monster');
});
if (hidx >= 0) {
  const a = await (await page.$(`[data-hand="${hidx}"]`)).boundingBox();
  const b = await (await page.$('[data-mslot="2"]')).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y - 20, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await shot('09b-drag');
  await page.mouse.up();
  await shot('09c-modepick', 320);
  const pk = await page.$('[data-summon="attack"]');
  if (pk) await pk.click();
  await page.waitForTimeout(250);
}

// 自分のモンスターをクリック → 操作メニュー
await page.click('.mini[data-side="0"][data-slot="0"]');
await shot('10-own-menu', 300);

// 攻撃対象の選択
const atk = await page.$('[data-act="attack"]');
if (atk) { await atk.click(); await shot('11-attack-target', 300); }

// 墓地を見る
await page.evaluate(() => { window.__TE.app.sel = null; window.__TE.render(); });
const grave = await page.$('[data-grave="0"]');
if (grave) { await grave.click(); await shot('12-graveyard', 300); await page.click('[data-closegrave]'); }

// カード詳細
await page.click('.mini[data-side="1"][data-slot="1"]');
await shot('13-detail', 300);

await browser.close();
if (errors.length) { console.log('\n[ページエラー]'); errors.slice(0, 10).forEach(e => console.log('  ', e)); }
else console.log('\nページエラーなし');
