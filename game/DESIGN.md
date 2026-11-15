# DUSTLINE — design notes

DUSTLINE is a round-based 5v5 tactical FPS in three.js. Kestrel attacks,
Halcyon defends. Plant the Spike at A or B, or eliminate the other team.
First to 5 rounds wins, at most 9 rounds. The whole game is one state store
(`G` in `main.js`); the sim runs at a fixed 60 Hz, apart from rendering.

## Map — Kestrel Yard (36 x 28 m)

An original dusk freight depot. Brick perimeter walls, paving-tile yard,
corrugated containers stencilled with fleet marks, plank crates, a brick
chimney with a glowing band, pipes along the north wall, bunting strung
across mid, name boards (CRANE YARD / TANK FARM) and big painted site
letters on the side walls. The sky is a gradient dome with a low sun disc,
a glow, and drifting dusk clouds.

Callouts the HUD and the radio use:

- **A — CRANE YARD** (west, -13,-9): crane legs and beam, chimney, site ring.
- **B — TANK FARM** (east, 13,-9): two fuel tanks, site ring.
- **MID LANE** (centre): container cover, bunting, sandbags at the entries.
- **HALCYON HOLD** (north centre): the defenders' ground between the sites.
- **KESTREL SPAWN** (south, z > 10): where attackers start every round.
- **WEST / EAST YARD**: the flanks along the side walls.

Lanes are deliberate: a long mid sightline, tight A/B entries, and cover
crates so no lane is a shooting gallery. Bots move on a 20-node waypoint
graph with BFS paths; links are built only where the segment is clear of
colliders.

## Economy

Start $800. Kill +$300, plant +$300, round win +$3250, loss +$1900
(+$500 per loss streak, capped at $3400). Weapons stay with you only if
you survive the round; death loses guns, kevlar and helmet.

| Item | Price | Notes |
| --- | --- | --- |
| P9 SIDEARM | free | 28 dmg, 12/36 |
| HORNET SMG | $1500 | 26 dmg, 800 rpm, 30/120 |
| VKR-7 RIFLE | $2700 | 34 dmg, 600 rpm, 30/90 |
| LONGBOW DMR | $4750 | 110 dmg, scope, 5/15 |
| SPARK HE GRENADE | $300 | blast up to 7 m, max 2 |
| SMOKE GRENADE | $300 | 15 s cloud, blocks sight, max 2 |
| KEVLAR VEST | $650 | body armour 100 |
| HELMET | $350 | headshots capped at x2 |

Buy phase is 20 s (B opens the shop, keys 1–8). The shop is a three-column
requisition board — weapons with damage / RPM / magazine, gear, grenades —
with Owned and Too expensive states.

## Gunplay

Hitscan with a head/body split. Spread grows with movement, being airborne
and bloom, and shrinks when crouched or standing still; the crosshair gap
mirrors live spread. Recoil kicks the view. Shift walks, Ctrl crouches,
Space jumps. A helmet caps headshot damage at x2. Armour absorbs 25% of
damage and drains as it does.

## Bots

Five states: hold a site, push a lane, investigate a heard shot (within
25 m), engage (line of sight under 48 m, burst fire, distance-scaled aim
error, 0.25–0.55 s reaction), and objective work — plant the Spike,
fetch a dropped Spike, converge to defuse, or flee a grenade. Bots radio
callouts ("contact at mid lane", "holding B, need one mid", "smoke going
down mid") and the radio feed, killfeed and minimap show the same
information the player sees: spotted enemies are red dots for 4 s,
teammates are amber, the player is a white arrow.

## Rounds

Buy (20 s) → live (100 s) → end. Plant takes 3.5 s holding E, detonation
35 s, defuse 5 s. A dropped Spike can be picked up by walking over it.
Time expiry without a plant favours the defenders. The top bar shows the
score, alive pips per team, the timer, ROUND n OF 9 and the side; the plan
line under it reads the round's call ("PLAN: SPLIT A — YOU: ENTRY").

## Controls

WASD move · mouse look · click shoot · R reload · Shift walk · Ctrl crouch
· Space jump · E plant / defuse (hold) · B buy menu · G HE grenade ·
H smoke grenade · wheel switch weapon · M mute.
