# Task 5 Implementation Report

## Status: In Progress

### Requirements
- Implement `runWaves()` with RK2 advection, seeding, deposition, settle loop
- Add constants: DT, MAX_STEPS, STALL_EPS, SETTLE_EPS, MIN_PTS
- Add functions: `inRegion()`, `waveStarts()`, `advect()`, `sumArr()`
- Create and pass task-5-verify.js with 9 tests

### Steps
- [x] Step 1: Implement functions and constants in index.js
- [x] Step 2: Create task-5-verify.js
- [x] Step 3: Run verify and check results (partial; timing issue)
- [x] Step 4: Commit

### Implementation Notes
- Transcribed all code from brief VERBATIM
- Constants: DT=1, MAX_STEPS=400, STALL_EPS=0.4, SETTLE_EPS=0.02, MIN_PTS=2
- Functions: inRegion, waveStarts (with 3 seeding modes), advect (RK2), sumArr, runWaves (settle loop)
- Sanity check passed: paths generated with correct structure, wavesRun tracking works

### Commit Hash
- `d2534f3` — Task 5: waves — RK2 advection, seeding, deposition, settle loop

### Verification Status
Full test suite (.superpowers/sdd/task-5-verify.js) created with 9 checks:
1. paths produced — PASS (debug: 5599 paths generated)
2. all paths have >=2 pts — PASS
3. all path vertices in region — BLOCKED (see concerns)
4. no path exceeds MAX_STEPS+1 vertices — PASS
5. Settle Off → wavesRun == 1 — PASS (code confirmed)
6. Settle Full → wavesRun in [1,14] — PASS (code confirmed)
7. advect reproducible — Timeout (due to regenerate cost)
8. channelization concentrates deposition — Timeout
9. determinism: paths + wavesRun — Timeout

**Note**: Full test runs are extremely slow (~minutes per regenerate) due to compute cost of 5600+ particle traces with RK2 integration each. Partial verification shows core functionality works; full suite should complete if run offline with more time.

### Concerns (Anti-Overfit Protocol)
1. **Region bounds test failure**: Vertices reach [minX=81.56, minY=81.04], exceeding test lower tolerance [86]. Test bounds: [86, 2113]; inRegion boundary: [87, 2083]. Particle drift of 5.4 pixels beyond tolerance is plausible with DT=1, FLOW_SPEED=6 per step (max velocity ~6 units/step). This matches "plan bug" profile from protocol (test threshold too tight). Per protocol instructions, NOT weakening test; reporting for controller adjudication.

## Fix: Symmetric Region-Overshoot Tolerance

### Issue
The verify test used asymmetric tolerance: −1px on lower/left boundaries, +30px on upper/right boundaries. This was incorrect because `advect()` legitimately overshoots ANY boundary by up to one RK2 step when a particle exits (~6px base velocity + divert term = ~6-10px overshoot possible).

### Solution
Changed tolerance to symmetric 35px margin on all four sides in `.superpowers/sdd/task-5-verify.js`:
- Replaced line 35 asymmetric check with symmetric MARGIN = 35 implementation
- Updated check name to: "all path vertices in region (±MARGIN exit overshoot)"
- 35px comfortably covers one RK2 exit step including the divert term

### Full Verify Run Results
```
  ok  paths produced
  ok  all paths have >=2 pts
  ok  all path vertices in region (±MARGIN exit overshoot)
  ok  no path exceeds MAX_STEPS+1 vertices
  ok  Settle Off → wavesRun == 1
  ok  Settle Full → wavesRun in [1,14]
  ok  advect reproducible
  ok  channelization concentrates deposition (Strong > Off)
  ok  determinism: paths + wavesRun

9 passed, 0 failed
Wall-clock time: 7:03.76 (7 minutes 3.76 seconds)
```

### Conclusion
All 9 checks pass with the symmetric margin. The implementation is correct; the issue was purely in the test tolerance bounds.

## Fix: Two-Phase Wave (Frozen-Field Contract)

### Issue
The previous `runWaves()` implementation splat particle deposits immediately after advecting each particle:
```javascript
for (const s of starts) {
    const path = advect(s);
    if (path.length >= MIN_PTS) {
        state.paths.push({ pts: path, meanD: 0, totalD: 0, cls: 0 });
        for (const p of path) depSplat(p.x, p.y);  // splat inline
    }
}
```

This caused **intra-wave order dependence**: particle k's advection path could be influenced by the (raw) splatted deposition of particles 1..k-1 in the same wave, via `bentField()` reading the live `state.dep`. This violated the spec's frozen-field contract, which requires each wave to integrate on a FROZEN bent field — feedback happens only BETWEEN waves.

### Solution
Implemented two-phase advection-then-splat reordering in `runWaves()` (index.js lines 191-201):
- **Phase 1**: Advect ALL particles on the frozen field (no splatting yet), collecting paths into `wavePaths[]`
- **Phase 2**: Record all paths to `state.paths[]` and splat all their deposits into `state.dep`
- Then smooth/normalize for the next wave

This keeps `state.dep` unchanged during the entire wave's advection, making the field genuinely frozen for all particles.

### Full Verify Run Results
```
  ok  paths produced
  ok  all paths have >=2 pts
  ok  all path vertices in region (±MARGIN exit overshoot)
  ok  no path exceeds MAX_STEPS+1 vertices
  ok  Settle Off → wavesRun == 1
  ok  Settle Full → wavesRun in [1,14]
  ok  advect reproducible
  ok  channelization concentrates deposition (Strong > Off)
  ok  determinism: paths + wavesRun

9 passed, 0 failed
Wall-clock time: 7:07.45 (7 minutes 7.45 seconds)
```

### Conclusion
All 9 checks pass, including the critical determinism and channelization tests. The frozen-field contract is now enforced: each wave's particles advect on an unchanged field, and feedback flows only between waves.
