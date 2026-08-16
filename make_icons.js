'use strict';
/* Generates PWA icons (pixel-art black king + crown + shotgun) as PNGs. */
const fs = require('fs');
const zlib = require('zlib');

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
function writePNG(path, buf, size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    buf.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(path, png);
}

function hexToRgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function makeIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 3);
  const scale = maskable ? 0.75 : 1;
  const unit = size / 16 * scale;
  const ox = (size - 16 * unit) / 2;
  const px = (x, y, w, h, col) => {
    const [r, g, b] = hexToRgb(col);
    const x0 = Math.round(ox + x * unit), y0 = Math.round(ox + y * unit);
    const x1 = Math.min(size, Math.round(ox + (x + w) * unit));
    const y1 = Math.min(size, Math.round(ox + (y + h) * unit));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * size + xx) * 3;
        buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
      }
    }
  };

  // background
  px(0, 0, 16, 16, '#0c0d12');
  // gold border
  px(0, 0, 16, 1, '#e8c34a');
  px(0, 15, 16, 1, '#e8c34a');
  px(0, 0, 1, 16, '#e8c34a');
  px(15, 0, 1, 16, '#e8c34a');

  // crown
  px(3, 7, 10, 2, '#e8c34a');                    // band
  px(4, 9, 8, 1, '#b58a2e');                    // band shadow
  px(3, 4, 3, 4, '#e8c34a');                    // left point
  px(6, 2, 4, 6, '#e8c34a');                    // center point
  px(10, 4, 3, 4, '#e8c34a');                   // right point
  px(4, 5, 1, 2, '#d84a4a');                    // left jewel
  px(7, 3, 2, 2, '#d84a4a');                    // center jewels
  px(11, 5, 1, 2, '#d84a4a');                   // right jewel
  px(7, 0, 2, 3, '#e8c34a');                    // cross
  px(6, 1, 4, 1, '#e8c34a');

  // black king head under the crown
  px(5, 10, 6, 4, '#2b2d3a');
  px(4, 11, 8, 2, '#2b2d3a');
  px(6, 11, 1, 1, '#d9dce8');                   // eyes
  px(9, 11, 1, 1, '#d9dce8');
  px(7, 13, 2, 1, '#565966');                   // beard

  // shotgun, bottom-right
  px(7, 14, 3, 2, '#3d2c1c');                   // stock
  px(10, 14, 5, 1, '#7c8296');                  // barrel
  px(14, 13, 1, 3, '#4d5262');                  // muzzle
  px(11, 15, 2, 1, '#ffd75e');                  // shell
  return buf;
}

fs.mkdirSync(__dirname + '/icons', { recursive: true });
writePNG(__dirname + '/icons/icon-192.png', makeIcon(192, false), 192);
writePNG(__dirname + '/icons/icon-512.png', makeIcon(512, false), 512);
writePNG(__dirname + '/icons/icon-maskable-512.png', makeIcon(512, true), 512);
writePNG(__dirname + '/icons/apple-touch-icon.png', makeIcon(180, false), 180);
console.log('icons generated: icon-192, icon-512, icon-maskable-512, apple-touch-icon');
