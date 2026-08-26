// プリセットデッキ（テスト＆キャンペーン用）
export const mk = pairs => pairs.flatMap(([id, n]) => Array(n).fill(id));

export const PRESET_DECKS = {
  starter: {
    name: '見習いの手札', element: 'none',
    list: mk([
      ['f01', 3], ['f03', 3], ['f05', 2],
      ['w01', 2], ['w03', 3], ['w04', 2],
      ['g01', 3], ['g03', 3], ['g05', 1],
      ['sn1', 2], ['sn2', 2], ['sn5', 2], ['sf1', 2],
    ]),
  },
  fireAggro: {
    name: '烈火の速攻', element: 'fire',
    list: mk([
      ['f01', 3], ['f02', 3], ['f03', 3], ['f04', 3], ['f05', 3], ['f07', 2], ['f09', 2],
      ['sf1', 3], ['sf2', 2], ['sf4', 2], ['sn6', 2], ['sn2', 2],
    ]),
  },
  waterControl: {
    name: '深海の潮流', element: 'water',
    list: mk([
      ['w01', 3], ['w03', 3], ['w04', 3], ['w05', 3], ['w07', 2], ['w08', 2], ['w09', 2],
      ['sw1', 2], ['sw2', 2], ['sw3', 3], ['sw4', 2], ['sn2', 3],
    ]),
  },
  grassMid: {
    name: '大樹の陣', element: 'grass',
    list: mk([
      ['g01', 3], ['g02', 3], ['g03', 3], ['g04', 3], ['g05', 2], ['g07', 3], ['g08', 2], ['g09', 2],
      ['sg1', 3], ['sg2', 2], ['sg4', 2], ['sn5', 2],
    ]),
  },
  fireGrass: {
    name: '灼熱の森', element: 'fire',
    list: mk([
      ['f01', 3], ['f03', 3], ['f05', 3], ['f08', 2], ['f09', 2],
      ['g01', 3], ['g03', 3], ['g04', 2], ['g07', 2],
      ['sf2', 2], ['sg1', 3], ['sn6', 2],
    ]),
  },
  waterGrass: {
    name: '潤いの庭', element: 'water',
    list: mk([
      ['w01', 3], ['w04', 3], ['w05', 3], ['w08', 2], ['w09', 2],
      ['g02', 3], ['g03', 3], ['g07', 2], ['g09', 2],
      ['sw3', 2], ['sg1', 3], ['sn5', 2],
    ]),
  },
  // --- 第2弾を含むデッキ（パック入手後の想定） ---
  waterMill: {
    name: '忘却の潮', element: 'water',
    list: mk([
      ['w01', 3], ['w05', 3], ['w08', 3], ['x_w7', 3], ['x_w3', 3], ['x_w1', 2],
      ['x_sw3', 3], ['x_sw4', 2], ['sw3', 3], ['sw1', 2], ['x_sw5', 3],
    ]),
  },
  waterTempo: {
    name: '碧海の刃', element: 'water',
    list: mk([
      ['w03', 3], ['w04', 3], ['w07', 3], ['x_w4', 3], ['x_w5', 3], ['w09', 2], ['x_w6', 2],
      ['sw4', 3], ['x_sw2', 2], ['sw3', 3], ['sn2', 3],
    ]),
  },
  grassWall: {
    name: '不動の森', element: 'grass',
    list: mk([
      ['g02', 3], ['g05', 3], ['x_g4', 3], ['g07', 3], ['g09', 2], ['g10', 2],
      ['x_sg5', 3], ['x_sg3', 3], ['x_sg6', 3], ['x_sg4', 3], ['sn5', 2],
    ]),
  },
  grassBest: {
    name: '大樹の躍動', element: 'grass',
    list: mk([
      ['g01', 3], ['x_g2', 3], ['x_g3', 3], ['g07', 3], ['x_g5', 3], ['g09', 2], ['g10', 2],
      ['x_sg4', 3], ['sg1', 3], ['x_sg1', 3], ['sn6', 2],
    ]),
  },
  fireDouble: {
    name: '双炎の連撃', element: 'fire',
    list: mk([
      ['f01', 3], ['f03', 3], ['x_f2', 3], ['x_f4', 3], ['f05', 3], ['f08', 2], ['f09', 2],
      ['sf2', 3], ['x_sf1', 3], ['x_sf3', 3], ['sf1', 2],
    ]),
  },
};

for (const [k, d] of Object.entries(PRESET_DECKS)) {
  if (d.list.length !== 30) throw new Error(`deck ${k} has ${d.list.length} cards`);
}
