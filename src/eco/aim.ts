/**
 * Ecology のメソッド：冒険者の一行の目標（冒険者の作り直しの一歩目）。
 *
 * 見せたい瞬間：
 *  1. 一行が入口から入ってきて、迷わず目標の方へ進む。着いたら立ち止まって武器を構え、「！」が出る。
 *  2. 目標でない住処・集落・縄張りは道筋を選ぶときに避け、そばを通るときは一瞬足を止めて身構え（「？」）、そのまま通り過ぎる。
 *  3. 目標が集落なら（ゴブリン退治）、まっすぐ踏み込み、集落のまわりの暗がりを探して戦う。
 *
 * 目標（Party.aim）：0 なし（探索）、1 宝、2 竜、3 大物、4 アンデッド、5 ゴブリン退治。状態はすべて Party に入れる（保存は Party ごと JSON）。
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { CELL, Camp, Cr, Ecology, Job, Kind, Party, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { ADV_NAMES, AIM_NAMES, JOB_NAMES } from '../names';

const DRAGONS = [Kind.Dragon, Kind.Wyvern, Kind.Worm];
const UNDEAD = [Kind.Zombie, Kind.Skeleton, Kind.Lich, Kind.Ghost];
/** ゴブリン退治の一行が来る噂の強さ */
export const GOBLIN_HUNT_AT = 0.5;
/** 構える長さ（生き物の1歩の回数）：目標に着いたとき、住処のそばを通るとき */
const BRACE_ARRIVE = 16;
const BRACE_PASS = 8;

/** ゴブリン退治の一行が来るか（顔ぶれを決める前に見る） */
export function goblinHuntReady(this: Ecology): boolean {
  return this.rumors.goblin >= GOBLIN_HUNT_AT && this.camps.some((o) => o.id >= 0 && o.kind === 0);
}

/** 外の世界の地図に載っている場所か（生還者が探した区画、宝の区画、危ない区画。となりの区画まで含める） */
export function loreKnows(this: Ecology, x: number, y: number): boolean {
  const lo = this.lore;
  const cw = Math.ceil(this.w.map.w / CELL);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cell = this.cellOf(x + dx * CELL * TILE, y + dy * CELL * TILE);
      if (Math.abs((cell % cw) - (this.cellOf(x, y) % cw)) > 1) continue;
      if (lo.explored.includes(cell) || lo.gold.includes(cell) || lo.danger.some((d) => d[0] === cell)) return true;
    }
  return false;
}

/** 一行が入ってくるときに、噂と職業の役目から目標を一つ決める */
export function chooseAim(this: Ecology, p: Party, jobs: number[], gobHunt: boolean): void {
  const r = this.rumors;
  const m = this.w.map;
  p.name = ADV_NAMES[ih(p.id, this.step, 260) % ADV_NAMES.length];
  p.aim = 0;
  p.aimId = 0;
  p.aimX = 0;
  p.aimY = 0;
  p.aimKnown = 0;
  p.aimAt = 0;
  p.aimEnd = 0;
  p.passed = [];
  if (gobHunt) {
    // ゴブリン退治：最後に盗まれた場所にいちばん近い集落
    let best: Camp | null = null;
    let bd = 1e18;
    for (const cp of this.camps) {
      if (cp.id < 0 || cp.kind !== 0) continue;
      const d = sq(cp.x - r.goblinX) + sq(cp.y - r.goblinY);
      if (d < bd) {
        bd = d;
        best = cp;
      }
    }
    if (best) {
      p.aim = 5;
      p.aimId = best.id;
      p.aimX = best.x;
      p.aimY = best.y;
      p.aimKnown = this.loreKnows(best.x, best.y) ? 1 : 0;
      this.guessDeep(p);
      // 噂は、退治を引き受けた一行が出たことで落ち着く
      r.goblin *= 0.3;
      return;
    }
  }
  if (jobs.includes(Job.Slayer)) {
    const dragon = this.list.find((o) => !o.dead && !o.away && o.k === Kind.Dragon);
    if (dragon) {
      // ドラゴン：寝床までの道が町で知られている（前の一行が見つけて持ち帰った）ときだけ、竜退治を目標にする
      const way = this.lore.dragonWay;
      const wd = way ? this.byId.get(way[2]) : undefined;
      if (way && wd && !wd.dead && !wd.away && wd.k === Kind.Dragon) {
        p.aim = 2;
        p.aimId = wd.id;
        p.aimX = way[0];
        p.aimY = way[1];
        p.aimKnown = 1;
        p.aimWay = 1;
        return;
      }
      // 知られていなければ、深部を探って、竜の寝床への道を見つけて持ち帰る
      if (way) this.lore.dragonWay = undefined;
      p.aim = 6;
      this.guessDeep(p);
      return;
    }
    // ドラゴンがいなければ、ワイバーン、岩の中を動くワームは床にいるときだけ（場所は噂か深部で当て推量）
    const d = this.list.find((o) => !o.dead && !o.away && o.k === Kind.Wyvern) ?? this.list.find((o) => !o.dead && !o.away && o.k === Kind.Worm && this.tileOf(o.x, o.y) >= 0 && !m.solid[this.tileOf(o.x, o.y)]);
    p.aim = 2;
    if (d) {
      p.aimId = d.id;
      p.aimX = d.x;
      p.aimY = d.y;
      p.aimKnown = this.loreKnows(d.x, d.y) ? 1 : 0;
    }
    this.guessDeep(p);
    return;
  }
  if (jobs.includes(Job.Hunter) && r.beastKind) {
    p.aim = 3;
    p.aimX = r.beastX;
    p.aimY = r.beastY;
    p.aimKnown = 1;
    let bd = 1e18;
    for (const o of this.list) {
      if (o.dead || o.away || o.k !== r.beastKind) continue;
      const d = sq(o.x - r.beastX) + sq(o.y - r.beastY);
      if (d < bd) {
        bd = d;
        p.aimId = o.id;
      }
    }
    return;
  }
  if (jobs.includes(Job.Priest) && r.undead >= 0.4) {
    p.aim = 4;
    // 地図に載った区画のうち、アンデッドのいちばん多い所
    const cnt = new Map<number, number>();
    for (const o of this.list) if (!o.dead && !o.away && UNDEAD.includes(o.k)) cnt.set(this.cellOf(o.x, o.y), (cnt.get(this.cellOf(o.x, o.y)) ?? 0) + 1);
    let bc = -1;
    let bn = 0;
    for (const [cell, n] of [...cnt.entries()].sort((a, b) => a[0] - b[0])) if (n > bn && this.lore.explored.includes(cell)) {
      bn = n;
      bc = cell;
    }
    if (bc >= 0) {
      const k = this.cellFloor(bc);
      if (k >= 0) {
        p.aimX = (k % m.w) * TILE + 8;
        p.aimY = Math.floor(k / m.w) * TILE + 8;
        p.aimKnown = 1;
      }
    }
    this.guessDeep(p);
    return;
  }
  if (r.gold >= 0.3 && this.lore.gold.length) {
    const g = this.lore.gold[ih(p.id, this.step, 261) % this.lore.gold.length];
    const k = this.cellFloor(g);
    if (k >= 0) {
      p.aim = 1;
      p.aimId = g;
      p.aimX = (k % m.w) * TILE + 8;
      p.aimY = Math.floor(k / m.w) * TILE + 8;
      p.aimKnown = 1;
    }
  }
}

/** 場所を知らない目標は、噂の方角（深部）へまっすぐ向かう（当て推量。着いて見えなければ、まわりを探す） */
export function guessDeep(this: Ecology, p: Party): void {
  if (p.aimKnown) return;
  const m = this.w.map;
  if (m.deep.x < 0) return;
  // ゴブリンの集落は最後に盗まれた場所へ、竜は見かけたという噂の場所へ、ほかは深部へ
  const r = this.rumors;
  if (p.aim === 5 && (r.goblinX || r.goblinY)) {
    p.aimGuessX = r.goblinX;
    p.aimGuessY = r.goblinY;
  } else if (p.aim === 2 && (r.dragonX || r.dragonY)) {
    p.aimGuessX = r.dragonX;
    p.aimGuessY = r.dragonY;
  } else {
    p.aimGuessX = m.deep.x * TILE + 8;
    p.aimGuessY = m.deep.y * TILE + 8;
  }
  p.aimGuess = 1;
}

/** 入ってくるときの記録の言葉（「〜を目指して」） */
export function aimPhrase(this: Ecology, p: Party): string {
  const dk = p.aimId ? this.byId.get(p.aimId)?.k ?? Kind.Dragon : Kind.Dragon;
  switch (p.aim) {
    case 1:
      return '知られた宝の山を目指して';
    case 2:
      return p.aimWay ? `知られた道をたどって{k:${dk}}の寝床を目指し` : p.aimKnown ? `{k:${dk}}の寝床を目指して` : `深部の{k:${dk}}を探しに`;
    case 6:
      return `{k:${Kind.Dragon}}の寝床への道を探しに、深部へ`;
    case 3:
      return `噂の{k:${this.rumors.beastKind}}を狩りに`;
    case 4:
      return p.aimKnown ? `{k:${Kind.Zombie}}たちの群れる所を祓いに` : `深部のアンデッドを祓いに`;
    case 5:
      return `{k:${Kind.Goblin}}の集落を退治しに`;
    default:
      return '';
  }
}

/** 札の言葉：「目的：竜退治（向かっている）」 */
export function aimLine(this: Ecology, p: Party): string {
  const a = p.aim ?? 0;
  if (!a) return `目的：${AIM_NAMES[0]}`;
  const st = p.aimEnd === 1 ? '果たした' : p.aimEnd === 2 ? 'あきらめた' : p.aimAt ? '目標に着いた' : p.aimKnown ? '向かっている' : '場所を探している';
  return `目的：${AIM_NAMES[a]}（${st}）`;
}

/** 目指す集落（ゴブリン退治のときだけ） */
export function aimCamp(this: Ecology, p: Party): Camp | undefined {
  if (p.aim !== 5 || p.aimEnd) return undefined;
  return this.camps.find((o) => o.id === p.aimId && o.id >= 0);
}

/** その生き物の住みか（住処・集落・村・縄張り）の鍵。住みかのない者は null */
export function homeKey(this: Ecology, o: Cr): number | null {
  if (o.k === Kind.Goblin || o.k === Kind.Lizardman) {
    const cp = this.campOf(o);
    return cp && cp.id >= 0 && cp.kind === (o.k === Kind.Goblin ? 0 : 1) ? cp.id : null;
  }
  if (o.k === Kind.Kobold) {
    const wr = this.warrenOf(o);
    return wr && wr.id >= 0 ? wr.id : null;
  }
  if (o.k === Kind.Orc && (o.hx || o.hy)) return -(this.tileOf(o.hx, o.hy) + 1);
  return null;
}

/**
 * 目標でない住民には、自分たちから戦いを始めない。true なら見逃す。
 * 戦うのは、目標の集落の者、一行の誰かに襲いかかっている者、すぐそばで行く手をふさいで進めなくしている者だけ
 */
export function spareResident(this: Ecology, p: Party, c: Cr, o: Cr): boolean {
  // 住みかを捨てて群れで去っていく者（ゴブリン・コボルトの st 10）も、関わりのない相手として見逃す
  const leaving = (o.k === Kind.Goblin || o.k === Kind.Kobold) && o.st === 10;
  const key = leaving ? 0 : this.homeKey(o);
  if (key === null) return false;
  if (p.aim === 5 && !p.aimEnd && key === p.aimId) return false;
  if (o.act === 2 && o.foe && p.members.includes(o.foe) && this.w.tick - o.hitAt < 150) return false;
  // 行く手をふさがれた：すぐそばにいて、こちらが進めずにいる
  if (sq(o.x - c.x) + sq(o.y - c.y) < 12 * 12 && (this.paths.get(c.id)?.stall ?? 0) > 20) return false;
  return true;
}

/** 目標でない住処・集落・縄張りの範囲 [中心x, 中心y（マス）, 半径の2乗（マス）, 鍵] */
export function avoidZones(this: Ecology, p: Party | undefined): number[][] {
  const out: number[][] = [];
  const m = this.w.map;
  const target = p && p.aim === 5 && !p.aimEnd ? p.aimId : null;
  for (const wr of this.warrens) {
    if (wr.id < 0) continue;
    const d = wr.door ?? -1;
    const cx = d >= 0 ? ((d % m.w) + wr.x / TILE) / 2 : wr.x / TILE;
    const cy = d >= 0 ? (Math.floor(d / m.w) + wr.y / TILE) / 2 : wr.y / TILE;
    out.push([cx, cy, 6 * 6, wr.id]);
  }
  for (const cp of this.camps) {
    if (cp.id < 0 || cp.id === target) continue;
    const r = cp.kind === 0 ? 8 : 6;
    out.push([cp.x / TILE, cp.y / TILE, r * r, cp.id]);
  }
  const lairs = new Set<number>();
  for (const o of this.list) {
    if (o.dead || o.away || o.k !== Kind.Orc || (!o.hx && !o.hy)) continue;
    const k = this.tileOf(o.hx, o.hy);
    if (k < 0 || lairs.has(k)) continue;
    lairs.add(k);
    out.push([k % m.w + 0.5, Math.floor(k / m.w) + 0.5, 6 * 6, -(k + 1)]);
  }
  return out;
}

/** 冒険者の道筋：目標でない住みかのまわりを避けて探し、避けては行けないときだけふつうに探す */
export function advPath(this: Ecology, c: Cr, from: number, to: number): number[] | null {
  const m = this.w.map;
  const p = this.parties.find((q) => q.id === c.party);
  const fx = from % m.w;
  const fy = Math.floor(from / m.w);
  const tx = to % m.w;
  const ty = Math.floor(to / m.w);
  // 出発点か行き先を含む範囲は避けない（中から出ていけるように、目指す所へ着けるように）
  const zs = this.avoidZones(p).filter((z) => sq(fx - z[0]) + sq(fy - z[1]) > z[2] && sq(tx - z[0]) + sq(ty - z[1]) > z[2]);
  if (!zs.length) return null;
  const avoid = (k: number) => {
    const x = k % m.w;
    const y = (k / m.w) | 0;
    for (const z of zs) if (sq(x - z[0]) + sq(y - z[1]) <= z[2]) return true;
    return false;
  };
  return this.findPathAvoid(c, from, to, avoid);
}

/** 身構える：一行の皆が止まって、その方を向く（描画は武器を構えた姿） */
export function brace(this: Ecology, p: Party, x: number, y: number, kind: number, n: number): void {
  p.braceT = this.step + n;
  p.braceX = Math.round(x);
  p.braceY = Math.round(y);
  p.braceK = kind;
}

/** 一行の皆に印（「！」「？」）を出す */
export function partyMark(this: Ecology, p: Party, mk: string, all: boolean): void {
  for (const id of p.members) {
    const o = this.byId.get(id);
    if (!o || o.dead) continue;
    this.fxMarks.push({ t: this.w.tick, id, m: mk });
    if (!all) break;
  }
  if (this.fxMarks.length > 120) this.fxMarks.splice(0, 40);
}

/** 目標の場所（いま目指す点）。分からなければ null */
export function aimPoint(this: Ecology, p: Party): [number, number] | null {
  if (!p.aim || p.aimEnd || !p.aimKnown) return null;
  return [p.aimX ?? 0, p.aimY ?? 0];
}

/**
 * 一行の目標を進める（updateParties から、探索中の一行について毎刻み）：
 * 見つける（場所を知る）、着く（構えて「！」）、果たす・あきらめる。目標でない住みかのそばでは身構える
 */
export function aimStep(this: Ecology, p: Party, alive: Cr[]): void {
  const m = this.w.map;
  const lead = alive[0];
  if (this.step % 5 === p.id % 5 && (p.camp ?? -1) < 0) this.passBrace(p, lead);
  if (!p.aim || p.aimEnd || p.goal !== 0 || this.step % 10 !== p.id % 10) return;
  const lights = this.partyLights(p);
  const sees = (o: Cr, r: number) => alive.some((c) => sq(o.x - c.x) + sq(o.y - c.y) < r * TILE * r * TILE && this.seenBy(c, lights, o));
  // 見つける：竜・大物・アンデッドは見えたら、集落はかがり火が見えるか近くに来たら
  if (p.aim === 2 || p.aim === 3) {
    let t = p.aimId ? this.byId.get(p.aimId) : undefined;
    if (!t || t.dead || t.away) {
      t = undefined;
      // 目指した相手がいなくなっても、同じ種（竜なら竜のなかま）が見えたらそれを目標にする
      this.nearby(lead.x, lead.y, 7, (o) => {
        if (t || o.dead || o.away) return;
        if ((p.aim === 2 ? DRAGONS.includes(o.k) : o.k === this.rumors.beastKind) && sees(o, 7)) t = o;
      });
      if (t) p.aimId = (t as Cr).id;
    }
    const tt = t as Cr | undefined;
    if (tt && sees(tt, 7)) {
      p.aimKnown = 1;
      p.aimX = tt.x;
      p.aimY = tt.y;
    } else if (tt && p.aimKnown && p.aimWay && sq((p.aimX ?? 0) - lead.x) + sq((p.aimY ?? 0) - lead.y) >= 2.5 * TILE * 2.5 * TILE) {
      // 知られた道をたどる：道の先（前の一行が竜を見た所）までは、迷わずまっすぐ
    } else if (tt && p.aimKnown && p.aim === 2 && !p.aimWay && this.loreKnows(tt.x, tt.y)) {
      // 地図に載った寝床の竜：寝床へ向かう（竜が動けば、地図に載った所にいる限り追う）
      p.aimX = tt.x;
      p.aimY = tt.y;
    } else if (p.aimKnown && sq((p.aimX ?? 0) - lead.x) + sq((p.aimY ?? 0) - lead.y) < 2.5 * TILE * 2.5 * TILE) {
      // 噂の場所に着いたのに見当たらない：見失って、まわりを探す（見えたらまた目標にする）
      p.aimKnown = 0;
    }
  } else if (p.aim === 6) {
    // 深部の探索：寝床のドラゴンを見通しの利く所から見たら、道を見つけたので、生きて持ち帰る
    if (p.dgId) {
      const t = this.byId.get(p.dgId);
      this.brace(p, t?.x ?? lead.x, t?.y ?? lead.y, 1, BRACE_ARRIVE);
      this.partyMark(p, '!', true);
      p.aimAt = this.step;
      this.endAim(p, lead, 1);
      p.goal = 1;
      p.camp = -1;
      this.setExit(p);
      this.log(lead.x, lead.y, `${p.name ?? ''}の一行が深部で{k:${Kind.Dragon}}の寝床を見つけ、道を持ち帰ろうと引き返した`);
      return;
    }
  } else if (p.aim === 4 && !p.aimAt) {
    let u: Cr | null = null;
    this.nearby(lead.x, lead.y, 7, (o) => {
      if (!u && !o.dead && !o.away && UNDEAD.includes(o.k) && sees(o, 7)) u = o;
    });
    if (u) {
      p.aimKnown = 1;
      p.aimX = (u as Cr).x;
      p.aimY = (u as Cr).y;
    }
  } else if (p.aim === 5) {
    const cp = this.aimCamp(p);
    if (cp && !p.aimKnown && alive.some((c) => sq(cp.x - c.x) + sq(cp.y - c.y) < 15 * TILE * 15 * TILE && (sq(cp.x - c.x) + sq(cp.y - c.y) < 8 * TILE * 8 * TILE || ((cp.fuel ?? 0) > 0 && lineOfSight(m, c.x, c.y, cp.x, cp.y))))) p.aimKnown = 1;
  }
  // 歩いて行けない行き先（道筋が見つからない。閉じた空洞の奥の寝床など）：当て推量ならまわりを探し、知っている目標ならあきらめる
  const pp = this.paths.get(lead.id);
  if (pp && pp.path.length === 0 && pp.gk === this.tileOf(p.tx, p.ty) && sq(p.tx - lead.x) + sq(p.ty - lead.y) > 3 * TILE * 3 * TILE && !p.aimAt) {
    if (!p.aimKnown && p.aimGuess) p.aimGuess = 0;
    else if (p.aimKnown) {
      this.endAim(p, lead, 2);
      return;
    }
  }
  // 知っている目標へは、迷わずまっすぐ（動く相手は、見えた場所へ向け直す）。知らなければ噂の方角へまっすぐ
  if ((p.aimKnown || p.aimGuess) && (!p.aimAt || p.aim === 2 || p.aim === 3) && !p.engage) this.aimTarget(p, lead);
  // 着く
  if (!p.aimAt && p.aimKnown) {
    const [ax, ay] = [p.aimX ?? 0, p.aimY ?? 0];
    const d = sq(ax - lead.x) + sq(ay - lead.y);
    const R = p.aim === 1 ? 2.5 : p.aim === 5 ? 7 : p.aim === 4 ? 5 : 6;
    let ok = d < R * TILE * R * TILE && lineOfSight(m, lead.x, lead.y, ax, ay);
    if (ok && (p.aim === 2 || p.aim === 3)) {
      const t = this.byId.get(p.aimId ?? 0);
      ok = !!t && !t.dead && sees(t, 7);
    }
    if (ok) {
      p.aimAt = this.step;
      this.brace(p, ax, ay, 1, BRACE_ARRIVE);
      this.partyMark(p, '!', true);
      this.log(lead.x, lead.y, `${p.name ?? ''}の一行が目標に着き、武器を構えた（${AIM_NAMES[p.aim]}）`);
      this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'arrive', how: p.aim, n: p.aimId ?? 0, x: Math.round(lead.x), y: Math.round(lead.y) } as never);
    }
  }
  // 果たす・あきらめる
  if (p.aimAt) {
    const since = this.step - p.aimAt;
    let end = 0;
    if (p.aim === 1) {
      const cell = p.aimId ?? -1;
      if (!this.piles.some((pl) => pl.gold > 0 && this.cellOf(pl.x, pl.y) === cell)) end = alive.some((c) => c.gold > 0) ? 1 : 2;
      else if (since > 1500) end = 2;
    } else if (p.aim === 2 || p.aim === 3) {
      const t = this.byId.get(p.aimId ?? 0);
      if (!t || t.dead === 1) end = 1;
      else if (t.dead || t.away || since > 3000) end = 2;
    } else if (p.aim === 4) {
      let n = 0;
      this.nearby(p.aimX ?? 0, p.aimY ?? 0, 8, (o) => {
        if (!o.dead && !o.away && UNDEAD.includes(o.k)) n++;
      });
      if (!n && since > 100) end = 1;
      else if (since > 2400) end = 2;
    } else if (p.aim === 5) {
      const cp = this.aimCamp(p);
      if (!cp || !this.list.some((o) => !o.dead && o.k === Kind.Goblin && o.ref === cp.id)) end = 1;
      else {
        // 集落のゴブリンが見えたら覚える。着いてから誰も見えないまま、集落のまわりを探し歩いて（地上の時間で約1分半）見つからなければ引き返す
        if (alive.some((c) => this.list.some((o) => !o.dead && o.k === Kind.Goblin && o.ref === cp.id && sq(o.x - c.x) + sq(o.y - c.y) < 6 * TILE * 6 * TILE && this.seenBy(c, lights, o)))) p.gobSeen = this.step;
        if (this.step - Math.max(p.aimAt, p.gobSeen ?? 0) > 900 || since > 3000) end = 2;
      }
    }
    if (end) this.endAim(p, lead, end);
  }
}

/** 目標を果たした（1）、あきらめた（2） */
export function endAim(this: Ecology, p: Party, lead: Cr, end: number): void {
  p.aimEnd = end;
  const a = p.aim ?? 0;
  // 宝を探しあぐねた区画は、もうないと覚える（生きて帰れば、外の世界の地図からも消える）
  if (a === 1 && end === 2 && !(p.goneGold ??= []).includes(p.aimId ?? -1)) p.goneGold.push(p.aimId ?? -1);
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'aim', how: a, reason: end, n: p.aimId ?? 0, x: Math.round(lead.x), y: Math.round(lead.y) } as never);
  if (end === 1) {
    if (a !== 6) this.log(lead.x, lead.y, a === 5 ? `${p.name ?? ''}の一行が{k:${Kind.Goblin}}の集落を退治し、引き返した` : `${p.name ?? ''}の一行が目的（${AIM_NAMES[a]}）を果たした`);
    // ゴブリン退治を果たしたら、誇らしく外へ帰る
    if (a === 5 && p.goal === 0) {
      p.goal = 1;
      p.camp = -1;
      this.setExit(p);
    }
  } else if (a === 5 && p.goal === 0) {
    // 集落のまわりを探しても見つからない：引き返す
    p.goal = 1;
    p.camp = -1;
    this.setExit(p);
    this.log(lead.x, lead.y, `${p.name ?? ''}の一行は{k:${Kind.Goblin}}を見つけられず、集落のまわりを探しあぐねて引き返した`);
  } else this.log(lead.x, lead.y, `${p.name ?? ''}の一行が目的（${AIM_NAMES[a]}）をあきらめた`);
}

/** 目標でない住みかのそばを通るとき：一瞬止まって身構え、住みかの方を向いて「？」。そのまま通り過ぎる */
export function passBrace(this: Ecology, p: Party, lead: Cr): void {
  if ((p.braceT ?? 0) > this.step || p.engage) return;
  const m = this.w.map;
  for (const z of this.avoidZones(p)) {
    const zx = z[0] * TILE;
    const zy = z[1] * TILE;
    if (sq(zx - lead.x) + sq(zy - lead.y) > 10 * TILE * 10 * TILE) continue;
    if ((p.passed ??= []).includes(z[3]) || !lineOfSight(m, lead.x, lead.y, zx, zy)) continue;
    p.passed.push(z[3]);
    if (p.passed.length > 40) p.passed.shift();
    this.brace(p, zx, zy, 2, BRACE_PASS);
    this.partyMark(p, '?', false);
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'pass', n: z[3], x: Math.round(lead.x), y: Math.round(lead.y) } as never);
    if (this.step - (this.lastLogged[987] ?? -99999) > 1500) {
      this.lastLogged[987] = this.step;
      const what = z[3] < 0 ? `{k:${Kind.Orc}}の縄張り` : this.warrens.some((w) => w.id === z[3]) ? `{k:${Kind.Kobold}}の住処` : this.camps.find((cp) => cp.id === z[3])?.kind === 1 ? `{k:${Kind.Lizardman}}の村` : `{k:${Kind.Goblin}}の集落`;
      this.log(lead.x, lead.y, `${p.name ?? ''}の一行が${what}のそばで身構え、そのまま通り過ぎた`);
    }
    return;
  }
}

/**
 * 行き先を目標に合わせる（pickTarget の初め）。true なら決めた。
 * 場所を知らない目標は false を返し、pickTarget が奥へ寄せて探す（aimDeep）
 */
export function aimTarget(this: Ecology, p: Party, from: Cr): boolean {
  if (!p.aim || p.aimEnd || p.goal !== 0) return false;
  const m = this.w.map;
  if (!p.aimKnown) {
    // ゴブリン退治：盗まれた場所に着いても集落が見えなければ、そのまわり（12〜35マス。盗みに出たゴブリンはそのくらい遠くから来る）を順に探し歩く。
    // かがり火が見えるか、近くに来れば集落を知る（aimStep）
    if (!p.aimGuess && p.aim === 5 && (this.rumors.goblinX || this.rumors.goblinY)) {
      for (let i = 0; i < 30; i++) {
        const a = (ih(p.id, this.step, 263 + i) % 628) / 100;
        const r = (12 + (ih(p.id, this.step, 293 + i) % 24)) * TILE;
        const k = this.tileOf(this.rumors.goblinX + Math.cos(a) * r, this.rumors.goblinY + Math.sin(a) * r);
        if (k < 0 || m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
        p.tx = (k % m.w) * TILE + 8;
        p.ty = Math.floor(k / m.w) * TILE + 8;
        p.targetAt = this.step;
        return true;
      }
    }
    // 当て推量の行き先へまっすぐ。着いたら、まわりの奥を探す（pickTarget が深部へ寄せる）
    if (!p.aimGuess) return false;
    // 着いたか、地上の時間で長く（4000歩）向かっても着かなければ、まわりを探す
    if (sq((p.aimGuessX ?? 0) - from.x) + sq((p.aimGuessY ?? 0) - from.y) < 3 * TILE * 3 * TILE || this.step - p.since > 4000) {
      p.aimGuess = 0;
      return false;
    }
    p.tx = p.aimGuessX ?? 0;
    p.ty = p.aimGuessY ?? 0;
    p.targetAt = this.step;
    return true;
  }
  if (p.aimAt && p.aim === 5) {
    // 踏み込んで、集落のまわりの暗がりを順に探す
    const cp = this.aimCamp(p);
    if (!cp) return false;
    for (let i = 0; i < 8; i++) {
      const j = Math.floor(this.step / 120) + i;
      const a = (j * 2.399) % 6.283;
      const r = 4 + (j % 4);
      const k = this.tileOf(cp.x + Math.cos(a) * r * TILE, cp.y + Math.sin(a) * r * TILE);
      if (k < 0 || m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
      p.tx = (k % m.w) * TILE + 8;
      p.ty = Math.floor(k / m.w) * TILE + 8;
      p.targetAt = this.step;
      return true;
    }
    p.tx = cp.x;
    p.ty = cp.y;
    p.targetAt = this.step;
    return true;
  }
  // 着いたら、まわり（3マス）を順に照らして探す（宝の区画の山、群れるアンデッド）
  if (p.aimAt && (p.aim === 4 || p.aim === 1)) {
    const a = (ih(p.id, this.step, 262) % 628) / 100;
    const k = this.tileOf((p.aimX ?? 0) + Math.cos(a) * 3 * TILE, (p.aimY ?? 0) + Math.sin(a) * 3 * TILE);
    if (k >= 0 && !m.solid[k] && !m.sealed[k] && !m.lava[k] && this.w.water[k] <= 40) {
      p.tx = (k % m.w) * TILE + 8;
      p.ty = Math.floor(k / m.w) * TILE + 8;
      p.targetAt = this.step;
      return true;
    }
  }
  p.tx = p.aimX ?? 0;
  p.ty = (p.aimY ?? 0) + (p.aim === 2 ? 20 : 0);
  p.targetAt = this.step;
  return true;
}

/** 場所を知らない目標（竜・アンデッド・宝・集落）を探すときは、奥（深部）へ寄せる */
export function aimDeep(this: Ecology, p: Party): boolean {
  return !!p.aim && p.aim !== 3 && !p.aimEnd && !p.aimKnown && !p.aimGuess && p.goal === 0;
}

/**
 * ゴブリン退治の一行は、目指す集落の、暗がりに隠れた者も、松明の光の届く範囲（5.5マス）までなら見つける
 * （目標でない集落のそばを通る一行は、ほかの見る者と同じく、すぐそばに来るまで見つけられない）
 */
export function searchesCamp(this: Ecology, c: Cr, o: Cr): boolean {
  if (c.k !== Kind.Adventurer || o.k !== Kind.Goblin) return false;
  const p = this.parties.find((q) => q.id === c.party);
  if (!p || !this.huntsCamp(p, o.ref)) return false;
  if (sq(o.x - c.x) + sq(o.y - c.y) < 3 * TILE * 3 * TILE) return true;
  return this.inPartyLight(p, o);
}

/** その一行が、この集落を退治しに来ているか */
export function huntsCamp(this: Ecology, p: Party, campId: number): boolean {
  return p.aim === 5 && !p.aimEnd && p.goal === 0 && p.aimId === campId;
}

/** 一行の松明（と光の呪文）の光の届く範囲（5.5マス）にいるか */
export function inPartyLight(this: Ecology, p: Party, o: Cr): boolean {
  for (const l of this.partyLights(p)) if (sq(o.x - l.x) + sq(o.y - l.y) < 5.5 * TILE * 5.5 * TILE) return true;
  return false;
}

/** 札と記録のため：率いる者の呼び方（「戦士アルド」） */
export function partyTitle(this: Ecology, p: Party): string {
  const lead = this.byId.get(p.members[0]);
  return `${lead ? JOB_NAMES[lead.sp] : ''}${p.name ?? ''}`;
}

declare module '../ecology' {
  interface Ecology {
    goblinHuntReady: typeof goblinHuntReady;
    loreKnows: typeof loreKnows;
    chooseAim: typeof chooseAim;
    aimPhrase: typeof aimPhrase;
    aimLine: typeof aimLine;
    aimCamp: typeof aimCamp;
    homeKey: typeof homeKey;
    spareResident: typeof spareResident;
    avoidZones: typeof avoidZones;
    advPath: typeof advPath;
    brace: typeof brace;
    partyMark: typeof partyMark;
    aimPoint: typeof aimPoint;
    aimStep: typeof aimStep;
    endAim: typeof endAim;
    passBrace: typeof passBrace;
    aimTarget: typeof aimTarget;
    aimDeep: typeof aimDeep;
    partyTitle: typeof partyTitle;
    guessDeep: typeof guessDeep;
    searchesCamp: typeof searchesCamp;
    huntsCamp: typeof huntsCamp;
    inPartyLight: typeof inPartyLight;
  }
}

Object.assign(Ecology.prototype, { goblinHuntReady, loreKnows, chooseAim, aimPhrase, aimLine, aimCamp, homeKey, spareResident, avoidZones, advPath, brace, partyMark, aimPoint, aimStep, endAim, passBrace, aimTarget, aimDeep, partyTitle, searchesCamp, guessDeep, huntsCamp, inPartyLight });
