// Task 1 verification: skeleton loads, regenerates, deterministic seed plumbing
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

check('CS is 2170', sandbox.CS === 2170);
check('PAD is 87', sandbox.PAD === 87);
check('ui defaults', sandbox.ui.channel === 1 && sandbox.ui.settle === 1 && sandbox.ui.wobble === 0);
vm.runInContext('state.masterSeed = 123; regenerate(false);', sandbox);
check('regenerate(false) keeps seed', sandbox.state.masterSeed === 123);
const r = vm.runInContext('const g = seededRng(42); [g(), g(), g()]', sandbox);
const r2 = vm.runInContext('const h = seededRng(42); [h(), h(), h()]', sandbox);
check('seededRng deterministic + in [0,1)', JSON.stringify(r) === JSON.stringify(r2) && r.every(v => v >= 0 && v < 1), JSON.stringify(r));
const sig = vm.runInContext('signatureText()', sandbox);
check('signature format', /^Drift · seed 123 · \d+ waves · \d+ paths  \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(sig), sig);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
