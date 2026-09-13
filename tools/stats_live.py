# -*- coding: utf-8 -*-
"""「今遊んでいる人」のページ（live.html）を作る。サーバーの cron で1分ごと。

    python3 /opt/te-stats/stats_live.py [ログ] [出力HTML]

記録の最後の方（数千行）だけ読むので軽い。重い集計は stats_report.py（20分ごと）。
「今遊んでいる」＝最後の動きが ACTIVE_MIN 分以内で、最後が「閉じた（hide）」ではない端末。
デッキを組んでいる間などは記録が出ないので、しばらく動きが無いと一覧から外れることがある。
"""
import html
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlsplit

LOG = sys.argv[1] if len(sys.argv) > 1 else '/var/log/caddy/te-events.log'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/opt/te-stats/www/live.html'
JST = timezone(timedelta(hours=9))
ACTIVE_MIN = 10
TAIL_BYTES = 1_500_000
FEED = 40

NAMES = {}
try:
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ach_names.json'), encoding='utf-8') as _fh:
        ACH_NAMES = json.load(_fh)
except (OSError, ValueError):
    ACH_NAMES = {}
for a, ens in [('a1', ['見習いのトト', '罠師のガロ', '草原の主 モーリー']), ('a2', ['火の子ピリカ', '溶岩守りゴウ', '炎皇バルガ']),
               ('a3', ['潮見のミナ', '氷壁のヴァル', '海皇ネプト']), ('a4', ['蔦使いリム', '森の狩人ヨナ', '世界樹の守護者 ヴェルダ']),
               ('a5', ['双子の術士 フレア & ミスト', '無銘の剣士', '三属の王 トリアデス']),
               ('a6', ['観測者リィナ', '歯車の巡礼者 カルダン', '黄昏の門番 オルド']),
               ('a7', ['星読みのユエ', '彗星騎士 カイロス', '門の守り手 アステル']),
               ('a8', ['無貌の使者 ノクス', '双極の女王 ディオーネ', '星辰王 アストラリス'])]:
    for i, n in enumerate(ens):
        NAMES[f'{a}:{i}'] = n
DIFF = {'normal': 'ノーマル', 'hard': '強化', 'extreme': '極'}
SCREEN = {'battle': '対戦中', 'adventure': '冒険のマップ', 'free': 'フリーバトル', 'deck': 'デッキ編集', 'collection': '図鑑',
          'title': 'タイトル', 'settings': '設定', 'rules': 'ルール', 'shop': 'ショップ'}
OWNER = {'neyqzar7'}   # 作者自身の端末（stats_report.py と同じ）
KNOWN = {'open', 'lang', 'start', 'end', 'pack', 'hide', 'optout', 'thanks', 'fb', 'draft', 'ach', 'rank'}
E = html.escape


def events():
    try:
        with open(LOG, 'rb') as fh:
            fh.seek(0, 2)
            size = fh.tell()
            fh.seek(max(0, size - TAIL_BYTES))
            raw = fh.read().decode('utf-8', 'replace')
    except OSError:
        return []
    lines = raw.split('\n')
    if size > TAIL_BYTES:
        lines = lines[1:]            # 途中から読んだ最初の行は欠けている
    out = []
    for line in lines:
        try:
            j = json.loads(line)
        except ValueError:
            continue
        uri = (j.get('request') or {}).get('uri') or ''
        if not uri.startswith('/e?'):
            continue
        q = dict(parse_qsl(urlsplit(uri).query))
        if q.get('v') != '1' or not q.get('u') or q.get('e') not in KNOWN or q['u'].startswith('claudetest'):
            continue
        if q['u'] in OWNER:
            continue
        q['_ts'] = datetime.fromtimestamp(float(j.get('ts', 0)), JST)
        out.append(q)
    return out


ADJ = ['炎の', '水の', '草の', '星の', '月の', '風の', '雷の', '氷の', '森の', '夜の', '光の', '霧の']
ANI = ['キツネ', 'ネコ', 'フクロウ', 'オオカミ', 'ウサギ', 'クマ', 'タカ', 'カメ', 'リス', 'シカ', 'クジラ', 'ドラゴン']
HUE = [18, 200, 120, 45, 270, 330, 170, 90, 230, 0, 60, 300]


def _h(u):
    """id から毎回同じ数を作る（Python の hash() は起動ごとに変わるので自前で）"""
    n = 0
    for ch in u:
        n = (n * 131 + ord(ch)) % 1_000_003
    return n


def who(q):
    return q['u'][-4:].upper()


def nick(u):
    """乱数の id から決まるニックネーム（個人の情報は使わない）"""
    n = _h(u)
    return ADJ[n % len(ADJ)] + ANI[(n // len(ADJ)) % len(ANI)]


def hue(u):
    return HUE[(_h(u) // 7) % len(HUE)]


def chip(u):
    return f'<span class="nk" style="--hu:{hue(u)}">{E(nick(u))}</span>'


def enemy(q):
    n = NAMES.get(q.get('k'), q.get('k') or '?')
    if q.get('dr') == '1':
        return f'選定の儀 {n}'
    if q.get('f') == '1':
        return f'フリー（{DIFF.get(q.get("df"), q.get("df"))}）{n}'
    return n


def say(q):
    e = q['e']
    if e == 'open':
        if q.get('n') == '1':
            return '🆕 はじめて開いた'
        return f'開いた（突破済み {q.get("p", "?")}人）'
    if e == 'lang':
        return f'言語を選んだ：{"日本語" if q.get("l") == "ja" else "English"}'
    if e == 'start':
        return f'⚔️ {enemy(q)} に挑戦'
    if e == 'end':
        r = q.get('r')
        tn = f'（{q.get("tn")}ターン）' if q.get('tn') else ''
        if r == 'w':
            extra = ' ✨初突破' if q.get('fc') == '1' else ''
            extra += ' 🎴キャラカード獲得' if q.get('cc') == '1' else ''
            return f'🏆 {enemy(q)} に勝利{tn}{extra}'
        if r == 'l':
            return f'💥 {enemy(q)} に負け{tn}'
        return f'🏳️ {enemy(q)} で投了'
    if e == 'pack':
        return '🎁 パックを開けた' + ('（ショップ）' if q.get('shop') == '1' else '')
    if e == 'hide':
        return f'💤 閉じた／裏に回した（{SCREEN.get(q.get("sc"), q.get("sc"))}）'
    if e == 'optout':
        return '送信を止めた'
    if e == 'draft':
        pj = {'fire,water': '炎×水', 'water,grass': '水×草', 'grass,fire': '草×炎'}.get(q.get('pr'), '')
        st = q.get('st')
        if st == 'start':
            return f'🃏 選定の儀を始めた（{pj}）'
        if st == 'done':
            return f'🏅 選定の儀 終了：{q.get("w", "?")}勝（{pj}）'
        if st == 'quit':
            return '選定の儀をやめた'
        if st == 'dstart':
            return f'🗓 今日の選定の儀を始めた（{pj}）'
        if st == 'daily':
            return f'🗓 今日の選定の儀 終了：{q.get("sc", "?")}点'
        if st == 'dquit':
            return '今日の選定の儀をやめた'
        if st == 'card':
            rite = {'r_shiena': 'シエナ', 'r_mirte': 'ミルテ', 'r_kagura': 'カグラ', 'r_elsion': 'エルシオン'}
            return f'🎴 限定カードを入手：{rite.get(q.get("c"), q.get("c"))}'
    if e == 'rank':
        return f'🏆 今日の選定の儀を記録：{q.get("sc", "?")}点（{q.get("w", "?")}勝）'
    if e == 'ach':
        return f'🏆 実績を解除：{ACH_NAMES.get(q.get("a"), q.get("a"))}'
    if e == 'thanks':
        return '💌 お礼のメッセージが出た（' + ('ラスボス初撃破' if q.get('k') == 'final' else 'キャラカード初入手') + '）'
    if e == 'fb':
        return '📣 感想ボタンを押した（' + ('X' if q.get('to') == 'x' else 'itch.io') + '）'
    return e


def ago(td):
    m = int(td.total_seconds() // 60)
    return 'たった今' if m < 1 else f'{m}分前'


def main():
    ev = events()
    now = datetime.now(JST)
    by_u = defaultdict(list)
    for q in ev:
        by_u[q['u']].append(q)

    cards = []
    for u, xs in by_u.items():
        last = xs[-1]
        if now - last['_ts'] > timedelta(minutes=ACTIVE_MIN) or last['e'] in ('hide', 'optout'):
            continue
        sess = [q for q in xs if q.get('s') == last.get('s')]
        start_ts = sess[0]['_ts'] - timedelta(seconds=int(sess[0].get('t') or 0))
        w = sum(1 for q in sess if q['e'] == 'end' and q.get('r') == 'w')
        l = sum(1 for q in sess if q['e'] == 'end' and q.get('r') in ('l', 'q'))
        # 今なにをしているか：最後の開始に終わりがまだ来ていなければ「対戦中」
        doing = say(last)
        if last['e'] == 'start':
            doing = f'⚔️ <b>{E(enemy(last))}</b> と対戦中'
        first = next((q for q in xs if q['e'] == 'open'), sess[0])
        tags = ' · '.join(filter(None, [
            'itch.io' if last.get('h') == 'itch' else ('GitHub' if last.get('h') == 'gh' else ''),
            'スマホ' if first.get('m') == '1' else 'PC',
            {'ja': '日本語', 'en': 'English'}.get(first.get('l'), ''),
        ]))
        base = max((int(q.get('p') or 0) for q in xs if q['e'] == 'open'), default=0)
        last_open = max((i for i, q in enumerate(xs) if q['e'] == 'open'), default=0)
        cleared = min(24, base + sum(1 for q in xs[last_open:] if q['e'] == 'end' and q.get('fc') == '1'))
        cards.append((last['_ts'], f'''<div class="pc" style="--hu:{hue(u)}">
  <div class="top">{chip(u)}<span class="tg">{E(tags)}</span><span class="ago">{ago(now - last['_ts'])}</span></div>
  <div class="prog"><i style="width:{cleared / 24 * 100:.0f}%"></i></div><div class="progt">ストーリー {cleared}/24 突破</div>
  <div class="doing">{doing if last['e'] == 'start' else E(doing)}</div>
  <div class="meta">この回 {int((now - start_ts).total_seconds() // 60)}分 ／ {w}勝 {l}敗</div>
</div>'''))
    cards.sort(key=lambda c: c[0], reverse=True)

    # 挑戦→結果 は1行にまとめる。同じ人の「閉じた」が続くときは1回だけ
    items = []
    open_start = {}
    for q in ev:
        u = q['u']
        if q['e'] == 'start':
            open_start[u] = len(items)
            items.append(q)
            continue
        if q['e'] == 'end' and u in open_start and items[open_start[u]].get('k') == q.get('k'):
            items[open_start.pop(u)] = None
        if q['e'] == 'hide' and items and items[-1] is not None and items[-1]['u'] == u and items[-1]['e'] == 'hide':
            continue
        items.append(q)
    items = [q for q in items if q is not None]
    def cls(q):
        if q['e'] == 'end':
            return {'w': 'win', 'l': 'lose', 'q': 'lose'}.get(q.get('r'), '')
        return {'start': 'fight', 'hide': 'dim', 'open': 'open', 'thanks': 'win', 'fb': 'win'}.get(q['e'], '')
    def line(q):
        t = say(q)
        if q['e'] == 'end' and q.get('sec'):
            t = t.replace('ターン）', f'ターン・{max(1, int(q["sec"]) // 60)}分）', 1)
        if q['e'] == 'start':
            t = t + ('（対戦中）' if by_u[q['u']][-1] is q else '（中断）')
        return t
    feed = ''.join(
        f'<li class="{cls(q)}"><time>{q["_ts"].strftime("%H:%M")}</time>{chip(q["u"])}<span class="tx">{E(line(q))}</span></li>'
        for q in reversed(items[-FEED:]))
    today = {q['u'] for q in ev if q['_ts'].date() == now.date()}

    doc = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="30">
<title>TRI-ELEMENTS いま</title>
<style>
:root{{--bg:#12151c;--card:#1b2029;--line:#2c3440;--ink:#e8e4da;--sub:#9aa3b0;--gold:#d9b25f;--live:#5bd68a}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 "Hiragino Sans","Yu Gothic",sans-serif}}
main{{max-width:760px;margin:0 auto;padding:18px 14px 40px}}
h1{{font-size:20px;color:var(--gold);margin:0}} h2{{font-size:16px;color:var(--gold);margin:24px 0 8px}}
.sub{{color:var(--sub);font-size:12.5px}} .sub a{{color:var(--gold)}}
.now{{display:flex;align-items:center;gap:10px;margin:14px 0 6px;font-size:15px}}
.dot{{width:10px;height:10px;border-radius:50%;background:var(--live);box-shadow:0 0 0 0 #5bd68a88;animation:p 1.6s infinite}}
.dot.off{{background:#56606d;animation:none}}
@keyframes p{{70%{{box-shadow:0 0 0 10px #5bd68a00}}100%{{box-shadow:0 0 0 0 #5bd68a00}}}}
@media (prefers-reduced-motion:reduce){{.dot{{animation:none}}}}
.now b{{font-size:26px;font-variant-numeric:tabular-nums}}
.pc{{background:var(--card);border:1px solid var(--line);border-left:4px solid hsl(var(--hu) 60% 55%);border-radius:10px;padding:10px 12px;margin-top:8px}}
.nk{{display:inline-block;flex:none;font-weight:700;font-size:12.5px;padding:1px 8px;border-radius:999px;color:hsl(var(--hu) 70% 80%);background:hsl(var(--hu) 35% 22%)}}
.prog{{height:5px;background:#232933;border-radius:3px;margin:6px 0 1px}} .prog i{{display:block;height:100%;border-radius:3px;background:var(--gold)}}
.progt{{font-size:11.5px;color:var(--sub)}}
.pc .top{{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--sub)}}
.pc .top .ago{{margin-left:auto}} .id{{font-weight:700;color:var(--gold);font-variant-numeric:tabular-nums}}
.pc .doing{{font-size:16px;margin:4px 0 2px}} .pc .meta{{font-size:12.5px;color:var(--sub)}}
.empty{{color:var(--sub);background:var(--card);border:1px dashed var(--line);border-radius:10px;padding:14px;text-align:center}}
ul.feed{{list-style:none;margin:0;padding:0}}
ul.feed li{{display:flex;gap:8px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line);font-size:13.5px}}
ul.feed time{{color:var(--sub);font-variant-numeric:tabular-nums;flex:none}}
ul.feed li.win .tx{{color:#8fe3a8}} ul.feed li.lose .tx{{color:#f0948c}} ul.feed li.dim .tx{{color:var(--sub)}} ul.feed li.fight .tx{{color:#e8d6a8}}
</style></head><body><main>
<h1>TRI-ELEMENTS いま遊んでいる人</h1>
<div class="sub">{now.strftime('%H:%M:%S')} 更新 ／ 1分ごとに更新・30秒ごとに読み込み直し ／ <a href="./">全体の集計へ</a></div>
<div class="now"><span class="dot{'' if cards else ' off'}"></span><b>{len(cards)}</b>人が遊んでいます<span class="sub">（今日 {len(today)}台）</span></div>
{''.join(c for _, c in cards) or '<div class="empty">いまは誰もいません。最後の動きから10分たつと一覧から外れます</div>'}
<h2>できごとの流れ</h2>
<ul class="feed">{feed or '<li>まだありません</li>'}</ul>
<p class="sub">名前は端末ごとの乱数から自動で付けたニックネームです（誰かは分かりません）。デッキを組んでいる間などは記録が出ないので、遊んでいても一覧から外れることがあります。</p>
</main></body></html>"""
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        fh.write(doc)
    os.replace(tmp, OUT)
    print(f'{len(ev)} events, {len(cards)} live -> {OUT}')


if __name__ == '__main__':
    main()
