// DUSTLINE HUD — every DOM write lives here, never in the sim. The sim
// only sets numbers on G; this module turns them into pixels.

import { WEAPONS, GRENADE_PRICE, KEVLAR_PRICE } from './weapons.js';

const el = {};
const BUY_KEYS = [
  ['pistol', '1'], ['smg', '2'], ['rifle', '3'], ['sniper', '4'],
  ['grenade', '5'], ['kevlar', '6'],
];

export function initHud(G) {
  for (const id of ['scoreK', 'scoreH', 'timer', 'roundlabel', 'killfeed', 'crosshair',
    'hitmarker', 'hpnum', 'armornum', 'healthbar', 'armorbar', 'ammo', 'weaponname',
    'money', 'bombbar', 'bombfill', 'banner', 'plantbar', 'plantlabel', 'plantfill',
    'buymenu', 'buymoney', 'buytime', 'buyitems', 'vignette', 'spectate', 'startoverlay']) {
    el[id] = document.getElementById(id);
  }
  G._hud = el;
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

export function addKillfeed(G, attacker, victim, head) {
  if (!attacker || !victim) return;
  const d = document.createElement('div');
  d.innerHTML = `<span class="${attacker.team === 'K' ? 'k' : 'h'}">${attacker.name}</span> ${head ? '◉' : '—'} <span class="${victim.team === 'K' ? 'k' : 'h'}">${victim.name}</span>`;
  el.killfeed.prepend(d);
  while (el.killfeed.children.length > 5) el.killfeed.lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}

export function renderBuyMenu(G) {
  const p = G.player;
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

export function updateHud(G, dt) {
  const p = G.player;
  const R = G.rounds;
  el.scoreK.textContent = R.scoreK;
  el.scoreH.textContent = R.scoreH;
  el.roundlabel.textContent = `ROUND ${Math.max(1, R.round)}/9`;
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
