# -*- coding: utf-8 -*-
"""
cards_export.json（node sim/_list.mjs の出力）から、名前レビュー用のカード一覧HTMLを作る。

  node sim/_list.mjs > cards_export.json
  python tools/make_cardlist.py <出力先.html>
"""
import io, json, sys, html
from collections import defaultdict

EL = {
    'fire':  ('炎', '#e8703a'),
    'water': ('水', '#4fa8e8'),
    'grass': ('草', '#5cb96a'),
    'none':  ('汎用', '#cdb47c'),
}
RAR = {
    'common':   ('C', 'コモン',     '#95a6ba'),
    'uncommon': ('U', 'アンコモン', '#6fd3a8'),
    'rare':     ('R', 'レア',       '#67b6ff'),
    'epic':     ('E', 'エピック',   '#c58cff'),
    'legend':   ('L', 'レジェンド', '#ffcf5a'),
}
SET_NAME = {1: '第1弾 三属の目覚め', 2: '第2弾 嵐の来訪者', 3: '第3弾 星辰の門'}

e = lambda s: html.escape(str(s), quote=True)


def norm(name):
    """比較用に「の」と空白を落とす"""
    return name.replace('の', '').replace(' ', '').replace('　', '')


def similar_groups(cards):
    """名前が紛らわしい組を拾う。先頭2字・末尾2字・包含関係の3通り。"""
    groups = []
    seen_pairs = set()

    def add(label, kind, members):
        if len(members) < 2:
            return
        key = (kind, tuple(sorted(c['id'] for c in members)))
        if key in seen_pairs:
            return
        seen_pairs.add(key)
        groups.append({'label': label, 'kind': kind, 'members': members})

    head = defaultdict(list)
    tail = defaultdict(list)
    for c in cards:
        n = norm(c['name'])
        if len(n) >= 2:
            head[n[:2]].append(c)
            tail[n[-2:]].append(c)
    for k, v in head.items():
        add(k, 'head', v)
    for k, v in tail.items():
        add(k, 'tail', v)

    # 片方の名前がもう片方に丸ごと含まれる（一番紛らわしい）
    for a in cards:
        for b in cards:
            if a['id'] >= b['id']:
                continue
            na, nb = norm(a['name']), norm(b['name'])
            if len(na) < 3 or len(nb) < 3:
                continue
            if na in nb or nb in na:
                add(na if len(na) < len(nb) else nb, 'contain', [a, b])

    order = {'contain': 0, 'head': 1, 'tail': 2}
    groups.sort(key=lambda g: (order[g['kind']], -len(g['members']), g['label']))
    return groups


def stat_html(c):
    if c['type'] == 'monster':
        return (f'<span class="stat atk">{c["atk"]}</span>'
                f'<span class="stat-sep">/</span>'
                f'<span class="stat def">{c["def"]}</span>')
    return '<span class="stat-sup">サポート</span>'


def card_row(c):
    el_label, el_color = EL[c['el']]
    r_short, r_name, r_color = RAR[c['rarity']]
    kw = ''.join(f'<span class="kw">{e(k)}</span>' for k in c['kw'])
    text = e(c['text']) if c['text'] else '<span class="vanilla">効果なし（バニラ）</span>'
    return f'''<tr class="row" data-el="{c['el']}" data-set="{c['set']}" data-type="{c['type']}"
      data-search="{e(c['name'] + ' ' + c['id'] + ' ' + c['text'])}">
  <td class="c-cost"><span class="cost" style="--el:{el_color}">{c['cost']}</span></td>
  <td class="c-name">
    <div class="nm">{e(c['name'])}</div>
    <div class="sub"><span class="id">{e(c['id'])}</span><span class="dot" style="background:{r_color}"></span><span class="rar">{r_name}</span><span class="setn">第{c['set']}弾</span></div>
  </td>
  <td class="c-stat">{stat_html(c)}</td>
  <td class="c-text"><div class="tx">{text}</div>{f'<div class="kws">{kw}</div>' if kw else ''}</td>
</tr>'''


def build(cards):
    groups = similar_groups(cards)

    # ---- 似た名前 ----
    kind_label = {'contain': '片方が丸ごと含まれる', 'head': '出だしが同じ', 'tail': '語尾が同じ'}
    sim_cards = []
    for g in groups:
        chips = ''
        for m in g['members']:
            el_label, el_color = EL[m['el']]
            chips += (f'<li><span class="pip" style="background:{el_color}"></span>'
                      f'<b>{e(m["name"])}</b>'
                      f'<span class="meta">{e(m["id"])}・{m["cost"]}コスト・'
                      f'{"モンスター" if m["type"] == "monster" else "サポート"}</span></li>')
        sim_cards.append(f'''<article class="simcard k-{g['kind']}">
  <header><span class="frag">{e(g['label'])}</span><span class="kind">{kind_label[g['kind']]}</span></header>
  <ul>{chips}</ul>
</article>''')

    # ---- 全カード ----
    sections = ''
    for el in ('fire', 'water', 'grass', 'none'):
        el_label, el_color = EL[el]
        rows = [c for c in cards if c['el'] == el]
        rows.sort(key=lambda c: (c['type'] != 'monster', c['cost'], c['set'], c['id']))
        body = ''.join(card_row(c) for c in rows)
        mons = sum(1 for c in rows if c['type'] == 'monster')
        sections += f'''<section class="elsec" data-elsec="{el}" style="--el:{el_color}">
  <h2><span class="elmark">{el_label}</span>{el_label}属性
    <span class="elcount">{len(rows)}枚（モンスター{mons} / サポート{len(rows) - mons}）</span></h2>
  <div class="tablewrap"><table>
    <thead><tr><th>コスト</th><th>カード名</th><th>⚔ / 🛡</th><th>効果</th></tr></thead>
    <tbody>{body}</tbody>
  </table></div>
</section>'''

    set_counts = defaultdict(int)
    for c in cards:
        set_counts[c['set']] += 1

    return f'''<title>三属の戦記 カード名鑑</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap">
<style>
:root{{
  --ground:#e9edf2; --surface:#fbfcfe; --surface2:#f2f5f9;
  --ink:#16202c; --ink-soft:#3c4855; --muted:#5a6875; --line:#cfd8e3;
  --gold:#9a7420; --gold-bright:#c39433;
  --fire:#c2542a; --water:#2f78ad; --grass:#3d8a4c; --none:#8a7440;
  --shadow:0 1px 2px rgba(20,32,48,.08),0 6px 20px rgba(20,32,48,.06);
}}
@media (prefers-color-scheme:dark){{
  :root:not([data-theme="light"]){{
    --ground:#0a1017; --surface:#121b27; --surface2:#0f1825;
    --ink:#e4ecf6; --ink-soft:#c2cede; --muted:#8496ab; --line:#26344a;
    --gold:#f2c15b; --gold-bright:#ffd884;
    --fire:#e8703a; --water:#4fa8e8; --grass:#5cb96a; --none:#cdb47c;
    --shadow:0 1px 2px rgba(0,0,0,.5),0 8px 26px rgba(0,0,0,.38);
  }}
}}
:root[data-theme="dark"]{{
  --ground:#0a1017; --surface:#121b27; --surface2:#0f1825;
  --ink:#e4ecf6; --ink-soft:#c2cede; --muted:#8496ab; --line:#26344a;
  --gold:#f2c15b; --gold-bright:#ffd884;
  --fire:#e8703a; --water:#4fa8e8; --grass:#5cb96a; --none:#cdb47c;
  --shadow:0 1px 2px rgba(0,0,0,.5),0 8px 26px rgba(0,0,0,.38);
}}
*{{box-sizing:border-box}}
body{{
  margin:0; background:var(--ground); color:var(--ink);
  font-family:"Zen Kaku Gothic New",system-ui,-apple-system,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif;
  font-size:15px; line-height:1.7; -webkit-font-smoothing:antialiased;
}}
.wrap{{max-width:1120px;margin:0 auto;padding:38px 22px 90px}}

/* ---- ヘッダ ---- */
.masthead{{display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px 26px;
  padding-bottom:20px;border-bottom:2px solid var(--line);margin-bottom:30px}}
.masthead h1{{font-family:"Shippori Mincho",serif;font-weight:800;font-size:clamp(28px,4.4vw,42px);
  margin:0;letter-spacing:.03em;text-wrap:balance;line-height:1.25}}
.masthead h1 small{{display:block;font-family:"Zen Kaku Gothic New",sans-serif;font-weight:500;
  font-size:13px;letter-spacing:.16em;color:var(--muted);margin-bottom:6px}}
.tally{{display:flex;gap:20px;margin-left:auto;flex-wrap:wrap}}
.tally div{{text-align:right}}
.tally b{{display:block;font-size:24px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.1}}
.tally span{{font-size:11.5px;color:var(--muted);letter-spacing:.08em}}
.lede{{max-width:64ch;color:var(--ink-soft);margin:0 0 34px;font-size:14.5px}}

/* ---- 似た名前 ---- */
.simhead{{display:flex;align-items:baseline;gap:12px;margin:0 0 4px}}
.simhead h2{{font-family:"Shippori Mincho",serif;font-size:22px;font-weight:800;margin:0;letter-spacing:.04em}}
.simhead .n{{font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}}
.simnote{{color:var(--muted);font-size:13px;margin:0 0 18px;max-width:64ch}}
.simgrid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:12px;margin-bottom:44px}}
.simcard{{background:var(--surface);border:1px solid var(--line);border-radius:10px;
  padding:12px 14px 11px;box-shadow:var(--shadow)}}
.simcard header{{display:flex;align-items:baseline;gap:9px;margin-bottom:8px;
  padding-bottom:7px;border-bottom:1px dashed var(--line)}}
.simcard .frag{{font-family:"Shippori Mincho",serif;font-size:17px;font-weight:800;
  color:var(--gold);letter-spacing:.06em}}
.simcard .kind{{font-size:10.5px;color:var(--muted);letter-spacing:.06em;margin-left:auto}}
.simcard.k-contain{{border-left:3px solid var(--gold)}}
.simcard ul{{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}}
.simcard li{{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;font-size:13.5px;line-height:1.5}}
.simcard b{{font-weight:700}}
.pip{{width:7px;height:7px;border-radius:50%;flex:none;transform:translateY(-1px)}}
.simcard .meta{{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;margin-left:auto}}

/* ---- ツールバー ---- */
.tools{{position:sticky;top:0;z-index:5;background:var(--ground);
  padding:12px 0 13px;margin-bottom:6px;border-bottom:1px solid var(--line);
  display:flex;flex-wrap:wrap;gap:9px;align-items:center}}
.chip{{font:inherit;font-size:13px;font-weight:700;padding:5px 13px;border-radius:999px;
  border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer;
  transition:background .14s,border-color .14s,color .14s}}
.chip:hover{{border-color:var(--gold)}}
.chip[aria-pressed="true"]{{background:var(--ink);color:var(--ground);border-color:var(--ink)}}
.chip:focus-visible,input:focus-visible{{outline:2px solid var(--gold-bright);outline-offset:2px}}
.sep{{width:1px;height:22px;background:var(--line);margin:0 3px}}
#q{{font:inherit;font-size:13.5px;padding:6px 13px;border-radius:999px;border:1px solid var(--line);
  background:var(--surface);color:var(--ink);min-width:190px;flex:1;max-width:280px}}
#q::placeholder{{color:var(--muted)}}
.hits{{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;margin-left:auto}}

/* ---- 一覧 ---- */
.elsec{{margin-top:34px}}
.elsec h2{{font-family:"Shippori Mincho",serif;font-size:21px;font-weight:800;letter-spacing:.05em;
  margin:0 0 11px;display:flex;align-items:center;gap:10px}}
.elmark{{width:26px;height:26px;border-radius:7px;background:var(--el);color:#08101a;
  display:grid;place-items:center;font-size:13px;font-weight:900;flex:none;
  font-family:"Zen Kaku Gothic New",sans-serif}}
.elcount{{margin-left:auto;font-family:"Zen Kaku Gothic New",sans-serif;font-size:12px;
  font-weight:500;color:var(--muted);letter-spacing:.04em}}
.tablewrap{{overflow-x:auto;border:1px solid var(--line);border-radius:10px;
  background:var(--surface);box-shadow:var(--shadow)}}
table{{width:100%;border-collapse:collapse;min-width:660px}}
thead th{{text-align:left;font-size:11px;font-weight:700;letter-spacing:.12em;color:var(--muted);
  padding:9px 12px;border-bottom:1px solid var(--line);background:var(--surface2);white-space:nowrap}}
tbody tr{{border-bottom:1px solid var(--line)}}
tbody tr:last-child{{border-bottom:0}}
tbody tr:hover{{background:var(--surface2)}}
td{{padding:9px 12px;vertical-align:top}}
.c-cost{{width:52px}}
.cost{{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;
  background:var(--el);color:#08101a;font-weight:900;font-size:15px;font-variant-numeric:tabular-nums}}
.c-name{{width:230px}}
.nm{{font-family:"Shippori Mincho",serif;font-size:16.5px;font-weight:800;line-height:1.35;
  letter-spacing:.02em;text-wrap:balance}}
.sub{{display:flex;align-items:center;gap:7px;margin-top:2px;font-size:11px;color:var(--muted)}}
.sub .id{{font-variant-numeric:tabular-nums;letter-spacing:.04em}}
.dot{{width:7px;height:7px;border-radius:50%;flex:none}}
.setn{{margin-left:auto;white-space:nowrap}}
.c-stat{{width:92px;white-space:nowrap;font-variant-numeric:tabular-nums}}
.stat{{font-size:16px;font-weight:900}}
.stat.atk{{color:var(--fire)}}
.stat.def{{color:var(--water)}}
.stat-sep{{color:var(--muted);margin:0 3px}}
.stat-sup{{font-size:12px;color:var(--muted);font-weight:700}}
.c-text{{font-size:13.5px;color:var(--ink-soft);line-height:1.65}}
.vanilla{{color:var(--muted)}}
.kws{{margin-top:4px;display:flex;gap:5px;flex-wrap:wrap}}
.kw{{font-size:11px;font-weight:700;padding:1px 8px;border-radius:5px;
  border:1px solid var(--el);color:var(--el)}}
.empty{{padding:22px 12px;color:var(--muted);font-size:13.5px}}
tr[hidden],section[hidden]{{display:none}}
@media (prefers-reduced-motion:reduce){{*{{transition:none!important}}}}
@media (max-width:640px){{
  .wrap{{padding:26px 14px 70px}}
  .tally{{margin-left:0}}
  .c-name{{width:auto;min-width:170px}}
}}
</style>

<div class="wrap">
  <header class="masthead">
    <h1><small>TRI-ELEMENTS</small>三属の戦記 カード名鑑</h1>
    <div class="tally">
      <div><b>{len(cards)}</b><span>カード総数</span></div>
      <div><b>{set_counts[1]}/{set_counts[2]}/{set_counts[3]}</b><span>第1/2/3弾</span></div>
      <div><b>{len(groups)}</b><span>名前が近い組</span></div>
    </div>
  </header>

  <p class="lede">名前が紛らわしいカードを洗い出すための一覧です。まず「名前が近いカード」で衝突を確認し、
  その下の属性別一覧で効果と数値を照らし合わせてください。</p>

  <div class="simhead"><h2>名前が近いカード</h2><span class="n">{len(groups)}組</span></div>
  <p class="simnote">出だし・語尾が同じもの、片方の名前がもう片方に丸ごと含まれるものを機械的に拾っています。
  モンスターとサポートで役割が違う組は、あえて揃えている場合もあります。</p>
  <div class="simgrid">{''.join(sim_cards)}</div>

  <div class="tools" role="group" aria-label="絞り込み">
    <button class="chip" data-f="el" data-v="all" aria-pressed="true">全属性</button>
    <button class="chip" data-f="el" data-v="fire" aria-pressed="false">炎</button>
    <button class="chip" data-f="el" data-v="water" aria-pressed="false">水</button>
    <button class="chip" data-f="el" data-v="grass" aria-pressed="false">草</button>
    <button class="chip" data-f="el" data-v="none" aria-pressed="false">汎用</button>
    <span class="sep"></span>
    <button class="chip" data-f="set" data-v="all" aria-pressed="true">全弾</button>
    <button class="chip" data-f="set" data-v="1" aria-pressed="false">第1弾</button>
    <button class="chip" data-f="set" data-v="2" aria-pressed="false">第2弾</button>
    <button class="chip" data-f="set" data-v="3" aria-pressed="false">第3弾</button>
    <span class="sep"></span>
    <button class="chip" data-f="type" data-v="all" aria-pressed="true">両方</button>
    <button class="chip" data-f="type" data-v="monster" aria-pressed="false">モンスター</button>
    <button class="chip" data-f="type" data-v="support" aria-pressed="false">サポート</button>
    <input id="q" type="search" placeholder="カード名・効果で検索" aria-label="カード名・効果で検索">
    <span class="hits" id="hits"></span>
  </div>

  {sections}
</div>

<script>
const state = {{ el:'all', set:'all', type:'all', q:'' }};
const rows = [...document.querySelectorAll('tbody tr')];
const secs = [...document.querySelectorAll('.elsec')];
const hits = document.getElementById('hits');

function apply() {{
  const q = state.q.trim().toLowerCase();
  let n = 0;
  for (const r of rows) {{
    const ok = (state.el === 'all' || r.dataset.el === state.el)
      && (state.set === 'all' || r.dataset.set === state.set)
      && (state.type === 'all' || r.dataset.type === state.type)
      && (!q || r.dataset.search.toLowerCase().includes(q));
    r.hidden = !ok;
    if (ok) n++;
  }}
  for (const s of secs) {{
    s.hidden = !s.querySelector('tbody tr:not([hidden])');
  }}
  hits.textContent = n === rows.length ? `${{rows.length}}枚` : `${{n}} / ${{rows.length}}枚`;
}}

document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {{
  const f = b.dataset.f;
  state[f] = b.dataset.v;
  document.querySelectorAll(`.chip[data-f="${{f}}"]`).forEach(o =>
    o.setAttribute('aria-pressed', String(o === b)));
  apply();
}}));
document.getElementById('q').addEventListener('input', ev => {{ state.q = ev.target.value; apply(); }});
apply();
</script>
'''


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'cardlist.html'
    cards = json.load(io.open('cards_export.json', encoding='utf-8'))
    io.open(out, 'w', encoding='utf-8').write(build(cards))
    print('書き出し:', out, len(cards), '枚')


if __name__ == '__main__':
    main()
