// ============================================================
// 絵文字の代わりに使う、専用に描いたアイコン。
//   仮置きだった 🔥⚔️🛡️ などを、統一感のある宝石調のアイコンに
//   置き換える。呼び出す側は絵文字を直接書かず、ここを通す。
// ============================================================
import { withBase } from './base_url.js';

const ICON = {
  fire: '/assets/ui/icons/fire_icon.webp',
  water: '/assets/ui/icons/water_icon.webp',
  grass: '/assets/ui/icons/grass_icon.webp',
  none: '/assets/ui/icons/none_icon.webp',
  atk: '/assets/ui/icons/atk_icon.webp',
  def: '/assets/ui/icons/def_icon.webp',
  stardust: '/assets/ui/icons/stardust_icon.webp',
  adventure: '/assets/ui/icons/icon_adventure.webp',
  freebattle: '/assets/ui/icons/icon_freebattle.webp',
  deck: '/assets/ui/icons/icon_deck.webp',
  collection: '/assets/ui/icons/icon_collection.webp',
  shop: '/assets/ui/icons/icon_shop.webp',
  rules: '/assets/ui/icons/icon_rules.webp',
  settings: '/assets/ui/icons/icon_settings.webp',
  forge: '/assets/ui/icons/icon_forge.webp',
  modeswitch: '/assets/ui/icons/icon_modeswitch.webp',
  surrender: '/assets/ui/icons/icon_surrender.webp',
  info: '/assets/ui/icons/icon_info.webp',
  lock: '/assets/ui/icons/icon_lock.webp',
  home: '/assets/ui/icons/icon_home.webp',
};

const PACK_ICON = {
  set1: '/assets/ui/packs/pack_set1.webp',
  set2: '/assets/ui/packs/pack_set2.webp',
  set3: '/assets/ui/packs/pack_set3.webp',
  set4: '/assets/ui/packs/pack_set4.webp',
  prism: '/assets/ui/packs/pack_prism.webp',
};

/** key が無ければ絵文字のまま返す（未着手の箇所を壊さないための保険） */
export function icon(key, cls = '') {
  const src = ICON[key];
  if (!src) return '';
  return `<img class="gi ${cls}" src="${withBase(src)}" alt="">`;
}

export function packIcon(set, cls = '') {
  const src = PACK_ICON[set];
  if (!src) return '';
  return `<img class="gi ${cls}" src="${withBase(src)}" alt="">`;
}
