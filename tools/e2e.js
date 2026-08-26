// 通し動作確認: 対戦を最後までプレイし、パック開封とデッキ編集も触る
import { chromium } from 'playwright';

const URL = 'http://localhost:5180';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

// --- 1戦目: エリア1の1人目と戦って自動プレイ ---
await page.click('[data-go="campaign"]');
await page.click('[data-fight="0:0"]');
await page.waitForTimeout(600);

const result = await page.evaluate(async () => {
  const { app } = window.__TE;
  const eng = await import('/src/engine/game.js');
  const ai = await import('/src/engine/ai.js');
  let guard = 0;
  while (app.game.winner === null && guard++ < 600) {
    const g = app.game;
    if (g.active !== 0) { await new Promise(r => setTimeout(r, 60)); continue; }
    if (g.phase === 'discard') { eng.applyAction(g, 0, { type: 'discard', hand: 0 }); window.__TE.render(); continue; }
    const act = ai.aiChooseAction(g, 0, {});
    // UI 本来の経路（afterAction）を通す = AIターンの起動もUI側に任せる
    window.__TE.applyAction(g, 0, act || { type: 'end' });
    window.__TE.afterAction();
    await new Promise(r => setTimeout(r, 30));
  }
  return { winner: app.game.winner, turn: app.game.turn, reason: app.game.reason, guard };
});
console.log('対戦結果:', JSON.stringify(result));
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/e2e-result.png' });

const overlay = await page.$('.overlay .modal h2');
console.log('結果モーダル:', overlay ? await overlay.textContent() : '出ていない');

// --- パック開封 ---
await page.click('.overlay [data-go="campaign"]');
await page.waitForTimeout(200);
const packBtn = await page.$('[data-openpack]');
if (packBtn) {
  await packBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/e2e-pack.png' });
  const got = await page.$$eval('.overlay .card .cname', els => els.map(e => e.textContent.trim()));
  console.log('パックの中身:', got.join(' / ') || '(なし)');
  await page.click('[data-closepack]');
} else console.log('パックボタンなし（勝てなかった可能性）');

// --- デッキ編集 ---
await page.click('[data-go="title"]');
await page.click('[data-go="deck"]');
await page.waitForTimeout(300);
const deckCount = await page.$eval('h3', el => el.textContent);
console.log('デッキ画面:', deckCount.trim());
await page.screenshot({ path: 'shots/e2e-deck.png' });

await browser.close();
console.log(errors.length ? 'エラー:\n  ' + errors.slice(0, 8).join('\n  ') : 'エラーなし');
