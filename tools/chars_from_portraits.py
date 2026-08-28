# ============================================================
# キャラクターカードの仮イラストを、冒険画面の立ち絵から作る。
#   本番の絵ができるまでのつなぎ。assets/art/c_*.png を上書きするので、
#   本番の絵を置いたあとにこれを流すと消えてしまう点に注意。
#   使い方: python tools/chars_from_portraits.py
# ============================================================
import io, os, re, sys
from PIL import Image

SRC = 'assets/enemies'
OUT = 'assets/art'
SIZE = 512          # 出力サイズ（カードの絵枠は正方形）
HEAD_BIAS = 0.16    # 頭の上にこれだけ余白を残す（カードの絵枠は上下が切られるので多め）

# 敵キー → カードID は cards_chars.js の CHARACTER_OF から読む
src = io.open('src/engine/cards_chars.js', encoding='utf-8').read()
block = re.search(r'CHARACTER_OF = \{(.*?)\};', src, re.S).group(1)
KEY_TO_ID = dict(re.findall(r"'(a\d+:\d+)':\s*'(\w+)'", block))

# 敵キー → 立ち絵ファイル は assets_map.js から読む
am = io.open('src/ui/assets_map.js', encoding='utf-8').read()
eb = re.search(r'ENEMY_ART = \{(.*?)\};', am, re.S).group(1)
KEY_TO_ART = dict(re.findall(r'"(a\d+:\d+)":\s*"([^"]+)"', eb))


def square_bust(im):
    """立ち絵から、頭～胸あたりを正方形で切り出す。
    カードの絵枠は小さいので、全身より顔まわりの方が読み取りやすい。"""
    bb = im.getchannel('A').getbbox() or (0, 0, *im.size)
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    side = min(w, h)
    cx = (x0 + x1) // 2
    top = max(0, y0 - int(side * HEAD_BIAS))
    left = max(0, min(im.width - side, cx - side // 2))
    top = max(0, min(im.height - side, top))
    return im.crop((left, top, left + side, top + side))


def main():
    os.makedirs(OUT, exist_ok=True)
    made = 0
    for key, cid in sorted(KEY_TO_ID.items()):
        art = KEY_TO_ART.get(key)
        if not art:
            print(f'  立ち絵が見つからない: {key} ({cid})'); continue
        stem = os.path.splitext(os.path.basename(art))[0]
        src_png = os.path.join(SRC, stem + '.png')
        if not os.path.exists(src_png):
            print(f'  原本が無い: {src_png}'); continue
        im = Image.open(src_png).convert('RGBA')
        square_bust(im).resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, f'{cid}.png'))
        made += 1
    print(f'仮イラストを {made} 枚つくりました（assets/art/c_*.png）')


if __name__ == '__main__':
    main()
