// DUSTLINE HUD — every DOM write lives here, never in the sim. The sim
// only sets numbers on G; this module turns them into pixels.

import * as THREE from 'three';
import { WEAPONS, GRENADE_PRICE, KEVLAR_PRICE } from './weapons.js';
import { zoneAt } from './world.js';

const el = {};
const BUY_KEYS = [
  ['pistol', '1'], ['smg', '2'], ['rifle', '3'], ['sniper', '4'],
  ['grenade', '5'], ['kevlar', '6'],
];

export function initHud(G) {
  for (const id of ['scoreK', 'scoreH', 'timer', 'roundlabel', 'sidelabel', 'killfeed', 'crosshair',
    'hitmarker', 'hpnum', 'armornum', 'healthbar', 'armorbar', 'ammo', 'weaponname',
    'money', 'bombbar', 'bombfill', 'banner', 'plantbar', 'plantlabel', 'plantfill',
    'buymenu', 'buymoney', 'buytime', 'buyitems', 'vignette', 'spectate', 'startoverlay',
    'minimap', 'radio', 'location', 'slots', 'nametags']) {
    el[id] = document.getElementById(id);
  }
  G._hud = el;
  G._radio = [];
  G._slotSig = '';
  renderBuyMenu(G);
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function showBanner(G, text, sub, dur) {
  const b = document.getElementById('banner');
  b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  b.style.display = 'block';
  G.bannerT = dur;
}

export function addKillfeed(G, attacker, victim, head, weapon) {
  if (!attacker || !victim) return;
  const w = weapon && WEAPONS[weapon] ? WEAPONS[weapon].name : '';
  const d = document.createElement('div');
  d.innerHTML = `<span class="${attacker.team === 'K' ? 'k' : 'h'}">${attacker.name}</span> ${w} ${head ? '<b>HEAD</b> ' : ''}<span class="${victim.team === 'K' ? 'k' : 'h'}">${victim.name}</span>`;
  el.killfeed.prepend(d);
  while (el.killfeed.children.length > 5) el.killfeed.lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}

// Radio chatter: bot callouts, newest last, fading after a few seconds.
export function addRadio(G, who, text) {
  if (!G._radio) G._radio = [];
  G._radio.push({ who: who.name, team: who.team, text, t: G.time });
  if (G._radio.length > 4) G._radio.shift();
}

export function renderBuyMenu(G) {
  const p = G.player;
  // Rebuilding the menu's innerHTML every frame is wasteful; only rebuild
  // when something the menu shows has actually changed.
  const sig = `${p.money}|${p.weapon}|${p.grenades}|${p.armor}`;
  if (G._buySig === sig) return;
  G._buySig = sig;
  const rows = BUY_KEYS.map(([id, key]) => {
    const w = WEAPONS[id];
    const name = w ? w.name : id === 'grenade' ? 'SPARK HE GRENADE' : 'KEVLAR VEST';
    const price = w ? w.price : id === 'grenade' ? GRENADE_PRICE : KEVLAR_PRICE;
    const owned = id === 'grenade' ? p.grenades >= 2 : id === 'kevlar' ? p.armor >= 100 : p.weapon === id;
    const afford = p.money >= price && !owned;
    return `<div class="item ${afford ? '' : 'cant'}"><span>[${key}] ${name}${owned ? ' ✓' : ''}</span><b>$${price}</b></div>`;
  }).join('');
  el.buyitems.innerHTML = rows;
}

export function toggleBuy(G) {
  if (G.rounds.phase !== 'buy') return;
  G.buyOpen = !G.buyOpen;
  renderBuyMenu(G);
}

function drawMinimap(G) {
  const cv = el.minimap;
  if (!cv) return;
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  g.fillStyle = '#10151c'; g.fillRect(0, 0, W, H);
  const s = 4.4, ox = (W - 36 * s) / 2, oz = (H - 28 * s) / 2;
  const X = (x) => ox + (x + 18) * s, Z = (z) => oz + (z + 14) * s;
  // Walls and cover.
  g.fillStyle = '#4a4438';
  for (const c of G.world.colliders) {
    if (c.y1 < 0.5) continue;
    g.fillRect(X(c.x0), Z(c.z0), (c.x1 - c.x0) * s, (c.z1 - c.z0) * s);
  }
  // Sites.
  for (const [name, site] of Object.entries(G.world.sites)) {
    g.strokeStyle = '#f5a623'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(X(site.center.x), Z(site.center.z), site.r * s, 0, 7); g.stroke();
    g.fillStyle = '#f5a623'; g.font = 'bold 11px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, X(site.center.x), Z(site.center.z));
  }
  // Bomb.
  const b = G.rounds.bomb;
  if ((b.dropped || b.planted) && b.pos) {
    g.fillStyle = '#ff5252';
    const bx = X(b.pos.x), bz = Z(b.pos.z);
    g.beginPath(); g.moveTo(bx, bz - 4); g.lineTo(bx + 4, bz); g.lineTo(bx, bz + 4); g.lineTo(bx - 4, bz); g.closePath(); g.fill();
  }
  // Agents: teammates amber, spotted enemies red, player white arrow.
  for (const a of G.agents) {
    if (!a.alive) continue;
    if (a.isPlayer) {
      g.save(); g.translate(X(a.pos.x), Z(a.pos.z)); g.rotate(Math.PI - a.yaw);
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(0, -5); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill();
      g.restore();
    } else if (a.team === 'K') {
      g.fillStyle = '#f5a623'; g.beginPath(); g.arc(X(a.pos.x), Z(a.pos.z), 3, 0, 7); g.fill();
    } else if (G.time - a.spottedT < 4) {
      g.fillStyle = '#ff5252'; g.beginPath(); g.arc(X(a.pos.x), Z(a.pos.z), 3, 0, 7); g.fill();
    }
  }
}

const _tagPool = [];
function renderNametags(G) {
  const layer = el.nametags;
  if (!layer) return;
  const w = innerWidth, h = innerHeight;
  let n = 0;
  for (const a of G.agents) {
    if (!a.isBot || !a.alive) continue;
    const show = a.team === 'K' || (G.time - a.spottedT < 4);
    if (!show) continue;
    const v = new THREE.Vector3(a.pos.x, a.pos.y + 2.05, a.pos.z).project(G.camera);
    if (v.z > 1) continue;
    const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    if (x < 0 || x > w || y < 0 || y > h) continue;
    let tag = _tagPool[n];
    if (!tag) { tag = document.createElement('span'); layer.appendChild(tag); _tagPool.push(tag); }
    tag.textContent = a.name;
    tag.className = a.team === 'K' ? 'k' : 'h';
    tag.style.left = `${x.toFixed(0)}px`; tag.style.top = `${y.toFixed(0)}px`;
    tag.style.display = 'block';
    n++;
  }
  for (let i = n; i < _tagPool.length; i++) _tagPool[i].style.display = 'none';
}

function renderSlots(G) {
  const p = G.player;
  const owned = p.owned || [];
  const sig = `${owned.join(',')}|${p.weapon}|${p.grenades}|${p.armor > 0}`;
  if (G._slotSig === sig) return;
  G._slotSig = sig;
  const defs = [['pistol', '1'], ['smg', '2'], ['rifle', '3'], ['sniper', '4']];
  el.slots.innerHTML = defs.map(([id, key]) => {
    const has = owned.includes(id);
    const cur = p.weapon === id;
    return `<span class="${has ? 'owned' : ''} ${cur ? 'cur' : ''}">${key} ${WEAPONS[id].name}</span>`;
  }).join('') + `<span class="${p.grenades ? 'owned' : ''}">G HE×${p.grenades}</span>`;
}

export function updateHud(G, dt) {
  const p = G.player;
  const R = G.rounds;
  el.scoreK.textContent = R.scoreK;
  el.scoreH.textContent = R.scoreH;
  el.roundlabel.textContent = `ROUND ${Math.max(1, R.round)} OF 9`;
  el.sidelabel.textContent = p.team === 'K' ? 'ATTACK' : 'DEFEND';
  el.location.textContent = zoneAt(G.world, p.pos.x, p.pos.z);
  drawMinimap(G);
  renderNametags(G);
  renderSlots(G);
  // Radio feed: newest last, fading out after ~8 s.
  if (el.radio) {
    const lines = (G._radio || []).filter((r) => G.time - r.t < 8).slice(-3);
    el.radio.innerHTML = lines.map((r) => `<div><span class="${r.team === 'K' ? 'k' : 'h'}">${r.who}</span> ${r.text}</div>`).join('');
  }
  el.timer.textContent = R.phase === 'buy' ? `BUY ${fmtTime(R.phaseT)}`
    : R.bomb.planted ? `💣 ${fmtTime(R.bomb.timer)}` : fmtTime(R.roundTime);
  el.hpnum.textContent = Math.max(0, Math.ceil(p.hp));
  el.armornum.textContent = Math.floor(p.armor);
  el.healthbar.style.width = `${Math.max(0, p.hp)}%`;
  el.armorbar.firstElementChild.style.width = `${Math.min(100, p.armor)}%`;
  const w = WEAPONS[p.weapon];
  el.ammo.innerHTML = p.reloading > 0 ? `RELOADING` : `${p.ammo.mag} <small>/ ${p.ammo.reserve}</small>`;
  el.weaponname.textContent = `${w.name}${p.hasBomb ? ' · SPIKE' : ''}`;
  el.money.textContent = `$${p.money}${p.grenades ? ` · G×${p.grenades}` : ''}`;
  // Crosshair gap mirrors live spread: still = tight, moving/bloom = wide.
  const speed = Math.hypot(p.vel.x, p.vel.z);
  const gap = 6 + speed * 1.1 + p.bloom * 16;
  el.crosshair.style.setProperty('--gap', `${gap.toFixed(1)}px`);
  // Hitmarker flashes 0.15 s after a hit.
  const hm = G.time - G.hitmarkT < 0.15;
  el.hitmarker.style.opacity = hm ? '1' : '0';
  el.hitmarker.className = G.hitmark === 'head' ? 'head' : '';
  el.vignette.style.opacity = String(Math.min(1, G.hurtFlash));
  // Bomb bar while the Spike ticks.
  el.bombbar.style.display = R.bomb.planted ? 'block' : 'none';
  if (R.bomb.planted) el.bombfill.style.width = `${(R.bomb.timer / 35) * 100}%`;
  // Plant / defuse progress.
  const prog = p.planting > 0 ? p.planting / 3.5 : p.defusing > 0 ? p.defusing / 5 : 0;
  el.plantbar.style.display = prog > 0 ? 'block' : 'none';
  if (prog > 0) {
    el.plantlabel.textContent = p.planting > 0 ? 'PLANTING SPIKE' : 'DEFUSING SPIKE';
    el.plantfill.style.width = `${prog * 100}%`;
  }
  // Buy menu only during the buy phase.
  el.buymenu.style.display = G.buyOpen && R.phase === 'buy' ? 'block' : 'none';
  if (G.buyOpen && R.phase === 'buy') {
    el.buymoney.textContent = `$${p.money}`;
    el.buytime.textContent = `${Math.ceil(R.phaseT)}s`;
    renderBuyMenu(G);
  }
  // Banner lifetime.
  if (G.bannerT > 0) {
    G.bannerT -= dt;
    if (G.bannerT <= 0) el.banner.style.display = 'none';
  }
  // Spectate label when dead mid-round.
  el.spectate.style.display = !p.alive && (R.phase === 'live' || R.phase === 'buy') ? 'block' : 'none';
  // Start overlay: hidden in shot mode, shown until the first lock.
  if (G.shotMode) el.startoverlay.style.display = 'none';
  else el.startoverlay.style.display = G.input.locked ? 'none' : 'flex';
}
