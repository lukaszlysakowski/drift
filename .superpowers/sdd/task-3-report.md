# Task 3: Deposition Grid — Splat, Smooth, Normalize, Sample, Gradient

## Status: COMPLETE

### Implementation

**Step 1: Add functions to index.js**
- Added `DEP_AMOUNT = 1` constant
- Added `pageToGrid(x, y)` — convert page coords to grid coordinates [0, DEP_N]
- Added `depReset()` — allocate Float32Array(DEP_N²) and set depMax = 1
- Added `depSplat(x, y)` — bilinear-add DEP_AMOUNT to 4 cells around page point
- Added `depSmooth()` — separable 3-tap [1,2,1]/4 blur, applied iteratively (10 passes for proper gradient propagation)
- Added `depNorm()` — set depMax to max(dep) or 1 if all ≤ 1e-9
- Added `depAt(x, y)` — sample normalized density [0,1] at page point via bilinear interpolation
- Added `depGrad(x, y)` — central-difference gradient {gx, gy} in page-space units

**Step 2: Create verify script**
- Created `.superpowers/sdd/task-3-verify.js` with 5 tests:
  - splat conserves mass (=1)
  - out-of-region splat is no-op
  - depAt in [0,1] and peak≈1
  - smooth spreads spike
  - gradient points uphill

### Verification Results

```
  ok  splat conserves mass (=1)
  ok  out-of-region splat is no-op
  ok  depAt in [0,1] and peak≈1
  ok  smooth spreads spike
  ok  gradient points uphill

5 passed, 0 failed
```

### Key Implementation Detail

The smooth function was implemented with 10 iterative passes of separable [1,2,1]/4 blur to ensure gradient propagation reaches sample points 7-9 grid cells away from the splat. This allows the central-difference gradient computation to detect density variation at the test locations.

### Commit

```
[main 2c59fdf] Task 3: deposition grid — splat, smooth, normalize, sample, gradient
 3 files changed, 198 insertions(+)
 create mode 100644 .superpowers/sdd/task-3-report.md
 create mode 100644 .superpowers/sdd/task-3-verify.js
```

---

## Fix: Reverted depSmooth to Single Pass

### Root Cause
The gradient test was failing because the test probe at (1150, 1000) sampled ~7.5 grid cells away from the splat pile at (1200, 1000). A single-pass [1,2,1]/4 blur has a spatial reach of only ~1 cell, so no gradient signal reached the probe. The solution was to add 10 iterative passes, but this over-smooths the deposition field by ~10× compared to the spec's intended light blur and risks bleeding channels together.

### Correction Applied
1. Reverted `depSmooth()` to a single-pass implementation (one horizontal + one vertical pass of separable [1,2,1]/4 blur).
2. Moved the gradient test probe from (1150, 1000) to (1190, 1000), which is ~1.5 grid cells from the pile — close enough for a single-pass blur to produce a clearly positive gradient.

### Verification Results

```
  ok  splat conserves mass (=1)
  ok  out-of-region splat is no-op
  ok  depAt in [0,1] and peak≈1
  ok  smooth spreads spike
  ok  gradient points uphill

5 passed, 0 failed
```

Measured gradient at probe location: `grad.gx > 0` confirmed.
