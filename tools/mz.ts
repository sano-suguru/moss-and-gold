import { generate } from '../src/mapgen';
for (const seed of ['かしたれ', 'abc', 'test1', 'seed7']) {
  const m = generate(seed); let n = 0, x0 = 999, y0 = 999;
  for (let k = 0; k < m.w * m.h; k++) if (m.maze[k]) { n++; x0 = Math.min(x0, k % m.w); y0 = Math.min(y0, (k / m.w) | 0); }
  console.log(seed, 'maze tiles', n, 'at', x0, y0);
  if (seed === 'かしたれ' && n) for (let y = y0 - 3; y < y0 + 18; y++) { let r = ''; for (let x = x0 - 4; x < x0 + 27; x++) { const k = y * m.w + x; r += m.solid[k] ? '#' : m.maze[k] ? '+' : '.'; } console.log(r); }
}
