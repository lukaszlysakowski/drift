// Task 2 verification: curl-noise base field
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

vm.runInContext('ui.scale = 1; ui.strength = 1; state.masterSeed = 4242; regenerate(false);', sandbox);

// curl is divergence-free: ∇·curl(ψ) = ∂²ψ/∂x∂y − ∂²ψ/∂y∂x ≈ 0.
// Test the RAW (pre-normalization) curl directly from potential(), via central differences.
const div = vm.runInContext(`
    (function () {
        const H = 2, h = 1.5;
        function rawCurl(x, y) {
            const dpsi_dx = (potential(x + h, y) - potential(x - h, y)) / (2 * h);
            const dpsi_dy = (potential(x, y + h) - potential(x, y - h)) / (2 * h);
            return { vx: dpsi_dy, vy: -dpsi_dx };
        }
        let maxDiv = 0, scale = 0;
        for (let x = 300; x <= 1800; x += 300) {
            for (let y = 300; y <= 1800; y += 300) {
                const a = rawCurl(x + H, y), b = rawCurl(x - H, y);
                const c = rawCurl(x, y + H), d = rawCurl(x, y - H);
                const divergence = (a.vx - b.vx) / (2 * H) + (c.vy - d.vy) / (2 * H);
                maxDiv = Math.max(maxDiv, Math.abs(divergence));
                scale = Math.max(scale, Math.hypot(a.vx, a.vy));
            }
        }
        // relative divergence: |∇·v| should be tiny vs the field magnitude
        return scale > 1e-9 ? maxDiv / scale : maxDiv;
    })()
`, sandbox);
check('curl field ~divergence-free (relative)', div < 0.02, `relDiv ${div}`);

// baseField returns unit*FLOW_SPEED magnitude (=6) where field is non-degenerate
const speeds = vm.runInContext(`
    (function () {
        let bad = 0, n = 0;
        for (let x = 300; x <= 1800; x += 150) for (let y = 300; y <= 1800; y += 150) {
            const v = baseField(x, y); const m = Math.hypot(v.vx, v.vy);
            if (m > 1e-6) { n++; if (Math.abs(m - 6) > 1e-6) bad++; }
        }
        return [bad, n];
    })()
`, sandbox);
check('baseField normalized to FLOW_SPEED', speeds[0] === 0 && speeds[1] > 50, `bad ${speeds[0]} of ${speeds[1]}`);

// Field Scale changes feature size: Broad has lower spatial variation than Fine over a fixed window
const variation = (scaleIdx) => vm.runInContext(`
    (function () {
        ui.scale = ${scaleIdx}; state.masterSeed = 4242; regenerate(false);
        let sum = 0, prev = null;
        for (let x = 300; x <= 1800; x += 30) {
            const v = baseField(x, 1000);
            if (prev) sum += Math.abs(v.vx - prev.vx) + Math.abs(v.vy - prev.vy);
            prev = v;
        }
        return sum;
    })()
`, sandbox);
const fineVar = variation(0), broadVar = variation(2);
check('Fine field varies faster than Broad', fineVar > broadVar, `fine ${fineVar.toFixed(1)} vs broad ${broadVar.toFixed(1)}`);

// determinism
vm.runInContext('ui.scale = 1; state.masterSeed = 777; regenerate(false); globalThis.__v1 = JSON.stringify(baseField(900, 900));', sandbox);
vm.runInContext('state.masterSeed = 777; regenerate(false); globalThis.__v2 = JSON.stringify(baseField(900, 900));', sandbox);
check('determinism: baseField', sandbox.__v1 === sandbox.__v2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
