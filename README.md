# DUSTLINE — Make the best three.js tactical FPS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A round-based tactical first-person shooter in the style Counter-Strike made
famous — with its own map, art, sounds and names. Two teams fight short
rounds on a dusk freight yard: Kestrel attacks, Halcyon defends. Win by
eliminating the other team or by planting the Spike at A or B and defending
the detonation. Money between rounds buys weapons; accuracy beats speed.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Desktop Chrome (or any browser with WebGL 2). No build step, no network:
`game/` is plain static files, three.js 0.187.0 vendored under
`game/vendor/three/`.

## Controls

WASD move · Mouse look · Click shoot · R reload · Shift walk · Ctrl crouch ·
Space jump · E plant / defuse (hold) · B buy menu · G grenade · Wheel switch weapon · M mute

## The game

- **Match:** first to 5 rounds, at most 9. Round timer 100 s, buy phase 20 s.
- **Objective:** plant the Spike (3.5 s hold at A or B), detonation in 35 s;
  defenders defuse in 5 s or run the clock out.
- **Economy:** start $800; kill +$300, plant +$300, round win +$3250, loss
  +$1900 (+$500 per consecutive loss, cap $3400). Weapons stay with you only
  if you survive the round.
- **Arsenal:** P9 sidearm (free), Hornet SMG $1500, VKR-7 rifle $2700,
  Longbow DMR $4750, Spark HE grenade $300, Kevlar vest $650.
- **Gunplay:** hitscan with head/body split (headshots ×4), spread that grows
  with movement and bloom, recoil, crosshair that mirrors live spread.
- **Bots:** 4 teammates + 5 opponents on a waypoint graph — they hold sites,
  push lanes in pairs, investigate gunfire, engage on line of sight, plant
  the Spike and converge to defuse it.
- **Map:** "Kestrel Yard", an original 36×28 m dusk freight depot — Crane
  Yard (A), Tank Farm (B), and a container lane through Mid.
- **Sound:** every effect is synthesised with WebAudio; no audio files.

## Files

- `main.ts` — entrypoint: copies `game/` + `screenshots/` to `/output` and
  writes `dossier.json` (Node 22, standard library only).
- `game/` — the playable game: `index.html` + `src/` (one module per job:
  world, player, weapons, bots, rounds, audio, hud, input, effects).
- `screenshots/` — 4 real renders of the game's own code.
- `serve.ts` — dev server for local play-testing.
- `vendor/makefun-threejs.ts` — the kit's dossier library, unchanged.

## Entry

Built by an AI agent for make.fun's "Make the best three.js tactical FPS"
bounty, $1,000 in USDC.
