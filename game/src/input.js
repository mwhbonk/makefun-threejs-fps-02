// DUSTLINE input — keyboard, mouse look with pointer lock, firing,
// reload, buy keys, grenade, weapon wheel. The overlay click is the only
// gesture that locks the pointer; Escape unlocks and pauses the sim.

import { fire, reloadWeapon, throwGrenade, giveWeapon, WEAPONS } from './weapons.js';
import { buyWeapon } from './rounds.js';
import { toggleBuy } from './hud.js';
import { sfx } from './audio.js';

const BUY_IDS = ['pistol', 'smg', 'rifle', 'sniper', 'grenade', 'kevlar'];

export function initInput(G) {
  const k = G.input.keys;
  addEventListener('keydown', (e) => {
    k[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (!G.player.alive) return;
    if (e.code === 'KeyR') reloadWeapon(G, G.player);
    if (e.code === 'KeyB') { toggleBuy(G); sfx.click(); }
    if (e.code === 'KeyG') throwGrenade(G, G.player);
    if (e.code === 'KeyM') sfx.toggleMute();
    if (G.buyOpen && e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5), 10) - 1;
      if (BUY_IDS[n] && buyWeapon(G, G.player, BUY_IDS[n])) sfx.click();
    }
  });
  addEventListener('keyup', (e) => { k[e.code] = false; });
  addEventListener('mousedown', (e) => { if (e.button === 0) G.input.mouseDown = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) G.input.mouseDown = false; });
  addEventListener('mousemove', (e) => {
    if (G.input.locked) { G.input.mouseDX += e.movementX; G.input.mouseDY += e.movementY; }
  });
  document.addEventListener('pointerlockchange', () => {
    G.input.locked = document.pointerLockElement === G.renderer.domElement;
  });
  addEventListener('wheel', (e) => {
    const p = G.player;
    if (!p.alive || !p.owned || p.owned.length < 2) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    const i = p.owned.indexOf(p.weapon);
    const next = p.owned[(i + dir + p.owned.length) % p.owned.length];
    if (next && next !== p.weapon) giveWeapon(G, p, next);
  }, { passive: true });
  const overlay = document.getElementById('startoverlay');
  overlay.addEventListener('click', () => {
    sfx.unlock();
    G.started = true;
    G.renderer.domElement.requestPointerLock();
  });
  G.renderer.domElement.addEventListener('click', () => {
    if (G.started && !G.input.locked && !G.shotMode) G.renderer.domElement.requestPointerLock();
  });
}

export function updateInput(G, dt) {
  const p = G.player;
  p.yaw -= G.input.mouseDX * 0.0023;
  p.pitch -= G.input.mouseDY * 0.0023;
  p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
  G.input.mouseDX = 0;
  G.input.mouseDY = 0;
  if (G.input.mouseDown && p.alive && G.rounds.phase === 'live' && G.input.locked) {
    const w = WEAPONS[p.weapon];
    if (w.auto || !G.input.prevMouseDown) fire(G, p);
  }
  G.input.prevMouseDown = G.input.mouseDown;
}
