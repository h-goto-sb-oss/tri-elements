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

# どこから実行してもいいように、プロジェクトの直下へ移動してから始める
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# コンソールの文字コードが日本語を扱えないと、ファイル名を表示した時点で
# 落ちてしまうので、表示だけは常に UTF-8 で行う
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ART = 'assets/art'
ENEMIES = 'assets/enemies'
KEEP = os.path.join(ART, '_chars_src')
SIZE = 512
EXTS = ('.png', '.webp', '.jpg', '.jpeg')
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
    if stem in NAMES:
        return stem                      # 最初から正しいIDの名前で置かれている
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
# 透過画像を「見た目そのまま」で保存すると、透過を表す市松模様が
# 絵として焼き込まれてしまう。ここではその市松を検出して剥がす。
HARD_MIN, HARD_SPREAD = 210, 24    # ここは確実に背景（明るくて無彩色）
SOFT_MIN, SOFT_SPREAD = 150, 48    # 背景と混ざった中間色まで拾う範囲
BAND = 10                          # 背景の芯からこの距離までを境界とみなす
A_HI, A_LO = 246.0, 170.0          # 明るさ → 不透明度の変換
WHITE = 250.0                      # 差し引く背景の白


def background_tones(v, bg):
    """背景に使われている代表的な明るさを2つ返す。
    透過を表す市松模様は、明るい白と少し暗い灰色の2色でできている。
    画像が拡大縮小されているとマス目の位置が揃わないので、
    位置ではなく「その2色でできているか」で見分ける。"""
    hist = np.bincount(np.round(v[bg]).astype(int), minlength=256)
    hi = int(np.argmax(hist))
    far = [i for i in range(256) if abs(i - hi) >= 8]
    lo = max(far, key=lambda i: hist[i]) if far else hi
    if hist[lo] < hist[hi] * 0.15:
        return None                      # 単色の背景。市松ではない
    return min(hi, lo), max(hi, lo)


def strip_background(im):
    """焼き込まれた背景を透過に戻す。
    外周とつながっている部分に加えて、髪の輪の内側のように
    囲まれてしまった部分も、市松模様と一致すれば背景として抜く。
    キャラの白い衣装を穴だらけにしないよう、判定はひとかたまり単位で行う。"""
    rgb = np.asarray(im.convert('RGB'), dtype=np.float32)
    mn, mx = rgb.min(2), rgb.max(2)
    sat = mx - mn
    v = rgb.mean(2)
    light = (mn >= HARD_MIN) & (sat <= HARD_SPREAD)
    lab, n = ndimage.label(light, structure=np.ones((3, 3)))
    if n == 0:
        return im, 0.0
    edge = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    edge.discard(0)
    if not edge:
        return im, 0.0
    bg = np.isin(lab, list(edge))

    # 髪の輪の内側のように「囲まれてしまった背景」も抜く。
    # 市松の2色が両方そろっているかで見分けるので、
    # 一色で塗られたキャラの白い衣装を穴だらけにすることはない。
    tones = background_tones(v, bg)
    inner = [i for i in range(1, n + 1) if i not in edge]
    if tones and inner:
        lo, hi = tones
        area = ndimage.sum(light, lab, inner)
        f_lo = ndimage.sum((np.abs(v - lo) <= 4) & light, lab, inner) / area
        f_hi = ndimage.sum((np.abs(v - hi) <= 4) & light, lab, inner) / area
        add = [i for i, a, b, ar in zip(inner, f_lo, f_hi, area)
               if ar >= 60 and a >= 0.15 and b >= 0.15 and a + b >= 0.55]
        if add:
            bg |= np.isin(lab, add)

    # 境界のにじみ（背景と混ざった中間色）を、明るさに応じて薄くする
    dist = ndimage.distance_transform_edt(~bg)
    band = (dist <= BAND) & (mn >= SOFT_MIN) & (sat <= SOFT_SPREAD)
    alpha = np.ones_like(mn)
    alpha[band] = np.clip((A_HI - mn) / (A_HI - A_LO), 0, 1)[band]
    alpha[bg] = 0.0

    # 残った白フチを取り除く（混ざっていた背景の白を差し引いて元の色に戻す）
    a3 = np.clip(alpha, 1e-3, 1)[:, :, None]
    fg = np.clip((rgb - (1 - a3) * WHITE) / a3, 0, 255)
    out = np.dstack([fg, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), float((alpha == 0).mean())


# ---------- 切り出し ----------
def solid_bbox(im):
    """キャラ本体の位置。半透明のもや（炎や光のエフェクト）や、背景に取り残された
    小さなゴミは外したいが、アホ毛や槍の先のような細い部分は含めたい。
    そこで「はっきり不透明な画素のかたまり」を拾い、小さすぎる島だけ捨てる。"""
    a = np.asarray(im.getchannel('A'))
    solid = a >= 100
    lab, n = ndimage.label(solid)
    if n == 0:
        return im.getchannel('A').getbbox() or (0, 0, *im.size)
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    keep = [i + 1 for i, v in enumerate(sizes) if v >= solid.size * 0.001]
    if not keep:
        keep = [int(np.argmax(sizes)) + 1]
    mask = np.isin(lab, keep)
    ys, xs = np.where(mask.any(1))[0], np.where(mask.any(0))[0]
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1


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


def keep_to(path, name):
    """原本を _chars_src へ退避する（同名があれば置き換える）"""
    dst = os.path.join(KEEP, name)
    if os.path.exists(dst):
        os.remove(dst)
    shutil.move(path, dst)


def sha(path):
    return hashlib.sha1(io.open(path, 'rb').read()).hexdigest()

def main():
    known = {sha(os.path.join(ENEMIES, f)): f for f in os.listdir(ENEMIES)
             if f.lower().endswith(EXTS)}
    todo = []
    for f in sorted(os.listdir(ART)):
        if not f.lower().endswith(EXTS):
            continue
        stem = os.path.splitext(f)[0]
        if re.fullmatch(r'c_\w+', stem):
            # 正しい名前で直接置かれた絵。まだ整えていないもの（512pxでない）だけ拾う
            if Image.open(os.path.join(ART, f)).size != (SIZE, SIZE):
                todo.append(f)
            continue
        if re.match(r'area-\d', stem) or any(ord(c) > 127 for c in stem):
            todo.append(f)
    if not todo:
        print('取り込む立ち絵はありませんでした'); return

    os.makedirs(KEEP, exist_ok=True)
    done, skipped = [], []
    # 同じキャラの絵が複数あったら、新しいファイルを採用する。
    # （古いほうが後から上書きしてしまう事故を防ぐ）
    claimed = {}
    for f in todo:
        cid = id_for(os.path.splitext(f)[0])
        if not cid:
            continue
        prev = claimed.get(cid)
        if prev is None or os.path.getmtime(os.path.join(ART, f)) > os.path.getmtime(os.path.join(ART, prev)):
            claimed[cid] = f
    for f in todo:
        p = os.path.join(ART, f)
        stem = os.path.splitext(f)[0]
        cid = id_for(stem)
        if not cid:
            skipped.append((f, 'カード名が読み取れない')); continue
        if claimed.get(cid) != f:
            keep_to(p, f)
            skipped.append((f, f'{cid} には、より新しい {claimed[cid]} を使う')); continue
        if sha(p) in known:
            # 既存の敵立ち絵をそのままコピーしたもの。新しい絵ではないので使わない
            keep_to(p, f)
            skipped.append((f, '既存の立ち絵をそのままコピーしたもの'))
            continue
        im = Image.open(p)
        im.load()
        opaque = im.mode != 'RGBA' or np.asarray(im)[:, :, 3].min() > 250
        removed = 0.0
        im = im.convert('RGBA')
        if opaque:
            im, removed = strip_background(im)
        out = square_bust(im).resize((SIZE, SIZE), Image.LANCZOS)
        # 先に原本を退避する。ファイル名が出力と同じ（c_*.png を直接置いた場合）でも
        # 書き出したものを巻き添えで持っていかないように。
        keep_to(p, f)
        out.save(os.path.join(ART, f'{cid}.png'))
        done.append((cid, f, '背景を透過に戻した %.0f%%' % (removed * 100) if opaque else '透過そのまま'))

    for cid, f, note in done:
        print(f'  {cid}.png  ←  {f}  [{note}]')
    for f, why in skipped:
        print(f'  -- 見送り: {f}（{why}）')
    print(f'\n{len(done)} 枚を取り込みました。元ファイルは {KEEP} に置いてあります')

if __name__ == '__main__':
    main()
