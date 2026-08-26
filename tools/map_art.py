# -*- coding: utf-8 -*-
"""
切り出したイラストを各カードに割り当てて assets/art/<cardId>.png へコピーし、
src/ui/art_map.js を生成する。

割り当ての方針:
  炎(第1弾)  … 参考シートの名前が完全一致するのでそのまま対応
  水/草/サポート … 名前は違うので「生き物の種類・役割」で対応付け
  余ったイラストは第2弾のカードへ
"""
import os, shutil, json

# cardId: 'シート番号:グループ+番号'
MAP = {
    # ---------- 第1弾 炎（名前が完全一致） ----------
    'f01': '1:fire01', 'f02': '1:fire02', 'f03': '1:fire03', 'f04': '1:fire04', 'f05': '1:fire05',
    'f06': '1:fire06', 'f07': '1:fire07', 'f08': '1:fire08', 'f09': '1:fire09', 'f10': '1:fire10',

    # ---------- 第1弾 水 ----------
    'w01': '1:water01',   # シズククラゲ      ← 青いスライム状の生き物
    'w02': '1:water05',   # 潮見の巫女        ← 水の魔法使いの少女
    'w03': '1:water04',   # アイスシャーク    ← イルカ（魚系の高速アタッカー）
    'w04': '1:water07',   # 泡沫のセイレーン  ← 人魚
    'w05': '1:water06',   # 氷結の番人        ← 氷のゴーレム
    'w06': '1:water03',   # 深海の伝令        ← 波に乗るカメ
    'w07': '2:water02',   # 霧隠れのウナギ    ← 細長い魚
    'w08': '1:water09',   # 氷壁のクラーケン  ← タコ
    'w09': '1:water10',   # 海淵のリヴァイアサン ← 水竜
    'w10': '1:water08',   # 大海嘯の王 ネプチューナ ← 三叉槍の海神

    # ---------- 第1弾 草 ----------
    'g01': '2:grass01',   # ふたばウサギ      ← 緑のうさぎ
    'g02': '1:grass04',   # トゲの門番        ← ハリネズミ
    'g03': '2:grass07',   # キノコ戦士        ← キノコ
    'g04': '2:grass03',   # 蔦絡みの精霊      ← 蔦
    'g05': '1:grass06',   # 森羅の守り手      ← 苔のゴーレム
    'g06': '1:grass08',   # 花咲く癒し手      ← 花冠の巫女
    'g07': '1:grass09',   # 大樹のトレント    ← 古木
    'g08': '1:grass02',   # 猛毒のマンドラゴラ ← 根の生き物
    'g09': '2:grass10',   # 古森の巨人        ← 大きな樹人
    'g10': '1:grass10',   # 世界樹の化身 ユグドラ ← 最も巨大な樹

    # ---------- 第1弾 サポート ----------
    'sf2': '1:none04',    # 灼熱の刃    ← 炎の剣
    'sw1': '1:none05',    # 潮のしずく  ← 癒しの雫
    'sw2': '1:none03',    # 氷の護り    ← 青い盾
    'sw3': '1:none07',    # 導きの潮流  ← カード2枚
    'sw4': '1:none09',    # 渦潮の呼び声 ← 渦（バウンス）
    'sw5': '1:none08',    # 深淵の予言  ← 虫めがね（先読み）
    'sg3': '2:none04',    # 森の加護    ← 翼のあるハート（守り）
    'sg4': '2:none06',    # 再生の芽吹き ← 芽吹く木
    'sn1': '1:none01',    # 応急手当    ← ポーション
    'sn2': '2:none07',    # 戦術の書    ← 本
    'sn3': '2:none03',    # 防御指令    ← 旗
    'sn5': '2:none05',    # 鋼の盾      ← 銀の盾
    'sn9': '1:none02',    # 記憶の欠片  ← 結晶
    'sn10': '1:none10',   # 最後の抵抗  ← 輝く星

    # ---------- 第2弾 ----------
    'x_f1': '2:fire01',   # 溶岩の申し子
    'x_f2': '2:fire02',   # 火喰い鳥 ヒクイ
    'x_f3': '2:fire07',   # 火山の巫女
    'x_f4': '2:fire08',   # 灼熱の双子
    'x_f5': '2:fire03',   # 炎獣キマイラ ← 炎の獣
    'x_f6': '2:fire10',   # 焦土の王 イグナ
    'x_w1': '2:water07',  # 深淵の触手 ← イカ
    'x_w2': '2:water01',  # 泡の道化師 ← 泡のうさぎ
    'x_w3': '2:water04',  # 潮汐の守護者 ← カメ
    'x_w4': '2:water08',  # 氷結の魔女
    'x_w5': '2:water09',  # 海竜レヴィオン
    'x_w6': '2:water10',  # 深海王 アビスガルド
    'x_g1': '1:grass01',  # 種まきの精 ← 緑のスライム
    'x_g2': '2:grass02',  # 若木の戦士 ← どんぐり
    'x_g3': '1:grass05',  # 花吹雪の舞手 ← 花の踊り子
    'x_g4': '1:grass03',  # 苔むす古兵 ← 森の射手
    'x_g5': '2:grass09',  # 棘竜ソーンドレイク ← 緑の竜
    'x_g6': '2:grass08',  # 大地竜ガイオン ← 大地の獣
    'x_sw2': '2:none08',  # 深海の渦 ← 巻き戻しの矢印
    'x_sn1': '2:none02',  # 英雄の紋章 ← 青い結晶
    'x_sn2': '2:none10',  # 入れ替えの符 ← 門
}

OUT = 'assets/art'

def main():
    os.makedirs(OUT, exist_ok=True)
    jsmap = {}
    missing = []
    for cid, ref in MAP.items():
        sh, name = ref.split(':')
        src = os.path.join('assets', f'sheet{sh}', f'{name}.png')
        if not os.path.exists(src):
            missing.append((cid, src)); continue
        dst = os.path.join(OUT, f'{cid}.png')
        shutil.copyfile(src, dst)
        jsmap[cid] = f'assets/art/{cid}.png'
    with open('src/ui/art_map.js', 'w', encoding='utf-8') as f:
        f.write('// tools/map_art.py が自動生成。手で編集しない。\n')
        f.write('// カードIDごとの差し替えイラスト。ここに無いカードは手続き生成の絵を使う。\n')
        f.write('export const ART_MAP = ' + json.dumps(jsmap, ensure_ascii=False, indent=2) + ';\n')
    print(f'割り当て {len(jsmap)} 枚 / 未検出 {len(missing)}')
    for m in missing:
        print('  missing', m)

if __name__ == '__main__':
    main()
