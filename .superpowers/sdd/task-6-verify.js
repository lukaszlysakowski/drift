// Task 6 verification: classify paths — heavy/light classes + red main channel
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
