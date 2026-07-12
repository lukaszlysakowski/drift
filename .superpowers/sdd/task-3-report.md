# Task 3: Deposition Grid — Splat, Smooth, Normalize, Sample, Gradient

## Status: In Progress

### Implementation

**Step 1: Add functions to index.js**
- Added `DEP_AMOUNT = 1` constant
- Added `pageToGrid(x, y)` — convert page coords to grid coordinates
- Added `depReset()` — allocate and zero deposition grid
- Added `depSplat(x, y)` — bilinear-add DEP_AMOUNT to 4 cells around page point
- Added `depSmooth()` — separable 3-tap blur in place
- Added `depNorm()` — normalize grid by max value
- Added `depAt(x, y)` — sample normalized density at page point (bilinear)
- Added `depGrad(x, y)` — central-difference gradient of density

**Step 2: Create verify script**
- Created `.superpowers/sdd/task-3-verify.js` with 5 tests

### Verification Results

Running: `node .superpowers/sdd/task-3-verify.js`

**Expected:** 5 passed, 0 failed

### Commits

(To be filled in after verification)

---
