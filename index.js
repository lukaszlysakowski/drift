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
function rollField() {}
function runWaves() {}
function classifyPaths() {}

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

// export stubs — Task 7 replaces these
function exportSVG() {}
function exportPNG(scale) {}

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
