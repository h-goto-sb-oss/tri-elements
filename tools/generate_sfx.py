"""Tri Elements 用の短いオリジナル効果音を生成する。"""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


SR = 44_100
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "audio"
RNG = np.random.default_rng(731)


def envelope(n, attack=.01, release=.08, decay=0):
    y = np.ones(n)
    a, r = min(n, int(attack * SR)), min(n, int(release * SR))
    if a:
        y[:a] = np.linspace(0, 1, a, endpoint=False)
    if decay:
        y *= np.exp(-np.linspace(0, decay, n))
    if r:
        y[-r:] *= np.linspace(1, 0, r)
    return y


def tone(duration, f0, f1=None, *, amp=1, kind="sine", attack=.006,
         release=.08, decay=2, vibrato=0):
    n = max(1, int(duration * SR))
    t = np.arange(n) / SR
    freq = np.linspace(f0, f0 if f1 is None else f1, n)
    if vibrato:
        freq *= 1 + .008 * np.sin(2 * np.pi * vibrato * t)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    if kind == "triangle":
        y = 2 / np.pi * np.arcsin(np.sin(phase))
    elif kind == "square":
        y = np.tanh(2.3 * np.sin(phase))
    else:
        y = np.sin(phase)
    return amp * y * envelope(n, attack, release, decay)


def noise(duration, *, amp=1, color="white", attack=.002, release=.06, decay=4):
    n = max(1, int(duration * SR))
    y = RNG.normal(0, 1, n)
    if color == "low":
        for i in range(1, n):
            y[i] = .94 * y[i - 1] + .06 * y[i]
        y *= 4.2
    elif color == "high":
        low = np.empty(n)
        low[0] = y[0]
        for i in range(1, n):
            low[i] = .82 * low[i - 1] + .18 * y[i]
        y -= low
    y /= max(1e-9, np.max(np.abs(y)))
    return amp * y * envelope(n, attack, release, decay)


def mix(*parts):
    length = max(int(start * SR) + len(samples) for start, samples in parts)
    out = np.zeros(length)
    for start, samples in parts:
        i = int(start * SR)
        out[i:i + len(samples)] += samples
    return out


def bell(duration, freq, amp=.5, decay=5):
    return mix(
        (0, tone(duration, freq, amp=amp, decay=decay, release=duration * .45)),
        (0, tone(duration, freq * 2.01, amp=amp * .25, decay=decay * 1.15, release=duration * .4)),
        (0, tone(duration, freq * 3.98, amp=amp * .1, decay=decay * 1.4, release=duration * .35)),
    )


def hit_body(duration=.2, amp=.8):
    return mix(
        (0, tone(duration, 150, 62, amp=amp, kind="triangle", attack=.001, decay=7, release=.07)),
        (0, noise(duration * .65, amp=amp * .48, color="low", decay=8, release=.05)),
    )


def save(name, samples):
    samples = np.concatenate((np.zeros(24), samples, np.zeros(int(.025 * SR))))
    peak = np.max(np.abs(samples)) or 1
    # 軽いソフトリミット。ゲーム内で複数音が重なっても耳に刺さりにくくする。
    samples = np.tanh(samples * (.92 / peak) * 1.15) / np.tanh(1.15) * .86
    pcm = np.int16(np.clip(samples, -1, 1) * 32767)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as wav:
        wav.setparams((1, 2, SR, 0, "NONE", "not compressed"))
        wav.writeframes(pcm.tobytes())


def sounds():
    c6, e6, g6 = 1046.5, 1318.5, 1568
    return {
        "se_click": mix((0, bell(.075, 1320, .42, 10)), (0, tone(.045, 260, 190, amp=.13, decay=8))),
        "se_confirm": mix((0, bell(.16, c6, .42, 7)), (.07, bell(.20, e6, .48, 6))),
        "se_back": mix((0, tone(.19, 820, 430, amp=.44, kind="triangle", decay=3)),
                       (.015, noise(.13, amp=.12, color="high", decay=4))),
        "se_error": mix((0, tone(.24, 185, 145, amp=.48, kind="square", decay=2.8)),
                        (.08, tone(.17, 153, 118, amp=.38, kind="square", decay=3.5))),
        "se_draw": mix((0, noise(.22, amp=.40, color="high", attack=.015, decay=2.5)),
                       (.08, tone(.12, 650, 1120, amp=.22, kind="triangle", decay=6))),
        "se_summon": mix((0, tone(.64, 170, 760, amp=.34, kind="triangle", attack=.05, decay=2)),
                         (.10, noise(.42, amp=.18, color="high", attack=.08, decay=2)),
                         (.32, bell(.38, 523.25, .35, 4)), (.43, bell(.34, 783.99, .34, 5))),
        "se_support": mix((0, tone(.48, 330, 1120, amp=.30, kind="triangle", attack=.025, decay=2.5)),
                          (0, noise(.36, amp=.13, color="high", attack=.04, decay=3)),
                          (.20, bell(.30, 880, .30, 6))),
        "se_effect": mix((0, bell(.34, 698.46, .32, 5)), (.055, bell(.34, 1046.5, .30, 5)),
                         (.11, bell(.30, 1396.9, .27, 6)), (0, noise(.25, amp=.08, color="high", decay=4))),
        "se_equip": mix((0, hit_body(.12, .32)), (.025, bell(.34, 1180, .48, 7)),
                        (.03, bell(.30, 1770, .22, 8))),
        "se_attack": mix((0, noise(.20, amp=.34, color="high", attack=.025, decay=4)),
                         (0, tone(.18, 1050, 230, amp=.28, kind="triangle", attack=.02, decay=4)),
                         (.13, hit_body(.13, .38))),
        "se_direct": mix((0, noise(.31, amp=.40, color="high", attack=.04, decay=3)),
                         (0, tone(.32, 920, 105, amp=.34, kind="triangle", attack=.035, decay=3)),
                         (.23, hit_body(.24, .76)), (.25, tone(.22, 90, 45, amp=.40, decay=6))),
        "se_guard": mix((0, hit_body(.15, .48)), (.015, bell(.39, 420, .55, 6)),
                        (.022, bell(.33, 1260, .24, 8)), (.01, noise(.10, amp=.18, color="high", decay=8))),
        "se_hit": mix((0, hit_body(.20, .78)), (0, noise(.10, amp=.16, color="high", decay=9))),
        "se_destroy": mix((0, hit_body(.31, .72)), (0, noise(.42, amp=.43, color="high", decay=5)),
                          (.07, bell(.30, 1510, .18, 9)), (.12, bell(.27, 2030, .16, 10)),
                          (.18, bell(.24, 1170, .13, 10))),
        "se_heal": mix((0, tone(.58, 310, 720, amp=.20, attack=.07, decay=2)),
                       (.03, bell(.36, 523.25, .28, 5)), (.15, bell(.37, 659.25, .30, 5)),
                       (.28, bell(.41, 783.99, .34, 5))),
        "se_buff": mix((0, tone(.60, 145, 480, amp=.32, kind="triangle", attack=.05, decay=1.8)),
                       (.08, tone(.50, 290, 960, amp=.20, attack=.05, decay=2.2)),
                       (.36, bell(.32, 880, .34, 5))),
        "se_mode": mix((0, tone(.13, 360, 650, amp=.35, kind="triangle", decay=5)),
                       (.105, tone(.17, 650, 410, amp=.39, kind="triangle", decay=5)),
                       (.10, noise(.07, amp=.13, color="high", decay=9))),
        "se_forge": mix((0, hit_body(.13, .55)), (.012, bell(.42, 510, .58, 7)),
                        (.02, bell(.36, 1530, .24, 9)), (.20, noise(.16, amp=.10, color="high", decay=7))),
        "se_turn": mix((0, bell(.44, 783.99, .34, 5)), (.08, bell(.44, 1046.5, .38, 5)),
                       (.17, bell(.40, 1318.5, .32, 6))),
        "se_battle": mix((0, hit_body(.34, .70)),
                         (.03, tone(.68, 98, 147, amp=.37, kind="triangle", attack=.02, decay=2)),
                         (.05, tone(.62, 147, 220, amp=.29, kind="triangle", attack=.03, decay=2)),
                         (.32, noise(.32, amp=.20, color="high", attack=.04, decay=4)),
                         (.38, bell(.36, 587.33, .25, 6))),
        "se_pack": mix((0, noise(.48, amp=.43, color="high", attack=.03, decay=2.3)),
                       (.05, tone(.34, 220, 760, amp=.18, kind="triangle", attack=.05, decay=3)),
                       (.30, bell(.32, 987.77, .26, 6))),
        "se_reveal": mix((0, noise(.15, amp=.36, color="high", attack=.015, decay=5)),
                         (.045, tone(.13, 420, 1180, amp=.27, kind="triangle", decay=7))),
        "se_rare": mix((0, tone(.92, 260, 520, amp=.17, attack=.10, decay=1.5)),
                       (0, bell(.48, c6, .26, 5)), (.11, bell(.53, e6, .29, 5)),
                       (.22, bell(.58, g6, .32, 5)), (.36, bell(.58, 2093, .28, 6)),
                       (.05, noise(.56, amp=.09, color="high", attack=.12, decay=2))),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = sounds()
    for name, samples in made.items():
        save(name, samples)
    print(f"generated {len(made)} files in {OUT}")


if __name__ == "__main__":
    main()
