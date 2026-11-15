// DUSTLINE audio — every sound is synthesised with WebAudio: no audio
// files, no network. A shared noise buffer plus oscillators and envelopes
// cover shots, reloads, hits, plants, explosions and the round horn.

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.32;
  return muted;
}

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  } catch { return false; }
}

function noise(dur, freq, gain, type = 'lowpass', sweepTo = null) {
  if (!ensure()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur);
}

function tone(freq, dur, gain, type = 'sine', slideTo = null) {
  if (!ensure()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur);
}

export const sfx = {
  unlock() { ensure(); },
  toggleMute,
  isMuted() { return muted; },
  shot(w) {
    if (w === 'sniper') { noise(0.35, 900, 0.9, 'lowpass', 120); tone(90, 0.25, 0.5, 'sine', 40); }
    else if (w === 'rifle') { noise(0.16, 1400, 0.7, 'bandpass', 300); tone(140, 0.1, 0.35, 'square', 70); }
    else if (w === 'smg') { noise(0.09, 1800, 0.5, 'bandpass', 400); }
    else { noise(0.12, 1200, 0.55, 'bandpass', 350); }
  },
  dry() { tone(1800, 0.03, 0.12, 'square'); },
  reload() { tone(900, 0.04, 0.15, 'square'); setTimeout(() => tone(650, 0.04, 0.15, 'square'), 140); },
  hit(head) { tone(head ? 1900 : 1250, 0.06, 0.2, 'sine'); if (head) setTimeout(() => tone(2400, 0.08, 0.15, 'sine'), 60); },
  throwIt() { noise(0.12, 800, 0.25); },
  explosion() { noise(0.9, 500, 1, 'lowpass', 60); tone(60, 0.7, 0.7, 'sine', 28); },
  plant() { tone(880, 0.12, 0.25, 'sine'); setTimeout(() => tone(880, 0.12, 0.25, 'sine'), 160); setTimeout(() => tone(1320, 0.2, 0.25, 'sine'), 320); },
  beep() { tone(1100, 0.07, 0.18, 'sine'); },
  horn() { tone(392, 0.28, 0.25, 'triangle'); setTimeout(() => tone(523, 0.4, 0.25, 'triangle'), 220); },
  step() { noise(0.05, 300, 0.08, 'lowpass'); },
  click() { tone(1000, 0.03, 0.12, 'square'); },
};
