# Drift

A curl-noise field that transports its own history. Particles drift downstream, each
leaving its full trajectory as a streakline; where they pass they deposit density, and that
density bends the field — high-deposition ground slows the flow and steers new particles
along it, so trails deepen into channels and later particles braid into river-like bundles.
The flow carves its own bed.

The system runs itself to stillness: particles are released in waves, each wave depositing
and re-bending the field, until the wave-to-wave deposition delta falls below a threshold
(the channels have stabilized) or a wave cap is hit — then it plots. No rating loop; it
settles on its own. One red line: the main channel — the single highest-deposition
streakline, the trunk the flow carved.

## Running

Static files, no build step: serve the directory (`npx serve . --listen 3464`) and open
`index.html`.

**Performance.** Drift runs a real advection+deposition simulation, so generation is
compute-heavy: in the browser a default render (Med count, Light settle) takes ~6s; the
heaviest setting (Med count, Full settle, 14 waves) ~14s. Lower Count or Settle for faster
iteration.

## Controls

- **Field** — Scale (Fine/Med/Broad noise feature size) · Strength (flow speed of the curl field)
- **Particles** — Count (Low/Med/High) · Seeding (Scattered/Edge/Clustered release points)
- **Feedback** — Channel (Off/Gentle/Strong — how strongly deposits slow + divert the flow)
- **Settle** — Off/Light/Full (wave cap 1/6/14; stops early when the field stops changing)
- **Style** — Wobble (default Off)
- randomize / refresh / svg / png / png 4x · click canvas = new seed

randomize rerolls every control except Wobble with a new seed.

## How it works

- **Base field:** curl of a seeded value-noise potential — divergence-free, so nothing pools
  artificially; all channeling comes from the feedback.
- **Feedback:** each particle stamps density into a 300² grid; the bent field slows flow in
  dense ground (clamped to a floor) and steers along the density contour, following trails.
- **Waves & settle:** per wave, freeze the bent field, integrate all particles with RK2, stamp
  deposits, then rebuild the field; stop when the deposition delta settles or the cap is hit.
- **Channel=Off** yields pure curl-noise streaklines (no channelization) — the honest baseline.

## Exports

Layered SVG pen passes (Border / Streaks-light / Streaks-heavy / Channel / Signature) for
multi-pen plotting; PNG at 1x (2170²) and 4x (8680²).

## Family

[palimpsest](https://github.com/lukaszlysakowski/palimpsest) ·
[core-samples](https://github.com/lukaszlysakowski/core-samples) ·
[second-reading](https://github.com/lukaszlysakowski/second-reading) ·
[fold](https://github.com/lukaszlysakowski/fold) ·
[watershed](https://github.com/lukaszlysakowski/watershed) ·
[interference](https://github.com/lukaszlysakowski/interference) ·
[field-script](https://github.com/lukaszlysakowski/field-script)
