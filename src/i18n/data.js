// ============================================================
// カード名・効果文・エリア名などのデータを、選んだ言語に差し替える。
//   呼び出し側は今までどおり card(id).name などを読むだけでよい。
//   日本語の原文は最初に _ja へ控えておき、戻すときはそこから書き戻す。
// ============================================================
import { ALL_CARDS, KEYWORDS, ELEMENTS } from '../engine/cards.js';
import { RARITY } from '../engine/rarity.js';
import { AREAS, PACK_TYPES, FREE_DIFFICULTY, AVATARS } from '../game/campaign.js';
import { EN_CARDS } from './en_cards.js';
import {
  EN_ELEMENTS, EN_KEYWORDS, EN_RARITY, EN_AREAS, EN_ENEMIES, EN_PACKS, EN_DIFFICULTY, EN_AVATARS,
} from './en_game.js';
import { onLangChange, lang } from './lang.js';

/** obj の fields を、en が与えられれば英語に、無ければ日本語の原文に戻す */
function swap(obj, fields, en) {
  if (!obj._ja) obj._ja = Object.fromEntries(fields.map(f => [f, obj[f]]));
  fields.forEach((f, i) => {
    const v = en ? en[i] : null;
    obj[f] = v != null ? v : obj._ja[f];
  });
}

export function applyDataLang(l) {
  const en = l === 'en';
  ALL_CARDS.forEach(c => swap(c, ['name', 'text', 'flavor'], en && EN_CARDS[c.id]));
  Object.entries(KEYWORDS).forEach(([k, v]) => swap(v, ['name', 'desc'], en && EN_KEYWORDS[k]));
  Object.entries(ELEMENTS).forEach(([k, v]) => swap(v, ['name'], en && [EN_ELEMENTS[k]]));
  Object.entries(RARITY).forEach(([k, v]) => swap(v, ['name'], en && [EN_RARITY[k]]));
  AREAS.forEach(a => {
    swap(a, ['name', 'desc'], en && EN_AREAS[a.id]);
    a.enemies.forEach((e, i) => swap(e, ['name', 'desc'], en && EN_ENEMIES[a.id]?.[i]));
  });
  Object.entries(PACK_TYPES).forEach(([k, v]) => swap(v, ['name'], en && [EN_PACKS[k]]));
  Object.entries(FREE_DIFFICULTY).forEach(([k, v]) => swap(v, ['name'], en && [EN_DIFFICULTY[k]]));
  AVATARS.forEach(a => swap(a, ['name'], en && [EN_AVATARS[a.id]]));
}

onLangChange(applyDataLang);
if (lang() !== 'ja') applyDataLang(lang());
