// YouTube のサムネ（1280x720・2MB未満のJPG）: node tools/yt_thumb_shot.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const html = pathToFileURL(path.resolve('tools/cover.html')).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
for (const lang of ['ja', 'en']) {
  await page.goto(`${html}?lang=${lang}&wide=1&yt=1`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: `release/store/${lang}/00-youtube-thumb.jpg`, type: 'jpeg', quality: 90 });
  console.log('->', lang);
}
await browser.close();
