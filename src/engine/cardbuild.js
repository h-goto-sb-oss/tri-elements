// カード定義のビルダー（cards.js / cards_set2.js から共用）
export const M = (id, name, element, cost, atk, def, art, opt = {}) => ({
  id, name, type: 'monster', element, cost, atk, def, art, set: opt.set || 1, img: opt.img || null,
  maxCopies: opt.maxCopies || 3,
  keywords: opt.keywords || [], text: opt.text || '', tier: opt.tier || 1,
  onSummon: opt.onSummon || null, onDeath: opt.onDeath || null, onTurnStart: opt.onTurnStart || null,
  flavor: opt.flavor || '',
});

export const S = (id, name, element, cost, art, opt = {}) => ({
  id, name, type: 'support', element, cost, art, set: opt.set || 1, img: opt.img || null,
  maxCopies: opt.maxCopies || 3,
  equip: !!opt.equip, text: opt.text || '', tier: opt.tier || 1,
  effects: opt.effects || [], flavor: opt.flavor || '',
});
