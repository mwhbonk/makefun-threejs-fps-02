// DUSTLINE bots — a state machine on the waypoint graph: hold the sites,
// push the lanes in pairs, investigate gunfire, engage on line of sight,
// plant the Spike, converge to defuse. Aim error grows with distance and
// target speed, and every bot waits a human reaction beat before firing,
// so fights read as tactical instead of aimbot duels.

import * as THREE from 'three';
import { moveAgent, eyePos } from './player.js';
import { findPath, nearestWaypoint, zoneAt } from './world.js';
import { fire, aimDir } from './weapons.js';

const _rc = new THREE.Raycaster();

export function hasLOS(G, from, to) {
  const a = eyePos(from);
  const b = new THREE.Vector3(to.pos.x, to.pos.y + 1.2, to.pos.z);
  const d = b.clone().sub(a);
  const dist = d.length();
  if (dist > 48) return false;
  _rc.set(a, d.normalize());
  const hits = _rc.intersectObjects(G.world.solids, false);
  return !hits.length || hits[0].distance > dist - 0.4;
}

function nearestEnemy(G, bot) {
  let best = null, bd = 1e9;
  for (const o of G.agents) {
    if (!o.alive || o.team === bot.team) continue;
    const d = bot.pos.distanceTo(o.pos);
    if (d < bd) { bd = d; best = o; }
  }
  return best ? { enemy: best, dist: bd } : null;
}

function setPath(G, bot, tx, tz) {
  const from = nearestWaypoint(G.world, bot.pos.x, bot.pos.z);
  const to = nearestWaypoint(G.world, tx, tz);
  bot.ai.path = findPath(G.world, from, to);
  bot.ai.wp = 0;
}

function followPath(G, bot, dt, speed) {
  if (!bot.ai.path.length) return true;
  const w = G.world.waypoints[bot.ai.path[bot.ai.wp]];
  const dx = w.x - bot.pos.x, dz = w.z - bot.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.7) {
    bot.ai.wp++;
    if (bot.ai.wp >= bot.ai.path.length) { bot.ai.path = []; return true; }
    return false;
  }
  const wishX = dx / d, wishZ = dz / d;
  moveAgent(G, bot, dt, wishX, wishZ, speed);
  bot.yaw = Math.atan2(-wishX, -wishZ);
  return false;
}

function aimAt(G, bot, target, dt) {
  const dx = target.pos.x - bot.pos.x;
  const dz = target.pos.z - bot.pos.z;
  const dy = (target.pos.y + 1.3) - (bot.pos.y + 1.5);
  const dist = Math.hypot(dx, dz);
  const wantYaw = Math.atan2(-dx, -dz);
  const wantPitch = Math.atan2(dy, dist);
  let dyaw = wantYaw - bot.yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  const turn = 7 * dt;
  bot.yaw += Math.max(-turn, Math.min(turn, dyaw));
  bot.pitch += Math.max(-turn, Math.min(turn, wantPitch - bot.pitch));
  // Aim error: grows with distance and target speed, shrinks when still.
  const tSpeed = Math.hypot(target.vel.x, target.vel.z);
  bot.ai.aimErr = 0.02 + dist * 0.0011 + tSpeed * 0.006 + (bot.crouch ? -0.008 : 0);
}

export function stepBot(G, bot, dt) {
  if (!bot.alive) return;
  const ai = bot.ai;
  ai.cooldown -= dt;
  ai.repath -= dt;
  const seen = nearestEnemy(G, bot);
  const visible = seen && hasLOS(G, bot, seen.enemy) ? seen : null;
  const R = G.rounds;

  // Hearing: a recent shot nearby pulls bots to investigate.
  if (!visible && G.lastShotPos && G.time - G.lastShotT < 1.2) {
    const d = bot.pos.distanceTo(G.lastShotPos);
    if (d < 25 && ai.state !== 'engage') { ai.lastKnown = G.lastShotPos.clone(); if (ai.state === 'hold') ai.state = 'investigate'; }
  }
  // Grenade nearby: step away.
  for (const g of G.grenades) {
    if (g.pos.distanceTo(bot.pos) < 6 && ai.state !== 'flee') { ai.state = 'flee'; ai.fleeT = 1; }
  }

  if (visible) {
    visible.enemy.spottedT = G.time; // seen enemies show on the minimap + tags
    if (ai.state !== 'engage') {
      ai.state = 'engage'; ai.reaction = 0.25 + Math.random() * 0.3; ai.burst = 0;
      if (G.say && Math.random() < 0.6) G.say(bot, `contact at ${zoneAt(G.world, visible.enemy.pos.x, visible.enemy.pos.z)}`);
    }
    ai.lastKnown = visible.enemy.pos.clone();
  } else if (ai.state === 'engage') {
    ai.state = ai.lastKnown ? 'hunt' : (bot.team === 'H' ? 'hold' : 'push');
  }

  switch (ai.state) {
    case 'engage': {
      if (!visible) break;
      aimAt(G, bot, visible.enemy, dt);
      ai.reaction -= dt;
      // Strafe slowly while fighting; never stand still in the open.
      const strafe = Math.sin(G.time * 1.7 + bot.id * 2.1) * 0.7;
      const fx = -Math.sin(bot.yaw), fz = -Math.cos(bot.yaw);
      moveAgent(G, bot, dt, -fz * strafe * 0.4, fx * strafe * 0.4, 1.6);
      if (ai.reaction <= 0 && ai.cooldown <= 0) {
        if (ai.burst <= 0) ai.burst = 3 + Math.floor(Math.random() * 3);
        const err = ai.aimErr;
        const dir = aimDir(bot);
        dir.x += (Math.random() - 0.5) * err * 2;
        dir.y += (Math.random() - 0.5) * err * 2;
        dir.z += (Math.random() - 0.5) * err * 2;
        dir.normalize();
        if (fire(G, bot, dir)) {
          ai.burst--;
          if (ai.burst <= 0) ai.cooldown = 0.6 + Math.random() * 0.5;
        }
      }
      break;
    }
    case 'hold': {
      if (!ai.holdPos) break;
      const dx = ai.holdPos.x - bot.pos.x, dz = ai.holdPos.z - bot.pos.z;
      if (Math.hypot(dx, dz) > 0.8) followPath(G, bot, dt, 3.4);
      else bot.yaw += Math.sin(G.time * 0.4 + bot.id) * 0.002; // scan
      break;
    }
    case 'investigate':
    case 'hunt': {
      if (!ai.lastKnown) { ai.state = bot.team === 'H' ? 'hold' : 'push'; break; }
      if (!ai.path.length && ai.repath <= 0) { setPath(G, bot, ai.lastKnown.x, ai.lastKnown.z); ai.repath = 2; }
      if (followPath(G, bot, dt, 4.2)) { ai.lastKnown = null; ai.state = bot.team === 'H' ? 'hold' : 'push'; }
      break;
    }
    case 'flee': {
      ai.fleeT -= dt;
      const g = G.grenades[0];
      if (g) {
        const dx = bot.pos.x - g.pos.x, dz = bot.pos.z - g.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        moveAgent(G, bot, dt, dx / d, dz / d, 5);
        bot.yaw = Math.atan2(-dx, -dz);
      }
      if (ai.fleeT <= 0) ai.state = bot.team === 'H' ? 'hold' : 'push';
      break;
    }
    case 'push': {
      if (bot.team === 'K' && bot.hasBomb) { ai.state = 'plant'; break; }
      if (!ai.path.length && ai.repath <= 0) {
        const site = ai.site ? G.world.sites[ai.site] : G.world.sites.A;
        setPath(G, bot, site.center.x, site.center.z);
        ai.repath = 2;
      }
      followPath(G, bot, dt, 4.2);
      break;
    }
    case 'plant': {
      const site = G.world.sites[ai.site || 'A'];
      const d = Math.hypot(bot.pos.x - site.center.x, bot.pos.z - site.center.z);
      if (d > site.r - 0.5) {
        if (!ai.path.length && ai.repath <= 0) { setPath(G, bot, site.center.x, site.center.z); ai.repath = 2; }
        followPath(G, bot, dt, 4.2);
      } else if (!visible) {
        bot.planting += dt;
        if (bot.planting >= 3.5) {
          bot.planting = 0; bot.hasBomb = false;
          R.bomb.planted = true; R.bomb.site = ai.site || 'A';
          R.bomb.pos.set(site.center.x, 0.1, site.center.z);
          R.bomb.timer = 35;
          if (G.say) G.say(bot, `spike planted at site ${ai.site || 'A'}`);
          if (G.showBanner) G.showBanner('SPIKE PLANTED', 'Halcyon must defuse', 3);
        }
      }
      break;
    }
    case 'fetch': {
      const b = R.bomb;
      if (!b.dropped) { ai.state = 'plant'; break; }
      const d = Math.hypot(bot.pos.x - b.pos.x, bot.pos.z - b.pos.z);
      if (d < 1.2) {
        b.dropped = false; bot.hasBomb = true; ai.state = 'plant';
      } else {
        if (!ai.path.length && ai.repath <= 0) { setPath(G, bot, b.pos.x, b.pos.z); ai.repath = 2; }
        followPath(G, bot, dt, 4.4);
      }
      break;
    }
    case 'defuse': {
      const b = R.bomb;
      const d = Math.hypot(bot.pos.x - b.pos.x, bot.pos.z - b.pos.z);
      if (d > 1.5) {
        if (!ai.path.length && ai.repath <= 0) { setPath(G, bot, b.pos.x, b.pos.z); ai.repath = 2; }
        followPath(G, bot, dt, 4.4);
      } else if (!visible) {
        bot.defusing += dt;
        if (bot.defusing >= 5) { bot.defusing = 0; R.endRound('H', 'SPIKE DEFUSED'); }
      }
      break;
    }
    default: break;
  }

  // Bomb planted: defenders converge to defuse, attackers hold the site.
  if (R.bomb.planted && bot.team === 'H' && ai.state !== 'engage' && ai.state !== 'defuse') ai.state = 'defuse';
  if (R.bomb.planted && bot.team === 'K' && ai.state === 'push') ai.state = 'hold';
  // Bomb dropped: nearest Kestrel bot fetches it.
  if (R.bomb.dropped && R.bomb.pos && bot.team === 'K' && !bot.hasBomb && ai.state !== 'engage') {
    let nearest = true;
    for (const o of G.agents) if (o.isBot && o.alive && o.team === 'K' && o !== bot && o.pos.distanceTo(R.bomb.pos) < bot.pos.distanceTo(R.bomb.pos)) nearest = false;
    if (nearest) ai.state = 'fetch';
  }
  bot.bloom = Math.max(0, bot.bloom - dt * 2.2);
}

export function stepBots(G, dt) {
  for (const a of G.agents) if (a.isBot) stepBot(G, a, dt);
}

// Assign each bot its job for the round: sites, hold spots, carrier.
export function assignBotRoles(G) {
  const kBots = G.agents.filter((a) => a.isBot && a.team === 'K');
  const hBots = G.agents.filter((a) => a.isBot && a.team === 'H');
  kBots.forEach((b, i) => {
    b.ai.site = i % 2 === 0 ? 'A' : 'B';
    b.ai.state = 'push';
    b.ai.holdPos = null;
  });
  const holds = [
    { x: -13, z: -6 }, { x: -9, z: -11 }, { x: 13, z: -6 }, { x: 9, z: -11 }, { x: 0, z: -8 },
  ];
  hBots.forEach((b, i) => {
    b.ai.site = i < 2 ? 'A' : 'B';
    b.ai.holdPos = holds[i % holds.length];
    b.ai.state = 'hold';
  });
}
