// ============================================================
// カード以外のゲームデータの英語版
// ============================================================
export const EN_ELEMENTS = { fire: 'Fire', water: 'Water', grass: 'Grass', none: 'Neutral' };

export const EN_KEYWORDS = {
  guard: ['Guard', 'Enemies must choose Guard monsters as attack targets first.'],
  pierce: ['Pierce', 'Can choose attack targets while ignoring [Guard].'],
  double: ['Double Strike', 'Can attack twice per turn.'],
  accelerate: ['Accelerate', 'When summoned, increase your max cost by 1 (up to 10).'],
  observe: ['Observe', 'On Summon: Look at the top 3 cards of your deck, add 1 to your hand, and put the rest on the bottom.'],
  select: ['Choose', 'On Summon: Look at the top 2 cards of your deck, add 1 to your hand, and put the other on the bottom.'],
  dual: ['Dual', 'Counts as both Fire and Water. Easier to gain an advantage, but also easier to be at a disadvantage.'],
  tri: ['Tri', 'Counts as all three elements. Always has the advantage, and always has the disadvantage too.'],
  charge: ['Cleave', 'When it attacks, it also deals damage equal to half its ATK to the monsters on both sides of the target. This damage lowers their DEF directly (destroyed at 0 or less). Normal battles never lower DEF, so this is the one exception.'],
  rank: ['Formation', '+1 ATK and +2 DEF for each adjacent monster. In the center slot, that is +2/+4.'],
  banner: ['Banner', 'While this card is on the field, adjacent monsters get +1 ATK.'],
  mercenary: ['Mercenary', 'Also counts as the element of each adjacent monster. It takes on its employer’s colors.'],
  rooted: ['Rooted', 'Has [Guard] while it has an adjacent monster.'],
  lone: ['Lone Wolf', '+3/+2 while you have no other monsters on your field.'],
  warden: ['Warden', 'Adjacent monsters also have [Guard].'],
  standard: ['War Standard', 'All your monsters get +1/+1 for each adjacent monster.'],
};

export const EN_RARITY = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legend: 'Legend' };

export const EN_AREAS = {
  a1: ['Meadow of Beginnings', 'Where the journey starts. The opponents here still go easy on you.'],
  a2: ['Burning Hills', 'Dry hills where the fire folk live. Watch out for fast attacks. Water works well here.'],
  a3: ['Frozen Cove', 'The waters of the tide folk. Expect removal and long battles. Grass works well here.'],
  a4: ['Ancient Forest', 'A forest laced with World Tree roots, home to empowered monsters. Fire works well here.'],
  a5: ['Summit of Three', 'The far edge where the three elements meet. The cards you have so far won’t be enough.'],
  a6: ['Twilight Corridor', 'A crumbling stone corridor leading to the Gate of Stars. Lifeless star relics are waking up.'],
  a7: ['Gate of Stars', 'On a plateau close to the sky stands a giant gate that divides the world.'],
  a8: ['Throne of Kings', 'The far side of the gate. Stars fill the ground and sky alike. Where the kings’ journey ends.'],
};

// エリアID → 敵の並び順どおり [名前, 説明]
export const EN_ENEMIES = {
  a1: [
    ['Toto the Apprentice', 'Still learning how to use cards.'],
    ['Garo the Trapper', 'Digs in defensively and wears you down slowly.'],
    ['Morley, Meadow Lord', 'Area boss. Pushes through with the power of Grass.'],
  ],
  a2: [
    ['Pirika, Child of Flame', 'Very fast. She will try to beat you down early.'],
    ['Gou, Lava Keeper', 'Ignores [Guard] with [Pierce].'],
    ['Varga, Flame Emperor', 'Area boss. Commands the Purgatory Wyrm.'],
  ],
  a3: [
    ['Mina the Tidewatcher', 'Holds on with healing and draw while chipping away at you.'],
    ['Val of the Ice Wall', 'Lines up walls of [Guard] and even whittles down your deck.'],
    ['Nept, Sea Emperor', 'Area boss. Summons the Tsunami King.'],
  ],
  a4: [
    ['Rim the Vinecaller', 'Keeps stacking buffs until her monsters are huge.'],
    ['Yona, Forest Hunter', 'Combines Fire and Grass. No openings.'],
    ['Verda, World Tree Guardian', 'Area boss. Blessed by Yggdra.'],
  ],
  a5: [
    ['Flare & Mist, Twin Mages', 'Deftly switch between all three elements.'],
    ['The Nameless Swordsman', 'Challenges you to a pure slugfest. Beware of [Double Strike].'],
    ['Triades, King of Three', 'Final boss. Wields the trump cards of all three elements.'],
  ],
  a6: [
    ['Riina the Observer', 'Uses [Observe] to dig up the star relics she needs. Her walls are thin, so you can push through.'],
    ['Cardan, Pilgrim of Gears', 'Cycles star relics with [Accelerate] and equipment. Hit him before he grows too strong.'],
    ['Ordo, Twilight Gatekeeper', 'Area boss. Lines up [Guard] monsters and pushes back with team-wide buffs.'],
  ],
  a7: [
    ['Yue the Stargazer', 'Stops you in your tracks with Stilled Moon, then attacks from above. Long games favor her.'],
    ['Kairos, Comet Knight', 'Runs past [Guard] with [Pierce] and [Double Strike]. It’s a race.'],
    ['Astel, Keeper of the Gate', 'Area boss. A well-rounded fighter who uses all three elements.'],
  ],
  a8: [
    ['Nox, the Faceless Envoy', 'Evens out both hands with Scales of Judgment. Hoarding cards won’t work.'],
    ['Dione, Twin-Pole Queen', 'Half Fire damage, half Water disruption. No weakness on offense or defense.'],
    ['Astralis, Star King', 'Final boss. Raises his cost with Gate Key and lands his Legends.'],
  ],
};

export const EN_PACKS = {
  set1: 'Herd of Beginnings', set2: 'Resonant Earth', set3: 'Starwatch', set4: 'Iron Banner', prism: 'Prism Pack',
};

export const EN_DIFFICULTY = { normal: 'Normal', hard: 'Hard', extreme: 'Extreme' };

export const EN_AVATARS = { 1: 'Boy', 2: 'Girl', 3: 'Teen (M)', 4: 'Teen (F)', 5: 'Man', 6: 'Woman' };

// 図鑑の弾タブ
export const EN_SETS = {
  1: ['Set 1', 'Awakening of Three'],
  2: ['Set 2', 'Storm Visitors'],
  3: ['Set 3', 'Gate of Stars'],
  4: ['Set 4', 'Iron Banner'],
  9: ['Characters', 'Those who appear beyond Extreme'],
  10: ['Rite of Choosing', 'For those who prevailed in the rite'],
};
