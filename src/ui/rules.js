// ============================================================
// ルール説明（実際のカードを使って見せる）
// ============================================================
import { card, ELEMENTS, KEYWORDS } from '../engine/cards.js';
import { RARITY } from '../engine/rarity.js';
import { cardHtml, monsterHtml, esc } from './cardview.js';

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

export function renderRulesPage() {
  const battleDemo = `
    <div class="rboard">
      <div class="rside">
        <div class="rlabel">攻撃モード（縦置き）</div>
        ${monsterHtml(demo('f09', 'attack'), 1, 0, {})}
        <div class="rcap">⚔ で戦う。殴れる</div>
      </div>
      <div class="rvs">VS</div>
      <div class="rside">
        <div class="rlabel">防御モード（横置き）</div>
        ${monsterHtml(demo('w08', 'defense'), 1, 1, {})}
        <div class="rcap">🛡 で受け止める。攻撃はできない</div>
      </div>
    </div>`;

  const kwCards = [
    ['w08', 'guard', ''],
    ['f08', 'pierce', ''],
    ['x_f4', 'double', ''],
    ['z_f4', 'accelerate', '出すだけで次のターンが1コスト早くなります。重ねるほど大型が早く着地します。'],
    ['z_g4', 'observe', '3枚から選べるので、欲しい1枚を引き当てやすくなります。'],
    ['b_f1', 'charge', '相手が並べているほど刺さります。巻き込みで防御力が0になったモンスターは、そのまま破壊されます。'],
    ['b_w1', 'rank', '場は3枠なので、両隣がそろうのは中央だけ。中央に置けば+2/+4になります。'],
    ['b_g1', 'banner', '旗の隣は強くなります。相手は旗から狙ってくるので、守るか囮にするかを選ぶことになります。'],
    ['b_n1', 'mercenary', '無属性ですが、隣の色を名乗ります。属性しばりの強化も受けられる代わりに、その色の不利も背負います。'],
  ].map(([id, kw, extra]) => `
    <div class="ritem">
      ${cardHtml(card(id), {})}
      <div class="ritext"><b>【${KEYWORDS[kw].name}】</b><br>${esc(KEYWORDS[kw].desc)}${
        extra ? `<br><span class="rsub">${esc(extra)}</span>` : ''}</div>
    </div>`).join('');

  const elemCards = ['f09', 'g07', 'w09'].map(id => cardHtml(card(id), {})).join(
    '<div class="rarrow">▶ 強い</div>');

  const rarityCards = ['f01', 'w05', 'f09', 'x_w6', 'z_lf1'].map(id => {
    const c = card(id);
    const r = RARITY[c.rarity];
    return `<div class="ritem col">
      ${cardHtml(c, {})}
      <div class="rcap" style="color:${r.color}">${r.name}</div>
    </div>`;
  }).join('');

  const supportCards = [
    ['sf1', '使うとすぐ効果が出て、墓地へ行く'],
    ['sf2', '装備：モンスターに付いて場に残り続ける'],
  ].map(([id, t]) => `
    <div class="ritem">
      ${cardHtml(card(id), {})}
      <div class="ritext">${esc(t)}</div>
    </div>`).join('');

  return `<div class="screen rules">
    <h2 class="rtitle">ルール</h2>

    ${sec('勝ち方', `
      ${note('相手のライフを <b>0</b> にすれば勝ち。<br>相手が山札切れでカードを引けなくなっても勝ちです。')}
      ${note('自分のライフが0になるか、自分が引けなくなると負け。')}`)}

    ${sec('ターンの流れ', `
      ${note(`
        ① 最大コストが1増えてコストが全回復（上限10）<br>
        ② カードを1枚引く<br>
        ③ 好きな順に：召喚 ／ サポート使用 ／ 攻撃 ／ モード変更 ／ 鍛錬<br>
        ④ ターン終了（手札が6枚を超えていたら捨てる）`)}
      ${note('先攻の1ターン目はドローなし。後攻は初期手札が1枚多く、最初のターンだけコストが1多い。')}
      ${note('対戦の最初に<b>【マリガン】</b>があります。配られた手札が気に入らなければ、1回だけ引き直せます。')}`)}

    ${sec('モンスターの2つのモード', battleDemo + `
      ${note('<b>攻撃モード同士</b>：⚔ が高い方が勝ち、負けた方は破壊。差はプレイヤーへのダメージ。負けた側のプレイヤーも差分を受けます。')}
      ${note('<b>防御モードを攻撃</b>：⚔ が 🛡 を超えたら破壊されますが、<b>プレイヤーが受けるのは超えた分の半分だけ</b>（切り上げ）。🛡 が ⚔ 以上なら完全に防ぎ、両者とも場に残ります。')}
      ${note('つまり<b>防御モードは受けるダメージを減らせます</b>。攻撃モードで負けると差分をそのまま受けるので、殴り返せない相手には伏せておくのが有効です。<br>ただし【落とし穴】のように防御モードだけを狙い撃つカードや、【挑発】のように相手を攻撃モードへ引きずり出して守りを剥がすカードもあります。逆に【威圧】で相手を防御モードにすれば、その1体の攻撃を止められます。')}
      ${note('モード変更は1体につき1ターン1回。ただし<b>攻撃したモンスターは変更できません</b>。')}`)}

    ${sec('召喚', `
      ${note('コストが払える限り<b>何体でも</b>召喚できます。召喚酔いは無く、出したターンに攻撃できます。')}
      ${note('場が3体で埋まっていても、<b>自分のモンスター1体を墓地へ送れば召喚できます</b>（コスト+1）。手札の大型が腐りません。')}
      ${note('余ったコストは <b>【鍛錬】2コストで1枚ドロー</b>（1ターン1回）に使えます。')}`)}

    ${sec('直接攻撃', `
      ${note('相手の場にモンスターが1体もいないとき、⚔ の分をそのままライフへ叩き込めます。')}
      ${note('【守護】を持つモンスターがいる場合、まずそちらを攻撃しなければなりません。')}`)}

    ${sec('属性の相性', `
      <div class="relem">${elemCards}<div class="rarrow">▶ 強い（🔥へ戻る）</div></div>
      ${note('有利な属性で攻撃すると、その戦闘だけ <b>⚔ +2</b> されます。')}
      ${note('ごく一部に、複数の属性を同時に名乗るカードがあります。<br>'
        + '<b>【双属】</b>は炎と水の両方として、<b>【三属】</b>は三属性すべてとして扱われます。'
        + '有利を取りやすい代わりに、こちらが攻撃されるときも相手に有利を取られやすくなります。')}`)}

    ${sec('並び順', `
      ${note('場の3枠には<b>「隣」の関係</b>があります。両隣がそろうのは<b>中央だけ</b>です。')}
      ${note('【隊列】【旗】といった効果は、隣に誰がいるかで<b>効き方がその場で変わります</b>。'
        + '仲間が倒れれば弱まり、埋め直せばまた戻ります。')}
      ${note('モンスターに<b>ダメージ</b>を与える効果は、その<b>防御力を減らします</b>。'
        + '防御力が0になったモンスターは破壊されます。')}`)}

    ${sec('キーワード', `<div class="rlist">${kwCards}</div>`)}

    ${sec('サポートカード', `<div class="rlist">${supportCards}</div>
      ${note('コストが続く限り1ターンに何枚でも使えます。装備はサポートゾーン（3枠）に残ります。')}`)}

    ${sec('レア度', `<div class="rlist center">${rarityCards}</div>
      ${note('枠の光り方でレア度が分かります。パックから出る確率も変わります。')}
      ${note(`<b style="color:${RARITY.legend.color}">レジェンド</b>は第3弾『星辰の門』で登場した最上位のレア度です。
        1枚で盤面をひっくり返す力がある代わりにコストが重く、パックからもごく稀にしか出ません。`)}`)}

    <button class="btn" data-go="title">戻る</button>
  </div>`;
}
