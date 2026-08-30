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
# 高画質の元絵が見つかったものは、そちらから作り直す（1254px）。
# ファイル名がUUIDなので、既存の絵と照合して特定した対応表。
HQ_DIR = 'C:/Users/pc/.codex/generated_images/01a03eb8-7ba3-7f23-92e6-cf59f42eded5'
HQ = {
    'b_w2':  'exec-e5c803ad-d7bc-48a9-9b76-22fe26421181.png',
    'b_w3':  'exec-f29ac67c-1946-41b7-8fb7-9a1a26766715.png',
    'b_w4':  'exec-c3c2cc16-32ef-4fba-9d7d-95734886492e.png',
    'b_w5':  'exec-c957dba9-46df-47fc-bc40-1f77e3a890a5.png',
    'b_lw1': 'exec-5de1ed5f-bc0c-4ef2-80a9-cffbf22470a1.png',
    'b_g3':  'exec-73f96024-2d10-4dfe-b4b2-cbb960e38e57.png',
    'b_g4':  'exec-0786f523-6e7a-4a7d-abb6-a8ee2a42cf89.png',
    'b_g5':  'exec-82507532-c139-4ce3-879e-19639f229fd3.png',
    'b_lg1': 'exec-52440e68-1fdb-4830-982b-8e7c5fa445a5.png',
    'b_ln1': 'exec-f491a8c1-5a7a-4b95-bd13-78a57799c432.png',
    'b_n2':  'exec-ac36ccbd-2782-4f59-9ef2-78c8f7b09763.png',
}
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
        hqp = os.path.join(HQ_DIR, HQ[cid]) if cid in HQ else None
        hq = hqp if hqp and os.path.exists(hqp) else None
        base = Image.open(os.path.join(SRC, f))
        if hq:
            im = Image.open(hq).convert('RGBA')
            # 高画質の元絵は市松が全面に焼き込まれていて透過情報が無い。
            # 構図が同じ（正方形）なら、512版が持っている透過を拡大して移し替えるのが
            # いちばん確実。縦長など構図が違うものは、市松の判定にまかせる。
            if im.width == im.height:
                a = base.convert('RGBA').split()[3].resize(im.size, Image.LANCZOS)
                im.putalpha(a)
        else:
            im = base
        im, checker = U.unbake(im)
        im, holes = U.fill_holes(im)
        im = (A.square_bust(im) if kind[cid] == 'M' else centre_zoom(im))
        im = im.resize((512, 512), Image.LANCZOS)
        if not dry:
            im.save(f'assets/art/{cid}.png')
        note = []
        if checker: note.append(f'市松 {checker * 100:.1f}%')
        if holes: note.append(f'穴 {holes}px')
        print(f'  {cid:7} ← {"高画質" if hq else f}  {"顔に合わせて切り出し" if kind[cid] == "M" else "構図のまま寄せ"}'
              + ('  / ' + '・'.join(note) if note else ''))
    print(f'\n{len(files)} 枚' + ('（--dry のため書き出していません）' if dry else ' を入れました'))


if __name__ == '__main__':
    main()
