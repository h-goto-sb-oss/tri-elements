# -*- coding: utf-8 -*-
"""敵キャラ24人の小さな顔アイコン（160px）を作る。

アイコン（プロフィール・ランキング・タイトルの顔）は 40〜90px でしか出さないのに、
立ち絵（assets/enemies、最大1254px）をそのまま読むと、ランキングで24人ぶん数MB になり、
スマホでは顔が出るまで十数秒かかっていた。

  python tools/enemy_icons.py   → assets/enemy_icons/<a1_0>.png（160×160）
  そのあと python tools/optimize_assets.py

切り抜きの位置は src/ui/main.js の FACE_Y（立ち絵の中で顔の中心が上から何割か）を読んで使う。
"""
import os
import re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = 160


def main():
    amap = open(os.path.join(ROOT, 'src', 'ui', 'assets_map.js'), encoding='utf-8').read()
    block = amap[amap.index('export const ENEMY_ART'):]
    block = block[:block.index('};')]
    art = dict(re.findall(r'"(a\d:\d)":\s*"([^"]+)"', block))
    main_js = open(os.path.join(ROOT, 'src', 'ui', 'main.js'), encoding='utf-8').read()
    fy_block = main_js[main_js.index('const FACE_Y = {'):]
    fy_block = fy_block[:fy_block.index('};')]
    face_y = {k: float(v) for k, v in re.findall(r"'(a\d:\d)':\s*([0-9.]+)", fy_block)}
    out = os.path.join(ROOT, 'assets', 'enemy_icons')
    os.makedirs(out, exist_ok=True)
    for key, url in sorted(art.items()):
        src = os.path.join(ROOT, 'assets', 'enemies', os.path.basename(url).replace('.webp', '.png'))
        im = Image.open(src).convert('RGBA')
        w, h = im.size
        side = int(w * 0.56)                                  # 顔と肩が入るくらい
        cy = int(h * (face_y.get(key, 0.42) + 0.06))          # 顔の中心より少し下を中心に（あごと肩まで）
        top = max(0, min(h - side, cy - side // 2))
        left = (w - side) // 2
        icon = im.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS)
        bg = Image.new('RGBA', icon.size, (14, 20, 32, 255))  # 透明な部分は濃紺で埋める（アイコンの枠の色）
        bg.alpha_composite(icon)
        bg.convert('RGB').save(os.path.join(out, key.replace(':', '_') + '.png'))
        print(key, os.path.basename(src), (left, top, side))


if __name__ == '__main__':
    main()
