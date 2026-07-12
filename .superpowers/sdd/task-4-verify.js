// Task 4 verification: bent field with deposition feedback
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
vm.runInContext('globalThis.state = state; globalThis.ui = ui; globalThis.CS = CS; globalThis.PAD = PAD; renderAll = function () {};', sandbox);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok  ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

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
        depReset(); for (let i=0;i<60;i++) depSplat(900,900); depSmooth(); depNorm();
        const x = 890, y = 900; // beside the pile → nonzero gradient
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
