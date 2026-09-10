// ============================================================
// ルール説明（実際のカードを使って見せる）
// ============================================================
import { card, KEYWORDS } from '../engine/cards.js';
import { RARITY } from '../engine/rarity.js';
import { cardHtml, monsterHtml, esc } from './cardview.js';
import { icon } from './icons.js';
import { L, kwb } from '../i18n/lang.js';

/** 説明用のダミーモンスター（盤面と同じ見た目で並べる） */
function demo(id, mode) {
  const c = card(id);
  return {
    uid: 0, id, atk: c.atk, def: c.def, mode,
    hasAttacked: false, attacks: 0, modeChanged: false,
    tempAtk: 0, tempDef: 0, equips: [], grants: [],
  };
}

const sec = (title, body) =>
  `<section class="rsec"><h3>${title}</h3><div class="rbody">${body}</div></section>`;

const note = t => `<p class="rnote">${t}</p>`;

/** 本文中でカード名を引くとき（【落とし穴】など） */
const cn = id => kwb(esc(card(id).name));

export function renderRulesPage() {
  const battleDemo = `
    <div class="rboard">
      <div class="rside">
        <div class="rlabel">${L('攻撃モード（縦置き）', 'Attack Mode (upright)')}</div>
        ${monsterHtml(demo('f09', 'attack'), 1, 0, {})}
        <div class="rcap">${L(`${icon('atk')} で戦う。殴れる`, `Fights with ${icon('atk')}. Can attack`)}</div>
      </div>
      <div class="rvs">VS</div>
      <div class="rside">
        <div class="rlabel">${L('防御モード（横置き）', 'Defense Mode (sideways)')}</div>
        ${monsterHtml(demo('w08', 'defense'), 1, 1, {})}
        <div class="rcap">${L(`${icon('def')} で受け止める。攻撃はできない`, `Blocks with ${icon('def')}. Can’t attack`)}</div>
      </div>
    </div>`;

  const kwCards = [
    ['w08', 'guard', ['', '']],
    ['f08', 'pierce', ['', '']],
    ['x_f4', 'double', ['', '']],
    ['z_f4', 'accelerate', ['出すだけで次のターンが1コスト早くなります。重ねるほど大型が早く着地します。',
      'Just playing it gets you 1 cost ahead next turn. Stack them and your big monsters land sooner.']],
    ['z_g4', 'observe', ['3枚から選べるので、欲しい1枚を引き当てやすくなります。',
      'You pick from 3 cards, so it is easier to find the one you need.']],
    ['b_f1', 'charge', ['相手が並べているほど刺さります。巻き込みで防御力が0になったモンスターは、そのまま破壊されます。',
      'The more monsters your opponent lines up, the better it works. A monster whose DEF drops to 0 from the splash is destroyed.']],
    ['b_w1', 'rank', ['場は3枠なので、両隣がそろうのは中央だけ。中央に置けば+2/+4になります。',
      'There are only 3 slots, so only the center has neighbors on both sides. In the center it gets +2/+4.']],
    ['b_g1', 'banner', ['旗の隣は強くなります。相手は旗から狙ってくるので、守るか囮にするかを選ぶことになります。',
      'Monsters next to a Banner get stronger. Opponents will go after the Banner first, so decide whether to protect it or use it as bait.']],
    ['b_n1', 'mercenary', ['無属性ですが、隣の色を名乗ります。属性しばりの強化も受けられる代わりに、その色の不利も背負います。',
      'It is Neutral, but takes on its neighbors’ elements. It can receive element-specific buffs, but it also takes on their weaknesses.']],
    ['b_n3', 'lone', ['隣を空けておくことが条件です。3枠を埋めるほど強くなる他のカードとは、正反対の考え方になります。',
      'It needs empty slots beside it. That is the opposite of cards that get stronger as you fill all 3 slots.']],
    ['b_w5', 'warden', ['守護を隣へ配ります。真ん中に置けば、両隣そろって守護持ちになります。',
      'It hands out [Guard] to its neighbors. Put it in the center and both neighbors get [Guard].']],
    ['b_ln1', 'standard', ['味方全員が【隊列】を持つようなものです。3枠を埋めきったときの伸びがいちばん大きくなります。',
      'It is like giving every ally [Formation]. It pays off most when all 3 slots are filled.']],
  ].map(([id, kw, extra]) => {
    const ex = L(...extra);
    return `
    <div class="ritem">
      ${cardHtml(card(id), {})}
      <div class="ritext"><b>${kwb(KEYWORDS[kw].name)}</b><br>${esc(KEYWORDS[kw].desc)}${
        ex ? `<br><span class="rsub">${esc(ex)}</span>` : ''}</div>
    </div>`;
  }).join('');

  const elemCards = ['f09', 'g07', 'w09'].map(id => cardHtml(card(id), {})).join(
    `<div class="rarrow">${L('▶ 強い', '▶ beats')}</div>`);

  const rarityCards = ['f01', 'w05', 'f09', 'x_w6', 'z_lf1'].map(id => {
    const c = card(id);
    const r = RARITY[c.rarity];
    return `<div class="ritem col">
      ${cardHtml(c, {})}
      <div class="rcap" style="color:${r.color}">${r.name}</div>
    </div>`;
  }).join('');

  const supportCards = [
    ['sf1', ['使うとすぐ効果が出て、墓地へ行く', 'Takes effect right away, then goes to the graveyard']],
    ['sf2', ['装備：モンスターに付いて場に残り続ける', 'Equip: attaches to a monster and stays on the field']],
  ].map(([id, t]) => `
    <div class="ritem">
      ${cardHtml(card(id), {})}
      <div class="ritext">${esc(L(...t))}</div>
    </div>`).join('');

  return `<div class="screen rules">
    <h2 class="rtitle">${L('ルール', 'How to Play')}</h2>

    ${sec(L('勝ち方', 'How to win'), `
      ${note(L('相手のライフを <b>0</b> にすれば勝ち。<br>相手が山札切れでカードを引けなくなっても勝ちです。',
        'Reduce your opponent’s Life to <b>0</b> to win.<br>You also win if your opponent runs out of cards and can’t draw.'))}
      ${note(L('自分のライフが0になるか、自分が引けなくなると負け。',
        'You lose if your Life reaches 0 or you can’t draw.'))}`)}

    ${sec(L('ターンの流れ', 'Turn order'), `
      ${note(L(`
        ① 最大コストが1増えてコストが全回復（上限10）<br>
        ② カードを1枚引く<br>
        ③ 好きな順に：召喚 ／ サポート使用 ／ 攻撃 ／ モード変更 ／ 鍛錬<br>
        ④ ターン終了（手札が6枚を超えていたら捨てる）`, `
        ① Your max cost goes up by 1 and your cost refills (up to 10)<br>
        ② Draw 1 card<br>
        ③ In any order: summon / play supports / attack / switch modes / Forge<br>
        ④ End your turn (discard down to 6 cards if you have more)`))}
      ${note(L('先攻の1ターン目はドローなし。後攻は初期手札が1枚多く、最初のターンだけコストが1多い。',
        'The first player skips the draw on turn 1. The second player starts with 1 extra card and gets +1 cost on their first turn.'))}
      ${note(L('対戦の最初に<b>【マリガン】</b>があります。配られた手札が気に入らなければ、1回だけ引き直せます。',
        'Each battle begins with a <b>[Mulligan]</b>. If you don’t like your opening hand, you can redraw it once.'))}`)}

    ${sec(L('モンスターの2つのモード', 'The two monster modes'), battleDemo + `
      ${note(L(`<b>攻撃モード同士</b>：${icon('atk')} が高い方が勝ち、負けた方は破壊。差はプレイヤーへのダメージ。負けた側のプレイヤーも差分を受けます。`,
        `<b>Attack vs. Attack</b>: the higher ${icon('atk')} wins and the loser is destroyed. The difference is dealt as damage to the losing player.`))}
      ${note(L(`<b>防御モードを攻撃</b>：${icon('atk')} が ${icon('def')} を超えたら破壊されますが、<b>プレイヤーが受けるのは超えた分の半分だけ</b>（切り上げ）。${icon('def')} が ${icon('atk')} 以上なら完全に防ぎ、両者とも場に残ります。`,
        `<b>Attacking a Defense Mode monster</b>: if ${icon('atk')} is higher than ${icon('def')}, the defender is destroyed, but <b>its player only takes half of the excess</b> (rounded up). If ${icon('def')} is equal or higher, the attack is fully blocked and both monsters stay.`))}
      ${note(L(`つまり<b>防御モードは受けるダメージを減らせます</b>。攻撃モードで負けると差分をそのまま受けるので、殴り返せない相手には伏せておくのが有効です。<br>ただし${cn('sn8')}のように防御モードだけを狙い撃つカードや、${cn('sn4')}のように相手を攻撃モードへ引きずり出して守りを剥がすカードもあります。逆に${cn('sn3')}で相手を防御モードにすれば、その1体の攻撃を止められます。`,
        `In short, <b>Defense Mode reduces the damage you take</b>. Losing in Attack Mode costs you the full difference, so turn monsters sideways when you can’t win the fight.<br>Watch out, though: cards like ${cn('sn8')} only hit Defense Mode monsters, and cards like ${cn('sn4')} drag enemies into Attack Mode. On the other hand, ${cn('sn3')} switches an enemy to Defense Mode so it can’t attack.`))}
      ${note(L('モード変更は1体につき1ターン1回。ただし<b>攻撃したモンスターは変更できません</b>。',
        'Each monster can switch modes once per turn, but <b>not after it has attacked</b>.'))}`)}

    ${sec(L('召喚', 'Summoning'), `
      ${note(L('コストが払える限り<b>何体でも</b>召喚できます。召喚酔いは無く、出したターンに攻撃できます。',
        'You can summon <b>as many monsters as you can pay for</b>. There’s no summoning sickness, so they can attack right away.'))}
      ${note(L('場が3体で埋まっていても、<b>自分のモンスター1体を墓地へ送れば召喚できます</b>（コスト+1）。手札の大型が腐りません。',
        'Even with all 3 slots full, <b>you can send one of your monsters to the graveyard to make room</b> (+1 cost). Big cards never get stuck in your hand.'))}
      ${note(L('余ったコストは <b>【鍛錬】2コストで1枚ドロー</b>（1ターン1回）に使えます。',
        'Spend leftover cost on <b>[Forge]: pay 2 to draw 1 card</b> (once per turn).'))}`)}

    ${sec(L('直接攻撃', 'Direct attacks'), `
      ${note(L(`相手の場にモンスターが1体もいないとき、${icon('atk')} の分をそのままライフへ叩き込めます。`,
        `When your opponent has no monsters, you can hit their Life directly for the full ${icon('atk')}.`))}
      ${note(L(`${kwb(KEYWORDS.guard.name)}を持つモンスターがいる場合、まずそちらを攻撃しなければなりません。`,
        `If they have a ${kwb(KEYWORDS.guard.name)} monster, you must attack it first.`))}`)}

    ${sec(L('属性の相性', 'Element advantage'), `
      <div class="relem">${elemCards}<div class="rarrow">${L(`▶ 強い（${icon('fire')}へ戻る）`, `▶ beats (back to ${icon('fire')})`)}</div></div>
      ${note(L(`有利な属性で攻撃すると、その戦闘だけ <b>${icon('atk')} +2</b> されます。`,
        `Attacking with the advantaged element gives <b>${icon('atk')} +2</b> for that battle.`))}
      ${note(L('ごく一部に、複数の属性を同時に名乗るカードがあります。<br>'
        + `<b>${kwb(KEYWORDS.dual.name)}</b>は炎と水の両方として、<b>${kwb(KEYWORDS.tri.name)}</b>は三属性すべてとして扱われます。`
        + '有利を取りやすい代わりに、こちらが攻撃されるときも相手に有利を取られやすくなります。',
        'A few cards count as more than one element at once.<br>'
        + `<b>${kwb(KEYWORDS.dual.name)}</b> counts as both Fire and Water, and <b>${kwb(KEYWORDS.tri.name)}</b> counts as all three. `
        + 'They gain the advantage more easily, but opponents also gain it against them more easily.'))}`)}

    ${sec(L('並び順', 'Slot positions'), `
      ${note(L('場の3枠には<b>「隣」の関係</b>があります。両隣がそろうのは<b>中央だけ</b>です。',
        'The 3 slots on the field are <b>next to each other</b>. Only <b>the center slot</b> has neighbors on both sides.'))}
      ${note(L(`${kwb(KEYWORDS.rank.name)}${kwb(KEYWORDS.banner.name)}といった効果は、隣に誰がいるかで<b>効き方がその場で変わります</b>。`
        + '仲間が倒れれば弱まり、埋め直せばまた戻ります。',
        `Effects like ${kwb(KEYWORDS.rank.name)} and ${kwb(KEYWORDS.banner.name)} <b>change instantly depending on who is next to them</b>. `
        + 'They weaken when an ally falls and come back when you fill the gap.'))}
      ${note(L('モンスターに<b>ダメージ</b>を与える効果は、その<b>防御力を減らします</b>。'
        + '防御力が0になったモンスターは破壊されます。',
        'Effects that deal <b>damage</b> to a monster <b>lower its DEF</b>. '
        + 'A monster whose DEF reaches 0 is destroyed.'))}`)}

    ${sec(L('キーワード', 'Keywords'), `<div class="rlist">${kwCards}</div>`)}

    ${sec(L('サポートカード', 'Support cards'), `<div class="rlist">${supportCards}</div>
      ${note(L('コストが続く限り1ターンに何枚でも使えます。装備はサポートゾーン（3枠）に残ります。',
        'You can play as many as your cost allows each turn. Equipment stays in your support zone (3 slots).'))}`)}

    ${sec(L('レア度', 'Rarity'), `<div class="rlist center">${rarityCards}</div>
      ${note(L('枠の光り方でレア度が分かります。パックから出る確率も変わります。',
        'The frame’s glow shows a card’s rarity. Rarer cards appear less often in packs.'))}
      ${note(L(`<b style="color:${RARITY.legend.color}">${RARITY.legend.name}</b>は第3弾『星辰の門』で登場した最上位のレア度です。
        1枚で盤面をひっくり返す力がある代わりにコストが重く、パックからもごく稀にしか出ません。`,
        `<b style="color:${RARITY.legend.color}">${RARITY.legend.name}</b> is the highest rarity, introduced in Set 3, “Gate of Stars.”
        A single Legend can turn the whole game around, but they cost a lot and rarely appear in packs.`))}`)}

    <button class="btn" data-go="title">${L('戻る', 'Back')}</button>
  </div>`;
}
