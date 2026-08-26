// ============================================================
// 手続き的カードイラスト（SVG）
// viewBox="0 0 100 70" のシンプルなシルエット。属性でパレットが変わる。
// ============================================================
import { ART_MAP } from './art_map.js';

let ART_BASE = '';
export function setArtBase(v) { ART_BASE = v; }

const PALETTES = {
  fire:  { bg1: '#3a1206', bg2: '#7d2410', body: '#ff7a3c', body2: '#ffb46b', dark: '#5c1a08', accent: '#ffe08a' },
  water: { bg1: '#04203c', bg2: '#0c4a76', body: '#4fb6ff', body2: '#a7e2ff', dark: '#062a48', accent: '#d9f5ff' },
  grass: { bg1: '#0d2c14', bg2: '#1d5c2b', body: '#57c86e', body2: '#a8e6a0', dark: '#123a1a', accent: '#f2ffbe' },
  none:  { bg1: '#2a2418', bg2: '#5d5033', body: '#d8c188', body2: '#f2e6bd', dark: '#3a3120', accent: '#fff7de' },
};
PALETTES.water.dark = '#062a48';

const S = {
  // ---------------- モンスター ----------------
  lizard: p => `
    <ellipse cx="46" cy="46" rx="22" ry="12" fill="${p.body}"/>
    <path d="M68 46 q16 -2 24 -14 q-4 14 -20 20z" fill="${p.body2}"/>
    <circle cx="30" cy="38" r="11" fill="${p.body}"/>
    <circle cx="26" cy="35" r="2.4" fill="#1a1008"/>
    <path d="M24 27 l4 -8 l4 8z" fill="${p.accent}"/>
    <path d="M38 34 q8 -10 16 -2" stroke="${p.body2}" stroke-width="3" fill="none"/>
    <path d="M34 57 l-4 8 M52 57 l4 8" stroke="${p.dark}" stroke-width="4" stroke-linecap="round"/>`,
  bird: p => `
    <ellipse cx="50" cy="42" rx="17" ry="19" fill="${p.body}"/>
    <circle cx="50" cy="24" r="12" fill="${p.body2}"/>
    <path d="M40 22 l-10 -10 q12 -2 14 6z" fill="${p.accent}"/>
    <circle cx="46" cy="23" r="2.2" fill="#1a1008"/>
    <path d="M62 24 l10 4 l-10 4z" fill="${p.accent}"/>
    <path d="M64 40 q16 -6 20 6 q-14 4 -22 0z" fill="${p.body2}"/>
    <path d="M44 60 l-3 8 M56 60 l3 8" stroke="${p.accent}" stroke-width="3" stroke-linecap="round"/>`,
  beast: p => `
    <ellipse cx="52" cy="46" rx="24" ry="14" fill="${p.body}"/>
    <path d="M76 42 q14 4 18 -6 q0 14 -14 16z" fill="${p.body2}"/>
    <circle cx="30" cy="36" r="13" fill="${p.body2}"/>
    <path d="M20 26 l0 -11 l9 7z M40 26 l0 -11 l-9 7z" fill="${p.body}"/>
    <circle cx="26" cy="35" r="2.4" fill="#161008"/><circle cx="35" cy="35" r="2.4" fill="#161008"/>
    <path d="M26 42 q5 4 9 0" stroke="${p.dark}" stroke-width="2" fill="none"/>
    <path d="M38 58 l-2 9 M52 58 l0 9 M66 58 l2 9" stroke="${p.dark}" stroke-width="4" stroke-linecap="round"/>`,
  bat: p => `
    <ellipse cx="50" cy="40" rx="12" ry="14" fill="${p.body}"/>
    <path d="M38 32 q-22 -14 -30 2 q10 -2 12 8 q6 -8 18 2z" fill="${p.body2}"/>
    <path d="M62 32 q22 -14 30 2 q-10 -2 -12 8 q-6 -8 -18 2z" fill="${p.body2}"/>
    <path d="M42 26 l2 -9 l6 7z M58 26 l-2 -9 l-6 7z" fill="${p.body}"/>
    <circle cx="45" cy="36" r="2.2" fill="${p.accent}"/><circle cx="55" cy="36" r="2.2" fill="${p.accent}"/>
    <path d="M46 52 l4 8 l4 -8" fill="${p.dark}"/>`,
  humanoid: p => `
    <path d="M50 34 q-16 4 -18 20 l0 12 l36 0 l0 -12 q-2 -16 -18 -20z" fill="${p.body}"/>
    <path d="M32 40 q-10 12 -8 26 l10 0z" fill="${p.dark}"/>
    <circle cx="50" cy="22" r="11" fill="${p.body2}"/>
    <path d="M39 20 q4 -12 11 -12 q7 0 11 12 q-11 -5 -22 0z" fill="${p.dark}"/>
    <circle cx="45" cy="23" r="1.9" fill="#14100a"/><circle cx="55" cy="23" r="1.9" fill="#14100a"/>
    <path d="M74 8 l5 3 l-16 34 l-5 -3z" fill="${p.accent}"/>
    <path d="M56 44 l12 5 l-3 5 l-12 -5z" fill="${p.dark}"/>
    <path d="M32 44 q-8 8 -4 16" stroke="${p.body2}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  golem: p => `
    <path d="M32 24 l36 0 l6 20 l-6 22 l-36 0 l-6 -22z" fill="${p.body}"/>
    <path d="M40 12 l20 0 l5 10 l-5 8 l-20 0 l-5 -8z" fill="${p.body2}"/>
    <path d="M14 30 l12 -4 l4 24 l-12 4z" fill="${p.body}"/>
    <path d="M86 30 l-12 -4 l-4 24 l12 4z" fill="${p.body}"/>
    <circle cx="45" cy="21" r="3" fill="${p.accent}"/><circle cx="55" cy="21" r="3" fill="${p.accent}"/>
    <path d="M38 40 l10 6 l-6 8 M62 40 l-10 6 l6 8" stroke="${p.dark}" stroke-width="3" fill="none"/>
    <path d="M36 60 l28 0" stroke="${p.dark}" stroke-width="3"/>`,
  witch: p => `
    <path d="M50 6 l16 16 l-32 0z" fill="${p.dark}"/>
    <ellipse cx="50" cy="23" rx="22" ry="4" fill="${p.dark}"/>
    <circle cx="50" cy="34" r="10" fill="${p.body2}"/>
    <path d="M50 44 q-13 4 -13 22 l26 0 q0 -18 -13 -22z" fill="${p.body}"/>
    <circle cx="46" cy="33" r="1.8" fill="#1a1008"/><circle cx="54" cy="33" r="1.8" fill="#1a1008"/>
    <path d="M70 24 l0 34" stroke="${p.dark}" stroke-width="3"/>
    <circle cx="70" cy="22" r="5" fill="${p.accent}"/>`,
  oni: p => `
    <circle cx="50" cy="32" r="17" fill="${p.body}"/>
    <path d="M36 18 l-3 -12 l10 7z M64 18 l3 -12 l-10 7z" fill="${p.accent}"/>
    <path d="M50 49 q-16 3 -16 19 l32 0 q0 -16 -16 -19z" fill="${p.body2}"/>
    <circle cx="43" cy="30" r="3" fill="#2a0c04"/><circle cx="57" cy="30" r="3" fill="#2a0c04"/>
    <path d="M42 39 q8 6 16 0 l-4 4 l-8 0z" fill="#2a0c04"/>
    <path d="M22 44 l10 -8 M78 44 l-10 -8" stroke="${p.body}" stroke-width="5" stroke-linecap="round"/>`,
  dragon: p => `
    <path d="M50 44 q-20 -26 -44 -32 q4 20 14 26 q-8 0 -12 4 q14 12 38 10z" fill="${p.body2}"/>
    <path d="M50 44 q20 -26 44 -32 q-4 20 -14 26 q8 0 12 4 q-14 12 -38 10z" fill="${p.body2}"/>
    <ellipse cx="50" cy="50" rx="17" ry="14" fill="${p.body}"/>
    <path d="M64 50 q18 -2 26 -16 q4 18 -14 26z" fill="${p.body}"/>
    <ellipse cx="32" cy="40" rx="13" ry="11" fill="${p.body}"/>
    <path d="M20 40 l-12 3 l12 5z" fill="${p.accent}"/>
    <path d="M22 44 l6 2 l-1 4z" fill="#fff8e0"/>
    <circle cx="30" cy="36" r="2.8" fill="#2a0c04"/>
    <path d="M28 28 l2 -11 l6 10z M40 27 l6 -10 l2 10z" fill="${p.accent}"/>
    <path d="M42 62 l-4 8 M58 62 l4 8" stroke="${p.dark}" stroke-width="4" stroke-linecap="round"/>`,
  jelly: p => `
    <path d="M26 40 q0 -24 24 -24 q24 0 24 24z" fill="${p.body}" opacity="0.9"/>
    <path d="M28 40 q6 16 2 24 M40 41 q2 18 -2 24 M52 41 q0 18 4 24 M64 40 q-4 16 0 24"
      stroke="${p.body2}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="43" cy="31" r="2.4" fill="${p.dark}"/><circle cx="57" cy="31" r="2.4" fill="${p.dark}"/>
    <path d="M46 37 q4 4 8 0" stroke="${p.dark}" stroke-width="2" fill="none"/>`,
  fish: p => `
    <path d="M20 40 q22 -22 48 0 q-22 22 -48 0z" fill="${p.body}"/>
    <path d="M68 40 l20 -14 l0 28z" fill="${p.body2}"/>
    <path d="M40 24 l6 -12 l6 12z" fill="${p.body2}"/>
    <circle cx="33" cy="38" r="3" fill="#08202e"/>
    <path d="M44 40 q10 -8 20 0 q-10 8 -20 0z" fill="${p.body2}" opacity="0.7"/>
    <path d="M30 52 q10 8 20 2" stroke="${p.body2}" stroke-width="2.5" fill="none"/>`,
  serpent: p => `
    <path d="M14 60 q14 -18 30 -6 q16 12 26 -8 q8 -14 16 -6"
      stroke="${p.body}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M14 60 q14 -18 30 -6 q16 12 26 -8 q8 -14 16 -6"
      stroke="${p.body2}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.6"/>
    <circle cx="86" cy="40" r="10" fill="${p.body}"/>
    <circle cx="89" cy="37" r="2.4" fill="#08202e"/>
    <path d="M92 44 l8 3 l-8 2z" fill="${p.accent}"/>`,
  kraken: p => `
    <ellipse cx="50" cy="30" rx="19" ry="17" fill="${p.body}"/>
    <path d="M34 40 q-16 8 -22 24 M42 46 q-8 10 -10 22 M58 46 q8 10 10 22 M66 40 q16 8 22 24"
      stroke="${p.body}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M50 48 q0 12 0 20" stroke="${p.body2}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="43" cy="28" r="3.4" fill="${p.accent}"/><circle cx="57" cy="28" r="3.4" fill="${p.accent}"/>
    <circle cx="43" cy="28" r="1.4" fill="#04202e"/><circle cx="57" cy="28" r="1.4" fill="#04202e"/>`,
  plant: p => `
    <path d="M50 66 l0 -26" stroke="${p.dark}" stroke-width="6" stroke-linecap="round"/>
    <path d="M50 44 q-20 -4 -22 -20 q20 -2 22 12z" fill="${p.body}"/>
    <path d="M50 44 q20 -4 22 -20 q-20 -2 -22 12z" fill="${p.body2}"/>
    <circle cx="50" cy="30" r="12" fill="${p.body}"/>
    <circle cx="45" cy="28" r="2.2" fill="#0c2410"/><circle cx="55" cy="28" r="2.2" fill="#0c2410"/>
    <path d="M45 35 q5 4 10 0" stroke="#0c2410" stroke-width="2" fill="none"/>`,
  spirit: p => `
    <path d="M50 8 q22 12 22 32 q0 16 -22 24 q-22 -8 -22 -24 q0 -20 22 -32z" fill="${p.body}" opacity="0.9"/>
    <path d="M50 18 q13 8 13 22 q0 10 -13 15 q-13 -5 -13 -15 q0 -14 13 -22z" fill="${p.body2}" opacity="0.85"/>
    <circle cx="45" cy="34" r="2.6" fill="${p.dark}"/><circle cx="55" cy="34" r="2.6" fill="${p.dark}"/>
    <path d="M45 42 q5 4 10 0" stroke="${p.dark}" stroke-width="2" fill="none"/>
    <circle cx="20" cy="20" r="3.4" fill="${p.accent}"/><circle cx="82" cy="28" r="2.8" fill="${p.accent}"/>
    <circle cx="74" cy="10" r="2.2" fill="${p.accent}"/><circle cx="26" cy="52" r="2.4" fill="${p.accent}"/>`,
  treant: p => `
    <path d="M40 68 l3 -30 l14 0 l3 30z" fill="#6b4a24"/>
    <path d="M43 50 l-12 8 M57 50 l12 8" stroke="#6b4a24" stroke-width="6" stroke-linecap="round"/>
    <circle cx="50" cy="24" r="22" fill="${p.body}"/>
    <circle cx="28" cy="32" r="13" fill="${p.body2}"/>
    <circle cx="72" cy="32" r="13" fill="${p.body2}"/>
    <circle cx="50" cy="16" r="12" fill="${p.body2}" opacity="0.55"/>
    <ellipse cx="44" cy="44" rx="3" ry="4" fill="#1a1208"/><ellipse cx="56" cy="44" rx="3" ry="4" fill="#1a1208"/>
    <path d="M45 54 q5 4 10 0" stroke="#1a1208" stroke-width="2.4" fill="none"/>`,
  giant: p => `
    <path d="M30 30 l40 0 l6 34 l-52 0z" fill="${p.body}"/>
    <circle cx="50" cy="20" r="14" fill="${p.body2}"/>
    <path d="M36 12 q14 -10 28 0 q-14 -4 -28 0z" fill="${p.dark}"/>
    <path d="M8 34 q10 -6 18 2 l-4 26 q-12 2 -16 -6z" fill="${p.body}"/>
    <path d="M92 34 q-10 -6 -18 2 l4 26 q12 2 16 -6z" fill="${p.body}"/>
    <circle cx="44" cy="19" r="2.6" fill="#0a2010"/><circle cx="56" cy="19" r="2.6" fill="#0a2010"/>
    <path d="M42 28 q8 5 16 0" stroke="${p.dark}" stroke-width="3" fill="none"/>
    <path d="M34 42 l32 0 M34 52 l32 0" stroke="${p.dark}" stroke-width="2.5" opacity="0.6"/>`,


  // ---------------- サポート ----------------
  bolt: p => `<path d="M56 6 L30 40 l16 0 l-8 26 l30 -38 l-17 0z" fill="${p.accent}" stroke="${p.body}" stroke-width="3"/>`,
  sword: p => `
    <path d="M50 6 l7 12 l0 32 l-14 0 l0 -32z" fill="${p.body2}"/>
    <rect x="34" y="48" width="32" height="6" rx="3" fill="${p.dark}"/>
    <rect x="46" y="54" width="8" height="14" rx="3" fill="${p.body}"/>`,
  orb: p => `
    <circle cx="50" cy="36" r="20" fill="${p.body}"/>
    <circle cx="43" cy="29" r="7" fill="${p.body2}" opacity="0.8"/>
    <path d="M50 10 q-6 -8 -14 -8 M50 62 q10 6 18 4" stroke="${p.accent}" stroke-width="3" fill="none"/>`,
  banner: p => `
    <path d="M32 8 l0 58" stroke="${p.dark}" stroke-width="5" stroke-linecap="round"/>
    <path d="M34 10 l38 8 l-38 12z" fill="${p.body}"/>
    <path d="M34 32 l30 8 l-30 10z" fill="${p.body2}"/>`,
  meteor: p => `
    <circle cx="60" cy="42" r="16" fill="${p.body}"/>
    <circle cx="55" cy="37" r="5" fill="${p.dark}"/>
    <path d="M46 30 L12 4 M42 40 L6 26 M46 52 L14 50" stroke="${p.accent}" stroke-width="4" stroke-linecap="round"/>`,
  potion: p => `
    <path d="M42 10 l16 0 l0 12 l10 20 q4 22 -18 22 q-22 0 -18 -22 l10 -20z" fill="${p.body2}" opacity="0.9"/>
    <path d="M34 44 q16 -6 32 0 q4 18 -16 18 q-20 0 -16 -18z" fill="${p.body}"/>
    <rect x="40" y="6" width="20" height="7" rx="3" fill="${p.dark}"/>`,
  shield: p => `
    <path d="M50 6 l24 8 l0 24 q0 20 -24 28 q-24 -8 -24 -28 l0 -24z" fill="${p.body}"/>
    <path d="M50 16 l14 5 l0 17 q0 12 -14 18 q-14 -6 -14 -18 l0 -17z" fill="${p.body2}"/>`,
  scroll: p => `
    <rect x="24" y="14" width="52" height="42" rx="4" fill="${p.body2}"/>
    <rect x="20" y="10" width="60" height="8" rx="4" fill="${p.dark}"/>
    <rect x="20" y="52" width="60" height="8" rx="4" fill="${p.dark}"/>
    <path d="M34 28 l32 0 M34 38 l24 0" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>`,
  wave: p => `
    <path d="M6 46 q12 -14 24 0 q12 14 24 0 q12 -14 24 0 q12 14 16 4" stroke="${p.body}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M10 60 q12 -10 24 0 q12 10 24 0 q12 -10 24 0" stroke="${p.body2}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M62 26 q10 -18 24 -14 q-6 12 -8 20z" fill="${p.body2}"/>`,
  eye: p => `
    <path d="M12 36 q38 -32 76 0 q-38 32 -76 0z" fill="${p.body2}"/>
    <circle cx="50" cy="36" r="14" fill="${p.dark}"/>
    <circle cx="50" cy="36" r="7" fill="${p.accent}"/>
    <path d="M50 56 l0 10 M30 52 l-6 8 M70 52 l6 8" stroke="${p.body}" stroke-width="3" stroke-linecap="round"/>`,
  leaf: p => `
    <path d="M50 66 q-4 -20 0 -34" stroke="${p.dark}" stroke-width="4" stroke-linecap="round"/>
    <path d="M50 34 q-26 -6 -26 -28 q26 0 26 28z" fill="${p.body}"/>
    <path d="M50 34 q26 -6 26 -28 q-26 0 -26 28z" fill="${p.body2}"/>
    <circle cx="50" cy="8" r="4" fill="${p.accent}"/>`,
  armor: p => `
    <path d="M50 8 q22 4 24 14 q2 26 -24 42 q-26 -16 -24 -42 q2 -10 24 -14z" fill="${p.body}"/>
    <path d="M38 26 l24 0 l0 8 l-24 0z" fill="${p.body2}"/>
    <path d="M30 20 l-8 -8 M70 20 l8 -8" stroke="${p.accent}" stroke-width="4" stroke-linecap="round"/>`,
  ward: p => `
    <circle cx="50" cy="36" r="24" fill="none" stroke="${p.body}" stroke-width="6"/>
    <circle cx="50" cy="36" r="14" fill="none" stroke="${p.body2}" stroke-width="4"/>
    <path d="M50 4 l0 12 M50 56 l0 12 M18 36 l-12 0 M82 36 l12 0" stroke="${p.accent}" stroke-width="4" stroke-linecap="round"/>`,
  sprout: p => `
    <path d="M50 66 l0 -22" stroke="${p.dark}" stroke-width="5" stroke-linecap="round"/>
    <path d="M50 46 q-18 -2 -18 -16 q18 0 18 16z" fill="${p.body}"/>
    <path d="M50 40 q16 -4 16 -16 q-16 2 -16 16z" fill="${p.body2}"/>
    <ellipse cx="50" cy="66" rx="22" ry="5" fill="${p.dark}"/>`,
  fruit: p => `
    <circle cx="50" cy="42" r="20" fill="${p.body}"/>
    <path d="M50 22 l0 -12 q10 -2 12 -8 q-2 12 -12 14z" fill="${p.body2}"/>
    <circle cx="42" cy="36" r="6" fill="${p.body2}" opacity="0.7"/>`,
  book: p => `
    <path d="M18 16 q16 -6 32 2 l0 42 q-16 -8 -32 -2z" fill="${p.body}"/>
    <path d="M82 16 q-16 -6 -32 2 l0 42 q16 -8 32 -2z" fill="${p.body2}"/>
    <path d="M50 18 l0 42" stroke="${p.dark}" stroke-width="3"/>`,
  flagblue: p => `
    <path d="M30 8 l0 58" stroke="${p.dark}" stroke-width="5" stroke-linecap="round"/>
    <path d="M32 12 l36 10 l-36 12z" fill="#4fb6ff"/>
    <path d="M40 44 l24 0 l0 6 l-24 0z" fill="${p.body2}"/>`,
  flagred: p => `
    <path d="M30 8 l0 58" stroke="${p.dark}" stroke-width="5" stroke-linecap="round"/>
    <path d="M32 12 l36 10 l-36 12z" fill="#ff7a3c"/>
    <path d="M36 42 l14 14 l14 -14" stroke="${p.body2}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  skull: p => `
    <circle cx="50" cy="32" r="20" fill="${p.body2}"/>
    <rect x="40" y="48" width="20" height="12" rx="4" fill="${p.body2}"/>
    <circle cx="42" cy="30" r="6" fill="${p.dark}"/><circle cx="58" cy="30" r="6" fill="${p.dark}"/>
    <path d="M46 42 l8 0" stroke="${p.dark}" stroke-width="3"/>`,
  pit: p => `
    <ellipse cx="50" cy="46" rx="32" ry="14" fill="${p.dark}"/>
    <ellipse cx="50" cy="44" rx="24" ry="9" fill="#0a0806"/>
    <path d="M34 40 l4 -14 M50 38 l0 -16 M66 40 l-4 -14" stroke="${p.body2}" stroke-width="3" stroke-linecap="round"/>`,
  crystal: p => `
    <path d="M50 6 l18 22 l-18 38 l-18 -38z" fill="${p.body}"/>
    <path d="M50 6 l18 22 l-18 8z" fill="${p.body2}"/>
    <path d="M50 6 l-18 22 l18 8z" fill="${p.accent}" opacity="0.5"/>`,
  torch: p => `
    <rect x="46" y="34" width="8" height="32" rx="3" fill="${p.dark}"/>
    <path d="M50 4 q14 14 10 24 q-2 8 -10 8 q-8 0 -10 -8 q-4 -10 10 -24z" fill="${p.body}"/>
    <path d="M50 16 q6 8 4 14 q-1 4 -4 4 q-3 0 -4 -4 q-2 -6 4 -14z" fill="${p.accent}"/>`,
};

// ---- カードごとに絵を少しずつ変える（同アーキタイプの使い回しを避ける） ----
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.min(1, Math.max(0, s)); l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const f = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${f(t[0])}${f(t[1])}${f(t[2])}`;
}
function shiftPalette(p, v) {
  const dh = (v - 0.5) * 20, dl = (v - 0.5) * 0.09, ds = (v - 0.5) * 0.10;
  const sh = hex => { const [h, s, l] = hexToHsl(hex); return hslToHex(h + dh, s + ds, l + dl); };
  return { ...p, body: sh(p.body), body2: sh(p.body2), bg1: p.bg1, bg2: p.bg2, dark: sh(p.dark), accent: p.accent };
}

// 高コストのカードには"格"を足す小物
function regalia(c, p) {
  if (c.type !== 'monster') return '';
  if (c.cost >= 6) {
    return `<path d="M34 8 l6 8 l10 -11 l10 11 l6 -8 l-3 14 l-26 0z" fill="${p.accent}"
       stroke="rgba(0,0,0,.4)" stroke-width="1.2"/>`;
  }
  if (c.cost === 5) {
    return `<circle cx="16" cy="16" r="3" fill="${p.accent}" opacity=".85"/>
      <circle cx="86" cy="20" r="2.4" fill="${p.accent}" opacity=".7"/>
      <circle cx="76" cy="8" r="1.8" fill="${p.accent}" opacity=".6"/>`;
  }
  return '';
}

export function cardArtSvg(c) {
  // カードに img（画像パス/データURL）が指定されていればそれを使う。
  // 後から手描きイラストへ差し替えられるようにするためのフック。
  const src = c.img || ART_MAP[c.id];
  if (src) {
    return `<svg viewBox="0 0 118 100" preserveAspectRatio="xMidYMid slice" class="card-art-svg">
      <image href="${ART_BASE}${src}" x="0" y="0" width="118" height="100"
        preserveAspectRatio="xMidYMid slice"/>
    </svg>`;
  }
  const base = PALETTES[c.element] || PALETTES.none;
  const v = hash(c.id);
  const p = shiftPalette(base, v);
  const shape = S[c.art] || S.orb;
  const gid = `g_${c.id}`;
  const sc = 0.93 + v * 0.16;                 // 大きさの揺らぎ
  const dx = (hash(c.id + 'x') - 0.5) * 7;    // 位置の揺らぎ
  const rot = (hash(c.id + 'r') - 0.5) * 5;
  return `<svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" class="card-art-svg">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${p.bg2}"/><stop offset="100%" stop-color="${p.bg1}"/>
      </linearGradient>
      <linearGradient id="${gid}_l" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.26"/>
        <stop offset="55%" stop-color="#fff" stop-opacity="0.02"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.28"/>
      </linearGradient>
      <filter id="${gid}_s" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="1.6" stdDeviation="1.2" flood-color="#000" flood-opacity="0.55"/>
      </filter>
    </defs>
    <rect width="100" height="70" fill="url(#${gid})"/>
    <circle cx="80" cy="12" r="18" fill="${p.body2}" opacity="0.12"/>
    <circle cx="14" cy="60" r="14" fill="${p.body}" opacity="0.1"/>
    <g filter="url(#${gid}_s)" stroke="rgba(0,0,0,0.42)" stroke-width="1.5" paint-order="stroke"
       transform="translate(${(50 + dx).toFixed(1)} 36) rotate(${rot.toFixed(1)}) scale(${sc.toFixed(3)}) translate(-50 -36)">
      ${shape(p)}
      ${regalia(c, p)}
    </g>
    <rect width="100" height="70" fill="url(#${gid}_l)"/>
  </svg>`;
}

export const ELEMENT_PALETTE = PALETTES;
