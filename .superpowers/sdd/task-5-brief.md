### Task 5: Waves — RK2 advection, seeding, deposition, settle loop

**Files:**
- Modify: `index.js` (replace `runWaves` stub; add `waveStarts`, `advect`, `RK2` step constants)
- Test: `.superpowers/sdd/task-5-verify.js`

**Interfaces:**
- Consumes: `bentField` (Task 4), `depReset/depSplat/depSmooth/depNorm` (Task 3), `COUNTS`/`WAVE_CAP`, `ui.count/seeding/settle`, `seededRng`, `state`.
- Produces: module constants `DT = 1`, `MAX_STEPS = 400`, `STALL_EPS = 0.4`, `SETTLE_EPS = 0.02`, `MIN_PTS = 2`; `waveStarts(w) → [{x,y},...]` (P seeded start points for wave w per Seeding control); `advect(start) → [{x,y},...]` (one RK2 streakline on the CURRENT frozen bent field); `runWaves()` fills `state.paths` (all waves' polylines), `state.wavesRun`, and leaves `state.dep`/`state.depMax` at the settled field.

- [ ] **Step 1: Implement**

```javascript
const DT = 1;
const MAX_STEPS = 400;
const STALL_EPS = 0.4;   // page units/step; below this the path has stalled
const SETTLE_EPS = 0.02;
const MIN_PTS = 2;

function inRegion(x, y) {
    return x >= PAD && x <= CS - PAD && y >= PAD && y <= CS - PAD;
}

function waveStarts(w) {
    const rng = seededRng((state.masterSeed + w * 9161) >>> 0);
    const P = COUNTS[ui.count];
    const span = CS - 2 * PAD;
    const pts = [];
    if (ui.seeding === 0) {
        // Scattered: uniform over the region
        for (let i = 0; i < P; i++) pts.push({ x: PAD + rng() * span, y: PAD + rng() * span });
    } else if (ui.seeding === 1) {
        // Edge: along one rolled border, jittered slightly inward
        const side = Math.floor(rng() * 4);
        for (let i = 0; i < P; i++) {
            const t = rng(), inset = PAD + rng() * span * 0.04;
            if (side === 0) pts.push({ x: PAD + t * span, y: inset });
            else if (side === 1) pts.push({ x: CS - inset, y: PAD + t * span });
            else if (side === 2) pts.push({ x: PAD + t * span, y: CS - inset });
            else pts.push({ x: inset, y: PAD + t * span });
        }
    } else {
        // Clustered: a few rolled Gaussian blobs
        const nBlobs = 2 + Math.floor(rng() * 3);
        const blobs = [];
        for (let b = 0; b < nBlobs; b++) blobs.push({ cx: PAD + rng() * span, cy: PAD + rng() * span, r: span * (0.04 + rng() * 0.06) });
        for (let i = 0; i < P; i++) {
            const b = blobs[Math.floor(rng() * nBlobs)];
            // Box-Muller-ish via two uniforms
            const a = rng() * Math.PI * 2, rad = b.r * Math.sqrt(rng());
            pts.push({ x: b.cx + Math.cos(a) * rad, y: b.cy + Math.sin(a) * rad });
        }
    }
    return pts;
}

// One RK2-midpoint streakline on the current frozen bentField.
function advect(start) {
    const pts = [{ x: start.x, y: start.y }];
    let x = start.x, y = start.y;
    for (let step = 0; step < MAX_STEPS; step++) {
        const k1 = bentField(x, y);
        const mx = x + 0.5 * DT * k1.vx, my = y + 0.5 * DT * k1.vy;
        const k2 = bentField(mx, my);
        const nx = x + DT * k2.vx, ny = y + DT * k2.vy;
        const sp = Math.hypot(nx - x, ny - y);
        if (sp < STALL_EPS) break;
        x = nx; y = ny;
        if (!inRegion(x, y)) { pts.push({ x, y }); break; }
        pts.push({ x, y });
    }
    return pts;
}

function runWaves() {
    depReset();
    depNorm();
    state.paths = [];
    const maxWaves = WAVE_CAP[ui.settle];
    let prevSum = 0;
    state.wavesRun = 0;
    for (let w = 0; w < maxWaves; w++) {
        // snapshot deposition before this wave for settle delta
        const before = state.dep.slice();
        const beforeSum = sumArr(before);
        // release + advect on the CURRENT frozen field
        const starts = waveStarts(w);
        for (const s of starts) {
            const path = advect(s);
            if (path.length >= MIN_PTS) {
                state.paths.push({ pts: path, meanD: 0, totalD: 0, cls: 0 });
                for (const p of path) depSplat(p.x, p.y);
            }
        }
        depSmooth();
        depNorm();
        state.wavesRun = w + 1;
        // settle delta vs before
        const afterSum = sumArr(state.dep);
        let diff = 0;
        for (let i = 0; i < state.dep.length; i++) diff += Math.abs(state.dep[i] - before[i]);
        const delta = diff / Math.max(afterSum, 1e-9);
        prevSum = afterSum;
        if (w > 0 && delta < SETTLE_EPS) break;
    }
}

function sumArr(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }
```

Note: settle delta is only allowed to terminate after `w > 0` (the first wave always deposits into an empty field, so its delta is trivially 1). `advect` reads `bentField`, which reads `state.dep`/`state.depMax` — frozen for the wave because `depSmooth`/`depNorm` are only called AFTER the whole wave's particles are advected and splatted. This is the per-wave-frozen-field contract from the spec.

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-5-verify.js` (boilerplate through `check`, then — use Low count for speed):

```javascript
vm.runInContext('ui.scale = 1; ui.strength = 1; ui.count = 0; ui.seeding = 0; ui.channel = 1; ui.settle = 2; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;

check('paths produced', st.paths.length > 0, `${st.paths.length}`);
check('all paths have >=2 pts', st.paths.every(p => p.pts.length >= 2));
check('all path vertices in region', st.paths.every(p => p.pts.every(v => v.x >= 87 - 1 && v.x <= 2170 - 87 + 30 && v.y >= 87 - 1 && v.y <= 2170 - 87 + 30)));
check('no path exceeds MAX_STEPS+1 vertices', st.paths.every(p => p.pts.length <= 401));

// Settle Off caps wavesRun at 1
vm.runInContext('ui.settle = 0; regenerate(false);', sandbox);
check('Settle Off → wavesRun == 1', sandbox.state.wavesRun === 1, `${sandbox.state.wavesRun}`);

// Full allows more than 1 wave (unless it settles immediately)
vm.runInContext('ui.settle = 2; regenerate(false);', sandbox);
check('Settle Full → wavesRun in [1,14]', sandbox.state.wavesRun >= 1 && sandbox.state.wavesRun <= 14, `${sandbox.state.wavesRun}`);

// RK2 path reproducible for a fixed field + start (freeze field via a fresh regenerate, same seed)
vm.runInContext('ui.count = 0; state.masterSeed = 31; regenerate(false); globalThis.__p1 = JSON.stringify(advect({x: 900, y: 900}));', sandbox);
vm.runInContext('state.masterSeed = 31; regenerate(false); globalThis.__p2 = JSON.stringify(advect({x: 900, y: 900}));', sandbox);
check('advect reproducible', sandbox.__p1 === sandbox.__p2);

// channelization: heavy fraction rises Off→Strong. Compute after classify (Task 6 not built yet),
// so here just check total deposition mass concentrates (max/mean ratio rises with Channel).
const concentration = (ch) => vm.runInContext(`
    (function () {
        ui.channel = ${ch}; ui.count = 1; ui.settle = 1; state.masterSeed = 909; regenerate(false);
        let mx = 0, sum = 0, n = 0;
        for (let i = 0; i < state.dep.length; i++) { const v = state.dep[i]; if (v>0){ mx = Math.max(mx, v); sum += v; n++; } }
        return mx / (sum / n);
    })()
`, sandbox);
const off = concentration(0), strong = concentration(2);
check('channelization concentrates deposition (Strong > Off)', strong > off, `off ${off.toFixed(2)} vs strong ${strong.toFixed(2)}`);

// determinism
vm.runInContext('ui.channel = 1; ui.count = 0; ui.settle = 1; state.masterSeed = 55; regenerate(false); globalThis.__a = JSON.stringify(state.paths.slice(0,5).map(p=>p.pts)); globalThis.__w = state.wavesRun;', sandbox);
vm.runInContext('state.masterSeed = 55; regenerate(false); globalThis.__b = JSON.stringify(state.paths.slice(0,5).map(p=>p.pts)); globalThis.__w2 = state.wavesRun;', sandbox);
check('determinism: paths + wavesRun', sandbox.__a === sandbox.__b && sandbox.__w === sandbox.__w2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-5-verify.js`
Expected: `9 passed, 0 failed`

If `channelization concentrates deposition (Strong > Off)` fails, the feedback isn't deepening channels — do NOT weaken the test; report it and revisit SLOW/DIVERT in Task 4 (they may be too small) before proceeding.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 5: waves — RK2 advection, seeding, deposition, settle loop"
```

---

