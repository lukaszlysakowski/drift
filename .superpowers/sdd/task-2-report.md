# Task 2: Curl-noise base flow field

## Status: Complete

- [x] Step 1: Implement curl-noise functions in index.js
- [x] Step 2: Write verify script
- [x] Step 3: Run verification
- [x] Step 4: Commit and confirm

## Implementation Log

### Step 1: index.js modifications
- Added constants: `FLOW_SPEED = 6`, `CURL_H = 1.5`
- Implemented `makeNoise2D(seed)` - seeded 2-octave Perlin-like value noise
- Implemented `rollField()` - generates field parameters (ns, strength, offsets, fbm)
- Implemented `potential(x, y)` - scalar streamfunction ψ
- Implemented `baseField(x, y)` - curl of ψ normalized to constant speed

### Step 2: task-2-verify.js
Created full verification suite testing:
1. Divergence-free property of curl field
2. Speed normalization to FLOW_SPEED
3. Scale parameter controls feature size
4. Deterministic behavior

### Step 3: Verification Results
```
  ok  curl field ~divergence-free (relative)
  ok  baseField normalized to FLOW_SPEED
  ok  Fine field varies faster than Broad
  ok  determinism: baseField

4 passed, 0 failed
```

### Step 4: Commits
- **a0805f6** Task 2: curl-noise base flow field
  - Modified: index.js (added FLOW_SPEED, CURL_H, makeNoise2D, rollField, potential, baseField)
  - Created: .superpowers/sdd/task-2-verify.js
  - Created: .superpowers/sdd/task-2-report.md

