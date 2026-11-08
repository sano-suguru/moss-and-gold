/**
 * Ecology のメソッド：ミノタウロスの斧の薙ぎ払いと突進、はね飛ばし、怯み。
 *
 * ミノタウロスは、狙った相手が4マスの内なら斧の薙ぎ払い（前方の扇、4マス）、4〜8マスなら突進を使う。どちらも溜めてから放つ（src/eco/skill.ts）。
 * 突進は、頭を下げて地面をかく溜め（およそ1.6秒）のあと、溜めはじめたときに相手がいた方へ一直線に8マス走る（狙いは溜めはじめに決まるので、動けば避けられる）。
 *   通り道の者は横へはね飛ばして突き進む（はね飛ばされた者は壁に当たると傷が増え、着地したあと怯む）。戦士と僧侶に当たると、そこで止まる（受けた者の傷は半分）。
 *   壁にぶつかると、ミノタウロスがよろめく。縄張りの外へ出てもよく、そのあと寝床へ戻る。
 * 大物の溜めは、体力の上限の2割を超える重い一撃を受けたときだけ止まる（breakWindup。冒険者の技の溜めは、どんな一打ちでも止まる）。
 * 冒険者は突進の溜めを見ると、通り道にいる者が横へ下がる（盗賊と狩人はすぐ、魔法使いと吟遊詩人は少し遅れて。位の高い者ほど早い。技を溜めている者は下がれない）。
 * 戦士と僧侶は下がらず、ミノタウロスと狙われた仲間のあいだへ移って構え、突進を受け止める（advBrace）。
 * 怯み（Cr.stun）：およそ2秒、その場でふらついて立ち止まり、何もできない（技の溜めも始められない）。頭の上で小さな星が回る。
 *
 * ゴーレム（宝物庫の入口の番人）：入口から動かずに、2つの技を使う。
 *   両腕の振り下ろし（周りの円、3マス）：入口のそば（3マスの内）の相手に。当たった者はゴーレムを中心に外へはね飛ばされ、着地で怯む（入口から押し返す）。
 *   跳ねる衝撃波（直線8マス）：入口から8マスの内で、入口の方を向いて近づいてくる強さのある者（冒険者・ドワーフ・大物）か、宝を抱えた者に。
 *     丸い衝撃波が1.6マスおきに5回、少しずつ間を置いて跳ねていき（落ちる所は少し散らばり、遠くほど外へ開く。hopAt）、落ちたときに輪の中（半径およそ1マス）にいる者に当たって怯ませる（戦士や僧侶でも止められない）。
 *     輪と輪のあいだにいれば当たらない。向きは溜めはじめに決まる（Cr.kbx・kby に持つ）。
 *   どちらも重いが、冒険者を一撃では倒さない（体力の半分〜7割ほど）。冒険者は両方の予兆を見て避ける（戦士と僧侶は、振り下ろしからは下がらずに受ける）。
 */
import { CR_EVERY, Cr, Ecology, HUNT3, Job, Kind, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { SKILL_GOLEM_QUAKE, SKILL_GOLEM_SLAM, SKILL_MINO_CHARGE, SKILL_MINO_SWEEP } from './skill';

/** 突進の長さ（px）と、走る生き物の更新の回数 */
const RUN_LEN = 8 * TILE;
const RUN_N = 10;
/** はね飛ばされる量（px）と、飛んでいる更新の回数 */
const KB_LEN = 3 * TILE;
const KB_N = 4;
/** はね飛ばされたあとと、壁に当たったときの怯み（生き物の更新の回数。およそ2秒） */
const STUN_N = 10;
/** 薙ぎ払いと突進の重さ（打ち合いの一打ちに対する倍率） */
const SWEEP_MUL = 1.3;
const RUN_MUL = 1.5;

/** 溜めを止める（重い一撃を受けた）：構えを解いて、少しよろめく */
export function breakWindup(this: Ecology, c: Cr): void {
  c.act = 0;
  c.actT = 0;
  if (c.run === -1) c.run = 0;
  if (c.k === Kind.Minotaur) c.gait = 10;
  this.fxAttacks.push({ t: this.w.tick, style: 'puff', col: 0, size: 0, ax: c.x, ay: c.y, dx: c.x, dy: c.y - 16, did: -1, aid: c.id, big: false, kill: false });
  this.record('settle', { t: this.w.tick, k: c.k, ev: 'windupBroken', id: c.id, n: c.foe, x: Math.round(c.x), y: Math.round(c.y) } as never);
}

/** はね飛ばす：(ux, uy) の向きへ、KB_N 回の更新で KB_LEN 飛ぶ */
export function knock(this: Ecology, o: Cr, ux: number, uy: number): void {
  // ゴーレムは重くて動かない（ゴーレムの kbx・kby は、地割れの向きを持つのに使う）
  if (o.k === Kind.Golem) return;
  o.kb = KB_N;
  o.kbx = (ux * KB_LEN) / KB_N;
  o.kby = (uy * KB_LEN) / KB_N;
  o.flee = 0;
  o.sleep = 0;
}

/**
 * はね飛ばされている者と怯んでいる者の、生き物の更新ごとの進み。true なら今は飛んでいる（ほかの行いをしない）。
 * 飛ぶあいだに壁に当たると止まり、体力の上限の1割の傷を受ける（by が手を下した種）。着地したら怯む
 */
export function knockTick(this: Ecology, c: Cr): boolean {
  // 怯んでいるあいだは、その場でふらついて立ち止まる（頭の上で星が回る）。
  // （はじめは歩く速さを半分にしていたが、ゆっくり歩く種は歩く姿のままほとんど進まず、足踏みして見えた）
  if (c.kb <= 0) {
    if (c.stun <= 0) return false;
    c.stun--;
    c.act = 0;
    return true;
  }
  if (c.stun > 0) c.stun--;
  c.kb--;
  const x0 = c.x;
  const y0 = c.y;
  this.tryMove(c, c.kbx, c.kby);
  const moved = Math.abs(c.x - x0) + Math.abs(c.y - y0);
  c.act = 1;
  if (moved < (Math.abs(c.kbx) + Math.abs(c.kby)) * 0.4) {
    // 壁に当たった
    c.kb = 0;
    const mx = this.maxHp(c);
    if (c.hp <= 0) c.hp = mx;
    c.hp -= mx * 0.1;
    this.fxHits.push({ t: this.w.tick, x: c.x, y: c.y, ax: c.x - c.kbx, ay: c.y - c.kby, id: c.id });
    if (c.hp <= 0) {
      this.die(c, 'fight', Kind.Minotaur);
      return true;
    }
  }
  if (c.kb === 0) {
    c.stun = Math.max(c.stun, STUN_N);
    c.act = 0;
  }
  return true;
}

/** 突進で受け止める者（戦士と僧侶） */
function blocker(o: Cr): boolean {
  return o.k === Kind.Adventurer && (o.sp === Job.Warrior || o.sp === Job.Priest);
}

/**
 * ミノタウロスの技の進み（生き物の更新ごと、ほかの行いより先に）。true なら今は技の最中（ほかの行いをしない）
 */
export function minoSkill(this: Ecology, c: Cr): boolean {
  if (c.run > 0) {
    this.minoRun(c);
    return true;
  }
  const spec = c.run === -1 ? SKILL_MINO_CHARGE : SKILL_MINO_SWEEP;
  const sk = this.skillStep(c, spec, false);
  if (sk === 'charging') {
    if (c.run === -1) this.setDir(c, c.tx - c.x, c.ty - c.y);
    return true;
  }
  if (sk !== 'ready') {
    if (c.run === -1 && !(c.act === 2 && c.actT <= 0)) c.run = 0;
    return false;
  }
  c.act = 2;
  c.actT = 0;
  if (c.run === -1) {
    // 突進：溜めはじめたときに相手がいた方へ（動いていれば外れる）
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const L = Math.sqrt(dx * dx + dy * dy) || 1;
    c.tx = c.x + (dx / L) * RUN_LEN;
    c.ty = c.y + (dy / L) * RUN_LEN;
    c.run = RUN_N;
    this.fxAttacks.push({ t: this.w.tick, style: 'minocharge', col: 0, size: 2, ax: c.x, ay: c.y, dx: c.tx, dy: c.ty, did: -1, aid: c.id, big: true, kill: false, fly: RUN_N * CR_EVERY });
    return true;
  }
  // 斧の薙ぎ払い：いちばん近い獲物の方へ、前方の扇（4マス）
  const p = this.minoTarget(c, 5);
  const fx = p ? p.x - c.x : Math.cos((c.dir === 2 ? 0 : c.dir === 3 ? Math.PI : c.dir === 0 ? Math.PI / 2 : -Math.PI / 2));
  const fy = p ? p.y - c.y : c.dir === 0 ? 1 : c.dir === 1 ? -1 : 0;
  const L = Math.sqrt(fx * fx + fy * fy) || 1;
  this.areaStrike(c, c.x, c.y, fx / L, fy / L, { kind: 'fan', r: 4 * TILE, half: 1.1 }, SWEEP_MUL, { style: 'minosweep', col: 0 }, (o) => o.k !== Kind.Minotaur && o.k !== Kind.Ghost && o.k !== Kind.Wisp && !this.airborne(o));
  return true;
}

/** ミノタウロスが狙える、いちばん近い獲物（R マスの内、気づける者） */
export function minoTarget(this: Ecology, c: Cr, R: number): Cr | null {
  let best: Cr | null = null;
  let bd = R * TILE * R * TILE;
  this.nearby(c.x, c.y, R, (o) => {
    if (o.dead || o.away || o.caught || !HUNT3.includes(o.k) || !this.canSense(c, o) || this.airborne(o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

/**
 * 狩り（src/eco/combat.ts の hunt）で獲物 p に向かうミノタウロスが、技を使うか。使ったら（溜めはじめたら）true。
 * 4マスの内なら斧の薙ぎ払い、4〜8マスで見通しが利けば突進
 */
export function minoEngage(this: Ecology, c: Cr, p: Cr, d2: number): boolean {
  if (d2 <= 4 * TILE * 4 * TILE) {
    if (!this.skillCanStart(c, SKILL_MINO_SWEEP)) return false;
    this.skillStart(c, SKILL_MINO_SWEEP);
    c.run = 0;
    this.setDir(c, p.x - c.x, p.y - c.y);
    return true;
  }
  if (d2 <= RUN_LEN * RUN_LEN && this.skillCanStart(c, SKILL_MINO_CHARGE) && lineOfSight(this.w.map, c.x, c.y, p.x, p.y)) {
    this.skillStart(c, SKILL_MINO_CHARGE);
    c.run = -1;
    c.aim = p.id;
    c.tx = p.x;
    c.ty = p.y;
    this.setDir(c, p.x - c.x, p.y - c.y);
    return true;
  }
  return false;
}

/** 突進の1回の更新：一直線に走り、通り道の者をはね飛ばす。前衛か壁に当たるか、走りきったら止まる */
export function minoRun(this: Ecology, c: Cr): void {
  c.run--;
  c.act = 2;
  c.actT = 1;
  const dx = c.tx - c.x;
  const dy = c.ty - c.y;
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const step = Math.min(L, RUN_LEN / RUN_N);
  const x0 = c.x;
  const y0 = c.y;
  this.tryMove(c, ux * step, uy * step);
  this.setDir(c, ux, uy);
  const moved = Math.sqrt(sq(c.x - x0) + sq(c.y - y0));
  // 通り道（動く前から動いたあとまでの線から11px の内）の者
  let stop = false;
  const hit: Cr[] = [];
  this.nearby(c.x, c.y, 2, (o) => {
    if (o === c || o.dead || o.away || o.caught || o.k === Kind.Minotaur || o.k === Kind.Ghost || o.k === Kind.Wisp || this.airborne(o)) return;
    // 同じ突進ですでに打った者（はね飛ばされている者と、この突進で打たれたばかりの者）は打たない
    if (o.kb > 0 || (o.foe === c.id && this.w.tick - o.hitAt <= RUN_N * CR_EVERY)) return;
    const px = o.x - x0;
    const py = o.y - y0;
    const along = px * ux + py * uy;
    if (along < -4 || along > moved + 10 || Math.abs(px * uy - py * ux) > 11) return;
    hit.push(o);
  });
  hit.sort((p, q) => (p.x - x0) * ux + (p.y - y0) * uy - ((q.x - x0) * ux + (q.y - y0) * uy) || p.id - q.id);
  // 突進で倒した獲物のうち、まだ食べていなければ最初の1体を食べる（寝床まで引きずる。src/eco/monsters.ts の dragToLair）
  let ate = c.feed > 0;
  const fed0 = c.feed;
  for (const o of hit) {
    if (blocker(o)) {
      // 戦士と僧侶が受け止める：突進はここで止まり、受けた者の傷は半分。受けた者は少し押し戻される
      this.fxAttacks.push({ t: this.w.tick, style: 'minoimpact', col: 1, size: 2, ax: c.x, ay: c.y, dx: o.x, dy: o.y, did: o.id, aid: c.id, big: true, kill: false });
      if (this.strike(c, o, RUN_MUL * 0.5, false)) ate = this.slay(c, o, !ate) || ate;
      else {
        o.kb = 2;
        o.kbx = ux * 5;
        o.kby = uy * 5;
      }
      this.record('settle', { t: this.w.tick, k: Kind.Minotaur, ev: 'chargeBlock', id: c.id, n: o.sp, x: Math.round(o.x), y: Math.round(o.y) } as never);
      stop = true;
      break;
    }
    // はね飛ばす：突進の線から離れる横の向きへ（線の上ならどちらかへ）
    const side = (o.x - x0) * uy - (o.y - y0) * ux;
    const sg = Math.abs(side) > 1 ? Math.sign(side) : ih(o.id, c.id, 331) & 1 ? 1 : -1;
    const kx = uy * sg * 0.85 + ux * 0.5;
    const ky = -ux * sg * 0.85 + uy * 0.5;
    this.fxAttacks.push({ t: this.w.tick, style: 'minoimpact', col: 0, size: 1, ax: c.x, ay: c.y, dx: o.x, dy: o.y, did: o.id, aid: c.id, big: true, kill: false });
    if (this.strike(c, o, RUN_MUL, false)) ate = this.slay(c, o, !ate) || ate;
    else this.knock(o, kx, ky);
    this.record('settle', { t: this.w.tick, k: Kind.Minotaur, ev: 'chargeKnock', id: c.id, at: c.cast, n: o.k, x: Math.round(o.x), y: Math.round(o.y) } as never);
  }
  if (!stop && moved < step * 0.4) {
    // 壁にぶつかった：よろめく
    c.gait = 14;
    this.fxAttacks.push({ t: this.w.tick, style: 'minoimpact', col: 2, size: 2, ax: c.x, ay: c.y, dx: c.x + ux * 10, dy: c.y + uy * 10, did: -1, aid: c.id, big: true, kill: false });
    stop = true;
  }
  // 獲物を食べたら、突進はそこで終わる（次の更新から食べる。src/eco/move.ts の feeding）
  if (c.feed !== fed0) stop = true;
  if (stop || c.run <= 0 || L < 4) this.minoRunEnd(c);
}

/** 突進が終わった：狙った冒険者に当たらなかったら（予兆を見て避けた）記録する。歩く目的地は選び直す */
export function minoRunEnd(this: Ecology, c: Cr): void {
  c.run = 0;
  c.act = 0;
  c.actT = 6;
  const a = this.byId.get(c.aim);
  if (a && !a.dead && a.k === Kind.Adventurer && !(a.foe === c.id && this.w.tick - a.hitAt <= (RUN_N + 2) * CR_EVERY)) this.record('settle', { t: this.w.tick, k: Kind.Minotaur, ev: 'chargeDodge', id: c.id, n: a.sp, x: Math.round(a.x), y: Math.round(a.y) } as never);
  c.aim = 0;
  c.tx = 0;
  c.ty = 0;
}

/**
 * 冒険者が、近くのミノタウロスの突進の溜めを見たときの動き。true なら今はそれをしている（ほかの行いをしない）。
 * 通り道（ミノタウロスから狙いの方へ8マス、幅およそ1.4マス）にいる者は横へ下がる。下がりはじめるのは、溜めはじめから
 * 盗賊と狩人はすぐ、竜殺しは生き物の更新2回、魔法使いと吟遊詩人は4回のあと（位1つにつき1回早い）。
 * 戦士と僧侶は下がらず、ミノタウロスと狙われた仲間のあいだ（ミノタウロスから2.5マス）へ移って構える
 */
export function advBrace(this: Ecology, c: Cr): boolean {
  let m: Cr | null = null;
  let g: Cr | null = null;
  this.nearby(c.x, c.y, 10, (o) => {
    if (o.dead || o.act !== 2 || o.actT >= 0) return;
    if (!m && o.k === Kind.Minotaur && o.run === -1) m = o;
    if (!g && o.k === Kind.Golem) g = o;
  });
  if (g && this.advDodgeGolem(c, g)) return true;
  if (!m) return false;
  const mm = m as Cr;
  const dx = mm.tx - mm.x;
  const dy = mm.ty - mm.y;
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const along = (c.x - mm.x) * ux + (c.y - mm.y) * uy;
  const side = (c.x - mm.x) * uy - (c.y - mm.y) * ux;
  const sp = 1.0;
  if (blocker(c)) {
    // 狙われた仲間が通り道にいて、自分が仲間より遠くなければ、あいだへ入る
    const a = this.byId.get(mm.aim);
    if (!a || a.dead || a.k !== Kind.Adventurer || a === c) return false;
    const aAlong = (a.x - mm.x) * ux + (a.y - mm.y) * uy;
    if (aAlong < 2 * TILE || sq(c.x - a.x) + sq(c.y - a.y) > 6 * TILE * 6 * TILE) return false;
    const bx = mm.x + ux * Math.min(2.5 * TILE, aAlong * 0.6);
    const by = mm.y + uy * Math.min(2.5 * TILE, aAlong * 0.6);
    if (sq(bx - c.x) + sq(by - c.y) > 36) {
      c.act = 1;
      this.goTo(c, bx, by, 1.3 * sp);
    } else c.act = 0;
    this.setDir(c, mm.x - c.x, mm.y - c.y);
    return true;
  }
  if (along < -8 || along > RUN_LEN + 12 || Math.abs(side) > 22) return false;
  const rank = this.heroOf(c)?.rank ?? 0;
  const delay = Math.max(0, (c.sp === Job.Thief || c.sp === Job.Hunter ? 0 : c.sp === Job.Slayer ? 2 : 4) - rank);
  if ((this.w.tick - mm.cast) / CR_EVERY < delay) return false;
  // 横へ下がる（線から離れる向き。線の上ならどちらかへ）
  const sg = Math.abs(side) > 1 ? Math.sign(side) : ih(c.id, mm.id, 332) & 1 ? 1 : -1;
  sidestep.call(this, c, uy * sg * 1.5, -ux * sg * 1.5, false);
  this.setDir(c, mm.x - c.x, mm.y - c.y);
  return true;
}

/** ゴーレムの技の重さ（打ち合いの一打ちに対する倍率。ゴーレムは強さ40なので、冒険者の体力の半分〜7割ほど） */
const SLAM_MUL = 0.7;
const QUAKE_MUL = 0.6;
/** 跳ねる衝撃波：落ちる回数、間隔（px）、輪の半径（px）、落ちる間（tick）。届く長さは HOP_N × HOP_GAP（およそ8マス） */
const HOP_N = 5;
const HOP_GAP = 1.6 * TILE;
const HOP_R = 17;
const HOP_DT = 1.5;
const QUAKE_LEN = HOP_N * HOP_GAP;
/** 冒険者が下がる、衝撃波の通り道の半分の幅（px） */
const QUAKE_W = HOP_R;

/**
 * 跳ねる衝撃波の i 番目（1〜HOP_N）が落ちる所。まっすぐの線から少し散らす：向きを左右へ最大およそ14度ずらし（遠くの輪ほど外へ開いて、気持ち放射状になる）、
 * 間隔をおよそ±12%、横へ最大4ドットずらす。ずれ方はゴーレムの番号と溜めはじめた時刻だけで決まる（予兆の印・輪の絵・当たる所が同じになる。描画からも呼ぶ）
 */
export function hopAt(id: number, cast: number, gx: number, gy: number, ux: number, uy: number, i: number): [number, number] {
  const h = (salt: number) => ih(id, cast * 7 + i, salt) / 4294967296;
  const da = (h(341) - 0.5) * 0.48;
  const ca = Math.cos(da);
  const sa = Math.sin(da);
  const vx = ux * ca - uy * sa;
  const vy = ux * sa + uy * ca;
  const d = HOP_GAP * i * (0.88 + h(342) * 0.24);
  const side = (h(343) - 0.5) * 8;
  return [gx + vx * d - vy * side, gy + vy * d + vx * side];
}

/** ゴーレムの技の相手になれる者（強さのある者。霊・ウィスプ・飛んでいる者・ゴーレム自身は除く） */
function golemFoe(o: Cr): boolean {
  return o.k !== Kind.Golem && o.k !== Kind.Ghost && o.k !== Kind.Wisp && o.k !== Kind.Dragon && o.k !== Kind.Worm && o.k !== Kind.Mimic && o.k !== Kind.Gargoyle && o.k !== Kind.Armor;
}

/**
 * ゴーレムの技の進み（生き物の更新ごと、ほかの行いより先に）。true なら今は技の最中（ほかの行いをしない）。
 * c.run が −2 なら地割れの溜め、それ以外は振り下ろしの溜め
 */
export function golemSkill(this: Ecology, c: Cr): boolean {
  const quake = c.run === -2;
  const sk = this.skillStep(c, quake ? SKILL_GOLEM_QUAKE : SKILL_GOLEM_SLAM, false);
  if (sk === 'charging') {
    if (quake) this.setDir(c, c.kbx, c.kby);
    return true;
  }
  if (sk !== 'ready') {
    if (quake && !(c.act === 2 && c.actT <= 0)) c.run = 0;
    return false;
  }
  c.act = 2;
  c.actT = 0;
  const aim = this.byId.get(c.aim);
  const who = (o: Cr) => golemFoe(o) && !this.airborne(o);
  if (quake) {
    c.run = 0;
    // 跳ねる衝撃波：向きの線の上に、HOP_GAP おきに HOP_N 回、HOP_DT tick ずつ間を置いて落ちる。それぞれ落ちたときに、輪の中（半径 HOP_R）にいる者に当たって怯ませる
    // （矢の雨と同じ、少し後で当たる攻撃。src/eco/attack.ts の resolveVolleys）。見通しの利かない所（壁の向こう）には落ちない
    const m = this.w.map;
    let n = 0;
    for (let i = 1; i <= HOP_N; i++) {
      const [hx, hy] = hopAt(c.id, c.cast, c.x, c.y, c.kbx, c.kby, i);
      if (!lineOfSight(m, c.x, c.y, hx, hy)) break;
      this.queueVolley(c, { d: -1, x: hx, y: hy, r: HOP_R, mul: QUAKE_MUL, poison: 0, stun: STUN_N }, Math.round(i * HOP_DT));
      n = i;
    }
    this.fxAttacks.push({ t: this.w.tick, style: 'gquake', col: 0, size: 2, ax: c.x, ay: c.y, dx: c.x + c.kbx * HOP_GAP * n, dy: c.y + c.kby * HOP_GAP * n, did: -1, aid: c.id, big: true, kill: false, n, fly: Math.round(n * HOP_DT), rad: c.cast });
    this.lastBigHit = this.w.tick;
    // 狙った冒険者が、どの輪にも入っていなければ（予兆を見て避けた）。輪は少し後で落ちるので、いまの位置で見る
    if (aim && !aim.dead && aim.k === Kind.Adventurer) {
      let inside = false;
      for (let i = 1; i <= n; i++) {
        const [hx, hy] = hopAt(c.id, c.cast, c.x, c.y, c.kbx, c.kby, i);
        if (sq(aim.x - hx) + sq(aim.y - hy) <= HOP_R * HOP_R) inside = true;
      }
      if (!inside) this.record('settle', { t: this.w.tick, k: Kind.Golem, ev: 'golemDodge', id: c.id, n: aim.sp, x: Math.round(aim.x), y: Math.round(aim.y) } as never);
    }
    c.aim = 0;
    return true;
  } else {
    // 振り下ろし：周りの円（3マス）。当たった者は外へはね飛ばす（入口から押し返す）
    this.areaStrike(c, c.x, c.y, 1, 0, { kind: 'circle', r: 3 * TILE }, SLAM_MUL, { style: 'gslam', col: 0 }, who);
    this.nearby(c.x, c.y, 4, (o) => {
      if (o.dead || o.foe !== c.id || o.hitAt !== this.w.tick) return;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const L = Math.sqrt(dx * dx + dy * dy) || 1;
      this.knock(o, dx / L, dy / L);
      if (o.k === Kind.Adventurer) this.record('settle', { t: this.w.tick, k: Kind.Golem, ev: 'slamKnock', id: c.id, n: o.sp, x: Math.round(o.x), y: Math.round(o.y) } as never);
    });
  }
  // 狙った冒険者に振り下ろしが当たらなかった（予兆を見て避けた）
  if (aim && !aim.dead && aim.k === Kind.Adventurer && aim.hitAt !== this.w.tick) this.record('settle', { t: this.w.tick, k: Kind.Golem, ev: 'golemDodge', id: c.id, n: aim.sp, x: Math.round(aim.x), y: Math.round(aim.y) } as never);
  c.aim = 0;
  return true;
}

/**
 * 持ち場のゴーレムが、技を使うか（溜めはじめたら true）。foe は入口を通ろうとする者か宝を抱えた者（src/eco/monsters.ts の golem）。
 * 3マスの内に相手がいれば振り下ろし。そうでなければ、入口から8マスの内で入口の方を向いて近づいてくる者か宝を抱えた者に、地割れ
 */
export function golemEngage(this: Ecology, c: Cr, foe: Cr | null): boolean {
  if (foe && sq(foe.x - c.x) + sq(foe.y - c.y) <= 3 * TILE * 3 * TILE && this.skillCanStart(c, SKILL_GOLEM_SLAM)) {
    this.skillStart(c, SKILL_GOLEM_SLAM);
    c.run = 0;
    c.aim = foe.id;
    return true;
  }
  if (!this.skillCanStart(c, SKILL_GOLEM_QUAKE)) return false;
  const m = this.w.map;
  let best: Cr | null = null;
  let bd = QUAKE_LEN * QUAKE_LEN;
  this.nearby(c.tx, c.ty, 9, (o) => {
    if (o.dead || o.away || o.caught || !golemFoe(o) || this.airborne(o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d >= bd || d < 2 * TILE * 2 * TILE) return;
    const k = this.tileOf(o.x, o.y);
    const thief = o.gold > 0 && k >= 0 && m.vault[k];
    if (!thief) {
      // 冒険者とドワーフは8マスの内から、大物（強さ6以上）は5マスの内まで近づいたら（宝物庫のそばをうろつくトロールに、地割れを撃ち続けていた）
      if (!(o.k === Kind.Adventurer || o.k === Kind.Dwarf || (this.str(o) >= 6 && d <= 5 * TILE * 5 * TILE))) return;
      // 入口の方を向いている（向きはセーブに入っている値。前の位置との差で決めると、ロードし直したときにずれる）
      const fx = o.dir === 2 ? 1 : o.dir === 3 ? -1 : 0;
      const fy = o.dir === 0 ? 1 : o.dir === 1 ? -1 : 0;
      if ((c.tx - o.x) * fx + (c.ty - o.y) * fy <= 0) return;
    }
    if (!lineOfSight(m, c.x, c.y, o.x, o.y)) return;
    bd = d;
    best = o;
  });
  if (!best) return false;
  const b = best as Cr;
  const L = Math.sqrt(bd) || 1;
  this.skillStart(c, SKILL_GOLEM_QUAKE);
  c.run = -2;
  c.aim = b.id;
  c.kbx = (b.x - c.x) / L;
  c.kby = (b.y - c.y) / L;
  this.setDir(c, c.kbx, c.kby);
  return true;
}

/**
 * 予兆を見て横（または外）へ下がる一歩：(vx, vy) の向きへ動き、壁で進めなければ反対の向き、それも無理ならその場で構える
 * （壁に向かって歩く姿のまま足踏みしないように）
 */
function sidestep(this: Ecology, c: Cr, vx: number, vy: number, back: boolean): void {
  const x0 = c.x;
  const y0 = c.y;
  this.tryMove(c, vx, vy);
  if (Math.abs(c.x - x0) + Math.abs(c.y - y0) < 0.4 && !back) this.tryMove(c, -vx, -vy);
  c.act = Math.abs(c.x - x0) + Math.abs(c.y - y0) < 0.4 ? 0 : 1;
}

/** 予兆を見て下がりはじめるまでの、溜めはじめからの生き物の更新の回数（盗賊と狩人はすぐ、竜殺しは2回、ほかは4回。位1つにつき1回早い） */
function dodgeDelay(this: Ecology, c: Cr): number {
  const rank = this.heroOf(c)?.rank ?? 0;
  return Math.max(0, (c.sp === Job.Thief || c.sp === Job.Hunter ? 0 : c.sp === Job.Slayer ? 2 : 4) - rank);
}

/**
 * 冒険者が、ゴーレムの溜めを見たときの動き。true なら今は下がっている。
 * 地割れの溜め（地面に光る筋）：線の上にいる者は横へ下がる（戦士と僧侶も。地面の下を走るので受け止められない）。
 * 振り下ろしの溜め（両腕を掲げて目が光る）：円の中（3.3マスの内）にいる者は外へ下がる（戦士と僧侶は下がらずに受ける）
 */
export function advDodgeGolem(this: Ecology, c: Cr, g: Cr): boolean {
  if ((this.w.tick - g.cast) / CR_EVERY < dodgeDelay.call(this, c)) return false;
  if (g.run === -2) {
    const along = (c.x - g.x) * g.kbx + (c.y - g.y) * g.kby;
    const side = (c.x - g.x) * g.kby - (c.y - g.y) * g.kbx;
    if (along < -4 || along > QUAKE_LEN + 8 || Math.abs(side) > QUAKE_W + 10) return false;
    const sg = Math.abs(side) > 1 ? Math.sign(side) : ih(c.id, g.id, 333) & 1 ? 1 : -1;
    sidestep.call(this, c, g.kby * sg * 1.5, -g.kbx * sg * 1.5, false);
    this.setDir(c, g.x - c.x, g.y - c.y);
    return true;
  }
  if (blocker(c)) return false;
  const dx = c.x - g.x;
  const dy = c.y - g.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > 3.3 * TILE * 3.3 * TILE) return false;
  const L = Math.sqrt(d2) || 1;
  sidestep.call(this, c, (dx / L) * 1.5, (dy / L) * 1.5, true);
  this.setDir(c, g.x - c.x, g.y - c.y);
  return true;
}

declare module '../ecology' {
  interface Ecology {
    breakWindup: typeof breakWindup;
    knock: typeof knock;
    knockTick: typeof knockTick;
    minoSkill: typeof minoSkill;
    minoTarget: typeof minoTarget;
    minoEngage: typeof minoEngage;
    minoRun: typeof minoRun;
    minoRunEnd: typeof minoRunEnd;
    advBrace: typeof advBrace;
    golemSkill: typeof golemSkill;
    golemEngage: typeof golemEngage;
    advDodgeGolem: typeof advDodgeGolem;
  }
}

Object.assign(Ecology.prototype, { breakWindup, knock, knockTick, minoSkill, minoTarget, minoEngage, minoRun, minoRunEnd, advBrace, golemSkill, golemEngage, advDodgeGolem });
