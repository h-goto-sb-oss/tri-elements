// ============================================================
// カード描画の共通部品（手札・図鑑・デッキ編集・盤面で共用）
// ============================================================
import { ELEMENTS, KEYWORDS, card } from '../engine/cards.js';
import { RARITY } from '../engine/rarity.js';
import { cardArtSvg } from './art.js';
import { effAtk, effDef, hasKw, maxAttacks } from '../engine/game.js';
import { icon } from './icons.js';
import { L, kwb } from '../i18n/lang.js';

export const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 英語のカード名は日本語より横に長く、狭い名前欄では折り返して絵やバッジに
// かぶってしまう。長い名前だけ文字を小さくして2行までに収める。
// （日本語の名前は今の見た目で調整済みなので触らない）
const JA_CHAR = /[\u3000-\u9fff\uff00-\uffef]/;
function nameHtml(name) {
  const n = esc(name);
  if (JA_CHAR.test(name)) return n;
  const cls = name.length > 22 ? 'nl2' : name.length > 15 ? 'nl1' : '';
  return cls ? `<span class="nm ${cls}">${n}</span>` : n;
}
/** カード下部の効果文。英語は長くなりがちなので、長さに応じて文字を縮める */
function bodyHtml(text) {
  const t = esc(text);
  if (!text || JA_CHAR.test(text)) return t;
  const n = text.length;
  const cls = n > 120 ? 'bl3' : n > 85 ? 'bl2' : n > 55 ? 'bl1' : '';
  return cls ? `<span class="${cls}">${t}</span>` : t;
}

/** 手札・一覧用の縦カード */
export function cardHtml(c, opts = {}) {
  const sup = c.type === 'support';
  const cls = ['card', c.element, `r-${c.rarity || 'common'}`,
    sup ? 'is-support' : 'is-monster', c.set === 10 ? 'rite' : '', opts.cls || ''].join(' ');
  // 【双属】【三属】はキーワード欄と同じ場所に出す
  const multi = c.elements && c.elements.length > 1
    ? [c.elements.length >= 3 ? KEYWORDS.tri.name : KEYWORDS.dual.name] : [];
  const kwNames = [...multi, ...(c.keywords || []).map(k => KEYWORDS[k].name)];
  const kw = kwNames.length ? `<div class="kw">${kwNames.join('/')}</div>` : '';
  // モンスターは ⚔/🛡、サポートは種別の帯。下辺を見るだけで区別できる。
  const stats = sup
    ? `<div class="stats suptype">${c.equip ? L('🔗 装備', '🔗 Equip') : L('✦ サポート', '✦ Support')}</div>`
    : `<div class="stats"><span class="atk">${icon('atk')}${c.atk}</span><span class="def">${icon('def')}${c.def}</span></div>`;
  const r = RARITY[c.rarity || 'common'];
  return `<div class="${cls}" ${opts.attr || ''} data-card="${c.id}">
    <div class="shine"></div>
    <div class="cost">${c.cost}</div>
    <div class="cname">${nameHtml(c.name)}</div>
    <div class="art" ${opts.artAttr || ''}>${cardArtSvg(c)}<div class="elem">${
      (c.elements || [c.element]).map(e => icon(e)).join('')}</div></div>
    ${kw}
    <div class="rarity" style="color:${r.color};border-color:${r.color}66">${r.short}</div>
    <div class="body">${bodyHtml(c.text || c.flavor)}</div>
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
      <div class="mname">${nameHtml(c.name)}</div>
      ${hasKw(m, 'guard') ? `<div class="gmark">${L('守護', 'Guard')}</div>` : ''}
      ${hasKw(m, 'pierce') ? `<div class="gmark pierce">${L('貫通', 'Pierce')}</div>` : ''}
      ${hasKw(m, 'double') ? `<div class="gmark dbl">${L('連撃', 'Double')}</div>` : ''}
      ${(m.stunnedUntil || -1) >= 0 ? `<div class="gmark stunned">${L('停止', 'Stun')}</div>` : ''}
      ${opts.shielded ? `<div class="gmark shield" title="${L('次の相手のターンが終わるまで、戦闘で破壊されない', 'Can’t be destroyed in battle until the end of the opponent’s next turn')}">${L('不壊', 'Safe')}</div>` : ''}
      <div class="mstat ${buffed ? 'buffed' : ''}">
        <span class="atk">${icon('atk')}${effAtk(m)}</span><span class="def">${icon('def')}${effDef(m)}</span>
      </div>
    </div>
    <div class="modetag">${def ? L('守', 'DEF') : L('攻', 'ATK')}</div>
  </div>`;
}

/** サポートゾーンの札 */
export function supportHtml(s) {
  const c = card(s.id);
  return `<div class="sup ${c.element} r-${c.rarity || 'common'}" data-card="${c.id}">
    <div class="sart">${cardArtSvg(c)}</div>
    <div class="sname">${nameHtml(c.name)}</div>
  </div>`;
}

/** クリックしたときに出す詳細パネル */
export function detailHtml(c, extra = '', opts = {}) {
  const r = RARITY[c.rarity || 'common'];
  const zoomable = Boolean(opts.zoomable);
  const kw = c.keywords?.length
    ? `<div class="d-kw">${c.keywords.map(k =>
        `<b>${kwb(KEYWORDS[k].name)}</b>${esc(KEYWORDS[k].desc)}`).join('<br>')}</div>` : '';
  return `<div class="detail">
    ${cardHtml(c, {
      cls: `big ${zoomable ? 'zoomable' : ''}`,
      artAttr: zoomable
        ? `data-artzoom="${esc(c.id)}" role="button" tabindex="0" aria-label="${L(`${esc(c.name)}のイラストを拡大`, `Enlarge ${esc(c.name)} art`)}"`
        : '',
    })}
    <div class="d-body">
      <div class="d-name">${esc(c.name)}</div>
      <div class="d-meta">
        <span>${icon(c.element)} ${ELEMENTS[c.element].name}</span>
        <span>${L('コスト', 'Cost')} ${c.cost}</span>
        ${c.type === 'monster' ? `<span class="atk">${icon('atk')} ${c.atk}</span><span class="def">${icon('def')} ${c.def}</span>` : `<span>${L('サポート', 'Support')}</span>`}
        <span style="color:${r.color}">${r.name}</span>
        <span>${(c.set || 1) === 9 ? L('キャラクター', 'Character') : c.set === 10 ? L('選定の儀の限定カード', 'Rite of Choosing exclusive') : L(`第${c.set || 1}弾`, `Set ${c.set || 1}`)}</span>
      </div>
      <div class="d-text">${esc(c.text || L('このカードに効果はありません（バニラ）。', 'This card has no effect (vanilla).'))}</div>
      ${kw}
      <div class="d-flavor">${esc(c.flavor)}</div>
      ${extra}
    </div>
  </div>`;
}
