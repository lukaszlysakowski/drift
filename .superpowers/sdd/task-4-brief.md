### Task 4: Bent field — deposition feedback (slow + divert)

**Files:**
- Modify: `index.js` (add `bentField`, feedback constants)
- Test: `.superpowers/sdd/task-4-verify.js`

**Interfaces:**
- Consumes: `baseField` (Task 2), `depAt`/`depGrad` (Task 3), `ui.channel`.
- Produces: module constants `SLOW = 0.7`, `DIVERT = 0.9`, `SLOW_FLOOR = 0.15`, `FEEDBACK_SCALE = [0, 0.5, 1][ui.channel]`; `bentField(x, y) → {vx, vy}` — the base field slowed by local density and diverted along the density contour. At zero density (or Channel=Off) returns exactly `baseField(x,y)`.

- [ ] **Step 1: Implement**

```javascript
const SLOW = 0.7;
const DIVERT = 0.9;
const SLOW_FLOOR = 0.15;

function bentField(x, y) {
    const v = baseField(x, y);
    const fb = [0, 0.5, 1][ui.channel];
    if (fb === 0) return v;
    const d = depAt(x, y);
    if (d <= 0) return v;
    // slow: decelerate in deposited ground, clamped so flow never fully stops
    const s = Math.max(SLOW_FLOOR, 1 - SLOW * fb * d);
    // divert: steer along the density contour (perpendicular to gradient), following trails
    const g = depGrad(x, y);
    const gm = Math.hypot(g.gx, g.gy);
    let tx = 0, ty = 0;
    if (gm > 1e-9) {
        // rot90 of unit gradient: (−gy, gx)
        const ux = -g.gy / gm, uy = g.gx / gm;
        const speed = Math.hypot(v.vx, v.vy);
        tx = DIVERT * fb * d * ux * speed;
        ty = DIVERT * fb * d * uy * speed;
    }
    return { vx: s * v.vx + tx, vy: s * v.vy + ty };
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-4-verify.js` (boilerplate through `check`, then):

```javascript
vm.runInContext('ui.scale = 1; ui.strength = 1; ui.channel = 1; state.masterSeed = 4242; regenerate(false);', sandbox);

// at zero density, bentField == baseField
const eqZero = vm.runInContext(`
    (function () {
        depReset(); depNorm(); // empty grid → depAt returns 0
        const b = baseField(900, 900), t = bentField(900, 900);
        return Math.abs(b.vx - t.vx) + Math.abs(b.vy - t.vy);
    })()
`, sandbox);
check('zero density → bentField == baseField', eqZero < 1e-9, `${eqZero}`);

// Channel=Off → bentField == baseField even with deposition present
const offEq = vm.runInContext(`
    (function () {
        ui.channel = 0;
        depReset(); for (let i=0;i<40;i++) depSplat(900,900); depSmooth(); depNorm();
        const b = baseField(900, 900), t = bentField(900, 900);
        ui.channel = 1;
        return Math.abs(b.vx - t.vx) + Math.abs(b.vy - t.vy);
    })()
`, sandbox);
check('Channel=Off → no bending', offEq < 1e-9, `${offEq}`);

// slow: speed at a dense point is lower than base speed (but ≥ floor*base)
const slowed = vm.runInContext(`
    (function () {
        ui.channel = 2; // Strong
        depReset(); for (let i=0;i<60;i++) depSplat(900,900); depSmooth(); depNorm();
        const b = baseField(900,900), t = bentField(900,900);
        const bs = Math.hypot(b.vx,b.vy), ts = Math.hypot(t.vx,t.vy);
        ui.channel = 1;
        // the along-flow component should be reduced; total speed may include divert, so check
        // projection onto base direction is slowed
        const proj = (t.vx*b.vx + t.vy*b.vy) / bs;
        return [proj, bs, bs * 0.15];
    })()
`, sandbox);
check('slow reduces along-flow speed', slowed[0] < slowed[1] && slowed[0] >= slowed[2] - 1e-6, JSON.stringify(slowed));

// divert adds a component perpendicular to base flow when a gradient exists
const diverted = vm.runInContext(`
    (function () {
        ui.channel = 2;
        depReset(); for (let i=0;i<60;i++) depSplat(1200,1000); depSmooth(); depNorm();
        const x = 1150, y = 1000; // beside the pile → nonzero gradient
        const b = baseField(x,y), t = bentField(x,y);
        const bs = Math.hypot(b.vx,b.vy);
        // perpendicular component of t relative to base direction
        const perp = Math.abs((-t.vx*b.vy + t.vy*b.vx) / bs);
        ui.channel = 1;
        return perp;
    })()
`, sandbox);
check('divert adds perpendicular steering', diverted > 1e-3, `${diverted}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-4-verify.js`
Expected: `4 passed, 0 failed`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 4: bent field — deposition feedback (slow + divert)"
```

---

