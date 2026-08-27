# -*- coding: utf-8 -*-
"""
OneDrive のイラスト素材をカードIDへ割り当てて assets/art/<id>.png へコピーする。
ファイル名の「NN_カード名.png」の カード名 でカードと突き合わせる。

  python tools/import_art.py [--dry]
"""
import os, re, sys, json, shutil, unicodedata
from PIL import Image

SRC = r'C:\Users\pc\OneDrive\ドキュメント\Claude用\TRI_ELEMENTS_イラスト素材_統一サイズ'
OUT = 'assets/art'
FOLDER_ELEMENT = {'炎属性': 'fire', '水属性': 'water', '草属性': 'grass', '汎用サポート': 'none'}

# 素材側の表記ゆれ → カード名
ALIAS = {
    '水壁のクラーケン': '氷壁のクラーケン',
    '泡の進化師': '泡の道化師',
    '葛絡みの精霊': '蔦絡みの精霊',
    '緑竜シードレイク': '棘竜ソーンドレイク',
    '防衛指令': '防御指令',
    '森の概念': '森の砦',
    '森の護り': '茨の報復',
}

def norm(s):
    s = unicodedata.normalize('NFKC', s)
    return re.sub(r'[\s　]', '', s)

def load_cards():
    """cards.js / cards_set2.js から id・名前・属性を拾う"""
    out = []
    for path in ('src/engine/cards.js', 'src/engine/cards_set2.js', 'src/engine/cards_set3.js'):
        src = open(path, encoding='utf-8').read()
        for m in re.finditer(r"[MS]\('([\w]+)', '([^']+)', '(\w+)'", src):
            out.append({'id': m.group(1), 'name': m.group(2), 'element': m.group(3)})
    return out

SIZE = 384      # 出力サイズ
PAD = 0.07      # 中身の周囲に残す余白の割合

def trim_and_save(src, dst):
    """透明な余白を落として正方形に整え、拡大して保存する。
    素材は 512px の中央に 170px ほどで描かれていて、そのままだと小さすぎる。"""
    im = Image.open(src).convert('RGBA')
    bb = im.getchannel('A').getbbox()
    if not bb:
        im.resize((SIZE, SIZE), Image.LANCZOS).save(dst); return
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    side = int(max(w, h) * (1 + PAD * 2))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    box = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
    im.crop(box).resize((SIZE, SIZE), Image.LANCZOS).save(dst)

def main():
    dry = '--dry' in sys.argv
    cards = load_cards()
    by_key = {}
    for c in cards:
        by_key.setdefault((c['element'], norm(c['name'])), c)

    os.makedirs(OUT, exist_ok=True)
    matched, unmatched_files, used = {}, [], set()
    for folder, el in FOLDER_ELEMENT.items():
        d = os.path.join(SRC, folder)
        if not os.path.isdir(d):
            print('フォルダなし:', d); continue
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith('.png'):
                continue
            raw = re.sub(r'^\d+_', '', os.path.splitext(fn)[0])
            name = ALIAS.get(raw.strip(), raw.strip())
            c = by_key.get((el, norm(name)))
            if not c:
                unmatched_files.append((folder, fn, name)); continue
            matched[c['id']] = os.path.join(d, fn)
            used.add(c['id'])

    missing_cards = [c for c in cards if c['id'] not in used]
    print(f'一致 {len(matched)} 枚 / 素材側で未対応 {len(unmatched_files)} / カード側で絵なし {len(missing_cards)}')
    for f in unmatched_files:
        print('  素材が余った:', f[0], f[1])
    for c in missing_cards:
        print('  絵が無いカード:', c['element'], c['id'], c['name'])

    if dry:
        return
    for cid, src in matched.items():
        trim_and_save(src, os.path.join(OUT, f'{cid}.png'))
    with open('src/ui/art_map.js', 'w', encoding='utf-8') as f:
        f.write('// tools/import_art.py が自動生成。手で編集しない。\n')
        f.write('// カードIDごとの差し替えイラスト（512x512 透過PNG）。\n')
        f.write('export const ART_MAP = ' +
                json.dumps({k: f'assets/art/{k}.png' for k in sorted(matched)},
                           ensure_ascii=False, indent=2) + ';\n')
    print('コピー完了')

if __name__ == '__main__':
    main()
