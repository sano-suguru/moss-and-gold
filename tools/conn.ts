import { generate } from '../src/mapgen';
for (const seed of ['かしたれ', 'abc', 'はじまりの洞窟', 'ぬもせろ', 'test1']) {
  const m = generate(seed);
  const comps = (ok: (k: number) => boolean) => {
    const seen = new Int32Array(m.w * m.h).fill(-1); const sizes: number[] = [];
    for (let s = 0; s < m.w * m.h; s++) {
      if (!ok(s) || seen[s] >= 0) continue;
      const st = [s]; seen[s] = sizes.length; let n = 0;
      while (st.length) { const c = st.pop()!; n++; const x = c % m.w, y = (c / m.w) | 0;
        for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) { if (nx<0||ny<0||nx>=m.w||ny>=m.h) continue; const q = ny*m.w+nx; if (ok(q) && seen[q] < 0) { seen[q] = sizes.length; st.push(q); } } }
      sizes.push(n);
    }
    return sizes.sort((a, b) => b - a);
  };
  const floor = comps(k => !m.solid[k]);
  const walk = comps(k => !m.solid[k] && !m.lava[k]);
  console.log(seed, 'floor comps', floor.length, floor.slice(0, 4), '| walkable(no lava)', walk.length, walk.slice(0, 4));
}
