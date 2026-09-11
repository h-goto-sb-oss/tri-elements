// itch.io のカバー画像を撮る: node tools/cover_shot.mjs
//   -> release/store/{ja,en}/00-cover-chars.png（1260x1000）
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const html = pathToFileURL(path.resolve('tools/cover.html')).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 2 });
for (const lang of ['ja', 'en']) {
  await page.goto(`${html}?lang=${lang}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: `release/store/${lang}/00-cover-chars.png` });
  console.log('->', lang);
}
await browser.close();
