/**
 * コボルトの住処の見た目の確認：罠の印、掘った横穴、キノコの畑、隠れている住処の場面を作り、保存を書き出す。
 * 撮るのは tools/gallery/koboldshots.mjs（Node の Playwright）。
 *
 *   npx esbuild tools/gallery/koboldshots.ts --bundle --platform=node --outfile=build/koboldshots.js && node build/koboldshots.js [シード]
 *   node build.mjs && node tools/gallery/koboldshots.mjs
 */
import { mkdirSync, writeFileSync } from 'fs';
import { DAY_TICKS, World } from '../../src/world';

const seed = process.argv[2] || 'seed4';
const b64 = (u: Uint8Array) => Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
// 見た目の確認のため、見たマスは地図全体にする（霧で住処が隠れないように）
const save = (w: World, cam: { x: number; y: number; zoom: number }) => ({ v: 3, seed: w.map.seed, tick: w.tick, cam, speed: 0, seen: bits(new Uint8Array(w.seen.length).fill(1)), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), mana: b64(new Uint8Array(w.mana.buffer)), manaBorn: w.manaBorn, manaLeaked: w.manaLeaked, manaFaded: w.manaFaded, born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() });

mkdirSync('build/gallery/kobold', { recursive: true });
const w = new World(seed);
const e = w.eco as any;
const m = w.map;
const farmAt = (wr: any) => { let f = 0; const hx = Math.floor(wr.x / 16), hy = Math.floor(wr.y / 16); for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const k = (hy + dy) * m.w + hx + dx; if (w.fungus[k] >= 30) f++; } return f; };
type Mark = { x: number; y: number; label: string; color: string };
const out: { name: string; title: string; file: string; cam: { x: number; y: number; zoom: number }; marks: Mark[] }[] = [];
const marksOf = (wr: any): Mark[] => {
  const r: Mark[] = [];
  const d = wr.door;
  r.push({ x: (d % m.w) * 16 + 8, y: Math.floor(d / m.w) * 16 + 8, label: '入口', color: '#ffd24a' });
  r.push({ x: wr.x, y: wr.y, label: '横穴の奥', color: '#7fd0ff' });
  for (const t of e.traps.filter((t: any) => t.w === wr.id)) r.push({ x: (t.k % m.w) * 16 + 8, y: Math.floor(t.k / m.w) * 16 + 8, label: '罠', color: '#ff5050' });
  const hx = Math.floor(wr.x / 16), hy = Math.floor(wr.y / 16);
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const k = (hy + dy) * m.w + hx + dx; if (w.fungus[k] >= 30) r.push({ x: (k % m.w) * 16 + 8, y: Math.floor(k / m.w) * 16 + 8, label: 'キノコ' + w.fungus[k], color: '#c08cff' }); }
  for (const c of e.warrenMembers(wr)) if (e.isHidden(c)) r.push({ x: c.x, y: c.y, label: '隠れている', color: '#80ff9a' });
  return r;
};
const want = new Set(['den', 'hide']);
while (w.tick < DAY_TICKS * 25 && want.size) {
  for (let i = 0; i < 200; i++) { w.step(); if (w.tick % 20 === 0) w.updateSeen(); }
  for (const wr of e.warrens) {
    const traps = e.traps.filter((t: any) => t.w === wr.id).length;
    if (want.has('den') && (wr.tun ?? 0) >= 4 && traps >= 2 && farmAt(wr) >= 3) {
      const d = wr.door;
      const cx = ((d % m.w) * 16 + 8 + wr.x) / 2;
      const cy = (Math.floor(d / m.w) * 16 + 8 + wr.y) / 2;
      writeFileSync('build/gallery/kobold/den.json', JSON.stringify(save(w, { x: cx, y: cy, zoom: 4 })));
      out.push({ cam: { x: cx, y: cy, zoom: 4 }, marks: marksOf(wr), name: 'den', title: `住処：横穴・罠・キノコの畑（${seed}、${(w.tick / DAY_TICKS).toFixed(2)}日目、横穴の奥 ${Math.floor(wr.x / 16)},${Math.floor(wr.y / 16)}、入口 ${d % m.w},${Math.floor(d / m.w)}、罠 ${traps}、畑のマス ${farmAt(wr)}）`, file: 'build/gallery/kobold/den.json' });
      want.delete('den');
    }
    if (want.has('hide') && wr.hide === 1 && e.warrenMembers(wr).some((c: any) => e.isHidden(c))) {
      const hidden = e.warrenMembers(wr).filter((c: any) => e.isHidden(c)).length;
      writeFileSync('build/gallery/kobold/hide.json', JSON.stringify(save(w, { x: wr.x, y: wr.y, zoom: 3 })));
      out.push({ cam: { x: wr.x, y: wr.y, zoom: 3 }, marks: marksOf(wr), name: 'hide', title: `隠れている住処（${seed}、${(w.tick / DAY_TICKS).toFixed(2)}日目、奥に隠れている ${hidden} 匹は描かれない）`, file: 'build/gallery/kobold/hide.json' });
      want.delete('hide');
    }
  }
}
writeFileSync('build/gallery/kobold/scenes.json', JSON.stringify(out, null, 1));
console.log(out.map((o) => o.title).join('\n'), want.size ? `\n見つからない：${[...want].join(', ')}` : '');
