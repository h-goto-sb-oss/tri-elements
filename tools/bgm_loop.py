# -*- coding: utf-8 -*-
"""
BGM をつなぎ目なくループさせるための下ごしらえ。

  python tools/bgm_loop.py <元のmp3> <出力キー> [最短のループ秒]
      例: python tools/bgm_loop.py in.mp3 bgm_battle
          python tools/bgm_loop.py rite.mp3 bgm_draft 140   … 曲のほとんどを使いたいとき

1. 曲の中から「そこへ飛んでも音楽が続いて聞こえる」2点（ループの始まり・終わり）を探す。
   終わりの点の前後の響き（メル帯域の強さの並び）と、始まりの点の前後の響きが
   いちばん似ている組を、自己類似行列の対角線の和で選ぶ。長いループほど少し優遇する。
   終わりはフェードアウトより前、始まりは頭の無音より後。
2. 波形の相互相関で、つなぎ目を数ミリ秒単位で合わせる。
3. 終わりの点の直前 80ms を、始まりの点の直前の音へ等パワーで混ぜておく（プチッを消す）。
   さらに終わりの点の後ろに、始まりの点から先の音を 0.5 秒つないでおく
   （飛ぶのが少し遅れても音楽が続くように）。それより後ろ（フェードアウト）は捨てる。
4. assets/audio/<キー>.mp3 に書き出し、ループ位置（秒）を表示する → src/ui/audio.js の BGM_LOOPS へ。

ブラウザの MP3 デコーダがエンコーダの先頭の遅延を削るかどうかで全体が数十ms ずれることがあるが、
始まりと終わりが同じだけずれるので、ループの長さ（＝音楽的なつながり）は崩れない。
"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 44100
HOP = 2048          # 特徴量の間隔（約46ms）
WIN_S = 4.0         # 前後それぞれ何秒の響きを比べるか
MIN_LOOP_S = 60.0   # これより短いループは作らない
BLEND_S = 0.08
TAIL_S = 0.5


def load(path):
    tmp = tempfile.mktemp(suffix='.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'wav', tmp], check=True)
    with wave.open(tmp) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    os.remove(tmp)
    return x.reshape(-1, 2)


def features(mono):
    n = 4096
    win = np.hanning(n).astype(np.float32)
    frames = np.lib.stride_tricks.sliding_window_view(mono, n)[::HOP] * win
    spec = np.abs(np.fft.rfft(frames, axis=1))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    # メル風に 48 帯へまとめる（40Hz〜11kHz、対数間隔）
    edges = np.geomspace(40, 11000, 49)
    bands = np.stack([spec[:, (freqs >= lo) & (freqs < hi)].sum(axis=1) for lo, hi in zip(edges[:-1], edges[1:])], axis=1)
    f = np.log1p(bands * 10)
    f -= f.mean(axis=1, keepdims=True)
    f /= np.linalg.norm(f, axis=1, keepdims=True) + 1e-9
    rms = np.sqrt((frames ** 2).mean(axis=1))
    return f.astype(np.float32), rms


def find_loop(x, min_loop_s=MIN_LOOP_S):
    mono = x.mean(axis=1)
    F, rms = features(mono)
    fps = SR / HOP
    db = 20 * np.log10(rms + 1e-9)
    loud = np.median(db[len(db) // 5: -len(db) // 5])
    # 頭の無音・終わりのフェードアウトを避ける
    head = int(np.argmax(db > loud - 12))
    tail_candidates = np.where(db > loud - 6)[0]
    fade = int(tail_candidates[-1]) if len(tail_candidates) else len(db) - 1
    W = int(WIN_S * fps)
    S = F @ F.T
    n = len(F)
    best = (-1e9, 0, 0)
    min_lag = int(min_loop_s * fps)
    e_lo, e_hi = max(W, fade - int(40 * fps)), fade - W - 2           # 終わり：フェードの40秒前〜W前
    for lag in range(min_lag, n):
        d = np.diagonal(S, offset=lag)                                  # d[i] = S[i, i+lag]
        if len(d) < 2 * W + 1:
            break
        c = np.concatenate([[0], np.cumsum(d)])
        # s = i, e = i+lag。窓は [i-W, i+W)
        i = np.arange(W, len(d) - W)
        e = i + lag
        ok = (i >= head + W) & (e >= e_lo) & (e <= e_hi)
        if not ok.any():
            continue
        score = (c[i + W] - c[i - W]) / (2 * W)
        score = np.where(ok, score + 0.02 * lag / n, -1e9)             # 長いループを少し優遇
        k = int(np.argmax(score))
        if score[k] > best[0]:
            best = (float(score[k]), int(i[k]), int(i[k] + lag))
    sim, s, e = best
    return sim, s * HOP, e * HOP, head * HOP, fade * HOP


def refine(mono, s, e, radius=int(0.03 * SR), n=4096):
    """終わりの点を ±30ms 動かして、直前の波形が始まりの点の直前といちばん重なる位置へ"""
    ref = mono[s - n:s]
    best, off = -1e9, 0
    for d in range(-radius, radius + 1, 4):
        seg = mono[e + d - n:e + d]
        v = float(np.dot(seg, ref) / (np.linalg.norm(seg) * np.linalg.norm(ref) + 1e-9))
        if v > best:
            best, off = v, d
    return e + off, best


def main():
    src, key = sys.argv[1], sys.argv[2]
    min_loop = float(sys.argv[3]) if len(sys.argv) > 3 else MIN_LOOP_S
    x = load(src)
    mono = x.mean(axis=1)
    sim, s, e, head, fade = find_loop(x, min_loop)
    e, corr = refine(mono, s, e)
    nb, nt = int(BLEND_S * SR), int(TAIL_S * SR)
    y = x[:e + nt].copy()
    t = np.linspace(0, 1, nb, dtype=np.float32)[:, None]
    y[e - nb:e] = x[e - nb:e] * np.cos(t * np.pi / 2) + x[s - nb:s] * np.sin(t * np.pi / 2)
    y[e:e + nt] = x[s:s + nt]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'assets', 'audio', key + '.mp3')
    tmp = tempfile.mktemp(suffix='.wav')
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '160k', out], check=True)
    # つなぎ目の試聴用（終わりの点の8秒前 → 始まりの点から8秒）
    prev = os.path.join(tempfile.gettempdir(), f'{key}_seam.wav')
    z = np.concatenate([y[e - 8 * SR:e], x[s:s + 8 * SR]])
    with wave.open(prev, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(z, -1, 1) * 32767).astype(np.int16).tobytes())
    os.remove(tmp)
    print(f'{key}: loopStart {s / SR:.4f}s  loopEnd {e / SR:.4f}s  （ループ {(e - s) / SR:.1f}秒）'
          f'  似ている度 {sim:.3f}  波形 {corr:.3f}  頭の無音 {head / SR:.1f}s  フェード {fade / SR:.1f}s  → {out}  試聴 {prev}')


if __name__ == '__main__':
    main()
