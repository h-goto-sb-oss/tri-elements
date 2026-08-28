# ============================================================
# 博史さんが assets/art に置いたキャラ立ち絵を、カード用の絵に整える。
#   ファイル名は自由でよい（"area-01-02-garo.png" でも "歯車の巡礼者カルダン.png" でも、
#   カード名のカタカナが入っていれば対応するIDを自分で見つける）。
#
#   やること:
#     1. 名前からカードID（c_*）を割り出す
#     2. 背景が不透明（白／チェック柄が焼き込まれている）なら透過に戻す
#     3. 顔まわりを正方形で切り出して 512px の assets/art/c_<id>.png にする
#     4. 元の高解像度ファイルは assets/art/_chars_src/ へ退避（消さない）
#
#   使い方: python tools/adopt_char_art.py
# ============================================================
import hashlib, io, os, re, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ART = 'assets/art'
ENEMIES = 'assets/enemies'
KEEP = os.path.join(ART, '_chars_src')
SIZE = 512
HEAD_BIAS = 0.16     # 頭の上に残す余白。カードの絵枠は上下が切り落とされるので多めに取る
BG_MIN = 210         # これ以上明るく、かつ
BG_SPREAD = 24       # RGBの差がこれ以下なら「無彩色の背景」とみなす

# ---------- カード名 → ID ----------
src = io.open('src/engine/cards_chars.js', encoding='utf-8').read()
NAMES = dict(re.findall(r"M\('(c_\w+)',\s*'([^']+)'", src))
block = re.search(r'CHARACTER_OF = \{(.*?)\};', src, re.S).group(1)
KEY_TO_ID = {f'{a}:{b}': c for a, b, c in re.findall(r"'(a\d+):(\d+)':\s*'(\w+)'", block)}

def norm(s):
    """小書きのカナや記号のゆれを吸収する（リィナ / リイナ など）"""
    s = s.translate(str.maketrans('ァィゥェォッャュョ', 'アイウエオツヤユヨ'))
    return re.sub(r'[\s　＆&、,。・]', '', s)

# 名前を「カタカナの塊」と「漢字の塊」に割って、他のキャラと重複しないものを検索キーにする。
# カタカナ（＝そのキャラの名前）を優先し、名前がカタカナでない無銘の剣士だけ漢字で拾う。
def name_keys(pattern):
    keys = {}
    for cid, name in NAMES.items():
        for tok in re.findall(pattern, name):
            keys.setdefault(norm(tok), set()).add(cid)
    return {k: next(iter(v)) for k, v in keys.items() if len(v) == 1}

KANA_KEYS = name_keys(r'[ァ-ヴー]{2,}')
KANJI_KEYS = name_keys(r'[一-龥]{2,}')

def id_for(stem):
    m = re.match(r'area-(\d+)-(\d+)', stem)
    if m:
        return KEY_TO_ID.get(f'a{int(m.group(1))}:{int(m.group(2)) - 1}')
    n = norm(stem)
    for table in (KANA_KEYS, KANJI_KEYS):
        hit = [(k, cid) for k, cid in table.items() if k in n]
        if hit:
            return max(hit, key=lambda kv: len(kv[0]))[1]   # いちばん長く一致したもの
    return None


# ---------- 背景の除去 ----------
def strip_background(im):
    """焼き込まれた白／チェック柄の背景を透過に戻す。
    外周とつながっている無彩色の明るい領域だけを消すので、
    キャラの内側にある白（法衣など）は残る。"""
    a = np.asarray(im, dtype=np.int16)
    rgb = a[:, :, :3]
    light = (rgb.min(2) >= BG_MIN) & ((rgb.max(2) - rgb.min(2)) <= BG_SPREAD)
    lab, n = ndimage.label(light)
    if n == 0:
        return im, 0.0
    border = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    border.discard(0)
    if not border:
        return im, 0.0
    bg = np.isin(lab, list(border))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # 境界の白フチを目立たなくする（少しぼかして、残った半端な明るさを削る）
    soft = ndimage.gaussian_filter(alpha.astype(np.float32), 0.8)
    alpha = np.clip((soft - 40) * (255 / 215), 0, 255).astype(np.uint8)
    out = im.copy()
    out.putalpha(Image.fromarray(alpha))
    return out, bg.mean()

# ---------- 切り出し ----------
def solid_bbox(im):
    """キャラ本体の位置。半透明のもや（炎や光のエフェクト）や、
    背景に取り残された小さなゴミを無視したいので、
    「はっきり不透明な画素が、その行／列にある程度まとまっている」範囲を採る。"""
    a = np.asarray(im.getchannel('A'))
    solid = a >= 100
    rows, cols = solid.sum(1), solid.sum(0)
    ry = np.where(rows >= im.width * 0.02)[0]
    rx = np.where(cols >= im.height * 0.02)[0]
    if not len(ry) or not len(rx):
        return im.getchannel('A').getbbox() or (0, 0, *im.size)
    return int(rx[0]), int(ry[0]), int(rx[-1]) + 1, int(ry[-1]) + 1


def square_bust(im):
    """全身の立ち絵から、頭～胸あたりを正方形で切り出す。
    カードの絵枠は横長に切り抜かれるので、全身のままだと顔が枠の外に出てしまう。"""
    x0, y0, x1, y1 = solid_bbox(im)
    side = min(x1 - x0, y1 - y0)
    cx = (x0 + x1) // 2
    # 枠からはみ出す指定でも良い（PIL が透明で埋めてくれる）。
    # 頭の上の余白は、絵の外側であっても確保したい。
    left = cx - side // 2
    top = y0 - int(side * HEAD_BIAS)
    return im.crop((left, top, left + side, top + side))


def sha(path):
    return hashlib.sha1(io.open(path, 'rb').read()).hexdigest()

def main():
    known = {sha(os.path.join(ENEMIES, f)): f for f in os.listdir(ENEMIES)
             if f.lower().endswith('.png')}
    todo = []
    for f in sorted(os.listdir(ART)):
        if not f.lower().endswith('.png'):
            continue
        stem = os.path.splitext(f)[0]
        if re.fullmatch(r'c_\w+', stem):
            continue                      # 変換済みのカード絵
        if re.match(r'area-\d', stem) or any(ord(c) > 127 for c in stem):
            todo.append(f)
    if not todo:
        print('取り込む立ち絵はありませんでした'); return

    os.makedirs(KEEP, exist_ok=True)
    done, skipped = [], []
    for f in todo:
        p = os.path.join(ART, f)
        stem = os.path.splitext(f)[0]
        cid = id_for(stem)
        if not cid:
            skipped.append((f, 'カード名が読み取れない')); continue
        if sha(p) in known:
            # 既存の敵立ち絵をそのままコピーしたもの。新しい絵ではないので使わない
            shutil.move(p, os.path.join(KEEP, f))
            skipped.append((f, '既存の立ち絵をそのままコピーしたもの'))
            continue
        im = Image.open(p)
        opaque = im.mode != 'RGBA' or np.asarray(im)[:, :, 3].min() > 250
        removed = 0.0
        im = im.convert('RGBA')
        if opaque:
            im, removed = strip_background(im)
        out = square_bust(im).resize((SIZE, SIZE), Image.LANCZOS)
        out.save(os.path.join(ART, f'{cid}.png'))
        shutil.move(p, os.path.join(KEEP, f))
        done.append((cid, f, '背景を透過に戻した %.0f%%' % (removed * 100) if opaque else '透過そのまま'))

    for cid, f, note in done:
        print(f'  {cid}.png  ←  {f}  [{note}]')
    for f, why in skipped:
        print(f'  -- 見送り: {f}（{why}）')
    print(f'\n{len(done)} 枚を取り込みました。元ファイルは {KEEP} に置いてあります')

if __name__ == '__main__':
    main()
