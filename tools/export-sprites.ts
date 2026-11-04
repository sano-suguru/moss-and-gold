// 生き物のドット絵を PNG のスプライトシートと、各フレームの位置を書いた JSON に書き出す。
// 使い方: npx esbuild tools/export-sprites.ts --bundle --platform=node --outfile=build/export.js && node build/export.js
// 書き出した PNG はドット絵ツールで手直しできる（アルファ 255 は体、254 は輪郭や目、253 はそれ自体が光る部分）。
import { mkdirSync, writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { ACTS, DIRS, SPECIES, buildAtlas } from '../src/atlas';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w: number, h: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
}

const a = buildAtlas();
mkdirSync('assets/sprites', { recursive: true });
writeFileSync('assets/sprites/atlas.png', png(a.width, a.height, a.data));
const index: Record<string, unknown> = {};
SPECIES.forEach((s, si) =>
  DIRS.forEach((d, di) =>
    ACTS.forEach((ac, ai) => {
      for (let f = 0; f < 4; f++) for (let b = 0; b < (si === 0 ? 2 : 1); b++) index[`${s}/${d}/${ac}/${f}${si === 0 ? (b ? '/bright' : '/dim') : ''}`] = a.frames[a.index(si, di, ai, f, b)];
    }),
  ),
);
for (const [name, nv] of [['zrat', 1], ['zlizard', 1], ['slime', 3], ['ghost', 1], ['myconid', 1], ['ant', 2], ['kobold', 1], ['salamander', 1], ['goblin', 3], ['orc', 2], ['lizardman', 1], ['minotaur', 1], ['troll', 1], ['basilisk', 1], ['gargoyle', 1], ['vampire', 1], ['golem', 1], ['mimic', 1], ['worm', 1], ['wyvern', 1], ['dragon', 2], ['adv', 8], ['adv2', 3], ['skel', 7], ['lich', 1], ['dwarf', 3], ['armor', 20]] as [string, number][])
  DIRS.forEach((d, di) => ACTS.forEach((ac, ai) => { for (let f = 0; f < 4; f++) for (let v = 0; v < nv; v++) index[`${name}/${d}/${ac}/${f}${nv > 1 ? '/' + (name === 'armor' ? `look${v}` : (name === 'ant' ? ['empty', 'carrying'] : ['small', 'mid', 'large'])[v]) : ''}`] = a.frames[a.named(name, di, ai, f, v)]; }));
for (const [si, name] of [[1, 'bat'], [2, 'rat'], [3, 'lizard'], [4, 'spider'], [9, 'ant'], [10, 'kobold'], [11, 'salamander'], [12, 'goblin'], [13, 'orc'], [14, 'lizardman'], [15, 'minotaur'], [16, 'troll'], [17, 'basilisk'], [18, 'gargoyle'], [19, 'vampire'], [20, 'mimic'], [21, 'golem'], [23, 'wyvern'], [24, 'dragon'], [25, 'adventurer'], [26, 'skeleton'], [27, 'lich'], [28, 'dwarf']] as [number, string][])
  ['fresh', 'rotting', 'bones'].forEach((st, i) => { index[`corpse/${name}/${st}`] = a.frames[a.corpse(si, i)]; });
index['web'] = a.frames[a.web];
index['anthill'] = a.frames[a.anthill];
index['goblin-camp'] = a.frames[a.camp];
index['reed-hut'] = a.frames[a.hut];
for (let sz = 0; sz < 3; sz++) for (let f = 0; f < 4; f++) index[`treasure/${['small', 'mid', 'large'][sz]}/${f}`] = a.frames[a.treasure(sz, f)];
index['worm-segment/body'] = a.frames[a.wormSeg(0)];
index['worm-segment/tail'] = a.frames[a.wormSeg(1)];
for (let kd = 0; kd < 11; kd++) for (let f = 0; f < 4; f++) index[`item/${['torch', 'stub', 'sword', 'shield', 'staff', 'mace', 'dagger', 'symbol', 'lute', 'bow', 'greatsword'][kd]}/${f}`] = a.frames[a.item(kd, f)];
for (let f = 0; f < 4; f++) { index[`dragon-breath/side/${f}`] = a.frames[a.breath(false, f)]; index[`dragon-breath/down/${f}`] = a.frames[a.breath(true, f)]; }
index['burrow'] = a.frames[a.burrow];
writeFileSync('assets/sprites/atlas.json', JSON.stringify(index, null, 1));
console.log(`assets/sprites/atlas.png ${a.width}x${a.height}, ${Object.keys(index).length} frames`);
