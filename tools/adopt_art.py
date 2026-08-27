# -*- coding: utf-8 -*-
"""
assets/art に「カード名.png」で置かれたイラストをカードIDへ紐づけ直し、
src/ui/art_map.js を作り直す。

OneDrive を経由せず直接 assets/art へ放り込んだ素材を取り込むための道具。
すでに <カードID>.png になっているファイルはそのまま残す。

  python tools/adopt_art.py [--dry]
"""
import os, sys, json, unicodedata, re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_art import load_cards, norm, trim_and_save, ALIAS, OUT


def main():
    dry = '--dry' in sys.argv
    cards = load_cards()
    by_name = {}
    for c in cards:
        by_name.setdefault(norm(c['name']), c)
    ids = {c['id'] for c in cards}

    renamed, leftover = [], []
    for fn in sorted(os.listdir(OUT)):
        if not fn.lower().endswith('.png'):
            continue
        stem = os.path.splitext(fn)[0]
        if stem in ids:
            continue                                  # すでにID名
        name = ALIAS.get(stem.strip(), stem.strip())
        c = by_name.get(norm(name))
        if not c:
            leftover.append(fn); continue
        renamed.append((fn, c['id'], c['name']))

    print(f'ID化する素材 {len(renamed)} 枚 / 名前が一致しない {len(leftover)} 枚')
    for fn, cid, nm in renamed:
        print(f'  {fn}  ->  {cid}.png  ({nm})')
    for fn in leftover:
        print('  一致しない:', fn)

    if not dry:
        for fn, cid, _ in renamed:
            src = os.path.join(OUT, fn)
            trim_and_save(src, os.path.join(OUT, f'{cid}.png'))
            os.remove(src)

    # 実在する <カードID>.png だけで art_map.js を作り直す
    have = sorted(c['id'] for c in cards
                  if os.path.exists(os.path.join(OUT, f"{c['id']}.png")))
    print(f'art_map.js に載せる枚数: {len(have)} / 全カード {len(cards)}')
    missing = [c for c in cards if c['id'] not in set(have)]
    for c in missing:
        print('  絵が無いカード:', c['element'], c['id'], c['name'])
    if dry:
        return
    with open('src/ui/art_map.js', 'w', encoding='utf-8') as f:
        f.write('// tools/import_art.py / tools/adopt_art.py が自動生成。手で編集しない。\n')
        f.write('// カードIDごとの差し替えイラスト（透過PNG）。\n')
        f.write('export const ART_MAP = ' +
                json.dumps({k: f'assets/art/{k}.png' for k in have},
                           ensure_ascii=False, indent=2) + ';\n')
    print('art_map.js を更新しました')


if __name__ == '__main__':
    main()
