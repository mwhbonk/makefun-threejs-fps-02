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
  // Concrete slab joints.
  g.strokeStyle = 'rgba(90,70,45,0.28)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
  }
  // Tire tracks along the lanes + oil stains.
  g.fillStyle = 'rgba(70,55,35,0.16)';
  g.fillRect(30, 0, 12, 256); g.fillRect(200, 0, 12, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = 'rgba(40,30,20,0.20)';
    g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 12, 4 + Math.random() * 8, Math.random() * 3, 0, 7); g.fill();
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

  // Dusk gradient dome + low sun disc: the sky reads in every screenshot.
  const skyGeo = new THREE.SphereGeometry(150, 24, 16);
  const skyColors = [];
  const skyPos = skyGeo.attributes.position;
  const top = new THREE.Color(0x232c4e), mid = new THREE.Color(0x7a4a5e), hor = new THREE.Color(0xff8a3c);
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i) / 150;
    const c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(hor, 1 - (y + 1) / 1.25);
    skyColors.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 24),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, fog: false }));
  sunDisc.position.set(-55, 16, -110); sunDisc.lookAt(0, 2, 0); scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(16, 24),
    new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0.25, fog: false }));
  sunGlow.position.set(-55, 16, -111); sunGlow.lookAt(0, 2, 0); scene.add(sunGlow);
  scene.fog = new THREE.Fog(0x8a5a44, 26, 95);
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x5a4632, 0.95));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(-24, 30, -20); scene.add(sun);
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

  // Site name boards on the back walls + yard props (barrels, sandbags,
  // lamps, hazard barriers) so the map reads as a place, not a box.
  function nameBoard(text, w) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#20262e'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#f5a623'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
    g.fillStyle = '#f5a623'; g.font = 'bold 56px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 68);
    const t = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: t }));
    return m;
  }
  const boardA = nameBoard('CRANE YARD', 7);
  boardA.position.set(-13, 2.2, -13.9); scene.add(boardA);
  const boardB = nameBoard('TANK FARM', 7);
  boardB.position.set(13, 2.2, -13.9); scene.add(boardB);
  function hazardTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#f5a623'; g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#1a1a1a';
    for (let x = -32; x < 160; x += 32) {
      g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.closePath(); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
    return t;
  }
  const haz = hazardTexture();
  const hazMat = new THREE.MeshStandardMaterial({ map: haz, roughness: 0.9 });
  for (const [hx, hz, hw] of [[-6, 3.5, 3], [6, -3.5, 3], [0, -12.8, 4]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(hw, 0.9, 0.4), hazMat);
    m.position.set(hx, 0.45, hz); scene.add(m); solids.push(m);
    colliders.push({ x0: hx - hw / 2, x1: hx + hw / 2, z0: hz - 0.2, z1: hz + 0.2, y0: 0, y1: 0.9, mesh: m });
  }
  // Barrels.
  cylinder(-5, 8, 0.55, 1.1, PALETTE.rust);
  cylinder(7, -2, 0.55, 1.1, PALETTE.containerB);
  cylinder(-11, 4, 0.55, 1.1, PALETTE.rust);
  // Sandbag rows at the mid entries.
  box(-4, 9.5, 2.2, 0.7, 0.7, PALETTE.sandDark);
  box(4, -9.5, 2.2, 0.7, 0.7, PALETTE.sandDark);
  // Lamp posts with warm bulbs.
  for (const [lx, lz] of [[0, 8], [-10, 0], [10, 0]]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), mat(0x222222));
    pole.position.set(lx, 1.7, lz); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc46b }));
    bulb.position.set(lx, 3.5, lz); scene.add(bulb);
    colliders.push({ x0: lx - 0.1, x1: lx + 0.1, z0: lz - 0.1, z1: lz + 0.1, y0: 0, y1: 3.4, mesh: pole });
  }

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

// Human-readable zone name for the HUD location label and radio callouts.
export function zoneAt(world, x, z) {
  if (Math.hypot(x + 13, z + 9) < 5.5) return 'CRANE YARD · SITE A';
  if (Math.hypot(x - 13, z + 9) < 5.5) return 'TANK FARM · SITE B';
  if (z > 10) return 'KESTREL SPAWN';
  if (z < -4 && Math.abs(x) < 8) return 'HALCYON HOLD';
  if (Math.abs(x) < 8) return 'MID LANE';
  return x < 0 ? 'WEST YARD' : 'EAST YARD';
}
