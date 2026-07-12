# Task 8 Report: Full-pipeline integration + README + multi-seed soak

## Status
CRITICAL FAILURE — engine issue detected, soak in progress (3/5 seeds)

## Completion Checklist

- [x] Step 1: Write README.md
- [x] Step 2: Write task-8-verify.js  
- [~] Step 3: Run soak (3/5 seeds done, timing out due to engine defect)
- [x] Step 4: Commit (incremental)

## Verification Results

### Control-Effects Tests (Baseline): 6/7 PASS, 1 FAIL

```
✓ base: paths + channel populated
✓ base: substantial ink (>2000 vertices) — 2886 verts
✗ FAIL channelization: strong has more heavy paths than off — off 3185 vs strong 344
✓ Count monotone: low < high paths — 12600 vs 12600
✓ Settle Off → 1 wave — 1 wave
✓ full-pipeline determinism — PASS
```

### Multi-Seed Soak (Med/Full): 3/5 seeds completed

**Test started:** ~3:04 AM  
**Current runtime:** ~16 minutes (expected ~15-20 total)  
**All 5 seeds FAIL timeout**: each seed taking 130-155s (4.3-5.1x the 30s budget)

**Completed Seed Results:**
```
  seed 17:     12600 paths, 3335137 verts, 14 waves, ch 11917, 145190ms FAIL
  seed 404:    12600 paths, 3535073 verts, 14 waves, ch 3838,  154332ms FAIL
  seed 9090:   12600 paths, 3073694 verts, 14 waves, ch 1009,  134512ms FAIL
  (seeds 123456 and 777777 pending)
```

Consistent pattern: All seeds hit full wave cap (14 waves), generate 12,600 identical paths, 3M+ vertices.

---

## Critical Finding: Channelization Test FAILED

**The bug** (found in classifyPaths / depAt logic):

1. All paths classified AFTER all waves, using FINAL `state.depMax`
2. `depAt()` normalizes: `return v / state.depMax`  
3. **With channel=0 (OFF):**
   - Deposition spreads uniformly across field
   - Final `depMax` is lower
   - Normalized depAt values are HIGHER
   - MORE paths exceed threshold HEAVY_THRESH=0.28
   - Result: **3185 heavy paths** ✓ Spread pattern
4. **With channel=2 (STRONG):**
   - Deposition concentrates in deep channels
   - Final `depMax` is MUCH HIGHER (peaks in channels)
   - Normalized depAt values are MUCH LOWER
   - FEWER paths exceed threshold
   - Result: **344 heavy paths** ✗ Expected MORE!

**The inversion:** Using final `depMax` (which scales with feedback strength) inverts the expected heavy-path classification. Channels with strongest deposition get LOWEST meanD because depMax is highest.

**Root Cause:** Line 319 in index.js:
```javascript
return v / state.depMax;  // using FINAL max, not wave-specific max
```

**Fix required** (choose one):
- (A) Classify paths immediately after each wave (before next wave adds more deposition)
- (B) Use fixed/initial normalization constant instead of final depMax
- (C) Use raw (unnormalized) totalD for HEAVY_THRESH instead of meanD

**Status**: This is a **Task 6 issue** (path classification), not a test threshold problem. Do NOT weaken the assertion.

---

## Secondary Finding: Performance Degradation

Each seed at Med count / Full settle running 14 waves (hitting cap):
- Expected: settle to <6 waves when delta < 0.02
- Actual: ALL seeds hit wave cap (14), no early stop
- Time per seed: 130-155s (4.3-5.1x budget)
- Vertices per seed: 3M+ (possible excessive growth)

Suggests settle detection may not be working, or delta threshold is not tight enough.

---

## Commits

```
ce24d26 Task 8: README + full-pipeline integration + multi-seed soak (in progress, channelization issue detected)
1f19209 Task 8: Add root cause analysis of channelization failure
```

---

## Recommendation

**STOP soak, fix engine issue first:**
1. Investigate `classifyPaths()` normalization in Task 6 context
2. Fix depMax usage in `depAt()` or move classification earlier
3. Re-verify channelization test passes
4. Check settle delta logic (why no early stop at wave 6/14?)
5. Resume soak

Do NOT lower HEAVY_THRESH or ignore the failure.

