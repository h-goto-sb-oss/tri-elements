# ============================================================
# 透過画像に焼き込まれてしまった「市松模様」を消す。
#
#   生成AIから出てきた絵は、透過の部分が市松模様として
#   絵に焼き込まれていることがある。見た目では気づきにくいが、
#   ゲームに載せると背景に白いブロックが浮かぶ。
#
#   外周とつながっていない（キャラに囲まれた）市松も消したいので、
#   位置ではなく「その部分が2色だけでできているか」で見分ける。
#   一色で塗られた白い衣装は2色そろわないので、穴は開かない。
#
#   使い方: python tools/unbake_checker.py <フォルダ か ファイル> [--out 出力先] [--dry]
# ============================================================
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

PALE = 165        # これより明るければ市松の候補
SAT = 30          # 色みがこれ以下なら無彩色とみなす
MIN_AREA = 120    # これより小さいかたまりは相手にしない
TOL = 4           # 2色それぞれの許容幅
GAP = (5, 45)     # 2色の差がこの範囲なら市松らしい
SHARE = 0.22      # 2色それぞれが最低これだけ占めていること
COVER = 0.72      # 2色あわせてこれだけ占めていること
FEATHER = 0.9     # 消したフチをこれだけぼかす


def two_tones(vals):
    """かたまりの中で多い2つの明るさを返す。市松なら白と薄い灰色になる"""
    hist = np.bincount(np.round(vals).astype(int), minlength=256)
    hi = int(np.argmax(hist))
    far = [i for i in range(256) if abs(i - hi) >= GAP[0]]
    if not far:
        return None
    lo = max(far, key=lambda i: hist[i])
    if hist[lo] < hist[hi] * 0.25 or not (GAP[0] <= abs(hi - lo) <= GAP[1]):
        return None
    return min(hi, lo), max(hi, lo)


def unbake(im):
    """市松として焼き込まれた部分を透明に戻す。(新しい画像, 消した割合)"""
    src = im.convert('RGBA')
    a = np.asarray(src).astype(np.int16)
    al = a[:, :, 3]
    rgb = a[:, :, :3]
    mn, mx = rgb.min(2), rgb.max(2)
    cand = (al > 200) & (mn >= PALE) & ((mx - mn) <= SAT)
    if not cand.any():
        return src, 0.0

    v = rgb.mean(2)
    lab, n = ndimage.label(cand, structure=np.ones((3, 3)))
    kill = np.zeros_like(cand)
    for i in range(1, n + 1):
        sel = lab == i
        area = int(sel.sum())
        if area < MIN_AREA:
            continue
        tones = two_tones(v[sel])
        if not tones:
            continue
        lo, hi = tones
        f_lo = float((np.abs(v[sel] - lo) <= TOL).mean())
        f_hi = float((np.abs(v[sel] - hi) <= TOL).mean())
        if f_lo >= SHARE and f_hi >= SHARE and (f_lo + f_hi) >= COVER:
            kill |= sel

    if not kill.any():
        return src, 0.0
    alpha = np.where(kill, 0.0, al.astype(np.float32))
    # 消した縁が階段状にならないよう、少しだけなじませる
    alpha = ndimage.gaussian_filter(alpha, FEATHER)
    alpha = np.where(kill, np.minimum(alpha, 60), alpha)
    out = np.asarray(src).copy()
    out[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), float(kill.mean())


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    dry = '--dry' in sys.argv
    out_dir = None
    if '--out' in sys.argv:
        out_dir = sys.argv[sys.argv.index('--out') + 1]
    if not args:
        print('使い方: python tools/unbake_checker.py <フォルダ か ファイル> [--out 出力先] [--dry]')
        return
    target = args[0]
    files = ([os.path.join(target, f) for f in sorted(os.listdir(target)) if f.lower().endswith('.png')]
             if os.path.isdir(target) else [target])
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    hit = 0
    for f in files:
        im = Image.open(f)
        new, frac = unbake(im)
        name = os.path.basename(f)
        if frac > 0:
            hit += 1
            print(f'  {name}  市松を {frac * 100:.1f}% 消した')
        if not dry:
            new.save(os.path.join(out_dir, name) if out_dir else f)
    print(f'\n{len(files)} 枚中 {hit} 枚に焼き込みがありました'
          + ('（--dry のため書き出していません）' if dry else ''))


if __name__ == '__main__':
    main()
