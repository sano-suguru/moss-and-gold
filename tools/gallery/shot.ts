/**
 * 見たいものが現れるまでシミュレーションを進めて、ゲーム画面でスクリーンショットを撮る（シーンの検索・セーブデータの書き出し・カメラ合わせ・印・切り出しを一度に）。
 *
 *   npm run shot -- --seed かしたれ --find warren
 *   npm run shot -- --seed かしたれ --find hide --zoom 3
 *   npm run shot -- --seed abc --find kind:24 --day 6 --zoom 3 --lit
 *   npm run shot -- --seed abc --find xy:120,40 --day 10
 *
 * --find：warren（横穴を掘り終え罠が2つ以上の住処）、advcorpse（白骨になる前の冒険者の亡骸）、thralladv（ヴァンパイアの眷属になった冒険者）、advsleep（焚き火のそばで眠る冒険者）、hide（奥に隠れているコボルトのいる住処）、camp（3匹以上いるゴブリンの集落）、gobhide（暗がりに散って隠れたゴブリン）、tribute（貢ぎ物の袋を担いで帰るオーク）、haul（キノコの束を背負って住処へ運ぶコボルト）、gobhaul（腹を満たし、ネズミを担いで集落へ帰るゴブリン）、bless（冒険者の亡骸の前で祈る一行）、slimefeast（一つの死骸を2匹以上のスライムが食べている所）、tunnelclose（古い坑道が崩れて塞がった直後）、battle（古戦場の真ん中。--day の時点の様子）、ghouldrag（死骸を巣へ引きずっているグール）、rust（鉄の武具を齧っている錆喰い虫）、frog（舌を伸ばして獲物を捕まえた大ガエル。--every 1 で探す）、kind:番号（その種の生き物）、xy:マスx,マスy
 * --day 探し始める日（既定 0）、--until 探すのをやめる日（既定 25）、--every 探す間隔（tick、既定 200）、--zoom 拡大率（既定 4）、--lit 確認用の明かり（#lit）、
 * --fog 霧をそのまま（既定は地図全体を見えたマスにする）、--name 出力の名前（既定は find から）、--out 出力先（既定 build/shots）
 *
 * 出力：<name>.png（そのまま）、<name>-marked.png（見たいものの位置に枠と名前）、<name>-crop.png（中央を切り出して、ドットのまま3倍に拡大）
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DAY_TICKS, World } from '../../src/world';
import { NAMES } from '../../src/names';
import { haulKind } from '../../src/haul';

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
const save = (w: World, cam: { x: number; y: number; zoom: number }) => ({ v: 5, seed: w.map.seed, tick: w.tick, cam, speed: 0, seen: bits(fog ? w.seen : new Uint8Array(w.seen.length).fill(1)), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), trod: b64(w.trod), mana: b64(new Uint8Array(w.mana.buffer)), manaBorn: w.manaBorn, manaLeaked: w.manaLeaked, manaFaded: w.manaFaded, born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() });

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
  if (find === 'haul' || find === 'gobhaul') {
    // 蓄えの荷を運ぶ者（描画と同じ haulKind で選ぶ）
    const want = find === 'haul' ? 0 : 1;
    const o = e.list.find((c: any) => !e.isHidden(c) && haulKind(e, c) === want);
    if (!o) return null;
    const label = find === 'haul' ? 'キノコを運ぶコボルト' : 'ネズミを担ぐゴブリン';
    return { cam: { x: Math.round(o.x), y: Math.round(o.y), zoom }, marks: [{ x: o.x, y: o.y, label: `${label} ${o.id}`, color: '#ffd24a', size: 2 }], title: label };
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
  if (find === 'bless') {
    // 冒険者の亡骸の前で祈っている一行（僧侶が清める。blessBrace）
    const p = e.parties.find((q: any) => q.braceK === 5 && (q.braceT ?? 0) > e.step);
    if (p) return { cam: { x: p.braceX, y: p.braceY, zoom }, marks: [], title: '亡骸の前で祈る一行' };
  }
  if (find === 'tunnelclose') {
    // 古い坑道が崩れて塞がった直後（土ぼこりが立っている間）
    const ev = e.events.findLast((x: any) => x.m.includes('古い坑道が崩れて') && w.tick - x.t < 100);
    return ev ? { cam: { x: ev.x, y: ev.y, zoom }, marks: [{ x: ev.x, y: ev.y, label: '崩れて塞がった坑道', color: '#ffd24a', size: 2 }], title: `古い坑道の崩れ（tick ${ev.t}、px ${ev.x},${ev.y}）` } : null;
  }
  if (find === 'slimefeast') {
    // 一つの死骸を2匹以上のスライムが包み込んで食べている所（死骸を目当てにして、その上にいる）
    const by = new Map<number, any[]>();
    for (const c of e.list) {
      if (c.k !== 5 || c.dead || !c.ref) continue;
      const o = e.byId.get(c.ref);
      if (o && o.dead === 1 && (o.x - c.x) ** 2 + (o.y - c.y) ** 2 < 12 * 12) by.set(c.ref, [...(by.get(c.ref) ?? []), c]);
    }
    for (const [id, ss] of by) {
      const o = e.byId.get(id);
      if (!o || ss.length < 2) continue;
      return { cam: { x: Math.round(o.x), y: Math.round(o.y), zoom }, marks: [{ x: o.x, y: o.y, label: `${NAMES[o.k] ?? o.k}の死骸`, color: '#ffd24a', size: 2 }, ...ss.map((c: any) => ({ x: c.x, y: c.y, label: 'スライム', color: '#80ff9a' }))], title: '死骸に群がるスライム' };
    }
    return null;
  }
  if (find === 'advcorpse' || find === 'thralladv' || find === 'advsleep') {
    // 冒険者の亡骸（倒れた姿のあと、白骨になる前）、眷属になった冒険者（sp に元の種）、毛布にくるまって眠る冒険者。
    // 見やすいように、まわり（20ピクセル以内）にほかの生き物が重なっていない者を選ぶ
    const alone = (o: any) => !e.list.some((q: any) => q !== o && !q.dead && !q.away && q.k !== 0 && (q.x - o.x) ** 2 + (q.y - o.y) ** 2 < 20 * 20);
    const c = e.list.find((o: any) =>
      (find === 'advcorpse' ? o.k === 25 && o.dead === 1 && o.actT >= 4 && e.corpseStage(o) < 2 : find === 'thralladv' ? o.k === 30 && !o.dead && o.sp === 25 : o.k === 25 && !o.dead && !o.away && o.sleep === 2) && alone(o),
    );
    const label = find === 'advcorpse' ? '冒険者の亡骸' : find === 'thralladv' ? '冒険者の眷属' : '眠る冒険者';
    return c ? { cam: { x: Math.round(c.x), y: Math.round(c.y), zoom }, marks: [{ x: c.x, y: c.y, label: `${label} ${c.id}`, color: '#ffd24a', size: 2 }], title: label } : null;
  }
  if (find === 'ghouldrag') {
    // 死骸をつかんで、巣から2マスより遠い所を引きずっているグール（src/eco/ghoul.ts）
    const c = e.list.find((o: any) => {
      if (o.k !== 31 || o.dead || !o.feed) return false;
      const d = e.byId.get(o.feed);
      return d && d.dead === 1 && (d.x - o.hx) ** 2 + (d.y - o.hy) ** 2 > (2 * T) ** 2 && (d.x - o.x) ** 2 + (d.y - o.y) ** 2 < 20 * 20;
    });
    if (!c) return null;
    const d = e.byId.get(c.feed);
    return { cam: { x: Math.round(c.x), y: Math.round(c.y), zoom }, marks: [{ x: c.x, y: c.y, label: 'グール', color: '#ffd24a' }, { x: d.x, y: d.y, label: `${NAMES[d.k]}の死骸`, color: '#ff5050' }, { x: c.hx, y: c.hy, label: '巣', color: '#7fd0ff', size: 2 }], title: '死骸を巣へ引きずるグール' };
  }
  if (find === 'rust') {
    // 未練の抜けた鉄の武具を齧っている錆喰い虫（src/eco/rust.ts）
    const c = e.list.find((o: any) => o.k === 32 && !o.dead && o.act === 2 && o.ref2 && e.gear.some((g: any) => g.id === o.ref2));
    if (!c) return null;
    const it = e.gear.find((g: any) => g.id === c.ref2);
    const others = e.list.filter((o: any) => o.k === 32 && !o.dead && o !== c && (o.x - c.x) ** 2 + (o.y - c.y) ** 2 < (6 * T) ** 2);
    return { cam: { x: Math.round(c.x), y: Math.round(c.y), zoom }, marks: [{ x: c.x, y: c.y, label: '錆喰い虫', color: '#ffd24a' }, { x: it.x, y: it.y, label: '鉄の武具', color: '#7fd0ff' }, ...others.map((o: any) => ({ x: o.x, y: o.y, label: '錆喰い虫', color: '#ffd24a' }))], title: '鉄の武具を齧る錆喰い虫' };
  }
  if (find === 'frog') {
    // 舌を伸ばして獲物を捕まえた瞬間の大ガエル（src/eco/frog.ts）。舌は6 tick しか出ていないので --every 1 で探す
    const r = e.fxAttacks.find((o: any) => o.style === 'tongue' && w.tick - o.t === 1);
    if (!r) return null;
    const c = e.byId.get(r.aid);
    const d = e.byId.get(r.did);
    return { cam: { x: Math.round(r.ax), y: Math.round(r.ay), zoom }, marks: [{ x: c.x, y: c.y, label: '大ガエル', color: '#ffd24a' }, ...(d ? [{ x: r.dx, y: r.dy, label: NAMES[d.k], color: '#ff5050' }] : []), { x: c.hx, y: c.hy, label: '住みか', color: '#7fd0ff', size: 2 }], title: '舌で獲物を捕まえる大ガエル' };
  }
  if (find === 'battle') {
    // 古戦場（src/eco/battle.ts）：骨と錆びた武具と、まわりの起き上がった者
    const B = m.battle;
    if (B.x < 0) throw new Error('このシードには古戦場が無い');
    const cx = B.x * T + 8;
    const cy = B.y * T + 8;
    const near = (o: any) => (o.x - cx) ** 2 + (o.y - cy) ** 2 < (10 * T) ** 2;
    const marks: Mark[] = [
      ...e.list.filter((o: any) => o.dead === 1 && near(o)).map((o: any) => ({ x: o.x, y: o.y, label: `${NAMES[o.k]}の骨`, color: '#ffd24a' })),
      ...e.gear.filter(near).map((o: any) => ({ x: o.x, y: o.y, label: `武具 ${o.fuel}`, color: '#7fd0ff' })),
      ...e.list.filter((o: any) => !o.dead && [26, 27, 29, 7].includes(o.k) && near(o)).map((o: any) => ({ x: o.x, y: o.y, label: NAMES[o.k], color: '#ff5050' })),
    ];
    return { cam: { x: cx, y: cy, zoom }, marks, title: '古戦場' };
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
