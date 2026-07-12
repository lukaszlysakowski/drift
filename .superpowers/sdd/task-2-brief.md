### Task 2: Curl-noise base field

**Files:**
- Modify: `index.js` (replace `rollField` stub; add `makeNoise2D`, `potential`, `baseField`)
- Test: `.superpowers/sdd/task-2-verify.js`

**Interfaces:**
- Consumes: `ui`, `state`, p5 `random/randomSeed` (seeded by `regenerate`).
- Produces: `makeNoise2D(seed) → fbm(x,y)` (self-contained seeded value noise, 2 octaves); `rollField()` fills `state.field = {ns, strength, ox, oy, fbm}`; `potential(x,y) → number` (the scalar streamfunction ψ at page point); `baseField(x,y) → {vx, vy}` (curl of ψ via finite differences, normalized to target speed `FLOW_SPEED`). Module constant `FLOW_SPEED = 6` (page units per step), `CURL_H = 1.5` (finite-difference step).

- [ ] **Step 1: Implement**

Replace the `rollField` stub with:

```javascript
const FLOW_SPEED = 6;   // target per-step speed in page units
const CURL_H = 1.5;     // finite-difference step for curl

// Seeded 2-octave value noise — self-contained so canvas and harness agree exactly.
function makeNoise2D(seed) {
    function hash(ix, iy) {
        let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 974634167)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    const smooth = t => t * t * (3 - 2 * t);
    function vnoise(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
        const u = smooth(fx), v = smooth(fy);
        return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }
    return function fbm(x, y) {
        return (vnoise(x, y) + 0.5 * vnoise(x * 2.07 + 19.3, y * 2.07 + 7.7)) / 1.5;
    };
}

function rollField() {
    // Field Scale → noise feature size (smaller ns = broader features)
    const ns = [0.0034, 0.0022, 0.0013][ui.scale];
    const strength = [0.7, 1.0, 1.45][ui.strength];
    state.field = {
        ns, strength,
        ox: random(1000), oy: random(1000),
        fbm: makeNoise2D(state.masterSeed + 4099)
    };
}

function potential(x, y) {
    const f = state.field;
    // scalar streamfunction ψ; amplitude in page units so curl ~ O(1) before normalization
    return f.fbm(x * f.ns + f.ox, y * f.ns + f.oy) * 900 * f.strength;
}

function baseField(x, y) {
    // v = curl(ψ) = (∂ψ/∂y, −∂ψ/∂x), central differences
    const dpsi_dx = (potential(x + CURL_H, y) - potential(x - CURL_H, y)) / (2 * CURL_H);
    const dpsi_dy = (potential(x, y + CURL_H) - potential(x, y - CURL_H)) / (2 * CURL_H);
    let vx = dpsi_dy, vy = -dpsi_dx;
    const m = Math.hypot(vx, vy);
    if (m < 1e-9) return { vx: 0, vy: 0 };
    return { vx: (vx / m) * FLOW_SPEED, vy: (vy / m) * FLOW_SPEED };
}
```

Note: `baseField` normalizes to unit direction × `FLOW_SPEED`, so every step advances a constant arc length — this keeps RK2 step size uniform and makes divergence testing meaningful on the *direction* field. The curl of a scalar potential is divergence-free before normalization; the normalized direction field is approximately divergence-free where speed varies slowly, which the Task-2 test checks with a tolerance.

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-2-verify.js` (copy the boilerplate from task-1-verify.js from the top through the `check` function definition, INCLUDING the globals-export vm.runInContext line, then):

```javascript
vm.runInContext('ui.scale = 1; ui.strength = 1; state.masterSeed = 4242; regenerate(false);', sandbox);

// curl is divergence-free: ∇·curl(ψ) = ∂²ψ/∂x∂y − ∂²ψ/∂y∂x ≈ 0.
// Test the RAW (pre-normalization) curl directly from potential(), via central differences.
const div = vm.runInContext(`
    (function () {
        const H = 2, h = 1.5;
        function rawCurl(x, y) {
            const dpsi_dx = (potential(x + h, y) - potential(x - h, y)) / (2 * h);
            const dpsi_dy = (potential(x, y + h) - potential(x, y - h)) / (2 * h);
            return { vx: dpsi_dy, vy: -dpsi_dx };
        }
        let maxDiv = 0, scale = 0;
        for (let x = 300; x <= 1800; x += 300) {
            for (let y = 300; y <= 1800; y += 300) {
                const a = rawCurl(x + H, y), b = rawCurl(x - H, y);
                const c = rawCurl(x, y + H), d = rawCurl(x, y - H);
                const divergence = (a.vx - b.vx) / (2 * H) + (c.vy - d.vy) / (2 * H);
                maxDiv = Math.max(maxDiv, Math.abs(divergence));
                scale = Math.max(scale, Math.hypot(a.vx, a.vy));
            }
        }
        // relative divergence: |∇·v| should be tiny vs the field magnitude
        return scale > 1e-9 ? maxDiv / scale : maxDiv;
    })()
`, sandbox);
check('curl field ~divergence-free (relative)', div < 0.02, `relDiv ${div}`);

// baseField returns unit*FLOW_SPEED magnitude (=6) where field is non-degenerate
const speeds = vm.runInContext(`
    (function () {
        let bad = 0, n = 0;
        for (let x = 300; x <= 1800; x += 150) for (let y = 300; y <= 1800; y += 150) {
            const v = baseField(x, y); const m = Math.hypot(v.vx, v.vy);
            if (m > 1e-6) { n++; if (Math.abs(m - 6) > 1e-6) bad++; }
        }
        return [bad, n];
    })()
`, sandbox);
check('baseField normalized to FLOW_SPEED', speeds[0] === 0 && speeds[1] > 50, `bad ${speeds[0]} of ${speeds[1]}`);

// Field Scale changes feature size: Broad has lower spatial variation than Fine over a fixed window
const variation = (scaleIdx) => vm.runInContext(`
    (function () {
        ui.scale = ${scaleIdx}; state.masterSeed = 4242; regenerate(false);
        let sum = 0, prev = null;
        for (let x = 300; x <= 1800; x += 30) {
            const v = baseField(x, 1000);
            if (prev) sum += Math.abs(v.vx - prev.vx) + Math.abs(v.vy - prev.vy);
            prev = v;
        }
        return sum;
    })()
`, sandbox);
const fineVar = variation(0), broadVar = variation(2);
check('Fine field varies faster than Broad', fineVar > broadVar, `fine ${fineVar.toFixed(1)} vs broad ${broadVar.toFixed(1)}`);

// determinism
vm.runInContext('ui.scale = 1; state.masterSeed = 777; regenerate(false); globalThis.__v1 = JSON.stringify(baseField(900, 900));', sandbox);
vm.runInContext('state.masterSeed = 777; regenerate(false); globalThis.__v2 = JSON.stringify(baseField(900, 900));', sandbox);
check('determinism: baseField', sandbox.__v1 === sandbox.__v2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-2-verify.js`
Expected: `4 passed, 0 failed`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 2: curl-noise base flow field"
```

---

