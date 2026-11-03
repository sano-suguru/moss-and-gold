/**
 * 動きを数こまの連続に撮るための場面を作る（見える相互作用の決まり：動きは数こまで撮る）。
 * 途中の状態の保存庫（lib/open.ts）から始めて、決まった刻みごとにゲームの保存と同じ形を書き出し、tools/gallery/film.mjs がゲーム画面で撮って一枚に並べる。
 *
 *   npm run film -- --seed abc --at 12.3 --frames 6 --every 40 --follow party:12345 --name adv-enter
 *   npm run film -- --seed abc --at 12.3 --frames 6 --every 40 --xy 1200,640 --zoom 3
 *
 * --at 始める日（小数可）か --tick 刻み、--frames こまの数（既定 6）、--every こまの間（刻み、既定 40）、
 * --follow party:<一行の id>（先頭にカメラを合わせ続ける）か id:<生き物の id>、--xy 画素x,画素y（カメラを止める）、--zoom 拡大率（既定 3）、
 * --ticks 刻み,刻み,...（こまの刻みを並べて指定。--tick/--at はその最初の刻み以下にする）、
 * --run <回したフォルダ>（その回の1日ごとの状態から始める）、--name 書き出す名前、--title 見出し、--out 書き出す先（既定 docs/img）、--lit 確認用の明かり、--cols 一行のこま数（既定 3）
 */
import { mkdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { DAY_TICKS, tick } from './lib/engine';
import { openAt } from './lib/open';
import { encodeState } from './lib/state';

const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const seed = opt('seed', 'abc') as string;
const t0 = opt('tick') ? +(opt('tick') as string) : Math.round(+(opt('at', '10') as string) * DAY_TICKS);
const frames = +(opt('frames', '6') as string);
const every = +(opt('every', '40') as string);
const zoom = +(opt('zoom', '3') as string);
const name = opt('name', 'film') as string;
const out = opt('out', 'docs/img') as string;
const follow = opt('follow', '') as string;
const xy = opt('xy', '');
const title = opt('title', name) as string;
mkdirSync('build/film', { recursive: true });
mkdirSync(out, { recursive: true });

async function main(): Promise<void> {
const { w, from } = await openAt(seed, t0, opt('run') ? { run: opt('run') } : {});
const e = w.eco as any;
const all = new Uint8Array(w.seen.length).fill(1);
let cam = { x: 0, y: 0, zoom };
const where = (): { x: number; y: number } | null => {
  if (xy) {
    const [x, y] = xy.split(',').map(Number);
    return { x, y };
  }
  if (follow.startsWith('party:')) {
    const p = e.parties.find((q: any) => q.id === +follow.slice(6));
    const lead = p && e.byId.get(p.members[0]);
    return lead ? { x: lead.x, y: lead.y } : null;
  }
  if (follow.startsWith('id:')) {
    const c = e.byId.get(+follow.slice(3));
    return c && !c.dead ? { x: c.x, y: c.y } : null;
  }
  return null;
};
const out2: any[] = [];
const ticks = opt('ticks') ? (opt('ticks') as string).split(',').map(Number) : null;
const n = ticks ? ticks.length : frames;
for (let i = 0; i < n; i++) {
  if (ticks) while (w.tick < ticks[i]) tick(w);
  else if (i > 0) for (let j = 0; j < every; j++) tick(w);
  let p = where();
  const party = follow.startsWith('party:') ? e.parties.find((q: any) => q.id === +follow.slice(6)) : null;
  // 目標の印：一行の目標（知っていれば）と、身構えて向いている住みか
  const marks: { x: number; y: number; label: string; color: string }[] = [];
  if (party && !party.aimEnd) {
    const t = party.aimId ? e.byId.get(party.aimId) : null;
    const KN = ['ウィスプ', 'コウモリ', '大ネズミ', '大トカゲ', '大グモ', 'スライム', 'ゾンビ', 'ゴースト', 'マイコニド', 'アリ', 'コボルト', 'サラマンダー', 'ゴブリン', 'オーク', 'リザードマン', 'ミノタウロス', 'トロール', 'バジリスク', 'ガーゴイル', 'ヴァンパイア', 'ミミック', 'ゴーレム', 'ワーム', 'ワイバーン', 'ドラゴン'];
    if ((party.aim === 2 || party.aim === 3) && t && !t.dead) marks.push({ x: t.x, y: t.y - 12, label: `目標：${KN[t.k] ?? ''}`, color: '#ffd24a' });
    else if (party.aim === 5) {
      const cp = e.camps.find((c: any) => c.id === party.aimId);
      if (cp) marks.push({ x: cp.x, y: cp.y, label: '目標：ゴブリンの集落', color: '#ffd24a' });
    } else if (party.aimKnown && party.aim) marks.push({ x: party.aimX, y: party.aimY, label: '目標', color: '#ffd24a' });
  }
  if (party) {
    if ((party.braceT ?? 0) > e.step && party.braceK === 2) marks.unshift({ x: party.braceX, y: party.braceY, label: '身構えた住みか', color: '#80ff9a' });
    // 目標がそばにあれば、カメラを一行と目標の間に寄せる
    const mk = marks[0];
    if (p && mk && (mk.x - p.x) ** 2 + (mk.y - p.y) ** 2 < (12 * 16) ** 2) p = { x: (p.x + mk.x) / 2, y: (p.y + mk.y) / 2 };
  }
  if (p) cam = { x: Math.round(p.x), y: Math.round(p.y), zoom };
  w.seen.set(all);
  // その場で写し取る（保存の形には生きたオブジェクト（一行の PT2 など）がそのまま入っているので、あとで書き出すと後の刻みの値になる）
  const save = JSON.parse(JSON.stringify(encodeState(w))) as any;
  save.cam = cam;
  save.speed = 0;
  const lead = party && e.byId.get(party.members[0]);
  const card = lead ? e.describe(lead, [], ['戦士', '魔法使い', '盗賊', '僧侶', '吟遊詩人', '狩人', '竜殺し']).lines.join(' / ') : '';
  out2.push({ save, cam, marks, label: `${(w.tick / DAY_TICKS).toFixed(3)}日目${card ? '　' + card : ''}` });
}
const json = join('build/film', `${name}.json`);
writeFileSync(json, JSON.stringify({ frames: out2, name, out, title: `${title}（${seed}、${from}）`, lit: argv.includes('--lit'), cols: +(opt('cols', '3') as string) }));
console.log(`こま ${n}（${seed}、${(t0 / DAY_TICKS).toFixed(3)}日目から ${every}刻みごと）→ ${json}`);
execFileSync('node', ['tools/gallery/film.mjs', json], { stdio: 'inherit' });
}
main();
