// 通し動作確認: マリガン → 戦闘（ドラッグ＆ドロップ含む）→ 勝敗 → パック → デッキ編集
import { chromium } from 'playwright';

const URL = 'http://localhost:5180';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const drag = async (from, to) => {
  const fa = await page.$(from), fb = await page.$(to);
  if (!fa || !fb) return false;
  const a = await fa.boundingBox(), b = await fb.boundingBox();
  if (!a || !b) return false;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 - 20, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(240);
  return true;
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// --- 戦闘開始 ---
await page.click('[data-go="adventure"]');
await page.click('[data-fight="0:0"]');
await page.waitForTimeout(400);
console.log('マリガン画面:', (await page.$('[data-mulligan]')) ? 'OK' : 'NG');
await page.click('[data-mulligan="keep"]');
await page.waitForTimeout(300);
console.log('開始演出:', (await page.$('[data-startbattle]')) ? 'OK' : 'NG');
await page.click('[data-startbattle]');
await page.waitForTimeout(500);

// --- 手札 → 場へドラッグして召喚 ---
let summoned = false;
// コストが貯まるまでターンを進める
for (let k = 0; k < 3; k++) {
  const idx0 = await page.evaluate(() => {
    const g = window.__TE.app.game;
    return g.players[0].hand.findIndex(id => window.__TE.card(id).type === 'monster'
      && window.__TE.card(id).cost <= g.players[0].cost);
  });
  if (idx0 >= 0) break;
  await page.click('[data-endturn]').catch(() => {});
  await page.waitForTimeout(2400);
}
for (let attempt = 0; attempt < 4 && !summoned; attempt++) {
  const before = await page.evaluate(() => window.__TE.app.game.players[0].field.filter(Boolean).length);
  const idx = await page.evaluate(() => {
    const g = window.__TE.app.game;
    return g.players[0].hand.findIndex((id, i) => window.__TE.card(id).type === 'monster'
      && window.__TE.card(id).cost <= g.players[0].cost);
  });
  if (idx >= 0) {
    await drag(`[data-hand="${idx}"]`, '[data-mslot="0"]');
    const pick = await page.$('[data-summon="attack"]');
    if (attempt === 0) console.log('モード選択ポップアップ:', pick ? 'OK' : 'NG');
    if (pick) await pick.click();
    await page.waitForTimeout(300);
  }
  const after = await page.evaluate(() => window.__TE.app.game.players[0].field.filter(Boolean).length);
  summoned = after > before;
  if (!summoned) {
    await page.click('[data-endturn]').catch(() => {});
    await page.waitForTimeout(2200);
  }
}
console.log('ドラッグ召喚:', summoned ? 'OK' : 'NG');
await page.screenshot({ path: 'shots/e2e-drag-summon.png' });

// --- 鍛錬ボタン ---
const forge = await page.$('[data-forge]:not([disabled])');
if (forge) {
  const h0 = await page.evaluate(() => window.__TE.app.game.players[0].hand.length);
  await forge.click(); await page.waitForTimeout(250);
  const h1 = await page.evaluate(() => window.__TE.app.game.players[0].hand.length);
  console.log('鍛錬:', h1 > h0 ? 'OK（1枚引けた）' : 'NG');
} else console.log('鍛錬: この時点では使えない（コスト不足）');

// --- 決着まで自動で進める ---
const result = await page.evaluate(async () => {
  const { app, applyAction, afterAction } = window.__TE;
  const ai = await import('/src/engine/ai.js');
  let guard = 0;
  while (app.game.winner === null && guard++ < 900) {
    const g = app.game;
    if (g.active !== 0) { await new Promise(r => setTimeout(r, 40)); continue; }
    if (g.phase === 'discard') { applyAction(g, 0, { type: 'discard', hand: 0 }); afterAction(); continue; }
    const act = ai.aiChooseAction(g, 0, {});
    applyAction(g, 0, act || { type: 'end' });
    afterAction();
    await new Promise(r => setTimeout(r, 8));
  }
  return { winner: app.game.winner, turn: app.game.turn, reason: app.game.reason };
});
console.log('対戦結果:', JSON.stringify(result));
await page.waitForTimeout(700);
const res = await page.$('.overlay .modal h2');
console.log('結果モーダル:', res ? (await res.textContent()).trim() : 'NG');
await page.screenshot({ path: 'shots/e2e-result.png' });

// --- パック開封 ---
await page.click('.overlay [data-go="adventure"]');
await page.waitForTimeout(300);
const packBtn = await page.$('[data-openpack]');
if (packBtn) {
  await packBtn.click(); await page.waitForTimeout(900);
  const got = await page.$$eval('.overlay .card', els => els.map(e => ({
    name: e.querySelector('.cname').textContent.trim(),
    rarity: ([...e.classList].find(c => c.startsWith('r-')) || 'r-?').slice(2),
  })));
  console.log('パック:', got.map(g => `${g.name}(${g.rarity})`).join(' / '));
  await page.screenshot({ path: 'shots/e2e-pack.png' });
  await page.click('[data-closepack]');
} else console.log('パック: ボタンなし');

// --- デッキ編集のドラッグ ---
await page.click('[data-go="deck"]');
await page.waitForTimeout(400);
const n0 = await page.evaluate(() => window.__TE.app.deckDraft.length);
await drag('.dcard', '.pool');
const n1 = await page.evaluate(() => window.__TE.app.deckDraft.length);
console.log('デッキから外すドラッグ:', n1 < n0 ? `OK (${n0}→${n1})` : `NG (${n0}→${n1})`);
const sel = await page.evaluate(() => {
  const e = document.querySelector('.poolcard:not(.full)');
  return e ? `[data-poolcard="${e.dataset.poolcard}"]` : null;
});
if (sel) await drag(sel, '.decklist');
const n2 = await page.evaluate(() => window.__TE.app.deckDraft.length);
console.log('デッキへ入れるドラッグ:', n2 > n1 ? `OK (${n1}→${n2})` : `NG (${n1}→${n2})`);
await page.screenshot({ path: 'shots/e2e-deck.png' });

await browser.close();
console.log(errors.length ? 'エラー:\n  ' + errors.slice(0, 8).join('\n  ') : 'エラーなし');
