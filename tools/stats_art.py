# -*- coding: utf-8 -*-
"""集計ページ（stats_report.py）のカードタイル用に、カードの絵を小さなJPGにする。

    python tools/stats_art.py      → release/stats_art/<id>.jpg（128px・1枚5KB前後）
サーバーの /opt/te-stats/www/art/ へ置く。カードを足したり絵を差し替えたら作り直す。
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
names = json.load(open(os.path.join(ROOT, 'tools', 'card_names.json'), encoding='utf-8'))['names']
out_dir = os.path.join(ROOT, 'release', 'stats_art')
os.makedirs(out_dir, exist_ok=True)
missing = []
for cid in names:
    src = next((p for p in (os.path.join(ROOT, 'public', 'assets', 'art', cid + '.webp'),
                            os.path.join(ROOT, 'assets', 'art', cid + '.png')) if os.path.exists(p)), None)
    if not src:
        missing.append(cid)
        continue
    im = Image.open(src).convert('RGB')
    im.thumbnail((128, 128))
    im.save(os.path.join(out_dir, cid + '.jpg'), quality=72, optimize=True)
print(len(names) - len(missing), 'thumbs ->', out_dir, '/ missing:', missing)
