/**
 * 見たいものが現れるまでシミュレーションを進めて、ゲーム画面でスクリーンショットを撮る（シーンの検索・セーブデータの書き出し・カメラ合わせ・印・切り出しを一度に）。
 *
 *   npm run shot -- --seed かしたれ --find warren
 *   npm run shot -- --seed かしたれ --find hide --zoom 3
 *   npm run shot -- --seed abc --find kind:24 --day 6 --zoom 3 --lit
 *   npm run shot -- --seed abc --find xy:120,40 --day 10
 *
 * --find：warren（横穴を掘り終え罠が2つ以上の住処）、hide（奥に隠れているコボルトのいる住処）、camp（3匹以上いるゴブリンの集落）、gobhide（暗がりに散って隠れたゴブリン）、tribute（貢ぎ物の袋を担いで帰るオーク）、kind:番号（その種の生き物）、xy:マスx,マスy
 * --day 探し始める日（既定 0）、--until 探すのをやめる日（既定 25）、--every 探す間隔（tick、既定 200）、--zoom 拡大率（既定 4）、--lit 確認用の明かり（#lit）、
 * --fog 霧をそのまま（既定は地図全体を見えたマスにする）、--name 出力の名前（既定は find から）、--out 出力先（既定 build/shots）
 *
 * 出力：<name>.png（そのまま）、<name>-marked.png（見たいものの位置に枠と名前）、<name>-crop.png（中央を切り出して、ドットのまま3倍に拡大）
 */
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DAY_TICKS, World } from '../../src/world';
import { NAMES } from '../../src/names';

const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const seed = opt('seed', 'かしたれ') as string;
const find = opt('find', 'warren') as string;
const zoom = +(opt('zoom', '4') as string);
const out = opt('out', 'build/shots') as string;
const name = opt('name', find.replace(/[:,]/g, '-')) as string;
mkdirSync(out, { recursive: true });

const b64 = (u: Uint8Array) => Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
const fog = argv.includes('--fog');
const save = (w: World, cam: { x: number; y: number; zoom: number }) => ({ v: 3, seed: w.map.seed, tick: w.tick, cam, speed: 0, seen: bits(fog ? w.seen : new Uint8Array(w.seen.length).fill(1)), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), mana: b64(new Uint8Array(w.mana.buffer)), manaBorn: w.manaBorn, manaLeaked: w.manaLeaked, manaFaded: w.manaFaded, born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() });

type Mark = { x: number; y: number; label: string; color: string; size?: number };
const w = new World(seed);
const e = w.eco as any;
const m = w.map;
const T = 16;

/** 住処まわりの印：入口、横穴の奥、罠、畑、隠れている者 */
function warrenMarks(wr: any): Mark[] {
  const r: Mark[] = [];
  const d = wr.door;
  if (d >= 0) r.push({ x: (d % m.w) * T + 8, y: Math.floor(d / m.w) * T + 8, label: '入口', color: '#ffd24a' });
  r.push({ x: wr.x, y: wr.y, label: '横穴の奥', color: '#7fd0ff' });
  for (const t of e.traps.filter((t: any) => t.w === wr.id)) r.push({ x: (t.k % m.w) * T + 8, y: Math.floor(t.k / m.w) * T + 8, label: '罠', color: '#ff5050' });
  for (const k of e.farmTiles(wr)) r.push({ x: (k % m.w) * T + 8, y: Math.floor(k / m.w) * T + 8, label: `畑 ${w.fungus[k]}`, color: '#c08cff' });
  for (const c of e.warrenMembers(wr)) if (e.isHidden(c)) r.push({ x: c.x, y: c.y, label: '隠れている', color: '#80ff9a' });
  return r;
}
type Hit = { cam: { x: number; y: number; zoom: number }; marks: Mark[]; title: string };
function look(): Hit | null {
  if (find === 'warren' || find === 'hide') {
    for (const wr of e.warrens) {
      if (wr.id < 0) continue;
      const traps = e.traps.filter((t: any) => t.w === wr.id).length;
      if (find === 'warren' && (wr.tun ?? 0) >= 4 && traps >= 2) {
        const d = wr.door;
        return { cam: { x: Math.round(((d % m.w) * T + 8 + wr.x) / 2), y: Math.round((Math.floor(d / m.w) * T + 8 + wr.y) / 2), zoom }, marks: warrenMarks(wr), title: `コボルトの住処（罠 ${traps}）` };
      }
      if (find === 'hide' && wr.hide === 1 && e.warrenMembers(wr).some((c: any) => e.isHidden(c))) return { cam: { x: Math.round(wr.x), y: Math.round(wr.y), zoom }, marks: warrenMarks(wr), title: '隠れている住処' };
    }
    return null;
  }
  if (find === 'tribute') {
    const o = e.list.find((c: any) => c.k === 13 && !c.dead && !c.away && c.st === 6 && c.units > 0);
    if (!o) return null;
    const cp = e.camps.find((q: any) => q.id >= 0 && q.kind === 0 && q.lx === o.hx && q.ly === o.hy);
    const marks: Mark[] = [{ x: o.x, y: o.y, label: `貢ぎ物 ${o.units}`, color: '#ffd24a', size: 2 }];
    if (cp) marks.push({ x: cp.x, y: cp.y, label: '従う集落', color: '#80ff9a', size: 2 });
    return { cam: { x: Math.round(o.x), y: Math.round(o.y), zoom }, marks, title: 'オークが貢ぎ物を持ち帰る' };
  }
  if (find === 'gobhide' || find === 'camp') {
    for (const cp of e.camps) {
      if (cp.id < 0 || cp.kind !== 0) continue;
      const ms = e.campMembers(cp);
      const hid = ms.filter((c: any) => e.isHidden(c));
      if (find === 'camp' && ms.length >= 3) return { cam: { x: Math.round(cp.x), y: Math.round(cp.y), zoom }, marks: [{ x: cp.x, y: cp.y, label: `集落 蓄え${cp.store ?? 0}`, color: '#ffd24a', size: 2 }], title: 'ゴブリンの集落' };
      if (find === 'gobhide' && cp.hide === 1 && hid.length >= 1) return { cam: { x: Math.round(cp.x), y: Math.round(cp.y), zoom }, marks: [{ x: cp.x, y: cp.y, label: '集落', color: '#ffd24a', size: 2 }, ...hid.map((c: any) => ({ x: c.x, y: c.y, label: '隠れている', color: '#80ff9a' }))], title: '散って隠れたゴブリン' };
    }
    return null;
  }
  if (find.startsWith('kind:')) {
    const k = +find.slice(5);
    const c = e.list.find((o: any) => o.k === k && !o.dead && !o.away);
    return c ? { cam: { x: Math.round(c.x), y: Math.round(c.y), zoom }, marks: [{ x: c.x, y: c.y, label: `${NAMES[k]} ${c.id}`, color: '#ffd24a', size: 2 }], title: NAMES[k] } : null;
  }
  if (find.startsWith('xy:')) {
    const [x, y] = find.slice(3).split(',').map(Number);
    return { cam: { x: x * T + 8, y: y * T + 8, zoom }, marks: [{ x: x * T + 8, y: y * T + 8, label: `${x},${y}`, color: '#ffd24a' }], title: `マス ${x},${y}` };
  }
  throw new Error(`--find が分からない：${find}`);
}

const from = +(opt('day', '0') as string) * DAY_TICKS;
const until = +(opt('until', '25') as string) * DAY_TICKS;
// 何 tick ごとに探すか（--every。短いあいだしか起きないもの、たとえば隠れているゴブリンを探すときは小さくする）
const every = +(opt('every', '200') as string);
while (w.tick < from) { w.step(); if (w.tick % 20 === 0) w.updateSeen(); }
let hit = look();
while (!hit && w.tick < until) {
  for (let i = 0; i < every; i++) { w.step(); if (w.tick % 20 === 0) w.updateSeen(); }
  hit = look();
}
if (!hit) {
  console.log(`見つからない：${find}（${seed}、${(until / DAY_TICKS).toFixed(1)}日目まで探した）`);
  process.exit(1);
}
const title = `${hit.title}（${seed}、${(w.tick / DAY_TICKS).toFixed(2)}日目）`;
const json = join(out, `${name}.json`);
writeFileSync(json, JSON.stringify({ save: save(w, hit.cam), cam: hit.cam, marks: hit.marks, title, name, out, lit: argv.includes('--lit') }));
console.log(title);
// スクリーンショットを撮る（Node の Playwright）
execFileSync('node', ['tools/gallery/shot.mjs', json], { stdio: 'inherit' });
