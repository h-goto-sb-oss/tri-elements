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
KNOWN = {'open', 'lang', 'start', 'end', 'pack', 'hide', 'optout'}


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
        day = q['_ts'].strftime('%m/%d')
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
        if q.get('f') == '1':
            if q['e'] == 'end':
                fd = free[q.get('df') or '?']
                fd[q.get('r', '?')] = fd.get(q.get('r', '?'), 0) + 1
                fd['u'].add(q['u'])
            continue
        if k not in st:
            continue
        s = st[k]
        if q['e'] == 'start':
            s['try'].add(q['u'])
        else:
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

    packs = Counter(q.get('p') for q in ev if q['e'] == 'pack')
    optout = len({q['u'] for q in ev if q['e'] == 'optout'})

    # ================= HTML =================
    now = datetime.now(JST).strftime('%Y/%m/%d %H:%M')
    e = html.escape

    rows_day = ''.join(
        f'<tr><td>{d}</td><td>{len(x["u"])}</td><td>{len(x["new"])}</td><td>{len(x["s"])}</td><td>{x["battles"]}</td></tr>'
        for d, x in sorted(by_day.items()))

    rows_stage = ''
    for k, label, name in STAGES:
        s = st[k]
        if not s['try'] and not (s['w'] + s['l'] + s['q']):
            continue
        n = s['w'] + s['l'] + s['q']
        wr = f"{s['w'] / n * 100:.0f}%" if n else '—'
        mt = f"{statistics.median(s['turns']):.0f}" if s['turns'] else '—'
        stuck_n = stuck.get(k, 0)
        warn = ' class="warn"' if stuck_n >= 3 and stuck_n >= len(s['try']) * 0.3 else ''
        rows_stage += (f'<tr{warn}><td><b>{e(name)}</b><small>{e(label)}</small></td>'
                       f'<td>{len(s["try"])}</td><td>{len(s["clear"])}</td>'
                       f'<td>{wr}<small>{s["w"]}勝{s["l"]}敗{s["q"]}投</small></td><td>{mt}</td><td>{stuck_n or ""}</td></tr>')

    nb = len(deck_battles)
    rows_card = ''
    for cid, n in use.most_common(30):
        wr = use_w[cid] / n * 100 if n else 0
        rows_card += (f'<tr><td><b>{e(cn.get(cid, cid))}</b><small>{e(cid)}</small></td>'
                      f'<td>{n / nb * 100:.0f}%<small>{n}戦</small></td><td>{wr:.0f}%</td></tr>')
    starter_line = (f'最初のデッキのまま戦っている端末：{starter_users} / {len(last_deck)}'
                    if last_deck else '')

    rows_free = ''.join(
        f'<tr><td>{DIFF.get(d, d)}</td><td>{len(x["u"])}</td><td>{x.get("w", 0)}</td><td>{x.get("l", 0)}</td><td>{x.get("q", 0)}</td></tr>'
        for d, x in sorted(free.items()))

    def split(c):
        tot = sum(c.values()) or 1
        return '　'.join(f'{e(str(k))} {v}人（{v / tot * 100:.0f}%）' for k, v in c.most_common())

    doc = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>TRI-ELEMENTS 遊ばれ方</title>
<style>
:root{{--bg:#12151c;--card:#1b2029;--line:#2c3440;--ink:#e8e4da;--sub:#9aa3b0;--gold:#d9b25f;--warn:#e0706a}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 "Hiragino Sans","Yu Gothic",sans-serif}}
main{{max-width:760px;margin:0 auto;padding:18px 14px 40px}}
h1{{font-size:20px;color:var(--gold);margin:0 0 2px}} h2{{font-size:16px;margin:26px 0 8px;color:var(--gold)}}
.sub{{color:var(--sub);font-size:12.5px}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:14px}}
.kpi div{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}}
.kpi b{{display:block;font-size:24px;font-variant-numeric:tabular-nums}} .kpi span{{color:var(--sub);font-size:12.5px}}
.wrap{{overflow-x:auto}} table{{border-collapse:collapse;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}}
th,td{{padding:7px 6px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap;vertical-align:top}}
th{{color:var(--sub);font-weight:600;font-size:12px}} td small{{display:block;color:var(--sub);font-size:11.5px}}
tr.warn td{{background:#3a1f22}} tr.warn td:last-child{{color:var(--warn);font-weight:700}}
.bar{{display:inline-block;width:60px;height:6px;background:#2a303a;border-radius:3px;vertical-align:middle;margin-left:4px}}
.bar i{{display:block;height:100%;border-radius:3px}}
p.note{{color:var(--sub);font-size:12.5px}}
</style></head><body><main>
<h1>TRI-ELEMENTS の遊ばれ方</h1>
<div class="sub">{now} 時点 ／ 匿名データ（名前・セーブの中身は含まない）／ 20分ごとに更新</div>
<div class="kpi">
 <div><b>{len(players)}</b><span>遊んだ端末</span></div>
 <div><b>{len(sessions)}</b><span>起動した回数</span></div>
 <div><b>{med_min:.1f}分</b><span>1回の長さ（真ん中の値）</span></div>
 <div><b>{long_share:.0f}%</b><span>10分以上遊んだ回</span></div>
 <div><b>{len(returned)}</b><span>別の日にも来た端末</span></div>
 <div><b>{optout}</b><span>送信を止めた端末</span></div>
</div>

<h2>どこで遊ばれているか</h2>
<p>{split(where)}<br>{split(dev)}<br>{split(lng)}</p>

<h2>日ごと</h2>
<div class="wrap"><table><tr><th>日</th><th>端末</th><th>はじめて</th><th>起動</th><th>対戦</th></tr>{rows_day}</table></div>

<h2>ストーリー：ライバルごと</h2>
<p class="note">挑んだ＝戦った端末の数 ／ 突破＝一度でも勝った端末 ／ 止まっている＝ここで勝てず、その先に進んでいない端末（赤は3人以上かつ挑んだ人の3割以上）</p>
<div class="wrap"><table><tr><th>ライバル</th><th>挑んだ</th><th>突破</th><th>勝率</th><th>ターン</th><th>止まっている</th></tr>{rows_stage or '<tr><td colspan="6">まだありません</td></tr>'}</table></div>

<h2>フリーバトル</h2>
<div class="wrap"><table><tr><th>難易度</th><th>端末</th><th>勝ち</th><th>負け</th><th>投了</th></tr>{rows_free or '<tr><td colspan="5">まだありません</td></tr>'}</table></div>

<h2>デッキに入っているカード（採用率の高い順・30枚まで）</h2>
<p class="note">採用率＝その対戦のデッキに入っていた割合（全{nb}戦）／勝率＝入っていた対戦で勝った割合（投了は負け扱い）。
戦う相手の強さが混ざるので、勝率は数十戦たまってから見る。<br>{starter_line}</p>
<div class="wrap"><table><tr><th>カード</th><th>採用率</th><th>勝率</th></tr>{rows_card or '<tr><td colspan="3">まだありません</td></tr>'}</table></div>

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
