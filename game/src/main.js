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
import { initHud, updateHud, showBanner, addKillfeed, addRadio } from './hud.js';
import { initEffects, updateEffects, spawnTracer, spawnSmoke } from './effects.js';

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
  addKillfeed: (a, v, h, w) => addKillfeed(G, a, v, h, w),
  say: (who, text) => addRadio(G, who, text),
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
  const spot = (a) => { a.spottedT = 99; }; // tags + minimap show in the frame
  if (mode === 'cover') {
    // Live combat cover, round 5: the player fires across open west-mid at
    // a defender in the open, a teammate's tracer crosses the frame, smoke
    // hangs at mid. No container wall between the camera and the fight.
    R.round = 5; R.scoreK = 2; R.scoreH = 2;
    R.phase = 'live'; R.phaseT = 0; R.roundTime = 96;
    place(G.player, 0, 4.5, 0.35);
    place(hBots[0], -2.5, -2, Math.PI - 0.35); place(hBots[1], -4.5, -0.5, Math.PI + 0.4);
    place(hBots[2], 2, -4, Math.PI);
    place(kBots[0], 2.5, 6.5, -0.3); place(kBots[1], -3, 7, 0.2);
    place(kBots[2], 4, 3, -0.5);
    giveWeapon(G, G.player, 'rifle');
    G.player.money = 4200; G.player.armor = 100; G.player.helmet = true;
    G.player.smokes = 1; G.player.grenades = 1;
    G.plan = 'PLAN: SPLIT A — YOU: ENTRY'; G._planT = 12;
    G._coverShooter = kBots[0]; G._coverTarget = hBots[0]; G._coverKill = hBots[1];
    hBots[1].hp = 34; // one hit kills: the killfeed entry is then certain
    spot(hBots[0]); spot(hBots[1]); spot(hBots[2]);
    G.say(kBots[1], 'contact at mid lane — two at the crates');
    G.say(hBots[0], 'holding B, need one mid');
    G.say(kBots[0], 'smoke going down mid');
  } else if (mode === 'plant') {
    // Planting the Spike at A: progress ring at ~60%, a defender in view.
    R.phase = 'live'; R.phaseT = 0; R.roundTime = 54;
    place(G.player, -9.5, -3.5, 0.3);
    G.player.hasBomb = true;
    place(hBots[0], -15, -10.5, Math.PI - 0.5); place(hBots[1], -9.5, -11, Math.PI + 0.4);
    place(kBots[0], -13.5, -3.5, 0.2);
    spot(hBots[0]); spot(hBots[1]);
    G.say(kBots[0], 'covering A — plant it');
    G._plantAfter = true;
  } else if (mode === 'shop') {
    // Buy phase, round 3: shop open, minimap + radio live, yard behind.
    R.round = 3; R.scoreK = 1; R.scoreH = 1;
    place(G.player, 0, 11.5, 0.12);
    place(kBots[0], -2.5, 6.5, 0); place(kBots[1], 2.5, 5.5, -0.1);
    place(kBots[2], -6, 9, 0.2); place(kBots[3], 6, 9, -0.2);
    G.player.money = 5960;
    giveWeapon(G, G.player, 'smg');
    G.player.smokes = 1;
    G.buyOpen = true;
    G.say(kBots[0], 'round 3: buy up, then hit B together');
  } else if (mode === 'end') {
    // Round won: banner, 1–0, player at B site among the tanks.
    R.phase = 'end'; R.phaseT = 4; R.scoreK = 1; R.winner = 'K'; R.reason = 'SPIKE DETONATED';
    R.bomb.planted = true; R.bomb.site = 'B'; R.bomb.timer = 0;
    R.bomb.pos = new THREE.Vector3(13, 0.1, -9);
    G._planT = 0; // no plan line on the victory frame
    place(G.player, 10, -5.5, -0.55);
    place(kBots[0], 16, -5.5, -1.2); place(hBots[0], 15, -11, Math.PI);
    showBanner(G, 'KESTREL WINS THE ROUND', 'SPIKE DETONATED', 99);
  }
  void rnd;
}

function step(dt) {
  G.time += dt; G.tick++;
  updateInput(G, dt);
  if (G.rounds.phase === 'buy' || G.rounds.phase === 'live') stepPlayer(G, dt);
  // Shot setups freeze the bots: placements stay exactly where the shot
  // put them, so no teammate wanders into the frame and no one dies off-script.
  if (G.rounds.phase === 'live' && !G.shotMode) stepBots(G, dt); // buy phase is safe: bots hold
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
  // The scripted shots below raycast the world: the meshes' matrixWorld
  // is still identity until the first render, so refresh it first — without
  // this, every ray hits a phantom wall sitting at the origin.
  scene.updateMatrixWorld(true);
  if (SHOT === 'cover' && G._coverShooter && G._coverTarget) {
    // Guarantee a tracer across the frame: a teammate fires at a defender.
    const b = G._coverShooter, t = G._coverTarget;
    const from = new THREE.Vector3(b.pos.x, 1.5, b.pos.z);
    const to = new THREE.Vector3(t.pos.x, 1.3, t.pos.z);
    const dir = to.clone().sub(from).normalize();
    fire(G, b, dir);
    spawnTracer(G, from, to);
    // The player's own shots, all real sim damage: four at the far-left
    // defender (enough to kill even if one misses — the killfeed entry is
    // real), then the crosshair shot at the defender in front. Reset the
    // recoil kick afterwards so the crosshair stays on the target.
    const eye = new THREE.Vector3(G.player.pos.x, 1.62, G.player.pos.z);
    const kill = G._coverKill;
    if (kill && kill.alive) {
      const kd = new THREE.Vector3(kill.pos.x, 1.3, kill.pos.z).sub(eye).normalize();
      for (let i = 0; i < 4 && kill.alive; i++) { fire(G, G.player, kd); G.time += 0.14; }
    }
    const pdir = to.clone().sub(eye).normalize();
    fire(G, G.player, pdir);
    G.player.pitch = 0; G.player.yaw = 0.35;
    // Smoke hanging at mid-left, visible but clear of the crosshair.
    spawnSmoke(G, new THREE.Vector3(-1, 0.6, -5.5));
  }
  if (SHOT === 'plant' && G._plantAfter) G.player.planting = 2.1;
  if (SHOT === 'cover' || SHOT === 'plant') {
    G.bannerT = 0;
    document.getElementById('banner').style.display = 'none';
  }
  if (SHOT === 'shop') showBanner(G, 'ROUND 3', '', 99);
  updateCamera();
  updateHud(G, 0);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  G._frozen = true;
  window.__shotReady = true;
}

window.__DUSTLINE = G;
requestAnimationFrame(frame);
