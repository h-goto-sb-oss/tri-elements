// ============================================================
// 【氷の防壁】が「相手のターンの攻撃」から守れているかを確かめる。
//   自分のターンだけ守っても、モンスターが壊されるのは相手のターンなので
//   意味がない。そこが直っているかを、実際に殴らせて確認する。
//   node sim/test_ward.mjs
// ============================================================
import { createGame, mulligan, playSupport, applyAction } from '../src/engine/game.js';

function setup() {
  const s = createGame({ decks: [Array(30).fill('b_w2'), Array(30).fill('f03')], seed: 7, names: ['自分', '相手'] });
  mulligan(s, 0, false); mulligan(s, 1, false);
  const me = s.players[0], foe = s.players[1];
  const mon = (id, atk, def) => ({
    id, atk, def, tempAtk: 0, tempDef: 0, auraAtk: 0, auraDef: 0, auraKw: [], auraEl: [],
    hasAttacked: false, attacks: 0, mode: 'attack', summonedTurn: 0,
  });
  // 自分: 隣り合う2体（防壁の条件）。相手: それを一撃で壊せる打点
  me.field[0] = mon('b_w2', 3, 2);
  me.field[1] = mon('b_w2', 3, 2);
  foe.field[0] = mon('f03', 9, 4);
  me.hand = ['b_sw2'];
  me.cost = me.maxCost = 5;
  return s;
}

function foeAttacks(s) {
  s.active = 1;
  s.players[1].field[0].hasAttacked = false;
  s.players[1].field[0].attacks = 0;
  applyAction(s, 1, { type: 'attack', slot: 0, target: 0 });
}

// --- その1: 防壁を張った直後、相手のターンに殴られる ---
let s = setup();
playSupport(s, 0, 0, {});
s.turn++;                       // 相手のターンへ
foeAttacks(s);
const survivedFoeTurn = s.players[0].field[0] !== null;

// --- その2: そのさらに次の相手ターンには、もう守られていない ---
s.turn += 2;                    // 自分のターン → 次の相手ターン
foeAttacks(s);
const diedLater = s.players[0].field[0] === null;

// --- その3: 隣にモンスターがいない単体は守られない ---
let t = setup();
t.players[0].field[1] = null;
playSupport(t, 0, 0, {});
t.turn++;
foeAttacks(t);
const loneDied = t.players[0].field[0] === null;

const ok = survivedFoeTurn && diedLater && loneDied;
console.log(`相手のターンの攻撃を防いだ            : ${survivedFoeTurn ? 'OK' : 'NG'}`);
console.log(`次の相手ターンには効果が切れている    : ${diedLater ? 'OK' : 'NG'}`);
console.log(`隣に誰もいない1体は守られない        : ${loneDied ? 'OK' : 'NG'}`);
console.log(ok ? '\n【氷の防壁】は正しく働いています' : '\n直っていません');
process.exit(ok ? 0 : 1);
