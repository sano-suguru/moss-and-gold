/** Ecology のメソッド：生き物の様子（画面の札のため。シミュレーションには関わらない）、見た目のための印（描画だけに使う。シミュレーションの判断には使わない）、演出のデモ（#fxdemo。シミュレーションは回さない）（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** 触れた場所のいちばん近い生き物（死骸は除く） */
export function pick(this: Ecology, wx: number, wy: number): Cr | null {
  let best: Cr | null = null;
  let bd = 1e18;
  for (const c of this.list) {
    if (c.dead || c.away) continue;
    const r = c.k === Kind.Dragon || c.k === Kind.Worm ? 40 : c.k === Kind.Wyvern || c.k === Kind.Golem || c.k === Kind.Troll || c.k === Kind.Minotaur ? 22 : 14;
    const d = sq(c.x - wx) + sq(c.y - 8 - wy);
    if (d < r * r && d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/** 生き物の名前と、いまの様子と、属する群れを、短い言葉で */
export function describe(this: Ecology, c: Cr, names: string[], jobs: string[]): { title: string; lines: string[] } {
  const known = !!this.discovered[c.k];
  let title = known ? names[c.k] : '見知らぬ影';
  if (c.elite) {
    const nm = this.names.get(c.id) ?? '';
    title = [`${title}`, `火の精「${nm}」`, `亡霊の騎士「${nm}」`, title, `大ネズミの王「${nm}」`, `ゴブリンの頭「${nm}」`, `水の精「${nm}」`, `光の精「${nm}」`, `骨の竜「${nm}」`, `キノコの主「${nm}」`][c.elite] ?? title;
  }
  if (known && c.k === Kind.Adventurer) title += `（${jobs[c.sp]}）`;
  if (known && c.k === Kind.Dwarf) title += `（${['坑夫', '鍛冶屋', '戦士'][c.sp]}）`;
  if (c.k === Kind.Rat && this.w.tick - c.bornAt < DAY_TICKS_ECO / 4) title += '（子）';
  const lines: string[] = [];
  const key = this.groupKey(c);
  const party = c.k === Kind.Adventurer ? this.parties.find((p) => p.id === c.party) : undefined;
  let state = '';
  if (c.sleep === 2) state = 'ぐっすり眠っている';
  else if (c.sleep === 1) state = Ecology.SLEEP[c.k]?.kind === 'drift' ? '眠りながらゆっくり動いている' : 'うとうと眠っている';
  else if (c.sleep === 3) state = '半分だけ眠っている（片目を開けたまま）';
  else if (c.flee > 0) state = '逃げている';
  else if (c.act === 2 && this.w.tick - c.hitAt < 120) state = '戦っている';
  else if (c.k === Kind.Golem) state = '宝物庫の入口を見張っている';
  else if (c.k === Kind.Dragon) state = c.st === 2 ? '飛んでいる' : c.foe ? '宝を盗った者を追っている' : '目を覚まして獲物を探している';
  else if (party && (party.camp ?? -1) >= 0) state = party.members[0] === c.id ? '焚き火のそばで見張りをしている' : '焚き火で休んでいる';
  else if (party && (party.braceT ?? 0) > this.step) state = party.braceK === 1 ? '目標に着いて、武器を構えている' : '住みかの気配に身構えている';
  else if (party && party.goal === 1) state = '引き返している';
  else if (key && this.isSentry(c, key) && this.groups.get(key)!.members.some((o) => o.sleep > 0)) state = '群れの見張りをしている';
  else if (c.act === 2) state = '何かをしている';
  else if (c.hungry) state = '腹をすかせて餌を探している';
  else if (c.act === 1) state = '歩き回っている';
  else state = 'じっとしている';
  lines.push(state);
  if (c.hp > 0) {
    const r = c.hp / this.maxHp(c);
    if (r < 0.35) lines.push('深手を負っている');
    else if (r < 0.7) lines.push('傷ついている');
  }
  const sp = Ecology.SLEEP[c.k];
  if (sp && c.sleep === 0 && c.drowsy > sp.th) lines.push('眠そうにしている');
  if (key) {
    const g = this.groups.get(key);
    const n = g ? g.members.length : 1;
    if (c.k === Kind.Adventurer) lines.push(party?.name ? `${this.partyTitle(party)}の一行（${n}人）` : `冒険者の一行（${n}人）`);
    else if (c.k === Kind.Dwarf) lines.push(`ドワーフの一団（${n}人）`);
    else if (n > 1) lines.push(`${known ? names[c.k] : '見知らぬ影'}の群れ（${n}匹）`);
    else lines.push('群れからはぐれている');
  } else if (Ecology.TERRITORY[c.k]) lines.push('一匹で縄張りを持って暮らしている');
  if (party) lines.push(this.aimLine(party));
  return { title, lines };
}

/** 種と職業と武器から、技の種類と色と大きさを決める */
export function attackStyle(this: Ecology, c: Cr): { style: string; col: number; size: number } {
  if (c.elite === 1) return { style: 'orb', col: 2, size: 2 };
  if (c.elite === 2) return { style: 'slash', col: 7, size: 2 };
  if (c.elite === 6) return { style: 'chill', col: 7, size: 2 };
  if (c.elite === 7) return { style: 'beam', col: 1, size: 1 };
  if (c.elite === 8) return { style: 'bite', col: 6, size: 2 };
  if (c.elite === 9) return { style: 'spore', col: 3, size: 2 };
  if (c.elite === 4) return { style: 'bite', col: 1, size: 1 };
  if (c.elite === 5) return { style: 'slash', col: 1, size: 1 };
  switch (c.k) {
    case Kind.Adventurer:
      return [
        { style: 'slash', col: 0, size: 1 },
        { style: 'orb', col: 2, size: 1 },
        { style: 'stab', col: 0, size: 0 },
        { style: 'smash', col: 1, size: 1 },
        { style: 'stab', col: 0, size: 0 },
        { style: 'arrow', col: 0, size: 0 },
        { style: 'slash', col: 1, size: 2 },
      ][c.sp] ?? { style: 'slash', col: 0, size: 1 };
    case Kind.Rat:
    case Kind.Lizard:
      return { style: 'bite', col: 0, size: 0 };
    case Kind.Worm:
      return { style: 'bite', col: 6, size: 1 };
    case Kind.Mimic:
      return { style: 'mimic', col: 1, size: 1 };
    case Kind.Spider:
      return { style: 'sting', col: 3, size: 0 };
    case Kind.Ant:
      return { style: 'sting', col: 3, size: 0 };
    case Kind.Kobold:
    case Kind.Skeleton:
      return { style: 'stab', col: 0, size: 0 };
    case Kind.Goblin:
      return c.party ? { style: 'slash', col: 0, size: 0 } : { style: 'claw', col: 0, size: 0 };
    case Kind.Orc:
      return { style: 'jag', col: 6, size: 1 };
    case Kind.Wyvern:
      return { style: 'sting', col: 3, size: 1 };
    case Kind.Lizardman:
    case Kind.Zombie:
      return { style: 'claw', col: c.k === Kind.Zombie ? 6 : 0, size: 1 };
    case Kind.Minotaur:
      return { style: 'charge', col: 6, size: 2 };
    case Kind.Golem:
      return { style: 'rune', col: 4, size: 2 };
    case Kind.Troll:
    case Kind.Gargoyle:
      return { style: 'smash', col: 6, size: 2 };
    case Kind.Dwarf:
      return { style: 'slash', col: 1, size: 1 };
    case Kind.Basilisk:
      return { style: 'beam', col: 6, size: 1 };
    case Kind.Vampire:
      return { style: 'bats', col: 5, size: 1 };
    case Kind.Bat:
      return { style: 'drain', col: 5, size: 0 };
    case Kind.Lich:
      return { style: 'orb', col: 4, size: 1 };
    case Kind.Salamander:
      return { style: 'orb', col: 2, size: 0 };
    case Kind.Ghost:
      return { style: 'chill', col: 7, size: 1 };
    case Kind.Slime:
      return { style: 'acid', col: 3, size: 1 };
    case Kind.Myconid:
      return { style: 'spore', col: 3, size: 0 };
    default:
      return { style: 'claw', col: 0, size: 1 };
  }
}

export function nameOf(this: Ecology, c: Cr): string {
  const got = this.names.get(c.id);
  if (got) return got;
  const A = ['グ', 'ザ', 'ガ', 'ド', 'ヴァ', 'ル', 'ク', 'モ', 'ネ', 'ス', 'ト', 'バ', 'リ', 'オ', 'ギ', 'ハ'];
  const B = ['ロ', 'ル', 'ラ', 'ム', 'ズ', 'ナ', 'リ', 'ガ', 'ド', 'キ', 'ン', 'レ', 'ゴ', 'ミ'];
  const C = ['ム', 'ス', 'ク', 'ン', 'ド', 'ル', 'グ', 'ト', '', '', ''];
  const h = ih(c.id, 7, 301);
  const nm = A[h % A.length] + B[(h >>> 5) % B.length] + C[(h >>> 10) % C.length];
  this.names.set(c.id, nm);
  return nm;
}

/**
 * 個体が育って特別になる（地上の1分ごとに見る）：
 * 大ネズミの王 … 6匹以上の巣穴の群れで、王のいない群れの、生まれて4日以上たったいちばん年長の大ネズミ。
 * ゴブリンの頭 … 5匹以上の集落で、頭のいない集落の、来て4日以上たったいちばん年長のゴブリン。
 */
export function riseLeaders(this: Ecology): void {
  for (const [key, g] of this.groups) {
    const k0 = g.members[0]?.k;
    if (k0 !== Kind.Rat && k0 !== Kind.Goblin) continue;
    const need = k0 === Kind.Rat ? 8 : 5;
    const el = k0 === Kind.Rat ? 4 : 5;
    // ダンジョン全体で同時に一体まで。前の王（頭）が現れてから地上の2日はあける
    if (g.members.length < need || this.list.some((o) => o.elite === el && !o.dead)) continue;
    if (this.w.tick - (this.lastElite[el] ?? -1e9) < DAY_TICKS_ECO * 2) continue;
    let old: Cr | null = null;
    for (const o of g.members) if (!o.dead && this.w.tick - o.bornAt > DAY_TICKS_ECO * 5 && (!old || o.bornAt < old.bornAt)) old = o;
    if (!old) continue;
    const c = old as Cr;
    c.elite = el;
    this.lastElite[el] = this.w.tick;
    this.nameOf(c);
    this.log(c.x, c.y, k0 === Kind.Rat ? `大ネズミ「${this.names.get(c.id)}」が群れの王になった` : `ゴブリン「${this.names.get(c.id)}」が集落の頭になった`);
    void key;
  }
}

/** 竜が育った瞬間の演出（古い鱗がはがれ落ち、マナの光が集まる） */
export function pushGrowFx(this: Ecology, c: Cr): void {
  this.fxAttacks.push({ t: this.w.tick, style: 'grow', col: 4, size: 2, ax: c.x, ay: c.y, dx: c.x, dy: c.y, did: c.id, aid: c.id, big: true, kill: false });
}

/** 演出の記録を残す（デモからも呼ぶ） */
export function pushAttackFx(this: Ecology, a: Cr, d: Cr, big: boolean, kill: boolean): void {
  const st = this.attackStyle(a);
  // 体の大きな者ほど、演出も大きく
  const size = Math.min(2, st.size + (Ecology.bodySize(a.k) >= 18 ? 1 : 0));
  this.fxAttacks.push({ t: this.w.tick, style: st.style, col: st.col, size, ax: a.x, ay: a.y, dx: d.x, dy: d.y, did: d.id, aid: a.id, big, kill });
  if (big || kill) this.lastBigHit = this.w.tick;
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
}

export function markNotice(this: Ecology, c: Cr, target: Cr, m: string): void {
  if (this.noticed.get(c.id) === target.id) return;
  this.noticed.set(c.id, target.id);
  this.fxMarks.push({ t: this.w.tick, id: c.id, m });
  if (this.fxMarks.length > 120) this.fxMarks.splice(0, 40);
}

/**
 * 冒険者が害のない相手に気づいたときの関わり方：
 * 魔法使いはウィスプを瓶に捕まえて灯りにする、狩人は一行の食料が乏しければ大ネズミやコウモリを狩る、
 * 僧侶はゴーストを祓う、吟遊詩人は獣を歌でなだめて道を開けさせる。ほかの者は「？」と見るだけ。true なら今は関わっている
 */
export function advInteract(this: Ecology, c: Cr, p: Party, lights: Cr[]): boolean {
  const s = SPEC[Kind.Adventurer];
  // 職業ごとの関わりは、探索中で、食料に余裕があるときだけ（引き返す一行は寄り道しない）
  if (p.goal !== 0 || c.food < s.cap * 0.3) return false;
  let target: Cr | null = null;
  let bd = 6 * TILE * 6 * TILE;
  this.nearby(c.x, c.y, 6, (o) => {
    if (o.dead || o.away || o === c || ![Kind.Wisp, Kind.Bat, Kind.Rat, Kind.Ant, Kind.Myconid, Kind.Ghost, Kind.Salamander, Kind.Lizard, Kind.Spider].includes(o.k)) return;
    if (!this.seenBy(c, lights, o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      target = o;
    }
  });
  if (!target) return false;
  const t = target as Cr;
  const want =
    (c.sp === Job.Wizard && t.k === Kind.Wisp && c.glow < 120) ||
    (c.sp === Job.Hunter && (t.k === Kind.Rat || (t.k === Kind.Bat && t.st === 0)) && c.food < s.cap * 0.5) ||
    (c.sp === Job.Priest && t.k === Kind.Ghost) ||
    (c.sp === Job.Bard && TIER[t.k] === 1 && t.flee <= 0 && bd < 4 * TILE * 4 * TILE && this.step - c.lureAt > 200);
  this.markNotice(c, t, want ? '!' : '?');
  if (!want) return false;
  c.dir = Math.abs(t.x - c.x) > Math.abs(t.y - c.y) ? (t.x > c.x ? 2 : 3) : t.y > c.y ? 0 : 1;
  const close = bd < 14 * 14;
  if (c.sp === Job.Bard) {
    // 歌でなだめる：まわりの獣は吟遊詩人から離れて道を開ける（次に歌うまで、地上の時間で40秒あける）
    c.lureAt = this.step;
    c.act = 2;
    c.actT = 0;
    this.nearby(c.x, c.y, 4, (o) => {
      if (o.dead || TIER[o.k] !== 1 || o.k === Kind.Wisp) return;
      o.flee = Math.max(o.flee, 60);
      o.foe = c.id;
    });
    if (this.step - (this.lastLogged[995] ?? -99999) > 3000) {
      this.lastLogged[995] = this.step;
      this.log(c.x, c.y, '冒険者（吟遊詩人）が歌で獣をなだめ、道を開けさせた');
    }
    return true;
  }
  if (!close) {
    c.act = 1;
    this.goTo(c, t.x, t.y, s.speed);
    return true;
  }
  c.act = 2;
  c.actT = 0;
  if (c.sp === Job.Wizard) {
    // ウィスプを瓶に捕まえる：魔法使いはしばらく淡く光る（ウィスプの体は魔法使いの荷に入る）
    const into = Math.min(s.cap - c.food, t.body + t.food);
    c.food += into;
    this.deposit(t.x, t.y, t.body + t.food - into);
    t.body = 0;
    t.food = 0;
    c.mana += t.mana;
    t.mana = 0;
    t.dead = 2;
    c.glow = 255;
    if (this.step - (this.lastLogged[994] ?? -99999) > 3000) {
      this.lastLogged[994] = this.step;
      this.log(c.x, c.y, '冒険者（魔法使い）がウィスプを瓶に捕まえた');
    }
  } else if (c.sp === Job.Priest) {
    this.die(t, 'fight', c.k);
    if (this.step - (this.lastLogged[993] ?? -99999) > 3000) {
      this.lastLogged[993] = this.step;
      this.log(c.x, c.y, '冒険者（僧侶）がゴーストを祓った');
    }
  } else if (c.sp === Job.Hunter) {
    if (this.strike(c, t)) this.eat(c, t);
  }
  return true;
}

/** 明るい広い所に、技の見本の組を並べる */
export function demoSetup(this: Ecology, cx: number, cy: number): void {
  for (const c of this.list) if (Math.abs(c.x - cx) < 200 && Math.abs(c.y - cy) < 120) c.dead = 2;
  const pairs: [Kind, number, Kind, number, number][] = [
    // 攻める種、職業、受ける種、職業、間合い（画素）
    [Kind.Adventurer, 0, Kind.Goblin, 0, 18],
    [Kind.Adventurer, 5, Kind.Rat, 0, 70],
    [Kind.Adventurer, 1, Kind.Orc, 0, 70],
    [Kind.Rat, 0, Kind.Lizard, 0, 16],
    [Kind.Troll, 0, Kind.Adventurer, 0, 22],
    [Kind.Lich, 0, Kind.Adventurer, 3, 70],
    [Kind.Slime, 0, Kind.Rat, 0, 16],
    [Kind.Basilisk, 0, Kind.Adventurer, 2, 60],
    [Kind.Ghost, 0, Kind.Adventurer, 4, 18],
    [Kind.Minotaur, 0, Kind.Adventurer, 0, 40],
    [Kind.Vampire, 0, Kind.Adventurer, 1, 50],
    [Kind.Golem, 0, Kind.Goblin, 0, 24],
  ];
  this.demoPairs = [];
  pairs.forEach(([ka, sa, kd, sd, gap], i) => {
    const x = cx - 120 + (i % 3) * 120;
    const y = cy - 72 + Math.floor(i / 3) * 48;
    this.lamps.push(this.tileOf(x, y - 10));
    const a = this.spawn(ka, x - gap / 2, y, SPEC[ka].body || 10, 0);
    const d = this.spawn(kd, x + gap / 2, y, SPEC[kd].body || 10, 0);
    a.sp = sa;
    d.sp = sd;
    a.dir = 2;
    d.dir = 3;
    a.act = 0;
    d.act = 0;
    a.party = 0;
    d.party = 0;
    a.torch = ka === Kind.Adventurer ? 1 : 0;
    this.demoPairs.push([a, d]);
  });
}

/** デモの1刻み：組ごとに順番に技を出す（傷は与えない。4回に1回は強い一撃、6回に1回はとどめの見せ方） */
export function demoTick(this: Ecology): void {
  const t = this.w.tick;
  this.demoPairs.forEach(([a, d], i) => {
    if ((t + i * 5) % 16 === 0) {
      a.act = 2;
      a.actT = 0;
      const n = Math.floor((t + i * 5) / 16);
      this.pushAttackFx(a, d, n % 4 === 1, n % 6 === 3);
      this.fxHits.push({ t, x: d.x, y: d.y, ax: a.x, ay: a.y, id: d.id });
      d.hitAt = t;
    }
    a.actT++;
    if (a.act === 2 && a.actT > 6) a.act = 0;
  });
}

declare module '../ecology' {
  interface Ecology {
    pick: typeof pick;
    describe: typeof describe;
    attackStyle: typeof attackStyle;
    nameOf: typeof nameOf;
    riseLeaders: typeof riseLeaders;
    pushGrowFx: typeof pushGrowFx;
    pushAttackFx: typeof pushAttackFx;
    markNotice: typeof markNotice;
    advInteract: typeof advInteract;
    demoSetup: typeof demoSetup;
    demoTick: typeof demoTick;
  }
}

Object.assign(Ecology.prototype, { pick, describe, attackStyle, nameOf, riseLeaders, pushGrowFx, pushAttackFx, markNotice, advInteract, demoSetup, demoTick });
