// ============================================================
// BGM / 効果音
//
//   assets/audio/ に決まったファイル名で置くだけで鳴ります。
//     bgm_menu   … タイトル・デッキ編集・カード図鑑・ルール説明
//     bgm_map    … 冒険（エリア画面）
//     bgm_battle … 戦闘画面（前半エリア・フリーバトル）
//     bgm_battle_late … 戦闘画面（黄昏の回廊より先）
//     bgm_draft  … 選定の儀（画面と対戦）
//     se_win     … 勝利
//     se_lose    … 敗北
//   拡張子は .wav / .mp3 / .ogg / .m4a のどれでも可（この順に探します）。
//   例: assets/audio/bgm_battle.mp3
// ============================================================

const EXTS = ['wav', 'mp3', 'ogg', 'm4a'];
const BGM_KEYS = ['bgm_menu', 'bgm_map', 'bgm_battle', 'bgm_battle_late', 'bgm_draft'];

// ループの位置（秒）。ここにある曲は Web Audio で鳴らし、終わりの点まで来たら
// 始まりの点へサンプル単位で飛ぶ（<audio loop> だと曲の頭へ戻るうえ、MP3 は継ぎ目に隙間が出る）。
// 頭（イントロ）は最初の1回だけ流れる。位置とファイルは tools/bgm_loop.py が作る。
const BGM_LOOPS = {
  bgm_battle: [59.3038, 135.2437],        // The Last Gambit
  bgm_battle_late: [82.1522, 151.9704],   // The Archivist's Gambit
  bgm_draft: [18.9939, 163.0090],         // The Rite of the Final Draw
};
const SE_KEYS = [
  'se_click', 'se_confirm', 'se_error', 'se_draw', 'se_summon', 'se_support', 'se_equip',
  'se_attack', 'se_direct', 'se_hit', 'se_destroy', 'se_heal', 'se_buff',
  'se_mode', 'se_forge', 'se_turn', 'se_battle', 'se_pack', 'se_reveal',
  'se_rare', 'se_win', 'se_lose',
  'se_back', 'se_guard', 'se_effect',
];

const state = {
  found: {},            // key -> url | null（見つからなければ null）
  current: null,        // 再生中の BGM キー
  el: null,             // 再生中の BGM（Audio 要素か、Web Audio の声。どちらも volume / play / pause を持つ）
  bgmVol: 0.45,
  seVol: 0.7,
  muted: false,
  unlocked: false,      // ブラウザの自動再生制限を解除できたか
  pending: null,
};

// ---- 保存 ----
const KEY = 'tri-elements-audio';
try {
  const s = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (typeof s.bgmVol === 'number') state.bgmVol = s.bgmVol;
  if (typeof s.seVol === 'number') state.seVol = s.seVol;
  if (typeof s.muted === 'boolean') state.muted = s.muted;
} catch { /* 既定値のまま */ }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ bgmVol: state.bgmVol, seVol: state.seVol, muted: state.muted })); }
  catch { /* 保存できなくても動作に影響なし */ }
}

// ---- ファイル探索 ----
function probe(url) {
  return new Promise(resolve => {
    const a = new Audio();
    a.preload = 'metadata';
    const ok = () => { cleanup(); resolve(true); };
    const ng = () => { cleanup(); resolve(false); };
    const cleanup = () => {
      a.removeEventListener('loadedmetadata', ok);
      a.removeEventListener('error', ng);
      a.src = '';
    };
    a.addEventListener('loadedmetadata', ok);
    a.addEventListener('error', ng);
    a.src = url;
  });
}

async function locate(key) {
  if (key in state.found) return state.found[key];
  for (const ext of EXTS) {
    const url = `assets/audio/${key}.${ext}`;
    if (await probe(url)) { state.found[key] = url; return url; }
  }
  state.found[key] = null;
  return null;
}

export async function scanAudio() {
  await Promise.all([...BGM_KEYS, ...SE_KEYS].map(locate));
  return { ...state.found };
}

// ---- 再生 ----
function applyVolume() {
  if (state.el) state.el.volume = state.muted ? 0 : state.bgmVol;
}

function fadeTo(el, target, ms, done) {
  // 0msで呼ばれると (now - t0) / 0 が NaN になり、volume に入れた時点で例外になる
  if (!(ms > 0)) { el.volume = Math.max(0, Math.min(1, target)); if (done) done(); return; }
  const from = el.volume, t0 = performance.now();
  const step = now => {
    // rAF の時刻は呼び出し時刻より少し前のことがあるので、負にならないようにする
    const k = Math.max(0, Math.min(1, (now - t0) / ms));
    el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
    if (k < 1) requestAnimationFrame(step); else done && done();
  };
  requestAnimationFrame(step);
}

// ---- ループ位置のある曲：Web Audio ----
let ctx = null;
function audioCtx() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  try { ctx = C ? new C() : null; } catch { ctx = null; }
  return ctx;
}
// デコードした曲は大きい（3分でおよそ60MB）ので、覚えておくのは直近の2曲まで
const buffers = new Map();   // key -> Promise<AudioBuffer>
function loadBuffer(key, url) {
  if (buffers.has(key)) { const p = buffers.get(key); buffers.delete(key); buffers.set(key, p); return p; }
  const c = audioCtx();
  const p = fetch(url).then(r => r.arrayBuffer())
    .then(ab => new Promise((ok, ng) => c.decodeAudioData(ab, ok, ng)));
  buffers.set(key, p);
  while (buffers.size > 2) buffers.delete(buffers.keys().next().value);
  p.catch(() => buffers.delete(key));
  return p;
}
/** 次に鳴らしそうな曲を先に読んでおく（戦闘に入ったとき無音の間ができないように） */
export async function prefetchBgm(key) {
  if (!BGM_LOOPS[key] || !audioCtx()) return;
  const url = await locate(key);
  if (url) loadBuffer(key, url).catch(() => { /* 鳴らすときに <audio> で鳴らす */ });
}

/**
 * Audio 要素と同じ形（volume / play / pause / src）で扱える Web Audio の声。
 * fadeTo・ducking などの既存の処理をそのまま使えるようにする。
 */
function loopVoice(buffer, [loopStart, loopEnd]) {
  const c = audioCtx();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(c.destination);
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.loopStart = loopStart;
  src.loopEnd = Math.min(loopEnd, buffer.duration);
  src.connect(gain);
  let started = false, vol = 0;
  return {
    get volume() { return vol; },
    set volume(v) { vol = v; gain.gain.setValueAtTime(v, c.currentTime); },
    async play() {
      if (!started) { src.start(); started = true; }
      if (c.state !== 'running') await c.resume();
      if (c.state !== 'running') throw new Error('suspended');
    },
    pause() { try { src.stop(); } catch { /* 止まっている */ } src.disconnect(); gain.disconnect(); },
    set src(_) { /* <audio> と同じ書き方で止められるように */ },
  };
}

/** 場面に応じた BGM を鳴らす。同じ曲なら鳴らし直さない。 */
export async function playBgm(key) {
  if (state.current === key) return;
  state.pending = key;
  const url = await locate(key);
  if (state.pending !== key) return;          // 途中で場面が変わった
  state.current = key;

  const old = state.el;
  if (old) fadeTo(old, 0, 380, () => { old.pause(); old.src = ''; });
  state.el = null;
  if (!url) return;                            // ファイルが無ければ無音のまま

  let a = null;
  if (BGM_LOOPS[key] && audioCtx()) {
    try {
      const buf = await loadBuffer(key, url);
      if (state.pending !== key) return;        // 読み込み中に場面が変わった
      a = loopVoice(buf, BGM_LOOPS[key]);
    } catch { a = null; /* デコードできなければ <audio> で鳴らす */ }
  }
  if (!a) { a = new Audio(url); a.loop = true; }
  a.volume = 0;
  state.el = a;
  try {
    await a.play();
    state.unlocked = true;
    fadeTo(a, state.muted ? 0 : state.bgmVol, 500);
  } catch {
    // 自動再生がブロックされた場合は、最初のクリックで鳴らす
    state.unlocked = false;
  }
}

export function stopBgm() {
  state.pending = null;
  state.current = null;
  if (state.el) { const el = state.el; fadeTo(el, 0, 250, () => { el.pause(); el.src = ''; }); state.el = null; }
}

/**
 * BGMを止めずに、音量だけ一時的に下げる／戻す。
 *
 *   勝敗の効果音は演出として長め（十数〜三十秒）に作られていて、
 *   その間ずっと戦闘BGMが同じ音量で鳴り続けると、2つの曲が
 *   混ざったまま終わらないように聞こえてしまう。曲を止めたり
 *   切り替えたりはせず、音量だけ下げて効果音を聞かせやすくする。
 */
export function duckBgm(factor, ms = 300) {
  if (state.el) fadeTo(state.el, (state.muted ? 0 : state.bgmVol) * factor, ms);
}
export function unduckBgm(ms = 500) {
  if (state.el) fadeTo(state.el, state.muted ? 0 : state.bgmVol, ms);
}

let seNodes = [];
const lastPlayed = {};
export async function playSe(key, opts = {}) {
  if (state.muted) return;
  const now = performance.now();
  const gap = opts.gap ?? 60;                 // 同じ音の連打を間引く
  if (lastPlayed[key] && now - lastPlayed[key] < gap) return;
  lastPlayed[key] = now;
  const url = await locate(key);
  if (!url || state.muted) return;
  const a = new Audio(url);
  a.volume = state.seVol;
  seNodes.push(a);
  a.addEventListener('ended', () => { seNodes = seNodes.filter(x => x !== a); });
  // 長い効果音（勝敗など）は、鳴っているあいだBGMを下げて、鳴り終わったら戻す。
  // 再生に失敗した場合や、いつまでも ended が来ない場合でも下げっぱなしに
  // ならないよう、保険のタイムアウトも仕込んでおく。
  if (opts.duckBgm) {
    duckBgm(opts.duckBgm, 300);
    let restored = false;
    const restore = () => { if (restored) return; restored = true; unduckBgm(600); };
    a.addEventListener('ended', restore);
    a.addEventListener('error', restore);
    setTimeout(restore, 40000);
    a.play().catch(restore);
    return;
  }
  a.play().catch(() => { /* 鳴らせなくても進行に影響なし */ });
}

/** 鳴っている効果音を止める（画面を離れたときなど） */
export function stopSe() {
  seNodes.forEach(a => { try { a.pause(); a.currentTime = 0; } catch { /* 無視 */ } });
  seNodes = [];
}

// 最初のユーザー操作で自動再生の制限を解除する
function unlock() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { /* 次の操作で */ });
  if (state.unlocked) return;
  if (state.el) {
    state.el.play().then(() => {
      state.unlocked = true;
      fadeTo(state.el, state.muted ? 0 : state.bgmVol, 400);
    }).catch(() => { /* まだ解除できていない */ });
  } else if (state.current) {
    const k = state.current; state.current = null; playBgm(k);
  }
}
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));

// ---- 設定 ----
export const audioState = state;
export function setMuted(v) { state.muted = !!v; applyVolume(); save(); }
export function setBgmVolume(v) { state.bgmVol = Math.max(0, Math.min(1, v)); applyVolume(); save(); }
export function setSeVolume(v) { state.seVol = Math.max(0, Math.min(1, v)); save(); }
export const AUDIO_FILES = [
  ['bgm_menu', 'タイトル・デッキ編集・カード図鑑・ルール説明'],
  ['bgm_map', '冒険（エリア画面）'],
  ['bgm_battle', '戦闘画面（前半エリア）'],
  ['bgm_battle_late', '戦闘画面（黄昏の回廊より先）'],
  ['bgm_draft', '選定の儀（画面と対戦）'],
  ['se_click', 'カード・タブを選ぶ'],
  ['se_confirm', '決定・開始・保存'],
  ['se_error', '使えない操作'],
  ['se_draw', 'カードを引く'],
  ['se_summon', 'モンスターを召喚'],
  ['se_support', 'サポートを使う'],
  ['se_equip', '装備をつける'],
  ['se_attack', 'モンスターへの攻撃'],
  ['se_direct', '直接攻撃'],
  ['se_hit', 'ライフにダメージ'],
  ['se_destroy', 'モンスターが破壊される'],
  ['se_heal', 'ライフ回復'],
  ['se_buff', 'モンスターの強化'],
  ['se_mode', '攻撃／防御モードの切り替え'],
  ['se_forge', '鍛錬'],
  ['se_turn', 'ターン開始'],
  ['se_battle', 'バトル開始'],
  ['se_pack', 'パックを開ける'],
  ['se_reveal', 'カードがめくれる'],
  ['se_rare', 'レア以上が出た'],
  ['se_win', '勝利'],
  ['se_lose', '敗北'],
  ['se_back', '戻る・画面を閉じる'],
  ['se_guard', '防御モードが攻撃を耐えた'],
  ['se_effect', 'カード効果の発動・属性有利'],
];
