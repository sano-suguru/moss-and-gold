/** Ecology のメソッド：大ネズミ（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function rat(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Rat];
  // 動いている大トカゲに気づいたら逃げる
  let threat: Cr | null = null;
  // 逃げるほどではないが近く（40px の内）にいる怖い相手
  let wary: Cr | null = null;
  this.nearby(c.x, c.y, 3, (o) => {
    if (o.dead) return;
    const scary = (o.k === Kind.Lizard && o.act !== 0) || (o.k === Kind.Zombie && o.act !== 0) || o.k === Kind.Ghost || ((o.k === Kind.Kobold || o.k === Kind.Goblin || o.k === Kind.Lizardman || o.k === Kind.Orc || o.k === Kind.Minotaur) && o.hungry > 0);
    if (!scary) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < (o.k === Kind.Ghost ? 34 * 34 : 26 * 26)) threat = o;
    else if (d < 40 * 40) wary = o;
  });
  // 逃げる距離の外でも、40px の内の怖い相手が、次に向かう道筋の点の方向にいれば、近づかずにその場で様子をうかがう
  // （以前は26px の境目で、相手から離れる一歩と、相手の方を通る道筋へ戻る一歩を更新ごとに繰り返し、その場で行ったり来たりしていた。
  //  seed35 では巣穴へ帰る大ネズミが40秒以上）
  if (!threat && wary) {
    const p = this.paths.get(c.id);
    const wp = p && p.pi < p.path.length ? p.path[p.pi] : -1;
    if (wp >= 0) {
      const m = this.w.map;
      const w = wary as Cr;
      const ax = (wp % m.w) * TILE + 8 - c.x;
      const ay = Math.floor(wp / m.w) * TILE + 8 - c.y;
      const bx = w.x - c.x;
      const by = w.y - c.y;
      const la = Math.hypot(ax, ay) || 1;
      const lb = Math.hypot(bx, by) || 1;
      if ((ax * bx + ay * by) / (la * lb) > 0.5) {
        c.act = 0;
        return;
      }
    }
  }
  if (threat) {
    const t = threat as Cr;
    const dx = c.x - t.x;
    const dy = c.y - t.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    this.tryMove(c, (dx / d) * s.speed * 1.4, (dy / d) * s.speed * 1.4);
    c.act = 1;
    c.st = 0;
    // 目当ての苔へ向かう途中でおびえたら、その苔はあきらめて別の苔を探す
    // （以前は、細い通路にいるゴーストやクモにおびえては同じ苔へ戻り、を繰り返して苔のそばで飢えていた）
    if (c.ref > 0) {
      c.gait = c.ref;
      c.ref = 0;
    }
    return;
  }
  // 一列になって、新しい巣穴へ引っ越していくところ
  if (c.st === 11) {
    this.ratMarch(c);
    return;
  }
  // 群れで外へ出ていくところ
  if (c.st === 8) {
    c.act = 1;
    const open = this.w.map.mouths.some((mo, i) => mo.kind === 0 && this.mouthOpen(i));
    const here = this.tileOf(c.x, c.y);
    // 口まで行き着けないまま飢えが進んだら、あきらめて近くで食べ物を探す
    if (!open || c.hungry > s.starve * 0.7) c.st = 1;
    // 道すがら食べられる苔があれば、少し食べてから進む
    else if (here >= 0 && c.food < s.cap * 0.5 && Math.max(this.w.moss[here], this.w.fungus[here]) >= 20 && this.eatMoss(c, 2)) c.act = 2;
    else if (this.goTo(c, c.tx, c.ty, s.speed) || sq(c.tx - c.x) + sq(c.ty - c.y) < 30 * 30) this.exitCreature(c, 'dispersed');
    return;
  }
  // 腹を空かせて食べ物が見つからなければ、行き詰まる前に去る
  if (c.hungry > 150 && this.step % 20 === c.id % 20 && this.ratDisperse(c)) return;
  if (c.st === 0) {
    // 巣穴への道筋が見つからない（遠すぎる、ふさがった）なら、はぐれ者になって食べ物を探す。
    // 近くの巣穴には、群れの見直し（tendGroups）で加わる（以前は、届かない巣穴へまっすぐ歩いては壁に当たり続けていた）
    // 巣穴へ帰る・休む（巣穴のまわりに散らばって）
    const ox = ((c.id % 5) - 2) * 6;
    const oy = (((c.id >> 3) % 3) - 1) * 5;
    const hx = this.passable(c, c.hx + ox, c.hy + oy) ? c.hx + ox : c.hx;
    const hy = this.passable(c, c.hx + ox, c.hy + oy) ? c.hy + oy : c.hy;
    const hp0 = this.paths.get(c.id);
    if (!(c.hx || c.hy) || (hp0 && hp0.path.length === 0 && hp0.gk === this.tileOf(hx, hy) && sq(hx - c.x) + sq(hy - c.y) > 3 * TILE * 3 * TILE)) {
      c.hx = 0;
      c.hy = 0;
      c.st = 1;
      return;
    }
    if (this.goTo(c, hx, hy, s.speed)) {
      c.act = 0;
      // 殖えるかどうかは、巣穴のまわりで養える数で決める（全体の目安も超えない）
      if (c.food >= 24 && this.counts[Kind.Rat] < Math.min(this.ratCap(), this.ratFoodCap()) && ih(c.id, this.step, 11) % 45 === 0 && this.burrowResidents(c) < this.burrowCapOf(c)) {
        c.food -= 12;
        const pup = this.spawn(Kind.Rat, c.x, c.y, 12, 0);
        pup.hx = c.hx;
        pup.hy = c.hy;
      }
    } else c.act = 1;
    if (c.food < s.cap / 2 && ih(c.id, this.step, 12) % 6 === 0) c.st = 1;
    return;
  }
  if (c.st === 1) {
    // 冒険者の物資の置き場がそばにあれば、木箱の食料をあさる
    if (this.ratRaidCache(c)) return;
    // 足もとに食べられる苔かキノコがあれば、遠くの目当てまで行かずにここで食べる（目当てに道筋が通らないまま、苔の上で飢えないように）
    const here = this.tileOf(c.x, c.y);
    if (here >= 0 && c.food < s.cap * 0.8 && Math.max(this.w.moss[here], this.w.fungus[here]) >= 20) {
      c.st = 2;
      return;
    }
    // 目指す苔が食べ尽くされていたら、すぐに選び直す。道筋が見つからなかった所は避ける
    const cur = c.ref - 1;
    // 道筋の見つからなかった目当てはあきらめる（以前は、道筋を探した直後の生き物の更新4回分しか見ておらず、その間ほかのことをしていると、
    // 届かない目当てへまっすぐ歩いて壁に当たり続け、そばの苔に気づかずに飢えていた）
    const pp = this.paths.get(c.id);
    const noPath = !!pp && pp.path.length === 0 && cur >= 0 && pp.gk === cur;
    if (cur >= 0 && (Math.max(this.w.moss[cur], this.w.fungus[cur]) < 20 || noPath)) {
      if (noPath) c.gait = cur + 1;
      c.ref = 0;
    }
    // 腹を空かせて目当てへ向かう途中でも、生き物の更新10回に1回まわりを見直し、歩いて12マス以内に、目当てまでの残りの道のりより近い食べ物があれば替える
    // （以前は目当てがまだ食べられる限り選び直さず、道のりの長い目当て（まっすぐなら近くても回り道）へ向かう途中で、
    //  近くの苔やキノコの前を通っても気づかずに飢えていた。seed30 の19日目に飢え死にした19匹の多くは、死んだ所から道のり10マス以内に食べ物があった）
    if (c.hungry > 0 && c.ref > 0 && this.step % 10 === c.id % 10) {
      const goal = c.ref - 1;
      const gp = this.paths.get(c.id);
      const left = gp && gp.gk === goal && gp.path.length ? gp.path.length - gp.pi : Math.hypot(((goal % this.w.map.w) + 0.5) * TILE - c.x, (Math.floor(goal / this.w.map.w) + 0.5) * TILE - c.y) / TILE;
      if (left > 4) {
        const [t2, d2] = this.nearestEdibleD(c, 12);
        if (t2 >= 0 && t2 !== goal && d2 + 2 < left) c.ref = t2 + 1;
      }
    }
    if (c.ref === 0 || (ih(c.id, this.step, 13) % 50 === 0 && !(c.hungry > 0 && cur >= 0 && Math.max(this.w.moss[cur], this.w.fungus[cur]) >= 20))) {
      // 腹を空かせていれば、歩いて12マス以内でいちばん近い食べられる苔かキノコを目当てにする
      // （いくつかの点を選んで調べるやり方では、まばらな苔を見落として、ずっと遠くの群落を目指して途中で飢えていた）
      let t = c.hungry > 0 ? this.nearestEdible(c, 12) : -1;
      if (t < 0) t = this.findMoss(c, c.x, c.y, 9, 200);
      if (t < 0) t = this.findMoss(c, c.hx, c.hy, 10, 230);
      // 近くになければ、土地勘から豊かな群落を目指す（腹が減るほど遠くまで）
      if (t < 0) t = this.nearestForage(c.x, c.y, 30 + Math.min(60, c.hungry / 10), c.gait - 1);
      if (t < 0 && this.w.map.shafts.length) {
        const sh = this.w.map.shafts[ih(c.id, this.step, 15) % this.w.map.shafts.length];
        t = this.findMoss(c, sh.x * TILE + 8, sh.y * TILE + 8, 6, 260);
      }
      c.ref = t >= 0 ? t + 1 : 0;
      if (t < 0) {
        const j = DIR16[ih(c.id, this.step, 14) & 15];
        this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
        c.act = 1;
        return;
      }
    }
    const t = c.ref - 1;
    const gx = (t % this.w.map.w) * TILE + 2 + (ih(c.id, 1) % 13);
    const gy = Math.floor(t / this.w.map.w) * TILE + 2 + (ih(c.id, 2) % 13);
    c.act = 1;
    if (this.goTo(c, gx, gy, s.speed)) c.st = 2;
    return;
  }
  // 食べる
  if (this.eatMoss(c, 2)) {
    c.act = 2;
    if (c.actT > 4) c.actT = 0;
  } else {
    c.ref = 0;
    c.st = c.food >= s.cap * 0.8 ? 0 : 1;
  }
  if (c.food >= s.cap * 0.9) c.st = 0;
}

export function ratCap(this: Ecology): number {
  return Math.min(90, Math.floor(this.openMoss / 300));
}

/** 中の食べ物で養える大ネズミの数の目安：開いた床の、食べられる苔（20以上の群落の、根元12を除いた分）を、一匹がゲーム内の2日に食べる量で割る */
export function ratFoodCap(this: Ecology): number {
  return Math.floor(this.edibleMoss / 1200);
}

/** 巣穴のまわり（10マス）の食べられる苔とキノコ（20以上の群落の、根元12を除いた分） */
export function burrowFood(this: Ecology, x: number, y: number): number {
  const m = this.w.map;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  let f = 0;
  for (let yy = Math.max(1, ty - 10); yy <= Math.min(m.h - 2, ty + 10); yy++)
    for (let xx = Math.max(1, tx - 10); xx <= Math.min(m.w - 2, tx + 10); xx++) {
      const k = yy * m.w + xx;
      if (m.solid[k] || m.sealed[k]) continue;
      const v = Math.max(this.w.moss[k], this.w.fungus[k]);
      if (v >= 20) f += v - 12;
    }
  return f;
}

/**
 * 巣穴の引っ越し：まわりの苔が尽きてきた巣穴は、歩いて行ける（道のり120マスまで）苔の豊かな所へ群れごと移る。
 * ゲーム内の1/4日に一度まで試す。移った先が見つかれば true
 */
/** 引っ越しの列（st 11）：先頭は新しい巣穴へ、ほかは前を行く仲間のすぐ後ろについて歩く。先頭は、すぐ後ろの仲間が遅れたら待つ */
export function ratMarch(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Rat];
  const done = () => {
    c.st = 0;
    c.ref2 = 0;
    c.tx = 0;
  };
  // 長くかかりすぎたか、ひどく腹が減ったら、列を離れる（それぞれ新しい巣穴へ帰る）
  if (this.step - c.tx > 2500 || c.hungry > s.starve * 0.5) return done();
  if (sq(c.hx - c.x) + sq(c.hy - c.y) < 1.2 * TILE * 1.2 * TILE) {
    c.act = 0;
    return done();
  }
  // 冒険者やドワーフが近く（3マス）にいれば、列のまま、まず離れる（以前は列のまま足もとを通って払われていた）
  let man: Cr | null = null;
  this.nearby(c.x, c.y, 3, (o) => {
    if (!man && !o.dead && !o.away && (o.k === Kind.Adventurer || o.k === Kind.Dwarf) && sq(o.x - c.x) + sq(o.y - c.y) < 3 * TILE * 3 * TILE) man = o;
  });
  if (man) {
    const mm = man as Cr;
    const dx = c.x - mm.x;
    const dy = c.y - mm.y;
    const L = Math.sqrt(dx * dx + dy * dy) || 1;
    c.act = 1;
    this.tryMove(c, (dx / L) * s.speed * 1.3, (dy / L) * s.speed * 1.3);
    return;
  }
  // 前を行く仲間（列を離れた者、死んだ者は飛ばして、その前の者）
  let ahead = c.ref2 ? this.byId.get(c.ref2) : undefined;
  for (let i = 0; i < 12 && ahead && (ahead.dead || ahead.st !== 11); i++) ahead = ahead.ref2 ? this.byId.get(ahead.ref2) : undefined;
  if (ahead && (ahead.dead || ahead.st !== 11)) ahead = undefined;
  c.act = 1;
  if (!ahead) {
    // 先頭：すぐ後ろの仲間が3マスより遅れていたら、立ち止まって待つ
    let lag = false;
    for (const o of this.list) if (o.k === Kind.Rat && !o.dead && o.st === 11 && o.ref2 === c.id && sq(o.x - c.x) + sq(o.y - c.y) > 3 * TILE * 3 * TILE) lag = true;
    if (lag && ih(c.id, this.step, 236) % 4 !== 0) {
      c.act = 0;
      return;
    }
    this.goTo(c, c.hx, c.hy, s.speed * 0.85);
    return;
  }
  const d2 = sq(ahead.x - c.x) + sq(ahead.y - c.y);
  if (d2 > 12 * 12) this.goTo(c, ahead.x, ahead.y, s.speed);
  else if (ahead.act === 1 && d2 > 7 * 7) this.moveToward(c, ahead.x, ahead.y, s.speed * 0.85);
  else {
    c.act = 0;
    c.dir = Math.abs(ahead.x - c.x) > Math.abs(ahead.y - c.y) ? (ahead.x > c.x ? 2 : 3) : ahead.y > c.y ? 0 : 1;
  }
}

export function relocateBurrow(this: Ecology, b: Burrow, fromFire = false): boolean {
  if (this.w.tick - (b.moved ?? -1e9) < DAY_TICKS_ECO / 4) return false;
  b.moved = this.w.tick;
  const m = this.w.map;
  const res = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y);
  if (!res.length) return false;
  const here = this.burrowFood(b.x, b.y);
  const dist = this.walkDist(this.tileOf(b.x, b.y - 3), 120);
  const reach: number[] = [];
  for (let q = 0; q < dist.length; q++) if (dist[q] >= 8) reach.push(q);
  if (!reach.length) return false;
  let best = -1;
  // 火のそばから逃げるときは、まわりに食べ物が足りれば十分（今より豊かでなくてもよい）
  let bv = fromFire ? Math.max(res.length * 150, 300) : Math.max(here * 2, res.length * 300, 600);
  for (let i = 0; i < 80; i++) {
    const k = reach[ih(this.step, i, 233) % reach.length];
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 0) continue;
    let walls = 0;
    for (const nn of [k + 1, k - 1, k - m.w]) walls += m.solid[nn];
    if (!walls) continue;
    const x = (k % m.w) * TILE + 8;
    const y = Math.floor(k / m.w) * TILE + 11;
    if (this.burrows.some((o) => o !== b && Math.abs(o.x - x) < 6 * TILE && Math.abs(o.y - y) < 6 * TILE)) continue;
    // 火のそば（怖くて近寄れない所）には巣穴を作らない
    if (this.fireNear(x, y)) continue;
    const v = this.burrowFood(x, y) - dist[k] * 4;
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  if (best < 0) return false;
  const nx = (best % m.w) * TILE + 8;
  const ny = Math.floor(best / m.w) * TILE + 11;
  // 巣穴のそば（15マス）にいる仲間は、一列になって新しい巣穴まで歩いていく（先頭は古い巣穴にいちばん近い者。st 11、ref2 は前を行く仲間）
  const line = res.filter((c) => sq(c.x - b.x) + sq(c.y - b.y) < 15 * TILE * 15 * TILE && c.sleep !== 2).sort((a, z) => sq(a.x - b.x) + sq(a.y - b.y) - (sq(z.x - b.x) + sq(z.y - b.y)) || a.id - z.id);
  for (const c of res) {
    c.hx = nx;
    c.hy = ny;
    if (c.st === 8) c.st = 0;
  }
  line.forEach((c, i) => {
    c.st = 11;
    c.ref = 0;
    c.ref2 = i === 0 ? 0 : line[i - 1].id;
    c.tx = this.step;
    c.sleep = 0;
  });
  if (line.length) this.record('settle', { t: this.w.tick, k: Kind.Rat, id: line[0].id, ev: 'march', n: line.length, x: Math.round(b.x), y: Math.round(b.y), tx: nx, ty: ny } as never);
  // 描画専用：列の先頭が新しい巣穴に着くまで、古い場所に穴を描く
  if (line.length) {
    this.fxMarch = this.fxMarch.filter((e) => this.w.tick - e.t < DAY_TICKS_ECO / 4);
    this.fxMarch.push({ t: this.w.tick, x: b.x, y: b.y, tx: nx, ty: ny });
  }
  this.record('moves', { t: this.w.tick, k: Kind.Rat, n: res.length, x: Math.round(b.x), y: Math.round(b.y), tx: nx, ty: ny } as never);
  b.x = nx;
  b.y = ny;
  b.hk = -1;
  b.len = 0;
  b.cap = this.burrowCap(b);
  if (this.step - (this.lastLogged[993] ?? -99999) > 1500) {
    this.lastLogged[993] = this.step;
    this.log(nx, ny, `{k:${Kind.Rat}}の群れ（${res.length}匹）が、苔の尽きた巣穴を捨てて、苔の豊かな所へ巣穴を移した`);
  }
  return true;
}

/**
 * 巣穴のまわり（10マス）の食べられる苔で養える数：いまある量を、一匹がゲーム内の1日に食べる量（約600）で割る。
 * 苔はそのあいだにも育つので、いまある量だけで2日分（全体の目安と同じ割り方）とすると少なすぎた（巣穴ごとに2〜5匹、ダンジョン全体で数匹になった）
 */
export function burrowCap(this: Ecology, b: Burrow): number {
  return Math.floor(this.burrowFood(b.x, b.y) / 600);
}

export function burrowCapOf(this: Ecology, c: Cr): number {
  const b = this.burrows.find((o) => o.x === c.hx && o.y === c.hy);
  return b ? b.cap ?? this.burrowCap(b) : 0;
}

export function burrowResidents(this: Ecology, c: Cr): number {
  let n = 0;
  for (const o of this.list) if (o.k === Kind.Rat && !o.dead && o.hx === c.hx && o.hy === c.hy) n++;
  return n;
}

export function hungryRats(this: Ecology): number {
  let h = 0;
  for (const c of this.list) if (c.k === Kind.Rat && !c.dead && c.hungry > 0) h++;
  return h;
}

/**
 * 行き詰まる前に動く：腹を空かせ、近くに苔がなければ、まず巣穴ごと苔の豊かな所へ引っ越す。移れる所がなく、
 * 開いた地表の横穴まで飢え死にする前に歩いて着ければ（道のり150マスまで）、巣穴の仲間のうち腹を空かせた者と連れ立って（数匹の群れで）外へ出ていく。
 * どちらもできなければ、今までどおり中で飢える
 */
/** 歩いて max マス以内でいちばん近い、食べられる苔かキノコ（20以上）のマス（避けたい目当て gait は除く）。なければ -1 */
export function nearestEdible(this: Ecology, c: Cr, max: number): number {
  return this.nearestEdibleD(c, max)[0];
}

/** nearestEdible と同じマスと、そこまでの歩いた道のり（マス）。なければ [-1, -1] */
export function nearestEdibleD(this: Ecology, c: Cr, max: number): [number, number] {
  const d = this.walkDist(this.tileOf(c.x, c.y), max);
  const W = this.w.map.w;
  // 避けたい目当て（おびえて逃げた目当て、道筋の見つからなかった目当て）は、まわり1マスも避ける
  // （以前はそのマスだけを避けたので、ゴーストの居座る苔の群落で、隣のマスを目当てにしては近づいておびえる、を繰り返して飢えていた）
  const ax = c.gait > 0 ? (c.gait - 1) % W : -9;
  const ay = c.gait > 0 ? Math.floor((c.gait - 1) / W) : -9;
  let best = -1;
  for (let q = 0; q < d.length; q++) {
    if (d[q] < 0 || Math.max(this.w.moss[q], this.w.fungus[q]) < 20) continue;
    if (Math.abs((q % W) - ax) <= 1 && Math.abs(Math.floor(q / W) - ay) <= 1) continue;
    // 立てないマス（大ネズミにとっての深い水）の苔は選ばない
    if (!this.tilePassable(c, q)) continue;
    if (best < 0 || d[q] < d[best]) best = q;
  }
  return [best, best >= 0 ? d[best] : -1];
}

export function ratDisperse(this: Ecology, c: Cr): boolean {
  const m = this.w.map;
  // 出ていく途中で飢えが7割を越えたらあきらめる（st 8）ので、すでに越えている者は出ていこうとしない
  // （以前は出ていこうとしては次の更新であきらめ、そのたびに目当ての苔を忘れて選び直し、苔のそばで行ったり来たりして飢えていた）
  if (c.hungry > SPEC[Kind.Rat].starve * 0.7) return false;
  // 歩いて10マス以内に食べられる苔かキノコがあれば出ていかない（いくつかの点を選んで調べるやり方では、まばらな苔を見落としていた）
  {
    const d = this.walkDist(this.tileOf(c.x, c.y), 10);
    for (let q = 0; q < d.length; q++) if (d[q] >= 0 && Math.max(this.w.moss[q], this.w.fungus[q]) >= 20) return false;
  }
  if (this.findMoss(c, c.hx, c.hy, 10, 231) >= 0) return false;
  // まず中での引っ越しを試す（巣穴のまわりの苔が尽きていれば、苔の豊かな所へ群れごと移る）
  const b = this.burrows.find((o) => o.x === c.hx && o.y === c.hy);
  if (b && this.relocateBurrow(b)) {
    c.st = 0;
    return true;
  }
  // 移れる所がなければ外へ：飢え死にする前に歩いて着ける（残りの辛抱の8割で歩ける道のりまで）開いた地表の横穴のうち、いちばん近いもの
  const reachTiles = Math.min(150, Math.floor(((SPEC[Kind.Rat].starve - c.hungry) * 0.8 * SPEC[Kind.Rat].speed) / TILE));
  if (reachTiles < 4) return false;
  const dist = this.walkDist(this.tileOf(c.x, c.y), reachTiles);
  let ex = -1;
  let ey = -1;
  let bd = 1e9;
  for (let i = 0; i < m.mouths.length; i++) {
    if (m.mouths[i].kind !== 0 || !this.mouthOpen(i)) continue;
    const [mx, my] = this.mouthSpot(i);
    const d = dist[this.tileOf(mx, my)];
    if (d >= 0 && d < bd) {
      bd = d;
      ex = mx;
      ey = my;
    }
  }
  // 着ける口がなければ出ていかない（以前は口がなくても出ていく群れにして、目当てを忘れさせていた）
  if (ex < 0) return false;
  const group: Cr[] = [c];
  this.nearby(c.x, c.y, 12, (o) => {
    if (group.length >= 5 || o === c || o.dead || o.away || o.k !== Kind.Rat || o.st === 8 || o.hx !== c.hx || o.hy !== c.hy) return;
    if (o.hungry > 0 || o.food < 8) group.push(o);
  });
  for (const o of group) {
    o.st = 8;
    o.tx = ex;
    o.ty = ey;
    o.ref = 0;
  }
  if (this.step - (this.lastLogged[994] ?? -99999) > 1500) {
    this.lastLogged[994] = this.step;
    this.log(c.x, c.y, group.length > 1 ? `腹を空かせた{k:${Kind.Rat}}の群れ（${group.length}匹）が、地表の横穴から外へ出ていった` : `腹を空かせた{k:${Kind.Rat}}が、地表の横穴から外へ出ていった`);
  }
  return true;
}

declare module '../ecology' {
  interface Ecology {
    rat: typeof rat;
    ratCap: typeof ratCap;
    ratFoodCap: typeof ratFoodCap;
    burrowFood: typeof burrowFood;
    relocateBurrow: typeof relocateBurrow;
    ratMarch: typeof ratMarch;
    burrowCap: typeof burrowCap;
    burrowCapOf: typeof burrowCapOf;
    burrowResidents: typeof burrowResidents;
    hungryRats: typeof hungryRats;
    nearestEdible: typeof nearestEdible;
    nearestEdibleD: typeof nearestEdibleD;
    ratDisperse: typeof ratDisperse;
  }
}

Object.assign(Ecology.prototype, { rat, ratCap, ratFoodCap, burrowFood, relocateBurrow, ratMarch, burrowCap, burrowCapOf, burrowResidents, hungryRats, nearestEdible, nearestEdibleD, ratDisperse });
