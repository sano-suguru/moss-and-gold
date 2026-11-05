/** Ecology のメソッド：外から来るもの（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** 口が開いているか（閉じた空洞の外にあるか） */
export function mouthOpen(this: Ecology, i: number): boolean {
  const m = this.w.map;
  const mo = m.mouths[i];
  if (!mo) return false;
  const [x, y] = this.mouthTile(i);
  const k = y * m.w + x;
  return !m.sealed[k] && !m.solid[k];
}

/** 口の内側のマス（上の端の横穴はその一つ下、左右の端の横穴は一つ内側） */
export function mouthTile(this: Ecology, i: number): [number, number] {
  const m = this.w.map;
  const mo = m.mouths[i];
  if (mo.kind !== 0) return [mo.x, mo.y];
  if (mo.y === 0) return [mo.x, 1];
  return [mo.x === 0 ? 1 : mo.x - 1, mo.y];
}

/** 口の中の、生き物が現れる場所 */
export function mouthSpot(this: Ecology, i: number): [number, number] {
  const [x, y] = this.mouthTile(i);
  return [x * TILE + 8, y * TILE + 8];
}

/**
 * 外から来る生き物の入り口：種に合う口のうち、開いているものから選ぶ。
 * 地表の生き物は正面の入口か地表の横穴、深い所の生き物は地底の裂け目、水辺の生き物は川の口（開いていなければ正面の入口）
 */
/**
 * 入り口：正面の入口は人の道（冒険者とドワーフだけ）。野の生き物は自然の口から来る：
 * 地表の生き物は開いた地表の横穴、深い所の生き物は地底の裂け目、リザードマンは川の口。
 * 地表の横穴がまだ開いていなければ、小さな生き物（大ネズミ、トカゲ、クモ、アリ）は天井の裂け目の割れ目から入り込む。
 * 戻り値：mouths の番号、-2 天井の割れ目、-3 入れる所がない
 * reach：コボルトが住処に加わりに来るとき、その住処の領域（regionOf の番号）。渡されたら、そこへ歩いて行ける口（口のマスが同じ領域にある口）だけから選ぶ
 */
export function pickDoor(this: Ecology, k: Kind, salt: number, reach?: number): number {
  const m = this.w.map;
  const want = k === Kind.Basilisk || k === Kind.Minotaur ? 1 : k === Kind.Lizardman ? 2 : 0;
  let open = m.mouths.map((mo, i) => (mo.kind === want && this.mouthOpen(i) ? i : -1)).filter((i) => i >= 0);
  // 狡猾なコボルトは、竜の寝床のそば（20マス以内）の口からは入ってこない
  if (k === Kind.Kobold) {
    // 竜の寝床のそばの口、まわりに住めて食べ物の足りる場所のない口からは来ない
    // （住処がまだないとき。すでにあれば、来る者はその住処に加わるので、口のまわりに新しい場所は要らない）
    const founding = !this.warrens.some((o) => o.id >= 0);
    open = open.filter((i) => !this.dragonNearMouth(i) && (!founding || this.kobMouthOk[i] === 1));
    // 住処に加わりに来る者は、その住処へ歩いて行ける口からだけ来る（歩いて行けない口から入ると、住処を目指してさまよい、飢えてしまう）
    if (reach !== undefined) open = open.filter((i) => this.regionOf(this.tileOf(...this.mouthSpot(i))) === reach);
    // 人の気配の薄い口があれば、そちらを選ぶ
    const quiet = open.filter((i) => this.presenceAt(...this.mouthSpot(i)) < 0.5);
    if (quiet.length) open = quiet;
  }
  // ゴブリンも、集落がまだないときは、歩いて行ける範囲に集落の条件を満たし食べ物の足りる場所のある口からだけ来る
  // オークは、歩いて行ける範囲に従えられるゴブリンの集落か十分な獲物のある口からだけ来る（七巡目）
  if (k === Kind.Orc) {
    open = open.filter((i) => this.orcMouthOk[i] === 1);
    return open.length ? open[ih(this.step, salt, 196) % open.length] : -3;
  }
  if (k === Kind.Goblin) {
    const founding = !this.camps.some((o) => o.id >= 0 && o.kind === 0);
    open = open.filter((i) => !this.dragonNearMouth(i) && (!founding || this.gobMouthOk[i] >= 1));
    // 食べ物の足りる場所のある口があれば、貧しい場所しかない口より先に選ぶ
    const rich = open.filter((i) => !founding || this.gobMouthOk[i] === 1);
    if (rich.length) open = rich;
  }
  // 大ネズミは、まわり（道のり RAT_DOOR_REACH マス）で養える数に余裕のある口か天井の裂け目からだけ来る（裂け目からは、地表の横穴が一つも開いていない間だけ）
  if (k === Kind.Rat) {
    // 天井の割れ目は、地表の横穴が開くまでの序盤の入口（六巡目に戻した。四・五巡目は横穴が開いたあとも割れ目から来て、割れ目のそばで飢えていた）
    // 七巡目：ただし中の大ネズミが絶えかけたら（ratReentry）、割れ目からまた入り直せる
    const opts = [...open.filter((i) => this.ratMouthOk[i] === 1), ...((!open.length || this.ratReentry) && this.ratShaftOk.some((v) => v === 1) && this.crackSpot(Kind.Rat) ? [-2] : [])];
    return opts.length ? opts[ih(this.step, salt, 196) % opts.length] : -3;
  }
  if (open.length) return open[ih(this.step, salt, 196) % open.length];
  if (k === Kind.Kobold || k === Kind.Goblin) return -3;
  const small = k === Kind.Lizard || k === Kind.Spider || k === Kind.Ant;
  return small && want === 0 ? -2 : -3;
}

/** 口 i のそば（20マス以内）に竜の寝床（または卵の殻）があるか */
export function dragonNearMouth(this: Ecology, i: number): boolean {
  const [mx, my] = this.mouthSpot(i);
  const R2 = 20 * TILE * 20 * TILE;
  if (this.dragonShell && sq(this.dragonShell.x - mx) + sq(this.dragonShell.y - my) < R2) return true;
  for (const o of this.list) if (o.k === Kind.Dragon && !o.dead && sq((o.hx || o.x) - mx) + sq((o.hy || o.y) - my) < R2) return true;
  return false;
}

/** その種が、いま入ってこられる所があるか */
export function canEnter(this: Ecology, k: Kind): boolean {
  const d = this.pickDoor(k, k);
  return d >= 0 || (d === -2 && this.crackSpot(k) !== null);
}

/** 口のまわり（道のり RAT_DOOR_REACH マス）で、大ネズミをあと2匹以上養えるか（食べられる苔を、一匹がゲーム内の1日に食べる量で割った数と、いまいる数を比べる） */
export function ratRoomAt(this: Ecology, x: number, y: number): boolean {
  const d = this.walkDist(this.tileOf(x, y), Ecology.RAT_DOOR_REACH);
  let food = 0;
  for (let q = 0; q < d.length; q++) {
    if (d[q] < 0) continue;
    const v = Math.max(this.w.moss[q], this.w.fungus[q]);
    if (v >= 20) food += v - 12;
  }
  let rats = 0;
  for (const c of this.list) if (c.k === Kind.Rat && !c.dead && !c.away) { const k = this.tileOf(c.x, c.y); if (k >= 0 && d[k] >= 0) rats++; }
  return rats + 2 <= Math.floor(food / 600);
}

export function checkRatDoors(this: Ecology): void {
  const m = this.w.map;
  this.ratMouthOk = m.mouths.map((mo, i) => (mo.kind === 0 && this.mouthOpen(i) && this.ratRoomAt(...this.mouthSpot(i)) ? 1 : 0));
  this.ratShaftOk = m.shafts.map((q) => (!m.sealed[q.y * m.w + q.x] && !m.solid[q.y * m.w + q.x] && this.ratRoomAt(q.x * TILE + 8, q.y * TILE + 8) ? 1 : 0));
}

/** 入ってきた所から道のり RAT_DOOR_REACH マス以内の巣穴（空きのあるもの）か、その範囲の新しい巣穴 */
export function pickBurrowNear(this: Ecology, spot: [number, number]): Burrow {
  const m = this.w.map;
  const d = this.walkDist(this.tileOf(spot[0], spot[1]), Ecology.RAT_DOOR_REACH);
  for (const b of this.burrows) {
    const k = this.tileOf(b.x, b.y - 3);
    if (k < 0 || d[k] < 0) continue;
    const n = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y).length;
    if (n > 0 && n < 8) return b;
  }
  const reach: number[] = [];
  for (let q = 0; q < d.length; q++) if (d[q] >= 0) reach.push(q);
  let best = -1;
  let bv = -1e9;
  for (let i = 0; i < 80 && reach.length; i++) {
    const k = reach[ih(this.step, i, 81) % reach.length];
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 0) continue;
    let walls = 0;
    for (const nn of [k + 1, k - 1, k - m.w]) walls += m.solid[nn];
    if (!walls) continue;
    const x = (k % m.w) * TILE + 8;
    const y = Math.floor(k / m.w) * TILE + 11;
    if (this.fireNear(x, y)) continue;
    if (this.burrows.some((b) => Math.abs(b.x - x) < 6 * TILE && Math.abs(b.y - y) < 6 * TILE)) continue;
    const v = this.burrowFood(x, y);
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  if (best < 0) return this.pickBurrow();
  const b: Burrow = { x: (best % m.w) * TILE + 8, y: Math.floor(best / m.w) * TILE + 11 };
  b.cap = this.burrowCap(b);
  this.burrows.push(b);
  return b;
}

/** 天井の裂け目のうち、開いた洞窟にあるもの（小さな生き物が入り込む場所） */
export function crackSpot(this: Ecology, salt: number): [number, number] | null {
  const m = this.w.map;
  let sh = m.shafts.filter((q) => !m.sealed[q.y * m.w + q.x] && !m.solid[q.y * m.w + q.x]);
  // 大ネズミは、まわりで養える数に余裕のある裂け目からだけ入り込む
  if (salt === Kind.Rat) sh = sh.filter((q) => this.ratShaftOk[m.shafts.indexOf(q)] === 1);
  if (!sh.length) return null;
  const q = sh[ih(this.step, salt, 199) % sh.length];
  return [q.x * TILE + 8, q.y * TILE + 8];
}

export function arrivals(this: Ecology, day: number): void {
  const m = this.w.map;
  const n = this.counts;
  const moss = this.openMoss;
  // 同じ回の更新で来る群れは同じ口から
  let door = -9;
  const enter = (k: Kind, body: number, food: number): Cr => {
    this.imported += body + food;
    if (door === -9) door = this.pickDoor(k, k);
    // 呼ぶ側は canEnter で入れる所があることを確かめてから呼ぶ（念のため、なければ正面の入口）
    const spot: [number, number] = (door >= 0 ? this.mouthSpot(door) : door === -2 ? this.forcedCrack ?? this.crackSpot(k) : null) ?? [m.entrance.x * TILE + 16, 1 * TILE + 8];
    const [x, y] = spot;
    const kind = door < 0 ? -1 : m.mouths[door].kind;
    this.originNext = door === -2 ? 'shaft' : ['mouth', 'fissure', 'river'][kind];
    const c = this.spawn(k, x + (this.list.length % 5) - 2, y, body, food);
    // 外から来た大ネズミとゴブリンは、来たときにはもう1日たっていた大人として、生まれた時刻を入れる。
    // こうしないと生まれた時刻が初期値（−1e9）のままで、群れの王や集落の頭になる条件（生まれて5日以上）を、来たその日に満たしてしまう。
    // 1日にしておけば、殖えられる（生まれて半日以上）のも、名前に「（子）」が付かないのも、これまでどおり
    if (k === Kind.Rat || k === Kind.Goblin) c.bornAt = this.w.tick - DAY_TICKS_ECO;
    if ([Kind.Orc, Kind.Minotaur, Kind.Troll, Kind.Basilisk, Kind.Vampire, Kind.Lizardman, Kind.Goblin, Kind.Kobold, Kind.Salamander].includes(k) && this.step - (this.lastLogged[k] ?? -99999) > 3000) {
      this.lastLogged[k] = this.step;
      this.log(c.x, c.y, kind < 0 ? `{k:${k}}が天井の割れ目から入り込んだ` : kind === 0 ? `{k:${k}}が地表の横穴から入ってきた` : kind === 1 ? `{k:${k}}が地底の裂け目から現れた` : `{k:${k}}が川の口から上がってきた`);
    }
    return c;
  };
  const next = () => {
    door = -9;
  };
  // 大ネズミ：苔が十分に広がったら
  // 住み着いたあとは巣穴で殖える。外からは、いないかごく少ないとき（開拓者）と、ときどきの新顔だけ
  // 中の食べ物に合わせる：食べられる苔（20以上の群落の、根元を除いた分）に対して大ネズミがすでに多いか、腹を空かせた者が多ければ来ない
  // 来るかどうかは、口や裂け目ごとに、まわり（道のり40マス）の食べられる苔と、そこにいる大ネズミの数で決める（ratMouthOk / ratShaftOk）。
  // ダンジョン全体の上限（ratCap）は越えない
  // 入り直し（七巡目）：地表の横穴が開いたあとでも、中の大ネズミが2匹以下になったら割れ目をまた開き、3匹を超えたら閉じる
  if (n[Kind.Rat] <= 2) this.ratReentry = 1;
  else if (n[Kind.Rat] > 3) this.ratReentry = 0;
  if (this.canEnter(Kind.Rat) && n[Kind.Rat] < this.ratCap() && ih(this.step, 1, 71) % (n[Kind.Rat] < 4 ? 5 : 80) === 0) {
    next();
    // 入ってきた口や裂け目のまわり（道のり40マス）に巣穴を決める
    door = this.pickDoor(Kind.Rat, Kind.Rat);
    const spot = door >= 0 ? this.mouthSpot(door) : this.crackSpot(Kind.Rat);
    if (door === -2 && spot) this.forcedCrack = spot;
    const home = spot ? this.pickBurrowNear(spot) : this.pickBurrow();
    // 地表の横穴が開いたあとの割れ目からの入り直しは、一度に2〜3匹
    const reenter = door === -2 && m.mouths.some((mo, i) => mo.kind === 0 && this.mouthOpen(i));
    const nr = reenter ? 2 + (ih(this.step, 2, 71) & 1) : 2;
    if (reenter && spot) this.record('settle', { t: this.w.tick, k: Kind.Rat, ev: 'reenter', n: nr, x: Math.round(spot[0]), y: Math.round(spot[1]) } as never);
    for (let i = 0; i < nr; i++) {
      const r = enter(Kind.Rat, 16, 20);
      r.hx = home.x;
      r.hy = home.y;
    }
    this.forcedCrack = null;
  }
  // 大トカゲ：ネズミが増えたら
  if (this.canEnter(Kind.Lizard) && n[Kind.Rat] >= 10 && n[Kind.Lizard] < Math.min(24, Math.floor(n[Kind.Rat] / 6)) && ih(this.step, 2, 71) % (n[Kind.Lizard] < 2 ? 8 : 120) === 0) {
    next();
    enter(Kind.Lizard, 60, 40);
  }
  // 大グモ：飛ぶものが増えたら
  const fly = n[Kind.Wisp] + n[Kind.Bat];
  if (this.canEnter(Kind.Spider) && fly >= 30 && n[Kind.Spider] < Math.min(14, Math.floor(fly / 25)) && ih(this.step, 3, 71) % (n[Kind.Spider] < 2 ? 10 : 150) === 0) {
    next();
    enter(Kind.Spider, 30, 20);
  }
  // ジャイアントアント：キノコが増えたら、女王と働きアリが巣を作りに来る
  if (this.canEnter(Kind.Ant) && this.openFungus > 2500 && this.colonies.length < 2 && ih(this.step, 4, 71) % 12 === 0) {
    next();
    const site = this.pickNest();
    if (site >= 0) {
      const col: Colony = { id: this.nextId++, x: (site % m.w) * TILE + 8, y: Math.floor(site / m.w) * TILE + 8, store: 16, queen: 30, starve: 0 };
      this.imported += 46;
      this.colonies.push(col);
      for (let i = 0; i < 5; i++) {
        const a = enter(Kind.Ant, 4, 12);
        a.ref = col.id;
        a.st = 1;
      }
    }
  }
  // ゴブリン：口ごとに、歩いて行ける範囲に集落の条件を満たし食べ物（苔・キノコとネズミ）の足りる場所があれば、群れで集落を作りに来る。
  // 集落がすでにあれば、新しく来た者はいちばん小さな集落に加わる。集落が襲われて捨てられた直後は、外の噂でしばらく来ない
  const gcamps = this.camps.filter((o) => o.kind === 0 && o.id >= 0);
  const cool = (k: Kind) => this.step - (this.lastArrival[k] ?? -1e9) > 3600;
  if (this.canEnter(Kind.Goblin) && this.w.tick >= this.goblinShun && n[Kind.Goblin] < 15 && cool(Kind.Goblin) && ih(this.step, 6, 71) % 14 === 0) {
    if (!gcamps.length) {
      next();
      door = this.pickDoor(Kind.Goblin, Kind.Goblin);
      // 食べ物の足りる場所が無ければ、貧しい場所に少ない群れで住みつく（その口の判定が 2 のとき）
      let site = door >= 0 ? this.pickGoblinCamp(undefined, this.mouthSpot(door), Ecology.GOBLIN_MIN_FOOD) : -1;
      const poor = site < 0 && door >= 0 && this.gobMouthOk[door] === 2;
      if (poor) site = this.pickGoblinCamp(undefined, this.mouthSpot(door), Ecology.GOBLIN_POOR_FOOD);
      if (site >= 0) {
        this.lastArrival[Kind.Goblin] = this.step;
        const cp = this.newCamp(site, 'arrive', 0, poor);
        for (let i = 0; i < (poor ? Ecology.GOBLIN_POOR_BAND : 5); i++) {
          const g = enter(Kind.Goblin, 20, 45);
          g.ref = cp.id;
          // 持ってきた食べ物の一部を、集落の蓄えにする
          g.food -= 15;
          cp.store = (cp.store ?? 0) + 15;
        }
      }
    } else if (ih(this.step, 6, 72) % 3 === 0) {
      const sizes = gcamps.map((o) => [o, this.campMembers(o).length] as [Camp, number]).sort((a, b) => a[1] - b[1] || a[0].id - b[0].id);
      const [cp, sz] = sizes[0];
      if (sz < 10) {
        next();
        this.lastArrival[Kind.Goblin] = this.step;
        for (let i = 0; i < 2; i++) enter(Kind.Goblin, 20, 45).ref = cp.id;
      }
    }
  }
  // オーク：ゴブリンかコボルトの集落があると、縄張りを持ちに来る
  const settlements = gcamps.length + this.warrens.length;
  if (this.canEnter(Kind.Orc) && settlements > 0 && n[Kind.Goblin] + n[Kind.Kobold] >= 8 && n[Kind.Orc] < Math.min(6, settlements * 3) && cool(Kind.Orc) && ih(this.step, 7, 71) % 30 === 0) {
    next();
    this.lastArrival[Kind.Orc] = this.step;
    door = this.pickDoor(Kind.Orc, Kind.Orc);
    const tgt = this.orcTargetFrom(door);
    const home = tgt ? this.pickLair(tgt) : -1;
    if (home >= 0) {
      const k = 2 + (ih(this.step, 8, 71) & 1);
      for (let i = 0; i < k; i++) {
        const o = enter(Kind.Orc, 60, 80);
        o.hx = (home % m.w) * TILE + 8;
        o.hy = Math.floor(home / m.w) * TILE + 8;
      }
    }
  }
  // リザードマン：大きな水たまりがあり、獲物がいると、水辺に村を作りに来る
  if (this.canEnter(Kind.Lizardman) && n[Kind.Rat] >= 10 && !this.camps.some((o) => o.kind === 1) && n[Kind.Lizardman] < 8 && cool(Kind.Lizardman) && ih(this.step, 9, 71) % 20 === 0) {
    next();
    this.lastArrival[Kind.Lizardman] = this.step;
    const site = this.pickWaterSite(-1);
    if (site >= 0) {
      const v: Camp = { id: this.nextId++, kind: 1, x: (site % m.w) * TILE + 8, y: Math.floor(site / m.w) * TILE + 8, dry: 0 };
      this.camps.push(v);
      const k = 3 + (ih(this.step, 10, 71) & 1);
      for (let i = 0; i < k; i++) enter(Kind.Lizardman, 40, 80).ref = v.id;
    }
  }
  // トロール：食べ物が豊富になると、夜に迷い込む
  const night = this.dayNow < 0.05;
  const food = n[Kind.Rat] + n[Kind.Goblin] + n[Kind.Kobold] + this.corpses.length;
  if (false && this.canEnter(Kind.Troll) && night && food >= 20 && n[Kind.Troll] < 2 && cool(Kind.Troll) && ih(this.step, 13, 71) % 40 === 0) {
    next();
    this.lastArrival[Kind.Troll] = this.step;
    const t = enter(Kind.Troll, 150, 200);
    const lair = this.pickDark(0, 60);
    if (lair >= 0) {
      t.hx = (lair % m.w) * TILE + 8;
      t.hy = Math.floor(lair / m.w) * TILE + 8;
    }
  }
  // バジリスク：ネズミや大トカゲが十分いると
  if (false && this.canEnter(Kind.Basilisk) && (n[Kind.Rat] >= 10 || n[Kind.Lizard] >= 3) && n[Kind.Basilisk] < 2 && cool(Kind.Basilisk) && ih(this.step, 14, 71) % 40 === 0) {
    next();
    this.lastArrival[Kind.Basilisk] = this.step;
    enter(Kind.Basilisk, 60, 60);
  }
  // ヴァンパイア：コウモリが十分に増えると、1体だけ、コウモリの群れ（5匹）を連れて夜に入ってくる。来る時刻はマップごとにずらす（シードが違っても同じ時刻に来ていた）。
  // 住処は、いちばん大きなコウモリのねぐらに近い、歩いて行ける暗がりの壁ぎわ（src/eco/vampire.ts の vampLair）。昼は従うコウモリがその天井にぶら下がり、ヴァンパイアはその下で眠る。
  // （コウモリの群れの多くは、縦穴の下の閉じた空洞をねぐらにしていて、歩くヴァンパイアはそこへ行けない）
  if (this.canEnter(Kind.Vampire) && n[Kind.Bat] >= 18 && n[Kind.Vampire] === 0 && this.dayNow <= 0.05 && cool(Kind.Vampire) && ih(this.step, 15 + m.entrance.x * 131 + (m.shafts[0]?.y ?? 0), 71) % 40 === 0) {
    const roosts = new Map<number, number>();
    for (const b of this.list) if (b.k === Kind.Bat && !b.dead && b.tx > 0 && !b.ref2) roosts.set(b.ty * 4096 + b.tx, (roosts.get(b.ty * 4096 + b.tx) ?? 0) + 1);
    let best = -1;
    let bn = 0;
    for (const [key, cnt] of roosts) if (cnt > bn || (cnt === bn && key < best)) [best, bn] = [key, cnt];
    next();
    this.lastArrival[Kind.Vampire] = this.step;
    const v = enter(Kind.Vampire, 50, 80);
    const lair = best >= 0 ? this.vampLair(best % 4096, Math.floor(best / 4096)) : -1;
    const home = lair >= 0 ? lair : this.pickDark(1, 80);
    if (home >= 0) {
      v.hx = (home % m.w) * TILE + 8;
      v.hy = Math.floor(home / m.w) * TILE + 8;
    }
    for (let i = 0; i < 5; i++) {
      this.imported += 10 + 20;
      this.originNext = 'mouth';
      const b = this.spawn(Kind.Bat, v.x + ((i % 3) - 1) * 6, v.y - 12 - (i % 2) * 6, 10, 20);
      b.ref2 = v.id;
      b.st = 1;
      if (best >= 0) {
        b.tx = best % 4096;
        b.ty = Math.floor(best / 4096);
      }
    }
  }
  // ワイバーン：コウモリやガーゴイルが増えると、夕暮れに裂け目から降りてくる
  const dusk = this.phaseNow > 0.74 && this.phaseNow < 0.86;
  if (dusk && (n[Kind.Bat] >= 20 || n[Kind.Gargoyle] >= 2) && n[Kind.Wyvern] === 0 && m.shafts.length && cool(Kind.Wyvern) && ih(this.step, 16, 71) % 20 === 0) {
    this.lastArrival[Kind.Wyvern] = this.step;
    const sh = m.shafts[ih(this.step, 17, 71) % m.shafts.length];
    this.imported += SPEC[Kind.Wyvern].body;
    this.originNext = 'shaft';
    const wv = this.spawn(Kind.Wyvern, sh.x * TILE + 8, sh.y * TILE + 8, SPEC[Kind.Wyvern].body, 0);
    this.log(wv.x, wv.y, `天井の裂け目から{k:${Kind.Wyvern}}が舞い降りた`);
    wv.hx = wv.x;
    wv.hy = wv.y;
    wv.st = 1;
  }
  // ドラゴンは外から来ない（深部の濃いマナから幼子が生まれ、育つ：manaBirths）
  // ドワーフ：2日目以降、岩の奥に古い宝がある限り、一団が来て住み着く（いなくなれば、しばらくして次の一団）
  if (this.step % 600 === 300 && !this.hold && this.w.tick > DAY_TICKS_ECO * 2 && (this.lastDwarves < 0 || this.w.tick - this.lastDwarves > DAY_TICKS_ECO)) this.maybeDwarves();
  // 冒険者：噂（明るさ、金貨、アンデッド、大物、竜）に惹かれて一行がやって来る
  if (this.step % 300 === 150 && this.parties.length < Ecology.ADV_MAX_PARTIES) this.maybeParty();
  // コボルト：キノコかネズミが十分いると、群れで住処を掘りに来る。住処がすでにあれば、新しく来た者はそこに加わる。
  // 住処が襲われて捨てられた直後は、外の噂でしばらく来ない
  if (this.canEnter(Kind.Kobold) && this.w.tick >= this.koboldShun && (n[Kind.Rat] >= 6 || this.openFungus > 2500) && n[Kind.Kobold] < 13 && ih(this.step, 5, 71) % 14 === 0) {
    const live = this.warrens.filter((o) => o.id >= 0);
    if (!live.length) {
      next();
      door = this.pickDoor(Kind.Kobold, Kind.Kobold);
      const home = door >= 0 ? this.pickWarren(undefined, this.mouthSpot(door), Ecology.KOBOLD_MIN_FOOD) : -1;
      if (home >= 0) {
        const wr = this.newWarren(home);
        // 4〜6匹の群れで来る。住処に着くまでは「道中」（冒険者が近ければ隠れて待つ）
        const size = 4 + (ih(this.step, 5, 73) % 3);
        for (let i = 0; i < size; i++) {
          const k = enter(Kind.Kobold, 20, 50);
          k.ref = wr.id;
          k.st = 11;
          // 持ってきた食べ物の一部を、住処の蓄えにする
          k.food -= 20;
          wr.store = (wr.store ?? 0) + 20;
        }
      }
    } else if (ih(this.step, 5, 72) % 3 === 0) {
      const sizes = live.map((o) => [o, this.warrenMembers(o).length] as [Warren, number]).sort((a, b) => a[1] - b[1] || a[0].id - b[0].id);
      const [wr, sz] = sizes[0];
      // 住処へ歩いて行ける口が無ければ、この回は来ない
      const reach = sz < 8 ? this.regionOf(this.tileOf(wr.x, wr.y)) : -1;
      const jd = reach >= 0 ? this.pickDoor(Kind.Kobold, Kind.Kobold, reach) : -3;
      if (jd >= 0) {
        next();
        door = jd;
        for (let i = 0; i < 2; i++) {
          const k = enter(Kind.Kobold, 20, 50);
          k.ref = wr.id;
          k.st = 11;
        }
      }
    }
  }
}

declare module '../ecology' {
  interface Ecology {
    mouthOpen: typeof mouthOpen;
    mouthTile: typeof mouthTile;
    mouthSpot: typeof mouthSpot;
    pickDoor: typeof pickDoor;
    dragonNearMouth: typeof dragonNearMouth;
    canEnter: typeof canEnter;
    ratRoomAt: typeof ratRoomAt;
    checkRatDoors: typeof checkRatDoors;
    pickBurrowNear: typeof pickBurrowNear;
    crackSpot: typeof crackSpot;
    arrivals: typeof arrivals;
  }
}

Object.assign(Ecology.prototype, { mouthOpen, mouthTile, mouthSpot, pickDoor, dragonNearMouth, canEnter, ratRoomAt, checkRatDoors, pickBurrowNear, crackSpot, arrivals });
