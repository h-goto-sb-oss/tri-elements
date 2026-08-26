# -*- coding: utf-8 -*-
"""
assets/enemies と assets/backgrounds を走査して src/ui/assets_map.js を生成する。

  敵      : area-<エリア番号>-<敵番号>-<名前>.png  → 'a1:0' のようなキーで参照
  背景    : area-<エリア番号>-<名前>.png           → 'a1'
            battle-common.png                      → 'common'

  python tools/make_manifest.py
"""
import os, re, json

ENEMY_DIR = 'assets/enemies'
PLAYER_DIR = 'assets/players'
BG_DIR = 'assets/backgrounds'

def scan_enemies():
    out = {}
    if not os.path.isdir(ENEMY_DIR):
        return out
    for fn in sorted(os.listdir(ENEMY_DIR)):
        m = re.match(r'area-(\d+)-(\d+)-.*\.(png|jpg|jpeg|webp)$', fn, re.I)
        if not m:
            continue
        area, idx = int(m.group(1)), int(m.group(2))
        out[f'a{area}:{idx - 1}'] = f'/{ENEMY_DIR}/{fn}'
    return out

def scan_backgrounds():
    out = {}
    if not os.path.isdir(BG_DIR):
        return out
    for fn in sorted(os.listdir(BG_DIR)):
        if not fn.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            continue
        m = re.match(r'area-(\d+)-.*', fn, re.I)
        if m:
            out[f'a{int(m.group(1))}'] = f'/{BG_DIR}/{fn}'
        elif fn.lower().startswith('battle-common'):
            out['common'] = f'/{BG_DIR}/{fn}'
    return out

def scan_players():
    """avatar-<番号>-<名前>.png → 番号でひける"""
    out = {}
    if not os.path.isdir(PLAYER_DIR):
        return out
    for fn in sorted(os.listdir(PLAYER_DIR)):
        m = re.match(r'avatar-(\d+)-.*\.(png|jpg|jpeg|webp)$', fn, re.I)
        if m:
            out[str(int(m.group(1)))] = f'/{PLAYER_DIR}/{fn}'
    return out

def main():
    enemies, bgs, players = scan_enemies(), scan_backgrounds(), scan_players()
    with open('src/ui/assets_map.js', 'w', encoding='utf-8') as f:
        f.write('// tools/make_manifest.py が自動生成。手で編集しない。\n')
        f.write('// assets/enemies と assets/backgrounds を走査した結果。\n')
        f.write('export const ENEMY_ART = ' + json.dumps(enemies, ensure_ascii=False, indent=2) + ';\n\n')
        f.write('export const AREA_BG = ' + json.dumps(bgs, ensure_ascii=False, indent=2) + ';\n\n')
        f.write('export const PLAYER_ART = ' + json.dumps(players, ensure_ascii=False, indent=2) + ';\n')
    print(f'敵の立ち絵 {len(enemies)} 件 / 背景 {len(bgs)} 件 / アバター {len(players)} 件')

if __name__ == '__main__':
    main()
