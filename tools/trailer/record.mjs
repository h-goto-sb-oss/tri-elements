// ============================================================
// 紹介動画の録画（映像のコマ＋鳴った音の記録）
//   node tools/trailer/record.mjs ja|en
//   → release/trailer/<lang>/frames/*.jpg, frames.json, audio.json
// 仕上げ（音を重ねて mp4 にする）は tools/trailer/build.py
//
// ・vite の dev サーバー（localhost:5180）を録る。dev では匿名データを送らない
// ・乱数を固定するので、日本語版と英語版で同じ試合になる
// ・音はヘッドレスでは録れないので、Audio 要素の play/pause と音量を時刻つきで記録し、
//   あとから元のファイルを同じ時刻に重ねる
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const LANG = process.argv[2] === 'en' ? 'en' : 'ja';
const URL = process.env.TE_URL || 'http://localhost:5180';
const OUT = path.resolve('release/trailer', LANG);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const T = (ja, en) => (LANG === 'en' ? en : ja);
const cover = fs.readFileSync(path.resolve('release/store', LANG, '00-cover-wide.jpg')).toString('base64');

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });

await ctx.addInitScript(({ lang }) => {
  // 乱数を固定（mulberry32）
  let s = 20260912 >>> 0;
  Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try {
    if (!localStorage.getItem('trailer-init')) {
      localStorage.clear();
      localStorage.setItem('trailer-init', '1');
      localStorage.setItem('tri-elements-lang', lang);
      localStorage.setItem('tri-elements-audio', JSON.stringify({ bgmVol: 0.45, seVol: 0.7, muted: false }));
    }
  } catch { /* 無視 */ }
  // 鳴った音を記録する
  const log = window.__audioLog = [];
  let nid = 0;
  const now = () => performance.timeOrigin + performance.now();
  const P = HTMLMediaElement.prototype;
  const play = P.play, pause = P.pause;
  P.play = function () {
    if (!this.__id) this.__id = ++nid;
    log.push({ ev: 'play', t: now(), id: this.__id, src: this.src, loop: this.loop, vol: this.volume });
    return play.call(this);
  };
  P.pause = function () {
    if (this.__id) log.push({ ev: 'pause', t: now(), id: this.__id });
    return pause.call(this);
  };
  const playing = new Set();
  document.addEventListener('play', e => playing.add(e.target), true);
  document.addEventListener('pause', e => playing.delete(e.target), true);
  document.addEventListener('ended', e => { playing.delete(e.target); if (e.target.__id) log.push({ ev: 'ended', t: now(), id: e.target.__id }); }, true);
  // Audio() で作った要素は DOM に無いので play イベントを拾えない。ここで直接見張る
  const all = new Set();
  const origPlay2 = P.play;
  P.play = function () { all.add(this); return origPlay2.call(this); };
  setInterval(() => {
    for (const a of all) if (!a.paused && !a.ended) log.push({ ev: 'vol', t: now(), id: a.__id, vol: a.volume });
  }, 50);
}, { lang: LANG });

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__TE && window.__TE.app);

// 見栄えのするセーブ：全カード所持・序盤エリア突破・パックあり
await page.evaluate(() => {
  const T = window.__TE, s = T.app.save;
  s.profile = { name: document.documentElement.lang === 'en' ? 'Hiro' : 'ヒロ', avatar: 1 };
  T.ALL_CARDS.forEach(c => { s.collection[c.id] = c.hidden ? 0 : 3; });
  ['a1', 'a2', 'a3', 'a4'].forEach(a => [0, 1, 2].forEach(i => { s.cleared[`${a}:${i}`] = true; }));
  s.stats = { wins: 42, losses: 17 };
  s.packs = { set2: 1 };
  T.render();
});
await page.waitForTimeout(800);

// ---- 字幕と締めの画面（録画用に DOM を足す）----
await page.evaluate((cover) => {
  const st = document.createElement('style');
  st.textContent = `
  #cap{position:fixed;left:50%;bottom:7%;transform:translate(-50%,12px);z-index:99999;pointer-events:none;
    font:900 34px/1.35 "Zen Maru Gothic","Hiragino Sans","Yu Gothic",sans-serif;color:#fff6dc;text-align:center;white-space:nowrap;
    padding:12px 30px;border-radius:14px;background:linear-gradient(#140f0add,#140f0af0);border:2px solid #e6c070;
    box-shadow:0 8px 30px #000c;opacity:0;transition:opacity .45s,transform .45s;letter-spacing:.04em}
  #cap.on{opacity:1;transform:translate(-50%,0)}
  #cap small{display:block;font-size:20px;font-weight:700;color:#e6c070;letter-spacing:.06em}
  #endcard{position:fixed;inset:0;z-index:99998;opacity:0;transition:opacity .8s;background:#000 center/cover no-repeat}
  #endcard.on{opacity:1}
  #endcard .box{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);text-align:center;white-space:nowrap;
    font:900 38px/1.3 "Zen Maru Gothic","Hiragino Sans","Yu Gothic",sans-serif;color:#fff6dc;
    padding:16px 40px;border-radius:16px;background:#140f0ae6;border:2px solid #e6c070;box-shadow:0 10px 40px #000d}
  #endcard .box small{display:block;font:700 26px/1.4 system-ui,sans-serif;color:#e6c070;letter-spacing:.03em;margin-top:4px}`;
  document.head.appendChild(st);
  const cap = document.createElement('div'); cap.id = 'cap'; document.body.appendChild(cap);
  const end = document.createElement('div'); end.id = 'endcard';
  end.style.backgroundImage = `url(data:image/jpeg;base64,${cover})`;
  document.body.appendChild(end);
  window.__cap = (main, sub) => {
    if (!main) { cap.classList.remove('on'); return; }
    cap.innerHTML = main + (sub ? `<small>${sub}</small>` : '');
    cap.classList.add('on');
  };
  window.__end = (main, sub) => { end.innerHTML = `<div class="box">${main}<small>${sub}</small></div>`; end.classList.add('on'); };
}, cover);

// 録る前に、マップの顔の絵と戦闘の背景を一度読み込ませておく（録画中に遅れて出ないように）
await page.evaluate(() => { const T = window.__TE; T.app.areaIndex = 3; T.app.screen = 'adventure'; T.render(); });
await page.waitForFunction(() => [...document.querySelectorAll('img')].every(i => i.complete));
await page.waitForTimeout(800);
await page.evaluate(() => { const i = new Image(); i.src = getComputedStyle(document.body).getPropertyValue('--bgimg'); });

// ---- 録画開始（CDP の screencast。変化があったときだけコマが来る）----
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async f => {
  const n = frames.length;
  const file = `${String(n).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(OUT, 'frames', file), Buffer.from(f.data, 'base64'));
  frames.push({ file, t: f.metadata.timestamp * 1000 });
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* 終了間際 */ }
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
const t0 = await page.evaluate(() => performance.timeOrigin + performance.now());
const wait = ms => page.waitForTimeout(ms);
const cap = (a, b) => page.evaluate(([a, b]) => window.__cap(a, b), [a, b]);
const click = sel => page.evaluate(sel => document.querySelector(sel)?.click(), sel);

// 1) タイトル
await page.evaluate(() => { const T = window.__TE; T.app.screen = 'title'; T.render(); });
await wait(900);
await cap(T('ブラウザで遊べる、無料のカードバトル', 'A free card battle game — right in your browser'), T('PC でも スマホでも', 'On PC or phone'));
await wait(3300);
await cap(null); await wait(400);

// 2) 冒険のマップ（古代の森。このあと戦うライバルが並んでいる）
await page.evaluate(() => { window.__TE.app.areaIndex = 3; });
await click('[data-go="adventure"]');
await wait(700);
await cap(T('8つのエリア、24人のライバル', '8 lands. 24 rivals.'), T('それぞれ違うデッキと戦い方', 'Each with their own deck and style'));
await wait(3000);
await cap(null); await wait(300);

// 3) バトル：「戦う」→ 開始画面 → 中盤の盤面から、自分の番もAIに打たせる
await click('[data-fight="3:1"]');
await wait(600);
await page.evaluate(() => {
  const T = window.__TE; T.doMulligan(false);
  const g = T.app.game;
  const mk = (id, mode, uid) => { const c = T.card(id); return { uid, id, atk: c.atk, def: c.def, mode, attacks: 0, tempAtk: 0, tempDef: 0, hasAttacked: false, modeChanged: false, grants: [], equips: [] }; };
  g.turn = 9; g.active = 0;
  const me = g.players[0], op = g.players[1];
  me.life = 13; op.life = 15; me.maxCost = 6; me.cost = 6; op.maxCost = 6; op.cost = 0;
  op.field = [mk('g05', 'defense', 901), mk('x_g3', 'attack', 902), null];
  me.field = [mk('f05', 'attack', 911), null, mk('w05', 'defense', 913)];
  me.hand = ['f09', 'x_f5', 'sf2', 'w08', 'g07'];
  T.app.playLog = [];
  T.render();
});
await wait(1500);
await click('[data-startbattle]');
await wait(900);
await cap(T('炎は草に、草は水に、水は炎に強い', 'Fire beats Grass. Grass beats Water. Water beats Fire.'), T('有利な属性で攻めると 攻撃力+2', 'Strike with the advantage for +2 ATK'));

// 自分の番をAIで進める（相手の番はゲーム自身のAIが動く）
await page.evaluate(async () => {
  const { aiChooseAction } = await import('/src/engine/ai.js');
  const T = window.__TE;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.__playMine = async (maxSteps = 12) => {
    for (let i = 0; i < maxSteps; i++) {
      const g = T.app.game;
      if (!g || g.winner !== null || g.active !== 0) return;
      const act = aiChooseAction(g, 0, { noise: 0, profile: 'aggro' });
      if (!act) { T.applyAction(g, 0, { type: 'end' }); T.afterAction(); return; }
      await T.actWithFx(0, act);
      T.afterAction();
      await sleep(act.type === 'attack' ? 450 : 700);
    }
  };
});
const state = () => page.evaluate(() => { const g = window.__TE.app.game; return g ? { a: g.active, w: g.winner } : { a: -1, w: 0 }; });
const myTurn = () => page.evaluate(() => window.__playMine());
const waitMine = async () => {          // 相手の番が終わるか、決着するまで待つ
  for (let i = 0; i < 80; i++) { const s = await state(); if (s.w !== null || s.a === 0) return; await wait(250); }
};
await myTurn();
await cap(null);
let s = await state();
if (s.w === null) {
  await wait(500);
  await cap(T('攻めるか、守るか。', 'Attack — or hold the line.'), T('勝てない相手は、横に倒して受け止める', 'Turn sideways to absorb what you can’t beat'));
  await waitMine();
  await cap(null);
}
for (let k = 0; k < 5; k++) {
  s = await state();
  if (s.w !== null) break;
  // 長引いたら締める（動画の尺のため）
  if (k === 2) await page.evaluate(() => { const g = window.__TE.app.game; g.players[1].life = Math.min(g.players[1].life, 3); window.__TE.render(); });
  await myTurn();
  await waitMine();
}
await wait(2800);   // 勝敗の画面

// 4) マップへ戻って、パック開封
await click('[data-go="adventure"]');
await wait(900);
await click('[data-openpack]');
await wait(500);
await cap(T('カードを集めて、自分だけのデッキを', 'Collect cards. Build your own deck.'), T('全158種＋隠しカード', '158 cards + hidden character cards'));
await wait(3800);
await cap(null);
await wait(300);

// 5) 締め
await page.evaluate(([a, b]) => window.__end(a, b), [T('ブラウザで今すぐ無料', 'Play free in your browser'), 'chicken-ball.itch.io/tri-elements']);
await wait(4500);

await cdp.send('Page.stopScreencast');
const t1 = await page.evaluate(() => performance.timeOrigin + performance.now());
const audio = await page.evaluate(() => window.__audioLog);
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify({ t0, t1, frames }));
fs.writeFileSync(path.join(OUT, 'audio.json'), JSON.stringify(audio));
console.log(`${LANG}: ${frames.length} frames, ${((t1 - t0) / 1000).toFixed(1)}s, ${audio.filter(a => a.ev === 'play').length} sounds, errors: ${errors.length ? errors : 'none'}`);
await browser.close();
