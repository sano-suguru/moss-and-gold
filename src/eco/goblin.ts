/** Ecology のメソッド：ゴブリン（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/**
 * 集落の候補のまわりの食べ物。ゴブリンは狩りと死骸あさりで広く動くので、コボルト（8マス）より広く数える：
 * 14マス以内の食べられる苔とキノコ（20以上の群落の、根元12を除いた分）の半分、16マス以内のネズミ1匹あたり100、死骸の残り
 */
export function campFood(this: Ecology, k: number): number {
  const m = this.w.map;
  const x0 = k % m.w;
  const y0 = Math.floor(k / m.w);
  let f = 0;
  for (let y = Math.max(1, y0 - 14); y <= Math.min(m.h - 2, y0 + 14); y++)
    for (let x = Math.max(1, x0 - 14); x <= Math.min(m.w - 2, x0 + 14); x++) {
      const q = y * m.w + x;
      if (m.solid[q] || m.sealed[q]) continue;
      const v = Math.max(this.w.moss[q], this.w.fungus[q]);
      if (v >= 20) f += (v - 12) >> 1;
    }
  this.nearby(x0 * TILE + 8, y0 * TILE + 8, 16, (o) => {
    if (o.k === Kind.Rat && !o.dead) f += 100;
    else if (o.dead === 1 && o.units > 0) f += o.units;
  });
  return f;
}

export function pickGoblinCamp(this: Ecology, avoid?: Camp, from?: [number, number], minFood = 0): number {
  const m = this.w.map;
  let best = -1;
  let bv = -1e9;
  const par = from ? new Int32Array(m.w * m.h) : null;
  const dist = from ? this.walkDist(this.tileOf(from[0], from[1]), 100, par as Int32Array) : null;
  const reach: number[] = [];
  if (dist) for (let q = 0; q < dist.length; q++) if (dist[q] >= 0) reach.push(q);
  if (dist && !reach.length) return -1;
  const route = this.routeDist(45);
  const danger: [number, number, number][] = [];
  for (const o of this.list) {
    if (o.dead || o.away) continue;
    if (o.k === Kind.Dragon) danger.push([o.hx || o.x, o.hy || o.y, 30]);
    else if (o.k === Kind.Troll || o.k === Kind.Basilisk) danger.push([o.hx || o.x, o.hy || o.y, 15]);
  }
  if (this.dragonShell) danger.push([this.dragonShell.x, this.dragonShell.y, 30]);
  // 安く調べられる条件で先に絞り、残った候補から選ぶ（条件を満たす所が少なくても取りこぼさないように）
  const cand: number[] = [];
  const pool = dist ? reach.length : 2000;
  for (let i = 0; i < pool; i++) {
    const k = dist ? reach[i] : ih(this.step, i, 90) % (m.w * m.h);
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.lightBase[k] > 60 || m.maze[k]) continue;
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    if (Math.abs(x - m.entrance.x) + y < 15) continue;
    // 通り道から15マスより近い所には住まない（40マスより遠い所は点を下げる）
    if (route[k] >= 0 && route[k] < 15) continue;
    // コボルトの住処から15マス（コボルトが住処を守る範囲12マスの外に集落の真ん中を置く。10マスでは集落ごと縄張りの中に入り、群れで食べられていた）
    if (this.warrens.some((o) => o.id >= 0 && Math.abs(o.x / TILE - x) + Math.abs(o.y / TILE - y) < 15)) continue;
    if (this.camps.some((o) => o.id >= 0 && o !== avoid && Math.abs(o.x / TILE - x) + Math.abs(o.y / TILE - y) < 30)) continue;
    if (avoid && Math.abs(avoid.x / TILE - x) + Math.abs(avoid.y / TILE - y) < 20) continue;
    const px = x * TILE + 8;
    const py = y * TILE + 8;
    if (danger.some(([dx, dy, r]) => sq(dx - px) + sq(dy - py) < r * TILE * r * TILE)) continue;
    if (this.presenceAt(px, py) > 0.5) continue;
    cand.push(k);
  }
  if (!cand.length) return -1;
  for (let i = 0; i < Math.min(160, cand.length); i++) {
    const k = cand.length <= 160 ? cand[i] : cand[ih(this.step, i, 91) % cand.length];
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    const px = x * TILE + 8;
    const py = y * TILE + 8;
    const rd = route[k];
    if (minFood > 0 && this.campFood(k) < minFood) continue;
    const pres = this.presenceAt(px, py);
    // 出発点からの道筋の人の気配（コボルトと同じ）
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
    const v = f + rats * 80 - pres * 1500 - busy * 60 - (rd < 0 || rd > 40 ? 400 : 0) - this.w.lightBase[k] * 4 + (ih(k, 2, 90) % 200);
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

/** 冒険者の通り道（人の気配が0.5より濃い区画の床）から歩いた道のり（max マスまで。届かなければ -1） */
export function routeDist(this: Ecology, max: number): Int32Array {
  const m = this.w.map;
  const N = m.w * m.h;
  const dist = new Int32Array(N).fill(-1);
  if (this.wdQ.length !== N) this.wdQ = new Int32Array(N);
  const q = this.wdQ;
  let h = 0;
  let t = 0;
  for (let k = 0; k < N; k++) {
    if (m.solid[k] || m.lava[k] || m.sealed[k]) continue;
    if (this.presenceAt((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8) > 0.5) {
      dist[k] = 0;
      q[t++] = k;
    }
  }
  while (h < t) {
    const c = q[h++];
    if (dist[c] >= max) continue;
    for (let d = 0; d < 4; d++) {
      const n = d === 0 ? c + 1 : d === 1 ? c - 1 : d === 2 ? c + m.w : c - m.w;
      if (n < 0 || n >= N || dist[n] >= 0 || m.solid[n] || m.lava[n] || m.sealed[n]) continue;
      dist[n] = dist[c] + 1;
      q[t++] = n;
    }
  }
  return dist;
}

/**
 * ゴブリンが新しく集落を作りにその横穴から入ってこられるかを、生き物の更新600回ごとに判定し直す（`gobMouthOk`）。
 * 1：横穴から歩いて行ける範囲に、食べ物の足りる（`GOBLIN_MIN_FOOD` 以上）集落の場所がある。
 * 2：足りる場所は無いが、貧しい場所（`GOBLIN_POOR_FOOD` 以上）ならある。少ない群れ（`GOBLIN_POOR_BAND` 匹）が住みつき、蓄えが乏しいので焚き火へ盗みに出やすい。
 * 0：開いていない、竜の寝床が近い、または住める場所が無い。
 */
export function checkGoblinMouths(this: Ecology): void {
  const m = this.w.map;
  this.gobMouthOk = m.mouths.map((mo, i) => {
    if (mo.kind !== 0 || !this.mouthOpen(i) || this.dragonNearMouth(i)) return 0;
    if (this.pickGoblinCamp(undefined, this.mouthSpot(i), Ecology.GOBLIN_MIN_FOOD) >= 0) return 1;
    return this.pickGoblinCamp(undefined, this.mouthSpot(i), Ecology.GOBLIN_POOR_FOOD) >= 0 ? 2 : 0;
  });
}

export function newCamp(this: Ecology, k: number, how: string, store = 0, poor = false): Camp {
  const m = this.w.map;
  const x = (k % m.w) * TILE + 8;
  const y = Math.floor(k / m.w) * TILE + 8;
  this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: this.nextId, ev: 'found', how, x, y, ...(store ? { store } : {}), ...(poor ? { poor: 1 } : {}) } as never);
  const cp: Camp = { id: this.nextId++, kind: 0, x, y, dry: 0, fuel: 0, store, hide: 0, raids: 0, empty: -1, alone: -1, poor: poor ? 1 : 0 };
  this.camps.push(cp);
  return cp;
}

/** 集落の仲間（去っていく途中の者は除く） */
export function campMembers(this: Ecology, cp: Camp): Cr[] {
  return this.list.filter((c) => c.k === Kind.Goblin && !c.dead && c.ref === cp.id && c.st !== 9 && c.st !== 10);
}

/** 集落にゴブリンの頭がいるか */
export function campChief(this: Ecology, cp: Camp): boolean {
  return this.list.some((c) => c.k === Kind.Goblin && c.elite === 5 && !c.dead && c.ref === cp.id);
}

/** 蓄えの目安（群れの数に応じて） */
export function campStoreGoal(this: Ecology, cp: Camp): number {
  return Math.min(300, 30 * Math.max(2, this.campMembers(cp).length));
}

/** 散って隠れているゴブリン（集落のまわりの暗がりで身をひそめている。灯りに照らされず、すぐそばまで来られない限り、誰にも気づかれない） */
export function goblinHidden(this: Ecology, o: Cr): boolean {
  if (o.dead || o.st !== 7) return false;
  const cp = this.campOf(o);
  if (!cp || cp.kind !== 0 || cp.hide !== 1) return false;
  if (sq(o.x - cp.x) + sq(o.y - cp.y) > 9 * TILE * 9 * TILE) return false;
  return !this.isLit(o);
}

/** 隠れ場所：集落から4〜7マスの、暗い床（ひとりずつ違う所。見つからなければ集落の真ん中） */
export function hideSpot(this: Ecology, cp: Camp, c: Cr): [number, number] {
  const m = this.w.map;
  for (let i = 0; i < 8; i++) {
    const a = ((c.id * 2.399 + i * 0.785) % 6.283);
    const r = 4 + ((c.id + i) % 4);
    const x = Math.floor(cp.x / TILE + Math.cos(a) * r);
    const y = Math.floor(cp.y / TILE + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.lava[k] || m.sealed[k] || this.w.water[k] > 20 || this.w.lightBase[k] > 40) continue;
    return [x * TILE + 8, y * TILE + 8];
  }
  return [cp.x, cp.y];
}

/**
 * 集落を捨てる（群れの出来事）。開いた地表の横穴があれば群れごと外へ去り、なければ中の別の場所へ移る。
 * reason：0 蓄えが尽きた、1 何度も襲われた、2 数が減った、3 竜が近くに住みついた
 */
export function abandonCamp(this: Ecology, cp: Camp, reason: number): boolean {
  const m = this.w.map;
  const members = this.campMembers(cp);
  const why = ['蓄えが尽きて', '何度も襲われて', '1匹になって', '竜を恐れて'][reason];
  const open = m.mouths.some((mo, i) => mo.kind === 0 && this.mouthOpen(i));
  const rec = (to: string) => this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'abandon', reason: ['food', 'raids', 'alone', 'dragon'][reason], to, n: members.length, x: Math.round(cp.x), y: Math.round(cp.y) } as never);
  if (reason === 1 || reason === 3) this.goblinShun = Math.max(this.goblinShun, this.w.tick + DAY_TICKS_ECO * 2);
  // 貧しい集落を食べ物が尽きて捨てたら、外の噂で1日はゴブリンが来ない（同じ貧しい場所に、次の少ない群れがすぐ住みついては去る繰り返しを止める）
  if (reason === 0 && cp.poor === 1) this.goblinShun = Math.max(this.goblinShun, this.w.tick + DAY_TICKS_ECO);
  if (!open) {
    const site = this.pickGoblinCamp(cp, [cp.x, cp.y], Ecology.GOBLIN_MIN_FOOD);
    if (site < 0) return false;
    rec('move');
    const nc = this.newCamp(site, 'move');
    nc.store = cp.store ?? 0;
    cp.store = 0;
    for (const c of members) {
      c.ref = nc.id;
      c.st = 0;
    }
    this.log(nc.x, nc.y, `{k:${Kind.Goblin}}の一団が${why}集落を捨て、別の場所へ移った`);
  } else {
    let st = cp.store ?? 0;
    for (const c of members) {
      const t = Math.min(st, SPEC[Kind.Goblin].cap - c.food);
      c.food += t;
      st -= t;
      c.st = 10;
      c.ref = 0;
      c.flee = 0;
      c.lure = 0;
    }
    this.deposit(cp.x, cp.y, st);
    cp.store = 0;
    rec('leave');
    this.log(cp.x, cp.y, `{k:${Kind.Goblin}}の一団が${why}集落を捨てて去った`);
  }
  if ((cp.fuel ?? 0) > 0) this.deposit(cp.x, cp.y + 10, cp.fuel as number);
  cp.fuel = 0;
  cp.id = -1;
  return true;
}

/**
 * 集落の見張り（生き物の更新10回ごと）：冒険者の一行、若い竜と成竜、トロール、ミノタウロスが近づくと、
 * 群れより明らかに強ければ暗がりに散って隠れ（hide 1）、一行が弱ければ暗がりで待ち伏せる（hide 2）。
 * 隠れているのを見つかったり、待ち伏せで負けそうになったら、皆で深い方へ逃げ散る（一行が去れば戻る）
 */
export function watchCamps(this: Ecology): void {
  for (const cp of this.camps) {
    if (cp.id < 0 || cp.kind !== 0) continue;
    let near: Cr | null = null;
    let nd = 1e18;
    let threat = 0;
    let party = false;
    for (const p of this.parties)
      for (const id of p.members) {
        const a = this.byId.get(id);
        if (!a || a.dead || a.away) continue;
        const d = sq(a.x - cp.x) + sq(a.y - cp.y);
        if (d < nd) {
          nd = d;
          near = a;
          threat = this.partyStr(p);
          party = true;
        }
      }
    this.nearby(cp.x, cp.y, 14, (o) => {
      if (o.dead || o.away || !((o.k === Kind.Dragon && o.sp >= 1) || o.k === Kind.Troll || o.k === Kind.Minotaur)) return;
      const d = sq(o.x - cp.x) + sq(o.y - cp.y);
      if (d < nd) {
        nd = d;
        near = o;
        threat = this.str(o);
        party = false;
      }
    });
    if (!near || nd > 18 * TILE * 18 * TILE) {
      cp.hide = 0;
      continue;
    }
    const a = near as Cr;
    const members = this.campMembers(cp);
    const mine = members.reduce((s, c) => s + (c.flee > 0 ? 0 : this.str(c)), 0);
    const bold = this.campChief(cp);
    // 待ち伏せのさなかに負けそうになったら、皆で逃げ散る
    if (cp.hide === 2 && threat > mine * (bold ? 2 : 1.5)) {
      this.scatterCamp(cp, members, a, `待ち伏せていた{k:${Kind.Goblin}}たちが劣勢になり、奥へ逃げ散った`);
      continue;
    }
    if (cp.hide === 1) {
      const found = members.some((c) => c.st === 7 && this.goblinHidden(c) === false && sq(c.x - cp.x) + sq(c.y - cp.y) < 9 * TILE * 9 * TILE && sq(c.x - a.x) + sq(c.y - a.y) < 3 * TILE * 3 * TILE) || members.some((c) => c.st === 7 && this.goblinHidden(c) && this.atDoorOf(a, c));
      // 集落を退治しに来た一行は、松明を掲げて照らし、光の届く範囲（5.5マス）の隠れた者を見つける（光の縁で目が光り、見つかった者が逃げ出す）
      let lit: Cr | null = null;
      if (!found)
        for (const p of this.parties) {
          if (!this.huntsCamp(p, cp.id)) continue;
          lit = members.find((c) => c.st === 7 && this.inPartyLight(p, c)) ?? null;
          if (lit) {
            this.fxMarks.push({ t: this.w.tick, id: lit.id, m: '!' });
            this.partyMark(p, '!', false);
            this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'reveal', n: cp.id, x: Math.round(lit.x), y: Math.round(lit.y) } as never);
            break;
          }
        }
      if (found || lit) this.scatterCamp(cp, members, a, lit ? `松明の光の縁で、隠れていた{k:${Kind.Goblin}}の目が光った。見つかった{k:${Kind.Goblin}}たちが奥へ逃げ散った` : `隠れていた{k:${Kind.Goblin}}たちが見つかり、奥へ逃げ散った`);
      continue;
    }
    if (nd > 13 * TILE * 13 * TILE) continue;
    if (threat > mine * (bold ? 2 : 1.5)) {
      cp.hide = 1;
      if (this.step - (this.lastLogged[989] ?? -99999) > 3000) {
        this.lastLogged[989] = this.step;
        this.log(cp.x, cp.y, a.k === Kind.Adventurer ? `{k:${Kind.Goblin}}たちが冒険者の気配に、集落のまわりの暗がりへ散って隠れた` : `{k:${Kind.Goblin}}たちが{k:${a.k}}の気配に、暗がりへ散って隠れた`);
      }
    } else if (party && cp.hide !== 2 && threat <= mine * (bold ? 1.3 : 1)) {
      // 一行が弱ければ、灯りのまわりの暗がりに潜んで、集落に踏み込むのを待つ
      cp.hide = 2;
      for (const c of members) {
        if (c.flee > 0 || c.sleep > 0 || c.st === 7) continue;
        c.lure = a.id;
        c.lureAt = this.step;
      }
      if (this.step - (this.lastLogged[988] ?? -99999) > 3000) {
        this.lastLogged[988] = this.step;
        this.log(cp.x, cp.y, `{k:${Kind.Goblin}}たちが、近づく冒険者を暗がりで待ち伏せている`);
      }
    }
  }
}

/** 集落の皆が、相手から離れる方（深い方）へ逃げ散る。近ごろ襲われた回数に数える */
export function scatterCamp(this: Ecology, cp: Camp, members: Cr[], a: Cr, msg: string): void {
  cp.hide = 0;
  cp.raids = (cp.raids ?? 0) + 1;
  for (const c of members) {
    c.st = 0;
    c.lure = 0;
    c.flee = 150 + (ih(c.id, this.step, 233) % 60);
    c.foe = a.id;
    c.hx = 0;
    c.hy = 0;
  }
  this.log(cp.x, cp.y, msg);
}

/** コボルトの住処の縄張り（住処から12マス、コボルトが住処を守る範囲）の中か。ゴブリンは食べ物を探すとき、ここを目当てにしない */
export function inKoboldLand(this: Ecology, x: number, y: number): boolean {
  for (const wr of this.warrens) if (wr.id >= 0 && sq(wr.x - x) + sq(wr.y - y) < 12 * TILE * 12 * TILE) return true;
  return false;
}

/** ゴブリンの死骸あさり：R マス以内の死骸（コボルトの縄張りの外）へ行き、その場で食べ、余りを持つ（eat の食べ残し units）。true なら今そうしている */
export function goblinCarrion(this: Ecology, c: Cr, R: number): boolean {
  let best: Cr | null = null;
  let bd = R * TILE * R * TILE;
  for (const o of this.corpses) {
    if (o.dead !== 1 || o.units <= 0 || o.k === Kind.Goblin) continue;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d >= bd || this.inKoboldLand(o.x, o.y) || this.fireNear(o.x, o.y)) continue;
    bd = d;
    best = o;
  }
  if (!best) return false;
  const o = best as Cr;
  c.act = 1;
  if (bd < 11 * 11) {
    this.eat(c, o);
    c.act = 2;
    c.actT = 0;
  } else this.goTo(c, o.x, o.y, SPEC[c.k].speed);
  return true;
}

/** 集落のまわり（R マス四方）で、ゴブリン c がいちばん行きやすい、食べられる苔かキノコ（20以上）のマス。なければ -1 */
export function goblinForage(this: Ecology, c: Cr, cx: number, cy: number, R: number): number {
  const m = this.w.map;
  const x0 = Math.floor(cx / TILE);
  const y0 = Math.floor(cy / TILE);
  const gx = c.x / TILE;
  const gy = c.y / TILE;
  let best = -1;
  let bv = -1e9;
  for (let y = Math.max(1, y0 - R); y <= Math.min(m.h - 2, y0 + R); y++)
    for (let x = Math.max(1, x0 - R); x <= Math.min(m.w - 2, x0 + R); x++) {
      const k = y * m.w + x;
      if (m.solid[k] || m.lava[k] || m.sealed[k]) continue;
      const f = Math.max(this.w.moss[k], this.w.fungus[k]);
      if (f < 20 || this.inKoboldLand(x * TILE + 8, y * TILE + 8)) continue;
      const v = Math.min(30, f - 12) - (Math.abs(x - gx) + Math.abs(y - gy)) * 4;
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
  return best;
}

export function campOf(this: Ecology, c: Cr): Camp | undefined {
  return this.camps.find((o) => o.id === c.ref);
}

export function goblin(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Goblin];
  if (c.st === 10) {
    this.leaveWithGroup(c);
    return;
  }
  const camp = this.campOf(c);
  // 集落のある者は一匹で見切りをつけない（集落ごと捨てるのは群れの出来事：updateCamps）。集落のない者だけが飢えて去る
  if (!camp && this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 4) return;
  if (camp) {
    // 散って隠れる：集落のまわりの暗がりで身をひそめる（蓄えから食べる。蓄えが尽きて飢えれば、こっそり食べ物を探しに出る）
    const d2 = sq(camp.x - c.x) + sq(camp.y - c.y);
    if (camp.hide === 1 && c.hungry && (camp.store ?? 0) > 0 && d2 < 10 * TILE * 10 * TILE) {
      const t = Math.min(camp.store ?? 0, Math.floor(s.cap * 0.7) - c.food);
      camp.store = (camp.store ?? 0) - t;
      c.food += t;
      c.hungry = 0;
      c.sinceMeal = 0;
    }
    if (camp.hide === 1 && !(c.hungry > 300 && (camp.store ?? 0) <= 0) && (c.st === 7 || d2 < 10 * TILE * 10 * TILE)) {
      c.st = 7;
      const [hx, hy] = this.hideSpot(camp, c);
      if (sq(hx - c.x) + sq(hy - c.y) > 0.6 * TILE * 0.6 * TILE) {
        c.act = 1;
        this.goTo(c, hx, hy, s.speed * 1.2);
      } else c.act = 0;
      return;
    }
    if (c.st === 7) c.st = 0;
    // 腹を空かせた者は、集落の蓄えから食べる
    if ((camp.store ?? 0) > 0 && (c.hungry || c.food < s.cap * 0.15)) {
      if (d2 < 2 * TILE * 2 * TILE) {
        const t = Math.min(camp.store ?? 0, Math.floor(s.cap * 0.7) - c.food);
        if (t > 0) {
          camp.store = (camp.store ?? 0) - t;
          c.food += t;
          c.hungry = 0;
          c.sinceMeal = 0;
          c.act = 2;
          c.actT = 0;
          c.st = 0;
          return;
        }
      } else if (d2 < 30 * TILE * 30 * TILE) {
        c.act = 1;
        this.goTo(c, camp.x, camp.y, s.speed);
        return;
      }
    }
    // 蓄えを運び込む：腹が満ちた者（狩った獲物、拾った死骸、盗んだ食料）は、余りと持ち帰った食べ残しを集落に置く
    if ((c.food > s.cap * 0.75 || c.units > 0) && d2 < 2 * TILE * 2 * TILE && (camp.store ?? 0) < this.campStoreGoal(camp)) {
      const t = Math.max(0, c.food - Math.floor(s.cap * 0.5)) + c.units;
      c.food -= t - c.units;
      c.units = 0;
      camp.store = (camp.store ?? 0) + t;
      c.act = 2;
      c.actT = 0;
      if (c.st === 4) c.st = 0;
      return;
    }
    // 腹いっぱいの者と、食べ残しを持っている者は、蓄えが足りなければ集落へ持ち帰る
    if ((c.food > s.cap * 0.75 || (c.units >= 6 && c.st !== 4) || c.units >= 20) && d2 < 30 * TILE * 30 * TILE && (camp.store ?? 0) < this.campStoreGoal(camp) && c.gold <= 0) {
      c.act = 1;
      this.goTo(c, camp.x, camp.y, s.speed);
      return;
    }
    // 食べ物を集めに出る：蓄えが足りなければ、何匹かが交代で狩りと死骸あさりに出て、腹いっぱいにして帰る
    if (c.st === 0 && !c.hungry && c.units === 0 && (camp.store ?? 0) < this.campStoreGoal(camp) && ih(c.id, this.step >> 7, 77) % 3 === 0) c.st = 4;
  }
  if ((!c.hungry || c.st === 4) && this.scavenge(c)) return;
  // 見つけた金貨を集落へ持ち帰って山にする
  if (camp && !c.hungry && c.st !== 4) {
    if (c.gold > 0) {
      c.act = 1;
      if (sq(camp.x - c.x) + sq(camp.y - c.y) < 18 * 18 || this.goTo(c, camp.x + 12, camp.y + 8, s.speed)) {
        this.dropGold(camp.x + 12, camp.y + 8, c.gold, this.ownerNote(c, 'stash'));
        c.gold = 0;
      }
      return;
    }
    if (this.step % 20 === c.id % 20) {
      const m = this.w.map;
      const pile = this.piles.find((p) => sq(p.x - c.x) + sq(p.y - c.y) < 5 * TILE * 5 * TILE && !m.vault[this.tileOf(p.x, p.y)] && sq(p.x - camp.x - 12) + sq(p.y - camp.y - 8) > 30 * 30);
      if (pile) c.ref2 = -pile.id;
    }
    if (c.ref2 < 0) {
      const pile = this.piles.find((p) => p.id === -c.ref2);
      if (!pile) c.ref2 = 0;
      else {
        c.act = 1;
        if (sq(pile.x - c.x) + sq(pile.y - c.y) < 12 * 12) {
          const t = Math.min(10, pile.gold);
          pile.gold -= t;
          c.gold += t;
          c.ref2 = 0;
          this.piles = this.piles.filter((o) => o.gold > 0);
        } else this.goTo(c, pile.x, pile.y, s.speed);
        return;
      }
    }
  }
  const cp = this.campOf(c);
  // 縄張りを守る：コボルト、畑に来たアリ（オークは従う相手なので襲わない）
  if (cp && this.defend(c, cp.x, cp.y, [Kind.Kobold, Kind.Ant, Kind.Dwarf])) return;
  if (c.st === 3 && c.food >= s.cap * 0.7) c.st = 0;
  if (c.hungry || c.st === 3 || c.st === 4) {
    // 狩りに出た者も、腹を空かせたら自分が食べるほうを先にする（苔とキノコも食べる）
    if (c.hungry) c.st = 3;
    // 食べ物の主は、集落のまわりのキノコと苔（集めに出た者 st 4 が持ち帰って蓄えにする）。
    // 近くに獲物がいれば狩り、死骸があれば拾う（足し）。長く食べていなければ、遠くまで探す
    const R = c.sinceMeal > 1200 ? 20 : c.sinceMeal > 600 ? 16 : 12;
    if (this.hunt(c, c.st === 4 ? 8 : R, HUNT0, s.speed * 1.15)) return;
    if (this.goblinCarrion(c, c.st === 4 ? 8 : R)) return;
    // 集めに出た者（st 4）：集落のまわり（14マス、コボルトの縄張りの外）のキノコと苔を摘んで袋（units、20まで）に入れる。いっぱいになったら持ち帰る
    if (c.st === 4) {
      const k = cp && c.units < 20 ? this.goblinForage(c, cp.x, cp.y, 14) : -1;
      if (k < 0) {
        c.st = 0;
      } else {
        const m = this.w.map;
        c.act = 1;
        if (this.goTo(c, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === k) {
          const tf = Math.min(4, this.w.fungus[k] - 12, 20 - c.units);
          if (tf > 0) {
            this.w.fungus[k] -= tf;
            c.units += tf;
          } else {
            const tm = Math.min(4, this.w.moss[k] - 12, 20 - c.units);
            if (tm > 0) {
              this.w.moss[k] -= tm;
              c.units += tm;
            }
          }
          this.mossTouched = true;
          c.act = 2;
          if (c.actT > 4) c.actT = 0;
        }
        return;
      }
    }
    // 腹を空かせた者は、その場で苔かキノコを食べる
    const kk = cp ? this.goblinForage(c, cp.x, cp.y, R) : (() => {
      const k = this.findMoss(c, c.x, c.y, R, 91, this.step >> 7);
      return k >= 0 ? k : this.findFungus(c.x, c.y, R, c.id);
    })();
    if (kk >= 0) {
      const m = this.w.map;
      c.act = 1;
      if (this.goTo(c, (kk % m.w) * TILE + 8, Math.floor(kk / m.w) * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === kk) {
        let t = Math.min(4, this.w.fungus[kk] - 12, s.cap - c.food);
        if (t > 0) {
          this.w.fungus[kk] -= t;
          c.food += t;
          c.sinceMeal = 0;
          this.mossTouched = true;
        } else this.eatMoss(c, 4);
      }
      return;
    }
    if (c.st === 4) c.st = 0;
    if (!c.hungry) c.st = 0;
  }
  // 集落のない者と、近くに食べ物の見つからない腹ぺこの者は、あてもなく歩いて探す
  if (!cp || c.hungry > 0) {
    c.act = 1;
    const j = DIR16[ih(c.id, this.step >> 4, 92) & 15];
    this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
    return;
  }
  // 食べ残しを畑へ運んでキノコを育てる
  if (c.units > 0) {
    const m = this.w.map;
    const h = ih(c.id, this.step >> 6, 93);
    const fx = Math.floor(cp.x / TILE) + ((h & 7) % 7) - 3;
    const fy = Math.floor(cp.y / TILE) + (((h >>> 3) & 7) % 7) - 3;
    const fk = fy * m.w + fx;
    if (fx > 0 && fy > 0 && fx < m.w - 1 && fy < m.h - 1 && !m.solid[fk] && !m.lava[fk]) {
      c.act = 1;
      if (this.goTo(c, fx * TILE + 8, fy * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === fk) {
        const t = Math.min(c.units, 200 - this.w.fungus[fk]);
        if (t > 0) {
          this.w.fungus[fk] += t;
          c.units -= t;
          this.mossTouched = true;
        }
        if (c.units > 0) {
          this.deposit(c.x, c.y, c.units);
          c.units = 0;
        }
        c.act = 2;
        c.actT = 0;
      }
      return;
    }
    this.deposit(c.x, c.y, c.units);
    c.units = 0;
  }
  // 集落のそばでたむろする
  if (sq(cp.x - c.x) + sq(cp.y - c.y) > 4 * TILE * 4 * TILE) {
    c.act = 1;
    this.goTo(c, cp.x, cp.y, s.speed);
  } else {
    c.act = c.actT % 60 < 36 ? 0 : 1;
    if (c.act === 1) {
      const j = DIR16[ih(c.id, this.step >> 4, 94) & 15];
      this.tryMove(c, j[0] * s.speed * 0.4, j[1] * s.speed * 0.4);
    }
  }
}

/** 集落：ゴブリンは数を増やし、リザードマンの村は水が涸れると移る。誰もいない所は消える */
export function updateCamps(this: Ecology): void {
  for (const cp of this.camps) {
    if (cp.id < 0) continue;
    const kind = cp.kind === 0 ? Kind.Goblin : Kind.Lizardman;
    const members = cp.kind === 0 ? this.campMembers(cp) : this.list.filter((c) => c.k === kind && !c.dead && c.ref === cp.id && c.st !== 9);
    if (!members.length) {
      // 誰もいなくなった集落の火は消え、燃え残りは灰になる
      if ((cp.fuel ?? 0) > 0) this.deposit(cp.x, cp.y + 10, cp.fuel as number);
      cp.fuel = 0;
      if (cp.kind === 0) {
        this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'empty', x: Math.round(cp.x), y: Math.round(cp.y) } as never);
        this.deposit(cp.x, cp.y, cp.store ?? 0);
        cp.store = 0;
      }
      cp.id = -1;
      continue;
    }
    if (cp.kind === 0) {
      // 襲われた記憶は少しずつ薄れる
      if (this.step % 600 === 45 && (cp.raids ?? 0) > 0) cp.raids = (cp.raids ?? 0) - 1;
      if ((cp.store ?? 0) > 0) cp.empty = -1;
      else if ((cp.empty ?? -1) < 0) cp.empty = this.w.tick;
      if (members.length >= 2) cp.alone = -1;
      else if ((cp.alone ?? -1) < 0) cp.alone = this.w.tick;
      let dragonNear = false;
      for (const o of this.list) if (o.k === Kind.Dragon && !o.dead && o.sp >= 1 && sq((o.hx || o.x) - cp.x) + sq((o.hy || o.y) - cp.y) < 30 * TILE * 30 * TILE) dragonNear = true;
      const lonely = members.length < 2 && this.w.tick - (cp.alone as number) > DAY_TICKS_ECO;
      // 蓄えが残っているうちは、食べ物のことでは捨てない。尽きてゲーム内の1/3日たち、皆が腹を空かせているか、飢え死にしかけている者がいるとき
      // （ゴブリンは腹を空かせてからゲーム内の約0.4日で飢え死にするので、コボルトのように1日は待てない）
      const starving = members.every((c) => c.hungry > 0 || c.food < 10) || members.some((c) => c.hungry > SPEC[Kind.Goblin].starve * 0.5);
      const reason = (cp.raids ?? 0) >= 4 ? 1 : dragonNear ? 3 : lonely ? 2 : (cp.empty ?? -1) >= 0 && this.w.tick - (cp.empty as number) > DAY_TICKS_ECO / 3 && starving ? 0 : -1;
      if (reason >= 0 && cp.hide !== 1 && this.abandonCamp(cp, reason)) continue;
    }
    // かがり火：まわりの枯れかけたキノコの軸を集めて燃やし続ける。燃えた分は灰になって土に返る（通常速度で20秒ごと）
    if (this.step % 100 === 65) {
      if ((cp.fuel ?? 0) < 12) {
        const m = this.w.map;
        const cx = Math.floor(cp.x / TILE);
        const cy = Math.floor(cp.y / TILE);
        let got = 0;
        for (let dy = -6; dy <= 6 && got < 4; dy++)
          for (let dx = -6; dx <= 6 && got < 4; dx++) {
            const k = (cy + dy) * m.w + cx + dx;
            if (k < 0 || k >= m.solid.length || m.solid[k]) continue;
            // 枯れたキノコの軸か、乾いた苔を燃やす
            if (this.w.fungus[k] >= 40) {
              const t = Math.min(2, this.w.fungus[k] - 30, 4 - got);
              this.w.fungus[k] -= t;
              got += t;
            } else if (this.w.moss[k] >= 80) {
              const t = Math.min(2, this.w.moss[k] - 60, 4 - got);
              this.w.moss[k] -= t;
              got += t;
            }
          }
        if (got) {
          cp.fuel = (cp.fuel ?? 0) + got;
          this.mossTouched = true;
        }
      }
      if ((cp.fuel ?? 0) > 0) {
        cp.fuel = (cp.fuel as number) - 1;
        this.deposit(cp.x, cp.y + 10, 1);
        if (cp.fuel === 0) this.log(cp.x, cp.y, `{k:${kind}}の集落のかがり火が消えた`);
      }
    }
    // ゴブリンは、集落の蓄えが目安の3割以上あるときだけ子を産む（蓄えから産む）
    if (cp.kind === 0 && this.step % 600 === 15 && members.length >= 2 && this.counts[kind] < 20 && (cp.store ?? 0) >= Math.max(20, this.campStoreGoal(cp) * 0.3)) {
      const b = SPEC[kind].body;
      cp.store = (cp.store ?? 0) - b;
      this.spawn(kind, members[0].x, members[0].y, b, 0).ref = cp.id;
    }
    if (cp.kind === 1 && this.step % 600 === 15 && members.length >= 2) {
      const cap = 8;
      const p = members.find((c) => c.food >= SPEC[kind].cap * 0.6);
      if (p && this.counts[kind] < cap) {
        const b = SPEC[kind].body;
        p.food -= b;
        this.spawn(kind, p.x, p.y, b, 0).ref = cp.id;
      }
    }
    if (cp.kind === 1 && this.step % 600 === 315) {
      if (this.waterNear(Math.floor(cp.x / TILE), Math.floor(cp.y / TILE), 6) < 600) cp.dry++;
      else cp.dry = 0;
      if (cp.dry >= 5) {
        const site = this.pickWaterSite(cp.id);
        if (site >= 0) {
          const m = this.w.map;
          cp.x = (site % m.w) * TILE + 8;
          cp.y = Math.floor(site / m.w) * TILE + 8;
          cp.dry = 0;
        }
      }
    }
  }
  this.camps = this.camps.filter((o) => o.id >= 0);
}

declare module '../ecology' {
  interface Ecology {
    campFood: typeof campFood;
    pickGoblinCamp: typeof pickGoblinCamp;
    routeDist: typeof routeDist;
    checkGoblinMouths: typeof checkGoblinMouths;
    newCamp: typeof newCamp;
    campMembers: typeof campMembers;
    campChief: typeof campChief;
    campStoreGoal: typeof campStoreGoal;
    goblinHidden: typeof goblinHidden;
    hideSpot: typeof hideSpot;
    abandonCamp: typeof abandonCamp;
    watchCamps: typeof watchCamps;
    scatterCamp: typeof scatterCamp;
    inKoboldLand: typeof inKoboldLand;
    goblinCarrion: typeof goblinCarrion;
    goblinForage: typeof goblinForage;
    campOf: typeof campOf;
    goblin: typeof goblin;
    updateCamps: typeof updateCamps;
  }
}

Object.assign(Ecology.prototype, { campFood, pickGoblinCamp, routeDist, checkGoblinMouths, newCamp, campMembers, campChief, campStoreGoal, goblinHidden, hideSpot, abandonCamp, watchCamps, scatterCamp, inKoboldLand, goblinCarrion, goblinForage, campOf, goblin, updateCamps });
