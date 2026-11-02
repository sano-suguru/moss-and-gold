import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ'); const e = w.eco as any; const m = w.map;
while (w.tick < DAY_TICKS * 0.5) w.step();
// 開けた所を探して、幼竜・若い竜・成竜を並べる
let bk = -1, bv = -1;
for (let y = 8; y < m.h - 8; y += 2) for (let x = 12; x < m.w - 12; x += 2) { let v = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -10; dx <= 10; dx++) { const k = (y + dy) * m.w + x + dx; if (!m.solid[k] && !m.sealed[k]) v++; } if (v > bv) { bv = v; bk = y * m.w + x; } }
const cx = (bk % m.w) * 16 + 8, cy = Math.floor(bk / m.w) * 16 + 8;
for (const c of e.list) if (Math.abs(c.x - cx) < 200 && Math.abs(c.y - cy) < 100) c.dead = 2;
const mk = (sp: number, x: number, st: number) => { const d = e.spawn(24, x, cy, 100, 100); d.sp = sp; d.st = st; d.dir = 2; d.act = 1; return d; };
const el = (k: number, elite: number, x: number, y: number) => { const c = e.spawn(k, x, y, 20, 20); c.elite = elite; c.dir = 2; c.act = 0; e.nameOf(c); return c; };
el(5, 6, cx - 100, cy - 20); el(0, 7, cx - 50, cy - 20); el(8, 9, cx + 10, cy - 20);
const bd = el(24, 8, cx + 90, cy + 40); bd.sp = 2;
el(11, 1, cx - 90, cy + 40); el(7, 2, cx - 30, cy + 40);
for (const c of e.list) { c.px = c.x; c.py = c.y; }
const b64 = (u: Uint8Array) => Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) b[i >> 3] |= 1 << (i & 7); return b64(b); };
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: m.seed, tick: w.tick, cam: { x: cx, y: cy + 20, zoom: 3, q: '#lit' }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, mana: b64(new Uint8Array(w.mana.buffer)), manaBorn: w.manaBorn, manaLeaked: w.manaLeaked, manaFaded: w.manaFaded, digs: w.digs.slice(), eco: e.serialize() }));
console.log('ok');
