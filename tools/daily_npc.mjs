// ============================================================
// 今日の選定の儀：敵キャラ24人（ライバル）の点数を AI に遊ばせて出す
//   node tools/daily_npc.mjs [日付 YYYY-MM-DD] [出力フォルダ]
//   → <出力フォルダ>/npc-<日付>.json  { day, pair, rivals: [{ key, score, wins }] }
//
// サーバー（/opt/te-stats/game）で毎日 0時すぎ（日本時間）に cron で動かす。
// プレイヤーと同じ条件：その日のピックの候補（同じ乱数）から選び、同じ5人・同じ山札の混ぜ方で戦う。
// 腕前は冒険での手加減（noise）をそのまま使う。トトは手加減が大きく、星辰王は本気。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { createGame, mulligan } from '../src/engine/game.js';
import { aiTakeTurn } from '../src/engine/ai.js';
import { card } from '../src/engine/cards.js';
import { aiChoose, DRAFT_ROUNDS, DRAFT_BATTLES, DRAFT_NOISE } from '../src/game/draft.js';
import {
  dayKey, dailyPair, dailyOptions, dailyOpponent, dailyBattleSeed, battleScore, runScore, RIVALS, mulberry, hash32,
} from '../src/game/daily.js';

const day = process.argv[2] || dayKey();
const outDir = process.argv[3] || '.';
const pair = dailyPair(day);

function wantsRedraw(state, pi) {
  const hand = state.players[pi].hand.map(card);
  return hand.filter(c => c.cost <= 2).length === 0 || hand.filter(c => c.cost >= 4).length >= 2;
}

function play(deckA, deckB, seed, noiseA, noiseB, rand) {
  const s = createGame({ decks: [deckA, deckB], seed, names: ['A', 'B'], startCost: [0, 0] });
  s.players[0].life = 20; s.players[1].life = 20;
  mulligan(s, 0, wantsRedraw(s, 0));
  mulligan(s, 1, wantsRedraw(s, 1));
  let guard = 0;
  while (s.winner === null && guard++ < 400) {
    aiTakeTurn(s, s.active, { noise: s.active === 0 ? noiseA : noiseB, rand, profile: 'balanced' });
  }
  if (s.winner === null) s.winner = s.players[0].life >= s.players[1].life ? 0 : 1;
  return s;
}

const rivals = [];
const t0 = Date.now();
for (const r of RIVALS) {
  const rand = mulberry(hash32(`tri-daily:${day}:rival:${r.key}`));
  const picks = [];
  for (let k = 0; k < DRAFT_ROUNDS; k++) {
    const opts = dailyOptions(day, pair, picks);
    picks.push(...opts[aiChoose(opts, picks, rand)]);
  }
  const scores = [];
  let wins = 0;
  for (let n = 0; n < DRAFT_BATTLES; n++) {
    const opp = dailyOpponent(day, n, pair);
    const s = play(picks, opp.deck, dailyBattleSeed(day, n), r.noise, opp.noise ?? DRAFT_NOISE[n], rand);
    const win = s.winner === 0;
    if (win) wins++;
    scores.push(battleScore({ win, myLife: s.players[0].life, turn: s.turn, foeStart: 20, foeLife: s.players[1].life }));
  }
  rivals.push({ key: r.key, score: runScore(scores, wins), wins });
}
rivals.sort((a, b) => b.score - a.score);
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `npc-${day}.json`);
fs.writeFileSync(out, JSON.stringify({ day, pair, rivals }));
console.log(`${day} ${pair.join('×')} ${rivals.length} rivals in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
console.log(rivals.slice(0, 5).map(r => `${r.key}:${r.score}(${r.wins})`).join(' '), '…', rivals.slice(-3).map(r => `${r.key}:${r.score}(${r.wins})`).join(' '));
