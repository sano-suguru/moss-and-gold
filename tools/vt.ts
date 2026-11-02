import { generate } from '../src/mapgen';
let nv = 0, nd = 0;
for (let i = 0; i < 30; i++) { const m = generate('seed' + i); if (m.vaultCenter.x >= 0) nv++; if (m.deep.x >= 0) nd++; }
console.log('vault', nv, 'deep', nd);
const m = generate('かしたれ'); console.log(m.vaultCenter, m.deep, m.hoards);
const v = m.vaultCenter; for (let y = v.y - 6; y <= v.y + 6; y++) { let r = ''; for (let x = v.x - 10; x <= v.x + 10; x++) { const k = y * m.w + x; r += m.solid[k] ? '#' : m.vault[k] ? 'v' : '.'; } console.log(r); }
