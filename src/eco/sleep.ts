/** Ecology のメソッド：眠り（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** 見張り：群れが休む間、一匹は起きている。ゲーム内の2時間ごとに交代する（群れの中で順番に） */
export function isSentry(this: Ecology, c: Cr, key: string): boolean {
  const g = this.groups.get(key);
  if (!g || g.members.length < 3) return false;
  const shift = Math.floor(this.w.tick / (DAY_TICKS_ECO / 12));
  const awake = g.members.filter((o) => o.flee <= 0);
  return awake.length > 0 && awake[shift % awake.length] === c;
}

/**
 * 眠り。眠気がたまり、時間帯が合えば、群れの集まる場所（巣があれば巣、旅する群れは先頭のそば）で眠る。
 * 群れない種は、その場で眠る。まわりの仲間の半分以上が眠っていると眠くなりやすい（同調）。
 * true なら今は眠っている（ふだんの行いをしない。眠りながら動く種は除く）
 */
export function doSleep(this: Ecology, c: Cr, day: number, phase: number): boolean {
  const sp = Ecology.SLEEP[c.k];
  // 盗みに出たゴブリンは眠らない
  if (!sp || (c.k === Kind.Goblin && (c.st === 15 || c.st === 16 || c.st === 17)) || (c.k === Kind.Rat && c.st === 11)) {
    c.sleep = 0;
    if (c.drowsy > 0) c.drowsy--;
    return false;
  }
  const night = phase > 0.79 || phase < 0.18;
  const inWindow = sp.when === 'any' || (sp.when === 'night' ? night : !night);
  const key = this.groupKey(c);
  // 大ネズミとコボルトは、ひどく腹が減ると眠っていられない（眠ったまま飢えない）
  const starving = (c.k === Kind.Rat || c.k === Kind.Kobold) && c.hungry > SPEC[c.k].starve * 0.25;
  if (c.sleep > 0) {
    if (starving) {
      c.sleep = 0;
      return false;
    }
    c.drowsy = Math.max(0, c.drowsy - sp.out);
    // 目覚める：眠気が抜けた、時間帯が終わって眠気が半分を切った
    if (c.drowsy <= 0 || (!inWindow && c.drowsy < sp.th / 2) || c.flee > 0 || this.w.tick - c.hitAt < 4) {
      c.sleep = 0;
      return false;
    }
    c.act = 0;
    if (sp.kind === 'drift') return false;
    return true;
  }
  // 起きている：眠気がたまる。仲間の半分以上が眠っていると早くたまる
  let gain = 1;
  if (key && this.step % 10 === c.id % 10) {
    const g = this.groups.get(key);
    if (g && g.members.length >= 2) {
      let near = 0;
      let asleep = 0;
      for (const o of g.members) {
        if (o === c || sq(o.x - c.x) + sq(o.y - c.y) > 6 * TILE * 6 * TILE) continue;
        near++;
        if (o.sleep > 0) asleep++;
      }
      if (near && asleep * 2 >= near) c.drowsy += 20;
    }
  }
  if (sp.kind === 'irreg') gain = 0.5 + (ih(c.id, this.step >> 8, 300) % 100) / 100;
  c.drowsy += gain;
  const th = sp.kind === 'irreg' ? sp.th * (0.6 + (ih(c.id, Math.floor(this.w.tick / DAY_TICKS_ECO), 301) % 80) / 100) : sp.th;
  if (c.drowsy < th || (!inWindow && c.drowsy < th * 2)) return false;
  if (c.act === 2 || c.flee > 0 || this.w.tick - c.hitAt < 60 || starving) return false;
  // 見張りは眠らない
  if (key && this.isSentry(c, key)) return false;
  // 眠る場所：群れの集まる場所へ（遠すぎなければ）。我慢の限界ならその場で
  const g = key ? this.groups.get(key) : undefined;
  if (g && c.drowsy < th * 2.5 && sp.kind !== 'drift') {
    const [sx, sy] = this.slotOf(c, g);
    const d2 = sq(sx - c.x) + sq(sy - c.y);
    if (d2 > 5 * 5 && sq(g.hx - c.x) + sq(g.hy - c.y) < 30 * TILE * 30 * TILE) {
      c.act = 1;
      this.goTo(c, sx, sy, SPEC[c.k].speed);
      if (d2 > 3 * TILE * 3 * TILE) return true;
    }
  }
  c.sleep = sp.kind === 'poly' || sp.kind === 'drift' ? 1 : sp.kind === 'half' ? 3 : 2;
  c.act = 0;
  return true;
}

/**
 * もとから眠りにあたる状態を持つ種の眠りを、眠りの印として揃える（見た目と、寝込みを襲われることのため）：
 * 宝の上のドラゴン、目覚める前のワーム、ねぐらのコウモリ、焚き火を囲む冒険者（見張りと、手当て中の僧侶を除く）は深い眠り
 */
export function syncLongSleep(this: Ecology): void {
  for (const c of this.list) {
    if (c.dead || Ecology.SLEEP[c.k]) continue;
    let z = 0;
    if (c.k === Kind.Dragon && c.st === 0) z = this.dragonLightSleep(c) ? 1 : 2;
    else if (c.k === Kind.Worm && c.st === 0) z = 2;
    else if (c.k === Kind.Bat && c.st === 0 && !c.away) z = 2;
    else if (c.k === Kind.Adventurer) {
      const p = this.parties.find((q) => q.id === c.party);
      // 僧侶は、傷ついた仲間を癒やしている間は起きている（癒やす動作のたびに起きたり寝たりして見えないように）
      const tending = c.sp === Job.Priest && !!p && this.campWounded(p);
      // 起こされて構えている一行と、打たれたばかりの者（コウモリに血を吸われた者など）は眠らない（src/eco/night.ts）
      if (p && (this.campAwake(p) || this.w.tick - c.hitAt < 150)) z = 0;
      else if (p && (p.camp ?? -1) >= 0 && p.members[0] !== c.id && c.act === 0 && !tending) z = 2;
      // 焚き火の見張りがうとうとしている間は、浅い眠り（小さな z）
      else if (p && p.members[0] === c.id && c.act === 0 && this.watchDozing(p) && !tending) z = 1;
    }
    c.sleep = z;
  }
}

/**
 * 群れの集まる場所での、一匹ずつの居場所（整列させず、揺らぎを持たせる）。
 * 大ネズミは巣穴の口に身を寄せ合い、それ以外は集まる場所のまわりに散らばる
 */
export function slotOf(this: Ecology, c: Cr, g: { hx: number; hy: number; members: Cr[] }): [number, number] {
  const i = Math.max(0, g.members.indexOf(c));
  const huddle = c.k === Kind.Rat || c.k === Kind.Ant;
  const gap = huddle ? 6 : Ecology.bodySize(c.k) * 1.1;
  const a = i * 2.39996 + (c.id % 13) * 0.21;
  const r = i === 0 ? 0 : gap * (0.7 + Math.sqrt(i) * 0.9);
  const jx = ((c.id * 37) % 7) - 3;
  const jy = ((c.id * 53) % 5) - 2;
  return [g.hx + Math.cos(a) * r + jx, g.hy + Math.sin(a) * r * 0.75 + jy];
}

/**
 * やわらかい間合い：近すぎる者どうしは、生き物の更新ごとに少しだけ離れる。止まっている者どうしほど強く、
 * 歩いている者どうしはごく弱く（すれ違いや交差はそのままできる）。動きを止めたり向きを変えさせたりはしない。
 * 群れで寄り添う種（大ネズミ、アリ、コウモリ）は間合いが小さい。ドラゴンは押されても動かず（相手だけがどく）、飛んでいる間は押し合わない
 */
export function personalSpace(this: Ecology): void {
  for (const c of this.list) {
    if (c.dead || c.away) continue;
    const sa = Ecology.bodySize(c.k);
    if (!sa) continue;
    if (c.k === Kind.Bat && c.st !== 0) continue;
    // 飛んでいるドラゴンは宙にいるので、地上の者と押し合わない
    if (c.k === Kind.Dragon && c.st === 2) continue;
    const stillA = c.act === 0 || c.sleep > 0;
    this.nearby(c.x, c.y, 2, (o) => {
      if (o === c || o.dead || o.away || o.id < c.id) return;
      const sb = Ecology.bodySize(o.k);
      if (!sb || (o.k === Kind.Bat && o.st !== 0) || (o.k === Kind.Dragon && o.st === 2)) return;
      const huddle = (c.k === o.k && (c.k === Kind.Rat || c.k === Kind.Ant || c.k === Kind.Bat)) ? 0.65 : 1;
      const r = ((sa + sb) / 2) * huddle;
      const dx = o.x - c.x;
      const dy = (o.y - c.y) * 1.3;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return;
      const stillB = o.act === 0 || o.sleep > 0;
      const k = stillA && stillB ? 0.25 : stillA || stillB ? 0.08 : 0.03;
      let d = Math.sqrt(d2);
      let ux = dx;
      let uy = dy;
      if (d < 0.01) {
        const a = ((c.id * 7919 + o.id * 104729) % 628) / 100;
        ux = Math.cos(a);
        uy = Math.sin(a);
        d = 1;
      }
      const push = Math.min(1.2, (r - d) * k);
      const px = (ux / d) * push;
      const py = (uy / d) * push * 0.77;
      // 大きいほうは動きにくい。ドラゴンは小さな者に押されても動かず、相手だけがどく
      // （以前はコウモリやクモに押され、炎を吐いたまま向きを変えずに斜め後ろへ滑っていった）
      const dA = c.k === Kind.Dragon && o.k !== Kind.Dragon;
      const dB = o.k === Kind.Dragon && c.k !== Kind.Dragon;
      const wa = dA ? 0 : dB ? 1 : sb / (sa + sb);
      const wb = dB ? 0 : dA ? 1 : sa / (sa + sb);
      if (this.passable(c, c.x - px * wa, c.y - py * wa)) {
        c.x -= px * wa;
        c.y -= py * wa;
      }
      if (this.passable(o, o.x + px * wb, o.y + py * wb)) {
        o.x += px * wb;
        o.y += py * wb;
      }
    });
  }
}

/** 物音や、すぐそばの気配で目覚める（深い眠りは近い音だけ） */
export function wakeByNoise(this: Ecology): void {
  for (const n of this.noises) {
    if (this.step - n.t > 2 || n.s) continue;
    this.nearby(n.x, n.y, n.r, (c) => {
      if (c.sleep <= 0) return;
      const r = c.sleep === 2 ? n.r * 0.4 : c.sleep === 3 ? n.r * 1.2 : n.r * 0.8;
      if (sq(c.x - n.x) + sq(c.y - n.y) >= r * TILE * r * TILE) return;
      c.sleep = 0;
      // 焚き火で眠る冒険者が物音で目を覚ましたら、一行を起こす（src/eco/night.ts）
      if (c.k === Kind.Adventurer) {
        const p = this.parties.find((q) => q.id === c.party);
        if (p && (p.camp ?? -1) >= 0) this.campWake(p, 'noise', undefined, c);
      }
    });
  }
}

declare module '../ecology' {
  interface Ecology {
    isSentry: typeof isSentry;
    doSleep: typeof doSleep;
    syncLongSleep: typeof syncLongSleep;
    slotOf: typeof slotOf;
    personalSpace: typeof personalSpace;
    wakeByNoise: typeof wakeByNoise;
  }
}

Object.assign(Ecology.prototype, { isSentry, doSleep, syncLongSleep, slotOf, personalSpace, wakeByNoise });
