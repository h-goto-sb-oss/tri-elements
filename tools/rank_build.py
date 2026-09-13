# -*- coding: utf-8 -*-
"""今日の選定の儀のランキング表を作る（サーバーの cron で数分ごと）。

    python3 /opt/te-stats/rank_build.py [ログのフォルダ] [ライバルの点数のフォルダ] [出力フォルダ]

ゲームは、挑戦を終えるたびに /e へ e=rank の記録を送る（src/game/telemetry.js の sendRank）。
Caddy がそれを te-events.log に1行ずつ書くので、その日の「一人ごとの最高点」を集めて表にする。
敵キャラ24人（ライバル）の点数は tools/daily_npc.mjs が別に作る（npc-<日付>.json）。

出力（Caddy が https://te.161-33-217-165.nip.io/lb/ で配る。ゲームから読むので CORS を付けてある）:
    today.json   { now, today: 表, yesterday: 表 }
    表 = { day, players: 人数, entries: [{ rk, nm, ti, av, sc, w }]（上位100人）, rivals: [{ key, sc, w }] }

名前はゲーム側でも整えているが、ここでもう一度だけ確かめる（長さ・ひどい言葉・記号）。
点数は細工して送ることもできてしまう（匿名なので防ぎきれない）。ありえない値だけははじく。
"""
import glob
import gzip
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlsplit

LOG_DIR = sys.argv[1] if len(sys.argv) > 1 else '/var/log/caddy'
NPC_DIR = sys.argv[2] if len(sys.argv) > 2 else '/opt/te-stats/npc'
OUT_DIR = sys.argv[3] if len(sys.argv) > 3 else '/opt/te-stats/pub'
JST = timezone(timedelta(hours=9))
SCORE_MAX = 11500   # src/game/daily.js の SCORE_MAX と同じ
TOP = 100
NG = ['死ね', 'しね', '殺す', 'ころす', 'ちんこ', 'まんこ', 'セックス', 'レイプ', 'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga',
      'rape', 'sex', 'penis', 'pussy', 'kill yourself', 'kys']
RE_RK = re.compile(r'^[a-z0-9]{6,16}$')
RE_TI = re.compile(r'^[a-z0-9_]{1,20}$')
RE_AV = re.compile(r'^(\d{1,2}|c:a\d:\d)$')


def clean_name(n):
    n = re.sub(r'[\x00-\x1f\x7f<>]', '', n or '').strip()[:12]
    low = re.sub(r'\s+', ' ', n.lower())
    if not n or any(w in low for w in NG):
        return None
    return n


def day_of(ts):
    return datetime.fromtimestamp(ts, JST).strftime('%Y-%m-%d')


def prev_day(day):
    return (datetime.strptime(day, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d')


def read_ranks(days):
    best = {d: {} for d in days}
    for f in sorted(glob.glob(os.path.join(LOG_DIR, 'te-events*.log*'))):
        opener = gzip.open if f.endswith('.gz') else open
        try:
            fh = opener(f, 'rt', encoding='utf-8', errors='replace')
        except OSError:
            continue
        with fh:
            for line in fh:
                if 'e=rank' not in line:
                    continue
                try:
                    j = json.loads(line)
                except ValueError:
                    continue
                uri = (j.get('request') or {}).get('uri') or ''
                if not uri.startswith('/e?'):
                    continue
                q = dict(parse_qsl(urlsplit(uri).query))
                if q.get('e') != 'rank' or q.get('v') != '1':
                    continue
                ts = float(j.get('ts', 0))
                d = q.get('d', '')
                # 日付は、送った時刻の「今日」か「昨日」（0時をまたいで終わった挑戦）だけ受ける
                if d not in best or d not in (day_of(ts), prev_day(day_of(ts))):
                    continue
                rk = q.get('rk', '')
                try:
                    sc, w = int(q.get('sc', '')), int(q.get('w', ''))
                except ValueError:
                    continue
                if not RE_RK.match(rk) or not (0 <= sc <= SCORE_MAX) or not (0 <= w <= 5):
                    continue
                if w == 0 and sc > 5 * 200:          # 負けてもらえる点には上限がある
                    continue
                nm = clean_name(q.get('nm'))
                if not nm:
                    continue
                ti = q.get('ti', '')
                av = q.get('av', '1')
                e = {'rk': rk, 'nm': nm, 'ti': ti if RE_TI.match(ti) else '', 'av': av if RE_AV.match(av) else '1',
                     'sc': sc, 'w': w, '_ts': ts}
                cur = best[d].get(rk)
                if cur is None or sc > cur['sc'] or (sc == cur['sc'] and ts < cur['_ts']):
                    best[d][rk] = e
                else:
                    # 点数は前の最高点のままでも、名前・称号・アイコンは新しいほうにそろえる
                    cur.update(nm=nm, ti=e['ti'], av=e['av'])
    return best


def table(day, entries):
    rows = sorted(entries.values(), key=lambda e: (-e['sc'], e['_ts']))
    for e in rows:
        e.pop('_ts', None)
    rivals = []
    try:
        with open(os.path.join(NPC_DIR, f'npc-{day}.json'), encoding='utf-8') as fh:
            rivals = [{'key': r['key'], 'sc': r['score'], 'w': r['wins']} for r in json.load(fh).get('rivals', [])]
    except (OSError, ValueError, KeyError):
        pass
    return {'day': day, 'players': len(rows), 'entries': rows[:TOP], 'rivals': rivals}


def main():
    now = datetime.now(JST)
    today = now.strftime('%Y-%m-%d')
    yday = prev_day(today)
    best = read_ranks([today, yday])
    out = {'now': now.strftime('%Y-%m-%d %H:%M'), 'today': table(today, best[today]), 'yesterday': table(yday, best[yday])}
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = os.path.join(OUT_DIR, 'today.json.tmp')
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, os.path.join(OUT_DIR, 'today.json'))
    # 日ごとの控え（あとで振り返れるように）
    with open(os.path.join(OUT_DIR, f'daily-{yday}.json'), 'w', encoding='utf-8') as fh:
        json.dump(out['yesterday'], fh, ensure_ascii=False, separators=(',', ':'))
    print(f"{today}: {out['today']['players']} players, {len(out['today']['rivals'])} rivals / {yday}: {out['yesterday']['players']}")


if __name__ == '__main__':
    main()
