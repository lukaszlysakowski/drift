### Task 8: Full-pipeline integration check + README + soak

**Files:**
- Create: `README.md`
- Test: `.superpowers/sdd/task-8-verify.js`
- Modify: `index.js` only if a defect is found.

**Interfaces:**
- Consumes: everything.
- Produces: documentation + an end-to-end control-effects + multi-seed timed soak.

- [ ] **Step 1: Write README.md**

```markdown
# Drift

A curl-noise field that transports its own history. Particles drift downstream, each
leaving its full trajectory as a streakline; where they pass they deposit density, and that
density bends the field — high-deposition ground slows the flow and steers new particles
along it, so trails deepen into channels and later particles braid into river-like bundles.
The flow carves its own bed.

The system runs itself to stillness: particles are released in waves, each wave depositing
and re-bending the field, until the wave-to-wave deposition delta falls below a threshold
(the channels have stabilized) or a wave cap is hit — then it plots. No rating loop; it
settles on its own. One red line: the main channel — the single highest-deposition
streakline, the trunk the flow carved.

## Running

Static files, no build step: serve the directory (`npx serve . --listen 3464`) and open
`index.html`.

## Controls

- **Field** — Scale (Fine/Med/Broad noise feature size) · Strength (flow speed of the curl field)
- **Particles** — Count (Low/Med/High) · Seeding (Scattered/Edge/Clustered release points)
- **Feedback** — Channel (Off/Gentle/Strong — how strongly deposits slow + divert the flow)
- **Settle** — Off/Light/Full (wave cap 1/6/14; stops early when the field stops changing)
- **Style** — Wobble (default Off)
- randomize / refresh / svg / png / png 4x · click canvas = new seed

randomize rerolls every control except Wobble with a new seed.

## How it works

- **Base field:** curl of a seeded value-noise potential — divergence-free, so nothing pools
  artificially; all channeling comes from the feedback.
- **Feedback:** each particle stamps density into a 300² grid; the bent field slows flow in
  dense ground (clamped to a floor) and steers along the density contour, following trails.
- **Waves & settle:** per wave, freeze the bent field, integrate all particles with RK2, stamp
  deposits, then rebuild the field; stop when the deposition delta settles or the cap is hit.
- **Channel=Off** yields pure curl-noise streaklines (no channelization) — the honest baseline.

## Exports

Layered SVG pen passes (Border / Streaks-light / Streaks-heavy / Channel / Signature) for
multi-pen plotting; PNG at 1x (2170²) and 4x (8680²).

## Family

[palimpsest](https://github.com/lukaszlysakowski/palimpsest) ·
[core-samples](https://github.com/lukaszlysakowski/core-samples) ·
[second-reading](https://github.com/lukaszlysakowski/second-reading) ·
[fold](https://github.com/lukaszlysakowski/fold) ·
[watershed](https://github.com/lukaszlysakowski/watershed) ·
[interference](https://github.com/lukaszlysakowski/interference) ·
[field-script](https://github.com/lukaszlysakowski/field-script)
```

- [ ] **Step 2: Write soak + integration script**

`.superpowers/sdd/task-8-verify.js` (boilerplate through `check`, then):

```javascript
function run(setup) {
    vm.runInContext(`
        ui.scale = 1; ui.strength = 1; ui.count = 1; ui.seeding = 0; ui.channel = 1; ui.settle = 1; ui.wobble = 0;
        ${setup}
        regenerate(false);
        globalThis.__snap = {
            paths: state.paths.length,
            verts: state.paths.reduce((a, p) => a + p.pts.length, 0),
            heavy: state.paths.filter(p => p.cls === 1).length,
            wavesRun: state.wavesRun,
            channelIdx: state.channelIdx
        };
    `, sandbox);
    return sandbox.__snap;
}

const base = run('state.masterSeed = 4242;');
check('base: paths + channel populated', base.paths > 0 && base.channelIdx >= 0);
check('base: substantial ink (>2000 vertices)', base.verts > 2000, `${base.verts}`);

const off = run('state.masterSeed = 4242; ui.channel = 0;');
const strong = run('state.masterSeed = 4242; ui.channel = 2;');
check('channelization: strong has more heavy paths than off', strong.heavy > off.heavy, `off ${off.heavy} vs strong ${strong.heavy}`);

const lowC = run('state.masterSeed = 4242; ui.count = 0;');
const highC = run('state.masterSeed = 4242; ui.count = 2;');
check('Count monotone: low < high paths', lowC.paths < highC.paths, `${lowC.paths} vs ${highC.paths}`);

const settleOff = run('state.masterSeed = 4242; ui.settle = 0;');
check('Settle Off → 1 wave', settleOff.wavesRun === 1, `${settleOff.wavesRun}`);

// full-pipeline determinism
vm.runInContext('ui.scale=1;ui.strength=1;ui.count=1;ui.seeding=0;ui.channel=1;ui.settle=1;ui.wobble=0; state.masterSeed = 4242; regenerate(false); globalThis.__d1 = JSON.stringify({p: state.paths.map(p=>[p.cls,p.pts.length]), c: state.channelIdx, w: state.wavesRun});', sandbox);
vm.runInContext('state.masterSeed = 4242; regenerate(false); globalThis.__d2 = JSON.stringify({p: state.paths.map(p=>[p.cls,p.pts.length]), c: state.channelIdx, w: state.wavesRun});', sandbox);
check('full-pipeline determinism', sandbox.__d1 === sandbox.__d2);

// multi-seed soak at Med count + Full settle, timed
let allOK = true;
for (const seed of [17, 404, 9090, 123456, 777777]) {
    const t0 = Date.now();
    vm.runInContext(`ui.count = 1; ui.channel = 1; ui.settle = 2; state.masterSeed = ${seed}; regenerate(false);`, sandbox);
    const ms = Date.now() - t0;
    const st = sandbox.state;
    const verts = st.paths.reduce((a, p) => a + p.pts.length, 0);
    const ok = st.paths.length > 0 && verts > 1000 && st.channelIdx >= 0 && ms < 30000;
    console.log(`  seed ${seed}: ${st.paths.length} paths, ${verts} verts, ${st.wavesRun} waves, ch ${st.channelIdx}, ${ms}ms ${ok ? 'ok' : 'FAIL'}`);
    if (!ok) allOK = false;
}
check('5-seed soak at Med/Full', allOK);

const svg = vm.runInContext('buildSVG()', sandbox);
check('soak SVG has 5 passes', (svg.match(/inkscape:groupmode="layer"/g) || []).length === 5);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run soak**

Run: `node .superpowers/sdd/task-8-verify.js`
Expected: `9 passed, 0 failed`, each soak seed under 30s.

If `base: substantial ink (>2000 vertices)` or `channelization` checks fail, the fix is in the earlier engine tasks (Count/field/feedback), not the test threshold — report which and revisit that task.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 8: README + full-pipeline integration + multi-seed soak"
```

---

