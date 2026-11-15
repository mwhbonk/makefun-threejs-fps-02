// DUSTLINE effects — pooled, zero per-frame allocation in the hot loops:
// tracers (one stretched box per shot), muzzle flash, impact sparks and the
// grenade explosion. Everything fades on its own clock in updateEffects.

import * as THREE from 'three';

const POOL = { tracers: [], sparks: [] };
let boom = null;
let boomLight = null;

export function initEffects(G) {
  const tracerGeo = new THREE.BoxGeometry(0.025, 0.025, 1);
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({
      color: 0xffd27a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.visible = false;
    G.scene.add(m);
    POOL.tracers.push({ mesh: m, life: 0 });
  }
  const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0 }));
    m.visible = false;
    G.scene.add(m);
    POOL.sparks.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
  }
  boom = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  boom.visible = false;
  G.scene.add(boom);
  boomLight = new THREE.PointLight(0xff8a3a, 0, 18);
  G.scene.add(boomLight);
}

function freeTracer() {
  return POOL.tracers.find((t) => t.life <= 0) || POOL.tracers[0];
}

export function spawnTracer(G, from, to) {
  const t = freeTracer();
  const len = from.distanceTo(to);
  if (len < 0.5) return;
  t.mesh.position.copy(from).add(to).multiplyScalar(0.5);
  t.mesh.lookAt(to);
  t.mesh.scale.set(1, 1, len);
  t.mesh.material.opacity = 0.85;
  t.mesh.visible = true;
  t.life = 0.07;
}

export function spawnMuzzle(G, a) {
  if (a.isPlayer && G.viewFlash) G.viewFlash.material.opacity = 0.95;
}

export function spawnImpact(G, point, normal) {
  let n = 0;
  for (const s of POOL.sparks) {
    if (s.life > 0) continue;
    s.mesh.position.copy(point);
    s.vel.set((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3);
    if (normal) s.vel.addScaledVector(normal, 2);
    s.mesh.material.opacity = 1;
    s.mesh.visible = true;
    s.life = 0.28;
    if (++n >= 5) break;
  }
}

export function spawnExplosion(G, pos) {
  boom.position.copy(pos);
  boom.scale.setScalar(0.5);
  boom.material.opacity = 0.9;
  boom.visible = true;
  boom.userData.life = 0.55;
  boomLight.position.copy(pos);
  boomLight.position.y += 1;
  boomLight.intensity = 60;
}

export function updateEffects(G, dt) {
  for (const t of POOL.tracers) {
    if (t.life <= 0) continue;
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.life / 0.07) * 0.85;
    if (t.life <= 0) t.mesh.visible = false;
  }
  for (const s of POOL.sparks) {
    if (s.life <= 0) continue;
    s.life -= dt;
    s.vel.y -= 9 * dt;
    s.mesh.position.addScaledVector(s.vel, dt);
    s.mesh.material.opacity = Math.max(0, s.life / 0.28);
    if (s.life <= 0) s.mesh.visible = false;
  }
  if (boom && boom.visible) {
    boom.userData.life -= dt;
    const k = 1 - boom.userData.life / 0.55;
    boom.scale.setScalar(0.5 + k * 6);
    boom.material.opacity = Math.max(0, 0.9 * (1 - k));
    boomLight.intensity = Math.max(0, 60 * (1 - k));
    if (boom.userData.life <= 0) { boom.visible = false; boomLight.intensity = 0; }
  }
}
