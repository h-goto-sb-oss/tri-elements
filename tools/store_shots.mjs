// ============================================================
// 配布ページ（itch.io など）用のスクリーンショットを撮る
//   node tools/store_shots.mjs            … 英語・日本語の両方
//   TE_URL で撮影先を変えられる（既定: http://localhost:5180）
//   出力: release/store/<lang>/*.png
// ============================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.TE_URL || 'http://localhost:5180';
const LANGS = (process.argv[2] || 'en,ja').split(',');

/** 言語を決めて開き、見栄えのするセーブ（全カード所持・序盤エリア突破）にする */
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
    T.render();
  });
  await page.waitForTimeout(300);
}

/** 見せ場の盤面を作る（中盤、互いに3体並んでいる） */
async function battleBoard(page) {
  await page.evaluate(() => {
    const T = window.__TE;
    T.startBattle(3, 2, false);
    T.doMulligan(false);
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__TE.beginPlay());
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const T = window.__TE, g = T.app.game;
    clearTimeout(T.app.aiTimer);
    const mk = (id, mode, uid, extra = {}) => {
      const c = T.card(id);
      return { uid, id, atk: c.atk, def: c.def, mode, attacks: 0, tempAtk: 0, tempDef: 0,
        hasAttacked: false, modeChanged: false, grants: [], ...extra };
    };
    g.turn = 9; g.active = 0; g.phase = 'main';
    const me = g.players[0], op = g.players[1];
    me.life = 14; op.life = 11; me.maxCost = 5; me.cost = 5; op.maxCost = 5; op.cost = 0;
    op.field = [mk('g05', 'defense', 901), mk('c_verda', 'defense', 902), mk('x_g3', 'attack', 903)];
    me.field = [mk('f05', 'attack', 911), mk('b_f3', 'attack', 912), mk('w05', 'defense', 913)];
    me.supports = [{ uid: 931, id: 'sf2', attachedTo: 911, slot: 0 }, null, null];
    me.field[0].atk += 3;
    op.supports = [{ uid: 941, id: 'sg2', attachedTo: 902, slot: 0 }, null, null];
    op.field[1].atk += 1; op.field[1].def += 3;
    me.hand = ['x_sf2', 'f09', 'b_sf2', 'x_f5', 'sw3'];
    me.grave = ['f01', 'f03', 'sf1']; op.grave = ['g01', 'g03'];
    T.app.sel = { kind: 'attack', slot: 1 };
    T.app.playLog = [];
    T.render();
  });
  await page.waitForTimeout(400);
}

const browser = await chromium.launch();
for (const lang of LANGS) {
  const OUT = path.join('release', 'store', lang);
  fs.mkdirSync(OUT, { recursive: true });
  const shot = async (page, name) => {
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    console.log('  ->', p);
  };

  // ---- PC（横長） ----
  const pc = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const errors = [];
  pc.on('pageerror', e => errors.push(String(e)));
  await prepare(pc, lang);
  await shot(pc, '01-title');
  await battleBoard(pc);
  await shot(pc, '02-battle');
  await pc.evaluate(() => { const T = window.__TE; T.app.sel = null; T.app.detail = 'c_verda'; T.render(); });
  await pc.waitForTimeout(300);
  await shot(pc, '03-card-detail');
  await pc.evaluate(() => { const T = window.__TE; T.app.detail = null; T.app.game = null; T.app.screen = 'adventure'; T.app.areaIndex = 3; T.render(); });
  await pc.waitForTimeout(500);
  await shot(pc, '04-adventure');
  await pc.evaluate(() => { const T = window.__TE; T.app.screen = 'deck'; T.app.deckDraft = [...T.app.save.deck]; T.render(); });
  await pc.waitForTimeout(500);
  await shot(pc, '05-deck');
  await pc.evaluate(() => { const T = window.__TE; T.app.screen = 'collection'; T.app.collectionSet = 4; T.render(); });
  await pc.waitForTimeout(600);
  await shot(pc, '06-collection');
  await pc.close();

  // ---- スマホ（縦長） ----
  const sp = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  sp.on('pageerror', e => errors.push(String(e)));
  await prepare(sp, lang);
  await shot(sp, '07-mobile-title');
  await battleBoard(sp);
  await shot(sp, '08-mobile-battle');
  await sp.close();

  // ---- itch.io のカバー画像（630x500） ----
  const cv = await browser.newPage({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 2 });
  await prepare(cv, lang);
  await cv.evaluate(async () => {
    // メニューは消して、ロゴの下に三属性の切り札を1枚ずつ並べる
    const { cardHtml } = await import('/src/ui/cardview.js');
    const T = window.__TE;
    document.querySelector('.title-panel')?.remove();
    document.querySelector('.bottomnav')?.remove();
    const scr = document.querySelector('.title-screen');
    scr.style.justifyContent = 'center';
    scr.style.gap = '10px';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:14px;justify-content:center;position:relative;z-index:1;margin-top:2px';
    row.innerHTML = ['f10', 'w10', 'g10'].map(id => cardHtml(T.card(id), {})).join('');
    scr.appendChild(row);
  });
  await cv.waitForTimeout(700);
  await shot(cv, '00-cover');
  await cv.close();

  if (errors.length) console.log('  errors:', errors);
}
await browser.close();
