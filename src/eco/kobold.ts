/** Ecology のメソッド：コボルト（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/**
 * 新しい住処の場所：人の気配が薄く（正面の入口や冒険者のよく通る道から離れ）、竜の寝床から30マス、
 * トロールとバジリスクの住みかから15マス離れ、食べ物（キノコ、苔、ネズミ）が近い所。岩壁に面していれば横穴を掘り込める所を好む。
 * avoid の住処からも離れる（住処を捨てて移るとき）
 */
export function pickWarren(this: Ecology, avoid?: Warren, from?: [number, number], minFood = 0): number {
  const m = this.w.map;
  let best = -1;
  let bv = -1e9;
  // 歩いて行ける所だけ（出発点からの道のりが100マス以内。道筋を探す広さに収まるように）。その中から選ぶ
  const par = from ? new Int32Array(m.w * m.h) : null;
  const dist = from ? this.walkDist(this.tileOf(from[0], from[1]), 100, par as Int32Array) : null;
  const reach: number[] = [];
  if (dist) for (let q = 0; q < dist.length; q++) if (dist[q] >= 0) reach.push(q);
  if (dist && !reach.length) return -1;
  const danger: [number, number, number][] = [];
  for (const o of this.list) {
    if (o.dead || o.away) continue;
    if (o.k === Kind.Dragon) danger.push([o.hx || o.x, o.hy || o.y, 30]);
    else if (o.k === Kind.Troll || o.k === Kind.Basilisk) danger.push([o.hx || o.x, o.hy || o.y, 15]);
  }
  if (this.dragonShell) danger.push([this.dragonShell.x, this.dragonShell.y, 30]);
  for (let i = 0; i < 260; i++) {
    const k = dist ? reach[ih(this.step, i, 69) % reach.length] : ih(this.step, i, 69) % (m.w * m.h);
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.lightBase[k] > 60) continue;
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    if (Math.abs(x - m.entrance.x) + y < 30) continue;
    let walls = 0;
    for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (m.solid[q]) walls++;
    if (walls < 2) continue;
    if (this.warrens.some((o) => Math.abs(o.x - x * TILE) + Math.abs(o.y - y * TILE) < 30 * TILE)) continue;
    if (avoid && Math.abs(avoid.x - x * TILE) + Math.abs(avoid.y - y * TILE) < 30 * TILE) continue;
    // ゴブリンの集落からも15マス離す（ゴブリンの集落の場所選びと同じ間合い。片方だけでは、集落のすぐそばに住処ができて殺し合っていた）
    if (this.camps.some((o) => o.id >= 0 && o.kind === 0 && Math.abs(o.x / TILE - x) + Math.abs(o.y / TILE - y) < 15)) continue;
    const px = x * TILE + 8;
    const py = y * TILE + 8;
    if (danger.some(([dx, dy, r]) => sq(dx - px) + sq(dy - py) < r * TILE * r * TILE)) continue;
    // 食べ物が足りない所には住まない（minFood を指定したとき）
    if (minFood > 0 && this.warrenFood(k) < minFood) continue;
    const pres = this.presenceAt(px, py);
    if (pres > 0.6) continue;
    // 出発点からの道筋の人の気配：気配の濃いマス（0.5より上）が多い候補ほど避ける（道中で冒険者に出会わないように）。
    // 口が入口のそばにあると、どの道筋も気配の濃い所を通るので、選ばないのではなく点を下げる
    let busy = 0;
    if (par) for (let q = k, n = 0; q >= 0 && n < 200; q = par[q], n++) if (this.presenceAt((q % m.w) * TILE + 8, Math.floor(q / m.w) * TILE + 8) > 0.5) busy++;
    let f = 0;
    for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) f += this.w.fungus[yy * m.w + xx] + (this.w.moss[yy * m.w + xx] >> 2);
    }
    let rats = 0;
    this.nearby(px, py, 10, (o) => {
      if (!o.dead && o.k === Kind.Rat) rats++;
    });
    const v = f + rats * 60 - pres * 1500 - busy * 60 + (this.tunnelDir(k) >= 0 ? 300 : 0) + (ih(k, 1, 70) % 200);
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

export function walkDist(this: Ecology, k: number, max: number, par?: Int32Array): Int32Array {
  const m = this.w.map;
  const N = m.w * m.h;
  const dist = new Int32Array(N).fill(-1);
  if (k < 0) return dist;
  if (par) par[k] = -1;
  if (this.wdQ.length !== N) this.wdQ = new Int32Array(N);
  const q = this.wdQ;
  let h = 0;
  let t = 0;
  dist[k] = 0;
  q[t++] = k;
  const W = m.w;
  while (h < t) {
    const c = q[h++];
    if (dist[c] >= max) continue;
    for (let d = 0; d < 4; d++) {
      const n = d === 0 ? c + 1 : d === 1 ? c - 1 : d === 2 ? c + W : c - W;
      if (n < 0 || n >= N || dist[n] >= 0 || m.solid[n] || m.lava[n] || m.sealed[n]) continue;
      dist[n] = dist[c] + 1;
      if (par) par[n] = c;
      q[t++] = n;
    }
  }
  return dist;
}

export function warrenFood(this: Ecology, k: number): number {
  const m = this.w.map;
  const x0 = k % m.w;
  const y0 = Math.floor(k / m.w);
  let f = 0;
  for (let y = Math.max(1, y0 - 8); y <= Math.min(m.h - 2, y0 + 8); y++)
    for (let x = Math.max(1, x0 - 8); x <= Math.min(m.w - 2, x0 + 8); x++) {
      const q = y * m.w + x;
      if (m.solid[q] || m.sealed[q]) continue;
      const v = Math.max(this.w.moss[q], this.w.fungus[q]);
      if (v >= 20) f += v - 12;
    }
  this.nearby(x0 * TILE + 8, y0 * TILE + 8, 10, (o) => {
    if (!o.dead && o.k === Kind.Rat) f += 100;
  });
  return f;
}

export function checkKoboldMouths(this: Ecology): void {
  const m = this.w.map;
  this.kobMouthOk = m.mouths.map((mo, i) => (mo.kind === 0 && this.mouthOpen(i) && !this.dragonNearMouth(i) && this.pickWarren(undefined, this.mouthSpot(i), Ecology.KOBOLD_MIN_FOOD) >= 0 ? 1 : 0));
}

/** 床のマス k から、岩壁へまっすぐ4マス掘り込める向き（なければ -1） */
export function tunnelDir(this: Ecology, k: number): number {
  const m = this.w.map;
  const steps = [1, -1, m.w, -m.w];
  for (let d = 0; d < 4; d++) {
    let ok = true;
    for (let i = 1; i <= 4 && ok; i++) {
      const q = k + steps[d] * i;
      const x = q % m.w;
      const y = Math.floor(q / m.w);
      if (x < 3 || y < 3 || x >= m.w - 3 || y >= m.h - 3 || !m.solid[q] || m.lava[q]) ok = false;
      else for (const r of [q + 1, q - 1, q + m.w, q - m.w]) if (m.lava[r] || (m.sealed[r] && !m.solid[r])) ok = false;
      // 横穴の横は岩であること（すぐ隣の洞窟に抜けない）
      if (ok && i > 1) {
        const side = d < 2 ? m.w : 1;
        if (!m.solid[q + side] || !m.solid[q - side]) ok = false;
      }
    }
    if (ok) return d;
  }
  return -1;
}

/** 新しい住処を作る（door は入口の床のマス） */
export function newWarren(this: Ecology, door: number, how = 'arrive'): Warren {
  const m = this.w.map;
  this.record('settle', { t: this.w.tick, k: Kind.Kobold, id: this.nextId, ev: 'found', how, x: (door % m.w) * TILE + 8, y: Math.floor(door / m.w) * TILE + 8 } as never);
  const wr: Warren = { id: this.nextId++, x: (door % m.w) * TILE + 8, y: Math.floor(door / m.w) * TILE + 8, target: -1, prog: 0, len: 0, door, dir: this.tunnelDir(door), tun: 0, store: 0, hide: 0, raids: 0, empty: -1 };
  this.warrens.push(wr);
  return wr;
}

export function warrenMembers(this: Ecology, wr: Warren): Cr[] {
  return this.list.filter((c) => c.k === Kind.Kobold && !c.dead && c.ref === wr.id && c.st !== 10);
}

/** 隠れているコボルト（住処の奥に身をひそめている。入口に踏み込まれない限り、誰にも気づかれない） */
export function isHidden(this: Ecology, o: Cr): boolean {
  if (o.k === Kind.Goblin) return this.goblinHidden(o);
  if (o.k !== Kind.Kobold || o.dead) return false;
  // 住処へ向かう道中で、冒険者をやり過ごすために身をひそめている
  if (o.st === 12) return true;
  if (o.st !== 7) return false;
  const wr = this.warrenOf(o);
  return !!wr && wr.hide === 1 && sq(o.x - wr.x) + sq(o.y - wr.y) < 1.5 * TILE * 1.5 * TILE;
}

/** 見る者 c が、隠れている o の住処の入口に踏み込んでいるか（すぐそばまで来ているか） */
export function atDoorOf(this: Ecology, c: Cr, o: Cr): boolean {
  if (o.st === 12 || o.k === Kind.Goblin) return sq(o.x - c.x) + sq(o.y - c.y) < 1.2 * TILE * 1.2 * TILE;
  const wr = this.warrenOf(o);
  if (!wr) return true;
  const m = this.w.map;
  const d = wr.door ?? -1;
  if (d >= 0 && sq((d % m.w) * TILE + 8 - c.x) + sq(Math.floor(d / m.w) * TILE + 8 - c.y) < 1.2 * TILE * 1.2 * TILE) return true;
  return sq(o.x - c.x) + sq(o.y - c.y) < 1.2 * TILE * 1.2 * TILE;
}

export function warrenOf(this: Ecology, c: Cr): Warren | undefined {
  return this.warrens.find((o) => o.id === c.ref);
}

export function kobold(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Kobold];
  // 住処へ向かう道中：冒険者が近くにいる間は身をひそめて待ち、離れてから進む
  if ((c.st === 11 || c.st === 12) && this.koboldTransit(c)) return;
  // 冒険者に気づいたら、一行がずっと強ければ戦わずに逃げる（追いかけてはこない）
  if (c.flee <= 0 && this.step % 4 === c.id % 4) {
    let adv: Cr | null = null;
    this.nearby(c.x, c.y, 8, (o) => {
      if (adv || o.dead || o.away || o.k !== Kind.Adventurer || sq(o.x - c.x) + sq(o.y - c.y) > 8 * TILE * 8 * TILE || !this.canSense(c, o)) return;
      adv = o;
    });
    if (adv) {
      const a = adv as Cr;
      const p = this.parties.find((q) => q.id === a.party);
      if ((p ? this.partyStr(p) : this.str(a)) > this.str(c) * 2) {
        c.flee = 90 + (ih(c.id, this.step, 232) % 40);
        c.foe = a.id;
        c.lure = 0;
        return;
      }
    }
  }
  if (c.st === 10) {
    this.leaveWithGroup(c);
    return;
  }
  const wr = this.warrenOf(c);
  // 住みか（逃げ帰る先）は住処。来たときの口ではない
  if (wr && c.flee <= 0) {
    c.hx = wr.x;
    c.hy = wr.y;
  }
  // 住処のある者は一匹で見切りをつけない（住処ごと捨てるのは群れの出来事：updateWarrens）。住処のない者だけが飢えて去る
  if (!wr && this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 4 && c.st !== 2) return;
  // 隠れる：一行が群れより明らかに強いあいだは、住処の奥で身をひそめる（蓄えから食べる。蓄えが尽きて飢えれば、こっそり食べ物を探しに出る）
  if (wr && wr.hide === 1 && c.hungry && (wr.store ?? 0) > 0) {
    const t = Math.min(wr.store ?? 0, Math.floor(s.cap * 0.7) - c.food);
    wr.store = (wr.store ?? 0) - t;
    c.food += t;
    c.hungry = 0;
    c.sinceMeal = 0;
  }
  if (wr && wr.hide === 1 && !(c.hungry > 300 && (wr.store ?? 0) <= 0) && (c.st === 7 || sq(wr.x - c.x) + sq(wr.y - c.y) < 8 * TILE * 8 * TILE)) {
    c.st = 7;
    if (sq(wr.x - c.x) + sq(wr.y - c.y) > 0.6 * TILE * 0.6 * TILE) {
      c.act = 1;
      this.goTo(c, wr.x, wr.y, s.speed * 1.2);
    } else c.act = 0;
    return;
  }
  if (c.st === 7) c.st = 0;
  if (wr && this.defend(c, wr.x, wr.y, [Kind.Goblin])) return;
  const home = wr ? sq(wr.x - c.x) + sq(wr.y - c.y) : 1e18;
  // 腹を空かせた者は、住処の蓄えから食べる
  if (wr && (wr.store ?? 0) > 0 && (c.hungry || c.food < s.cap * 0.15)) {
    if (home < 2 * TILE * 2 * TILE) {
      const t = Math.min(wr.store ?? 0, Math.floor(s.cap * 0.7) - c.food);
      if (t > 0) {
        wr.store = (wr.store ?? 0) - t;
        c.food += t;
        c.hungry = 0;
        c.sinceMeal = 0;
        c.act = 2;
        c.actT = 0;
        c.st = 0;
        return;
      }
    } else if (home < 30 * TILE * 30 * TILE) {
      c.act = 1;
      this.goTo(c, wr.x, wr.y, s.speed);
      return;
    }
  }
  // 蓄えを運び込む：腹が満ちた者は、余りを住処に置く
  if (wr && c.food > s.cap * (c.st === 13 ? 0.55 : 0.75) && home < 2 * TILE * 2 * TILE && (wr.store ?? 0) < this.storeGoal(wr)) {
    const t = c.food - Math.floor(s.cap * 0.5);
    c.food -= t;
    wr.store = (wr.store ?? 0) + t;
    c.act = 2;
    c.actT = 0;
    if (c.st === 4 || c.st === 13) c.st = 0;
    return;
  }
  // 腹いっぱいの者は、蓄えが足りなければ住処へ持ち帰る（集めに出た者が腹を満たしたあとも。以前は1回の更新だけ住処へ向かって、そのまま忘れていた）
  // 持ち帰る道中（st 13）は、歩くうちに腹がこなれても、半分を超えて残っていれば運び込む
  if (wr && !c.hungry && c.food > s.cap * (c.st === 13 ? 0.55 : 0.75) && home < 30 * TILE * 30 * TILE && (wr.store ?? 0) < this.storeGoal(wr) && (c.st === 0 || c.st === 4 || c.st === 13)) {
    c.st = 13;
    c.act = 1;
    this.goTo(c, wr.x, wr.y, s.speed);
    return;
  }
  if (c.st === 13) c.st = 0;
  // 食べ物を集めに出る：蓄えが足りなければ、群れのうち何匹かが交代で狩りに出て、腹いっぱいにして帰る
  if (wr && c.st === 0 && !c.hungry && (wr.store ?? 0) < this.storeGoal(wr) && c.food < s.cap * 0.85 && ih(c.id, this.step >> 7, 76) % 3 === 0) c.st = 4;
  if (c.st === 4 && c.food >= s.cap * 0.95) {
    c.st = 0;
    if (wr) {
      c.act = 1;
      this.goTo(c, wr.x, wr.y, s.speed);
      return;
    }
  }
  // 腹が減ったら、ネズミを狩るか、キノコを食べる（食べ始めたら腹が満ちるまで食べる）
  if (c.st === 3 && c.food >= s.cap * 0.7) c.st = 0;
  if (c.hungry || c.st === 3 || c.st === 4) {
    if (c.hungry && c.st !== 4) c.st = 3;
    // 集めに出た者は、まず住処の畑で育ったキノコを摘む（腹に入れて持ち帰り、蓄えにする）。
    // 住処と歩いてつながっていない畑（岩の角をはさんで斜めにしか接していないマスなど）は摘みに行かない
    // （以前は seed18 で、そうした畑のマスの手前の角で、集めに出たコボルトが入れ替わりながら1日以上足踏みしていた）
    if (c.st === 4 && wr && !c.hungry) {
      let fk = -1;
      let fv = 49;
      const r0 = this.regionOf(this.tileOf(wr.x, wr.y));
      const m0 = this.w.map;
      // ほかのコボルトが立っているか、摘みに向かっている畑のマスは選ばない（空いたマスがなければ、集めに出るのをやめる）。
      // （以前は皆がいちばん育ったマスを選び、3マスしかない畑の1マスに6匹ほどが群がって、狭い住処の中で歩く姿のまま詰まっていた。abc・かしたれ）
      const taken = (k: number) => {
        const kx = (k % m0.w) * TILE + 8;
        const ky = Math.floor(k / m0.w) * TILE + 8;
        let busy = false;
        this.nearby(kx, ky, 1, (o) => {
          if (busy || o === c || o.dead || o.k !== Kind.Kobold) return;
          if (sq(o.x - kx) + sq(o.y - ky) < 10 * 10 || this.paths.get(o.id)?.gk === k) busy = true;
        });
        return busy;
      };
      for (const k of this.farmTiles(wr))
        if (this.w.fungus[k] > fv && (r0 < 0 || this.regionOf(k) === r0) && (this.tileOf(c.x, c.y) === k || this.paths.get(c.id)?.gk === k || !taken(k))) {
          fv = this.w.fungus[k];
          fk = k;
        }
      if (fk < 0 && this.farmTiles(wr).some((k) => this.w.fungus[k] > 49)) {
        c.st = 0;
        c.act = 0;
        return;
      }
      if (fk >= 0) {
        const m = this.w.map;
        c.act = 1;
        if (this.goTo(c, (fk % m.w) * TILE + 8, Math.floor(fk / m.w) * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === fk) {
          const t = Math.min(4, this.w.fungus[fk] - 30, s.cap - c.food);
          if (t > 0) {
            this.w.fungus[fk] -= t;
            c.food += t;
            this.mossTouched = true;
          }
          c.act = 2;
          if (c.actT > 4) c.actT = 0;
        }
        return;
      }
    }
    let prey: Cr | null = null;
    let bd = 8 * TILE * 8 * TILE;
    this.nearby(c.x, c.y, 8, (o) => {
      if (o.dead || o.away || o.k !== Kind.Rat) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
    if (prey) {
      const p = prey as Cr;
      c.act = 1;
      if (sq(p.x - c.x) + sq(p.y - c.y) < 10 * 10) {
        this.fight(c, p);
        return;
      }
      this.goTo(c, p.x, p.y, s.speed * 1.2);
      return;
    }
    // いま向かっている目的地（道筋の記録に残る目的地のマス）にまだ食べられる苔かキノコがあり、探す範囲の内なら、探し直さずにそこへ向かう。
    // 苔を探す処理は、まわりのマスを乱数でいくつか試して選ぶので、更新のたびに探し直すと目的地が入れ替わり、
    // ジグザグに行ったり来たりして引っかかって見えていた（16シードの12日目で、コボルトの引っかかりのうち行ったり来たりの大半）
    const R = c.sinceMeal > 600 ? 14 : 8;
    const pg = this.paths.get(c.id);
    const gk = pg ? pg.gk : -1;
    const keep = gk >= 0 && pg!.miss === 0 && Math.max(this.w.moss[gk], this.w.fungus[gk]) >= 20 && Math.abs((gk % this.w.map.w) - Math.floor(c.x / TILE)) <= R && Math.abs(Math.floor(gk / this.w.map.w) - Math.floor(c.y / TILE)) <= R;
    // 着いて食べている間（道筋の記録は着いたときに消える）は、足元のマスに食べ物が残っていればそこにとどまる
    const here = this.tileOf(c.x, c.y);
    const atFood = here >= 0 && Math.max(this.w.moss[here], this.w.fungus[here]) >= 20;
    const k0 = keep ? gk : atFood ? here : this.findMoss(c, c.x, c.y, R, 72);
    const k = k0 >= 0 ? k0 : this.findFungus(c.x, c.y, R, c.id + this.step);
    if (k >= 0) {
      const m = this.w.map;
      c.act = 1;
      if (this.goTo(c, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === k) {
        if (!this.eatMoss(c, 4) && c.hungry === 0 && c.st !== 4) c.st = 0;
      }
      return;
    }
    if (c.st === 4) c.st = 0;
    if (!c.hungry) c.st = 0;
  }
  // 住処のない者は、立ち止まっては、ふつうに近い速さで少し歩いて探す（src/eco/move.ts の stroll）
  if (!wr) {
    this.stroll(c, 4, 73, 0.9);
    return;
  }
  // 掘る：住処のまわりの岩を少しずつ崩してトンネルを延ばす
  if (wr.target >= 0 && this.w.map.solid[wr.target]) {
    const m = this.w.map;
    const tx = (wr.target % m.w) * TILE + 8;
    const ty = Math.floor(wr.target / m.w) * TILE + 8;
    if (sq(tx - c.x) + sq(ty - c.y) < 20 * 20) {
      c.st = 2;
      c.act = 2;
      if (c.actT > 4) c.actT = 0;
      c.dir = Math.abs(tx - c.x) > Math.abs(ty - c.y) ? (tx > c.x ? 2 : 3) : ty > c.y ? 0 : 1;
      wr.prog++;
      this.fxDigs.push(this.step, c.id, wr.target, 0);
      if (wr.prog >= [500, 900, 2400][m.rubble[wr.target] ? 0 : m.hard[wr.target]]) {
        if (this.w.dig(wr.target)) {
          this.fxDigs.push(this.step, c.id, wr.target, 1);
          wr.len++;
          // 入口側と切り離されていた住処が、いま掘ったマスで入口側とつながった
          if (this.islandIds.has(wr.id) && this.regionOf(this.tileOf(wr.x, wr.y)) === this.mainRegion) this.markJoined(wr.id, wr.x, wr.y, Kind.Kobold, 1);
          // 横穴を掘り込んでいるなら、住処の中心を奥へ移す
          if ((wr.dir ?? -1) >= 0 && wr.target === this.tunnelNext(wr)) {
            wr.tun = (wr.tun ?? 0) + 1;
            wr.x = (wr.target % m.w) * TILE + 8;
            wr.y = Math.floor(wr.target / m.w) * TILE + 8;
            if ((wr.tun ?? 0) >= 4) wr.dir = -1;
          }
        }
        wr.target = -1;
        wr.prog = 0;
        c.st = 0;
      }
      return;
    }
    c.act = 1;
    // 岩の手前の床まで行く
    const fl = this.floorNear(wr.target);
    if (fl >= 0) this.goTo(c, (fl % m.w) * TILE + 8, Math.floor(fl / m.w) * TILE + 8, s.speed);
    else wr.target = -1;
    return;
  }
  c.st = 0;
  // 住処のそばでくつろぐ
  if (sq(wr.x - c.x) + sq(wr.y - c.y) > 4 * TILE * 4 * TILE) {
    c.act = 1;
    this.goTo(c, wr.x, wr.y, s.speed);
  } else {
    // たいてい立ち止まり、ときどき、ふつうに近い速さで数歩うろつく。
    // （以前は60回のうち20回、ふつうの速さの0.4倍で歩き、脚を動かしながら3秒で半タイルも進まず、足踏みして見えていた）
    c.act = c.actT % 60 < 40 ? 0 : 1;
    if (c.act === 1) {
      const j = DIR16[ih(c.id, this.step >> 4, 74) & 15];
      this.tryMove(c, j[0] * s.speed * 0.9, j[1] * s.speed * 0.9);
    }
  }
}

export function floorNear(this: Ecology, k: number): number {
  const m = this.w.map;
  for (const q of [k + m.w, k - m.w, k + 1, k - 1]) if (q >= 0 && q < m.solid.length && !m.solid[q] && !m.lava[q]) return q;
  return -1;
}

/** 横穴の次に掘るマス（掘り込んでいなければ -1） */
export function tunnelNext(this: Ecology, wr: Warren): number {
  const m = this.w.map;
  const d = wr.dir ?? -1;
  if (d < 0 || (wr.door ?? -1) < 0) return -1;
  return (wr.door as number) + [1, -1, m.w, -m.w][d] * ((wr.tun ?? 0) + 1);
}

/** 蓄えの目安（群れの数に応じて） */
export function storeGoal(this: Ecology, wr: Warren): number {
  return Math.min(300, 40 * Math.max(2, this.warrenMembers(wr).length));
}

/** 群れごと住処を捨てて、開いた自然の口へ向かう者 */
export function leaveWithGroup(this: Ecology, c: Cr): void {
  const s = SPEC[c.k];
  c.act = 1;
  const m = this.w.map;
  let ex = -1;
  let ey = -1;
  let bd = 1e18;
  for (let i = 0; i < m.mouths.length; i++) {
    if (m.mouths[i].kind !== 0 || !this.mouthOpen(i)) continue;
    const [mx, my] = this.mouthSpot(i);
    const d = sq(mx - c.x) + sq(my - c.y);
    if (d < bd) {
      bd = d;
      ex = mx;
      ey = my;
    }
  }
  // 口がふさがってしまったら、中にとどまる（近くの住処に加わる）
  if (ex < 0) {
    c.st = 0;
    return;
  }
  if (this.goTo(c, ex, ey, s.speed) || sq(ex - c.x) + sq(ey - c.y) < 30 * 30) this.exitCreature(c, 'abandoned');
}

/** 生きたまま外へ出ていく（保存則の収支に計上し、stats の exits に記録する） */
export function exitCreature(this: Ecology, c: Cr, reason: string): void {
  this.record('exits', { t: this.w.tick, k: c.k, reason, x: Math.round(c.x), y: Math.round(c.y) } as never);
  this.w.manaLeaked += c.mana;
  c.mana = 0;
  this.exported += c.body + c.food + c.units;
  if (c.gold > 0) {
    this.goldOut += c.gold;
    c.gold = 0;
  }
  this.dropBelongings(c);
  c.body = 0;
  c.food = 0;
  c.units = 0;
  this.paths.delete(c.id);
  c.dead = 2;
}

/**
 * 住処を捨てる（群れの出来事）。開いた地表の横穴があれば群れごと外へ去り、なければ中の別の場所へ移る。
 * reason：0 蓄えが尽きた、1 何度も襲われた、2 数が減った、3 竜が近くに住みついた
 */
export function abandonWarren(this: Ecology, wr: Warren, reason: number): boolean {
  const m = this.w.map;
  const members = this.warrenMembers(wr);
  const why = ['蓄えが尽きて', '何度も襲われて', '1匹になって', '竜を恐れて'][reason];
  const open = m.mouths.some((mo, i) => mo.kind === 0 && this.mouthOpen(i));
  const rec = (to: string) => this.record('settle', { t: this.w.tick, k: Kind.Kobold, id: wr.id, ev: 'abandon', reason: ['food', 'raids', 'alone', 'dragon'][reason], to, n: members.length, x: Math.round(wr.x), y: Math.round(wr.y) } as never);
  if (reason === 1 || reason === 3) this.koboldShun = Math.max(this.koboldShun, this.w.tick + DAY_TICKS_ECO * 2);
  if (!open) {
    const site = this.pickWarren(wr, [wr.x, wr.y], Ecology.KOBOLD_MIN_FOOD);
    if (site < 0) return false;
    rec('move');
    const nw = this.newWarren(site, 'move');
    nw.store = wr.store ?? 0;
    wr.store = 0;
    for (const c of members) {
      c.ref = nw.id;
      c.st = 0;
      c.hx = nw.x;
      c.hy = nw.y;
    }
    this.log(nw.x, nw.y, `{k:${Kind.Kobold}}の一団が${why}住処を捨て、別の場所へ移った`);
  } else {
    // 蓄えは皆で持てるだけ持って出る（持ちきれない分はその場の土へ）
    let st = wr.store ?? 0;
    for (const c of members) {
      const t = Math.min(st, SPEC[Kind.Kobold].cap - c.food);
      c.food += t;
      st -= t;
      c.st = 10;
      c.ref = 0;
      c.flee = 0;
    }
    this.deposit(wr.x, wr.y, st);
    wr.store = 0;
    rec('leave');
    this.log(wr.x, wr.y, `{k:${Kind.Kobold}}の一団が${why}住処を捨てて去った`);
  }
  this.traps = this.traps.filter((t) => t.w !== wr.id);
  wr.id = -1;
  return true;
}

/** 住処ごとに、次に掘る岩を決め、群れが増えたら子を産む。誰もいない住処は消える。立ち行かなくなった住処は捨てる */
/** 住処の横穴（入口から奥まで、まっすぐの並び）のマスか。掘り出した土を置く所から除く */
export function inWarrenTunnel(this: Ecology, k: number): boolean {
  const m = this.w.map;
  const x = k % m.w;
  const y = (k / m.w) | 0;
  for (const wr of this.warrens) {
    if (wr.id < 0) continue;
    const hk = this.tileOf(wr.x, wr.y);
    const d = wr.door ?? -1;
    if (k === hk || k === d) return true;
    if (d < 0 || hk < 0) continue;
    const ax = d % m.w;
    const ay = (d / m.w) | 0;
    const bx = hk % m.w;
    const by = (hk / m.w) | 0;
    if ((ax === bx && x === ax && y >= Math.min(ay, by) && y <= Math.max(ay, by)) || (ay === by && y === ay && x >= Math.min(ax, bx) && x <= Math.max(ax, bx))) return true;
  }
  return false;
}

export function updateWarrens(this: Ecology): void {
  const m = this.w.map;
  for (const wr of this.warrens) {
    if (wr.id < 0) continue;
    // 住処の奥が瓦礫や崩落で埋まっていたら、寝床を入口の側の開いたマスへ移す（埋まったままでは誰も奥へ入れず、蓄えを運び込めない）
    const hk0 = this.tileOf(wr.x, wr.y);
    if (hk0 >= 0 && m.solid[hk0]) {
      const d = wr.door ?? -1;
      let nk = -1;
      if (d >= 0) {
        const ax = d % m.w;
        const ay = (d / m.w) | 0;
        let x = hk0 % m.w;
        let y = (hk0 / m.w) | 0;
        while ((x !== ax || y !== ay) && nk < 0) {
          x += Math.sign(ax - x);
          y += Math.sign(ay - y);
          if (!m.solid[y * m.w + x]) nk = y * m.w + x;
        }
      }
      if (nk < 0) nk = this.floorNear(hk0);
      if (nk >= 0) {
        wr.x = (nk % m.w) * TILE + 8;
        wr.y = Math.floor(nk / m.w) * TILE + 8;
        wr.target = -1;
        wr.prog = 0;
      }
    }
    const members = this.warrenMembers(wr);
    if (!members.length) {
      this.record('settle', { t: this.w.tick, k: Kind.Kobold, id: wr.id, ev: 'empty', x: Math.round(wr.x), y: Math.round(wr.y) } as never);
      this.deposit(wr.x, wr.y, wr.store ?? 0);
      wr.store = 0;
      this.traps = this.traps.filter((t) => t.w !== wr.id);
      wr.id = -1;
      continue;
    }
    // 襲われた記憶は少しずつ薄れる
    if (this.step % 600 === 35 && (wr.raids ?? 0) > 0) wr.raids = (wr.raids ?? 0) - 1;
    // 蓄えが尽きた時を覚える
    if ((wr.store ?? 0) > 0) wr.empty = -1;
    else if ((wr.empty ?? -1) < 0) wr.empty = this.w.tick;
    // 立ち行かなくなったら、群れごと住処を捨てる
    let dragonNear = false;
    for (const o of this.list) if (o.k === Kind.Dragon && !o.dead && o.sp >= 1 && sq((o.hx || o.x) - wr.x) + sq((o.hy || o.y) - wr.y) < 30 * TILE * 30 * TILE) dragonNear = true;
    if (members.length >= 2) wr.alone = -1;
    else if ((wr.alone ?? -1) < 0) wr.alone = this.w.tick;
    // 1匹になっても、ゲーム内の1日は新しく来る仲間を待つ（来る者はいちばん小さな住処に加わる）
    const lonely = members.length < 2 && this.w.tick - (wr.alone as number) > DAY_TICKS_ECO;
    const reason = (wr.raids ?? 0) >= 4 ? 1 : dragonNear ? 3 : lonely ? 2 : (wr.empty ?? -1) >= 0 && this.w.tick - (wr.empty as number) > DAY_TICKS_ECO && members.every((c) => c.hungry > 0 || c.food < 10) ? 0 : -1;
    if (reason >= 0 && wr.hide !== 1 && this.abandonWarren(wr, reason)) continue;
    if (wr.target >= 0) {
      if (wr.prog === (wr.lastProg ?? 0)) wr.stall = (wr.stall ?? 0) + 50;
      else wr.stall = 0;
      wr.lastProg = wr.prog;
      if ((wr.stall ?? 0) > ((wr.dir ?? -1) >= 0 ? 6000 : 1500)) {
        wr.target = -1;
        wr.stall = 0;
        wr.dir = -1;
      }
    }
    // まず岩壁に横穴を掘り込み、その奥を住処にする
    const tn = this.tunnelNext(wr);
    if (wr.target < 0 && tn >= 0) {
      if (m.solid[tn] && !m.lava[tn]) {
        wr.target = tn;
        wr.prog = 0;
      } else wr.dir = -1;
    }
    if (wr.target < 0 && (wr.len < 30 || (this.onIsland(wr.x, wr.y) && wr.len < 90))) {
      const hx = Math.floor(wr.x / TILE);
      const hy = Math.floor(wr.y / TILE);
      const R = 3 + (wr.len >> 1);
      // 空洞の気配：近くに閉じた空洞があれば、その方へ掘りたがる
      const sk = this.windTarget(hx, hy, 50) ?? this.w.nearestSealed(hx, hy, 25);
      const mainPt = this.onIsland(wr.x, wr.y) ? this.nearestMain(hx, hy) : -1;
      let best = -1;
      let bv = -1e9;
      for (let i = 0; i < 60; i++) {
        const h = ih(wr.id, this.step, 75 + i);
        const x = hx + ((h & 255) % (2 * R + 1)) - R;
        const y = hy + (((h >>> 8) & 255) % (2 * R + 1)) - R;
        if (x < 3 || y < 3 || x >= m.w - 3 || y >= m.h - 3) continue;
        const k = y * m.w + x;
        if (!m.solid[k] || this.floorNear(k) < 0) continue;
        // 溶岩には掘り当てない
        let lavaNear = false;
        for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (m.lava[q]) lavaNear = true;
        if (lavaNear) continue;
        let v = -(Math.abs(x - hx) + Math.abs(y - hy)) * 3 + (h >>> 16) % 20;
        // 島の住処は、入口側の洞窟の気配（物音や風）の方へ掘りたがる
        if (mainPt >= 0) v -= (Math.abs(x - (mainPt % m.w)) + Math.abs(y - Math.floor(mainPt / m.w))) * 6;
        else if (sk >= 0) v -= (Math.abs(x - (sk % m.w)) + Math.abs(y - Math.floor(sk / m.w))) * 4;
        if (v > bv) {
          bv = v;
          best = k;
        }
      }
      wr.target = best;
      wr.prog = 0;
    }
    // 住処のそばでキノコを育てる（土の養分をキノコに移す。養分の総量は変わらない）
    if (this.step % 50 === 35 && members.length >= 2) this.farmFungus(wr);
    // 入口のまわりに罠を仕掛ける（2つまで。横穴を掘り終えてから）
    if ((wr.dir ?? -1) < 0 && this.step % 300 === 35 + (wr.id % 5) * 50 && this.traps.filter((t) => t.w === wr.id).length < 2) this.placeTrap(wr);
    // 子を産む：蓄えが目安の3割以上あるときだけ（増えてから飢えるのではなく、食べ物に合わせて増える）
    if (this.step % 600 === 35 && members.length >= 2 && this.counts[Kind.Kobold] < 16 && (wr.store ?? 0) >= Math.max(20, this.storeGoal(wr) * 0.3)) {
      const p = members[0];
      wr.store = (wr.store ?? 0) - 20;
      const ch = this.spawn(Kind.Kobold, p.x, p.y, 20, 0);
      ch.ref = wr.id;
    }
    // 増えすぎたら、若い者が分かれて中の別の場所に新しい住処を作る
    if (this.step % 600 === 335 && members.length >= 12 && (wr.store ?? 0) >= 40 && this.warrens.filter((o) => o.id >= 0).length < 3) {
      const site = this.pickWarren(undefined, [wr.x, wr.y], Ecology.KOBOLD_MIN_FOOD);
      if (site >= 0) {
        const nw = this.newWarren(site, 'split');
        const young = members.slice().sort((p, q) => q.id - p.id).slice(0, 4);
        for (const c of young) {
          c.ref = nw.id;
          c.st = 0;
        }
        const share = Math.floor((wr.store ?? 0) / 3);
        wr.store = (wr.store ?? 0) - share;
        nw.store = share;
        this.log(nw.x, nw.y, `{k:${Kind.Kobold}}の群れが分かれ、新しい住処を作った`);
      }
    }
  }
  this.warrens = this.warrens.filter((o) => o.id >= 0);
}

/** 住処のそばの暗く湿った床（決まった数マスの畑）で、土の養分をキノコに移して育てる */
/** 住処の畑のマス（住処のそばの決まった数マス：暗く、湿っているか横穴の中。最大3マス）。描画でも使う */
export function farmTiles(this: Ecology, wr: Warren): number[] {
  const m = this.w.map;
  const hx = Math.floor(wr.x / TILE);
  const hy = Math.floor(wr.y / TILE);
  const out: number[] = [];
  for (let i = 0; i < 24 && out.length < 3; i++) {
    const h = ih(wr.id, i, 230);
    const x = hx + (h % 9) - 4;
    const y = hy + ((h >>> 8) % 9) - 4;
    if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.lava[k] || m.sealed[k] || this.w.water[k] > 30 || this.w.lightBase[k] > 100) continue;
    // 掘った横穴の中と入口のまわりは、地中の湿り気がある扱い（湿り気の値は書き換えない）
    if (this.w.moist[k] < 40 && !this.underground(wr, k)) continue;
    out.push(k);
  }
  return out;
}

/** 住処のそばの畑で、土の養分をキノコに移して育てる */
export function farmFungus(this: Ecology, wr: Warren): void {
  const m = this.w.map;
  for (const k of this.farmTiles(wr)) {
    if (this.w.fungus[k] >= 160) continue;
    let got = 0;
    for (const q of [k, k + 1, k - 1, k + m.w, k - m.w, k + 2, k - 2, k + 2 * m.w, k - 2 * m.w]) {
      if (got >= 6 || q < 0 || q >= m.solid.length || m.solid[q] || m.lava[q]) continue;
      const t = Math.min(6 - got, this.w.nutr[q]);
      this.w.nutr[q] -= t;
      got += t;
    }
    if (got > 0) {
      this.w.fungus[k] = Math.min(255, this.w.fungus[k] + got);
      this.mossTouched = true;
    }
  }
}

/**
 * 住処へ向かう道中（st 11）：冒険者が8マス以内にいれば、その場の暗がりに身をひそめて待つ（st 12。すぐそばまで来られない限り気づかれない）。
 * 10マスより離れたら進む。住処に着いたら（3マス）ふだんの暮らしへ。ひどく腹が減ったら道中をやめて食べ物を探す。true なら今は道中
 */
export function koboldTransit(this: Ecology, c: Cr): boolean {
  const wr = this.warrenOf(c);
  if (!wr || c.hungry > 600 || sq(wr.x - c.x) + sq(wr.y - c.y) < 3 * TILE * 3 * TILE) {
    c.st = 0;
    return false;
  }
  let nd = 1e18;
  this.nearby(c.x, c.y, 10, (o) => {
    if (o.dead || o.away || o.k !== Kind.Adventurer) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < nd) nd = d;
  });
  if (nd < 8 * TILE * 8 * TILE || (c.st === 12 && nd < 10 * TILE * 10 * TILE)) {
    // すぐそばまで来られたら、隠れていられない（ふだんの逃げ方に任せる）
    if (nd < 1.5 * TILE * 1.5 * TILE) {
      c.st = 11;
      return false;
    }
    c.st = 12;
    c.act = 0;
    return true;
  }
  c.st = 11;
  c.act = 1;
  this.goTo(c, wr.x, wr.y, SPEC[Kind.Kobold].speed);
  return true;
}

/** 住処の横穴の中（掘ったマス）か、入口から2マス以内か */
export function underground(this: Ecology, wr: Warren, k: number): boolean {
  const m = this.w.map;
  const d = wr.door ?? -1;
  if (d >= 0 && Math.abs((k % m.w) - (d % m.w)) + Math.abs(Math.floor(k / m.w) - Math.floor(d / m.w)) <= 2) return true;
  return m.dug[k] === 1 && sq((k % m.w) * TILE + 8 - wr.x) + sq(Math.floor(k / m.w) * TILE + 8 - wr.y) < 6 * TILE * 6 * TILE;
}

/** 住処の入口から2〜3マスの、横穴の外の床に罠を仕掛ける */
export function placeTrap(this: Ecology, wr: Warren): void {
  const m = this.w.map;
  const d = wr.door ?? -1;
  if (d < 0) return;
  const dx0 = d % m.w;
  const dy0 = Math.floor(d / m.w);
  for (let i = 0; i < 12; i++) {
    const h = ih(wr.id, this.step, 240 + i);
    const x = dx0 + (h % 7) - 3;
    const y = dy0 + ((h >>> 8) % 7) - 3;
    const r = Math.abs(x - dx0) + Math.abs(y - dy0);
    if (r < 2 || r > 3 || x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
    const k = y * m.w + x;
    // 横穴の中（掘ったマス）には置かず、入口の外の床に置く
    if (m.solid[k] || m.lava[k] || m.sealed[k] || m.dug[k] || this.w.water[k] > 20 || this.traps.some((t) => t.k === k)) continue;
    this.traps.push({ id: this.nextId++, k, w: wr.id });
    return;
  }
}

/** 罠：冒険者が踏むと傷を負い、罠は消える（生き物の更新ごと） */
export function checkTraps(this: Ecology): void {
  if (!this.traps.length) return;
  const m = this.w.map;
  for (const t of this.traps) {
    const x = (t.k % m.w) * TILE + 8;
    const y = Math.floor(t.k / m.w) * TILE + 8;
    let hit: Cr | null = null;
    this.nearby(x, y, 0, (o) => {
      if (!hit && !o.dead && o.k === Kind.Adventurer) hit = o;
    });
    if (!hit) continue;
    const c = hit as Cr;
    const mx = this.maxHp(c);
    if (c.hp <= 0) c.hp = mx;
    c.hp = Math.max(1, c.hp - mx * 0.35);
    c.hitAt = this.w.tick;
    this.bleed(c, 2);
    this.noise(x, y, 7);
    this.markNotice(c, c, '!');
    if (this.step - (this.lastLogged[996] ?? -99999) > 1500) {
      this.lastLogged[996] = this.step;
      this.log(x, y, `冒険者が{k:${Kind.Kobold}}の罠を踏んで傷を負った`);
    }
    t.id = -1;
  }
  this.traps = this.traps.filter((t) => t.id >= 0);
}

/**
 * 住処の見張り（生き物の更新10回ごと）：冒険者の一行が近づき、群れより明らかに強ければ奥に隠れる。
 * 隠れているところを見つかったら（入口に踏み込まれたら）、皆で深い方へ逃げる。一行が離れたら隠れるのをやめる
 */
export function watchWarrens(this: Ecology): void {
  for (const wr of this.warrens) {
    if (wr.id < 0) continue;
    // 近づいてくる強い相手：冒険者の一行、若い竜と成竜、トロール、ミノタウロス
    let near: Cr | null = null;
    let nd = 1e18;
    let threat = 0;
    for (const p of this.parties)
      for (const id of p.members) {
        const a = this.byId.get(id);
        if (!a || a.dead || a.away) continue;
        const d = sq(a.x - wr.x) + sq(a.y - wr.y);
        if (d < nd) {
          nd = d;
          near = a;
          threat = this.partyStr(p);
        }
      }
    this.nearby(wr.x, wr.y, 14, (o) => {
      if (o.dead || o.away || !((o.k === Kind.Dragon && o.sp >= 1) || o.k === Kind.Troll || o.k === Kind.Minotaur)) return;
      const d = sq(o.x - wr.x) + sq(o.y - wr.y);
      if (d < nd) {
        nd = d;
        near = o;
        threat = this.str(o);
      }
    });
    if (!near || nd > 16 * TILE * 16 * TILE) {
      wr.hide = 0;
      continue;
    }
    const members = this.warrenMembers(wr);
    const mine = members.reduce((a, c) => a + this.str(c), 0);
    if (wr.hide !== 1 && nd < 12 * TILE * 12 * TILE && threat > mine * 1.5) {
      wr.hide = 1;
      if (this.step - (this.lastLogged[995] ?? -99999) > 3000) {
        this.lastLogged[995] = this.step;
        this.log(wr.x, wr.y, (near as Cr).k === Kind.Adventurer ? `{k:${Kind.Kobold}}たちが冒険者の気配に、住処の奥へ身をひそめた` : `{k:${Kind.Kobold}}たちが{k:${(near as Cr).k}}の気配に、住処の奥へ身をひそめた`);
      }
      continue;
    }
    if (wr.hide === 1) {
      const a = near as Cr;
      const found = members.some((c) => c.st === 7 && this.isHidden(c) && this.atDoorOf(a, c));
      if (found) {
        wr.hide = 0;
        wr.raids = (wr.raids ?? 0) + 1;
        for (const c of members) {
          c.st = 0;
          c.flee = 150 + (ih(c.id, this.step, 231) % 60);
          c.foe = a.id;
          // 住みかへ逃げ帰らず、相手から離れる方へ（深い方へ）
          c.hx = 0;
          c.hy = 0;
        }
        this.log(wr.x, wr.y, `隠れていた{k:${Kind.Kobold}}たちが見つかり、奥へ逃げ散った`);
      }
    }
  }
}

declare module '../ecology' {
  interface Ecology {
    pickWarren: typeof pickWarren;
    walkDist: typeof walkDist;
    warrenFood: typeof warrenFood;
    checkKoboldMouths: typeof checkKoboldMouths;
    tunnelDir: typeof tunnelDir;
    newWarren: typeof newWarren;
    warrenMembers: typeof warrenMembers;
    isHidden: typeof isHidden;
    atDoorOf: typeof atDoorOf;
    warrenOf: typeof warrenOf;
    kobold: typeof kobold;
    floorNear: typeof floorNear;
    tunnelNext: typeof tunnelNext;
    storeGoal: typeof storeGoal;
    inWarrenTunnel: typeof inWarrenTunnel;
    leaveWithGroup: typeof leaveWithGroup;
    exitCreature: typeof exitCreature;
    abandonWarren: typeof abandonWarren;
    updateWarrens: typeof updateWarrens;
    farmTiles: typeof farmTiles;
    farmFungus: typeof farmFungus;
    koboldTransit: typeof koboldTransit;
    underground: typeof underground;
    placeTrap: typeof placeTrap;
    checkTraps: typeof checkTraps;
    watchWarrens: typeof watchWarrens;
  }
}

Object.assign(Ecology.prototype, { pickWarren, walkDist, warrenFood, checkKoboldMouths, tunnelDir, newWarren, warrenMembers, isHidden, atDoorOf, warrenOf, kobold, floorNear, tunnelNext, storeGoal, inWarrenTunnel, leaveWithGroup, exitCreature, abandonWarren, updateWarrens, farmTiles, farmFungus, koboldTransit, underground, placeTrap, checkTraps, watchWarrens });
