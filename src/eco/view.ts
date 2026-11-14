/** Ecology のメソッド：生き物の様子（情報パネルのため。シミュレーションには関わらない）、見た目のための印（描画専用。シミュレーションの判断には使わない）、演出のデモ（#fxdemo。シミュレーションは実行しない）（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { type Cr, DAY_TICKS_ECO, Ecology, Job, Kind, type Party, SPEC, TIER, ih, sq, STONE_FULL } from '../ecology';
import { TILE } from '../mapgen';
import { heroTitle } from './roster';
import { ARMOR_LOW } from './armor';
import { ITEM_NAMES } from './inspect';

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

/** 生き物の名前と、画面を見ても分からない今の狙いや事情を、短い言葉で */
export function describe(this: Ecology, c: Cr, names: string[], jobs: string[]): { title: string; lines: string[] } {
  // ヴァンパイアの眷属：見出しは主の名、本文は元の姿の1行（src/eco/thrall.ts）
  if (c.k === Kind.Thrall) return { title: `${this.discovered[Kind.Vampire] ? names[Kind.Vampire] : '見知らぬ影'}の眷属`, lines: [`元は${this.thrallOrigin(c)}`] };
  const known = !!this.discovered[c.k];
  let title = known ? names[c.k] : '見知らぬ影';
  if (c.elite) {
    const nm = this.names.get(c.id) ?? '';
    title = [`${title}`, `火の精「${nm}」`, `亡霊の騎士「${nm}」`, title, `大ネズミの王「${nm}」`, `ゴブリンの頭「${nm}」`, `水の精「${nm}」`, `光の精「${nm}」`, `骨の竜「${nm}」`, `キノコの主「${nm}」`][c.elite] ?? title;
  }
  const hero = c.k === Kind.Adventurer ? this.heroOf(c) : null;
  if (known && hero) title = `${heroTitle(hero)}（帰還${hero.ret}回）`;
  else if (known && c.k === Kind.Adventurer) title += `（${jobs[c.sp]}）`;
  if (known && c.k === Kind.Dwarf) title += `（${['坑夫', '鍛冶屋', '戦士'][c.sp]}）`;
  if (c.k === Kind.Rat && this.w.tick - c.bornAt < DAY_TICKS_ECO / 4) title += '（子）';
  const lines: string[] = [];
  const key = this.groupKey(c);
  const party = c.k === Kind.Adventurer ? this.parties.find((p) => p.id === c.party) : undefined;
  // パネルには、画面を見ても分からない今の狙いや事情だけを出す。歩いている、戦っている、眠っている、逃げている、群れでいる、のように
  // 動きや姿で見て分かることは書かない（何も書くことがなければ、見出しだけになる）
  let state = '';
  if (c.sleep === 3) state = '片目を開けたまま眠っている';
  else if (c.flee > 0) state = this.denHidden(c) ? '巣に身を隠している' : '';
  else if (c.k === Kind.Rat && c.st === 11) state = '新しい巣穴へ引っ越している';
  else if (c.k === Kind.Goblin && c.st === 15) state = c.gait < 0 ? '眠っている冒険者に忍び寄っている' : '焚き火をうかがっている';
  else if (c.k === Kind.Goblin && c.st === 17) state = '冒険者の荷を狙ってつけている';
  else if (c.k === Kind.Goblin && c.st === 18) state = '冒険者の物資の置き場の食料を狙っている';
  else if (c.k === Kind.Goblin && c.st === 16) state = c.units > 0 ? '盗んだ荷物を集落へ運んでいる' : '';
  else if (c.k === Kind.Golem) state = '宝物庫の番をしている';
  else if (c.k === Kind.Armor) state = c.st === 10 ? '' : c.mana < ARMOR_LOW ? 'マナが尽きかけている' : '';
  else if (c.k === Kind.Dragon) state = c.foe ? '宝を盗った者を追っている' : '';
  else if (party && (party.camp ?? -1) >= 0) state = party.members[0] === c.id ? '見張りをしている' : '';
  else if (party && party.goal === 1) state = '引き返している';
  else if (key && this.isSentry(c, key) && this.groups.get(key)!.members.some((o) => o.sleep > 0)) state = '群れの見張りをしている';
  // マナで命をつなぐ大物：飢えの猶予を過ぎて、体のマナを燃やしているあいだ（src/eco/step.ts の metabolism）
  else if (Ecology.MANA_FED.has(c.k) && c.hungry > SPEC[c.k].starve && c.mana > 0) state = c.mana < Ecology.MANA_LOW ? 'マナが尽きかけている' : '飢えて、体のマナで命をつないでいる';
  // 食べない種（腹に入る量が0：ゾンビ、ゴースト、マイコニド、ゴーレム、スケルトン、リッチ、リビングアーマー、眷属）は、
  // 代謝の処理で空腹のカウンタが増えても飢えないので、空腹の文を出さない。飢えが進んでいるときだけ出す
  else if (c.hungry > SPEC[c.k].starve * 0.3 && SPEC[c.k].cap > 0) state = '飢えている';
  if (state) lines.push(state);
  if (c.hp > 0 && c.hp / this.maxHp(c) < 0.35) lines.push('深手を負っている');
  // バジリスクの睨みで石化しかけている（体の灰色がかりと、鈍った歩みで画面にも出る）
  if (!c.dead && c.stone > 0) lines.push(c.stone >= STONE_FULL / 2 ? '半ば石になっている' : '石化しかけている');
  if (key) {
    const g = this.groups.get(key);
    const n = g ? g.members.length : 1;
    if (c.k === Kind.Adventurer && party?.name) lines.push(`${this.partyTitle(party)}の一行（${n}人）`);
  }
  if (party) lines.push(this.aimLine(party));
  if (c.k === Kind.Armor) {
    const kit = this.armorKit.get(c.id) ?? [0];
    const nm = (ks: number[]) => ks.map((k) => ITEM_NAMES[k] ?? '武具').join('・');
    const hand = kit.slice(1 + kit[0]);
    if (hand.length) lines.push(`取り込んだ武具：${nm(hand)}`);
  }
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
    case Kind.Armor: {
      // リビングアーマー：手に取り込んだ武器で（素手なら籠手で殴る）。武具が増えるほど大きな技に
      const hand = this.armorHand(c);
      const size = hand.length >= 3 ? 2 : hand.length >= 1 ? 1 : 0;
      if (hand.includes(10) || hand.includes(2)) return { style: 'slash', col: 7, size };
      if (hand.includes(5)) return { style: 'smash', col: 7, size };
      if (hand.includes(6)) return { style: 'stab', col: 7, size };
      return { style: 'smash', col: 6, size: 0 };
    }
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
 * 個体が育って特別になる（通常速度で1分ごとに見る）：
 * 大ネズミの王 … 8匹以上の巣穴の群れで、王のいない群れの、生まれて2日以上たったいちばん年長の大ネズミ。
 * ゴブリンの頭 … 5匹以上の集落で、頭のいない集落の、生まれて1.25日以上たったいちばん年長のゴブリン。
 * 外から来た者は、来たときに1日たっていたものとして数える（arrivals.ts）ので、王は来てから1日、頭は来てから1/4日たつと条件を満たす。
 * ゴブリンの集落は長く続かないことが多いので、日数は短めにしてある。16シード×25日で、5日だと頭の出るシードが4つ、王3日・頭2日だと7つ、
 * いまの値で9つ（王は11）。王の出るシードの数は、日数より「8匹以上の群れ」の条件で決まっている。
 */
export function riseLeaders(this: Ecology): void {
  for (const [key, g] of this.groups) {
    const k0 = g.members[0]?.k;
    if (k0 !== Kind.Rat && k0 !== Kind.Goblin) continue;
    const need = k0 === Kind.Rat ? 8 : 5;
    const el = k0 === Kind.Rat ? 4 : 5;
    // ダンジョン全体で同時に一体まで。前の王（頭）が現れてからゲーム内の2日はあける
    if (g.members.length < need || this.list.some((o) => o.elite === el && !o.dead)) continue;
    if (this.w.tick - (this.lastElite[el] ?? -1e9) < DAY_TICKS_ECO * 2) continue;
    let old: Cr | null = null;
    const age = k0 === Kind.Rat ? 2 : 1.25;
    for (const o of g.members) if (!o.dead && this.w.tick - o.bornAt > DAY_TICKS_ECO * age && (!old || o.bornAt < old.bornAt)) old = o;
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
    // 歌でなだめる：まわりの獣は吟遊詩人から離れて道を開ける（次に歌うまで、通常速度で40秒あける）
    c.lureAt = this.step;
    c.act = 2;
    c.actT = 0;
    this.nearby(c.x, c.y, 4, (o) => {
      if (o.dead || TIER[o.k] !== 1 || o.k === Kind.Wisp) return;
      o.flee = Math.max(o.flee, 60);
      o.foe = c.id;
    });
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
  } else if (c.sp === Job.Priest) {
    this.die(t, 'fight', c.k);
  } else if (c.sp === Job.Hunter) {
    // 大ネズミとは打ち合って仕留める（ほかの狩りと同じ）。止まり木で眠るコウモリは打ち返さないので、射落として拾う
    if (t.k === Kind.Rat) this.fight(c, t);
    else if (this.strike(c, t)) this.eat(c, t, true);
  }
  return true;
}

/** 明るい広い所に、技の見本の組を並べる */
export function demoSetup(this: Ecology, cx: number, cy: number): void {
  for (const c of this.list) if (Math.abs(c.x - cx) < 200 && Math.abs(c.y - cy) < 120) c.dead = 2;
  const pairs: [Kind, number, Kind, number, number][] = [
    // 攻める種、職業、受ける種、職業、間合い（px）
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

/** デモの1 tick：組ごとに順番に技を出す（傷は与えない。4回に1回は強い一撃、6回に1回はとどめの見せ方） */
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

/** 墓標の情報パネル：そこに眠る者の名前と位 */
export function describeGrave(this: Ecology, g: { name: string; job: number; rank: number; ret: number; t: number }): { title: string; lines: string[] } {
  return { title: '墓標', lines: [`${heroTitle(g)}がここに眠る`, `帰還${g.ret}回。${(g.t / DAY_TICKS_ECO).toFixed(1)}日目に倒れた`] };
}

declare module '../ecology' {
  interface Ecology {
    pick: typeof pick;
    describe: typeof describe;
    describeGrave: typeof describeGrave;
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

Object.assign(Ecology.prototype, { pick, describe, describeGrave, attackStyle, nameOf, riseLeaders, pushGrowFx, pushAttackFx, markNotice, advInteract, demoSetup, demoTick });
