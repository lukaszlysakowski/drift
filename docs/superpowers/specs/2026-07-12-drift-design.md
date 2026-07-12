# Drift — Design Spec (2026-07-12)

## Concept

**Drift — a field that transports its own history.** Particles are released into a
curl-noise flow field and drift downstream, each leaving its full trajectory as one
continuous streakline. Where they pass, they deposit density into a grid — and that density
bends the field: high-deposition ground *slows* the flow and *steers* new particles along
it, so trails deepen into channels and later particles follow earlier ones, braiding into
river-like bundles. The flow carves its own bed. The page is thousands of overlapping
streaklines: thin and straight where flow is fast, curling and dense where material has
pooled into channels.

The system runs itself to stillness: particles are released in waves, each wave depositing
and re-bending the field, until the wave-to-wave deposition delta falls below a threshold
(channels stabilized) or a wave cap is hit — then it plots. No rating loop; it settles on
its own, Second Reading's convergence philosophy applied to flow. One red line: the main
channel — the single highest-deposition streakline, the trunk the flow carved. Square
2170×2170. Reads as smoke, current, sediment plumes, erosion channels.

Decisions made during brainstorming (user-approved):
- **What plots:** streaklines — the full particle trajectories.
- **Base field:** curl noise (divergence-free — all pooling is genuinely from feedback).
- **Feedback rule:** deposits slow + divert (channelize into braided highways).
- **Red:** the main channel (highest-deposition streakline).
- **Termination:** settle to equilibrium (deposition delta below threshold, or wave cap).
- **Integrator:** per-wave RK2 midpoint on a frozen field (feedback between waves).
- **Format:** square 2170×2170.
- **Scope:** full family maker, local git repo first; GitHub publish only when asked.

## Page & livery

- Canvas 2170×2170 (`CS = 2170`), `PAD = round(CS·0.04)` (= 87).
- Paper `#F7E6D4`, ink `#1A1613`, channel `#7C1328` (a darker crimson — the main channel is
  the ONLY red; deeper than the family brick-red `#A93B2A`).
- Border rectangle at PAD; signature bottom-left inside border:
  `Drift · seed N · <W> waves · <P> paths  YYYY-MM-DD HH:MM` (W = waves run, P = total paths).
- House idiom: single `index.html` + `index.js`, vendored `p5.min.js`, no build step.
- Sidebar CSS copied from Interference/Watershed (a11y floor: `--muted #969082`,
  `.ctrl min-height 24px`; Lighthouse a11y 100 — never regress). Container div id
  `canvas-container`.

## Engine

All work happens in a page-coordinate square `field region = [PAD, CS−PAD]²`. Particle
positions are page coordinates; the deposition grid maps that square to `DEP_N²` cells.

### Base flow field (curl noise)

Seeded Perlin potential `ψ(x, y)` (self-contained value-noise, 2 octaves, so canvas and
Node harness agree). Curl in 2D:

```
v_base(x, y) = ( ∂ψ/∂y , −∂ψ/∂x )   (finite differences, step h ≈ 1.5 px)
```

Divergence-free by construction (no sinks/sources). Per-seed rolls: noise scale
(`Field Scale` Fine/Med/Broad → smaller/larger feature size), octave weighting, overall
strength `FLOW` (`Field Strength` control scales it). Normalize `v_base` to a target
per-step speed so integration step size is well-controlled.

### Deposition grid

`DEP_N = 300` accumulator `D` (Float32Array, independent of render resolution). A particle
at page point p stamps `DEP_AMOUNT` into `D` via bilinear splat (4 neighboring cells).
Once per wave, `D` is smoothed by a separable 3-tap blur (spreads deposits so channels have
width, not single-cell aliasing). `D̂` = `D` normalized to [0,1] by its current max.

### Bent field (recomputed once per wave from D̂)

At page point p with normalized density `d = D̂(p)` and density gradient `g = ∇D̂(p)`
(central differences on the grid):

- **Slow:** `s = 1 − SLOW · d`, clamped to `[SLOW_FLOOR, 1]` (SLOW_FLOOR ≈ 0.15 so flow
  never fully stops).
- **Divert:** steering along the contour (perpendicular to g), signed to follow trails:
  `t = DIVERT · d · rot90(ĝ)` where `rot90((a,b)) = (−b, a)` and `ĝ` is the unit gradient
  (zero if |g| ≈ 0).
- `v_bent(p) = s · v_base(p) + t · |v_base(p)|`.

`SLOW` and `DIVERT` are scaled together by the Feedback (Channel) control:
Off → 0 (pure curl noise, no channelization), Gentle → mid, Strong → full.

### Waves & integration

Each wave `w`:
1. Freeze `v_bent` (built from the current `D̂`).
2. Release `P` particles (`Particle Count` Low/Med/High → e.g. 400/900/1600) from seeded
   start points. Seeding (control): Scattered (uniform over the square), Edge (along one
   rolled border), Clustered (a few rolled Gaussian blobs). Starts drawn from
   `seededRng(masterSeed + w·9161)`.
3. Integrate each particle with **RK2 midpoint** steps (`k1 = v_bent(p)`,
   `k2 = v_bent(p + 0.5·dt·k1)`, `p += dt·k2`), up to `MAX_STEPS` (≈ 400). Terminate a path
   when it leaves the field region, stalls (`|v| < STALL_EPS`), or hits the step cap.
4. Record each path (page-coord polyline, ≥ 2 vertices) into `state.paths`; stamp its
   vertices' deposits into `D`.
5. Smooth `D`; rebuild `D̂`.

### Settle to equilibrium

After each wave, `delta = Σ|Dₙ − Dₙ₋₁| / max(ΣDₙ, ε)`. Stop when `delta < SETTLE_EPS`
(≈ 0.02) or `w == MAX_WAVES`. Settle control caps waves: Off = 1, Light = 6, Full = 14.
All streaklines from all waves are retained for plotting. `state.wavesRun` records the
count for the signature.

### Determinism

`Math.random` ONLY at seed choice + `randomizeAll`. Curl potential seeded from `masterSeed`;
each wave's particle starts + any jitter from `seededRng(masterSeed + w·9161)` (mulberry32,
independent of p5's RNG). RK2 is pure. Same seed → identical settled path set. Wobble
reseeds from `pts[0].x·0.01+50` in both renderers.

## Rendering & export

- **Streakline class:** for each path compute mean traversed density
  `m = mean(D̂(vertexᵢ))`; class **heavy** if `m ≥ HEAVY_THRESH`, else **light**.
- **Red channel:** the trunk the flow carved — the single path with the highest
  `meanD · bbox-diagonal` (dense AND spanning, so a curl trapped in one dense vortex can't
  win over a long channel that actually crosses the page). Re-inked red at heavier weight;
  excluded from the ink passes.
- Draw order (back→front): paper → streaks-light → streaks-heavy → red channel → border →
  signature.

SVG pen passes via family `svgPass(label, color, weight, paths)` — M/L-only paths:

| Pass          | Color | Weight |
|---------------|-------|--------|
| Border        | ink   | 0.9    |
| Streaks-light | ink   | 0.4    |
| Streaks-heavy | ink   | 0.8    |
| Channel       | red   | 1.7    |
| Signature     | ink   | 0.9    |

- Canvas/SVG parity: identical geometry arrays feed both renderers.
- Wobble (Style control, default OFF): seeded from `pts[0].x·0.01+50` in BOTH renderers.
- Exports: SVG, PNG, PNG 4x (8680²) via `exportPNG(scale)` pixelDensity re-render
  (ported from Interference).

## Maker UI

Family sidebar (cycleCtrl / CONTROL_DEFS / setupControls / randomizeAll):

- **Field:** Scale (Fine/Med/Broad) · Strength (Low/Med/High)
- **Particles:** Count (Low/Med/High) · Seeding (Scattered/Edge/Clustered)
- **Feedback:** Channel (Off/Gentle/Strong, default Gentle)
- **Settle:** Settle (Off/Light/Full, default Light)
- **Style:** Wobble (On/Off, default Off)
- Buttons: randomize / refresh / svg / png / png 4x.
- Click canvas = new seed, same params. Randomize = reroll aesthetic controls + new seed
  (Wobble left as set, per family convention). Refresh = new seed, same params.
- No rating/learning system.

## Testing

Node harness: `.superpowers/sdd/p5-stub.js` (seeded splitmix32) + `vm.runInContext` of the
real `index.js` with localStorage/fetch/document/confirm shims (ported from
interference/.superpowers/sdd/). Per-task verify scripts assert at minimum:

1. Curl field: `∇·v_base ≈ 0` (finite-difference divergence below tolerance across sampled
   points); `v_base` seed-deterministic; Field Scale control changes feature size.
2. Deposition: bilinear splat conserves stamped mass (Σ over 4 cells = DEP_AMOUNT);
   normalization `D̂ ∈ [0,1]`.
3. Bent field: at zero density `v_bent == v_base`; SLOW reduces speed where d > 0 (never
   below floor); Feedback=Off → v_bent == v_base everywhere.
4. Integration: RK2 path reproducible for a fixed frozen field + start; paths terminate
   (leave region / stall / step cap) — no infinite paths; all paths have ≥ 2 vertices.
5. Settle: `delta` computed correctly; loop stops at delta < SETTLE_EPS or MAX_WAVES;
   Settle control caps wavesRun (Off=1); channelization concentrates the RAW deposition field
   (max/mean rises as Channel goes Off→Strong — verified in the wave-engine test); the
   red-channel path stays heavy-classified; the heavy FRACTION of paths falls under Strong
   because concentration raises the normalization max, which is expected and not a defect.
6. Red channel: equals the argmax-total-traversed-density path; is a single path; excluded
   from ink passes.
7. Determinism: same seed twice → deep-equal path set + wavesRun.
8. Export: SVG contains exactly the 5 passes, M/L-only path data, red appears only in the
   Channel pass; signature format correct.
9. Multi-seed soak at Med/Full: 5 seeds produce non-empty path sets within a time bound.

Build process: subagent-driven development with the timeout-resilience protocol in the
ledger (incremental commits, early report files, controller-inline fallback with
attribution, fresh independent final review — the Fold/Watershed/Interference protocol).

## Infrastructure

- New git repo at `/Users/lukasz/genuary-2026/sketches/drift`.
- Launch config `drift`: `npx serve <dir> --listen 3464`, port 3464, added to
  `/Users/lukasz/claude/self-redaction/.claude/launch.json`.
- Read-only sources (never modify): `~/genuary-2026/sketches/interference/*` (harness +
  CSS + export/wobble kit lineage), `~/genuary-2026/sketches/watershed/*`.
- GitHub publish deferred until the user asks.

## Lineage

Advection + deposition feedback — the self-organizing-flow tradition (erosion channels,
ant-trail stigmergy, dielectric breakdown) rendered as pen streaklines. The most
new-engine piece of the "abstract evolution of Field Script, no manual feedback loop" trio
with [[second-reading-project]] (self-regulation to equilibrium) and
[[interference-project]] (self-tuning field). Family: palimpsest, core-samples,
second-reading, fold, watershed, interference, field-script.
