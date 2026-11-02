import { generate, MAP_W } from '../src/mapgen';
const m = generate('かしたれ');
// 光の筋の近くで、半径6マス以内に岩が多い場所を探す
let best = null as any, bs = -1;
for (const s of m.shafts) {
  let n = 0;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -8; dx <= 8; dx++) n += m.solid[(s.y + dy) * MAP_W + s.x + dx] ? 1 : 0;
  if (n > bs) { bs = n; best = s; }
}
// 柱のある部屋
const pillarRoom = m.rooms.find(r => { for (let y=r.y;y<r.y+r.h;y++) for (let x=r.x;x<r.x+r.w;x++) if (m.solid[y*MAP_W+x]) return true; return false; });
console.log(JSON.stringify({ shaft: best, walls: bs, pillarRoom }));
