/**
 * 動きを連続フレームで撮るためのシーンを作る（CLAUDE.md の「画面に見えること」：動きは連続フレームで撮る）。
 * キャッシュにあるスナップショット（lib/open.ts）から始めて、決まった tick ごとにゲームのセーブと同じ形を書き出し、tools/gallery/film.mjs がゲーム画面でスクリーンショットを撮って一枚に並べる。
 *
 *   npm run film -- --seed abc --at 12.3 --frames 6 --every 40 --follow party:12345 --name adv-enter
 *   npm run film -- --seed abc --at 12.3 --frames 6 --every 40 --xy 1200,640 --zoom 3
 *
 * --at 始める日（小数可）か --tick 始める tick、--frames フレーム数（既定 6）、--every フレームの間隔（tick、既定 40）、
 * --follow party:<一行の id>（先頭にカメラを合わせ続ける）か id:<生き物の id>、--xy x,y（px。カメラを固定する）、--zoom 拡大率（既定 3）、
 * --ticks tick,tick,...（各フレームの tick を並べて指定。--tick/--at はその最初の tick 以下にする）、
 * --pure 作業ツリーで0日目から実行したスナップショットだけを使う（無ければ0日目から実行する。ベースのスナップショットから続けると、変えた挙動の起きる時刻がずれるときに）、
 * --dy カメラを縦にずらす量（px、負で上。寄って撮るとき体の真ん中へ）、--run <実行結果のフォルダ>（その実行の日次スナップショットから始める）、--name 出力の名前、--title 見出し、--out 出力先（既定 build/img。コミットしない）、--lit 確認用の明かり、--cols 1行のフレーム数（既定 3）
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
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
const out = opt('out', 'build/img') as string;
const follow = opt('follow', '') as string;
const xy = opt('xy', '');
const title = opt('title', name) as string;
/** カメラを縦にずらす量（px。寄って撮るとき、足もとに合ったカメラを体の真ん中へ。負で上） */
const dy = +(opt('dy', '0') as string);
mkdirSync('build/film', { recursive: true });
mkdirSync(out, { recursive: true });

async function main(): Promise<void> {
const { w, from } = await openAt(seed, t0, opt('run') ? { run: opt('run') } : argv.includes('--pure') ? { pure: true } : {});
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
  // 引退の前の最後の遠征：英雄と、連れてきた見習い（同じ職業の、初めての遠征の者）に名前の印（一行を追うときと、その一行の者を追うとき）
  const crew = party ?? (follow.startsWith('id:') ? e.parties.find((q: any) => q.members.includes(+follow.slice(3))) : null);
  if (crew) {
    const oc = crew.members.map((id: number) => e.byId.get(id)).find((c: any) => c && !c.dead && e.heroOf(c)?.last && e.heroOf(c)?.rank >= 3);
    const oh = oc ? e.heroOf(oc) : null;
    if (oh) {
      for (const id of crew.members) {
        const c = e.byId.get(id);
        const h = c && !c.dead ? e.heroOf(c) : null;
        if (h === oh) marks.push({ x: c.x, y: c.y - 16, label: `英雄${h.name}（最後の遠征）`, color: '#ffd24a' });
        else if (h && h.rank === 0 && h.trips === 1 && h.job === oh.job) marks.push({ x: c.x, y: c.y + 4, label: `見習い${h.name}`, color: '#9ad8ff' });
      }
    }
  }
  if (party) {
    if ((party.braceT ?? 0) > e.step && party.braceK === 2) marks.unshift({ x: party.braceX, y: party.braceY, label: '身構えた住みか', color: '#80ff9a' });
    // 目標がそばにあれば、カメラを一行と目標の間に寄せる
    const mk = marks[0];
    if (p && mk && (mk.x - p.x) ** 2 + (mk.y - p.y) ** 2 < (12 * 16) ** 2) p = { x: (p.x + mk.x) / 2, y: (p.y + mk.y) / 2 };
  }
  if (p) cam = { x: Math.round(p.x), y: Math.round(p.y) + dy, zoom };
  w.seen.set(all);
  // その場でディープコピーする（セーブの形には生きたオブジェクト（一行の PT2 など）がそのまま入っているので、あとで書き出すと後の tick の値になる）
  const save = JSON.parse(JSON.stringify(encodeState(w))) as any;
  save.cam = cam;
  save.speed = 0;
  const lead = party && e.byId.get(party.members[0]);
  const card = lead ? e.describe(lead, [], ['戦士', '魔法使い', '盗賊', '僧侶', '吟遊詩人', '狩人', '竜殺し']).lines.join(' / ') : '';
  out2.push({ save, cam, marks, label: `${(w.tick / DAY_TICKS).toFixed(3)}日目${card ? '　' + card : ''}` });
}
const json = join('build/film', `${name}.json`);
writeFileSync(json, JSON.stringify({ frames: out2, name, out, title: `${title}（${seed}、${from}）`, lit: argv.includes('--lit'), cols: +(opt('cols', '3') as string) }));
console.log(`フレーム ${n}（${seed}、${(t0 / DAY_TICKS).toFixed(3)}日目から ${every} tick ごと）→ ${json}`);
execFileSync('node', ['tools/gallery/film.mjs', json], { stdio: 'inherit' });
}
main();
