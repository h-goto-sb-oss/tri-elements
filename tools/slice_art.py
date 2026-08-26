# -*- coding: utf-8 -*-
"""
参考イラストのシート画像から、カード1枚ずつの絵柄を切り出す。

シートは「4象限 × (5列 × 2行)」の定型レイアウトなので、
実測した格子座標を SHEETS に持たせて切り出す。

  python tools/slice_art.py <シートキー> [--debug]
"""
import sys, os, json
from PIL import Image, ImageDraw

UP = 'C:/Users/pc/.claude/uploads/c7a4842e-7571-4a5b-a845-0ea4af8c654c'

# 切り出す絵柄の縦横比（カード枠の art 領域に合わせる）
ART_RATIO = 118 / 100.0   # 横 / 縦

SHEETS = {
    # sheet1: 濃い背景・立体的な絵柄。名前が第1弾の炎とぴったり一致。
    'sheet1': {
        'file': f'{UP}/149118d2-image.png',
        'panels': {'fire': (0, 0), 'water': (774, 0), 'grass': (0, 516), 'none': (774, 516)},
        'card': dict(x0=26, y0=80, w=126, h=192, px=143, py=212),
        'win':  {'monster': (0.03, 0.97, 0.17, 0.84), 'support': (0.05, 0.95, 0.10, 0.70)},
    },
    'sheet2': {
        'file': f'{UP}/8015afd1-image.png',
        'panels': {'fire': (0, 0), 'water': (774, 0), 'grass': (0, 508), 'none': (774, 516)},
        'card': dict(x0=26, y0=80, w=126, h=192, px=143, py=212),
        'win':  {'monster': (0.03, 0.97, 0.16, 0.82), 'support': (0.05, 0.95, 0.10, 0.70)},
    },
    'sheet3': {
        'file': f'{UP}/0baaf7d7-image.png',
        'panels': {'fire': (0, 0), 'water': (774, 0), 'grass': (0, 516), 'none': (774, 516)},
        'card': dict(x0=26, y0=80, w=126, h=192, px=143, py=212),
        'win':  {'monster': (0.03, 0.97, 0.17, 0.84), 'support': (0.05, 0.95, 0.10, 0.70)},
    },
}


def slice_sheet(key, debug=False):
    cfg = SHEETS[key]
    im = Image.open(cfg['file']).convert('RGB')
    outdir = os.path.join('assets', key)
    os.makedirs(outdir, exist_ok=True)
    dbg = im.copy()
    d = ImageDraw.Draw(dbg)
    c = cfg['card']
    made = {}
    for pkey, (ox, oy) in cfg['panels'].items():
        made[pkey] = []
        win = cfg['win']['support' if pkey == 'none' else 'monster']
        for r in range(2):
            for col in range(5):
                L = ox + c['x0'] + c['px'] * col
                T = oy + c['y0'] + c['py'] * r
                ax0 = L + int(c['w'] * win[0])
                ax1 = L + int(c['w'] * win[1])
                ay0 = T + int(c['h'] * win[2])
                ay1 = T + int(c['h'] * win[3])
                # 指定比率に合わせて縦を中央基準で詰める
                tw = ax1 - ax0
                th = int(tw / ART_RATIO)
                cy = (ay0 + ay1) // 2
                ay0, ay1 = cy - th // 2, cy - th // 2 + th
                name = f'{pkey}{r * 5 + col + 1:02d}.png'
                im.crop((ax0, ay0, ax1, ay1)).resize((354, 300), Image.LANCZOS)\
                  .save(os.path.join(outdir, name))
                made[pkey].append(name)
                d.rectangle([ax0, ay0, ax1, ay1], outline=(255, 0, 0), width=2)
    if debug:
        dbg.save(os.path.join(outdir, '_debug.png'))
    print(key, json.dumps({k: len(v) for k, v in made.items()}))


if __name__ == '__main__':
    slice_sheet(sys.argv[1], '--debug' in sys.argv)
