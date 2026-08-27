import { ALL_CARDS, KEYWORDS } from '../src/engine/cards.js';
import { RARITY } from '../src/engine/rarity.js';
const rows = ALL_CARDS.map(c => ({
  id: c.id, name: c.name, set: c.set || 1, el: c.element, type: c.type,
  cost: c.cost, atk: c.type === 'monster' ? c.atk : null, def: c.type === 'monster' ? c.def : null,
  rarity: c.rarity || 'common',
  kw: (c.keywords || []).map(k => KEYWORDS[k].name),
  text: c.text || '', flavor: c.flavor || '',
}));
process.stdout.write(JSON.stringify(rows));
