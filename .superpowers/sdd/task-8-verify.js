// Task 8 verification: full-pipeline integration check + README + soak
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

// Control-effects baseline checks
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
console.log('\nMulti-seed soak (Med/Full):\n');
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
