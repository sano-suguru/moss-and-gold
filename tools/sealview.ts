import { generate } from '../src/mapgen';
const m = generate(process.argv[2] || 'かしたれ');
let open = 0, sealed = 0, solid = 0;
for (let k = 0; k < m.w * m.h; k++) { if (m.solid[k]) solid++; else if (m.sealed[k]) sealed++; else if (!m.lava[k]) open++; }
console.log('open', open, 'sealed', sealed, 'solid', solid, 'shafts open', m.shafts.filter(s => !m.solid[s.y * m.w + s.x] && !m.sealed[s.y * m.w + s.x]).length, 'springs open', m.springs.filter(s => !m.sealed[s.y * m.w + s.x] && !m.solid[s.y * m.w + s.x]).length);
for (let y = 0; y < m.h; y += 3) { let r = ''; for (let x = 0; x < m.w; x += 2) { const k = y * m.w + x; r += m.solid[k] ? ' ' : m.lava[k] ? '~' : m.sealed[k] ? '·' : '#'; } console.log(r); }
