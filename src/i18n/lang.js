// ============================================================
// 表示言語（日本語 / English）
//   文言は呼び出し側で L('日本語', 'English') と並べて書く。
//   カード名・効果文などのデータは i18n/data.js が差し替える。
//   エンジン（シミュレーション）からも使うので DOM には触れない。
// ============================================================
const KEY = 'tri-elements-lang';
let current = 'ja';
const listeners = [];

export function lang() { return current; }

/** 今の言語のほうを返す */
export function L(ja, en) { return current === 'en' && en != null ? en : ja; }

/** キーワード名を囲む（日本語は【守護】、英語は [Guard]） */
export function kwb(name) { return current === 'en' ? `[${name}]` : `【${name}】`; }

/** 一度でも選んだことがあれば、その言語（無ければ null＝初回） */
export function storedLang() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ja' || v === 'en' ? v : null;
  } catch { return null; }
}

/** 端末の言語から初期値を推測する */
export function guessLang() {
  try { return /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en'; } catch { return 'ja'; }
}

export function setLang(l, persist = true) {
  current = l === 'en' ? 'en' : 'ja';
  if (persist) { try { localStorage.setItem(KEY, current); } catch { /* 保存できなくても動く */ } }
  listeners.forEach(f => f(current));
}

export function onLangChange(f) { listeners.push(f); }
