// DUSTLINE boot — renderer, scene, the shared game state, the fixed-step
// loop, and the deterministic ?shot= capture modes the screenshots use.
// One state store (G); the sim runs at a fixed 60 Hz apart from rendering.

import * as THREE from 'three';
import { buildWorld } from './world.js';
import { createAgent, stepPlayer, eyePos } from './player.js';
import { giveWeapon, fire, updateWeapons, createViewmodel, updateViewmodel, WEAPONS } from './weapons.js';
import { stepBots, assignBotRoles } from './bots.js';
import { newMatchState, startRound, updateRounds, endRound } from './rounds.js';
import { sfx } from './audio.js';
import { initInput, updateInput } from './input.js';
import { initHud, updateHud, showBanner, addKillfeed } from './hud.js';
import { initEffects, updateEffects, spawnTracer } from './effects.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '1', 10);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);

const G = {
  THREE, scene, camera, renderer,
  world: null, agents: [], player: null,
  input: { keys: {}, mouseDX: 0, mouseDY: 0, mouseDown: false, prevMouseDown: false, locked: false },
  rounds: newMatchState(),
  grenades: [], time: 0, tick: 0,
  hurtFlash: 0, hitmark: null, hitmarkT: -99, viewKick: 0,
  lastShotPos: null, lastShotT: -99,
  shotMode: SHOT, spectateTarget: null, buyOpen: false, bannerT: 0,
  started: !!SHOT, sfx,
  showBanner: (t, s, d) => showBanner(G, t, s, d),
  addKillfeed: (a, v, h) => addKillfeed(G, a, v, h),
  assignBotRoles: () => assignBotRoles(G),
};
G.rounds.endRound = (w, r) => endRound(G, w, r);

G.world = buildWorld(scene);
initEffects(G);

const KNAMES = ['YOU', 'FALCON', 'DUNE', 'EMBER', 'SLATE'];
const HNAMES = ['WARDEN', 'FROST', 'PIKE', 'MOSA', 'REED'];
G.player = createAgent(G, { team: 'K', isBot: false, name: 'YOU', x: 0, z: 11.5, yaw: 0 });
G.agents.push(G.player);
for (let i = 0; i < 4; i++) {
  const s = G.world.spawns.K[i + 1];
  G.agents.push(createAgent(G, { team: 'K', isBot: true, name: KNAMES[i + 1], x: s[0], z: s[1], yaw: 0 }));
}
for (let i = 0; i < 5; i++) {
  const s = G.world.spawns.H[i];
  G.agents.push(createAgent(G, { team: 'H', isBot: true, name: HNAMES[i], x: s[0], z: s[1], yaw: Math.PI }));
}

createViewmodel(G);
initInput(G);
initHud(G);
startRound(G, 1);

// Deterministic screenshot setups. Seeded placement, scripted bots, then
// the sim runs a fixed number of steps and the frame freezes.
function setupShot(mode) {
  const rnd = mulberry32(SEED * 7919 + mode.length * 131);
  const R = G.rounds;
  const kBots = G.agents.filter((a) => a.isBot && a.team === 'K');
  const hBots = G.agents.filter((a) => a.isBot && a.team === 'H');
  const place = (a, x, z, yaw) => { a.pos.set(x, 0, z); a.yaw = yaw; a.pitch = 0; a.group.position.copy(a.pos); };
  if (mode === 'start') {
    // Buy phase at spawn, teammates ahead, mid lane in view, shop open.
    place(G.player, 0, 11.5, 0.12);
    place(kBots[0], -2.5, 6.5, 0); place(kBots[1], 2.5, 5.5, -0.1);
    place(kBots[2], -6, 9, 0.2); place(kBots[3], 6, 9, -0.2);
    G.buyOpen = true;
  } else if (mode === 'play') {
    // Mid-fight: two defenders in the lane, one teammate beside the player.
    R.phase = 'live'; R.phaseT = 0; R.roundTime = 82;
    place(G.player, 1.5, 9, -0.12);
    place(hBots[0], 0, -1, Math.PI); place(hBots[1], 3.5, -3, Math.PI - 0.4);
    place(hBots[2], -4.5, -4, Math.PI + 0.3);
    place(kBots[0], -4, 7, 0.1); place(kBots[1], 4, 7.5, -0.1);
    G.player.weapon = 'rifle'; giveWeapon(G, G.player, 'rifle');
    G.player.money = 3250;
    G._playShooter = kBots[0]; G._playTarget = hBots[1];
  } else if (mode === 'plant') {
    // Planting the Spike at A: progress ring at ~60%, a defender in view.
    R.phase = 'live'; R.phaseT = 0; R.roundTime = 54;
    place(G.player, -10.5, -4.8, 0.3);
    G.player.hasBomb = true;
    place(hBots[0], -15, -10.5, Math.PI - 0.5); place(hBots[1], -9.5, -11, Math.PI + 0.4);
    place(kBots[0], -13.5, -3.5, 0.2);
    G._plantAfter = true;
  } else if (mode === 'end') {
    // Round won: banner, 1–0, player at B site among the tanks.
    R.phase = 'end'; R.phaseT = 4; R.scoreK = 1; R.winner = 'K'; R.reason = 'SPIKE DETONATED';
    R.bomb.planted = true; R.bomb.site = 'B'; R.bomb.timer = 0;
    R.bomb.pos = new THREE.Vector3(13, 0.1, -9);
    place(G.player, 11, -6, -0.7);
    place(kBots[0], 14, -8, -0.4); place(hBots[0], 15, -11, Math.PI);
    showBanner(G, 'KESTREL WINS THE ROUND', 'SPIKE DETONATED', 99);
  }
  void rnd;
}

function step(dt) {
  G.time += dt; G.tick++;
  updateInput(G, dt);
  if (G.rounds.phase === 'buy' || G.rounds.phase === 'live') stepPlayer(G, dt);
  if (G.rounds.phase === 'live') stepBots(G, dt); // buy phase is safe: bots hold
  updateWeapons(G, dt);
  updateRounds(G, dt);
  updateEffects(G, dt);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.5);
}

function updateCamera() {
  const p = G.player;
  if (p.alive) {
    const e = eyePos(p);
    camera.position.copy(e);
    camera.rotation.y = p.yaw; camera.rotation.x = p.pitch; camera.rotation.z = 0;
  } else {
    const t = (G.spectateTarget && G.spectateTarget.alive) ? G.spectateTarget
      : G.agents.find((a) => a.alive && a.team === 'K' && a.isBot);
    G.spectateTarget = t;
    if (t) {
      const e = eyePos(t);
      camera.position.copy(e);
      camera.rotation.y = t.yaw; camera.rotation.x = t.pitch; camera.rotation.z = 0;
    }
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // Screenshot mode freezes after setup: the captured frame never changes.
  if (SHOT && G._frozen) {
    updateCamera();
    updateViewmodel(G, 0);
    updateHud(G, 0);
    renderer.render(scene, camera);
    return;
  }
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const paused = !SHOT && G.started && !G.input.locked;
  if (!paused) {
    acc += dt;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
  }
  updateCamera();
  updateViewmodel(G, dt);
  updateHud(G, dt);
  renderer.render(scene, camera);
}

if (SHOT) {
  setupShot(SHOT);
  for (let i = 0; i < 90; i++) step(1 / 60);
  if (SHOT === 'play' && G._playShooter && G._playTarget) {
    // Guarantee a tracer across the frame: a teammate fires at a defender.
    const b = G._playShooter, t = G._playTarget;
    const from = new THREE.Vector3(b.pos.x, 1.5, b.pos.z);
    const to = new THREE.Vector3(t.pos.x, 1.3, t.pos.z);
    const dir = to.clone().sub(from).normalize();
    fire(G, b, dir);
    spawnTracer(G, from, to);
  }
  if (SHOT === 'plant' && G._plantAfter) G.player.planting = 2.1;
  if (SHOT === 'play' || SHOT === 'plant') {
    G.bannerT = 0;
    document.getElementById('banner').style.display = 'none';
  }
  updateCamera();
  updateHud(G, 0);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  G._frozen = true;
  window.__shotReady = true;
}

window.__DUSTLINE = G;
requestAnimationFrame(frame);
