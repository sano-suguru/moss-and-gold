/**
 * Ecology のメソッド：冒険者の聞き耳（見えないけれど聞こえる）。
 *
 * 見せたい瞬間：暗がりで物音（戦いの音、足音、うなり声）がすると、一行が立ち止まって音の方を向き、頭に「？」が出て、
 * 前衛が一歩前に出て構える。しばらく何も起きなければ、また歩き出す。物音の主が見えたら、今までどおりの判断（避ける、戦う）に移る。
 *
 * 物音は noises（src/eco/senses.ts の noise。s：0 大きな音、1 足音、2 うなり声）。聞こえる遠さは音の大きさ（r マス）で、
 * 耳のよい盗賊と狩人は1.5倍遠くから聞き取る。灯りの中や明るい所の音（見えている物音）には止まらない。
 * 同じ方角（8方位）の音には地上の時間で約3分（900歩）、どの方角でも約40秒（200歩）あける。
 */
import { Cr, Ecology, Job, Kind, Party, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 立ち止まって耳を澄ます長さ（歩） */
const LISTEN_STEPS = 32;
/** 前衛が前に出る歩数（立ち止まってすぐの間） */
const STEP_OUT = 7;
/** 同じ方角の音に次に止まれるまで、どの方角でも次に止まれるまで（歩） */
const SAME_DIR_GAP = 900;
const ANY_GAP = 200;

/** 一行が物音を聞き取るか（updateParties から、5歩ごと）。聞こえたら立ち止まって音の方を向き、前衛が前に出て構える */
export function listenStep(this: Ecology, p: Party, alive: Cr[]): void {
  if (this.step % 5 !== p.id % 5 || !this.noises.length) return;
  if ((p.camp ?? -1) >= 0 || p.engage || (p.braceT ?? 0) > this.step || (p.listenT ?? 0) > this.step) return;
  const lead = alive[0];
  // 戦いのさなか（襲われたばかり）は耳を澄まさない
  if (alive.some((c) => this.w.tick - c.hitAt < 120 || (c.act === 2 && c.actT < 4))) return;
  const dirs = (p.heardDir ??= []);
  if ((dirs[8] ?? 0) > this.step) return;
  const lights = this.partyLights(p);
  let best: { x: number; y: number; r: number; t: number; s?: number } | null = null;
  let who: Cr | null = null;
  let bd = 1e18;
  for (const n of this.noises) {
    if (this.step - n.t > 6) continue;
    // 見えている所の音（灯りの中、日の差す所や光る苔の明るい所）には止まらない
    let seen = false;
    for (const l of lights) if (sq(n.x - l.x) + sq(n.y - l.y) < 6 * TILE * 6 * TILE) seen = true;
    if (seen || this.lit(this.tileOf(n.x, n.y), this.day) > 0.35) continue;
    for (const c of alive) {
      const ear = c.sp === Job.Thief || c.sp === Job.Hunter ? 1.5 : 1;
      const d = sq(n.x - c.x) + sq(n.y - c.y);
      if (d > sq(n.r * ear * TILE) || d >= bd) continue;
      bd = d;
      best = n;
      who = c;
    }
  }
  if (!best || !who) return;
  const n = best as { x: number; y: number; r: number; t: number; s?: number };
  const h = who as Cr;
  const a = Math.atan2(n.y - lead.y, n.x - lead.x);
  const b = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  if ((dirs[b] ?? 0) > this.step) return;
  dirs[b] = this.step + SAME_DIR_GAP;
  dirs[8] = this.step + ANY_GAP;
  // 前衛：戦士か竜殺し（いなければ先頭）
  const van = alive.find((c) => c.sp === Job.Warrior || c.sp === Job.Slayer) ?? lead;
  p.listenT = this.step + LISTEN_STEPS;
  p.listenX = n.x;
  p.listenY = n.y;
  p.listenBy = van.id;
  this.partyMark(p, '?', true);
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'hear', how: n.s ?? 0, n: h.sp, x: Math.round(n.x), y: Math.round(n.y) } as never);
  if (this.step - (this.lastLogged[990] ?? -99999) > 1500) {
    this.lastLogged[990] = this.step;
    const what = ['物音', '足音', 'うなり声'][n.s ?? 0];
    const ear = h.sp === Job.Thief ? '盗賊が' : h.sp === Job.Hunter ? '狩人が' : '';
    this.log(lead.x, lead.y, `冒険者の一行が、暗がりの奥の${what}に${ear ? ear + '気づき、' : ''}立ち止まって耳を澄ませた`);
  }
}

/** 耳を澄ましている一行の者（adventurer から。戦う相手がいないとき）：音の方を向いて止まる。前衛は一歩前に出て構える。true ならこの歩はこれで終わり */
export function listening(this: Ecology, c: Cr, p: Party): boolean {
  if ((p.listenT ?? 0) <= this.step || (p.camp ?? -1) >= 0) return false;
  const lx = p.listenX ?? c.x;
  const ly = p.listenY ?? c.y;
  c.dir = Math.abs(lx - c.x) > Math.abs(ly - c.y) ? (lx > c.x ? 2 : 3) : ly > c.y ? 0 : 1;
  if (c.id === p.listenBy && (p.listenT ?? 0) - this.step > LISTEN_STEPS - STEP_OUT && sq(lx - c.x) + sq(ly - c.y) > 3 * TILE * 3 * TILE) {
    c.act = 1;
    this.moveToward(c, lx, ly, 0.45);
    c.dir = Math.abs(lx - c.x) > Math.abs(ly - c.y) ? (lx > c.x ? 2 : 3) : ly > c.y ? 0 : 1;
    return true;
  }
  c.act = 0;
  return true;
}

declare module '../ecology' {
  interface Ecology {
    listenStep: typeof listenStep;
    listening: typeof listening;
  }
}

Object.assign(Ecology.prototype, { listenStep, listening });
