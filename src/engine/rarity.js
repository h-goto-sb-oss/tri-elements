// ============================================================
// レア度
//   common   コモン     … 基本の低コスト・バニラ・単純効果
//   uncommon アンコモン … 中コスト・役割のある効果
//   rare     レア       … 各属性の看板・切り札級（第1弾はここまで）
//   epic     エピック   … 第2弾の切り札。1枚で盤面がひっくり返る
//   legend   レジェンド … 第3弾の構築制限つき切り札
// ============================================================

export const RARITY = {
  common:   { key: 'common',   name: 'コモン',     short: 'C',  color: '#9fb0c4', order: 0 },
  uncommon: { key: 'uncommon', name: 'アンコモン', short: 'U',  color: '#6fd3a8', order: 1 },
  rare:     { key: 'rare',     name: 'レア',       short: 'R',  color: '#67b6ff', order: 2 },
  epic:     { key: 'epic',     name: 'エピック',   short: 'E',  color: '#c58cff', order: 3 },
  legend:   { key: 'legend',   name: 'レジェンド', short: 'L',  color: '#ffcf5a', order: 4 },
};

// カードID → レア度（ここに無いものは common）
export const RARITY_OF = {
  // ---------------- 第1弾（レアまで） ----------------
  // 炎
  f05: 'uncommon', f06: 'uncommon', f07: 'uncommon',
  f08: 'rare', f09: 'rare', f10: 'rare',
  sf3: 'uncommon', sf4: 'uncommon', sf5: 'rare',
  // 水
  w05: 'uncommon', w06: 'uncommon', w07: 'uncommon',
  w08: 'rare', w09: 'rare', w10: 'rare',
  sw3: 'uncommon', sw4: 'uncommon', sw5: 'rare',
  // 草
  g05: 'uncommon', g06: 'uncommon', g08: 'uncommon',
  g07: 'rare', g09: 'rare', g10: 'rare',
  sg3: 'uncommon', sg4: 'uncommon', sg5: 'rare',
  // 汎用
  sn7: 'uncommon', sn8: 'uncommon', sn9: 'uncommon', sn10: 'uncommon',

  // ---------------- 第2弾（エピックまで） ----------------
  // 炎
  x_f1: 'uncommon', x_f3: 'uncommon', x_sf1: 'uncommon',
  x_f2: 'rare', x_f4: 'rare', x_f5: 'rare', x_sf3: 'rare',
  x_f6: 'epic', x_sf2: 'epic',
  // 水
  x_w1: 'uncommon', x_w2: 'uncommon', x_w3: 'uncommon',
  x_sw1: 'uncommon', x_sw3: 'uncommon',
  x_w4: 'rare', x_w5: 'rare', x_w7: 'rare', x_sw4: 'rare', x_sw5: 'rare',
  x_w6: 'epic', x_sw2: 'epic',
  // 草
  x_g1: 'uncommon', x_g2: 'uncommon', x_g4: 'uncommon',
  x_sg1: 'uncommon', x_sg3: 'uncommon', x_sg5: 'uncommon', x_sg6: 'uncommon',
  x_g3: 'rare', x_g5: 'rare', x_sg4: 'rare',
  x_g6: 'epic', x_sg2: 'epic',
  // 汎用
  x_sn2: 'uncommon', x_sn1: 'rare',

  // ---------------- 第3弾『星辰の門』 ----------------
  // 炎
  z_f3: 'uncommon', z_f4: 'uncommon',
  z_f5: 'rare', z_f6: 'rare', z_sf2: 'rare',
  z_sf3: 'epic',
  // 水
  z_w3: 'uncommon', z_w4: 'uncommon', z_sw1: 'uncommon', z_sw2: 'uncommon',
  z_w5: 'rare', z_w6: 'rare', z_sw3: 'epic',
  // 草
  z_g3: 'uncommon', z_g4: 'uncommon',
  z_g5: 'rare', z_g6: 'rare', z_sg2: 'rare', z_sg3: 'epic',
  // 汎用
  z_sn1: 'uncommon', z_sn3: 'uncommon',
  // レジェンド
  z_lf1: 'legend', z_lw1: 'legend', z_lg1: 'legend', z_ln1: 'legend',

  // ---------------- キャラクターカード（隠し・全てレジェンド） ----------------
  c_toto: 'legend', c_garo: 'legend', c_morley: 'legend',
  c_pirika: 'legend', c_gou: 'legend', c_varga: 'legend',
  c_mina: 'legend', c_val: 'legend', c_nept: 'legend',
  c_rim: 'legend', c_yona: 'legend', c_verda: 'legend',
  c_twins: 'legend', c_nameless: 'legend', c_triades: 'legend',
  c_riina: 'legend', c_cardan: 'legend', c_ordo: 'legend',
  c_yue: 'legend', c_kairos: 'legend', c_astel: 'legend',
  c_nox: 'legend', c_dione: 'legend', c_astralis: 'legend',
};

export const rarityOf = id => RARITY_OF[id] || 'common';
