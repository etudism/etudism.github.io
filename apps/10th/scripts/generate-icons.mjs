import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const COLORS = {
  background: [41, 39, 34, 255],
  leftPage: [244, 239, 228, 255],
  rightPage: [219, 200, 184, 255],
  accent: [111, 73, 59, 255],
};

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function render(size, safeScale) {
  const stride = size * 4;
  const pixels = Buffer.alloc(stride * size);
  const center = size / 2;
  const scale = size * safeScale;
  const left = center - scale / 2;
  const top = center - scale / 2;
  const local = (x, y) => [left + x * scale, top + y * scale];
  const leftPage = [
    local(0.08, 0.2),
    local(0.29, 0.16),
    local(0.5, 0.28),
    local(0.5, 0.83),
    local(0.29, 0.72),
    local(0.08, 0.76),
  ];
  const rightPage = [
    local(0.5, 0.28),
    local(0.71, 0.16),
    local(0.92, 0.2),
    local(0.92, 0.76),
    local(0.71, 0.72),
    local(0.5, 0.83),
  ];
  const markerCenter = local(0.69, 0.44);
  const markerRadius = scale * 0.045;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let color = COLORS.background;
      if (pointInPolygon(x + 0.5, y + 0.5, leftPage)) color = COLORS.leftPage;
      if (pointInPolygon(x + 0.5, y + 0.5, rightPage)) color = COLORS.rightPage;
      if (
        Math.abs(x - center) < scale * 0.012 &&
        y > top + scale * 0.27 &&
        y < top + scale * 0.83
      ) {
        color = COLORS.accent;
      }
      const dx = x - markerCenter[0];
      const dy = y - markerCenter[1];
      if (dx * dx + dy * dy <= markerRadius * markerRadius)
        color = COLORS.accent;
      const markerStem =
        Math.abs(x - markerCenter[0]) < scale * 0.012 &&
        y > markerCenter[1] + markerRadius &&
        y < markerCenter[1] + scale * 0.19;
      const arrowLeft =
        Math.abs(
          y - (markerCenter[1] + scale * 0.19 + (x - markerCenter[0]) * 0.8),
        ) <
          scale * 0.014 &&
        x < markerCenter[0] &&
        x > markerCenter[0] - scale * 0.09;
      const arrowRight =
        Math.abs(
          y - (markerCenter[1] + scale * 0.19 - (x - markerCenter[0]) * 0.8),
        ) <
          scale * 0.014 &&
        x > markerCenter[0] &&
        x < markerCenter[0] + scale * 0.09;
      if (markerStem || arrowLeft || arrowRight) color = COLORS.accent;
      const offset = y * stride + x * 4;
      pixels.set(color, offset);
    }
  }

  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND"),
  ]);
}

const publicDirectory = resolve(import.meta.dirname, "../public");
await Promise.all([
  writeFile(resolve(publicDirectory, "icon-192.png"), render(192, 0.88)),
  writeFile(resolve(publicDirectory, "icon-512.png"), render(512, 0.88)),
  writeFile(
    resolve(publicDirectory, "icon-maskable-512.png"),
    render(512, 0.72),
  ),
]);

console.log("Generated 192px, 512px, and maskable PWA icons.");
