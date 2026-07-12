// Task 5 verification: waves — RK2 advection, seeding, deposition, settle loop
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
vm.runInContext('globalThis.state = state; globalThis.ui = ui; globalThis.CS = CS; globalThis.PAD = PAD; globalThis.advect = advect; renderAll = function () {};', sandbox);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok  ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

vm.runInContext('ui.scale = 1; ui.strength = 1; ui.count = 0; ui.seeding = 0; ui.channel = 1; ui.settle = 2; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;

const MARGIN = 35;
check('paths produced', st.paths.length > 0, `${st.paths.length}`);
check('all paths have >=2 pts', st.paths.every(p => p.pts.length >= 2));
check('all path vertices in region (±MARGIN exit overshoot)', st.paths.every(p => p.pts.every(v => v.x >= 87 - MARGIN && v.x <= 2170 - 87 + MARGIN && v.y >= 87 - MARGIN && v.y <= 2170 - 87 + MARGIN)));
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
