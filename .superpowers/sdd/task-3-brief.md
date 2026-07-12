### Task 3: Deposition grid — splat, smooth, sample

**Files:**
- Modify: `index.js` (replace nothing yet; add `depReset`, `depSplat`, `depSmooth`, `depNorm`, `depAt`, `depGrad`, and grid-mapping helpers)
- Test: `.superpowers/sdd/task-3-verify.js`

**Interfaces:**
- Consumes: `state.dep`, `DEP_N`, `CS`, `PAD`.
- Produces: module constants `DEP_AMOUNT = 1`; helpers `pageToGrid(x,y) → {gx, gy}` (float grid coords in [0,DEP_N]); `depReset()` (allocate/zero `state.dep`, set `state.depMax = 1`); `depSplat(x, y)` (bilinear-add DEP_AMOUNT into the 4 cells around page point); `depSmooth()` (separable 3-tap [1,2,1]/4 blur in place); `depNorm()` (set `state.depMax = max(dep)` or 1 if all zero); `depAt(x,y) → number` (normalized density D̂ ∈ [0,1] at page point, bilinear); `depGrad(x,y) → {gx, gy}` (central-difference gradient of D̂ in page-space units).

- [ ] **Step 1: Implement**

Add (these have no earlier stub — they are new helpers used by Task 4+):

```javascript
const DEP_AMOUNT = 1;

function pageToGrid(x, y) {
    const span = CS - 2 * PAD;
    return { gx: ((x - PAD) / span) * DEP_N, gy: ((y - PAD) / span) * DEP_N };
}

function depReset() {
    state.dep = new Float32Array(DEP_N * DEP_N);
    state.depMax = 1;
}

function depSplat(x, y) {
    const { gx, gy } = pageToGrid(x, y);
    const ix = Math.floor(gx), iy = Math.floor(gy);
    if (ix < 0 || iy < 0 || ix >= DEP_N - 1 || iy >= DEP_N - 1) return;
    const fx = gx - ix, fy = gy - iy;
    const d = state.dep;
    d[iy * DEP_N + ix]         += DEP_AMOUNT * (1 - fx) * (1 - fy);
    d[iy * DEP_N + ix + 1]     += DEP_AMOUNT * fx * (1 - fy);
    d[(iy + 1) * DEP_N + ix]   += DEP_AMOUNT * (1 - fx) * fy;
    d[(iy + 1) * DEP_N + ix + 1] += DEP_AMOUNT * fx * fy;
}

function depSmooth() {
    const d = state.dep, n = DEP_N;
    const tmp = new Float32Array(n * n);
    // horizontal pass
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const l = x > 0 ? d[y * n + x - 1] : d[y * n + x];
            const r = x < n - 1 ? d[y * n + x + 1] : d[y * n + x];
            tmp[y * n + x] = (l + 2 * d[y * n + x] + r) / 4;
        }
    }
    // vertical pass
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const u = y > 0 ? tmp[(y - 1) * n + x] : tmp[y * n + x];
            const dn = y < n - 1 ? tmp[(y + 1) * n + x] : tmp[y * n + x];
            d[y * n + x] = (u + 2 * tmp[y * n + x] + dn) / 4;
        }
    }
}

function depNorm() {
    let m = 0;
    const d = state.dep;
    for (let i = 0; i < d.length; i++) if (d[i] > m) m = d[i];
    state.depMax = m > 1e-9 ? m : 1;
}

function depAt(x, y) {
    const { gx, gy } = pageToGrid(x, y);
    const ix = Math.floor(gx), iy = Math.floor(gy);
    if (ix < 0 || iy < 0 || ix >= DEP_N - 1 || iy >= DEP_N - 1) return 0;
    const fx = gx - ix, fy = gy - iy;
    const d = state.dep, n = DEP_N;
    const v = d[iy * n + ix] * (1 - fx) * (1 - fy) + d[iy * n + ix + 1] * fx * (1 - fy) +
        d[(iy + 1) * n + ix] * (1 - fx) * fy + d[(iy + 1) * n + ix + 1] * fx * fy;
    return v / state.depMax;
}

function depGrad(x, y) {
    const span = CS - 2 * PAD;
    const h = span / DEP_N; // one cell in page units
    return {
        gx: (depAt(x + h, y) - depAt(x - h, y)) / (2 * h),
        gy: (depAt(x, y + h) - depAt(x, y - h)) / (2 * h)
    };
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-3-verify.js` (boilerplate through `check`, then):

```javascript
// splat conserves mass: total added = DEP_AMOUNT for an in-bounds point
const mass = vm.runInContext(`
    (function () {
        depReset();
        depSplat(1000, 1000);
        let s = 0; for (let i = 0; i < state.dep.length; i++) s += state.dep[i];
        return s;
    })()
`, sandbox);
check('splat conserves mass (=1)', Math.abs(mass - 1) < 1e-6, `${mass}`);

// out-of-bounds splat deposits nothing
const oob = vm.runInContext(`
    (function () {
        depReset(); depSplat(5, 5); // near corner, outside field region (PAD=87)
        let s = 0; for (let i = 0; i < state.dep.length; i++) s += state.dep[i];
        return s;
    })()
`, sandbox);
check('out-of-region splat is no-op', oob === 0, `${oob}`);

// depAt normalized to [0,1], max cell → 1 after depNorm
const normd = vm.runInContext(`
    (function () {
        depReset();
        for (let i = 0; i < 50; i++) depSplat(1000, 1000); // pile up
        depSplat(1400, 700);
        depNorm();
        let mx = 0; for (let i = 0; i < state.dep.length; i++) mx = Math.max(mx, state.dep[i] / state.depMax);
        return [depAt(1000,1000), mx];
    })()
`, sandbox);
check('depAt in [0,1] and peak≈1', normd[0] > 0.5 && normd[0] <= 1.0001 && Math.abs(normd[1] - 1) < 1e-6, JSON.stringify(normd));

// smoothing spreads a spike to neighbors (center drops, neighbors rise).
// DEP_N is a const in the sandbox, so it can be referenced directly inside the vm code.
const spread = vm.runInContext(`
    (function () {
        depReset(); depSplat(1000, 1000);
        const g = pageToGrid(1000, 1000); const ix = Math.floor(g.gx), iy = Math.floor(g.gy);
        const before = state.dep[iy * DEP_N + ix];
        depSmooth();
        const after = state.dep[iy * DEP_N + ix];
        const neighbor = state.dep[iy * DEP_N + ix + 1];
        return [before, after, neighbor];
    })()
`, sandbox);
check('smooth spreads spike', spread[1] < spread[0] && spread[2] > 0, JSON.stringify(spread));

// gradient points toward higher density
const grad = vm.runInContext(`
    (function () {
        depReset();
        for (let i = 0; i < 30; i++) depSplat(1200, 1000);
        depSmooth(); depNorm();
        // sample to the LEFT of the pile: gradient x-component should be positive (density rises to the right)
        return depGrad(1150, 1000);
    })()
`, sandbox);
check('gradient points uphill', grad.gx > 0, JSON.stringify(grad));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-3-verify.js`
Expected: `5 passed, 0 failed`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 3: deposition grid — splat, smooth, normalize, sample, gradient"
```

---

