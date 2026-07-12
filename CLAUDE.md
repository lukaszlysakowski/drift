# Drift — Generative Plotter Art

## Project
A p5.js maker: particles drift through a curl-noise flow field, deposit density that bends the field (slowing + diverting the flow → channelization), run in waves until the field settles, and plot as ink streaklines with one darker-crimson main channel. "A field that transports its own history." Public repo: https://github.com/lukaszlysakowski/drift — live maker: https://lukaszlysakowski.github.io/drift/

## The engine (the load-bearing part)
- `rollField → runWaves → classifyPaths → renderAll`. Per wave (two-phase, FROZEN field): advect ALL particles, THEN splat all deposits, THEN smooth/normalize. Feedback is BETWEEN waves, never intra-wave (the user explicitly rejected per-step feedback).
- **Base field:** curl of a seeded value-noise potential ψ: `v_base = (∂ψ/∂y, −∂ψ/∂x)`, normalized to FLOW_SPEED. Divergence-free by construction → NO artificial sinks, so ALL pooling is genuinely from the feedback (testable: Channel=Off → v_bent == v_base → no channels).
- **Deposition:** particles bilinear-splat into a 300² grid; once per wave a single [1,2,1]/4 blur gives channels width; `D̂` = D / current max.
- **Bent field:** `v_bent = s·v_base + t·|v_base|` where slow `s = max(SLOW_FLOOR 0.15, 1 − SLOW·fb·d)` and divert `t = DIVERT·fb·d·rot90(unit ∇D̂)` (fb = [0,0.5,1][channel]). Divert gate is `|∇D̂| > 1e-6` (implements the spec's "≈0" against the FD-noise floor ~1e-9; real gradients are ~1e-4+ — do NOT tighten to 1e-9, it catches noise at symmetric density extrema).
- **Waves & settle:** RK2 midpoint, MAX_STEPS 400, STALL_EPS 0.4. Stop when `delta = Σ|Dₙ−Dₙ₋₁|/ΣDₙ < SETTLE_EPS 0.02` (only after wave 0) or the cap (Off/Light/Full = 1/6/14).

## Determinism
`Math.random` ONLY at seed choice + randomizeAll. Curl potential seeded from masterSeed; per-wave particle starts from `seededRng(masterSeed + w*9161)` (mulberry32, independent of p5 RNG); RK2 pure; wobble reseeds from `pts[0].x*0.01+50` IN RENDER ONLY (after classify — never perturbs the path set). Same seed → identical path set.

## THE COUNTERINTUITIVE PHYSICS (correct — do NOT "fix")
Channelization CONCENTRATES deposition, raising depMax. Since `depAt` normalizes by depMax, the normalized heavy-class FRACTION correctly FALLS under Strong feedback (few dense trunks + many thin tributaries = braiding). Two metrics are BOTH true and NOT a contradiction: raw-dep max/mean RISES Off→Strong (concentration); normalized heavy-fraction FALLS. This cost several fix cycles during the build — any test asserting "heavy fraction rises with Strong" is BACKWARDS.

## Rendering
- Path class: heavy if `meanD ≥ HEAVY_THRESH 0.28`, else light (two ink pen weights).
- **Red channel** (the trunk): argmax `meanD · bbox-diagonal` — dense AND spanning, so a curl trapped in one dense vortex can't beat a long channel that crosses the page. (Originally argmax total-density, which picked the trapped curl; retuned + prominence-boosted at user request.) Excluded from ink passes, drawn heavier.
- Color: channel is `#7C1328` (a DARKER CRIMSON — Drift is the ONE family piece that departs from the brick-red `#A93B2A`; user choice).

## Performance (real simulation — inherent)
Browser: default (Med/Light) ~6s, Med/Full (14 waves) ~14s. The Node vm-stub harness is ~20× slower — engine verify runtimes are 4–12 min (tasks 5/6/8). Base-field-grid-cache is a documented future speedup (would need engine re-verification since paths would shift).

## Data-model gotchas
- Field region = `[PAD, CS−PAD]²`; deposition grid maps that square to 300² cells; `depAt`/`depGrad` normalize by `state.depMax` (updated only at end-of-wave depNorm).
- Container div id is `canvas-container` (Interference/Fold CSS targets it).
- Exit vertices overshoot the region by up to one RK2 step (~6–11px with divert) — `advect` pushes one out-of-region vertex then breaks. Region tests use a symmetric ±35px tolerance.

## Lineage
- Advection + deposition feedback — the self-organizing-flow tradition (erosion channels, ant-trail stigmergy, dielectric breakdown) as pen streaklines.
- The most new-engine piece of the "abstract evolution of Field Script, no manual feedback loop" trio with [second-reading](https://github.com/lukaszlysakowski/second-reading) (homeostat to equilibrium) and [interference](https://github.com/lukaszlysakowski/interference) (self-tuning field).
- Siblings: [palimpsest](https://github.com/lukaszlysakowski/palimpsest) (CSS/a11y source), [core-samples](https://github.com/lukaszlysakowski/core-samples), [fold](https://github.com/lukaszlysakowski/fold), [watershed](https://github.com/lukaszlysakowski/watershed), [field-script](https://github.com/lukaszlysakowski/field-script)
- Design history + per-task review trail (including the full plan-bug fix saga): `docs/superpowers/` and `.superpowers/sdd/progress.md`

## Architecture
- `index.html` / `index.js` — single maker, no build step, p5 vendored; static serve (launch config `drift`, npx serve port 3464)

## Palette & A11y
Square 2170×2170. Paper #F7E6D4, ink #1A1613, channel #7C1328 (only red on the page). Sidebar CSS from Interference/Watershed (WCAG-tuned: --muted #969082, .ctrl min-height 24px) — Lighthouse a11y 100; don't regress.

## Controls
Field (Scale Fine/Med/Broad / Strength Low/Med/High) · Particles (Count Low/Med/High / Seeding Scattered/Edge/Clustered) · Feedback (Channel Off/Gentle/Strong) · Settle (Off/Light/Full) · Style (Wobble, default Off) · randomize / refresh / svg / png / png 4x · click canvas = new seed. randomize rerolls everything except Wobble. SVG pen passes: Border / Streaks-light / Streaks-heavy / Channel (crimson) / Signature.
