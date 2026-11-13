/** Ecology のメソッド：人の気配（危険の勾配）、気づき方、火を怖がる、光に寄る、弱い生き物の害、食べる時間、物音（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { CELL, Cr, Ecology, Job, Kind, Party, SPEC, STR, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';

export function updatePresenceBase(this: Ecology): void {
  const m = this.w.map;
  const N = m.w * m.h;
  const dist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  let h = 0;
  let t = 0;
  for (let x = m.entrance.x; x <= m.entrance.x + 1; x++) {
    const k = 1 * m.w + x;
    if (!m.solid[k]) {
      dist[k] = 0;
      q[t++] = k;
    }
  }
  while (h < t) {
    const k = q[h++];
    for (const n of [k + 1, k - 1, k + m.w, k - m.w]) {
      if (n < 0 || n >= N || dist[n] >= 0 || m.solid[n] || m.sealed[n]) continue;
      dist[n] = dist[k] + 1;
      q[t++] = n;
    }
  }
  const cw = Math.ceil(m.w / CELL);
  const best = new Int32Array(this.presenceBase.length).fill(1 << 30);
  for (let k = 0; k < N; k++) {
    if (dist[k] < 0) continue;
    const c = Math.floor(Math.floor(k / m.w) / CELL) * cw + Math.floor((k % m.w) / CELL);
    if (dist[k] < best[c]) best[c] = dist[k];
  }
  for (let c = 0; c < best.length; c++) this.presenceBase[c] = best[c] === 1 << 30 ? 0 : Math.exp(-best[c] / 45);
}

export function updatePresenceTrace(this: Ecology): void {
  if (this.step % 10 === 3) {
    for (const c of this.list) {
      if (c.dead || c.away || (c.k !== Kind.Adventurer && c.k !== Kind.Dwarf)) continue;
      const cell = this.cellOf(c.x, c.y);
      if (cell >= 0 && cell < this.presenceTrace.length) this.presenceTrace[cell] = Math.min(1, this.presenceTrace[cell] + 0.02);
    }
  }
  if (this.step % 50 === 17) for (let i = 0; i < this.presenceTrace.length; i++) this.presenceTrace[i] *= 0.996;
}

/** その場所の人の気配の濃さ（0〜1） */
export function presenceAt(this: Ecology, x: number, y: number): number {
  const cell = this.cellOf(x, y);
  if (cell < 0 || cell >= this.presenceBase.length) return 0;
  let p = this.presenceBase[cell] + this.presenceTrace[cell];
  for (const pt of this.parties) if ((pt.camp ?? -1) >= 0 && this.cellOf(((pt.camp as number) % this.w.map.w) * TILE, Math.floor((pt.camp as number) / this.w.map.w) * TILE) === cell) p += 0.4;
  return Math.min(1, p);
}

/** 強いモンスターは、気配の濃い所から少しずつ離れる（追っているとき、戦っているとき、逃げているときは気にしない） */
export function shyOfPeople(this: Ecology, c: Cr): boolean {
  // ヴァンパイアは、起きている冒険者から自分で退く（src/eco/vampire.ts）。ここでも避けると、住処への帰り道と引っ張り合って入口のそばで足踏みしていた
  if (STR[c.k] < 7 || [Kind.Adventurer, Kind.Dwarf, Kind.Golem, Kind.Dragon, Kind.Worm, Kind.Mimic, Kind.Gargoyle, Kind.Lich, Kind.Vampire].includes(c.k)) return false;
  const st = this.str(c);
  if (st < 10 || c.act === 2 || c.flee > 0 || c.sleep > 0 || this.w.tick - c.hitAt < 300) return false;
  // 飢え死にしそうな者は気配を避けない（出ていく道や食べ物が気配の濃い所にあると、退いては戻るのを繰り返していた）
  if (c.sinceMeal > SPEC[c.k].starve * 0.85) return false;
  // 退き終えてしばらくは気配を気にしない（retreatStep。一度退いてから、意を決して通り抜ける）
  if (this.retreats.has(c.id)) return false;
  // 夜襲に出る大物は、細った焚き火のまわり（12マス）の気配を避けない（src/eco/night.ts）
  if (this.nightRaider(c) && this.weakCampAt(c.x, c.y, 12)) return false;
  const p = this.presenceAt(c.x, c.y);
  const excess = p - Math.max(0.2, 0.9 - st * 0.02);
  if (excess <= 0 || ih(c.id, this.step, 207) % 100 >= excess * 120) return false;
  // 気配の薄いほうへ一歩
  let bx = 0;
  let by = 0;
  let bp = p;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const pp = this.presenceAt(c.x + dx * CELL * TILE, c.y + dy * CELL * TILE);
    if (pp < bp) {
      bp = pp;
      bx = dx;
      by = dy;
    }
  }
  if (!bx && !by) return false;
  // 気配の薄いほうへ3マス先の床を退く先に決め、着くまでそこへ歩く（retreatStep）。
  // 以前は気配の薄いほうへ一歩ずつ動いていたので、次の更新で元の行き先へ戻ろうとして、その間を一歩ずつ行き来し、
  // その場で足踏みして見えていた（ミノタウロス・オーク・トロール・ワイバーン）
  // （隣の区画（8マス先）まで退かせると、オークが従えた集落から離れて、従える集落が減り、冒険者に倒されるゴブリンが増えた）
  if (this.retreatTo(c, c.x + bx * 3 * TILE, c.y + by * 3 * TILE, 40, 300)) return this.retreatStep(c);
  c.act = 1;
  this.tryMove(c, bx * SPEC[c.k].speed, by * SPEC[c.k].speed);
  return true;
}

/**
 * 退く先を決める：(x, y) のそばの床で、いまいる所から歩いて行ける（つながった洞窟の同じ領域の）マス。
 * 生き物の更新 dur 回のうちに着けなければやめる。退き終えたあと、生き物の更新 rest 回の間は、記録を「休み」として残す
 * （その間は同じ理由で退かない。退いては元の行き先へ戻り、また退く、を繰り返さないように）。決められたら true
 */
export function retreatTo(this: Ecology, c: Cr, x: number, y: number, dur: number, rest: number): boolean {
  const k = this.nearestFloor(x, y);
  const here = this.tileOf(c.x, c.y);
  if (k < 0 || here < 0 || k === here || this.regionOf(k) !== this.regionOf(here)) return false;
  const m = this.w.map;
  this.retreats.set(c.id, [(k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, this.step + dur, rest]);
  return true;
}

/**
 * 退く先があれば、着くまでそこへ歩く。着いた、道が無い、時間切れ、打たれた、逃げ出したら、退くのをやめて休みに入る
 * （記録の x を NaN にし、休みの終わりの更新の通し番号を持つ）。休みが終われば記録を消す。この回に退いたら true
 */
export function retreatStep(this: Ecology, c: Cr): boolean {
  const r = this.retreats.get(c.id);
  if (!r) return false;
  if (Number.isNaN(r[0])) {
    if (this.step > r[2]) this.retreats.delete(c.id);
    return false;
  }
  const rest = () => this.retreats.set(c.id, [NaN, NaN, this.step + r[3], 0]);
  // 道が無いかは、退く先への道筋の記録で見る（ほかの目的地へ向かっていたときの記録は見ない）
  const p = this.paths.get(c.id);
  const noWay = !!p && p.gk === this.tileOf(r[0], r[1]) && p.miss > 0;
  if (this.step > r[2] || c.flee > 0 || c.sleep > 0 || this.w.tick - c.hitAt < 300 || noWay) {
    rest();
    return false;
  }
  c.act = 1;
  if (this.goTo(c, r[0], r[1], SPEC[c.k].speed)) rest();
  return true;
}

/** 半径 R マスの円に入るマスの、中心からのずれ（dx, dy を交互に）。R ごとに一度だけ作る */
const DISKS: Int8Array[] = [];
function diskOf(R: number): Int8Array {
  let d = DISKS[R];
  if (d) return d;
  const a: number[] = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R) a.push(dx, dy);
  d = DISKS[R] = Int8Array.from(a);
  return d;
}

/**
 * 明るさのマップ（litMap）を作り直す：光源（eachLight）ごとに、光の届く円（半径は光の強さの7割）に入るマスに印を付ける。
 * 生き物の更新の初めに毎回作る。速さのため、次の二つで手間を省く（印の付く場所は省かないときと同じ）：
 * - 円に入るマスのずれは、半径ごとに前もって計算しておく（diskOf）。
 * - 同じマスを中心に、同じかより大きい円を、この回に既に描いていれば描かない（ウィスプやスライムが群れていると多い）。
 *   中心ごとに、この回に描いた最大の半径を覚える（litCenter。値は「作り直しの回の番号×16＋半径＋1」で、回が変われば古い値は無視される）
 */
export function buildLitMap(this: Ecology): void {
  const m = this.w.map;
  const W = m.w;
  const H = m.h;
  if (this.litMap.length !== W * H) {
    this.litMap = new Uint8Array(W * H);
    this.litCenter = new Int32Array(W * H);
    this.litBuild = 0;
  } else for (const k of this.litMarked) this.litMap[k] = 0;
  const lit = this.litMap;
  const center = this.litCenter;
  const marked = this.litMarked;
  marked.length = 0;
  // 回の番号は16倍して半径と同じ値に詰めるので、大きくなりすぎたら番号を振り直す
  if (++this.litBuild > 0x7ffff) {
    center.fill(0);
    this.litBuild = 1;
  }
  const stamp = this.litBuild * 16;
  this.eachLight((lx, ly, lr) => {
    const R = Math.floor((lr * 0.7) / TILE);
    const cx = Math.floor(lx / TILE);
    const cy = Math.floor(ly / TILE);
    const inside = cx >= 0 && cy >= 0 && cx < W && cy < H;
    if (inside && R < 15) {
      const c0 = cy * W + cx;
      const prev = center[c0];
      if (prev > stamp && prev - stamp - 1 >= R) return;
      center[c0] = stamp + R + 1;
    }
    const d = diskOf(R);
    if (cx - R >= 0 && cy - R >= 0 && cx + R < W && cy + R < H) {
      const base = cy * W + cx;
      for (let i = 0; i < d.length; i += 2) {
        const k = base + d[i + 1] * W + d[i];
        if (!lit[k]) {
          lit[k] = 1;
          marked.push(k);
        }
      }
      return;
    }
    for (let i = 0; i < d.length; i += 2) {
      const x = cx + d[i];
      const y = cy + d[i + 1];
      if (x >= 0 && y >= 0 && x < W && y < H && !lit[y * W + x]) {
        lit[y * W + x] = 1;
        marked.push(y * W + x);
      }
    }
  });
  this.litMapTick = this.w.tick;
}

/** その者が明るい所にいるか（目で見る者から見える明るさ） */
export function isLit(this: Ecology, o: Cr): boolean {
  // 明るさのマップ（litMap）は、生き物の更新の初めに毎回作り直してある（ロードし直しても同じになるように）
  if (this.litMapTick !== this.w.tick) this.buildLitMap();
  const k = this.tileOf(o.x, o.y);
  return k >= 0 && (this.litMap[k] === 1 || this.lit(k, this.day) > 0.35);
}

/** c が o に気づけるか（種ごとの気づき方） */
export function canSense(this: Ecology, c: Cr, o: Cr): boolean {
  if ((o.st === 7 || o.st === 12) && this.isHidden(o) && !this.atDoorOf(c, o)) return false;
  const d2 = sq(o.x - c.x) + sq(o.y - c.y);
  // 逃げて巣や住みかの中へ身を隠した者には、すぐそば（1.2マス）まで来ないと気づかない（src/eco/combat.ts の denHidden）
  if (o.flee > 0 && o.act === 0 && d2 > 1.2 * TILE * 1.2 * TILE && this.denHidden(o)) return false;
  const T2 = TILE * TILE;
  const sense = Ecology.SENSE[c.k] ?? 'night';
  const los = () => lineOfSight(this.w.map, c.x, c.y, o.x, o.y);
  switch (sense) {
    case 'eye':
      if (d2 < 1.5 * 1.5 * T2) return true;
      return d2 < 64 * T2 && this.isLit(o) && los();
    case 'smell':
      // 焚き火で眠る一行の食べ物の匂いは、遠く（10マス）まで届く
      return d2 < (this.campSleeper(o) ? 100 : 36) * T2;
    case 'vib':
      return d2 < 49 * T2 && o.act === 1 && o.sleep === 0;
    case 'echo':
      return d2 < 36 * T2 && los();
    case 'magic':
      return d2 < 64 * T2 && ![Kind.Zombie, Kind.Skeleton, Kind.Ghost, Kind.Lich, Kind.Golem, Kind.Gargoyle, Kind.Wisp, Kind.Armor].includes(o.k);
    default:
      if (d2 < 25 * T2) return los();
      return d2 < 64 * T2 && this.isLit(o) && los();
  }
}

/** 火のある所（焚き火、集落のかがり火、入口のかがり火、鍛冶場、松明、燃えているマス）と、その怖さの届く半径（px） */
export function fires(this: Ecology): [number, number, number][] {
  if (this.fireStep === this.step) return this.fireList;
  const m = this.w.map;
  const out: [number, number, number][] = [];
  // 冒険者の焚き火は、休みの最後の3分の1で細る（怖さの届く範囲が4マスから約1.5マスへ。src/eco/night.ts の campFire）
  for (const p of this.parties) if ((p.camp ?? -1) >= 0) out.push([((p.camp as number) % m.w) * TILE + 8, Math.floor((p.camp as number) / m.w) * TILE + 8, 4 * TILE * this.campFire(p)]);
  for (const cp of this.camps) if (cp.id >= 0 && (cp.fuel ?? 0) > 0) out.push([cp.x, cp.y + 10, 4 * TILE]);
  const gx = m.entrance.x * TILE + 16;
  out.push([gx - 29, 40, 4 * TILE], [gx + 28, 40, 4 * TILE]);
  if (this.hold && this.hold.forge >= 0) out.push([(this.hold.forge % m.w) * TILE + 8, Math.floor(this.hold.forge / m.w) * TILE + 8, 4 * TILE]);
  for (const c of this.list) if (!c.dead && c.torch > 0 && (c.k === Kind.Adventurer || c.k === Kind.Goblin)) out.push([c.x, c.y, 2.5 * TILE]);
  for (const k of this.burning) out.push([(k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 2 * TILE]);
  this.fireList = out;
  this.fireStep = this.step;
  return out;
}

export function fireNearTile(this: Ecology, k: number): boolean {
  const m = this.w.map;
  if (this.fnStamp.length !== m.w * m.h) {
    this.fnStamp = new Int32Array(m.w * m.h).fill(-1);
    this.fnVal = new Uint8Array(m.w * m.h);
  }
  // 火の一覧（fires()）は生き物の更新ごとに作り直すので、step 番号でキャッシュが有効かを見分ける（先に fires を呼んで、その回の一覧を確定させる）
  const fl = this.fires();
  if (this.fnStamp[k] !== this.step) {
    const x = (k % m.w) * TILE + 8;
    const y = Math.floor(k / m.w) * TILE + 8;
    let hit = 0;
    for (const f of fl) if (sq(f[0] - x) + sq(f[1] - y) < f[2] * f[2]) { hit = 1; break; }
    this.fnVal[k] = hit;
    this.fnStamp[k] = this.step;
  }
  return this.fnVal[k] === 1;
}

export function fireNear(this: Ecology, x: number, y: number): [number, number, number] | null {
  for (const f of this.fires()) if (sq(f[0] - x) + sq(f[1] - y) < f[2] * f[2]) return f;
  return null;
}

/** 火を怖がる獣は、火のそばから離れる（飢え死にしそうなとき、襲われて打ち返すときは別） */
export function fearFire(this: Ecology, c: Cr): boolean {
  if (!Ecology.FEARS_FIRE.has(c.k) || c.sleep > 0 || this.w.tick - c.hitAt < 120) return false;
  // 夜襲に出る大物は、細った焚き火からは逃げない（src/eco/night.ts）
  if (this.nightRaider(c) && !this.fireDaunts(c, c.x, c.y)) return false;
  // 腹をすかせた大ネズミとコウモリは、眠っている者の食料や血の匂いに惹かれて、火のそばにも忍び寄る
  if ((c.k === Kind.Rat || c.k === Kind.Bat) && c.hungry) return false;
  if (c.sinceMeal > SPEC[c.k].starve * 0.85) return false;
  if (c.k === Kind.Bat && c.st !== 0 && c.st !== 1) return false;
  // ヴァンパイアに従うコウモリは、主の意のままに動き、火を怖がらない（主の狙う冒険者は松明を持っている）。
  // 以前は主のそばに火があると、主へ向かう一歩と火から離れる一歩を交互に繰り返し、その場で1〜2分行ったり来たりしていた（seed7）
  if (c.k === Kind.Bat && c.ref2) {
    const lord = this.byId.get(c.ref2);
    if (lord && !lord.dead && lord.k === Kind.Vampire) return false;
  }
  const f = this.fireNear(c.x, c.y);
  if (!f) return false;
  const dx = c.x - f[0];
  const dy = c.y - f[1];
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  c.act = 1;
  this.tryMove(c, (dx / L) * SPEC[c.k].speed * 1.2, (dy / L) * SPEC[c.k].speed * 1.2);
  // 大ネズミ：火のそばにある目当ての苔はあきらめ（避ける印をつけて選び直す）、巣穴そのものが火のそばなら群れで移る
  // （以前は、目当てや巣穴へ向かっては火に追い返され、その間を行ったり来たりして先へ進めなかった）
  if (c.k === Kind.Rat) {
    const r2 = f[2] * f[2];
    const t = c.ref - 1;
    if (t >= 0 && sq((t % this.w.map.w) * TILE + 8 - f[0]) + sq(Math.floor(t / this.w.map.w) * TILE + 8 - f[1]) < r2) {
      c.gait = c.ref;
      c.ref = 0;
    }
    if ((c.hx || c.hy) && sq(c.hx - f[0]) + sq(c.hy - f[1]) < r2) {
      const b = this.burrows.find((o) => o.x === c.hx && o.y === c.hy);
      if (b) this.relocateBurrow(b, true);
    }
  }
  return true;
}

/**
 * 光に寄る：狡猾な種（ゴブリン、オーク、コボルト）は、冒険者の松明や焚き火を、見通しが利けば20マス先から見つける。
 * 腹が減っているか、ときどき（宝を狙って）、光の届かない暗がりの縁まで近づいて潜み、
 * 冒険者がはぐれたり眠ったりした隙に襲う。潜むのはゲーム内の時間でおよそ4時間まで
 */
export function lurk(this: Ecology, c: Cr): boolean {
  if (c.k !== Kind.Goblin && c.k !== Kind.Orc && c.k !== Kind.Kobold) return false;
  // 夜の盗みに出たゴブリン（src/eco/raid.ts）
  if (c.k === Kind.Goblin && (c.st === 15 || c.st === 16)) return this.goblinRaid(c);
  // 通路を行く一行の最後尾をつけて、荷を掠め取る（src/eco/raid.ts）
  if (c.k === Kind.Goblin && c.st === 17) return this.goblinSnatch(c);
  // 冒険者の物資の置き場へ食料を取りに出た（src/eco/cache.ts）
  if (c.k === Kind.Goblin && c.st === 18) return this.goblinCacheRaid(c);
  // 住処を持つコボルトの群れは、冒険者の灯りに自分から寄っていかない
  if (c.k === Kind.Kobold && (this.warrenOf(c) || c.st === 10)) {
    c.lure = 0;
    return false;
  }
  if (c.flee > 0 || c.sleep > 0 || this.w.tick - c.hitAt < 60) {
    c.lure = 0;
    return false;
  }
  // 集落のゴブリン：散って隠れているあいだと、群れで去る道中は潜まない
  const gcp = c.k === Kind.Goblin ? this.campOf(c) : undefined;
  const camp = gcp && gcp.kind === 0 ? gcp : undefined;
  if (camp && (camp.hide === 1 || c.st === 7)) {
    c.lure = 0;
    return false;
  }
  if (c.st === 10) return false;
  // 頭（ゴブリンの頭）のいる集落は大胆になる
  const bold = !!camp && this.campChief(camp);
  const m = this.w.map;
  // 狙いを探す
  if (!c.lure) {
    // 腹をすかせたゴブリンは、人の食べ物を求めて人の気配の濃い浅い所へ寄っていく
    if (c.k === Kind.Goblin && c.hungry && ih(c.id, this.step, 211) % 4 === 0) {
      const p0 = this.presenceAt(c.x, c.y);
      let bx = 0;
      let by = 0;
      let bp = p0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const pp = this.presenceAt(c.x + dx * CELL * TILE, c.y + dy * CELL * TILE);
        if (pp > bp) {
          bp = pp;
          bx = dx;
          by = dy;
        }
      }
      if (bx || by) {
        c.act = 1;
        this.tryMove(c, bx * SPEC[c.k].speed, by * SPEC[c.k].speed);
      }
    }
    // 夜、焚き火を囲む一行がいれば、オークとコボルトはその焚き火をよく探し（ふだんの3倍）、腹が満ちていても半分は出ていく（夜襲。src/eco/night.ts）。
    // この多めの探し方で狙うのは焚き火の一行だけ（松明を持って歩く一行には、ふだんどおり）
    const usual = this.step % 30 === c.id % 30 && (c.hungry || bold || ih(c.id, this.step, 210) % 3 === 0);
    const campOnly = !usual && c.k !== Kind.Goblin && this.isNight() && this.step % 10 === c.id % 10 && (c.hungry || ih(c.id, this.step, 219) % 2 === 0) && this.parties.some((q) => (q.camp ?? -1) >= 0);
    if (!usual && !campOnly) return false;
    let best: Cr | null = null;
    let bd = 20 * TILE * 20 * TILE;
    for (const o of this.list) {
      if (o.dead || o.away || o.k !== Kind.Adventurer) continue;
      const p = this.parties.find((q) => q.id === o.party);
      const fire = !!p && (p.camp ?? -1) >= 0;
      const bright = o.torch > 0 || fire;
      if (!bright || (campOnly && !fire)) continue;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d >= bd || !lineOfSight(m, c.x, c.y, o.x, o.y)) continue;
      bd = d;
      best = o;
    }
    if (!best) return false;
    // 焚き火を囲む一行なら、見張り（先頭）ではなく、眠っている者を狙う
    const bp = this.parties.find((q) => q.id === (best as Cr).party);
    if (c.k !== Kind.Goblin && bp && (bp.camp ?? -1) >= 0) {
      const sl = bp.members.slice(1).filter((id) => { const o = this.byId.get(id); return !!o && !o.dead; });
      if (sl.length) best = this.byId.get(sl[ih(c.id, this.step, 218) % sl.length]) as Cr;
    }
    c.lure = (best as Cr).id;
    c.lureAt = this.step;
  }
  const t = this.byId.get(c.lure);
  if (!t || t.dead || t.away || this.step - c.lureAt > 2400) {
    c.lure = 0;
    return false;
  }
  // 隙：まわりに仲間がいない（はぐれた）か、眠っている
  const alone = !this.list.some((o) => o !== t && !o.dead && o.k === Kind.Adventurer && o.party === t.party && sq(o.x - t.x) + sq(o.y - t.y) < 4 * TILE * 4 * TILE);
  // 集落の待ち伏せ：弱い一行が集落のそば（9マス）に踏み込んだら、暗がりから群れで襲いかかる
  const ambush = !!camp && camp.hide === 2 && sq(t.x - camp.x) + sq(t.y - camp.y) < 9 * TILE * 9 * TILE;
  // 焚き火で眠る一行を狙うオークとコボルトは、見張りがうとうとするのを待つ（せっかちな者＝8匹に1匹と、待ちくたびれた者は待たない）
  const tp = this.parties.find((q) => q.id === t.party);
  const atCamp = c.k !== Kind.Goblin && !!tp && (tp.camp ?? -1) >= 0;
  const sleepOk = t.sleep > 0 && (!atCamp || this.watchDozing(tp as Party) || ih(c.id, c.lureAt, 217) % 8 === 0 || this.step - c.lureAt > 1200);
  if (alone || sleepOk || ambush) {
    c.act = 1;
    if (sq(t.x - c.x) + sq(t.y - c.y) < 14 * 14) {
      // はぐれた者には、仲間が2匹以上そばにいるか頭がいれば、盗むのではなく襲いかかる（集落の者だけ）
      let allies = 0;
      if (camp && !ambush) this.nearby(c.x, c.y, 5, (o) => {
        if (o !== c && !o.dead && o.k === Kind.Goblin && o.ref === camp.id && o.flee <= 0) allies++;
      });
      if (c.k === Kind.Goblin && !ambush && !(camp && alone && (allies >= 2 || bold))) {
        // ゴブリンは襲わずに、食料と松明を盗んで逃げる（頭のいる集落は多めに盗る）
        this.goblinSteal(c, t, camp, false);
        c.flee = 120;
        c.foe = t.id;
        c.lure = 0;
      } else this.fight(c, t);
    } else this.goTo(c, t.x, t.y, SPEC[c.k].speed * 1.2);
    return true;
  }
  // 暗がりの縁（灯りから6〜8マス、明るくない所）に潜む
  const d = Math.sqrt(sq(t.x - c.x) + sq(t.y - c.y));
  if (d > 8 * TILE || this.isLit(c)) {
    const a = ((c.id * 2.399) % 6.283);
    const sx = t.x + Math.cos(a) * 7 * TILE;
    const sy = t.y + Math.sin(a) * 7 * TILE;
    c.act = 1;
    this.goTo(c, sx, sy, SPEC[c.k].speed);
  } else {
    c.act = 0;
    c.dir = Math.abs(t.x - c.x) > Math.abs(t.y - c.y) ? (t.x > c.x ? 2 : 3) : t.y > c.y ? 0 : 1;
  }
  return true;
}

/**
 * 弱い生き物が冒険者やドワーフに与える害（通常速度で数秒ごとに）：
 * 大ネズミは眠っている者の荷をあさって食料をかじる、コウモリは眠っている者の血を吸う（小さな傷）、
 * アリは巣に近づいた者に群れで噛みつく、ウィスプは冒険者を誘って一行の行き先を暗がりへ逸らす、
 * サラマンダーは近づいた者に火傷を負わせる。true なら今は害をなしている
 */
export function pester(this: Ecology, c: Cr): boolean {
  if (this.step % 6 !== c.id % 6 || c.sleep > 0 || c.flee > 0) return false;
  const people = (o: Cr) => !o.dead && !o.away && (o.k === Kind.Adventurer || o.k === Kind.Dwarf);
  let t: Cr | null = null;
  let bd = 1e18;
  const R = c.k === Kind.Wisp ? 6 : c.k === Kind.Ant ? 3 : 2;
  this.nearby(c.x, c.y, Math.ceil(R), (o) => {
    if (!people(o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd && d < R * TILE * R * TILE) {
      bd = d;
      t = o;
    }
  });
  if (!t) return false;
  const o = t as Cr;
  const near = bd < 14 * 14;
  switch (c.k) {
    case Kind.Rat:
      if (o.sleep <= 0 || !c.hungry) return false;
      if (!near) { c.act = 1; this.goTo(c, o.x, o.y, SPEC[c.k].speed); return true; }
      { const take = Math.min(3, o.food, SPEC[c.k].cap - c.food); o.food -= take; c.food += take; c.sinceMeal = 0; c.act = 2; c.actT = 0; c.foe = o.id; }
      return true;
    case Kind.Bat:
      if (o.sleep <= 0 || !c.hungry) return false;
      if (!near) { c.act = 1; this.goTo(c, o.x, o.y, SPEC[c.k].speed); return true; }
      if (this.strike(c, o, 0.3) && o.hp <= 0) this.die(o, 'killed', c.k);
      { const take = Math.min(2, SPEC[c.k].cap - c.food); if (take > 0 && o.food >= take) { o.food -= take; c.food += take; } c.sinceMeal = 0; c.foe = o.id; }
      return true;
    case Kind.Ant: {
      const col = this.colonies.find((q) => q.id === c.ref);
      if (!col || sq(col.x - o.x) + sq(col.y - o.y) > 5 * TILE * 5 * TILE) return false;
      if (!near) { c.act = 1; this.goTo(c, o.x, o.y, SPEC[c.k].speed * 1.2); return true; }
      if (this.strike(c, o, 1) && o.hp <= 0) this.die(o, 'fight', c.k);
      c.foe = o.id;
      return true;
    }
    case Kind.Wisp:
      // 冒険者を誘う：冒険者から少し離れ、一行の行き先を自分の方へ向けさせる（魔法使いのいる一行は誘われにくい）
      if (o.k !== Kind.Adventurer) return false;
      {
        const p = this.parties.find((q) => q.id === o.party);
        if (!p || p.goal !== 0 || (p.camp ?? -1) >= 0 || p.engage) return false;
        if (p.members.some((id) => this.byId.get(id)?.sp === Job.Wizard) && ih(c.id, this.step, 215) % 3 !== 0) return false;
        if (ih(c.id, o.id ^ (this.step >> 6), 216) % 8 !== 0) return false;
        p.tx = c.x;
        p.ty = c.y;
        p.targetAt = this.step;
        c.foe = o.id;
        const dx = c.x - o.x;
        const dy = c.y - o.y;
        const L = Math.hypot(dx, dy) || 1;
        c.act = 1;
        this.tryMove(c, (dx / L) * SPEC[c.k].speed * 2, (dy / L) * SPEC[c.k].speed * 2);
      }
      return true;
    case Kind.Salamander:
      if (!near) return false;
      if (this.strike(c, o, 0.6) && o.hp <= 0) this.die(o, 'burned', c.k);
      c.foe = o.id;
      return true;
  }
  return false;
}

/** 倒した獲物の死骸を、数秒かけて食べる（生き物の更新4回に1回、一口。ミノタウロスは寝床まで引きずってから）。ほかの者に襲われたら食べるのをやめる（仕留める間の獲物の打ち返しは数えない）。true なら今は食べている */
export function feeding(this: Ecology, c: Cr): boolean {
  if (!c.feed) return false;
  const d = this.byId.get(c.feed);
  const s = SPEC[c.k];
  const d2 = d ? sq(d.x - c.x) + sq(d.y - c.y) : 0;
  // 斧の薙ぎ払い（4マス）や突進で倒した獲物は、離れた所に倒れる。ミノタウロスは、まだ新しい死骸（骨にも腐りかけにもなっていない）なら、
  // 6マスの内まで歩み寄ってから寝床へ引きずる（以前は18pxより遠いと食べるのをやめ、薙ぎ払いで仕留めた獲物の8割を一口も食べずに離れていた）。
  // 死骸は倒れてから生き物の更新900回で腐りかけになる（corpseStage）ので、行き着けなくても歩き続けはしない
  const walkTo = !!d && d.dead === 1 && d2 > 18 * 18 && c.k === Kind.Minotaur && this.corpseStage(d) === 0 && d2 < 6 * TILE * 6 * TILE;
  if (!d || d.dead !== 1 || d.units <= 0 || c.food >= s.cap || (this.w.tick - c.hitAt < 30 && c.foe !== d.id) || (d2 > 18 * 18 && !walkTo)) {
    c.feed = 0;
    return false;
  }
  if (walkTo) {
    // 突進の溜めや走りの最中なら、走り終えてから歩み寄る（食べる相手の印は残す）
    if (c.run !== 0) return false;
    c.act = 1;
    this.goTo(c, d.x, d.y, s.speed);
    return true;
  }
  // ミノタウロスは、まず寝床まで引きずっていく。食べるのは骨になるところまでで、骨は寝床に残す（src/eco/monsters.ts）
  if (this.dragToLair(c, d)) return true;
  // ミノタウロスは骨になったら食べるのをやめる。ヴァンパイアは、眷属として起き上がらせる亡骸からは、血を短く吸うだけで離れる（src/eco/thrall.ts）
  if ((c.k === Kind.Minotaur && this.corpseStage(d) === 2) || (c.k === Kind.Vampire && d.lure === c.id && this.step - d.lureAt > 15)) {
    c.feed = 0;
    return false;
  }
  c.dir = Math.abs(d.x - c.x) > Math.abs(d.y - c.y) ? (d.x > c.x ? 2 : 3) : d.y > c.y ? 0 : 1;
  if (this.step % 4 === c.id % 4) {
    const t = Math.min(5, d.units, s.cap - c.food);
    d.units -= t;
    c.food += t;
    c.glow = Math.max(c.glow, d.glow);
    c.sinceMeal = 0;
    if (c.hp > 0) c.hp = Math.min(this.maxHp(c), c.hp + this.maxHp(c) / 30);
    c.act = 2;
    c.actT = 0;
    if (d.units <= 0) {
      d.dead = 2;
      c.feed = 0;
    }
  }
  return true;
}

/**
 * 物音を立てる。s は音の種類：0 大きな音（戦い、崩落、掘る音。獣を呼び、眠りを覚ます）、1 足音、2 うなり声。
 * 足音とうなり声は、冒険者の聞き耳（listenStep）だけが聞く（獣を呼んだり眠りを覚ましたりはしない）
 */
export function noise(this: Ecology, x: number, y: number, r: number, s = 0): void {
  const last = this.noises[this.noises.length - 1];
  // 同じ所の続く音はまとめる
  if (last && (last.s ?? 0) === s && this.step - last.t < 10 && sq(last.x - x) + sq(last.y - y) < 32 * 32) {
    last.t = this.step;
    last.r = Math.max(last.r, r);
    return;
  }
  this.noises.push(s ? { x: Math.round(x), y: Math.round(y), r, t: this.step, s } : { x: Math.round(x), y: Math.round(y), r, t: this.step });
  if (this.noises.length > 64) this.noises.shift();
}

/** 足音を立てる重い者と、うなる者（生き物の更新8回ごとに、生き物を順に） */
const HEAVY = new Set<number>([Kind.Troll, Kind.Minotaur, Kind.Orc, Kind.Basilisk, Kind.Golem, Kind.Worm, Kind.Skeleton, Kind.Zombie, Kind.Lizardman, Kind.Armor]);
const GROWL = new Set<number>([Kind.Troll, Kind.Minotaur, Kind.Orc, Kind.Basilisk, Kind.Wyvern, Kind.Dragon, Kind.Lizard, Kind.Zombie, Kind.Vampire]);
export function creatureSounds(this: Ecology): void {
  if (!this.parties.length) return;
  for (const c of this.list) {
    if (c.dead || c.away || c.sleep > 0 || c.k === Kind.Adventurer) continue;
    const heavy = HEAVY.has(c.k) || (c.k === Kind.Dragon && c.sp >= 1);
    if (heavy && c.act === 1 && ih(c.id, this.step >> 3, 300) % 3 === 0) this.noise(c.x, c.y, c.k === Kind.Skeleton || c.k === Kind.Zombie || c.k === Kind.Lizardman || c.k === Kind.Armor ? 7 : 9, 1);
    else if (GROWL.has(c.k) && (c.hungry > 0 || this.w.tick - c.hitAt < 150) && ih(c.id, this.step >> 3, 301) % 8 === 0) this.noise(c.x, c.y, c.k === Kind.Dragon || c.k === Kind.Troll || c.k === Kind.Minotaur ? 12 : 9, 2);
  }
}

/**
 * 物音への反応。捕食者（動物と一部の狡猾な種）は、腹が満ちていなければ音の方へ寄る。
 * 小さな獲物（大ネズミ、アリ）は巣へ逃げ帰る。true なら今は音に従っている
 */
export function hear(this: Ecology, c: Cr): boolean {
  if (!this.noises.length || c.act === 2) return false;
  const attract = c.k === Kind.Lizard || c.k === Kind.Spider || c.k === Kind.Basilisk || c.k === Kind.Wyvern || c.k === Kind.Orc || c.k === Kind.Troll || c.k === Kind.Minotaur;
  const flee = c.k === Kind.Rat || c.k === Kind.Ant;
  if (!attract && !flee) return false;
  let best: { x: number; y: number; r: number; t: number } | null = null;
  let bd = 1e18;
  for (const n of this.noises) {
    if (this.step - n.t > 40 || n.s) continue;
    const d = sq(n.x - c.x) + sq(n.y - c.y);
    if (d > sq(n.r * TILE) || d >= bd) continue;
    bd = d;
    best = n;
  }
  if (!best) return false;
  const n = best as { x: number; y: number; r: number; t: number };
  if (flee) {
    if (c.flee <= 0 && (c.hx || c.hy) && ih(c.id, n.t, 194) % 2 === 0) {
      c.flee = 50;
      c.foe = 0;
    }
    return false;
  }
  // 腹が満ちているか、もう近くにいれば寄らない
  if (c.food >= SPEC[c.k].cap * 0.8 || bd < 3 * TILE * 3 * TILE || ih(c.id, n.t, 195) % 3 === 0) return false;
  c.act = 1;
  this.goTo(c, n.x, n.y, SPEC[c.k].speed);
  return true;
}

declare module '../ecology' {
  interface Ecology {
    updatePresenceBase: typeof updatePresenceBase;
    updatePresenceTrace: typeof updatePresenceTrace;
    presenceAt: typeof presenceAt;
    shyOfPeople: typeof shyOfPeople;
    retreatTo: typeof retreatTo;
    retreatStep: typeof retreatStep;
    buildLitMap: typeof buildLitMap;
    isLit: typeof isLit;
    canSense: typeof canSense;
    fires: typeof fires;
    fireNearTile: typeof fireNearTile;
    fireNear: typeof fireNear;
    fearFire: typeof fearFire;
    lurk: typeof lurk;
    pester: typeof pester;
    feeding: typeof feeding;
    noise: typeof noise;
    creatureSounds: typeof creatureSounds;
    hear: typeof hear;
  }
}

Object.assign(Ecology.prototype, { updatePresenceBase, updatePresenceTrace, presenceAt, shyOfPeople, retreatTo, retreatStep, buildLitMap, isLit, canSense, fires, fireNearTile, fireNear, fearFire, lurk, pester, feeding, noise, creatureSounds, hear });
