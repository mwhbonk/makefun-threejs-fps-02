// DUSTLINE weapons — four guns plus the HE grenade. Hitscan raycast with
// head/body split, spread that grows with movement and bloom, recoil that
// kicks the view, and a buy price on each. Accuracy beats speed: firing on
// the move or holding the trigger open is punished by design.

import * as THREE from 'three';
import { spawnTracer, spawnMuzzle, spawnImpact, spawnExplosion, spawnSmoke } from './effects.js';
import { sfx } from './audio.js';

export const WEAPONS = {
  pistol: { name: 'P9 SIDEARM', price: 0, dmg: 28, headMul: 4, mag: 12, reserve: 36, rate: 280, reloadMs: 1100, spread: 0.012, kick: 0.006, auto: false, range: 60 },
  smg: { name: 'HORNET SMG', price: 1500, dmg: 26, headMul: 4, mag: 30, reserve: 120, rate: 95, reloadMs: 1600, spread: 0.02, kick: 0.005, auto: true, range: 45 },
  rifle: { name: 'VKR-7 RIFLE', price: 2700, dmg: 34, headMul: 4, mag: 30, reserve: 90, rate: 130, reloadMs: 2000, spread: 0.014, kick: 0.011, auto: true, range: 80 },
  sniper: { name: 'LONGBOW DMR', price: 4750, dmg: 110, headMul: 2, mag: 5, reserve: 15, rate: 1100, reloadMs: 2800, spread: 0.004, kick: 0.03, auto: false, range: 120 },
};
export const GRENADE_PRICE = 300;
export const KEVLAR_PRICE = 650;
export const SMOKE_PRICE = 300;
export const HELMET_PRICE = 350;

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
  target.spottedT = G.time; // damage marks the victim on the minimap
  if (target.isPlayer) G.hurtFlash = 1;
  if (target.hp <= 0) {
    target.hp = 0; target.alive = false; target.group.visible = false;
    target.deaths++;
    if (attacker) {
      attacker.kills++;
      attacker.money += 300; // kill reward
      if (attacker.isPlayer) G.hudKill = { victim: target.name, head: isHead };
    }
    if (G.addKillfeed) G.addKillfeed(attacker, target, isHead, attacker ? attacker.weapon : null);
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
  // Bots hear the shot: a recent shot within 25 m pulls them to investigate.
  G.lastShotPos = origin.clone();
  G.lastShotT = G.time;
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
      // A helmet caps headshot damage at x2 — it never makes a headshot free.
      const mul = isHead ? (t.helmet ? Math.min(w.headMul, 2) : w.headMul) : 1;
      damageAgent(G, t, w.dmg * mul, a, isHead);
      if (a.isPlayer) { G.hitmark = isHead ? 'head' : 'body'; G.hitmarkT = G.time; sfx.hit(isHead); }
    } else {
      spawnImpact(G, h.point, h.face ? h.face.normal : null);
    }
  }
  spawnTracer(G, origin, end, a.team === 'H' ? 0xff5a4a : 0xffd27a); // incoming fire reads red
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
  // Smoke grenades in flight — same arc, then a 15 s sight-blocking cloud.
  G.smokes = G.smokes || [];
  for (let i = G.smokes.length - 1; i >= 0; i--) {
    const g = G.smokes[i];
    g.vel.y -= 14 * dt;
    g.pos.addScaledVector(g.vel, dt);
    if (g.pos.y < 0.12) { g.pos.y = 0.12; g.vel.y *= -0.45; g.vel.x *= 0.7; g.vel.z *= 0.7; }
    g.t -= dt;
    if (g.t <= 0) {
      spawnSmoke(G, g.pos);
      sfx.explosion();
      G.smokes.splice(i, 1);
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

// Smoke grenade: no damage, a 15 s cloud that blocks sight lines.
export function throwSmokeGrenade(G, a) {
  if (!a.alive || (a.smokes || 0) <= 0) return false;
  a.smokes--;
  const dir = aimDir(a);
  G.smokes = G.smokes || [];
  G.smokes.push({
    pos: new THREE.Vector3(a.pos.x, a.pos.y + 1.5, a.pos.z),
    vel: dir.multiplyScalar(11).add(new THREE.Vector3(0, 4, 0)),
    t: 1.4, from: a,
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

// First-person viewmodel: a chunky low-poly gun with a gloved hand, a
// handguard and a barrel — it reads as a weapon, not a black bar.
export function createViewmodel(G) {
  const grp = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.6, metalness: 0.4 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.5, metalness: 0.3 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x3d4a35, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.55), dark);
  grp.add(body);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.28), dark);
  handguard.position.set(0, -0.01, -0.3); grp.add(handguard);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), dark);
  barrel.position.set(0, 0.01, -0.5); grp.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.04), accent);
  sight.position.set(0, 0.09, -0.42); grp.add(sight);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.1), dark);
  grip.position.set(0, -0.13, 0.16); grp.add(grip);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.13), glove);
  hand.position.set(0, -0.1, 0.05); grp.add(hand);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.1), dark);
  mag.position.set(0, -0.13, -0.05); grp.add(mag);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.025, 0.32), accent);
  stripe.position.set(0, 0.05, -0.04); grp.add(stripe);
  // Muzzle flash: a radial star texture, not a white card.
  const fc = document.createElement('canvas');
  fc.width = 64; fc.height = 64;
  const fg = fc.getContext('2d');
  const grad = fg.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,230,1)');
  grad.addColorStop(0.4, 'rgba(255,210,122,0.9)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  fg.fillStyle = grad; fg.fillRect(0, 0, 64, 64);
  fg.fillStyle = 'rgba(255,230,160,0.9)';
  fg.fillRect(30, 2, 4, 60); fg.fillRect(2, 30, 60, 4);
  const flashTex = new THREE.CanvasTexture(fc);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22),
    new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.set(0, 0.02, -0.62); grp.add(flash);
  grp.scale.setScalar(0.8);
  grp.position.set(0.3, -0.3, -0.55);
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
  G.viewmodel.position.y = -0.3 + Math.sin(t * 2) * bob;
  G.viewmodel.position.x = 0.3 + Math.cos(t) * bob * 0.6;
  const kick = G.viewKick || 0;
  G.viewmodel.position.z = -0.55 + kick * 0.09;
  G.viewKick = Math.max(0, kick - dt * 6);
  if (G.viewFlash) G.viewFlash.material.opacity = Math.max(0, (G.viewFlash.material.opacity || 0) - dt * 14);
}
