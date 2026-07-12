// Task 3 verification: deposition grid — splat, smooth, normalize, sample, gradient
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { installP5Stub } = require('./p5-stub.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
const sandbox = Object.assign({}, installP5Stub(), {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => ({ catch: () => {} }),
    confirm: () => false,
    document: { getElementById: () => null, createElement: () => ({ click: () => {} }) },
    Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    window: {}
});
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox);
// index.js declares state/ui/CS/PAD with const — lexical bindings are NOT sandbox
// properties, so export them explicitly for direct sandbox.X reads below.
vm.runInContext('globalThis.state = state; globalThis.ui = ui; globalThis.CS = CS; globalThis.PAD = PAD; globalThis.DEP_N = DEP_N; renderAll = function () {};', sandbox);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok  ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

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
