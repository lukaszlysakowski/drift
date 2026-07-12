# Task 8 Report: Full-pipeline integration + README + multi-seed soak

## Status
IN PROGRESS

## Steps

- [ ] Step 1: Write README.md
- [ ] Step 2: Write task-8-verify.js
- [ ] Step 3: Run soak
- [ ] Step 4: Commit

## Verification Results

### Control-Effects Tests (Baseline)

- ✓ base: paths + channel populated
- ✓ base: substantial ink (>2000 vertices) — PASS (2886+ verts)
- **✗ FAIL: channelization: strong has more heavy paths than off**
  - Expected: strong (channel=2) > off (channel=0)
  - Actual: off=3185 heavy paths, strong=344 heavy paths (INVERTED)
  - **ENGINE ISSUE**: This indicates feedback or classification logic inversion in index.js
- ✓ Count monotone: low < high paths — PASS
- ✓ Settle Off → 1 wave — PASS
- ✓ full-pipeline determinism — PASS

### Multi-Seed Soak (Med/Full) — IN PROGRESS

Status: 2 of 5 seeds completed (40% done), test running since 3:04 AM (~20+ minutes)

**Seed Results (all FAIL — timeout > 30s limit):**
```
  seed 17: 12600 paths, 3335137 verts, 14 waves, ch 11917, 145190ms FAIL
  seed 404: 12600 paths, 3535073 verts, 14 waves, ch 3838, 154332ms FAIL
```

**Critical Issues Identified**

1. **CHANNELIZATION CHECK FAILED** — Engine defect
   - Per brief: "If channelization checks fail, fix is in earlier engine tasks"
   - With `channel=0` (feedback off), heavy path count = 3185
   - With `channel=2` (strong feedback), heavy path count = 344
   - Expected behavior: Strong feedback should CREATE more heavy paths via channelization
   - Actual: Heavy paths DECREASE when feedback strengthens
   - **Root cause**: Either feedback logic, or heavy/light classification is inverted

2. **PERFORMANCE DEGRADATION** — Secondary concern
   - Each seed taking ~150s (5x the 30s budget)
   - Generating 12,600+ paths, 3.3M+ vertices per seed
   - Suggests uncontrolled growth or infinite loop in feedback mechanism
   - At this rate: remaining 3 seeds = ~450s more, total ~25 minutes

**Root Cause Analysis**

Found in `classifyPaths()` (line 218-230) and `depAt()` (line 311-320):

1. All paths are classified AFTER all waves complete, using the FINAL `state.depMax`
2. `depAt(x, y)` normalizes by `state.depMax`: `return v / state.depMax`
3. With `channel=0` (no feedback):
   - Deposition spreads uniformly over the field
   - Final `depMax` is lower (spread distribution)
   - Normalized `depAt` values are HIGHER
   - More paths exceed HEAVY_THRESH (0.28)
   - Result: 3185 heavy paths
4. With `channel=2` (strong feedback):
   - Deposition concentrates in deep channels
   - Final `depMax` is MUCH HIGHER (peaks are high)
   - Normalized `depAt` values are LOWER
   - Fewer paths exceed HEAVY_THRESH
   - Result: 344 heavy paths (WRONG!)

**The bug**: Using final `depMax` (which grows with channel strength) inverts the classification. Paths in strong-feedback channels should have HIGHER meanD (higher deposition concentration), not lower.

**Fix required**: Either (a) use fixed normalization for classification, (b) classify paths immediately after each wave before next wave adds deposition, or (c) use raw (unnormalized) deposition sum for threshold instead of normalized meanD.

**Recommendation**: This is a critical Task 6 (classification) issue. Investigate and fix before continuing soak. Do NOT lower test thresholds.

