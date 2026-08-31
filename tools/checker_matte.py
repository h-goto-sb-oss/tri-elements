# -*- coding: utf-8 -*-
# ============================================================
# 市松模様が全面に焼き込まれた高画質の元絵から、背景だけを
# 見分けて透過させる。
#
#   第4弾の高画質元絵は透過情報を持たず、背景が市松模様として
#   絵に描き込まれている。しかも2色の差はわずか8〜18しかなく、
#   マス目も歪んでいるため、模様の形そのものでは拾いきれない。
#
#   よりどころは3つ。
#   ・背景は必ず画像の外周につながっている
#   ・市松は「2色の両方」でできている（べた塗りの肌や布は一色）
#   ・512版の切り抜きは大まかには正しい（ただし鵜呑みにはしない）
#
#   手順:
#   1. 外周の淡い画素を種に、市松の色に収まる領域を背景として
#      塗り広げる。512版が透明にしていた場所は、市松の2色で
#      できていると確認できたときだけ種に加える。
#   2. キャラに囲まれて外周に届かない市松の隙間を抜く。
#      大きめの隙間は「2色の両方がそれぞれ2割以上」を必須にして、
#      べた塗りの肌や白布を誤って抜かないようにする。
#   3. 薄い布ごしに透けて残った市松は、抜かずに「さざ波ならし」で
#      消す。市松の明暗差以下の細かい濃淡だけを局所平均に吸収する。
#      輪郭や模様は明暗差が大きいので残る。
# ============================================================
import numpy as np
from PIL import Image
from scipy import ndimage

TONE_TOL = 3.5        # 市松の2色それぞれの許容幅
POCKET_TINY = 1200    # これ以下の隙間は一色でも抜いてよい（マス目より小さい）
POCKET_MAX = 200000   # 2色そろった隙間として抜く大きさの上限（px）
POCKET_PURE = 0.85    # 一色の小さな隙間を抜く条件: 2色ちょうどの割合
POCKET_BOTH = 0.70    # 2色そろった隙間を抜く条件: 同上（マス目の歪みで下がる）
SEED_PURE = 0.70      # 512版の種を信じる条件: 2色ちょうどの割合
SEED_FRAC = 0.30      # 512版の種を信じる条件: 透明だった画素の割合


def _tones(v, mn, mx):
    """市松の2色の明るさを推定する。明るい無彩色の上位2モード"""
    pale = (mn >= 200) & ((mx - mn) <= 20)
    if not pale.any():
        return 254, 244
    hist = np.bincount(np.round(v[pale]).astype(int), minlength=256)
    hi = int(np.argmax(hist))
    hist2 = hist.copy()
    hist2[max(0, hi - 5):hi + 6] = 0
    lo = int(np.argmax(hist2)) if hist2.any() else hi - 10
    return max(hi, lo), min(hi, lo)


def _frac(lab, n, mask):
    """ラベルごとに mask の割合を返す"""
    area = np.bincount(lab.ravel(), minlength=n + 1)
    hit = np.bincount(lab.ravel(), weights=mask.ravel().astype(np.float64), minlength=n + 1)
    with np.errstate(divide='ignore', invalid='ignore'):
        return np.where(area > 0, hit / area, 0), area


def checker_matte(im, seed_alpha=None, sat=12, pad=6, smooth_sigma=12,
                  zone_v=170, zone_sat=45, flatten_amp=None, cell=31):
    """(RGBA画像, 背景の割合, ならした割合) を返す。

    im         … 市松が焼き込まれた元絵（透過なしでよい）
    seed_alpha … あれば参考にする粗い透過（512版の切り抜き）。
                 元絵と同じ大きさの ndarray (0-255)
    sat        … 背景とみなす彩度の上限
    pad        … 暗い側のトーンからどこまで下を背景色に含めるか
    """
    rgb = np.asarray(im.convert('RGB')).astype(np.int16)
    mn, mx = rgb.min(2), rgb.max(2)
    v = rgb.mean(2)
    hi, lo = _tones(v, mn, mx)
    gap = max(hi - lo, 8)

    band = (v >= lo - pad) & ((mx - mn) <= sat)
    low_sat = (mx - mn) <= sat
    t_hi = (np.abs(v - hi) <= TONE_TOL) & low_sat
    t_lo = (np.abs(v - lo) <= TONE_TOL) & low_sat

    # 市松特有の「細かい明暗のさざ波」。べた塗りやなだらかな
    # グラデーションには無いので、抜いてよい隙間の決め手になる。
    # 基準面は中央値でつくる。輪郭線のそばでも輪郭に引きずられず、
    # 市松のさざ波だけを測れる
    base = ndimage.median_filter(v.astype(np.float32), size=cell)
    ripple_amp = np.abs(v - base)

    lab, n = ndimage.label(band, structure=np.ones((3, 3)))
    pure, area = _frac(lab, n, t_hi | t_lo)
    f_hi, _ = _frac(lab, n, t_hi)
    f_lo, _ = _frac(lab, n, t_lo)
    amp = np.bincount(lab.ravel(), weights=ripple_amp.ravel(), minlength=n + 1)
    with np.errstate(divide='ignore', invalid='ignore'):
        amp = np.where(area > 0, amp / np.maximum(area, 1), 0)

    border = np.zeros(n + 1, bool)
    for edge in (lab[0], lab[-1], lab[:, 0], lab[:, -1]):
        border[np.unique(edge)] = True

    seeded = np.zeros(n + 1, bool)
    if seed_alpha is not None:
        s, _ = _frac(lab, n, seed_alpha < 60)
        seeded = (s >= SEED_FRAC) & (pure >= SEED_PURE)             & (f_hi >= 0.15) & (f_lo >= 0.15) & (amp >= gap * 0.25)

    # まず確かな背景（外周・確認済みの種・2色そろった隙間）を決める
    both = (f_hi >= 0.20) & (f_lo >= 0.20) & (amp >= gap * 0.25)
    big_pocket = (area <= POCKET_MAX) & both & (pure >= POCKET_BOTH)
    bg_ids = border | seeded | big_pocket
    bg_ids[0] = False
    bg = bg_ids[lab]

    # 背景と認めるのは市松2色の近く（6px以内）の画素だけ。
    # 白い衣装が輪郭線なしで背景と接していても、衣装の中の色は
    # 2色から外れるので、塗り広げが衣装の奥まで漏れない
    bg &= ndimage.binary_dilation(t_hi | t_lo, iterations=6)

    # マス目より小さい一色の隙間は、確かな背景のすぐ近くにあるものだけ抜く。
    # 盤や衣装の中の真っ白なべた塗りは背景から遠いので巻き込まれない
    near_bg = ndimage.distance_transform_edt(~bg) <= 45
    near, _ = _frac(lab, n, near_bg)
    tiny = (area <= POCKET_TINY) & (pure >= POCKET_PURE) & (near >= 0.5) & ~bg_ids
    if tiny.any():
        bg |= tiny[lab]
    fg = ~bg

    # 背景の海に取り残された小さな淡いカス（マス目の断片）を掃除する
    flab, fn = ndimage.label(fg, structure=np.ones((3, 3)))
    if fn > 1:
        pale_px = (v >= lo - 2 * pad) & ((mx - mn) <= 3 * sat)
        f_pale, f_area = _frac(flab, fn, pale_px)
        drop = (f_area <= 400) & (f_pale >= 0.5)
        drop[0] = False
        if drop.any():
            keep = ~drop[flab]
            bg |= ~keep
            fg &= keep

    # さざ波ならし: 明るく彩度の低い場所で、市松の明暗差以下の
    # 細かな濃淡だけを局所平均へ吸収する（薄布ごしの市松を消す）
    out_rgb = rgb.astype(np.float32)
    lp = np.dstack([ndimage.median_filter(out_rgb[:, :, c], size=cell) for c in range(3)])
    # 市松の明暗差（gap）程度までのさざ波は全部ならし、
    # それを大きく超える本物の輪郭や模様はそのまま残す
    F = float(flatten_amp if flatten_amp else gap)
    ripple = np.clip((2.0 * F - ripple_amp) / F, 0, 1)
    zone = (fg & (v >= zone_v) & ((mx - mn) <= zone_sat)).astype(np.float32)
    zone = ndimage.gaussian_filter(zone, 3)
    w = (ripple * zone)[:, :, None]
    out_rgb = out_rgb * (1 - w) + lp * w

    # フチを1px引き締めてからぼかす。市松と混ざった縁取りを残さないため
    fg2 = ndimage.binary_erosion(fg, iterations=1)
    alpha = ndimage.gaussian_filter(fg2.astype(np.float32) * 255, 1.1)
    out = np.dstack([np.clip(out_rgb, 0, 255).astype(np.uint8),
                     np.clip(alpha, 0, 255).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA'), float(bg.mean()), float((w[:, :, 0] > 0.5).mean())
