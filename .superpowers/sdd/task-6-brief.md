### Task 6: Classify paths — heavy/light classes + red main channel

**Files:**
- Modify: `index.js` (replace `classifyPaths` stub; add class constant)
- Test: `.superpowers/sdd/task-6-verify.js`

**Interfaces:**
- Consumes: `state.paths`, `depAt` (Task 3, using the settled field left by `runWaves`).
- Produces: `classifyPaths()` sets each path's `meanD` (mean traversed D̂), `totalD` (sum traversed D̂), `cls` (1 = heavy if `meanD ≥ HEAVY_THRESH`, else 0), and `state.channelIdx` = index of the path with the highest `totalD` (or −1 if no paths). Module constant `HEAVY_THRESH = 0.28`.

- [ ] **Step 1: Implement**

```javascript
const HEAVY_THRESH = 0.28;

function classifyPaths() {
    let bestIdx = -1, bestTotal = -1;
    for (let i = 0; i < state.paths.length; i++) {
        const p = state.paths[i];
        let sum = 0;
        for (const v of p.pts) sum += depAt(v.x, v.y);
        p.totalD = sum;
        p.meanD = p.pts.length ? sum / p.pts.length : 0;
        p.cls = p.meanD >= HEAVY_THRESH ? 1 : 0;
        if (sum > bestTotal) { bestTotal = sum; bestIdx = i; }
    }
    state.channelIdx = bestIdx;
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-6-verify.js` (boilerplate through `check`, then):

```javascript
vm.runInContext('ui.scale = 1; ui.strength = 1; ui.count = 1; ui.seeding = 0; ui.channel = 2; ui.settle = 1; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;

check('every path classified', st.paths.every(p => p.cls === 0 || p.cls === 1));
check('meanD in [0,1]', st.paths.every(p => p.meanD >= 0 && p.meanD <= 1.0001));
check('channelIdx valid', st.channelIdx >= 0 && st.channelIdx < st.paths.length, `${st.channelIdx}`);

// channel is the argmax totalD
const isMax = vm.runInContext(`
    (function () {
        let best = -1, idx = -1;
        for (let i = 0; i < state.paths.length; i++) if (state.paths[i].totalD > best) { best = state.paths[i].totalD; idx = i; }
        return idx === state.channelIdx;
    })()
`, sandbox);
check('channelIdx == argmax(totalD)', isMax);

// heavy fraction rises Off→Strong (feedback deepens channels → more heavy-class paths)
const heavyFrac = (ch) => vm.runInContext(`
    (function () {
        ui.channel = ${ch}; ui.count = 1; ui.settle = 1; state.masterSeed = 707; regenerate(false);
        const h = state.paths.filter(p => p.cls === 1).length;
        return h / Math.max(state.paths.length, 1);
    })()
`, sandbox);
const offFrac = heavyFrac(0), strongFrac = heavyFrac(2);
check('heavy fraction rises Off→Strong', strongFrac > offFrac, `off ${offFrac.toFixed(3)} vs strong ${strongFrac.toFixed(3)}`);

// determinism
vm.runInContext('ui.channel = 1; state.masterSeed = 88; regenerate(false); globalThis.__c1 = state.channelIdx + "|" + state.paths.map(p=>p.cls).join("");', sandbox);
vm.runInContext('state.masterSeed = 88; regenerate(false); globalThis.__c2 = state.channelIdx + "|" + state.paths.map(p=>p.cls).join("");', sandbox);
check('determinism: classes + channel', sandbox.__c1 === sandbox.__c2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-6-verify.js`
Expected: `6 passed, 0 failed`

If `heavy fraction rises Off→Strong` fails, tune `HEAVY_THRESH` (Task 6) so the classes are meaningfully populated at the default field, OR revisit feedback strength (Task 4) — report which, do NOT weaken the assertion.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 6: classify paths — heavy/light + red main channel"
```

---

