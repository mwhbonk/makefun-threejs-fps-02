// DUSTLINE weapons — four guns plus the HE grenade. Hitscan raycast with
// head/body split, spread that grows with movement and bloom, recoil that
// kicks the view, and a buy price on each. Accuracy beats speed: firing on
// the move or holding the trigger open is punished by design.

import * as THREE from 'three';
import { spawnTracer, spawnMuzzle, spawnImpact, spawnExplosion } from './effects.js';
import { sfx } from './audio.js';

export const WEAPONS = {
  pistol: { name: 'P9 SIDEARM', price: 0, dmg: 28, headMul: 4, mag: 12, reserve: 36, rate: 280, reloadMs: 1100, spread: 0.012, kick: 0.006, auto: false, range: 60 },
  smg: { name: 'HORNET SMG', price: 1500, dmg: 26, headMul: 4, mag: 30, reserve: 120, rate: 95, reloadMs: 1600, spread: 0.02, kick: 0.005, auto: true, range: 45 },
  rifle: { name: 'VKR-7 RIFLE', price: 2700, dmg: 34, headMul: 4, mag: 30, reserve: 90, rate: 130, reloadMs: 2000, spread: 0.014, kick: 0.011, auto: true, range: 80 },
  sniper: { name: 'LONGBOW DMR', price: 4750, dmg: 110, headMul: 2, mag: 5, reserve: 15, rate: 1100, reloadMs: 2800, spread: 0.004, kick: 0.03, auto: false, range: 120 },
};
export const GRENADE_PRICE = 300;
export const KEVLAR_PRICE = 650;

export function giveWeapon(G, a, id) {
  const w = WEAPONS[id];
  // Stash the current gun's ammo before switching, so the wheel cannot
  // refill a magazine by swapping weapons back and forth.
  if (a.weapon) { a.stash = a.stash || {}; a.stash[a.weapon] = a.ammo; }
  a.weapon = id;
  a.ammo = (a.stash && a.stash[id]) ? a.stash[id] : { mag: w.mag, reserve: w.reserve };
  a.reloading = 0;
  a.owned = a.owned || [];
  if (!a.owned.includes(id)) a.owned.push(id);
}

export function aimDir(a) {
  const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
  return new THREE.Vector3(-Math.sin(a.yaw) * cp, sp, -Math.cos(a.yaw) * cp);
}

function spreadDir(dir, spread) {
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
  const rx = (Math.random() + Math.random() + Math.random() - 1.5) * spread;
  const ry = (Math.random() + Math.random() + Math.random() - 1.5) * spread;
  return dir.clone().addScaledVector(right, rx).addScaledVector(up2, ry).normalize();
}

export function damageAgent(G, target, dmg, attacker, isHead) {
  if (!target.alive) return;
  if (target.isPlayer && G.shotMode) return; // screenshot setups never kill the player
  if (target.armor > 0) { dmg *= 0.75; target.armor = Math.max(0, target.armor - dmg * 0.5); }
  target.hp -= dmg;
  target.lastHurt = G.time;
  if (target.isPlayer) G.hurtFlash = 1;
  if (target.hp <= 0) {
    target.hp = 0; target.alive = false; target.group.visible = false;
    target.deaths++;
    if (attacker) {
      attacker.kills++;
      attacker.money += 300; // kill reward
      if (attacker.isPlayer) G.hudKill = { victim: target.name, head: isHead };
    }
    if (G.addKillfeed) G.addKillfeed(attacker, target, isHead);
    if (target.hasBomb) dropBomb(G, target);
  }
}

export function dropBomb(G, carrier) {
  carrier.hasBomb = false;
  G.rounds.bomb.dropped = true;
  if (!G.rounds.bomb.pos) G.rounds.bomb.pos = new THREE.Vector3();
  G.rounds.bomb.pos.set(carrier.pos.x, 0.1, carrier.pos.z);
  G.rounds.bomb.carrier = null;
  if (G.showBanner) G.showBanner('SPIKE DROPPED', '', 2);
}

export function fire(G, a, dirOverride) {
  const w = WEAPONS[a.weapon];
  const now = G.time * 1000;
  if (!a.alive || a.reloading > 0) return false;
  if (now - a.lastShot < w.rate) return false;
  if (a.ammo.mag <= 0) { sfx.dry(); a.lastShot = now - w.rate + 300; return false; }
  a.lastShot = now;
  a.ammo.mag--;
  // Spread: base + speed + airborne + bloom. Standing still is accurate.
  const speed = Math.hypot(a.vel.x, a.vel.z);
  const spread = w.spread + speed * 0.004 + (a.onGround ? 0 : 0.02) + a.bloom * 0.03 + (a.crouch ? -0.004 : 0);
  const origin = new THREE.Vector3(a.pos.x, a.pos.y + (a.crouch ? 1.15 : 1.62), a.pos.z);
  const dir = spreadDir(dirOverride ? dirOverride.clone() : aimDir(a), Math.max(0.002, spread));
  const rc = new THREE.Raycaster(origin, dir, 0.1, w.range);
  const targets = [];
  for (const o of G.agents) if (o.alive && o !== a) targets.push(o.bodyMesh, o.headMesh);
  const hits = rc.intersectObjects([...G.world.solids, ...targets], false);
  let end = origin.clone().addScaledVector(dir, w.range);
  if (hits.length) {
    const h = hits[0];
    end = h.point.clone();
    if (h.object.userData.agent) {
      const t = h.object.userData.agent;
      const isHead = h.object.userData.part === 'head';
      damageAgent(G, t, w.dmg * (isHead ? w.headMul : 1), a, isHead);
      if (a.isPlayer) { G.hitmark = isHead ? 'head' : 'body'; G.hitmarkT = G.time; sfx.hit(isHead); }
    } else {
      spawnImpact(G, h.point, h.face ? h.face.normal : null);
    }
  }
  spawnTracer(G, origin, end);
  spawnMuzzle(G, a);
  sfx.shot(a.weapon);
  a.bloom = Math.min(1, a.bloom + (a.weapon === 'sniper' ? 0.5 : 0.12));
  if (a.isPlayer) {
    a.pitch += w.kick;
    a.yaw += (Math.random() - 0.5) * w.kick * 0.6;
    G.viewKick = 1;
  }
  return true;
}

export function reloadWeapon(G, a) {
  const w = WEAPONS[a.weapon];
  if (a.reloading > 0 || a.ammo.mag === w.mag || a.ammo.reserve <= 0) return;
  a.reloading = w.reloadMs / 1000;
  sfx.reload();
}

export function updateWeapons(G, dt) {
  for (const a of G.agents) {
    if (!a.alive) continue;
    if (a.reloading > 0) {
      a.reloading -= dt;
      if (a.reloading <= 0) {
        const w = WEAPONS[a.weapon];
        const need = w.mag - a.ammo.mag;
        const take = Math.min(need, a.ammo.reserve);
        a.ammo.mag += take; a.ammo.reserve -= take;
        a.reloading = 0;
      }
    }
  }
  // Grenades in flight.
  for (let i = G.grenades.length - 1; i >= 0; i--) {
    const g = G.grenades[i];
    g.vel.y -= 14 * dt;
    g.pos.addScaledVector(g.vel, dt);
    if (g.pos.y < 0.12) { g.pos.y = 0.12; g.vel.y *= -0.45; g.vel.x *= 0.7; g.vel.z *= 0.7; }
    g.t -= dt;
    if (g.t <= 0) {
      explodeGrenade(G, g);
      G.grenades.splice(i, 1);
    }
  }
}

export function throwGrenade(G, a) {
  if (!a.alive || a.grenades <= 0) return false;
  a.grenades--;
  const dir = aimDir(a);
  G.grenades.push({
    pos: new THREE.Vector3(a.pos.x, a.pos.y + 1.5, a.pos.z),
    vel: dir.multiplyScalar(13).add(new THREE.Vector3(0, 4.5, 0)),
    t: 1.6, from: a,
  });
  sfx.throwIt();
  return true;
}

function explodeGrenade(G, g) {
  spawnExplosion(G, g.pos);
  sfx.explosion();
  for (const o of G.agents) {
    if (!o.alive || o === g.from) continue;
    const d = o.pos.distanceTo(g.pos);
    if (d < 7) damageAgent(G, o, Math.round(120 - (100 * d) / 7), g.from, false);
  }
}

// First-person viewmodel: a low-poly gun that bobs and kicks.
export function createViewmodel(G) {
  const grp = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.6, metalness: 0.4 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.5), dark);
  grp.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.09), dark);
  grip.position.set(0, -0.12, 0.15); grp.add(grip);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.32), accent);
  stripe.position.set(0, 0.04, -0.04); grp.add(stripe);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  flash.position.set(0, 0.02, -0.34); grp.add(flash);
  grp.scale.setScalar(0.65);
  grp.position.set(0.26, -0.27, -0.5);
  G.camera.add(grp);
  G.viewmodel = grp; G.viewFlash = flash;
  return grp;
}

export function updateViewmodel(G, dt) {
  if (!G.viewmodel) return;
  const p = G.player;
  const speed = Math.hypot(p.vel.x, p.vel.z);
  const t = G.time * 9;
  const bob = p.onGround ? Math.min(1, speed / 5) * 0.012 : 0;
  G.viewmodel.position.y = -0.26 + Math.sin(t * 2) * bob;
  G.viewmodel.position.x = 0.28 + Math.cos(t) * bob * 0.6;
  const kick = G.viewKick || 0;
  G.viewmodel.position.z = -0.5 + kick * 0.09;
  G.viewKick = Math.max(0, kick - dt * 6);
  if (G.viewFlash) G.viewFlash.material.opacity = Math.max(0, (G.viewFlash.material.opacity || 0) - dt * 14);
}
