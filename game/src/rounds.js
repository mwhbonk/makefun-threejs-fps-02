// DUSTLINE rounds — the match state machine. Buy phase, live round, round
// end, match end. Money follows the Counter-Strike shape: kill and plant
// rewards, win/loss bonuses with a loss streak, and weapons that stay with
// you only if you survive. First to 5 rounds, at most 9.

import { giveWeapon, WEAPONS, GRENADE_PRICE, KEVLAR_PRICE, SMOKE_PRICE, HELMET_PRICE } from './weapons.js';

export const BUY_TIME = 20;
export const ROUND_TIME = 100;
export const WIN_SCORE = 5;
export const MAX_ROUNDS = 9;

export function newMatchState() {
  return {
    round: 0, scoreK: 0, scoreH: 0,
    phase: 'buy', phaseT: BUY_TIME, roundTime: ROUND_TIME,
    bomb: { planted: false, dropped: false, site: null, pos: null, timer: 0, carrier: null },
    lossStreak: { K: 0, H: 0 },
    winner: null, reason: '', matchOver: false,
  };
}

function resetAgentForRound(G, a, spawn, yaw) {
  a.pos.set(spawn[0], 0, spawn[1]);
  a.vel.set(0, 0, 0); a.vy = 0;
  a.yaw = yaw; a.pitch = 0;
  a.hp = 100; a.alive = true;
  a.group.visible = true;
  a.group.position.copy(a.pos);
  a.planting = 0; a.defusing = 0; a.bloom = 0; a.reloading = 0;
  a.grenades = 0; a.smokes = 0; a.helmet = false;
  a.hasBomb = false;
}

export function startRound(G, n) {
  const R = G.rounds;
  R.round = n;
  R.phase = 'buy'; R.phaseT = BUY_TIME; R.roundTime = ROUND_TIME;
  R.bomb = { planted: false, dropped: false, site: null, pos: null, timer: 0, carrier: null };
  R.winner = null; R.reason = '';
  // Survivors keep their weapons; the dead fall back to the pistol.
  for (const a of G.agents) {
    const spawn = G.world.spawns[a.team][(a.id - 1) % 5];
    const yaw = a.team === 'K' ? 0 : Math.PI;
    const survived = a.alive;
    resetAgentForRound(G, a, spawn, yaw);
    if (!survived) { a.armor = 0; a.helmet = false; a.stash = {}; a.owned = []; } // death loses kevlar, helmet and guns
    if (!survived || !a.weapon) giveWeapon(G, a, 'pistol');
    else giveWeapon(G, a, a.weapon); // fresh magazines, same gun
    if (a.isBot) {
      // Bots buy to their money: rifle when rich, SMG mid, pistol poor.
      if (a.money >= 2700 && a.weapon === 'pistol') giveWeapon(G, a, 'rifle');
      else if (a.money >= 1500 && a.weapon === 'pistol') giveWeapon(G, a, 'smg');
      if (a.money >= 650 && a.armor === 0 && Math.random() < 0.5) { a.armor = 100; a.money -= 650; }
      if (a.money >= 300 && Math.random() < 0.4) { a.smokes = 1; a.money -= 300; }
    }
  }
  // The Spike starts with the player.
  G.player.hasBomb = true;
  R.bomb.carrier = G.player;
  if (G.assignBotRoles) G.assignBotRoles();
  if (G.say) {
    const kBots = G.agents.filter((a) => a.isBot && a.team === 'K');
    const caller = kBots[Math.floor(Math.random() * kBots.length)];
    const site = caller && caller.ai ? caller.ai.site || 'A' : 'A';
    if (caller) G.say(caller, n === 1 ? `executing ${site} — go go go` : `round ${n}: hit ${site} together`);
    // The round plan shows under the top bar: site + the player's job.
    G.plan = site === 'B' ? 'PLAN: SPLIT B — YOU: ENTRY' : 'PLAN: SPLIT A — YOU: ENTRY';
    G._planT = 12;
  }
  if (G.showBanner) G.showBanner(`ROUND ${n}`, 'Buy phase — B opens the shop', 2.5);
  if (G.sfx) G.sfx.horn();
}

export function endRound(G, winner, reason) {
  const R = G.rounds;
  if (R.phase === 'end' || R.matchOver) return;
  R.phase = 'end'; R.phaseT = 4; R.winner = winner; R.reason = reason;
  if (winner === 'K') { R.scoreK++; R.lossStreak.K = 0; R.lossStreak.H++; }
  else { R.scoreH++; R.lossStreak.H = 0; R.lossStreak.K++; }
  for (const a of G.agents) {
    if (a.team === winner) a.money += 3250;
    else a.money += Math.min(3400, 1900 + 500 * (R.lossStreak[a.team] - 1));
  }
  if (G.showBanner) G.showBanner(
    winner === 'K' ? 'KESTREL WINS THE ROUND' : 'HALCYON WINS THE ROUND', reason, 4);
  if (G.sfx) G.sfx.horn();
  if (R.scoreK >= WIN_SCORE || R.scoreH >= WIN_SCORE || R.round >= MAX_ROUNDS) {
    R.matchOver = true;
    const mw = R.scoreK > R.scoreH ? 'K' : R.scoreH > R.scoreK ? 'H' : null;
    if (G.showBanner) G.showBanner(
      mw === 'K' ? 'KESTREL TAKES THE MATCH' : mw === 'H' ? 'HALCYON TAKES THE MATCH' : 'MATCH DRAWN',
      `${R.scoreK} — ${R.scoreH}`, 6);
  }
}

export function buyWeapon(G, a, id) {
  const R = G.rounds;
  if (R.phase !== 'buy' || !a.alive) return false;
  if (id === 'grenade') {
    if (a.grenades >= 2 || a.money < GRENADE_PRICE) return false;
    a.money -= GRENADE_PRICE; a.grenades++; return true;
  }
  if (id === 'kevlar') {
    if (a.armor >= 100 || a.money < KEVLAR_PRICE) return false;
    a.money -= KEVLAR_PRICE; a.armor = 100; return true;
  }
  if (id === 'smoke') {
    if ((a.smokes || 0) >= 2 || a.money < SMOKE_PRICE) return false;
    a.money -= SMOKE_PRICE; a.smokes = (a.smokes || 0) + 1; return true;
  }
  if (id === 'helmet') {
    if (a.helmet || a.money < HELMET_PRICE) return false;
    a.money -= HELMET_PRICE; a.helmet = true; return true;
  }
  const w = WEAPONS[id];
  if (!w || a.money < w.price) return false;
  a.money -= w.price;
  giveWeapon(G, a, id);
  return true;
}

export function updateRounds(G, dt) {
  const R = G.rounds;
  if (R.matchOver && R.phase === 'end') { R.phaseT -= dt; return; }
  if (R.phase === 'buy') {
    R.phaseT -= dt;
    if (R.phaseT <= 0) { R.phase = 'live'; if (G.showBanner) G.showBanner('GO GO GO', '', 1.5); }
    return;
  }
  if (R.phase !== 'live') {
    R.phaseT -= dt;
    if (R.phaseT <= 0) {
      if (R.matchOver) return;
      startRound(G, R.round + 1);
    }
    return;
  }
  R.roundTime -= dt;
  // Bomb timer.
  if (R.bomb.planted) {
    R.bomb.timer -= dt;
    if (R.bomb.timer <= 0) { endRound(G, 'K', 'SPIKE DETONATED'); return; }
  }
  // Player planting / defusing (hold E).
  const p = G.player;
  if (p.alive && G.input.keys['KeyE']) {
    if (!R.bomb.planted && p.hasBomb) {
      const site = Object.values(G.world.sites).find((s) =>
        Math.hypot(p.pos.x - s.center.x, p.pos.z - s.center.z) < s.r);
      if (site) {
        p.planting += dt;
        if (p.planting >= 3.5) {
          p.planting = 0; p.hasBomb = false;
          R.bomb.planted = true;
          R.bomb.site = site === G.world.sites.A ? 'A' : 'B';
          R.bomb.pos = site.center.clone(); R.bomb.pos.y = 0.1;
          R.bomb.timer = 35;
          p.money += 300;
          if (G.showBanner) G.showBanner('SPIKE PLANTED', 'Halcyon must defuse', 3);
          if (G.sfx) G.sfx.plant();
          if (G.say) G.say(p, `spike planted at site ${R.bomb.site}`);
        }
      } else p.planting = 0;
    } else if (R.bomb.planted && p.team === 'H') {
      // Player is Kestrel; this branch stays for completeness.
    }
    if (R.bomb.planted && p.team === 'H') {
      const d = Math.hypot(p.pos.x - R.bomb.pos.x, p.pos.z - R.bomb.pos.z);
      if (d < 1.6) {
        p.defusing += dt;
        if (p.defusing >= 5) { p.defusing = 0; endRound(G, 'H', 'SPIKE DEFUSED'); return; }
      } else p.defusing = 0;
    }
  } else { p.planting = 0; p.defusing = 0; }
  // Bomb pickup: walk over a dropped Spike.
  if (R.bomb.dropped && p.alive && p.team === 'K') {
    const d = Math.hypot(p.pos.x - R.bomb.pos.x, p.pos.z - R.bomb.pos.z);
    if (d < 1.2) { R.bomb.dropped = false; p.hasBomb = true; R.bomb.carrier = p; }
  }
  // Elimination.
  const kAlive = G.agents.some((a) => a.alive && a.team === 'K');
  const hAlive = G.agents.some((a) => a.alive && a.team === 'H');
  if (!kAlive) { endRound(G, 'H', 'KESTREL ELIMINATED'); return; }
  if (!hAlive) { endRound(G, 'K', 'HALCYON ELIMINATED'); return; }
  // Time expiry without a plant favours the defenders.
  if (R.roundTime <= 0 && !R.bomb.planted) { endRound(G, 'H', 'TIME EXPIRED'); }
}
