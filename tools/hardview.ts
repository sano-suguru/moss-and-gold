import { generate } from '../src/mapgen';
const m = generate(process.argv[2] || 'かしたれ');
const cnt = [0, 0, 0]; for (let k = 0; k < m.w * m.h; k++) if (m.solid[k]) cnt[m.hard[k]]++;
console.log('岩の硬さ（柔らかい, ふつう, 硬い）', cnt);
for (let y = 0; y < m.h; y += 3) { let r = ''; for (let x = 0; x < m.w; x += 2) { const k = y * m.w + x; r += !m.solid[k] ? ' ' : ['░', '▒', '█'][m.hard[k]]; } console.log(r); }
