## Global Constraints

- Canvas `CS = 2170`, `PAD = Math.round(CS * 0.04)` (= 87). Field region = `[PAD, CS−PAD]²`. Paper `#F7E6D4`, ink `#1A1613` (rgb 26,22,19), red `#A93B2A`. Red appears ONLY in the Channel pass.
- Determinism contract: `Math.random` ONLY at seed choice (`regenerate(true)`) and `randomizeAll`. Everything downstream of `randomSeed(state.masterSeed)` is deterministic. Curl potential seeded from `masterSeed`; wave `w` particle starts use `seededRng(masterSeed + w*9161)` (mulberry32, independent of p5's RNG); wobble reseeds from `pts[0].x*0.01+50`; no other `Math.random`.
- Wobble parity: canvas and SVG both wobble via `wobblePts`, seeded from `pts[0].x * 0.01 + 50`. Default OFF.
- SVG pen passes, exact labels and weights: Border ink 0.9 · Streaks-light ink 0.4 · Streaks-heavy ink 0.8 · Channel red 1.1 · Signature ink 0.9. Paths are M/L-only.
- Signature: `Drift · seed N · <W> waves · <P> paths  YYYY-MM-DD HH:MM` (W = state.wavesRun, P = state.paths.length).
- A11y floor: sidebar CSS copied from Interference (`--muted: #969082`, `.ctrl` min-height 24px). Container div id `canvas-container`. Never regress Lighthouse a11y 100.
- Read-only sources (NEVER modify): `/Users/lukasz/genuary-2026/sketches/interference/*`, `/Users/lukasz/genuary-2026/sketches/watershed/*`.
- Timeout-resilience protocol (controller + implementers): incremental commits after each step; write `.superpowers/sdd/task-N-report.md` EARLY (create at task start, update as you go). Controller: detect limit-killed subagents (tiny result / "session limit"), salvage from git + working tree, CONTROLLER INLINE fallback with ledger attribution, final review by a fresh independent subagent.
- Controller note: after Task 1, add launch config `drift` (npx serve `/Users/lukasz/genuary-2026/sketches/drift` --listen 3464, port 3464) to `/Users/lukasz/claude/self-redaction/.claude/launch.json` — controller does this inline; implementers never touch files outside the repo.

---
