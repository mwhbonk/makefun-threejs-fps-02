// DUSTLINE palette — one dusk freight-yard palette, six core colours.
// Attackers Kestrel read amber, defenders Halcyon read slate teal, so the
// scene parses at a glance even in a still screenshot.

export const PALETTE = {
  sand: 0xc9a86a,      // ground, sun-baked
  sandDark: 0x8a6f45,  // ground shadow tone
  rust: 0xd97b2f,      // accents, site strips, crane
  amber: 0xf5a623,     // Kestrel team
  teal: 0x2fa8a0,      // Halcyon team
  slate: 0x3a4a55,     // defender cloth / dark metal
  wall: 0x6b5d4f,      // concrete walls
  containerA: 0x7a4a2b,// rust containers
  containerB: 0x2f6b6b,// teal containers
  crate: 0x9a7b4f,     // wooden crates
  tank: 0x8a8f96,      // steel tanks
  sky: 0x2b3a4a,       // dusk sky / fog
  sun: 0xffb36b,       // low warm sun
};

// Shade a hex colour by factor f (f < 1 darkens, f > 1 lightens).
export function shade(hex, f) {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * f)));
  return (r << 16) | (g << 8) | b;
}
