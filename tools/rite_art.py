# -*- coding: utf-8 -*-
"""
選定の儀の限定カード（r_*）の絵を、カード用に切り抜く。

納品された一枚絵（1024×1024・背景入り）は assets/art_full/<ID>.png に置く。
拡大表示ではその一枚絵を全部見せ、カードには上半身を切り抜いた版を使う。
全身寄りの構図なので、そのまま小さいカード（幅106px）に入れると顔が米粒になるため。

  python tools/rite_art.py      → assets/art/<ID>.png（512×512）を作り直す
  そのあと python tools/adopt_art.py と python tools/optimize_assets.py

切り抜きの枠は (左, 上, 右, 下)。顔が枠の上から3割くらいに来るように決めてある
（カードは正方形の上下を少し切って表示するので、顔を真ん中より上に置く）。
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'art_full')
OUT = os.path.join(ROOT, 'assets', 'art')
SIZE = 512

CROPS = {
    'r_shiena': (140, 34, 860, 754),    # 顔 (500,250)・水の灯籠 (500,560)
    'r_mirte':  (160, 44, 880, 764),    # 顔 (500,260)・水差し (560,600)
    'r_kagura': (190, 114, 910, 834),   # 顔 (450,330)・燃える穂 (740,300)
    'r_elsion': (112, 110, 912, 910),   # 顔 (510,400)・三つの結晶の錫杖 (740,380)
}


def main():
    for cid, box in CROPS.items():
        src = os.path.join(SRC, cid + '.png')
        if not os.path.exists(src):
            print('  無い:', src)
            continue
        im = Image.open(src).convert('RGB')
        im.crop(box).resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, cid + '.png'), optimize=True)
        print(f'  {cid}: {box} -> {SIZE}px')


if __name__ == '__main__':
    main()
