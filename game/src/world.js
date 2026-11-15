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
  // Large paving tiles with per-tile tone jitter — the yard reads as
  // laid stone, not a flat slab, from any angle.
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const v = 0.88 + Math.random() * 0.24;
      g.fillStyle = `rgb(${Math.floor(201 * v)},${Math.floor(168 * v)},${Math.floor(106 * v)})`;
      g.fillRect(tx * 64 + 1, ty * 64 + 1, 62, 62);
    }
  }
  g.strokeStyle = 'rgba(70,52,30,0.55)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
  }
  for (let i = 0; i < 1200; i++) {
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

// Brick courses with per-brick tone jitter + soot — the yard's walls read
// as built masonry, the way the top entries' kiln yards do.
function brickTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6b4a33'; g.fillRect(0, 0, 256, 256);
  const bh = 16, bw = 42;
  for (let y = 0, row = 0; y < 256; y += bh, row++) {
    const off = (row % 2) * bw / 2;
    for (let x = -bw; x < 256 + bw; x += bw) {
      const v = 0.82 + Math.random() * 0.36;
      g.fillStyle = `rgb(${Math.floor(154 * v)},${Math.floor(95 * v)},${Math.floor(60 * v)})`;
      g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
    }
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(40,25,15,0.12)' : 'rgba(220,180,130,0.10)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Crates: horizontal planks, nail dots, stencilled mark.
function plankTexture(label) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8a6a42'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) {
    const v = 0.88 + Math.random() * 0.24;
    g.fillStyle = `rgb(${Math.floor(138 * v)},${Math.floor(106 * v)},${Math.floor(66 * v)})`;
    g.fillRect(0, y + 1, 128, 30);
    g.fillStyle = 'rgba(50,32,16,0.6)';
    g.fillRect(0, y, 128, 2);
    g.fillStyle = 'rgba(40,26,12,0.8)';
    g.beginPath(); g.arc(8, y + 16, 2, 0, 7); g.arc(120, y + 16, 2, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(30,20,10,0.75)'; g.font = 'bold 20px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 64, 66);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Containers: vertical ribs, rust streaks, stencilled fleet mark.
function corrugatedTexture(base, label) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 16) {
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, 0, 5, 128);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 11, 0, 5, 128);
  }
  for (let i = 0; i < 10; i++) {
    g.fillStyle = 'rgba(90,50,20,0.25)';
    const x = Math.random() * 256;
    g.fillRect(x, Math.random() * 40, 3 + Math.random() * 4, 40 + Math.random() * 80);
  }
  g.fillStyle = 'rgba(245,240,225,0.85)'; g.font = 'bold 26px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 128, 66);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// One big painted letter, transparent background — site letters on the walls.
function bigLetter(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f5a623'; g.font = 'bold 104px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c);
  return new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
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
  // Dusk clouds: soft pink billboards high up so the sky is never flat.
  const cloudC = document.createElement('canvas');
  cloudC.width = 128; cloudC.height = 64;
  const cg = cloudC.getContext('2d');
  const grad = cg.createRadialGradient(64, 32, 4, 64, 32, 60);
  grad.addColorStop(0, 'rgba(255,190,150,0.55)');
  grad.addColorStop(0.6, 'rgba(230,150,140,0.28)');
  grad.addColorStop(1, 'rgba(230,150,140,0)');
  cg.fillStyle = grad; cg.fillRect(0, 0, 128, 64);
  const cloudT = new THREE.CanvasTexture(cloudC);
  for (const [cx, cy, cz, w] of [[-40, 30, -80, 34], [20, 34, -90, 26], [55, 28, -60, 30], [-70, 32, -40, 24], [0, 38, -100, 40]]) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2.4),
      new THREE.MeshBasicMaterial({ map: cloudT, transparent: true, fog: false, depthWrite: false }));
    cl.position.set(cx, cy, cz); cl.lookAt(0, 2, 0); scene.add(cl);
  }
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
  function boxMat(cx, cz, w, d, h, material, y0 = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(cx, y0 + h / 2, cz); scene.add(m); solids.push(m);
    colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y0, y1: y0 + h, mesh: m });
    return m;
  }
  const brickMat = new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.95 });
  const plankMat = new THREE.MeshStandardMaterial({ map: plankTexture('SG-4'), roughness: 0.9 });
  const corrA = new THREE.MeshStandardMaterial({ map: corrugatedTexture('#3f6d5a', 'KESTREL 04'), roughness: 0.8, metalness: 0.15 });
  const corrB = new THREE.MeshStandardMaterial({ map: corrugatedTexture('#7a5a2e', 'HALCYON 07'), roughness: 0.8, metalness: 0.15 });
  function cylinder(cx, cz, r, h, color) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), mat(color, 0.55));
    m.position.set(cx, h / 2, cz); scene.add(m); solids.push(m);
    colliders.push({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r, y0: 0, y1: h, mesh: m });
    return m;
  }

  // Perimeter walls — brick, not flat paint.
  boxMat(0, -14.3, 37.2, 0.6, 3.4, brickMat);
  boxMat(0, 14.3, 37.2, 0.6, 3.4, brickMat);
  boxMat(-18.3, 0, 0.6, 29.2, 3.4, brickMat);
  boxMat(18.3, 0, 0.6, 29.2, 3.4, brickMat);

  // Mid containers — the lane's cover, corrugated + stencilled.
  boxMat(-3, 6, 4.5, 2.4, 2.6, corrA);
  boxMat(3, 0, 4.5, 2.4, 2.6, corrB);
  boxMat(-2, -6, 2.4, 5, 2.6, corrB);
  boxMat(5, -9, 4.5, 2.4, 2.6, corrA);
  // Crates, some stacked — plank texture with stencil.
  boxMat(-8, 6, 1.2, 1.2, 1.2, plankMat);
  boxMat(-8, 4.6, 1.2, 1.2, 1.2, plankMat);
  boxMat(-8, 6, 1.2, 1.2, 1.2, plankMat, 1.2);
  boxMat(8, -4, 1.2, 1.2, 1.2, plankMat);
  boxMat(8, 4, 1.2, 1.2, 1.2, plankMat);
  boxMat(-12, -2, 1.2, 1.2, 1.2, plankMat);
  boxMat(12, 6, 1.2, 1.2, 1.2, plankMat);
  boxMat(0, 10, 1.2, 1.2, 1.2, plankMat);
  boxMat(-6, 11, 1.2, 1.2, 1.2, plankMat);
  boxMat(6, 11, 1.2, 1.2, 1.2, plankMat);
  // Low walls — brick cover you can shoot over only from height, not through.
  boxMat(-6, -2, 0.5, 4, 1.1, brickMat);
  boxMat(6, 2, 0.5, 4, 1.1, brickMat);
  boxMat(0, -11.5, 6, 0.5, 1.1, brickMat);
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
  // Big painted site letters on the side walls, the way real yards mark them.
  const letterA = bigLetter('A');
  letterA.position.set(-17.9, 2.0, -9); letterA.rotation.y = Math.PI / 2; scene.add(letterA);
  const letterB = bigLetter('B');
  letterB.position.set(17.9, 2.0, -9); letterB.rotation.y = -Math.PI / 2; scene.add(letterB);
  // Brick chimney with a glowing band at A + pipes along the north wall.
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 7, 14),
    new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.95 }));
  chimney.position.set(-16.5, 3.5, -12.5); scene.add(chimney); solids.push(chimney);
  colliders.push({ x0: -17.6, x1: -15.4, z0: -13.6, z1: -11.4, y0: 0, y1: 7, mesh: chimney });
  const glowBand = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.35, 14),
    new THREE.MeshStandardMaterial({ color: 0xff8a3c, emissive: 0xff6a1a, emissiveIntensity: 1.4 }));
  glowBand.position.set(-16.5, 6.2, -12.5); scene.add(glowBand);
  for (const py of [2.6, 2.95]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 20, 10),
      new THREE.MeshStandardMaterial({ color: 0x4a4a44, roughness: 0.5, metalness: 0.6 }));
    pipe.rotation.z = Math.PI / 2; pipe.position.set(0, py, -13.9); scene.add(pipe);
  }
  // Bunting flags strung across mid — colour and motion read in every shot.
  const bunting = new THREE.Group();
  const flagCols = [0xf5a623, 0x2fa8a0, 0xd97b2f];
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const shape = new THREE.Shape();
    shape.moveTo(-0.15, 0); shape.lineTo(0.15, 0); shape.lineTo(0, -0.35); shape.closePath();
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: flagCols[i % 3], side: THREE.DoubleSide }));
    const x = -7 + t * 14;
    flag.position.set(x, 3.55 - Math.sin(t * Math.PI) * 0.3, 2);
    bunting.add(flag);
  }
  scene.add(bunting);
  for (const [px, pz] of [[-7.2, 2], [7.2, 2]]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.4, 0.1), mat(0x222222));
    pole.position.set(px, 1.7, pz); scene.add(pole);
    colliders.push({ x0: px - 0.08, x1: px + 0.08, z0: pz - 0.08, z1: pz + 0.08, y0: 0, y1: 3.4, mesh: pole });
  }
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
