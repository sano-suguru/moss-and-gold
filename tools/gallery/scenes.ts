/**
 * ビジュアル確認用の固定シーンを作る（シミュレーションを実行して、シーンごとのセーブデータとカメラ位置を書き出す）。
 *
 *   npm run gallery            （シーンを作り、スクリーンショットを撮り、一覧画像 build/gallery/sheet.png を作る）
 *   npm run gallery -- --label before   （撮った画像を build/gallery/before/ に残す）
 *   npm run gallery -- --compare before （現在の画像と before を左右に並べた比較画像を作る）
 *
 * シーンは SCENES に並べる。find は、その時刻のワールドから見たい場所を探してカメラ位置を返す関数。
 *
 * 高速化：シミュレーションのコード（src の world, ecology, mapgen, rng, names）とこのファイルが前回と同じなら、
 * シーンは作り直さない（描画だけ直したときは、スクリーンショットを撮るだけになる。--fresh で必ず作り直す）。シードごとに別のプロセスで並列に作る。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { DAY_TICKS, World } from '../../src/world';

type Cam = { x: number; y: number; zoom: number };
type Scene = { name: string; title: string; seed: string; day: number; phase?: number; zoom: number; device?: 'desktop' | 'phone'; search?: number; find: (w: World) => Cam | null };

const T = 16;
const first = <T>(a: T[], f: (x: T) => boolean) => a.find(f);
const SCENES: Scene[] = [
  { name: 'vault', title: '宝物庫とゴーレム', seed: 'abc', day: 2, phase: 0.5, zoom: 3, find: (w) => { const g = first(w.eco.list, (c) => c.k === 21 && !c.dead); return g ? { x: Math.round(g.x), y: Math.round(g.y) - 30, zoom: 3 } : null; } },
  { name: 'goldpiles', title: '宝の山（いろいろな量）', seed: 'かしたれ', day: 8, phase: 0.5, zoom: 3, search: 4, find: (w) => { const p = w.eco.piles.filter((q) => q.gold >= 40 && w.eco.pileOwner(q) !== 'vault').sort((a, b) => b.gold - a.gold)[0]; return p ? { x: p.x, y: p.y, zoom: 3 } : null; } },
  { name: 'entrance', title: '正面の入口（昼）', seed: 'かしたれ', day: 0, phase: 0.4, zoom: 3, find: (w) => ({ x: w.map.entrance.x * T + 16, y: 60, zoom: 3 }) },
  { name: 'entranceN', title: '正面の入口（夜）', seed: 'かしたれ', day: 0, phase: 0.9, zoom: 3, find: (w) => ({ x: w.map.entrance.x * T + 16, y: 60, zoom: 3 }) },
  { name: 'start', title: '始まりの洞窟（昼）', seed: 'かしたれ', day: 0, phase: 0.45, zoom: 2, find: (w) => { const s = w.map.shafts.find((q) => !w.map.sealed[q.y * w.map.w + q.x]); return s ? { x: s.x * T + 8, y: s.y * T + 8, zoom: 2 } : null; } },
  { name: 'night', title: '始まりの洞窟（夜）', seed: 'かしたれ', day: 0, phase: 0.95, zoom: 2, find: (w) => { const s = w.map.shafts.find((q) => !w.map.sealed[q.y * w.map.w + q.x]); return s ? { x: s.x * T + 8, y: s.y * T + 8, zoom: 2 } : null; } },
  { name: 'sealed', title: '閉じた空洞の縁', seed: 'かしたれ', day: 1, phase: 0.6, zoom: 2, find: (w) => { const m = w.map; for (let k = m.w * 10; k < m.solid.length - m.w * 10; k += 3) { if (!m.sealed[k] || m.solid[k]) continue; for (const d of [4, -4]) { const q = k + d; if (!m.solid[q] && !m.sealed[q] && !m.lava[q]) return { x: (k % m.w) * T + d * 8, y: Math.floor(k / m.w) * T, zoom: 2 }; } } return null; } },
  { name: 'strata', title: '岩の地層（夜）', seed: 'かしたれ', day: 2, phase: 0.95, zoom: 2, find: () => ({ x: 1500, y: 1150, zoom: 2 }) },
  { name: 'lava', title: '溶岩と微生物の膜', seed: 'かしたれ', day: 6, phase: 0.6, zoom: 3, find: (w) => { const m = w.map; let b = -1, bv = 0; for (let k = 0; k < m.solid.length; k++) { if (!m.lava[k] || m.sealed[k]) continue; let v = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) v += w.mat[k + dy * m.w + dx] ?? 0; if (v > bv) { bv = v; b = k; } } return b >= 0 ? { x: (b % m.w) * T + 8, y: Math.floor(b / m.w) * T + 8, zoom: 3 } : null; } },
  { name: 'camp', title: '冒険者の焚き火', seed: 'かしたれ', day: 2, phase: 0.1, zoom: 4, search: 10, find: (w) => { const p = w.eco.parties.find((q) => (q.camp ?? -1) >= 0); return p ? { x: (p.camp! % w.map.w) * T + 8, y: Math.floor(p.camp! / w.map.w) * T + 8, zoom: 4 } : null; } },
  { name: 'dragon', title: '眠るドラゴン', seed: 'abc', day: 6, phase: 0.3, zoom: 3, search: 8, find: (w) => { const d = first(w.eco.list, (c) => c.k === 24 && !c.dead && c.sleep === 2); return d ? { x: Math.round(d.x), y: Math.round(d.y), zoom: 3 } : null; } },
  { name: 'lair', title: 'ミノタウロスの寝床（引きずってきた獲物の骨）', seed: 'seed18', day: 15, phase: 0.5, zoom: 3, search: 2, find: (w) => { const m = w.map; if (m.lair.x < 0) return null; const bx = m.lair.x * T + 8; const by = m.lair.y * T + 8; const near = (c: { x: number; y: number }, r: number) => Math.abs(c.x - bx) < r * T && Math.abs(c.y - by) < r * T; const bones = w.eco.list.filter((c) => c.dead === 1 && c.units > 0 && near(c, 4)).length; const mi = first(w.eco.list, (c) => c.k === 15 && !c.dead && near(c, 5)); return mi && bones >= 2 ? { x: bx, y: by, zoom: 3 } : null; } },
  { name: 'sleepers', title: '眠る生き物（群れで眠る）', seed: 'abc', day: 4, phase: 0.5, zoom: 4, search: 3, find: (w) => { let best: { x: number; y: number } | null = null; let bn = 2; for (const c of w.eco.list) { if (c.dead || c.sleep <= 0 || c.k === 1 || c.k === 24) continue; let n = 0; for (const o of w.eco.list) if (!o.dead && o.sleep > 0 && Math.abs(o.x - c.x) < 60 && Math.abs(o.y - c.y) < 40) n++; if (n > bn) { bn = n; best = c; } } return best ? { x: Math.round(best.x), y: Math.round(best.y), zoom: 4 } : null; } },
  { name: 'bats', title: 'ねぐらで眠るコウモリ（昼）', seed: 'かしたれ', day: 3, phase: 0.45, zoom: 4, search: 4, find: (w) => { const b = first(w.eco.list, (c) => c.k === 1 && !c.dead && c.sleep === 2 && !w.map.sealed[Math.floor(c.y / 16 + 1) * w.map.w + Math.floor(c.x / 16)]); return b ? { x: Math.round(b.x), y: Math.round(b.y) + 20, zoom: 4 } : null; } },
  { name: 'dwarves', title: 'ドワーフの広間', seed: 'abc', day: 3.2, phase: 0.6, zoom: 3, find: (w) => { const h = w.eco.hold; return h ? { x: (h.hk % w.map.w) * T + 8, y: Math.floor(h.hk / w.map.w) * T + 8, zoom: 3 } : null; } },
  { name: 'fissure', title: '地底の裂け目', seed: 'abc', day: 12, phase: 0.45, zoom: 3, find: (w) => { const mo = w.map.mouths.find((q) => q.kind === 1); return mo ? { x: mo.x * T + 8, y: mo.y * T + 8, zoom: 3 } : null; } },
  { name: 'sidecave', title: '地表の横穴', seed: 'abc', day: 12, phase: 0.45, zoom: 3, find: (w) => { const i = w.map.mouths.findIndex((q, j) => q.kind === 0 && w.eco.mouthOpen(j)); if (i < 0) return null; const [x, y] = w.eco.mouthSpot(i); const mo = w.map.mouths[i]; return { x: x + (mo.y === 0 ? 0 : mo.x === 0 ? 60 : -60), y: y + (mo.y === 0 ? 40 : 0), zoom: 3 }; } },
  { name: 'river', title: '地下の川の口', seed: 'abc', day: 12, phase: 0.45, zoom: 3, find: (w) => { const mo = w.map.mouths.find((q) => q.kind === 2); return mo ? { x: mo.x * T + 8, y: mo.y * T + 8, zoom: 3 } : null; } },
  { name: 'warren', title: 'コボルトの住処（横穴・罠・畑）', seed: 'abc', day: 3.5, phase: 0.4, zoom: 4, search: 12, find: (w) => { const e = w.eco as any; const wr = e.warrens.find((o: any) => (o.tun ?? 0) >= 4 && e.traps.filter((t: any) => t.w === o.id).length >= 2); if (!wr) return null; const d = wr.door; return { x: Math.round(((d % w.map.w) * T + 8 + wr.x) / 2), y: Math.round((Math.floor(d / w.map.w) * T + 8 + wr.y) / 2), zoom: 4 }; } },
  { name: 'cache', title: '冒険者の物資の置き場（木箱と寝具）', seed: 'abc', day: 13, phase: 0.45, zoom: 4, search: 8, find: (w) => { const o = w.eco.caches.find((q) => q.food > 0) ?? w.eco.caches[0]; return o ? { x: o.x, y: o.y, zoom: 4 } : null; } },
  // 床の材質の境目（石畳と岩床）。石畳の床のうち、ほかの床に接する縁がまわりに多い所
  { name: 'pavededge', title: '石畳と岩床の境目', seed: 'かしたれ', day: 2, phase: 0.5, zoom: 4, find: (w) => { const m = w.map; const fl = (k: number) => !m.solid[k] || m.rubble[k]; let b = -1, bv = 0; for (let y = 4; y < m.h - 4; y++) for (let x = 4; x < m.w - 4; x++) { const k = y * m.w + x; if (!m.paved[k] || !fl(k)) continue; let v = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) { const q = k + dy * m.w + dx; if (m.paved[q] && fl(q)) for (const d of [1, -1, m.w, -m.w]) if (fl(q + d) && !m.paved[q + d]) v++; } if (v > bv) { bv = v; b = k; } } return b >= 0 ? { x: (b % m.w) * T + 8, y: Math.floor(b / m.w) * T + 8, zoom: 4 } : null; } },
  // 床の上の状態（焼け跡）。灰の多いマスがまとまっている所
  { name: 'ash', title: '焼け跡', seed: 'abc', day: 6, phase: 0.5, zoom: 4, search: 10, find: (w) => { const m = w.map; let b = -1, bv = 300; for (let k = m.w * 3; k < m.solid.length - m.w * 3; k++) { if (w.ash[k] < 30) continue; let v = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) v += w.ash[k + dy * m.w + dx] ?? 0; if (v > bv) { bv = v; b = k; } } return b >= 0 ? { x: (b % m.w) * T + 8, y: Math.floor(b / m.w) * T + 8, zoom: 4 } : null; } },
  { name: 'phone', title: 'スマホの画面全体', seed: 'かしたれ', day: 2, phase: 0.6, zoom: 2, device: 'phone', find: (w) => ({ x: w.map.entrance.x * T + 8, y: 30 * T, zoom: 2 }) },
];

const b64 = (u: Uint8Array) => Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
// マナもセーブデータに入れる（入れないと、ロードしたシーンのマナがすべて0になり、マナの描画が出ない）
const save = (w: World, cam: Cam) => ({ v: 5, seed: w.map.seed, tick: w.tick, cam, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), mana: b64(new Uint8Array(w.mana.buffer)), manaBorn: w.manaBorn, manaLeaked: w.manaLeaked, manaFaded: w.manaFaded, born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() });

mkdirSync('build/gallery/scenes', { recursive: true });
type Out = { name: string; title: string; device: string; file: string };
// 同じシードのシーンは、時刻の早い順に、一つのワールドを進めながら作る
const bySeed = new Map<string, Scene[]>();
for (const s of SCENES) bySeed.set(s.seed, [...(bySeed.get(s.seed) ?? []), s]);
const seeds = [...bySeed.keys()];

function makeSeed(seed: string): Out[] {
  const out: Out[] = [];
  const list = bySeed.get(seed) as Scene[];
  const w = new World(seed);
  for (const s of list.sort((a, b) => a.day + (a.phase ?? 0) - (b.day + (b.phase ?? 0)))) {
    const target = Math.floor((s.day + (s.phase ?? 0)) * DAY_TICKS);
    while (w.tick < target) { w.step(); if (w.tick % 20 === 0) w.updateSeen(); }
    let cam = s.find(w);
    // 見つからなければ、search 日まで進めながら探す
    const until = w.tick + (s.search ?? 0) * DAY_TICKS;
    while (!cam && w.tick < until) {
      for (let i = 0; i < 100; i++) { w.step(); if (w.tick % 20 === 0) w.updateSeen(); }
      cam = s.find(w);
    }
    if (!cam) { console.log(`シーンの場所が見つからない：${s.title}`); continue; }
    const file = `build/gallery/scenes/${s.name}.json`;
    writeFileSync(file, JSON.stringify(save(w, cam)));
    out.push({ name: s.name, title: s.title, device: s.device ?? 'desktop', file });
    console.log(`シーン：${s.title}（${(w.tick / DAY_TICKS).toFixed(2)}日）`);
  }
  return out;
}

const argv = process.argv.slice(2);
if (argv[0] === '--one-seed') {
  // 子プロセス：一つのシードのシーンだけを作る
  const i = +argv[1];
  writeFileSync(`build/gallery/scenes-part${i}.json`, JSON.stringify(makeSeed(seeds[i])));
} else {
  // 親プロセス：前回と同じなら作り直さない。違えばシードごとに並列に作る
  const h = createHash('sha1');
  for (const f of ['src/world.ts', 'src/ecology.ts', 'src/mapgen.ts', 'src/rng.ts', 'src/names.ts', 'tools/gallery/scenes.ts']) h.update(readFileSync(f));
  const key = h.digest('hex');
  const keyFile = 'build/gallery/scenes.key';
  const prev = existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '';
  const listed: Out[] = existsSync('build/gallery/scenes.json') ? JSON.parse(readFileSync('build/gallery/scenes.json', 'utf8')) : [];
  if (!argv.includes('--fresh') && prev === key && listed.length && listed.every((o) => existsSync(o.file))) {
    console.log('シーンは前回のまま（シミュレーションのコードとシーンの定義が同じ）。作り直すなら --fresh');
  } else {
    const runs = seeds.map(
      (_, i) =>
        new Promise<void>((res, rej) => {
          const c = spawn(process.execPath, [process.argv[1], '--one-seed', String(i)], { stdio: 'inherit' });
          c.on('exit', (code) => (code === 0 ? res() : rej(new Error(`シーンの作成に失敗：${seeds[i]}`))));
        }),
    );
    Promise.all(runs).then(() => {
      const out: Out[] = [];
      for (let i = 0; i < seeds.length; i++) out.push(...JSON.parse(readFileSync(`build/gallery/scenes-part${i}.json`, 'utf8')));
      writeFileSync('build/gallery/scenes.json', JSON.stringify(out, null, 1));
      writeFileSync(keyFile, key);
    });
  }
}
