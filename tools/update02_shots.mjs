// ============================================================
// アップデート第2弾「選定の儀」の発表用スクリーンショット
//   node tools/update02_shots.mjs        … 英語・日本語の両方
//   出力: release/store/update02/<lang>/01〜05.png（1920×1080）
//   発表文は release/update_02_選定の儀.md
// ============================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.TE_URL || 'http://localhost:5180';
const LANGS = (process.argv[2] || 'en,ja').split(',');

async function prepare(page, lang) {
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(lang => {
    localStorage.clear();
    localStorage.setItem('tri-elements-lang', lang);
    localStorage.setItem('tri-elements-audio', JSON.stringify({ bgmVol: 0, seVol: 0, muted: true }));
  }, lang);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__TE && window.__TE.app);
  await page.evaluate(() => {
    const T = window.__TE, s = T.app.save;
    s.profile = { name: document.documentElement.lang === 'en' ? 'Hiro' : 'ヒロ', avatar: 1 };
    T.ALL_CARDS.forEach(c => { s.collection[c.id] = c.hidden ? 0 : 3; });
    ['a1', 'a2', 'a3', 'a4'].forEach(a => [0, 1, 2].forEach(i => { s.cleared[`${a}:${i}`] = true; }));
    s.stats = { wins: 42, losses: 17 }; s.stardust = 23;
    // 限定カード：シエナは入手済み、ほかは途中
    s.collection.r_shiena = 1;
    s.draftStats = { runs: 4, best: 4, wins: 10, pw: { 'fire,water': 5, 'water,grass': 3, 'grass,fire': 2 } };
    T.render();
  });
  await page.waitForTimeout(300);
}

const click = (page, sel) => page.evaluate(sel => { const el = document.querySelector(sel); if (el) el.click(); return !!el; }, sel);

for (const lang of LANGS) {
  const dir = path.join('release', 'store', 'update02', lang);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const shot = async name => { await page.waitForTimeout(800); await page.screenshot({ path: path.join(dir, name) }); console.log('  ', lang, name); };

  await prepare(page, lang);
  await shot('01-title.png');

  // 03：限定カードの一覧（最初の画面を限定カードの見出しまで送る）
  await click(page, '[data-go="draft"]');
  await page.evaluate(() => { const h = document.querySelector('.dr-rite'); const sc = document.querySelector('.adventure.draft'); if (h && sc) sc.scrollTop = h.offsetTop - 70; });
  await shot('03-rite-cards.png');

  // 02：2組から1組を選ぶ画面（5回選んだところ）
  await page.evaluate(() => { const sc = document.querySelector('.adventure.draft'); if (sc) sc.scrollTop = 0; });
  await click(page, '[data-draftpair="grass,fire"]');
  for (let i = 0; i < 5; i++) { await click(page, `[data-draftpick="${i % 2}"]`); await page.waitForTimeout(40); }
  await shot('02-pick.png');

  // 04：限定カードを入手した瞬間（草×炎であと1勝 → カグラ）
  await page.evaluate(() => { const s = window.__TE.app.save; s.draftStats.pw['grass,fire'] = 4; });
  for (let i = 0; i < 10; i++) { await click(page, `[data-draftpick="${i % 2}"]`); await page.waitForTimeout(40); }
  await click(page, '[data-draftfight]'); await page.waitForTimeout(400);
  await page.evaluate(() => { window.__TE.doMulligan(false); window.__TE.beginPlay(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const T = window.__TE; const g = T.app.game; g.winner = 0; g.reason = document.documentElement.lang === 'en' ? 'Your opponent’s Life reached 0' : '相手のライフが0になった'; T.afterAction(); });
  await shot('04-get.png');

  // 05：大祭司の一枚絵（拡大表示）
  await page.evaluate(() => { const T = window.__TE; T.app.result = null; T.app.save.collection.r_elsion = 1; T.app.screen = 'collection'; T.app.collectionSet = 10; T.app.artZoom = 'r_elsion'; T.render(); });
  await shot('05-art.png');

  await browser.close();
}
