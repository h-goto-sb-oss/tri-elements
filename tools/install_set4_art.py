# -*- coding: utf-8 -*-
# ============================================================
# 第4弾のイラストを assets/art へ取り込む。
#   1. 焼き込まれた市松を消す
#   2. 消しすぎでできた穴を、周りの色で埋める（縮小する前にやること）
#   3. カードの絵枠に合う位置で切り出して 512px にする
#      モンスターは顔が枠に収まる位置、効果カードは構図を保つ
#   使い方: python tools/install_set4_art.py [--dry]
# ============================================================
import importlib.util
import os
import re
import sys

from PIL import Image

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, 'tools')
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

import adopt_char_art as A                                    # noqa: E402
spec = importlib.util.spec_from_file_location('unbake', 'tools/unbake_checker.py')
U = importlib.util.module_from_spec(spec); spec.loader.exec_module(U)

SRC = 'assets/art/set4-iron-banner'
IDS = ['b_f1', 'b_f2', 'b_f3', 'b_f4', 'b_f5', 'b_lf1', 'b_sf1', 'b_sf2', 'b_sf3',
       'b_w1', 'b_w2', 'b_w3', 'b_w4', 'b_w5', 'b_lw1', 'b_sw1', 'b_sw2', 'b_sw3',
       'b_g1', 'b_g2', 'b_g3', 'b_g4', 'b_g5', 'b_lg1', 'b_sg1', 'b_sg2', 'b_sg3',
       'b_n1', 'b_n2', 'b_n3', 'b_n4', 'b_ln1', 'b_sn1', 'b_sn2']


def centre_zoom(im, fill=0.96):
    """効果カード用。構図を崩さず、中身が枠いっぱいに来るまで寄せるだけ"""
    x0, y0, x1, y1 = A.solid_bbox(im)
    side = int(round(max(x1 - x0, y1 - y0) / fill))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    return im.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side))


def main():
    dry = '--dry' in sys.argv
    src = open('src/engine/cards_set4.js', encoding='utf-8').read()
    kind = {m.group(2): m.group(1) for m in re.finditer(r"\b([MS])\('(b_\w+)'", src)}
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.png'))
    assert len(files) == len(IDS), f'{len(files)} 枚 / ID {len(IDS)} 個'

    for f, cid in zip(files, IDS):
        im = Image.open(os.path.join(SRC, f))
        im, checker = U.unbake(im)
        im, holes = U.fill_holes(im)
        im = (A.square_bust(im) if kind[cid] == 'M' else centre_zoom(im))
        im = im.resize((512, 512), Image.LANCZOS)
        if not dry:
            im.save(f'assets/art/{cid}.png')
        note = []
        if checker: note.append(f'市松 {checker * 100:.1f}%')
        if holes: note.append(f'穴 {holes}px')
        print(f'  {cid:7} ← {f}  {"顔に合わせて切り出し" if kind[cid] == "M" else "構図のまま寄せ"}'
              + ('  / ' + '・'.join(note) if note else ''))
    print(f'\n{len(files)} 枚' + ('（--dry のため書き出していません）' if dry else ' を入れました'))


if __name__ == '__main__':
    main()
