# -*- coding: utf-8 -*-
"""
配信用の画像を作る。

  assets/            … 差し替え用の原本（PNG・高解像度）。ここは触らない。
  public/assets/     … このツールが作る配信用（WebP・表示に必要な解像度）。

Vite は public/ の中身を dev でもそのまま配信し、build では dist/ へ丸ごとコピーする。
逆にプロジェクト直下の assets/ は dist へコピーされないので、公開するなら
このツールを通す必要がある。

解像度は「実際に画面で使われる最大サイズ × 2（高精細ディスプレイ用）」を上限にした。
カードのイラストは図鑑の拡大表示で等倍近くまで使うので縮小しない。

  python tools/optimize_assets.py [--dry] [--force]
"""
import io, os, sys, json, re, shutil

from PIL import Image

SRC_ROOT = 'assets'
OUT_ROOT = os.path.join('public', 'assets')

# フォルダごとの上限の長辺と WebP の品質
RULES = {
    'art':         {'max': None, 'q': 85},   # 図鑑の拡大で使うので縮小しない
    'enemies':     {'max': 768,  'q': 82},   # 冒険画面で最大 267px 表示
    'players':     {'max': 512,  'q': 85},   # アバター選択で最大 88px 表示
    'backgrounds': {'max': 1600, 'q': 80},   # 全画面の背景（暗幕越しに敷く）
}
EXTS = ('.png', '.jpg', '.jpeg', '.webp')

# 変換せずそのまま配信するフォルダ（音・SVGロゴなど）。
# public/ は .gitignore なので、ここに写しておかないとビルドに含まれない。
COPY_FOLDERS = ['audio', 'ui']
COPY_SKIP = ('.txt', '.md')


def convert(src, dst, max_side, quality):
    im = Image.open(src)
    im = im.convert('RGBA' if 'A' in im.getbands() or im.mode == 'P' else 'RGB')
    if max_side:
        w, h = im.size
        if max(w, h) > max_side:
            k = max_side / max(w, h)
            im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=quality, method=6)
    return im.size


def main():
    dry = '--dry' in sys.argv
    force = '--force' in sys.argv
    if not os.path.isdir(SRC_ROOT):
        print('assets/ がありません'); return

    total_src = total_out = 0
    made = skipped = 0
    for folder, rule in RULES.items():
        d = os.path.join(SRC_ROOT, folder)
        if not os.path.isdir(d):
            print(f'  {folder}: フォルダなし'); continue
        fsrc = fout = 0
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith(EXTS):
                continue
            src = os.path.join(d, fn)
            dst = os.path.join(OUT_ROOT, folder, os.path.splitext(fn)[0] + '.webp')
            fsrc += os.path.getsize(src)
            # 原本が新しいときだけ作り直す
            if not force and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                fout += os.path.getsize(dst); skipped += 1; continue
            if dry:
                made += 1; continue
            convert(src, dst, rule['max'], rule['q'])
            fout += os.path.getsize(dst); made += 1
        total_src += fsrc; total_out += fout
        cut = (1 - fout / fsrc) * 100 if fsrc else 0
        print(f'  {folder:12} {fsrc/1048576:7.1f}MB → {fout/1048576:6.1f}MB  ({cut:4.1f}% 削減)')

    print(f'  {"合計":12} {total_src/1048576:7.1f}MB → {total_out/1048576:6.1f}MB'
          f'  ({(1 - total_out/total_src)*100 if total_src else 0:.1f}% 削減)'
          f'  新規{made} / 据え置き{skipped}')
    copy_as_is(dry)

    if dry:
        print('  (--dry のため書き出していません)')
        return
    rewrite_manifests()


def copy_as_is(dry=False):
    """音・SVG など変換しないものを public/ へ写す"""
    for folder in COPY_FOLDERS:
        d = os.path.join(SRC_ROOT, folder)
        if not os.path.isdir(d):
            continue
        n = size = 0
        for fn in sorted(os.listdir(d)):
            src = os.path.join(d, fn)
            if not os.path.isfile(src) or fn.lower().endswith(COPY_SKIP):
                continue
            dst = os.path.join(OUT_ROOT, folder, fn)
            size += os.path.getsize(src); n += 1
            if dry:
                continue
            if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
        print(f'  {folder:12} {size/1048576:7.1f}MB そのまま複製 {n}件')


def rewrite_manifests():
    """配信用の webp が在るものは、参照先をそちらへ差し替える"""
    def swap(path):
        """assets/xxx/name.png -> 実在すれば .webp"""
        rel = path.lstrip('/')
        stem = os.path.splitext(rel)[0]
        if os.path.exists(os.path.join('public', stem + '.webp')):
            return '/' + stem + '.webp'
        return path

    n = 0
    # --- art_map.js ---
    p = 'src/ui/art_map.js'
    if os.path.exists(p):
        s = io.open(p, encoding='utf-8').read()
        m = re.search(r'export const ART_MAP = (\{.*?\});', s, re.S)
        if m:
            data = json.loads(m.group(1))
            data = {k: swap(v) for k, v in data.items()}
            s = s[:m.start(1)] + json.dumps(data, ensure_ascii=False, indent=2) + s[m.end(1):]
            io.open(p, 'w', encoding='utf-8').write(s)
            n += len(data)

    # --- assets_map.js ---
    p = 'src/ui/assets_map.js'
    if os.path.exists(p):
        s = io.open(p, encoding='utf-8').read()
        for name in ('ENEMY_ART', 'AREA_BG', 'PLAYER_ART'):
            m = re.search(r'export const ' + name + r' = (\{.*?\});', s, re.S)
            if not m:
                continue
            data = json.loads(m.group(1))
            data = {k: swap(v) for k, v in data.items()}
            s = s[:m.start(1)] + json.dumps(data, ensure_ascii=False, indent=2) + s[m.end(1):]
            n += len(data)
        io.open(p, 'w', encoding='utf-8').write(s)
    print(f'  参照先を webp に差し替え: {n} 件')


if __name__ == '__main__':
    main()
