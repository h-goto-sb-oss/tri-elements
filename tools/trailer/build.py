# -*- coding: utf-8 -*-
"""紹介動画の仕上げ：録ったコマと、記録した音を1本の mp4 にする。

    python tools/trailer/build.py ja|en
    → release/trailer/tri-elements-trailer-<lang>.mp4（1920x1080・30fps・音声AAC）

record.mjs が書いた frames.json（コマと時刻）と audio.json（play/pause/音量の記録）を読む。
音は元のファイル（public/assets/audio）を、ゲームで鳴ったのと同じ時刻・同じ音量で重ねる。
BGM のフェードや勝敗時に BGM を下げる動きも、50ms ごとの音量の記録から再現する。
"""
import json
import os
import subprocess
import sys
from urllib.parse import urlsplit

import numpy as np

LANG = 'en' if len(sys.argv) > 1 and sys.argv[1] == 'en' else 'ja'
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'release', 'trailer', LANG)
OUT = os.path.join(ROOT, 'release', 'trailer', f'tri-elements-trailer-{LANG}.mp4')
AUDIO_DIR = os.path.join(ROOT, 'public')
SR = 48000
FPS = 30
FADE_OUT = 1.8   # 最後に音を絞る秒数

meta = json.load(open(os.path.join(SRC, 'frames.json')))
t0, t1 = meta['t0'], meta['t1']
frames = meta['frames']
dur = (t1 - t0) / 1000
log = json.load(open(os.path.join(SRC, 'audio.json')))

# ---------------- 映像 ----------------
# 1秒30コマの決まった時刻ごとに「その時点で最新のコマ」を選んで、そのまま ffmpeg に流し込む。
# （concat の duration 指定だと 1/25 秒より短い指定が切り上がり、全体が十数秒伸びた。2026-09-12）
n_out = int(round(dur * FPS))
times = [f['t'] for f in frames]
pick = []
j = 0
for k in range(n_out):
    t = t0 + k * 1000 / FPS
    while j + 1 < len(frames) and times[j + 1] <= t:
        j += 1
    pick.append(frames[j]['file'])

# ---------------- 音 ----------------
_cache = {}


def load(src_url):
    """URL → 元のファイルを 48kHz ステレオの float に"""
    p = urlsplit(src_url).path.lstrip('/')
    path = os.path.join(AUDIO_DIR, p.replace('/', os.sep))
    if path not in _cache:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                             capture_output=True, check=True).stdout
        _cache[path] = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
    return _cache[path]


n_total = int(dur * SR) + 1
mix = np.zeros((n_total, 2), dtype=np.float64)

by_id = {}
for e in log:
    by_id.setdefault(e['id'], []).append(e)

for eid, evs in by_id.items():
    evs.sort(key=lambda e: e['t'])
    plays = [e for e in evs if e['ev'] == 'play']
    for pi, pl in enumerate(plays):
        start = pl['t']
        # この再生の終わり＝次の pause/ended/play（無ければ録画の終わり）
        stop = t1
        for e in evs:
            if e['t'] > start and e['ev'] in ('pause', 'ended', 'play'):
                stop = e['t']
                break
        if stop <= t0:
            continue
        clip = load(pl['src'])
        # 録画より前に鳴り始めていた（タイトルのBGMなど）ときは途中から
        s_rec = max(start, t0)
        offset = int((s_rec - start) / 1000 * SR)
        length = int((min(stop, t1) - s_rec) / 1000 * SR)
        if length <= 0:
            continue
        if pl.get('loop'):
            reps = (offset + length) // len(clip) + 2
            src = np.tile(clip, (reps, 1))[offset:offset + length]
        else:
            src = clip[offset:offset + length]
            length = len(src)
        # 音量の変化（50ms ごとの記録）をなめらかにつなぐ
        vt = [start] + [e['t'] for e in evs if e['ev'] == 'vol' and start <= e['t'] <= stop]
        vv = [pl.get('vol', 1.0)] + [e['vol'] for e in evs if e['ev'] == 'vol' and start <= e['t'] <= stop]
        ts = s_rec + np.arange(length) / SR * 1000
        gain = np.interp(ts, vt, vv)
        a = int((s_rec - t0) / 1000 * SR)
        b = min(n_total, a + length)
        mix[a:b] += src[:b - a] * gain[:b - a, None]

# 最後に絞る
nf = int(FADE_OUT * SR)
mix[-nf:] *= np.linspace(1, 0, nf)[:, None]
peak = float(np.abs(mix).max()) or 1.0
if peak > 0.98:
    mix *= 0.98 / peak
wav = os.path.join(SRC, 'mix.wav')
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with open(wav, 'wb') as fh:
    import wave
    w = wave.open(fh, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()

# ---------------- 合わせる ----------------
proc = subprocess.Popen([
    'ffmpeg', '-y', '-v', 'error',
    '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wav,
    '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', str(FPS),
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
    '-c:a', 'aac', '-b:a', '192k', '-ar', str(SR),
    '-t', f'{dur:.3f}', '-movflags', '+faststart', OUT,
], stdin=subprocess.PIPE, cwd=SRC)
_jpg = {}
for name in pick:
    if name not in _jpg:
        _jpg.clear()
        _jpg[name] = open(os.path.join(SRC, 'frames', name), 'rb').read()
    proc.stdin.write(_jpg[name])
proc.stdin.close()
if proc.wait() != 0:
    raise SystemExit('ffmpeg failed')
print(f'{OUT}  {dur:.1f}s  {n_out} frames  {os.path.getsize(OUT) / 1048576:.1f}MB  (sounds {len(_cache)}, peak {peak:.2f})')
