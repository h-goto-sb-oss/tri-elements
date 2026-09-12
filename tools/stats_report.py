# -*- coding: utf-8 -*-
"""TRI-ELEMENTS の匿名データを集計して、スマホで見られる1枚のHTMLにする。

サーバー（Oracle）で cron から動かす。標準ライブラリだけ（Pillow も venv も要らない）。
    python3 /opt/te-stats/stats_report.py [ログのフォルダ] [出力HTML]

ログは Caddy が /e へのアクセスを1行ずつ JSON で書いたもの（IP とヘッダは Caddy 側で消してある）。
送る側は src/game/telemetry.js。項目の意味：
    u 端末ごとの乱数id / s 1回の起動 / e 種類(open start end pack hide lang optout)
    t 起動からの秒 / d 初めて開いた日から何日目 / h itch|gh|other / b ビルド
    end: k 敵(a3:1) f フリー1 df 難易度 r w|l|q tn ターン sec 秒 fc 初突破1
"""
import glob
import gzip
import html
import json
import os
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlsplit

LOG_DIR = sys.argv[1] if len(sys.argv) > 1 else '/var/log/caddy'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/opt/te-stats/www/index.html'
JST = timezone(timedelta(hours=9))

AREAS = [
    ('a1', 'はじまりの草原', ['見習いのトト', '罠師のガロ', '草原の主 モーリー']),
    ('a2', '燃える丘', ['火の子ピリカ', '溶岩守りゴウ', '炎皇バルガ']),
    ('a3', '凍る入り江', ['潮見のミナ', '氷壁のヴァル', '海皇ネプト']),
    ('a4', '古代の森', ['蔦使いリム', '森の狩人ヨナ', '世界樹の守護者 ヴェルダ']),
    ('a5', '三属の頂', ['双子の術士 フレア & ミスト', '無銘の剣士', '三属の王 トリアデス']),
    ('a6', '黄昏の回廊', ['観測者リィナ', '歯車の巡礼者 カルダン', '黄昏の門番 オルド']),
    ('a7', '星辰の門', ['星読みのユエ', '彗星騎士 カイロス', '門の守り手 アステル']),
    ('a8', '王たちの座', ['無貌の使者 ノクス', '双極の女王 ディオーネ', '星辰王 アストラリス']),
]
STAGES = [(f'{a}:{i}', f'{an} {i + 1}', n) for a, an, ens in AREAS for i, n in enumerate(ens)]
NAME = {k: n for k, _, n in STAGES}
DIFF = {'normal': 'ノーマル', 'hard': '強化', 'extreme': '極'}
# 作者自身の端末（数字に混ぜない）。博史さんのスマホの GitHub Pages 版＝2026-09-12 に判明
OWNER = {'neyqzar7'}
KNOWN = {'open', 'lang', 'start', 'end', 'pack', 'hide', 'optout', 'thanks', 'fb', 'draft'}


def read_events():
    files = sorted(glob.glob(os.path.join(LOG_DIR, 'te-events*.log*')))
    for f in files:
        opener = gzip.open if f.endswith('.gz') else open
        try:
            with opener(f, 'rt', encoding='utf-8', errors='replace') as fh:
                for line in fh:
                    try:
                        j = json.loads(line)
                    except ValueError:
                        continue
                    req = j.get('request') or {}
                    uri = req.get('uri') or ''
                    if not uri.startswith('/e?'):
                        continue
                    q = dict(parse_qsl(urlsplit(uri).query))
                    # 知らない種類（受け口の動作確認で送った selftest など）は数えない
                    if q.get('v') != '1' or not q.get('u') or q.get('e') not in KNOWN:
                        continue
                    if q['u'].startswith('claudetest'):   # 公開後の動作確認で送ったもの
                        continue
                    if q['u'] in OWNER:                   # 作者自身の端末
                        continue
                    q['_ts'] = datetime.fromtimestamp(float(j.get('ts', 0)), JST)
                    yield q
        except OSError:
            continue


def unpack(dk):
    """'f05-3.w02' → ['f05','f05','f05','w02']（並びは id 順で揃う）"""
    out = []
    for part in (dk or '').split('.'):
        if not part:
            continue
        cid, _, n = part.partition('-')
        out += [cid] * (num(n, 1) if n else 1)
    return sorted(out)


def pack_list(ids):
    c = Counter(ids)
    return '.'.join(f'{k}-{v}' if v > 1 else k for k, v in sorted(c.items()))


# ============================================================
# グラフ（画像ではなくHTMLの箱で描く。スマホで拡大しても文字がつぶれない）
# ============================================================
E = html.escape
C_NEW, C_BACK, C_BATTLE = '#d9b25f', '#6f86a6', '#8fb4d9'
C_EL = {'f': '#e0714f', 'w': '#4f93e0', 'g': '#5bb56c'}


def vchart(cols, height=120, show_num=True):
    """縦棒。cols = [(ラベル, [(値, 色), ...積み上げ], ラベルを出すか)]"""
    mx = max((sum(v for v, _ in segs) for _, segs, _ in cols), default=0) or 1
    out = []
    for label, segs, show in cols:
        tot = sum(v for v, _ in segs)
        parts = ''.join(f'<i style="height:{v / mx * 86:.1f}%;background:{c}"></i>' for v, c in segs if v)
        numtag = f'<b>{tot}</b>' if (show_num and tot) else ''
        out.append(f'<div class="col"><div class="stk">{parts}{numtag}</div>'
                   f'<span class="lab">{E(label) if show else ""}</span></div>')
    return f'<div class="vchart" style="--h:{height}px">{"".join(out)}</div>'


def legend(items):
    return '<div class="legend">' + ''.join(f'<span><i style="background:{c}"></i>{E(t)}</span>' for t, c in items) + '</div>'


def split_bar(title, counter, colors):
    tot = sum(counter.values())
    if not tot:
        return ''
    items = counter.most_common()
    segs = ''.join(f'<i style="width:{v / tot * 100:.2f}%;background:{colors[i % len(colors)]}"></i>' for i, (_, v) in enumerate(items))
    leg = legend([(f'{k} {v / tot * 100:.0f}%（{v}）', colors[i % len(colors)]) for i, (k, v) in enumerate(items)])
    return f'<div class="split"><div class="st">{E(title)}</div><div class="sbar">{segs}</div>{leg}</div>'


def element_of(cid):
    base = cid.split('_', 1)[1] if '_' in cid else cid
    if base[:1] == 's' and len(base) > 1:
        base = base[1:]
    return C_EL.get(base[:1], '#8f97a3')


def num(v, default=None):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def main():
    ev = list(read_events())
    ev.sort(key=lambda q: q['_ts'])

    players = {q['u'] for q in ev}
    sessions = defaultdict(list)
    for q in ev:
        sessions[(q['u'], q.get('s'))].append(q)

    # ---- 日ごと ----
    by_day = defaultdict(lambda: {'u': set(), 'new': set(), 's': set(), 'battles': 0, 'plays': 0})
    for q in ev:
        day = q['_ts'].date()
        dd = by_day[day]
        dd['u'].add(q['u']); dd['s'].add((q['u'], q.get('s')))
        if q['e'] == 'open' and q.get('n') == '1':
            dd['new'].add(q['u'])
        if q['e'] == 'end':
            dd['battles'] += 1

    # ---- 1回あたりの長さ（その回に最後に届いた t）----
    lengths = [max(num(x.get('t'), 0) for x in xs) for xs in sessions.values()]
    lengths = [l for l in lengths if l is not None]
    med_min = statistics.median(lengths) / 60 if lengths else 0
    long_share = (sum(1 for l in lengths if l >= 600) / len(lengths) * 100) if lengths else 0

    # ---- 開いたときの内訳 ----
    opens = [q for q in ev if q['e'] == 'open']
    first_open = {}
    for q in opens:
        first_open.setdefault(q['u'], q)
    dev = Counter('スマホ' if q.get('m') == '1' else 'PC' for q in first_open.values())
    lng = Counter({'ja': '日本語', 'en': 'English'}.get(q.get('l'), q.get('l')) for q in first_open.values())
    where = Counter({'itch': 'itch.io', 'gh': 'GitHub Pages'}.get(q.get('h'), 'その他') for q in first_open.values())
    returned = {q['u'] for q in opens if num(q.get('d'), 0) >= 1}

    # ---- ストーリー：敵ごと ----
    st = {k: {'try': set(), 'clear': set(), 'w': 0, 'l': 0, 'q': 0, 'turns': [], 'secs': []} for k, _, _ in STAGES}
    free = defaultdict(lambda: {'w': 0, 'l': 0, 'q': 0, 'u': set()})
    for q in ev:
        if q['e'] not in ('start', 'end'):
            continue
        k = q.get('k')
        if q.get('dr') == '1':          # 2ピックの対戦はストーリー・フリーに混ぜない
            continue
        if q.get('f') == '1':
            if q['e'] == 'end':
                fd = free[q.get('df') or '?']
                fd[q.get('r', '?')] = fd.get(q.get('r', '?'), 0) + 1
                fd['u'].add(q['u'])
            continue
        if k not in st:
            continue
        s = st[k]
        # 結果だけ届いた（開始の送信が落ちた）対戦も「挑んだ」に入れる。突破＞挑んだ にならないように
        s['try'].add(q['u'])
        if q['e'] == 'end':
            r = q.get('r')
            if r in ('w', 'l', 'q'):
                s[r] += 1
            if r == 'w':
                s['clear'].add(q['u'])
            if num(q.get('tn')) is not None:
                s['turns'].append(num(q.get('tn')))
            if num(q.get('sec')) is not None:
                s['secs'].append(num(q.get('sec')))

    # 「ここで止まっている人」＝この敵に挑んだが一度も勝っておらず、
    # そのあと先の敵にも挑んでいない人
    order = [k for k, _, _ in STAGES]
    furthest_try = {}
    for i, k in enumerate(order):
        for u in st[k]['try']:
            furthest_try[u] = i
    stuck = Counter()
    for u, i in furthest_try.items():
        if u not in st[order[i]]['clear']:
            stuck[order[i]] += 1

    # ---- デッキ（対戦の終わりに届く dk="f05-3.w02-2..."）----
    cn = {}
    starter_key = None
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'card_names.json'), encoding='utf-8') as fh:
            cj = json.load(fh)
        cn = cj.get('names', {})
        starter_key = unpack(pack_list(cj.get('starter', [])))
    except (OSError, ValueError):
        pass
    deck_battles = [q for q in ev if q['e'] == 'end' and q.get('dk')]
    use = Counter()
    use_w = Counter()
    for q in deck_battles:
        ids = set(unpack(q['dk']))
        for cid in ids:
            use[cid] += 1
            if q.get('r') == 'w':
                use_w[cid] += 1
    last_deck = {}
    for q in deck_battles:
        last_deck[q['u']] = unpack(q['dk'])
    starter_users = sum(1 for d in last_deck.values() if starter_key is not None and d == starter_key)

    # ---- 2ピック ----
    PAIR_JA = {'fire,water': '炎×水', 'water,grass': '水×草', 'grass,fire': '草×炎'}
    dr_start = [q for q in ev if q['e'] == 'draft' and q.get('st') == 'start']
    dr_done = [q for q in ev if q['e'] == 'draft' and q.get('st') == 'done']
    dr_quit = [q for q in ev if q['e'] == 'draft' and q.get('st') == 'quit']
    dr_pairs = Counter(PAIR_JA.get(q.get('pr'), q.get('pr')) for q in dr_start)
    dr_wins = Counter(num(q.get('w'), 0) for q in dr_done)
    dr_battles = [q for q in ev if q['e'] == 'end' and q.get('dr') == '1']
    dr_wr = (sum(1 for q in dr_battles if q.get('r') == 'w') / len(dr_battles) * 100) if dr_battles else 0
    # 組み合わせごと（自分の組 × 相手の組）の勝率。pr/op が載るのは 2026-09-12 の版から
    dr_mu = defaultdict(lambda: [0, 0])
    for q in dr_battles:
        if q.get('pr') and q.get('op'):
            c = dr_mu[(q['pr'], q['op'])]
            c[0] += 1
            c[1] += q.get('r') == 'w'
    dr_bn = defaultdict(lambda: [0, 0])
    for q in dr_battles:
        if q.get('bn'):
            c = dr_bn[num(q['bn'], 0)]
            c[0] += 1
            c[1] += q.get('r') == 'w'

    packs = Counter(q.get('p') for q in ev if q['e'] == 'pack')
    optout = len({q['u'] for q in ev if q['e'] == 'optout'})
    n_thanks = sum(1 for q in ev if q['e'] == 'thanks')
    n_fb = sum(1 for q in ev if q['e'] == 'fb')

    # ================= HTML =================
    now = datetime.now(JST)
    e = E

    # ---- 日ごと（最初の日から今日まで、空いた日も0で並べる。最大30日）----
    days = []
    if by_day:
        d0 = max(min(by_day), now.date() - timedelta(days=29))
        d = d0
        while d <= now.date():
            days.append(d)
            d += timedelta(days=1)
    step = max(1, -(-len(days) // 7))
    def show(i):
        return i % step == 0 or i == len(days) - 1
    cols_players, cols_battles = [], []
    for i, d in enumerate(days):
        x = by_day.get(d)
        new = len(x['new']) if x else 0
        allu = len(x['u']) if x else 0
        lab = f'{d.month}/{d.day}'
        cols_players.append((lab, [(new, C_NEW), (max(0, allu - new), C_BACK)], show(i)))
        cols_battles.append((lab, [(x['battles'] if x else 0, C_BATTLE)], show(i)))
    rows_day = ''.join(
        f'<tr><td>{d.month}/{d.day}</td><td>{len(x["u"])}</td><td>{len(x["new"])}</td><td>{len(x["s"])}</td><td>{x["battles"]}</td></tr>'
        for d, x in sorted(by_day.items()))

    # ---- 1回の長さ ----
    buckets = [(0, 1, '〜1分'), (1, 3, '1〜3'), (3, 5, '3〜5'), (5, 10, '5〜10'), (10, 20, '10〜20'), (20, 30, '20〜30'), (30, 1e9, '30分〜')]
    cols_len = [(lab, [(sum(1 for l in lengths if a * 60 <= l < b * 60), C_BACK)], True) for a, b, lab in buckets]

    # ---- ストーリーの進み具合（横棒：挑んだ・突破を重ねる）----
    max_try = max((len(s['try']) for s in st.values()), default=0) or 1
    last_i = max((i for i, (k, _, _) in enumerate(STAGES) if st[k]['try']), default=-1)
    funnel, rows_stage = '', ''
    for i, (k, label, name) in enumerate(STAGES):
        if i > last_i:
            break
        s = st[k]
        if not s['try']:      # 誰も挑んでいない敵は並べない（途中のエリアから遊んだ人だけのときに空行が続く）
            continue
        n = s['w'] + s['l'] + s['q']
        stuck_n = stuck.get(k, 0)
        hot = stuck_n >= 3 and stuck_n >= len(s['try']) * 0.3
        funnel += (f'<div class="hrow{" hot" if hot else ""}"><div class="hl"><b>{e(name)}</b><small>{e(label)}</small></div>'
                   f'<div class="track"><i class="t" style="width:{len(s["try"]) / max_try * 100:.1f}%"></i>'
                   f'<i class="c" style="width:{len(s["clear"]) / max_try * 100:.1f}%"></i></div>'
                   f'<div class="hr">{len(s["clear"])}<span>/{len(s["try"])}</span>'
                   f'{f"<small>止まり {stuck_n}</small>" if stuck_n else ""}</div></div>')
        wr = f"{s['w'] / n * 100:.0f}%" if n else '—'
        mt = f"{statistics.median(s['turns']):.0f}" if s['turns'] else '—'
        rows_stage += (f'<tr{" class=warn" if hot else ""}><td><b>{e(name)}</b><small>{e(label)}</small></td>'
                       f'<td>{len(s["try"])}</td><td>{len(s["clear"])}</td>'
                       f'<td>{wr}<small>{s["w"]}勝{s["l"]}敗{s["q"]}投</small></td><td>{mt}</td><td>{stuck_n or ""}</td></tr>')

    rows_free = ''.join(
        f'<tr><td>{DIFF.get(d, d)}</td><td>{len(x["u"])}</td><td>{x.get("w", 0)}</td><td>{x.get("l", 0)}</td><td>{x.get("q", 0)}</td></tr>'
        for d, x in sorted(free.items()))

    # ---- カード（絵つきのタイル。並べ替えはタブで切り替え）----
    nb = len(deck_battles)
    art_dir = os.path.join(os.path.dirname(OUT), 'art')
    def tile(cid, sub):
        img = f'<img src="art/{cid}.jpg" loading="lazy" alt="">' if os.path.exists(os.path.join(art_dir, cid + '.jpg')) else '<span class="noimg"></span>'
        n = use.get(cid, 0)
        pct = n / nb * 100 if nb else 0
        return (f'<div class="ct" style="--el:{element_of(cid)}">{img}<div class="cn">{e(cn.get(cid, cid))}</div>'
                f'<div class="cb"><i style="width:{pct:.1f}%"></i></div><div class="cv">{sub}</div></div>')
    def wr_of(cid):
        return use_w[cid] / use[cid] * 100 if use.get(cid) else 0
    LIMIT = 20
    used = [cid for cid, _ in use.most_common()]
    g_use = ''.join(tile(c, f'採用 {use[c] / nb * 100:.0f}%<br>勝率 {wr_of(c):.0f}%') for c in used[:LIMIT])
    g_use_more = ''.join(tile(c, f'採用 {use[c] / nb * 100:.0f}%<br>勝率 {wr_of(c):.0f}%') for c in used[LIMIT:])
    strong = sorted((c for c in used if use[c] >= 5), key=lambda c: (-wr_of(c), -use[c]))
    g_win = ''.join(tile(c, f'勝率 {wr_of(c):.0f}%<br>{use[c]}戦') for c in strong[:LIMIT])
    unused = [c for c in cn if c not in use]
    g_unused = ''.join(tile(c, '0戦') for c in unused[:LIMIT])
    more_unused = len(unused) - LIMIT
    cards_html = (f"""<div class="ctabs">
<input type="radio" name="cs" id="cs1" checked><label for="cs1">採用率順</label>
<input type="radio" name="cs" id="cs2"><label for="cs2">勝率順</label>
<input type="radio" name="cs" id="cs3"><label for="cs3">未使用</label>
<div class="pane p1"><div class="cgrid">{g_use}</div>{f'<details><summary>残り {len(used) - LIMIT} 枚も見る</summary><div class="cgrid">{g_use_more}</div></details>' if g_use_more else ''}</div>
<div class="pane p2">{f'<div class="cgrid">{g_win}</div>' if g_win else '<p class="note">5戦以上たまったカードがまだありません</p>'}</div>
<div class="pane p3"><p class="note">一度もデッキに入っていないカード（全{len(unused)}枚。隠しカードや手に入れにくいカードも含む）</p><div class="cgrid">{g_unused}</div>{f'<p class="note">ほか {more_unused} 枚</p>' if more_unused > 0 else ''}</div>
</div>""" if nb else '<p class="note">まだありません</p>')
    starter_line = (f'最初のデッキのまま戦っている端末：<b>{starter_users}</b> / {len(last_deck)}' if last_deck else '')

    PAL = ['#d9b25f', '#6f86a6', '#5bb56c', '#e0714f', '#a88bd6']
    doc = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>TRI-ELEMENTS 遊ばれ方</title>
<style>
:root{{--bg:#12151c;--card:#1b2029;--line:#2c3440;--ink:#e8e4da;--sub:#9aa3b0;--gold:#d9b25f;--warn:#e0706a}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 "Hiragino Sans","Yu Gothic",sans-serif}}
main{{max-width:760px;margin:0 auto;padding:18px 14px 40px}}
h1{{font-size:20px;color:var(--gold);margin:0 0 2px}} h2{{font-size:16px;margin:28px 0 10px;color:var(--gold)}}
.sub{{color:var(--sub);font-size:12.5px}} p.note{{color:var(--sub);font-size:12.5px;margin:4px 0 8px}}
.livebtn{{display:inline-block;margin-top:10px;padding:7px 14px;border-radius:999px;background:#1f3a2a;color:#8ff0b4;border:1px solid #2f6b45;text-decoration:none;font-weight:700;font-size:14px}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:14px}}
.kpi div{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}}
.kpi b{{display:block;font-size:24px;font-variant-numeric:tabular-nums}} .kpi span{{color:var(--sub);font-size:12.5px}}
.box{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 12px 8px}}
.box + .box{{margin-top:10px}} .box h3{{margin:0 0 8px;font-size:13.5px;color:var(--sub);font-weight:600}}
/* 縦棒 */
.vchart{{display:flex;align-items:flex-end;gap:3px;border-bottom:1px solid var(--line)}}
.vchart .col{{flex:1;min-width:0;display:flex;flex-direction:column}}
.vchart .stk{{height:var(--h);display:flex;flex-direction:column-reverse}}
.vchart .stk i{{display:block;border-radius:2px 2px 0 0;min-height:2px}}
.vchart .stk b{{font-size:10.5px;font-weight:600;text-align:center;color:var(--ink);line-height:14px}}
.vchart .lab{{height:16px;font-size:10.5px;color:var(--sub);text-align:center;white-space:nowrap;overflow:visible}}
.legend{{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--sub);margin-top:6px}}
.legend i{{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}}
/* 割合の帯 */
.split + .split{{margin-top:10px}} .split .st{{font-size:12.5px;color:var(--sub)}}
.sbar{{display:flex;height:12px;border-radius:6px;overflow:hidden;background:#2a303a;margin-top:3px}} .sbar i{{display:block}}
/* 進み具合の横棒 */
.hrow{{display:grid;grid-template-columns:minmax(0,8.8em) 1fr 3.6em;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)}}
.hrow .hl b{{display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.hrow .hl small{{display:block;font-size:10.5px;color:var(--sub)}}
.track{{position:relative;height:12px;background:#232933;border-radius:6px}}
.track i{{position:absolute;left:0;top:0;bottom:0;border-radius:6px}} .track .t{{background:#4b5b72}} .track .c{{background:var(--gold)}}
.hrow .hr{{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}} .hrow .hr span{{color:var(--sub);font-weight:400;font-size:12px}}
.hrow .hr small{{display:block;font-size:10.5px;color:var(--warn);font-weight:600}}
.hrow.hot{{background:#3a1f22}} .hrow.hot .track .c{{background:var(--warn)}}
/* カードのタイル */
.ctabs > input{{position:absolute;opacity:0;pointer-events:none}}
.ctabs > label{{display:inline-block;padding:6px 12px;margin:0 6px 10px 0;border:1px solid var(--line);border-radius:999px;font-size:13px;cursor:pointer;color:var(--sub)}}
#cs1:checked + label,#cs2:checked + label,#cs3:checked + label{{background:var(--gold);color:#1a1408;border-color:var(--gold);font-weight:700}}
.ctabs > input:focus-visible + label{{outline:2px solid var(--gold);outline-offset:2px}}
.pane{{display:none}} #cs1:checked ~ .p1,#cs2:checked ~ .p2,#cs3:checked ~ .p3{{display:block}}
.cgrid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px}}
.ct{{background:var(--card);border:1px solid var(--line);border-top:3px solid var(--el);border-radius:7px;padding:4px;min-width:0}}
.ct img,.ct .noimg{{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:5px;background:#232933}}
.ct .cn{{font-size:11px;font-weight:700;line-height:1.3;margin-top:4px;height:2.6em;overflow:hidden}}
.ct .cb{{height:5px;background:#232933;border-radius:3px;margin:3px 0}} .ct .cb i{{display:block;height:100%;background:var(--el);border-radius:3px}}
.ct .cv{{font-size:10.5px;color:var(--sub);line-height:1.35;font-variant-numeric:tabular-nums}}
details{{margin-top:8px}} summary{{cursor:pointer;color:var(--sub);font-size:13px;padding:4px 0}}
/* 表（「数字で見る」の中） */
.wrap{{overflow-x:auto}} table{{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}}
th,td{{padding:6px 6px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap;vertical-align:top}}
th{{color:var(--sub);font-weight:600;font-size:12px}} td small{{display:block;color:var(--sub);font-size:11px}}
tr.warn td{{background:#3a1f22}}
</style></head><body><main>
<h1>TRI-ELEMENTS の遊ばれ方</h1>
<div class="sub">{now.strftime('%Y/%m/%d %H:%M')} 時点 ／ 匿名データ（名前・セーブの中身は含まない）／ 20分ごとに更新</div>
<p><a class="livebtn" href="live.html">● いま遊んでいる人を見る</a></p>
<div class="kpi">
 <div><b>{len(players)}</b><span>遊んだ端末</span></div>
 <div><b>{len(sessions)}</b><span>起動した回数</span></div>
 <div><b>{med_min:.1f}分</b><span>1回の長さ（真ん中の値）</span></div>
 <div><b>{long_share:.0f}%</b><span>10分以上遊んだ回</span></div>
 <div><b>{len(returned)}</b><span>別の日にも来た端末</span></div>
 <div><b>{optout}</b><span>送信を止めた端末</span></div>
 <div><b>{n_fb}<small style="font-size:14px;color:var(--sub)"> / {n_thanks}</small></b><span>感想ボタン／お礼が出た回数</span></div>
</div>

<h2>日ごと</h2>
<div class="box"><h3>遊んだ端末</h3>{vchart(cols_players) if days else '<p class="note">まだありません</p>'}
{legend([('はじめて', C_NEW), ('また来た', C_BACK)])}</div>
<div class="box"><h3>対戦した回数</h3>{vchart(cols_battles) if days else '<p class="note">まだありません</p>'}</div>
<details><summary>数字で見る</summary><div class="wrap"><table><tr><th>日</th><th>端末</th><th>はじめて</th><th>起動</th><th>対戦</th></tr>{rows_day}</table></div></details>

<h2>1回に遊んだ長さ</h2>
<div class="box">{vchart(cols_len, 100) if lengths else '<p class="note">まだありません</p>'}</div>

<h2>どこで遊ばれているか</h2>
<div class="box">{split_bar('場所', where, PAL)}{split_bar('端末', dev, PAL)}{split_bar('言語', lng, PAL)}</div>

<h2>ストーリーの進み具合</h2>
<p class="note">金＝突破した端末、灰＝挑んだ端末。数字は「突破／挑んだ」。
赤い行は「ここで勝てずに先へ進んでいない端末」が3人以上かつ3割以上（難しすぎるかも）</p>
<div class="box">{funnel or '<p class="note">まだありません</p>'}</div>
<details><summary>数字で見る（勝率・ターン数）</summary><div class="wrap"><table><tr><th>ライバル</th><th>挑んだ</th><th>突破</th><th>勝率</th><th>ターン</th><th>止まり</th></tr>{rows_stage}</table></div></details>

<h2>フリーバトル</h2>
<div class="wrap"><table><tr><th>難易度</th><th>端末</th><th>勝ち</th><th>負け</th><th>投了</th></tr>{rows_free or '<tr><td colspan="5">まだありません</td></tr>'}</table></div>

<h2>選定の儀（2ピック）</h2>
<div class="box">{f'''<p>挑戦 <b>{len(dr_start)}</b>回 ／ 最後まで {len(dr_done)}回 ／ やめた {len(dr_quit)}回 ／ 対戦 {len(dr_battles)}戦・勝率 {dr_wr:.0f}%</p>
{split_bar('選ばれた組み合わせ', dr_pairs, ['#e0714f', '#4f93e0', '#5bb56c'])}
{vchart([(f"{w}勝", [(dr_wins.get(w, 0), C_NEW)], True) for w in range(6)], 90) if dr_done else '<p class="note">まだ最後まで遊んだ人はいません</p>'}
{f"""<details><summary>数字で見る（組み合わせ・何戦目ごとの勝率）</summary><div class="wrap"><table><tr><th>自分</th><th>相手</th><th>対戦</th><th>勝率</th></tr>{''.join(f'<tr><td>{PAIR_JA.get(a, e(a))}</td><td>{PAIR_JA.get(b, e(b))}</td><td>{c[0]}</td><td>{c[1] / c[0] * 100:.0f}%</td></tr>' for (a, b), c in sorted(dr_mu.items()))}</table>
<table><tr><th>何戦目</th><th>対戦</th><th>勝率</th></tr>{''.join(f'<tr><td>{n}戦目</td><td>{c[0]}</td><td>{c[1] / c[0] * 100:.0f}%</td></tr>' for n, c in sorted(dr_bn.items()))}</table></div></details>""" if dr_mu else ''}''' if dr_start else '<p class="note">まだありません</p>'}</div>

<h2>カード</h2>
<p class="note">採用＝対戦のデッキに入っていた割合（全{nb}戦）／勝率＝入っていた対戦で勝った割合（投了は負け）。
戦う相手の強さが混ざるので、勝率は数十戦たまってから見る。<br>{starter_line}</p>
{cards_html}

<h2>開けたパック</h2>
<p>{'　'.join(f'{e(str(k))} {v}' for k, v in packs.most_common()) or 'まだありません'}</p>
<p class="note">データは設定→データ「遊び方の統計を送る」を切った端末からは届きません。</p>
</main></body></html>"""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        fh.write(doc)
    os.replace(tmp, OUT)
    print(f'{len(ev)} events, {len(players)} players -> {OUT}')


if __name__ == '__main__':
    main()
