// DUSTLINE map — "Kestrel Yard", an original dusk freight depot, 36 x 28 m.
// A site (Crane Yard) west, B site (Tank Farm) east, Mid a container lane.
// Lanes, corners and sightlines are deliberate: long mid sightline, tight
// A/B entries, cover crates so no lane is a shooting gallery.

import * as THREE from 'three';
import { PALETTE } from './palette.js';

const BOUNDS = { x0: -18, x1: 18, z0: -14, z1: 14 };

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9a86a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? 'rgba(138,111,69,0.25)' : 'rgba(230,205,150,0.22)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  for (let i = 0; i < 14; i++) { // faint darker patches
    g.fillStyle = 'rgba(90,70,45,0.10)';
    g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 26, 8 + Math.random() * 18, Math.random() * 3, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 5);
  return t;
}

function textSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
  g.fillStyle = '#10151c'; g.font = 'bold 72px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
  return m;
}

export function buildWorld(scene) {
  const colliders = [];   // {x0,z0,x1,z1,y0,y1, mesh}
  const solids = [];      // meshes the hitscan raycaster tests (world only)
  const mat = (color, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });

  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, 22, 78);
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x5a4632, 0.95));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(24, 30, 14); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x404860, 0.5));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(36, 28),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  function box(cx, cz, w, d, h, color, y0 = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(cx, y0 + h / 2, cz); scene.add(m); solids.push(m);
    colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y0, y1: y0 + h, mesh: m });
    return m;
  }
  function cylinder(cx, cz, r, h, color) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), mat(color, 0.55));
    m.position.set(cx, h / 2, cz); scene.add(m); solids.push(m);
    colliders.push({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r, y0: 0, y1: h, mesh: m });
    return m;
  }

  // Perimeter walls.
  box(0, -14.3, 37.2, 0.6, 3.4, PALETTE.wall);
  box(0, 14.3, 37.2, 0.6, 3.4, PALETTE.wall);
  box(-18.3, 0, 0.6, 29.2, 3.4, PALETTE.wall);
  box(18.3, 0, 0.6, 29.2, 3.4, PALETTE.wall);

  // Mid containers — the lane's cover.
  box(-3, 6, 4.5, 2.4, 2.6, PALETTE.containerA);
  box(3, 0, 4.5, 2.4, 2.6, PALETTE.containerB);
  box(-2, -6, 2.4, 5, 2.6, PALETTE.containerB);
  box(5, -9, 4.5, 2.4, 2.6, PALETTE.containerA);
  // Crates, some stacked.
  box(-8, 6, 1.2, 1.2, 1.2, PALETTE.crate);
  box(-8, 4.6, 1.2, 1.2, 1.2, PALETTE.crate);
  box(-8, 6, 1.2, 1.2, 1.2, PALETTE.crate, 1.2);
  box(8, -4, 1.2, 1.2, 1.2, PALETTE.crate);
  box(8, 4, 1.2, 1.2, 1.2, PALETTE.crate);
  box(-12, -2, 1.2, 1.2, 1.2, PALETTE.crate);
  box(12, 6, 1.2, 1.2, 1.2, PALETTE.crate);
  box(0, 10, 1.2, 1.2, 1.2, PALETTE.crate);
  box(-6, 11, 1.2, 1.2, 1.2, PALETTE.crate);
  box(6, 11, 1.2, 1.2, 1.2, PALETTE.crate);
  // Low walls — cover you can shoot over only from height, not through.
  box(-6, -2, 0.5, 4, 1.1, PALETTE.wall);
  box(6, 2, 0.5, 4, 1.1, PALETTE.wall);
  box(0, -11.5, 6, 0.5, 1.1, PALETTE.wall);
  // B site tanks.
  cylinder(13, -11.5, 1.3, 2.8, PALETTE.tank);
  cylinder(15.5, -7, 1.0, 2.2, PALETTE.tank);
  // A site crane — legs collide, beam is high cover art.
  for (const [lx, lz] of [[-15, -11], [-11, -11], [-15, -7], [-11, -7]]) box(lx, lz, 0.45, 0.45, 6, PALETTE.rust);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.7, 1), mat(PALETTE.rust));
  beam.position.set(-13, 6.1, -9); scene.add(beam);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), mat(0x222222));
  hook.position.set(-10, 5.2, -9); scene.add(hook);

  // Sites: emissive ground ring + floating letter.
  const sites = {
    A: { center: new THREE.Vector3(-13, 0, -9), r: 4 },
    B: { center: new THREE.Vector3(13, 0, -9), r: 4 },
  };
  for (const [name, s] of Object.entries(sites)) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.25, s.r, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.rust, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.center.x, 0.03, s.center.z); scene.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(s.r - 0.3, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.rust, transparent: true, opacity: 0.08, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(s.center.x, 0.02, s.center.z); scene.add(disc);
    const letter = textSprite(name, '#f5a623');
    letter.position.set(s.center.x, 3.4, s.center.z); scene.add(letter);
  }

  // Waypoints: A lane, B lane, Mid, connectors. Links auto-built below.
  const waypoints = [
    [-15, 10], [-15, 2], [-15, -6], [-11, -10],
    [15, 10], [15, 2], [15, -6], [11, -10],
    [0, 11], [0, 5], [0, -1], [0, -7], [-5, 5], [5, 5], [-5, -5], [5, -5],
    [-8, 9], [8, 9], [-8, -10], [8, -10],
  ].map(([x, z]) => ({ x, z, links: [] }));

  function segClear(ax, az, bx, bz) {
    for (const c of colliders) {
      if (c.y1 < 0.5) continue;
      const m = 0.45; // keep paths off the walls
      const x0 = c.x0 - m, x1 = c.x1 + m, z0 = c.z0 - m, z1 = c.z1 + m;
      // Slab test for segment vs expanded AABB.
      const dx = bx - ax, dz = bz - az;
      let t0 = 0, t1 = 1, ok = true;
      for (const [p, d, lo, hi] of [[ax, dx, x0, x1], [az, dz, z0, z1]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { ok = false; break; } }
        else {
          let a = (lo - p) / d, b = (hi - p) / d;
          if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a); t1 = Math.min(t1, b);
          if (t0 > t1) { ok = false; break; }
        }
      }
      if (ok) return false;
    }
    return true;
  }
  for (let i = 0; i < waypoints.length; i++) {
    for (let j = i + 1; j < waypoints.length; j++) {
      const a = waypoints[i], b = waypoints[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 9.5 && segClear(a.x, a.z, b.x, b.z)) { a.links.push(j); b.links.push(i); }
    }
  }

  const spawns = {
    K: [[-8, 11.5], [-4, 12], [0, 11.5], [4, 12], [8, 11.5]],       // Kestrel attacks from the south
    H: [[-13, -7], [-9, -11], [13, -7], [9, -11], [0, -9]],          // Halcyon holds the sites
  };
  return { colliders, solids, sites, waypoints, spawns, bounds: BOUNDS };
}

// Breadth-first path over the waypoint graph; returns node indices.
export function findPath(world, from, to) {
  const prev = new Array(world.waypoints.length).fill(-1);
  const q = [from]; prev[from] = from;
  while (q.length) {
    const n = q.shift();
    if (n === to) break;
    for (const m of world.waypoints[n].links) if (prev[m] === -1) { prev[m] = n; q.push(m); }
  }
  if (prev[to] === -1) return [to];
  const path = []; let n = to;
  while (n !== from) { path.unshift(n); n = prev[n]; }
  return path;
}

export function nearestWaypoint(world, x, z) {
  let best = 0, bd = 1e9;
  world.waypoints.forEach((w, i) => {
    const d = (w.x - x) ** 2 + (w.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
