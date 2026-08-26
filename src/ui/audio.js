// ============================================================
// BGM / 効果音
//
//   assets/audio/ に決まったファイル名で置くだけで鳴ります。
//     bgm_menu   … タイトル・デッキ編集・カード図鑑・ルール説明
//     bgm_map    … 冒険（エリア画面）
//     bgm_battle … 戦闘画面
//     se_win     … 勝利
//     se_lose    … 敗北
//   拡張子は .mp3 / .ogg / .m4a / .wav のどれでも可（この順に探します）。
//   例: assets/audio/bgm_battle.mp3
// ============================================================

const EXTS = ['mp3', 'ogg', 'm4a', 'wav'];
const BGM_KEYS = ['bgm_menu', 'bgm_map', 'bgm_battle'];
const SE_KEYS = ['se_win', 'se_lose'];

const state = {
  found: {},            // key -> url | null（見つからなければ null）
  current: null,        // 再生中の BGM キー
  el: null,             // 再生中の Audio
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
  const from = el.volume, t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
    if (k < 1) requestAnimationFrame(step); else done && done();
  };
  requestAnimationFrame(step);
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

  const a = new Audio(url);
  a.loop = true;
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

export async function playSe(key) {
  const url = await locate(key);
  if (!url || state.muted) return;
  const a = new Audio(url);
  a.volume = state.seVol;
  a.play().catch(() => { /* 鳴らせなくても進行に影響なし */ });
}

// 最初のユーザー操作で自動再生の制限を解除する
function unlock() {
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
  ['bgm_battle', '戦闘画面'],
  ['se_win', '勝利SE'],
  ['se_lose', '敗北SE'],
];
