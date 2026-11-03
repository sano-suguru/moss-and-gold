/** Ecology のメソッド：ドワーフ（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** ドワーフが嗅ぎつける宝：まだ誰のものでもない、閉じた空洞や奥にある古い宝の山 */
export function dwarfTarget(this: Ecology): number {
  const m = this.w.map;
  const h = this.hold;
  let best = -1;
  let bv = -1e9;
  for (const p of this.piles) {
    const k = this.tileOf(p.x, p.y);
    if (k < 0) continue;
    if (m.vault[k] && ((h && h.golem) || this.dwarfLore & 1)) continue;
    if (h && sq(p.x - (h.hk % m.w) * TILE) + sq(p.y - Math.floor(h.hk / m.w) * TILE) < 6 * TILE * 6 * TILE) continue;
    const v = p.gold - (h ? Math.abs(p.x / TILE - (h.hk % m.w)) + Math.abs(p.y / TILE - Math.floor(h.hk / m.w)) : 0) * 2;
    if (v > bv) {
      bv = v;
      best = p.id;
    }
  }
  return best;
}

export function maybeDwarves(this: Ecology): void {
  const m = this.w.map;
  const tid = this.dwarfTarget();
  if (tid < 0) return;
  const tp = this.piles.find((p) => p.id === tid) as Pile;
  // 住む場所：入口から歩いて行ける床のうち、岩に面し、宝にいちばん近い所
  const reach = new Uint8Array(m.w * m.h);
  const st = [m.w + m.entrance.x];
  reach[st[0]] = 1;
  while (st.length) {
    const c = st.pop() as number;
    for (const q of [c + 1, c - 1, c + m.w, c - m.w]) {
      if (q < 0 || q >= reach.length || reach[q] || m.solid[q] || m.lava[q]) continue;
      reach[q] = 1;
      st.push(q);
    }
  }
  let site = -1;
  let bd = 1e9;
  let dir = [0, 1];
  for (let k = 0; k < m.w * m.h; k += 1) {
    if (!reach[k] || m.solid[k] || m.sealed[k] || m.lava[k] || m.paved[k] || this.w.water[k] > 10) continue;
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    if (x < 6 || y < 6 || x >= m.w - 6 || y >= m.h - 6) continue;
    for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!m.solid[k + ddx + ddy * m.w] || m.rubble[k + ddx + ddy * m.w]) continue;
      const d = Math.abs(x + ddx * 4 - tp.x / TILE) + Math.abs(y + ddy * 4 - tp.y / TILE);
      if (d < bd) {
        bd = d;
        site = k;
        dir = [ddx, ddy];
      }
    }
  }
  if (site < 0) return;
  const sx = site % m.w;
  const sy = Math.floor(site / m.w);
  const [ddx, ddy] = dir;
  // 広間：奥行き5、幅7。柱を二本残す
  const todo: number[] = [];
  for (let d = 1; d <= 5; d++)
    for (let l = -3; l <= 3; l++) {
      if (d === 3 && Math.abs(l) === 2) continue;
      const x = sx + ddx * d + (ddy !== 0 ? l : 0);
      const y = sy + ddy * d + (ddx !== 0 ? l : 0);
      if (x < 3 || y < 3 || x >= m.w - 3 || y >= m.h - 3) continue;
      todo.push(y * m.w + x);
    }
  const hk = (sy + ddy * 3) * m.w + sx + ddx * 3;
  // 背負ってきた食料（持ち込み）
  this.imported += 300;
  // 広間の奥の隅をキノコの畑にする
  const farm: number[] = [];
  for (const l of [-3, -2, 2, 3]) {
    const x = sx + ddx * 5 + (ddy !== 0 ? l : 0);
    const y = sy + ddy * 5 + (ddx !== 0 ? l : 0);
    farm.push(y * m.w + x);
  }
  this.hold = { stage: 0, sx, sy, dx: ddx, dy: ddy, hk, todo, target: tid, head: hk, len: 0, forge: -1, golem: 0, since: this.w.tick, store: 300, farm };
  const roles = [0, 0, 1, 2, 2];
  for (let i = 0; i < roles.length; i++) {
    const body = SPEC[Kind.Dwarf].body;
    const food = SPEC[Kind.Dwarf].cap;
    this.imported += body + food;
    this.originNext = 'entrance';
    const c = this.spawn(Kind.Dwarf, m.entrance.x * TILE + 8 + ((i % 3) - 1) * 8, TILE + 8, body, food);
    c.sp = roles[i];
    c.hx = sx * TILE + 8;
    c.hy = sy * TILE + 8;
    this.counts[Kind.Dwarf]++;
  }
  this.log(m.entrance.x * TILE + 8, TILE + 8, `{k:${Kind.Dwarf}}の一団が入口から入ってきた`);
}

export function updateHold(this: Ecology): void {
  const h = this.hold;
  if (!h) return;
  const m = this.w.map;
  const members = this.list.filter((c) => c.k === Kind.Dwarf && !c.dead);
  if (!members.length) {
    // 残った食料は広間で朽ちて土に返る
    if (h.store > 0) this.deposit((h.hk % m.w) * TILE + 8, Math.floor(h.hk / m.w) * TILE + 8, h.store);
    h.store = 0;
    this.log((h.hk % m.w) * TILE + 8, Math.floor(h.hk / m.w) * TILE + 8, `{k:${Kind.Dwarf}}の住みかが空になった`);
    this.hold = null;
    this.lastDwarves = this.w.tick;
    return;
  }
  if (h.stage === 1 && !h.todo.length) {
    h.stage = 2;
    this.log((h.hk % m.w) * TILE + 8, Math.floor(h.hk / m.w) * TILE + 8, `{k:${Kind.Dwarf}}が柱のある広間を掘り上げた`);
  }
  // キノコの畑：まわりの土の養分を集めてキノコを育てる（広間ができてから）
  if (h.stage >= 2 && this.step % 300 === 120) {
    for (const k of h.farm) {
      if (m.solid[k] || this.w.fungus[k] >= 160) continue;
      const x = k % m.w;
      const y = Math.floor(k / m.w);
      let got = 0;
      for (let dy = -2; dy <= 2 && got < 8; dy++)
        for (let dx = -2; dx <= 2 && got < 8; dx++) {
          const q = (y + dy) * m.w + x + dx;
          const t = Math.min(this.w.nutr[q], 8 - got, 2);
          if (t > 0) {
            this.w.nutr[q] -= t;
            got += t;
          }
        }
      this.w.fungus[k] = Math.min(255, this.w.fungus[k] + got);
      this.mossTouched = true;
    }
  }
  // 鍛冶場：溶岩が住みかの近くに開いたら、そのそばに構える
  if (h.forge < 0 && this.step % 200 === 50) {
    const hx = h.hk % m.w;
    const hy = Math.floor(h.hk / m.w);
    let best = -1;
    let bd = 1e9;
    for (let dy = -14; dy <= 14; dy++)
      for (let dx = -14; dx <= 14; dx++) {
        const k = (hy + dy) * m.w + hx + dx;
        if (k < 0 || k >= m.solid.length || m.solid[k] || m.sealed[k] || m.lava[k]) continue;
        let lava = false;
        for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (m.lava[q]) lava = true;
        if (!lava) continue;
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
    if (best >= 0) {
      h.forge = best;
      this.log((best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, `{k:${Kind.Dwarf}}が溶岩のそばに鍛冶場を構え、火を灯した`);
    }
  }
  // 目指す宝がなくなったら、次の宝を探す
  if (h.stage >= 2 && !this.piles.some((p) => p.id === h.target)) {
    const t = this.dwarfTarget();
    if (t >= 0) {
      h.target = t;
      h.stage = 2;
      h.head = h.hk;
      h.len = 0;
      h.plan = [];
    } else h.stage = 4;
  }
  // 宝物庫を避けると決めたら、宝物庫の宝は狙わない
  const tp = this.piles.find((p) => p.id === h.target);
  if (tp && h.golem && m.vault[this.tileOf(tp.x, tp.y)]) {
    const t = this.dwarfTarget();
    h.target = t;
    h.stage = t >= 0 ? 2 : 4;
    h.head = h.hk;
    h.len = 0;
  }
}

/**
 * 坑道の道筋：広間から宝まで、手間の少ない道（柔らかい層に沿い、硬い岩塊を回り込む）。
 * 上下左右だけに進み、曲がるたびに手間を足すので、まっすぐな区間を直角につないだ形になる
 */
export function planShaft(this: Ecology, h: Hold, tp: Pile): void {
  const m = this.w.map;
  const sx = h.head % m.w;
  const sy = Math.floor(h.head / m.w);
  const tx = Math.floor(tp.x / TILE);
  const ty = Math.floor(tp.y / TILE);
  const x0 = Math.max(2, Math.min(sx, tx) - 16);
  const x1 = Math.min(m.w - 3, Math.max(sx, tx) + 16);
  const y0 = Math.max(2, Math.min(sy, ty) - 16);
  const y1 = Math.min(m.h - 3, Math.max(sy, ty) + 16);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const N = bw * bh * 4;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const cost = (k: number) => {
    if (m.lava[k]) return Infinity;
    if (!m.solid[k]) return 1;
    if (m.rubble[k]) return 2;
    return [3, 6, 16][m.hard[k]];
  };
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  // 小さな二分ヒープ
  const heap: number[] = [];
  const hd: number[] = [];
  const push = (st: number, d: number) => {
    heap.push(st);
    hd.push(d);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hd[p] <= hd[i]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      [hd[p], hd[i]] = [hd[i], hd[p]];
      i = p;
    }
  };
  const pop = () => {
    const st = heap[0];
    const lastS = heap.pop() as number;
    const lastD = hd.pop() as number;
    if (heap.length) {
      heap[0] = lastS;
      hd[0] = lastD;
      let i = 0;
      for (;;) {
        const a = i * 2 + 1;
        const b = a + 1;
        let mi = i;
        if (a < heap.length && hd[a] < hd[mi]) mi = a;
        if (b < heap.length && hd[b] < hd[mi]) mi = b;
        if (mi === i) break;
        [heap[mi], heap[i]] = [heap[i], heap[mi]];
        [hd[mi], hd[i]] = [hd[i], hd[mi]];
        i = mi;
      }
    }
    return st;
  };
  const idx = (x: number, y: number) => (y - y0) * bw + (x - x0);
  for (let d = 0; d < 4; d++) {
    const st = idx(sx, sy) * 4 + d;
    dist[st] = 0;
    push(st, 0);
  }
  let goal = -1;
  while (heap.length) {
    const st = pop();
    const cell = st >> 2;
    const dir = st & 3;
    const cx = (cell % bw) + x0;
    const cy = Math.floor(cell / bw) + y0;
    const dcur = dist[st];
    if (cx === tx && cy === ty) {
      goal = st;
      break;
    }
    for (let nd = 0; nd < 4; nd++) {
      const nx = cx + DX[nd];
      const ny = cy + DY[nd];
      if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
      const c = cost(ny * m.w + nx);
      if (c === Infinity) continue;
      const nst = idx(nx, ny) * 4 + nd;
      const d = dcur + c + (nd !== dir ? 5 : 0);
      if (d < dist[nst]) {
        dist[nst] = d;
        prev[nst] = st;
        push(nst, d);
      }
    }
  }
  const plan: number[] = [];
  for (let st = goal; st >= 0; st = prev[st]) {
    const cell = st >> 2;
    plan.push((Math.floor(cell / bw) + y0) * m.w + (cell % bw) + x0);
  }
  plan.reverse();
  h.plan = plan;
  h.planFor = tp.id;
}

/** 坑道の次のマス：道筋に沿って、まだ岩のままの最初のマス */
export function shaftNext(this: Ecology, h: Hold, tp: Pile): number {
  const m = this.w.map;
  if (h.planFor !== tp.id || !h.plan || !h.plan.length) this.planShaft(h, tp);
  const plan = h.plan ?? [];
  for (let i = 0; i < plan.length; i++) {
    const k = plan[i];
    if (m.lava[k]) {
      h.plan = [];
      return -1;
    }
    if (m.solid[k]) return k;
    h.head = k;
  }
  return -1;
}

export function dwarf(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Dwarf];
  const h = this.hold;
  const m = this.w.map;
  if (this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 4) return;
  if (!h) {
    c.st = 9;
    return;
  }
  const hx = (h.hk % m.w) * TILE + 8;
  const hy = Math.floor(h.hk / m.w) * TILE + 8;
  // 宝を盗んだ者を追う（戦士と坑夫）。金貨を落とすか、住みかから遠く離れるまで
  {
    const a = this.alarms.get('d');
    if (a && c.sp !== 1) {
      const f = this.byId.get(a.foe);
      if (f && !f.dead && f.gold > 0 && sq(f.x - hx) + sq(f.y - hy) < 25 * TILE * 25 * TILE) {
        this.alarms.set('d', { ...a, t: this.step });
        c.act = 1;
        if (sq(f.x - c.x) + sq(f.y - c.y) < 14 * 14) this.fight(c, f);
        else this.goTo(c, f.x, f.y, s.speed * 1.1);
        return;
      }
    }
  }
  // 住みかを守る：ゴブリン、オーク、コボルト、トロール
  if (c.sp === 2 && this.defend(c, hx, hy, [Kind.Goblin, Kind.Orc, Kind.Kobold, Kind.Troll, Kind.Skeleton])) return;
  // 腹が減ったら、まず広間の蓄えを食べる。なければキノコ（畑のものも）か苔を食べ、大ネズミを狩る
  if ((c.hungry || c.food < s.cap * 0.3) && h.store > 0) {
    c.act = 1;
    if (sq(hx - c.x) + sq(hy - c.y) < 24 * 24 || this.goTo(c, hx, hy, s.speed)) {
      const t = Math.min(h.store, 20, s.cap - c.food);
      h.store -= t;
      c.food += t;
      c.sinceMeal = 0;
      c.hungry = 0;
    }
    return;
  }
  if (c.hungry) {
    if (this.hunt(c, 7, HUNT6, s.speed * 1.1)) return;
    const k = this.findFungus(c.x, c.y, 10, c.id);
    if (k >= 0) {
      c.act = 1;
      if (this.goTo(c, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === k) {
        const t = Math.min(4, this.w.fungus[k] - 12, s.cap - c.food);
        if (t > 0) {
          this.w.fungus[k] -= t;
          c.food += t;
          c.sinceMeal = 0;
          this.mossTouched = true;
        } else this.eatMoss(c, 4);
      }
      return;
    }
    if (this.eatMoss(c, 3)) return;
  }
  // 宝を抱えていたら広間へ運んで山にする
  if (c.gold > 0) {
    c.act = 1;
    if (sq(hx - c.x) + sq(hy - c.y) < 20 * 20 || this.goTo(c, hx, hy, s.speed)) {
      this.dropGold(hx, hy, c.gold, this.ownerNote(c, 'stash'));
      c.gold = 0;
    }
    return;
  }
  // 住む場所へ
  if (h.stage === 0) {
    c.act = 1;
    if (this.goTo(c, h.sx * TILE + 8, h.sy * TILE + 8, s.speed) || sq(h.sx * TILE + 8 - c.x) + sq(h.sy * TILE + 8 - c.y) < 20 * 20) h.stage = 1;
    // たどり着けないまま時間が経ったら、住む場所を探し直す
    if (this.w.tick - h.since > DAY_TICKS_ECO / 3) {
      // 背負ってきた食料は持ったまま外へ出ていく
      this.exported += h.store;
      h.store = 0;
      this.hold = null;
      this.lastDwarves = -1;
      for (const o of this.list) if (o.k === Kind.Dwarf && !o.dead) o.st = 9;
    }
    return;
  }
  // 鍛冶屋は鍛冶場で槌を振るう（鍛冶場がなければ広間で）
  if (c.sp === 1) {
    const fk = h.forge >= 0 ? h.forge : h.hk;
    const fx = (fk % m.w) * TILE + 8;
    const fy = Math.floor(fk / m.w) * TILE + 10;
    if (sq(fx + 14 - c.x) + sq(fy - c.y) > 14 * 14) {
      c.act = 1;
      this.goTo(c, fx + 14, fy, s.speed);
    } else {
      c.dir = 3;
      if (h.stage === 1 && h.todo.length && this.step % 4 === 0) {
        // 広間を掘るのを手伝う
      }
      if (c.actT > 30 && h.forge >= 0) {
        c.act = 2;
        c.actT = 0;
      } else if (c.act !== 2) c.act = 0;
    }
    return;
  }
  // 坑夫：広間を掘り、坑道を掘り進める（坑夫がいなければ、ほかの者が代わりに掘る）
  const digger = c.sp === 0 || (c.sp !== 1 && !this.list.some((o) => o.k === Kind.Dwarf && !o.dead && o.sp === 0));
  if (digger && (h.stage === 1 || h.stage === 2)) {
    let k = -1;
    if (h.stage === 1) {
      while (h.todo.length && !m.solid[h.todo[0]]) h.todo.shift();
      // 開いた床に面したマスから順に
      const i = h.todo.findIndex((q) => [q + 1, q - 1, q + m.w, q - m.w].some((n) => !m.solid[n]));
      if (i >= 0) k = h.todo[i];
      else if (h.todo.length) h.todo.length = 0;
    } else {
      // 試し掘りの枝坑道を、ときどき先に
      while (h.drift && h.drift.length && !m.solid[h.drift[0]]) h.drift.shift();
      if (h.drift && h.drift.length && (c.id & 1) === 1 && [h.drift[0] + 1, h.drift[0] - 1, h.drift[0] + m.w, h.drift[0] - m.w].some((n) => !m.solid[n])) k = h.drift[0];
      else {
        const tp = this.piles.find((p) => p.id === h.target);
        if (tp) k = this.shaftNext(h, tp);
        if (k < 0 && tp) h.stage = 3;
      }
    }
    if (k < 0) return;
    const kx = (k % m.w) * TILE + 8;
    const ky = Math.floor(k / m.w) * TILE + 8;
    // 掘るマスの手前の床まで行って、つるはしを振るう
    let stand = -1;
    for (const n of [k + 1, k - 1, k + m.w, k - m.w]) if (!m.solid[n] && !m.sealed[n]) stand = n;
    if (stand < 0) return;
    const sxp = (stand % m.w) * TILE + 8;
    const syp = Math.floor(stand / m.w) * TILE + 8;
    if (sq(sxp - c.x) + sq(syp - c.y) > 12 * 12) {
      c.act = 1;
      this.goTo(c, sxp, syp, s.speed);
      return;
    }
    c.dir = Math.abs(kx - c.x) > Math.abs(ky - c.y) ? (kx > c.x ? 2 : 3) : ky > c.y ? 0 : 1;
    c.act = 2;
    c.actT = 0;
    if (ih(c.id, this.step, 150) % (m.rubble[k] ? 12 : [18, 30, 60][m.hard[k]]) === 0 && this.w.dig(k)) {
      if (h.stage === 1) {
        const i = h.todo.indexOf(k);
        if (i >= 0) h.todo.splice(i, 1);
        this.w.pave(k);
      } else if (h.drift && h.drift[0] === k) {
        h.drift.shift();
      } else {
        h.head = k;
        h.len++;
        // 坑道には数マスおきに壁掛けのランプを残す
        if (h.len % 6 === 0) this.lamps.push(k);
        // ときどき脇へ短い試し掘りの枝坑道（3マス、硬い岩には掘らない）
        if (h.len % 9 === 4) {
          const prevK = (h.plan ?? [])[(h.plan ?? []).indexOf(k) - 1] ?? k;
          const along = Math.abs(k - prevK) === 1 ? 'x' : 'y';
          const side = ih(h.len, this.step, 152) & 1 ? 1 : -1;
          const stepK = along === 'x' ? side * m.w : side;
          const drift: number[] = [];
          for (let i = 1; i <= 3; i++) {
            const q = k + stepK * i;
            if (!m.solid[q] || m.hard[q] === 2 || m.lava[q]) break;
            drift.push(q);
          }
          (h.drift ??= []).push(...drift);
        }
      }
    }
    return;
  }
  // 宝を運ぶ（坑夫と戦士）
  if (h.stage === 3) {
    const tp = this.piles.find((p) => p.id === h.target);
    if (tp) {
      const k = this.tileOf(tp.x, tp.y);
      if (k >= 0 && !m.sealed[k]) {
        c.act = 1;
        if (sq(tp.x - c.x) + sq(tp.y - c.y) < 12 * 12) {
          const t = Math.min(20, tp.gold);
          tp.gold -= t;
          c.gold += t;
          this.piles = this.piles.filter((o) => o.gold > 0);
        } else this.goTo(c, tp.x, tp.y, s.speed);
        return;
      }
    }
  }
  // 広間のまわりで過ごす
  c.act = c.actT % 160 < 50 ? 1 : 0;
  if (c.act === 1) {
    const a = ih(c.id, this.step >> 6, 151) % 7;
    this.moveToward(c, hx + (a - 3) * 6, hy + ((a * 5) % 5 - 2) * 5, s.speed * 0.6);
  }
}

declare module '../ecology' {
  interface Ecology {
    dwarfTarget: typeof dwarfTarget;
    maybeDwarves: typeof maybeDwarves;
    updateHold: typeof updateHold;
    planShaft: typeof planShaft;
    shaftNext: typeof shaftNext;
    dwarf: typeof dwarf;
  }
}

Object.assign(Ecology.prototype, { dwarfTarget, maybeDwarves, updateHold, planShaft, shaftNext, dwarf });
