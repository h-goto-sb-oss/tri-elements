// Devlog・SNS 用の横長カバー（1280x720）: node tools/cover_wide_shot.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const html = pathToFileURL(path.resolve('tools/cover.html')).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
for (const lang of ['en', 'ja']) {
  await page.goto(`${html}?lang=${lang}&wide=1`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: `release/store/${lang}/00-cover-wide.png` });
  console.log('->', lang);
}
await browser.close();
