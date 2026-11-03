/**
 * 同じ冒険者を、遠征ごとに並べて撮る（頭の飾りで同じ人と分かるかの確認）。1行が一つの遠征、左が松明の灯りの下、右が暗がり。
 *   node build.mjs && node tools/analysis/launch.mjs samehero --seed seed27 --from 10 --to 18 [--hero <名簿の番号>] [--run <実行結果のフォルダ>] [--name same-hero] [--max 4]
 * 名簿の番号を省くと、その間にいちばん多く遠征に出た者（灯りを持たない職業を先に）を選ぶ。
 * --one で遠征ごとに1フレーム（灯りの下）だけ（傷の姿など）。
 * 灯りの下：いちばん近い灯り（松明・光の呪文）から1.5マスの内。暗がり：3.5マスより遠く、日の光や光る苔にも照らされていない。
 */
import { mkdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { DAY_TICKS, tick } from './lib/engine';
import { openAt } from './lib/open';
import { encodeState } from './lib/state';

const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const seed = opt('seed', 'seed27') as string;
const from = Math.round(+(opt('from', '10') as string) * DAY_TICKS);
const to = Math.round(+(opt('to', '18') as string) * DAY_TICKS);
const name = opt('name', 'same-hero') as string;
const maxTrips = +(opt('max', '4') as string);
const zoom = +(opt('zoom', '4') as string);
/** --one：遠征ごとに1フレーム（灯りの下）だけ。傷の姿のように、遠征をまたいだ変わり方を見るとき */
const one = argv.includes('--one');
const JOBS = ['戦士', '魔法使い', '盗賊', '僧侶', '吟遊詩人', '狩人', '竜殺し'];
const RANKS = ['見習い', '熟練', '歴戦', '英雄'];
const CRESTS = ['羽根', '角', '房', 'とさか', '星', '三日月', '輪', '二枚羽根', '炎', '一本角', '四つ葉', '扇', '菱'];

async function main(): Promise<void> {
  // 1回目：だれを撮るか決める（遠征の回数を数えるだけ）
  let heroId = opt('hero') ? +(opt('hero') as string) : 0;
  if (!heroId) {
    const { w } = await openAt(seed, from, opt('run') ? { run: opt('run') } : {});
    const e = w.eco as any;
    const trips = new Map<number, number>();
    const inside = new Set<number>();
    while (w.tick < to) {
      tick(w);
      if (w.tick % 20) continue;
      for (const h of e.roster) {
        if (h.cid && !inside.has(h.id)) trips.set(h.id, (trips.get(h.id) ?? 0) + 1);
        if (h.cid) inside.add(h.id);
        else inside.delete(h.id);
      }
    }
    const jobOf = new Map<number, number>(e.roster.map((h: any) => [h.id, h.job]));
    const order = [...trips.entries()].filter(([id]) => jobOf.has(id)).sort((a, b) => {
      const la = jobOf.get(a[0]) === 3 ? 0 : 1;
      const lb = jobOf.get(b[0]) === 3 ? 0 : 1;
      return lb - la || b[1] - a[1];
    });
    heroId = order[0]?.[0] ?? 0;
    console.log(`撮る者：名簿の ${heroId}（遠征 ${trips.get(heroId)} 回）`);
  }
  const { w, from: src } = await openAt(seed, from, opt('run') ? { run: opt('run') } : {});
  const e = w.eco as any;
  const all = new Uint8Array(w.seen.length).fill(1);
  const frames: any[] = [];
  let trip = -1;
  let cid = 0;
  let got: [boolean, boolean] = [false, false];
  let shots: any[] = [];
  let title = '';
  let minDl = 1e9;
  let maxDl = 0;
  const T = 16;
  const snap = (c: any, kind: string, h: any) => {
    w.seen.set(all);
    const save = JSON.parse(JSON.stringify(encodeState(w))) as any;
    const cam = { x: Math.round(c.x), y: Math.round(c.y) - 8, zoom };
    save.cam = cam;
    save.speed = 0;
    return { save, cam, marks: [{ x: c.x, y: c.y - 6, label: '', color: '#ffd24a' }], label: `${(w.tick / DAY_TICKS).toFixed(2)}日目　${h.trips}度目の遠征（${RANKS[h.rank]}）　${kind}` };
  };
  while (w.tick < to && frames.length < maxTrips * (one ? 1 : 2)) {
    tick(w);
    if (w.tick % 10) continue;
    const h = e.roster.find((q: any) => q.id === heroId);
    // まだ名簿にいない（あとで加わる）なら待ち、いなくなった（倒れた・引退した）なら終わり
    if (!h) {
      if (trip >= 0) break;
      continue;
    }
    if (h.cid && h.cid !== cid) {
      // 新しい遠征：前の遠征の2フレームがそろっていれば残す
      if (got[0] && (got[1] || one)) frames.push(...(one ? [shots[0]] : shots));
      if (cid) console.log(`  遠征 ${trip + 1}：灯りの下 ${got[0] ? '○' : '×'}、暗がり ${got[1] ? '○' : '×'}（いちばん近い灯り ${(minDl / T).toFixed(1)}〜${(maxDl / T).toFixed(1)}マス）`);
      minDl = 1e9;
      maxDl = 0;
      cid = h.cid;
      trip++;
      got = [false, false];
      shots = [null, null];
      title = `${RANKS[h.rank]}の${JOBS[h.job]}${h.name}（頭の飾り：${CRESTS[((h.look >> 11) & 15) - 1] ?? 'なし'}）`;
    }
    if (!h.cid) continue;
    const c = e.byId.get(h.cid);
    if (!c || c.dead) continue;
    const p = e.parties.find((q: any) => q.id === c.party);
    if (!p) continue;
    if (c.sleep > 0 || (p.camp ?? -1) >= 0 || c.y < 6 * T) continue;
    const lights = e.partyLights(p);
    let dl = 1e9;
    for (const l of lights) dl = Math.min(dl, Math.hypot(l.x - c.x, l.y - c.y));
    if (c.torch > 0) dl = 0;
    minDl = Math.min(minDl, dl);
    if (!e.isLit(c)) maxDl = Math.max(maxDl, dl);
    if (!got[0] && dl < 1.5 * T && c.act === 1) {
      got[0] = true;
      shots[0] = snap(c, '松明の灯りの下', h);
    } else if (!got[1] && dl > 3.5 * T && !e.isLit(c)) {
      got[1] = true;
      shots[1] = snap(c, '暗がり', h);
    }
  }
  if (got[0] && (got[1] || one)) frames.push(...(one ? [shots[0]] : shots));
  if (!frames.length) {
    console.log('撮れるフレームがなかった');
    return;
  }
  mkdirSync('build/film', { recursive: true });
  const json = join('build/film', `${name}.json`);
  writeFileSync(json, JSON.stringify({ frames, name, out: opt('out', 'docs/img'), title: `同じ冒険者の遠征ごとの姿：${title}（${seed}、${src}）`, cols: one ? 3 : 2 }));
  console.log(`フレーム ${frames.length}（遠征 ${one ? frames.length : frames.length / 2} 回）→ ${json}`);
  execFileSync('node', ['tools/gallery/film.mjs', json], { stdio: 'inherit' });
}
main();
