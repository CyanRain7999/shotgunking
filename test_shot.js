'use strict';
/* Offline screenshot renderer: fakes a canvas 2d context with a pixel buffer,
   renders game states and writes PNG files for visual QA. */
const fs = require('fs');
const zlib = require('zlib');

function parseColor(str) {
  if (typeof str !== 'string') return [255, 255, 255, 1];
  if (str[0] === '#') {
    const v = parseInt(str.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1];
  }
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  return [255, 255, 255, 1];
}

function makeCtx(w, h) {
  const buf = Buffer.alloc(w * h * 3);
  let fill = '#000', alpha = 1, tx = 0, ty = 0, sx = 1, sy = 1;
  return {
    imageSmoothingEnabled: true,
    fillStyle: '#000',
    globalAlpha: 1,
    set fillStyle(v) { fill = v; },
    get fillStyle() { return fill; },
    set globalAlpha(v) { alpha = v; },
    get globalAlpha() { return alpha; },
    setTransform(a, b, c, d, e, f) { sx = a || 1; sy = d || 1; tx = e || 0; ty = f || 0; },
    translate(x, y) { tx += x * sx; ty += y * sy; },
    clearRect() { buf.fill(0); },
    save() {}, restore() {}, rotate() {}, scale() {},
    fillRect(x, y, wd, ht, c) {
      const col = parseColor(c || fill);
      const a = col[3] * alpha;
      if (a <= 0) return;
      const x0 = Math.round(x * sx + tx), y0 = Math.round(y * sy + ty);
      const x1 = Math.min(w, x0 + Math.round(wd * sx));
      const y1 = Math.min(h, y0 + Math.round(ht * sy));
      for (let yy = Math.max(0, y0); yy < y1; yy++) {
        for (let xx = Math.max(0, x0); xx < x1; xx++) {
          const i = (yy * w + xx) * 3;
          buf[i] = Math.round(buf[i] * (1 - a) + col[0] * a);
          buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + col[1] * a);
          buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + col[2] * a);
        }
      }
    },
    buffer: buf
  };
}

/* ---- minimal PNG encoder ---- */
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function writePNG(path, buf, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    buf.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(path, png);
}

/* ---- fake DOM boot so game.js sets its internal ctx ----
   Simulates a phone in landscape: 844x390 CSS px @ DPR 3. */
function makeClassList() { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), contains: c => s.has(c) }; }
function makeEl(id) {
  return {
    id, classList: makeClassList(), innerHTML: '', textContent: '', style: {}, dataset: {}, listeners: {},
    addEventListener() {}, appendChild() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 665, height: 374 }; }
  };
}
const els = {};
const idList = ['game','cardOverlay','cards','cardStats','endOverlay','endTitle','endStats','endNote','btnEndless','btnStart','btnAgain','btnSkip','startOverlay','btnInstall','itemOverlay','itemCards','itemStats','btnItemSkip','chapterList','btnPlay','modeNote'];
for (const id of idList) els[id] = makeEl(id);
const BUFFER_W = 1920, BUFFER_H = 1080;      // SCALE=4 backing store (665 css * dpr3)
const cctx = makeCtx(BUFFER_W, BUFFER_H);
els['game'].getContext = () => cctx;
global.document = {
  getElementById: id => els[id],
  createElement: () => makeEl('x'),
  querySelectorAll: () => [],
  addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') fn(); }
};
global.window = { innerWidth: 844, innerHeight: 390, devicePixelRatio: 3, addEventListener() {} };
global.requestAnimationFrame = () => 1;
global.performance = { now: () => Date.now() };

const G = require('./game.js');

function shot(name, g, hover) {
  g.shake = 0;
  if (hover !== undefined) g.hover = hover;
  G.render(g);
  writePNG(__dirname + '/shots/' + name + '.png', cctx.buffer, BUFFER_W, BUFFER_H);
}
fs.mkdirSync(__dirname + '/shots', { recursive: true });

// deterministic seed
let s = 12345;
Math.random = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };

function dumpASCII(path, buf, w, h, step) {
  const ramp = ' .:-=+*#%@';
  const lines = [];
  for (let y = 0; y < h; y += step) {
    let line = '';
    for (let x = 0; x < w; x += step) {
      let sum = 0, n = 0;
      for (let yy = y; yy < Math.min(h, y + step); yy++) {
        for (let xx = x; xx < Math.min(w, x + step); xx++) {
          const i = (yy * w + xx) * 3;
          sum += (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
          n++;
        }
      }
      const v = n ? sum / n : 0;
      line += ramp[Math.min(ramp.length - 1, Math.floor(v / 256 * ramp.length))];
    }
    lines.push(line);
  }
  fs.writeFileSync(path, lines.join('\n'));
}

const g = G.newGame('classic');
G.spawnFloor(g);
shot('1_classic_floor1', g, { x: 4, y: 2, angle: -90, sx: 121, sy: 82 });
dumpASCII(__dirname + '/shots/ascii_classic.txt', cctx.buffer, BUFFER_W, BUFFER_H, 16);

for (let i = 0; i < g.weapons.length; i++) {
  g.weapon = i;
  shot('2_weapon_' + g.weapons[i].id, g, { x: 4, y: 2, angle: -90, sx: 121, sy: 82 });
}

const go = G.newGame('obstacle');
G.spawnFloor(go);
shot('3_obstacle', go, { x: 4, y: 3, angle: -90, sx: 121, sy: 109 });

const gs = G.newGame('sniper');
G.spawnFloor(gs);
const k = G.whiteKing(gs);
const ang = Math.atan2((k.y + 0.5) - 7.5, (k.x + 0.5) - 4.5) * 180 / Math.PI;
shot('4_sniper', gs, { x: k.x, y: k.y, angle: ang, sx: 121, sy: 80 });

const gm = G.newGame('musou');
G.spawnFloor(gm);
shot('5_musou', gm, { x: 4, y: 3, angle: -60, sx: 121, sy: 109 });

console.log('shots written:', fs.readdirSync(__dirname + '/shots').join(', '));
