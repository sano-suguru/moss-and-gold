/**
 * Ecology のメソッド：マイコニドの技（眠りの胞子）。
 *
 * マイコニドは、見通しの利く3マス以内に人（冒険者・ドワーフ）が来ると、そちらを向いて傘を膨らませ（およそ0.6秒）、
 * 半径2マスほどの胞子の雲を吐く。雲の中の人は、マイコニドの方を向いて頭の上に「!」が出たあと、その場でうたた寝をする
 * （およそ4秒、立ったまま動かず、頭の上に小さな z が立ちのぼる。溜めていた技は止まる。打たれたら目を覚ます）。
 * 胞子を吐いたマイコニドは、浴びせた相手に「害をなした者」として覚えられ（foe）、目を覚ました冒険者に払われる（以前の見えない胞子と同じ。src/eco/adventurer.ts）。
 * 使ったあと10秒は吐かない。
 * 払われて倒れたときも、体が弾けて胞子が散り、すぐそば（2マス）の人がうたた寝をする（src/eco/move.ts の die から）。
 * 胞子が効くのは人だけ（範囲の技は人に向けてだけ使う。モンスター同士は命を取らない関わりを中心にするため）。
 * 眠っている人（野営で眠っている一行など）は、もう眠っているので狙わない。
 * 吐くのも散るのも静かで、物音は立てない。
 * （以前は、2マス以内の人に生き物の更新6回ごとに見えない胞子を浴びせ、冒険者の足を1分ほど0.6倍に鈍らせ、ドワーフには眠気を足していた。
 *  マイコニドは攻撃の姿を取るだけで、画面には何も出ていなかった）
 *
 * 状態：溜めている間は act 2・actT が負の数（src/eco/skill.ts）、狙った相手は aim。うたた寝の残りは人の Cr.doze（生き物の更新の回数。セーブに入る）。
 * マイコニドの actT は根を下ろすまでの時計にも使う（src/eco/myconid.ts）。胞子を吐いた回に 0 に戻る（以前の見えない胞子と同じ）。
 */
import { Cr, Ecology, Kind, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import type { Skill } from './skill';

/** 眠りの胞子：およそ0.6秒傘を膨らませ、使ったあと10秒は吐かない */
export const SKILL_MYC_SPORE: Skill = { windup: 3, cool: 50 };
/** 吐きはじめる人の近さ（px） */
const SPORE_TRIGGER = 3 * TILE;
/** 胞子の雲の半径と、倒れて弾けたときに散る半径（px） */
export const SPORE_R = 2 * TILE;
export const BURST_R = 2 * TILE;
/** うたた寝の長さ（生き物の更新の回数。およそ4秒） */
export const DOZE_N = 20;

const isPerson = (o: Cr) => !o.dead && !o.away && !o.caught && (o.k === Kind.Adventurer || o.k === Kind.Dwarf);

/** 眠りの胞子の溜めと、吐く判断（src/eco/step.ts から、マイコニドの判断のはじめに呼ぶ）。今の回を使ったら true */
export function myconidSkill(this: Ecology, c: Cr): boolean {
  const sk = this.skillStep(c, SKILL_MYC_SPORE);
  const t = c.aim ? this.byId.get(c.aim) : undefined;
  if (sk === 'charging') {
    if (t && !t.dead) this.setDir(c, t.x - c.x, t.y - c.y);
    return true;
  }
  if (sk === 'ready') {
    c.aim = 0;
    c.act = 2;
    c.actT = 0;
    this.sporeCloud(c, c.x, c.y, SPORE_R, 0);
    return true;
  }
  if (sk === 'broken') {
    c.aim = 0;
    return false;
  }
  if (c.sleep > 0 || c.flee > 0 || c.bind > 0 || !this.skillCanStart(c, SKILL_MYC_SPORE)) return false;
  let best: Cr | null = null;
  let bd = SPORE_TRIGGER * SPORE_TRIGGER;
  this.nearby(c.x, c.y, Math.ceil(SPORE_TRIGGER / TILE), (o) => {
    if (!isPerson(o) || o.sleep > 0 || o.doze > 0) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d >= bd || !lineOfSight(this.w.map, c.x, c.y, o.x, o.y)) return;
    bd = d;
    best = o;
  });
  if (!best) return false;
  const b = best as Cr;
  c.aim = b.id;
  this.setDir(c, b.x - c.x, b.y - c.y);
  this.skillStart(c, SKILL_MYC_SPORE);
  return true;
}

/**
 * 胞子の雲：(x, y) から半径 r の中の、見通しの利く人がうたた寝をする。how 0 吐いた、1 倒れて弾けた。
 * 浴びた人は、マイコニドの方を向いて「!」を出す。吐いたマイコニドは、いちばん近い浴びた相手に害をなした者として覚えられる
 */
export function sporeCloud(this: Ecology, c: Cr, x: number, y: number, r: number, how: number): void {
  let n = 0;
  let near: Cr | null = null;
  let bd = 1e18;
  this.nearby(x, y, Math.ceil(r / TILE) + 1, (o) => {
    if (!isPerson(o) || o.sleep > 0) return;
    const d = sq(o.x - x) + sq(o.y - y);
    if (d > r * r || !lineOfSight(this.w.map, x, y, o.x, o.y)) return;
    o.doze = Math.max(o.doze, DOZE_N);
    this.setDir(o, c.x - o.x, c.y - o.y);
    // 胞子に気づいた「!」（同じ相手にもう気づいていても、浴びたときは出す）
    this.noticed.set(o.id, c.id);
    this.fxMarks.push({ t: this.w.tick, id: o.id, m: '!' });
    if (this.fxMarks.length > 120) this.fxMarks.splice(0, 40);
    // 溜めていた技は止まる
    if (o.act === 2 && o.actT < 0) o.actT = 0;
    o.act = 0;
    n++;
    if (d < bd) {
      bd = d;
      near = o;
    }
  });
  if (near && how === 0) c.foe = (near as Cr).id;
  this.fxAttacks.push({ t: this.w.tick, style: 'spore', col: how, size: 1, ax: x, ay: y, dx: x, dy: y, did: near ? (near as Cr).id : -1, aid: c.id, big: false, kill: false, rad: r, fly: 6 });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  this.record('settle', { t: this.w.tick, k: Kind.Myconid, ev: 'spore', id: c.id, n, how, x: Math.round(x), y: Math.round(y) } as never);
}

/**
 * うたた寝の進み（src/eco/step.ts から、うたた寝している人の判断のはじめに呼ぶ）。true なら今は眠っている（ほかの行いをしない）。
 * 打たれたら目を覚ます
 */
export function dozeTick(this: Ecology, c: Cr): boolean {
  if (this.w.tick - c.hitAt < 4) {
    c.doze = 0;
    return false;
  }
  c.doze--;
  c.act = 0;
  return true;
}

declare module '../ecology' {
  interface Ecology {
    myconidSkill: typeof myconidSkill;
    sporeCloud: typeof sporeCloud;
    dozeTick: typeof dozeTick;
  }
}

Object.assign(Ecology.prototype, { myconidSkill, sporeCloud, dozeTick });
