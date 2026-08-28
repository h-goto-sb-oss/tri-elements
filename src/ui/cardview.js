// ============================================================
// カード描画の共通部品（手札・図鑑・デッキ編集・盤面で共用）
// ============================================================
import { ELEMENTS, KEYWORDS, card } from '../engine/cards.js';
import { RARITY } from '../engine/rarity.js';
import { cardArtSvg } from './art.js';
import { effAtk, effDef, hasKw, maxAttacks } from '../engine/game.js';

export const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 手札・一覧用の縦カード */
export function cardHtml(c, opts = {}) {
  const sup = c.type === 'support';
  const cls = ['card', c.element, `r-${c.rarity || 'common'}`,
    sup ? 'is-support' : 'is-monster', opts.cls || ''].join(' ');
  // 【双属】【三属】はキーワード欄と同じ場所に出す
  const multi = c.elements && c.elements.length > 1
    ? [c.elements.length >= 3 ? '三属' : '双属'] : [];
  const kwNames = [...multi, ...(c.keywords || []).map(k => KEYWORDS[k].name)];
  const kw = kwNames.length ? `<div class="kw">${kwNames.join('/')}</div>` : '';
  // モンスターは ⚔/🛡、サポートは種別の帯。下辺を見るだけで区別できる。
  const stats = sup
    ? `<div class="stats suptype">${c.equip ? '🔗 装備' : '✦ サポート'}</div>`
    : `<div class="stats"><span class="atk">⚔${c.atk}</span><span class="def">🛡${c.def}</span></div>`;
  const r = RARITY[c.rarity || 'common'];
  return `<div class="${cls}" ${opts.attr || ''} data-card="${c.id}">
    <div class="shine"></div>
    <div class="cost">${c.cost}</div>
    <div class="cname">${esc(c.name)}</div>
    <div class="art" ${opts.artAttr || ''}>${cardArtSvg(c)}<div class="elem">${
      (c.elements || [c.element]).map(e => ELEMENTS[e].icon).join('')}</div></div>
    ${kw}
    <div class="rarity" style="color:${r.color};border-color:${r.color}66">${r.short}</div>
    <div class="body">${esc(c.text || c.flavor)}</div>
    ${stats}
  </div>`;
}

/**
 * 盤面のモンスター。
 * 攻撃モードは縦置き、防御モードは横置き（枠だけ回し、絵は起こしたまま）。
 */
export function monsterHtml(m, side, slot, opts = {}) {
  const c = card(m.id);
  const def = m.mode === 'defense';
  const cls = ['mini', c.element, `r-${c.rarity || 'common'}`,
    def ? 'defense' : 'attackmode',
    // 【連撃】は2回殴れるので、1回目のあとはまだ動ける。
    // 攻撃回数を使い切ったときだけ沈める。
    opts.cls || '', (m.attacks || 0) >= maxAttacks(m) && side === 0 ? 'exhausted' : ''].join(' ');
  const buffed = (m.atk + m.tempAtk) > c.atk || (m.def + m.tempDef) > c.def;
  return `<div class="${cls}" data-side="${side}" data-slot="${slot}" data-card="${c.id}">
    <div class="inner">
      <div class="mart">${cardArtSvg(c)}</div>
      <div class="mname">${esc(c.name)}</div>
      ${hasKw(m, 'guard') ? '<div class="gmark">守護</div>' : ''}
      ${hasKw(m, 'pierce') ? '<div class="gmark pierce">貫通</div>' : ''}
      ${hasKw(m, 'double') ? '<div class="gmark dbl">連撃</div>' : ''}
      ${(m.stunnedUntil || -1) >= 0 ? '<div class="gmark stunned">停止</div>' : ''}
      <div class="mstat ${buffed ? 'buffed' : ''}">
        <span class="atk">⚔${effAtk(m)}</span><span class="def">🛡${effDef(m)}</span>
      </div>
    </div>
    <div class="modetag">${def ? '守' : '攻'}</div>
  </div>`;
}

/** サポートゾーンの札 */
export function supportHtml(s) {
  const c = card(s.id);
  return `<div class="sup ${c.element} r-${c.rarity || 'common'}" data-card="${c.id}">
    <div class="sart">${cardArtSvg(c)}</div>
    <div class="sname">${esc(c.name)}</div>
  </div>`;
}

/** クリックしたときに出す詳細パネル */
export function detailHtml(c, extra = '', opts = {}) {
  const r = RARITY[c.rarity || 'common'];
  const zoomable = Boolean(opts.zoomable);
  const kw = c.keywords?.length
    ? `<div class="d-kw">${c.keywords.map(k =>
        `<b>【${KEYWORDS[k].name}】</b>${esc(KEYWORDS[k].desc)}`).join('<br>')}</div>` : '';
  return `<div class="detail">
    ${cardHtml(c, {
      cls: `big ${zoomable ? 'zoomable' : ''}`,
      artAttr: zoomable
        ? `data-artzoom="${esc(c.id)}" role="button" tabindex="0" aria-label="${esc(c.name)}のイラストを拡大"`
        : '',
    })}
    <div class="d-body">
      <div class="d-name">${esc(c.name)}</div>
      <div class="d-meta">
        <span>${ELEMENTS[c.element].icon} ${ELEMENTS[c.element].name}</span>
        <span>コスト ${c.cost}</span>
        ${c.type === 'monster' ? `<span class="atk">⚔ ${c.atk}</span><span class="def">🛡 ${c.def}</span>` : '<span>サポート</span>'}
        <span style="color:${r.color}">${r.name}</span>
        <span>第${c.set || 1}弾</span>
      </div>
      <div class="d-text">${esc(c.text || 'このカードに効果はありません（バニラ）。')}</div>
      ${kw}
      <div class="d-flavor">${esc(c.flavor)}</div>
      ${extra}
    </div>
  </div>`;
}
