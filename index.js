// Drift — a curl-noise field that transports its own history.
// Family: palimpsest / core-samples / second-reading / fold / watershed / interference.

const CS = 2170;
const PAD = Math.round(CS * 0.04);
const PAPER = '#F7E6D4';
const INK = '#1A1613';
const RED = '#A93B2A';
const DEP_N = 300;                 // deposition grid resolution
const COUNTS = [400, 900, 1600];   // Particle Count: Low / Med / High
const WAVE_CAP = [1, 6, 14];       // Settle: Off / Light / Full

// Task 5: Waves — RK2 advection constants
const DT = 1;
const MAX_STEPS = 400;
const STALL_EPS = 0.4;   // page units/step; below this the path has stalled
const SETTLE_EPS = 0.02;
const MIN_PTS = 2;

const CONTROL_DEFS = [
    { key: 'scale',    label: 'Scale',    opts: ['Fine', 'Med', 'Broad'],              def: 1 },
    { key: 'strength', label: 'Strength', opts: ['Low', 'Med', 'High'],                def: 1 },
    { key: 'count',    label: 'Count',    opts: ['Low', 'Med', 'High'],                def: 1 },
    { key: 'seeding',  label: 'Seeding',  opts: ['Scattered', 'Edge', 'Clustered'],    def: 0 },
    { key: 'channel',  label: 'Channel',  opts: ['Off', 'Gentle', 'Strong'],           def: 1 },
    { key: 'settle',   label: 'Settle',   opts: ['Off', 'Light', 'Full'],              def: 1 },
    { key: 'wobble',   label: 'Wobble',   opts: ['Off', 'On'],                         def: 0 }
];

const ui = { scale: 1, strength: 1, count: 1, seeding: 0, channel: 1, settle: 1, wobble: 0 };

const state = {
    masterSeed: 1,
    field: null,          // {scale, strength, octaves, ...} rolled potential params
    dep: null,            // Float32Array DEP_N² deposition accumulator
    depMax: 1,            // current max of dep (for normalization)
    paths: [],            // array of {pts:[{x,y},...], meanD, totalD, cls:0|1}
    channelIdx: -1,       // index into paths of the red main channel
    wavesRun: 0
};

const ctrlButtons = {};

// --- pipeline hooks (filled in by later tasks) ---
const FLOW_SPEED = 6;   // target per-step speed in page units
const CURL_H = 1.5;     // finite-difference step for curl

// Seeded 2-octave value noise — self-contained so canvas and harness agree exactly.
function makeNoise2D(seed) {
    function hash(ix, iy) {
        let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 974634167)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    const smooth = t => t * t * (3 - 2 * t);
    function vnoise(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
        const u = smooth(fx), v = smooth(fy);
        return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }
    return function fbm(x, y) {
        return (vnoise(x, y) + 0.5 * vnoise(x * 2.07 + 19.3, y * 2.07 + 7.7)) / 1.5;
    };
}

function rollField() {
    // Field Scale → noise feature size (smaller ns = broader features)
    const ns = [0.0034, 0.0022, 0.0013][ui.scale];
    const strength = [0.7, 1.0, 1.45][ui.strength];
    state.field = {
        ns, strength,
        ox: random(1000), oy: random(1000),
        fbm: makeNoise2D(state.masterSeed + 4099)
    };
}

function potential(x, y) {
    const f = state.field;
    // scalar streamfunction ψ; amplitude in page units so curl ~ O(1) before normalization
    return f.fbm(x * f.ns + f.ox, y * f.ns + f.oy) * 900 * f.strength;
}

function baseField(x, y) {
    // v = curl(ψ) = (∂ψ/∂y, −∂ψ/∂x), central differences
    const dpsi_dx = (potential(x + CURL_H, y) - potential(x - CURL_H, y)) / (2 * CURL_H);
    const dpsi_dy = (potential(x, y + CURL_H) - potential(x, y - CURL_H)) / (2 * CURL_H);
    let vx = dpsi_dy, vy = -dpsi_dx;
    const m = Math.hypot(vx, vy);
    if (m < 1e-9) return { vx: 0, vy: 0 };
    return { vx: (vx / m) * FLOW_SPEED, vy: (vy / m) * FLOW_SPEED };
}

// --- Bent field: deposition feedback (slow + divert) ---
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
    if (gm > 1e-6) {
        // rot90 of unit gradient: (−gy, gx)
        const ux = -g.gy / gm, uy = g.gx / gm;
        const speed = Math.hypot(v.vx, v.vy);
        tx = DIVERT * fb * d * ux * speed;
        ty = DIVERT * fb * d * uy * speed;
    }
    return { vx: s * v.vx + tx, vy: s * v.vy + ty };
}

// Task 5 wave functions

function inRegion(x, y) {
    return x >= PAD && x <= CS - PAD && y >= PAD && y <= CS - PAD;
}

// Task 6: Classify paths — heavy/light classes + red main channel
const HEAVY_THRESH = 0.28;

function waveStarts(w) {
    const rng = seededRng((state.masterSeed + w * 9161) >>> 0);
    const P = COUNTS[ui.count];
    const span = CS - 2 * PAD;
    const pts = [];
    if (ui.seeding === 0) {
        // Scattered: uniform over the region
        for (let i = 0; i < P; i++) pts.push({ x: PAD + rng() * span, y: PAD + rng() * span });
    } else if (ui.seeding === 1) {
        // Edge: along one rolled border, jittered slightly inward
        const side = Math.floor(rng() * 4);
        for (let i = 0; i < P; i++) {
            const t = rng(), inset = PAD + rng() * span * 0.04;
            if (side === 0) pts.push({ x: PAD + t * span, y: inset });
            else if (side === 1) pts.push({ x: CS - inset, y: PAD + t * span });
            else if (side === 2) pts.push({ x: PAD + t * span, y: CS - inset });
            else pts.push({ x: inset, y: PAD + t * span });
        }
    } else {
        // Clustered: a few rolled Gaussian blobs
        const nBlobs = 2 + Math.floor(rng() * 3);
        const blobs = [];
        for (let b = 0; b < nBlobs; b++) blobs.push({ cx: PAD + rng() * span, cy: PAD + rng() * span, r: span * (0.04 + rng() * 0.06) });
        for (let i = 0; i < P; i++) {
            const b = blobs[Math.floor(rng() * nBlobs)];
            // Box-Muller-ish via two uniforms
            const a = rng() * Math.PI * 2, rad = b.r * Math.sqrt(rng());
            pts.push({ x: b.cx + Math.cos(a) * rad, y: b.cy + Math.sin(a) * rad });
        }
    }
    return pts;
}

// One RK2-midpoint streakline on the current frozen bentField.
function advect(start) {
    const pts = [{ x: start.x, y: start.y }];
    let x = start.x, y = start.y;
    for (let step = 0; step < MAX_STEPS; step++) {
        const k1 = bentField(x, y);
        const mx = x + 0.5 * DT * k1.vx, my = y + 0.5 * DT * k1.vy;
        const k2 = bentField(mx, my);
        const nx = x + DT * k2.vx, ny = y + DT * k2.vy;
        const sp = Math.hypot(nx - x, ny - y);
        if (sp < STALL_EPS) break;
        x = nx; y = ny;
        if (!inRegion(x, y)) { pts.push({ x, y }); break; }
        pts.push({ x, y });
    }
    return pts;
}

function sumArr(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }

function runWaves() {
    depReset();
    depNorm();
    state.paths = [];
    const maxWaves = WAVE_CAP[ui.settle];
    state.wavesRun = 0;
    for (let w = 0; w < maxWaves; w++) {
        // snapshot deposition before this wave for settle delta
        const before = state.dep.slice();
        // Phase 1: advect ALL particles on the frozen field (no splatting yet)
        const starts = waveStarts(w);
        const wavePaths = [];
        for (const s of starts) {
            const path = advect(s);
            if (path.length >= MIN_PTS) wavePaths.push(path);
        }
        // Phase 2: record + splat all paths, THEN smooth/normalize for the next wave
        for (const path of wavePaths) {
            state.paths.push({ pts: path, meanD: 0, totalD: 0, cls: 0 });
            for (const p of path) depSplat(p.x, p.y);
        }
        depSmooth();
        depNorm();
        state.wavesRun = w + 1;
        // settle delta vs before
        const afterSum = sumArr(state.dep);
        let diff = 0;
        for (let i = 0; i < state.dep.length; i++) diff += Math.abs(state.dep[i] - before[i]);
        const delta = diff / Math.max(afterSum, 1e-9);
        if (w > 0 && delta < SETTLE_EPS) break;
    }
}
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

function regenerate(newSeed) {
    if (newSeed) state.masterSeed = Math.floor(Math.random() * 1e9);
    randomSeed(state.masterSeed);
    rollField();
    runWaves();
    classifyPaths();
    renderAll();
}

// Small deterministic PRNG (mulberry32) for per-wave randomness — independent of p5's RNG.
function seededRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function wobblePts(pts) {
    if (!ui.wobble) return pts;
    randomSeed(pts[0].x * 0.01 + 50);
    return pts.map(p => ({ x: p.x + random(-1.2, 1.2), y: p.y + random(-1.2, 1.2) }));
}

// --- Deposition grid: splat, smooth, normalize, sample ---
const DEP_AMOUNT = 1;

function pageToGrid(x, y) {
    const span = CS - 2 * PAD;
    return { gx: ((x - PAD) / span) * DEP_N, gy: ((y - PAD) / span) * DEP_N };
}

function depReset() {
    state.dep = new Float32Array(DEP_N * DEP_N);
    state.depMax = 1;
}

function depSplat(x, y) {
    const { gx, gy } = pageToGrid(x, y);
    const ix = Math.floor(gx), iy = Math.floor(gy);
    if (ix < 0 || iy < 0 || ix >= DEP_N - 1 || iy >= DEP_N - 1) return;
    const fx = gx - ix, fy = gy - iy;
    const d = state.dep;
    d[iy * DEP_N + ix]         += DEP_AMOUNT * (1 - fx) * (1 - fy);
    d[iy * DEP_N + ix + 1]     += DEP_AMOUNT * fx * (1 - fy);
    d[(iy + 1) * DEP_N + ix]   += DEP_AMOUNT * (1 - fx) * fy;
    d[(iy + 1) * DEP_N + ix + 1] += DEP_AMOUNT * fx * fy;
}

function depSmooth() {
    const d = state.dep, n = DEP_N;
    const tmp = new Float32Array(n * n);
    // horizontal pass
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const l = x > 0 ? d[y * n + x - 1] : d[y * n + x];
            const r = x < n - 1 ? d[y * n + x + 1] : d[y * n + x];
            tmp[y * n + x] = (l + 2 * d[y * n + x] + r) / 4;
        }
    }
    // vertical pass
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const u = y > 0 ? tmp[(y - 1) * n + x] : tmp[y * n + x];
            const dn = y < n - 1 ? tmp[(y + 1) * n + x] : tmp[y * n + x];
            d[y * n + x] = (u + 2 * tmp[y * n + x] + dn) / 4;
        }
    }
}

function depNorm() {
    let m = 0;
    const d = state.dep;
    for (let i = 0; i < d.length; i++) if (d[i] > m) m = d[i];
    state.depMax = m > 1e-9 ? m : 1;
}

function depAt(x, y) {
    const { gx, gy } = pageToGrid(x, y);
    const ix = Math.floor(gx), iy = Math.floor(gy);
    if (ix < 0 || iy < 0 || ix >= DEP_N - 1 || iy >= DEP_N - 1) return 0;
    const fx = gx - ix, fy = gy - iy;
    const d = state.dep, n = DEP_N;
    const v = d[iy * n + ix] * (1 - fx) * (1 - fy) + d[iy * n + ix + 1] * fx * (1 - fy) +
        d[(iy + 1) * n + ix] * (1 - fx) * fy + d[(iy + 1) * n + ix + 1] * fx * fy;
    return v / state.depMax;
}

function depGrad(x, y) {
    const span = CS - 2 * PAD;
    const h = span / DEP_N; // one cell in page units
    return {
        gx: (depAt(x + h, y) - depAt(x - h, y)) / (2 * h),
        gy: (depAt(x, y + h) - depAt(x, y - h)) / (2 * h)
    };
}

function drawPoly(pts) {
    const w = wobblePts(pts);
    beginShape();
    for (const p of w) vertex(p.x, p.y);
    endShape();
}

function signatureText() {
    const d = new Date();
    const p2 = n => String(n).padStart(2, '0');
    return `Drift · seed ${state.masterSeed} · ${state.wavesRun} waves · ${state.paths.length} paths  ` +
        `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function renderAll() {
    background(PAPER);
    noFill();
    // streaks light then heavy (index-based so the channel exclusion is O(1), not indexOf)
    stroke(INK);
    strokeWeight(0.9);
    for (let i = 0; i < state.paths.length; i++) {
        if (i === state.channelIdx) continue;
        if (state.paths[i].cls === 0) drawPoly(state.paths[i].pts);
    }
    strokeWeight(1.6);
    for (let i = 0; i < state.paths.length; i++) {
        if (i === state.channelIdx) continue;
        if (state.paths[i].cls === 1) drawPoly(state.paths[i].pts);
    }
    // red main channel
    if (state.channelIdx >= 0 && state.paths[state.channelIdx]) {
        stroke(RED);
        strokeWeight(2.4);
        drawPoly(state.paths[state.channelIdx].pts);
    }
    // border + signature
    stroke(INK);
    strokeWeight(2.2);
    rect(PAD, PAD, CS - 2 * PAD, CS - 2 * PAD);
    noStroke();
    fill(INK);
    textSize(26);
    textAlign(LEFT, BASELINE);
    text(signatureText(), PAD, CS - PAD + 44);
    noFill();
}

function syncControlButtons() {
    for (const def of CONTROL_DEFS) {
        if (ctrlButtons[def.key]) ctrlButtons[def.key].textContent = def.opts[ui[def.key]];
    }
}

function randomizeAll() {
    for (const def of CONTROL_DEFS) {
        if (def.key === 'wobble') continue;
        ui[def.key] = Math.floor(Math.random() * def.opts.length);
    }
    syncControlButtons();
    regenerate(true);
}

function setupControls() {
    const panel = document.getElementById('controls');
    for (const def of CONTROL_DEFS) {
        const row = document.createElement('div');
        row.className = 'ctrl';
        const lab = document.createElement('span');
        lab.className = 'ctrl-name';
        lab.textContent = def.label;
        const btn = document.createElement('button');
        btn.className = 'ctrl-val';
        btn.textContent = def.opts[ui[def.key]];
        btn.addEventListener('click', () => {
            ui[def.key] = (ui[def.key] + 1) % def.opts.length;
            btn.textContent = def.opts[ui[def.key]];
            regenerate(false);
        });
        ctrlButtons[def.key] = btn;
        row.appendChild(lab);
        row.appendChild(btn);
        panel.appendChild(row);
    }
    document.getElementById('btn-random').addEventListener('click', randomizeAll);
    document.getElementById('btn-refresh').addEventListener('click', () => regenerate(true));
    document.getElementById('btn-svg').addEventListener('click', () => exportSVG());
    document.getElementById('btn-png').addEventListener('click', () => exportPNG(1));
    document.getElementById('btn-png4').addEventListener('click', () => exportPNG(4));
}

// Task 7: SVG pen passes + PNG export
function polyToPath(pts) {
    const w = wobblePts(pts);
    let d = `M ${w[0].x.toFixed(2)} ${w[0].y.toFixed(2)}`;
    for (let i = 1; i < w.length; i++) d += ` L ${w[i].x.toFixed(2)} ${w[i].y.toFixed(2)}`;
    return d;
}

function svgPass(label, color, weight, paths) {
    if (!paths.length) return '';
    let s = `  <g id="${label}" inkscape:groupmode="layer" inkscape:label="${label}" ` +
        `stroke="${color}" stroke-width="${weight}" fill="none" ` +
        `stroke-linecap="round" stroke-linejoin="round">\n`;
    for (const d of paths) s += `    <path d="${d}"/>\n`;
    s += '  </g>\n';
    return s;
}

function buildSVG() {
    const lightPaths = [], heavyPaths = [];
    let channelPath = null;
    for (let i = 0; i < state.paths.length; i++) {
        const p = state.paths[i];
        if (i === state.channelIdx) { channelPath = polyToPath(p.pts); continue; }
        (p.cls === 1 ? heavyPaths : lightPaths).push(polyToPath(p.pts));
    }
    const borderPath = `M ${PAD} ${PAD} L ${CS - PAD} ${PAD} L ${CS - PAD} ${CS - PAD} ` +
        `L ${PAD} ${CS - PAD} L ${PAD} ${PAD}`;
    let s = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ` +
        `width="${CS}" height="${CS}" viewBox="0 0 ${CS} ${CS}">\n`;
    s += `  <rect width="${CS}" height="${CS}" fill="${PAPER}"/>\n`;
    s += svgPass('Border', INK, 0.9, [borderPath]);
    s += svgPass('Streaks-light', INK, 0.4, lightPaths);
    s += svgPass('Streaks-heavy', INK, 0.8, heavyPaths);
    s += svgPass('Channel', RED, 1.1, channelPath ? [channelPath] : []);
    s += `  <g id="Signature" inkscape:groupmode="layer" inkscape:label="Signature">\n` +
        `    <text x="${PAD}" y="${CS - PAD + 44}" font-family="monospace" font-size="26" ` +
        `fill="${INK}">${signatureText()}</text>\n  </g>\n`;
    s += '</svg>\n';
    return s;
}

function exportSVG() {
    const blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `drift-seed${state.masterSeed}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportPNG(scale) {
    pixelDensity(scale);
    renderAll();
    saveCanvas(`drift-seed${state.masterSeed}-${scale}x`, 'png');
    pixelDensity(1);
    renderAll();
}

function setup() {
    const c = createCanvas(CS, CS);
    c.parent('canvas-container');
    pixelDensity(1);
    noLoop();
    setupControls();
    regenerate(true);
}

function draw() {}

function mousePressed() {
    if (mouseX >= 0 && mouseX <= CS && mouseY >= 0 && mouseY <= CS) regenerate(true);
}
