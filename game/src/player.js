// DUSTLINE agents — one body for the player and the bots: movement with
// acceleration and friction, crouch and jump, axis-separated AABB collision
// against the world's colliders. Bots reuse the same mover.

import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const EYE_STAND = 1.62;
export const EYE_CROUCH = 1.15;
export const RADIUS = 0.35;

let nextId = 1;

export function createAgent(G, { team, isBot, name, x, z, yaw }) {
  const color = team === 'K' ? PALETTE.amber : PALETTE.teal;
  const group = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.95, 0.32), cloth);
  body.position.y = 0.95; group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), dark);
  head.position.y = 1.62; group.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.05),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 }));
  visor.position.set(0, 1.64, 0.16); group.add(visor);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.85), dark);
  gun.position.set(0.25, 1.15, 0.3); group.add(gun);
  group.position.set(x, 0, z);
  group.visible = !isBot || true;
  G.scene.add(group);
  const agent = {
    id: nextId++, name, team, isBot, isPlayer: !isBot,
    pos: new THREE.Vector3(x, 0, z), vel: new THREE.Vector3(), vy: 0,
    yaw, pitch: 0, hp: 100, armor: 0, alive: true,
    crouch: false, onGround: true, height: 1.7,
    weapon: 'pistol', ammo: { mag: 12, reserve: 36 }, reloading: 0,
    money: 800, kills: 0, deaths: 0, hasBomb: false,
    planting: 0, defusing: 0, bloom: 0, lastShot: -999, lastHurt: -999,
    group, bodyMesh: body, headMesh: head,
    ai: isBot ? { state: 'hold', path: [], wp: 0, repath: 0, burst: 0, cooldown: 0, lastKnown: null, holdPos: null, site: null, aimErr: 0, reaction: 0 } : null,
  };
  body.userData = { agent, part: 'body' };
  head.userData = { agent, part: 'head' };
  return agent;
}

function overlaps(G, x, z, y, height) {
  for (const c of G.world.colliders) {
    if (x + RADIUS > c.x0 && x - RADIUS < c.x1 && z + RADIUS > c.z0 && z - RADIUS < c.z1
      && y < c.y1 && y + height > c.y0) return c;
  }
  return null;
}

// Move with a wish direction (world XZ, unit) at speed; gravity and landing.
export function moveAgent(G, a, dt, wishX, wishZ, speed) {
  const accel = a.onGround ? 42 : 14;
  a.vel.x += wishX * accel * dt;
  a.vel.z += wishZ * accel * dt;
  const fr = a.onGround ? Math.max(0, 1 - 9 * dt) : Math.max(0, 1 - 0.4 * dt);
  if (!wishX && !wishZ) { a.vel.x *= fr; a.vel.z *= fr; }
  const sp = Math.hypot(a.vel.x, a.vel.z);
  if (sp > speed) { a.vel.x *= speed / sp; a.vel.z *= speed / sp; }
  // X axis, then Z axis, so a wall slides instead of stopping.
  let nx = a.pos.x + a.vel.x * dt;
  if (!overlaps(G, nx, a.pos.z, a.pos.y, a.height)) a.pos.x = nx; else a.vel.x = 0;
  let nz = a.pos.z + a.vel.z * dt;
  if (!overlaps(G, a.pos.x, nz, a.pos.y, a.height)) a.pos.z = nz; else a.vel.z = 0;
  a.pos.x = Math.max(G.world.bounds.x0 + RADIUS, Math.min(G.world.bounds.x1 - RADIUS, a.pos.x));
  a.pos.z = Math.max(G.world.bounds.z0 + RADIUS, Math.min(G.world.bounds.z1 - RADIUS, a.pos.z));
  // Vertical: gravity, ground, and landing on low tops.
  a.vy -= 18 * dt;
  const ny = a.pos.y + a.vy * dt;
  if (ny <= 0) { a.pos.y = 0; a.vy = 0; a.onGround = true; }
  else if (a.vy <= 0) {
    const c = overlaps(G, a.pos.x, a.pos.z, ny, a.height);
    if (c && a.pos.y >= c.y1 - 0.05) { a.pos.y = c.y1; a.vy = 0; a.onGround = true; }
    else { a.pos.y = ny; a.onGround = false; }
  } else { a.pos.y = ny; a.onGround = false; }
  a.height = a.crouch ? 1.25 : 1.7;
  a.group.position.copy(a.pos);
  a.group.rotation.y = a.yaw;
  a.group.visible = a.alive;
}

export function eyePos(a) {
  return new THREE.Vector3(a.pos.x, a.pos.y + (a.crouch ? EYE_CROUCH : EYE_STAND), a.pos.z);
}

// Player step: keyboard wish direction, jump, crouch.
export function stepPlayer(G, dt) {
  const p = G.player;
  if (!p.alive) return;
  const k = G.input.keys;
  let fx = 0, fz = 0;
  if (k['KeyW']) fz -= 1; if (k['KeyS']) fz += 1;
  if (k['KeyA']) fx -= 1; if (k['KeyD']) fx += 1;
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const wx = fx * cos - fz * sin, wz = fx * sin + fz * cos;
  const len = Math.hypot(wx, wz) || 1;
  p.crouch = !!(k['ControlLeft'] || k['KeyC']);
  if ((k['Space']) && p.onGround) { p.vy = 6.4; p.onGround = false; }
  let speed = 5.2;
  if (k['ShiftLeft'] || k['ShiftRight']) speed = 2.6;
  if (p.crouch) speed = 2.3;
  if (!p.onGround) speed = 4.6;
  moveAgent(G, p, dt, wx / len * (fx || fz ? 1 : 0), wz / len * (fx || fz ? 1 : 0), speed);
  p.bloom = Math.max(0, p.bloom - dt * 2.2);
}
