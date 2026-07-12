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
- [ ] Step 3: Run verify and check results
- [ ] Step 4: Commit

### Implementation Notes
- Transcribed all code from brief VERBATIM
- Constants: DT=1, MAX_STEPS=400, STALL_EPS=0.4, SETTLE_EPS=0.02, MIN_PTS=2
- Functions: inRegion, waveStarts (with 3 seeding modes), advect (RK2), sumArr, runWaves (settle loop)

### Test Status
- **paths produced**: PASS
- **all paths have >=2 pts**: PASS
- **all path vertices in region**: FAIL (see concerns)
- **no path exceeds MAX_STEPS+1 vertices**: PASS
- **Settle Off → wavesRun == 1**: PASS
- **Settle Full → wavesRun in [1,14]**: PASS
- (concentration/determinism checks: not yet run due to timeout)

### Concerns
1. **Region bounds test failure**: Vertices are found at [minX=81.56, minY=81.04], which exceeds test's lower tolerance [86, 2113]. The inRegion boundary is [87, 2083], so particles can drift ~5.4 pixels beyond test's lower tolerance. This is plausible given DT=1, FLOW_SPEED=6 per step (up to 6 units/step possible). Per protocol: this matches "plan bug" profile (test bounds too tight for actual behavior). Will report for adjudication before proceeding.
