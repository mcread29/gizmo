/*
 * Rasterises the Gizmo logo into the PNG sizes the web manifest and iOS
 * home screen need, with no image library: the logo is a rounded square, a
 * stroked arc, three short strokes and three dots, all of which reduce to
 * distance tests. Run `node scripts/icons.mjs` after changing the logo.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const bg = [0xff, 0xc3, 0x94];
const ink = [0x19, 0x1b, 0x1f];

// The G is the arc of a circle centred (251, 256) r=142, from the top-right
// end (367,169) anticlockwise round to the bottom-right (370,345), then a
// horizontal bar at y=254 from x=303 to x=370, and a vertical from (370,254)
// to (370,345). Coordinates are in the 512 viewBox.
const arc = { cx: 251, cy: 256, r: 142, w: 46 };
const segments = [
	[[370, 254], [370, 345], 46],
	[[303, 254], [370, 254], 46],
	[[251, 254], [306, 254], 18],
	[[251, 254], [251, 195], 18],
	[[251, 254], [208, 297], 18],
];
const dots = [
	[251, 254, 17],
	[208, 297, 15],
];
const square = { x: 236, y: 179, s: 30, r: 7 };

function segmentDistance([ax, ay], [bx, by], x, y) {
	const dx = bx - ax;
	const dy = by - ay;
	const t = Math.max(
		0,
		Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)),
	);
	return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function roundedInside(x, y, left, top, size, radius) {
	const cx = Math.max(left + radius, Math.min(left + size - radius, x));
	const cy = Math.max(top + radius, Math.min(top + size - radius, y));
	return Math.hypot(x - cx, y - cy) <= radius;
}

function inkAt(x, y) {
	const angle = Math.atan2(y - arc.cy, x - arc.cx);
	// The gap of the G: the arc is absent between roughly -40° and +40°.
	const inGap = Math.abs(angle) < 0.62;
	if (
		!inGap &&
		Math.abs(Math.hypot(x - arc.cx, y - arc.cy) - arc.r) <= arc.w / 2
	)
		return true;
	for (const [a, b, w] of segments)
		if (segmentDistance(a, b, x, y) <= w / 2) return true;
	for (const [cx, cy, r] of dots)
		if (Math.hypot(x - cx, y - cy) <= r) return true;
	return roundedInside(x, y, square.x, square.y, square.s, square.r);
}

function crc32(buffer) {
	let c = ~0;
	for (const byte of buffer) {
		c ^= byte;
		for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
	}
	return ~c >>> 0;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function png(size, { padding = 0 } = {}) {
	const rows = [];
	const scale = 512 / (size - padding * 2);
	const samples = 3;
	for (let py = 0; py < size; py++) {
		const row = Buffer.alloc(1 + size * 4);
		for (let px = 0; px < size; px++) {
			let inside = 0;
			let dark = 0;
			for (let sy = 0; sy < samples; sy++)
				for (let sx = 0; sx < samples; sx++) {
					const x = (px - padding + (sx + 0.5) / samples) * scale;
					const y = (py - padding + (sy + 0.5) / samples) * scale;
					if (!roundedInside(x, y, 0, 0, 512, 116)) continue;
					inside++;
					if (inkAt(x, y)) dark++;
				}
			const total = samples * samples;
			const coverage = inside / total;
			const t = inside ? dark / inside : 0;
			const offset = 1 + px * 4;
			for (let i = 0; i < 3; i++)
				row[offset + i] = Math.round(bg[i] + (ink[i] - bg[i]) * t);
			row[offset + 3] = Math.round(coverage * 255);
		}
		rows.push(row);
	}
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header.set([8, 6, 0, 0, 0], 8);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(Buffer.concat(rows))),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

writeFileSync('apps/app/public/icons/icon-192.png', png(192));
// Maskable icons are cropped to a circle, so the logo sits inside a safe zone.
writeFileSync('apps/app/public/icons/icon-512.png', png(512, { padding: 56 }));
writeFileSync('apps/app/public/icons/apple-touch-icon.png', png(180));
console.log('wrote apps/app/public/icons');
