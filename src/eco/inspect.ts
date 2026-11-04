/**
 * Ecology のメソッド：触れた物を選んで、情報パネルの言葉にする（src/ecology.ts のクラスに、prototype で足す。シミュレーションには関わらない）。
 *
 * 画面で見えること：生き物のほかに、死骸、金貨の山、床の道具（松明・武器・荷・戦利品）、墓標、石像、物資の置き場、
 * ゴブリンの集落やリザードマンの小屋、冒険者の焚き火に触れると、その上に情報パネルが出て、カメラがそこへ寄る。
 * 死骸や道具のいきさつ（何に倒されたか、誰が落としたか）は src/eco/notes.ts の覚え書きから。
 * 重なっているときは、生き物 → 死骸 → 金貨・道具 → 墓標・石像・置き場・集落・焚き火 の順に選ぶ（同じ段の中では指にいちばん近いもの）。
 */
import { Cr, DAY_TICKS_ECO, Ecology, ItemKind, Kind, Note, sq } from '../ecology';
import { TILE } from '../mapgen';
import { JOB_NAMES, NAMES, UNKNOWN } from '../names';
import { TROPHY } from './loot';

/** 触れて選べる物の種類（cr 生き物、corpse 死骸、gear 床の道具、pile 金貨の山、grave 墓標、statue 石像、cache 物資の置き場、camp 集落・小屋、fire 冒険者の焚き火） */
export type ThingKind = 'cr' | 'corpse' | 'gear' | 'pile' | 'grave' | 'statue' | 'cache' | 'camp' | 'fire';
/** 選んだ物。id は種類ごとの番号（camp は集落のタイル、fire は一行の番号） */
export interface Thing {
  t: ThingKind;
  id: number;
}

export const ITEM_NAMES = ['松明', '燃えさし', '剣', '盾', '杖', '鎚矛', '短剣', '聖印', 'リュート', '弓', '大剣', '背負い袋と寝具', '戦利品'];
const DWARF_JOBS = ['坑夫', '鍛冶屋', '戦士'];
/** 死骸を残さない（ほどけて消える）種 */
const FLEETING: Kind[] = [Kind.Wisp, Kind.Slime, Kind.Ghost, Kind.Myconid];

/** 触れた場所でいちばん優先する物（無ければ null） */
export function pickThing(this: Ecology, wx: number, wy: number): Thing | null {
  const c = this.pick(wx, wy);
  if (c) return { t: 'cr', id: c.id };
  // 段ごとに、指からの距離（の2乗）がいちばん近い物
  // （best はクロージャの中で書き換えるので、型の絞り込みで null に決めつけられないように as で書く）
  let best = null as Thing | null;
  let bd = 1e18;
  const near = (t: ThingKind, id: number, x: number, y: number, r: number) => {
    const d = sq(x - wx) + sq(y - wy);
    if (d < r * r && d < bd) {
      bd = d;
      best = { t, id };
    }
  };
  for (const o of this.list) if (o.dead === 1 && !o.away && !FLEETING.includes(o.k)) near('corpse', o.id, o.x, o.y - 4, 14);
  if (best) return best;
  for (const o of this.piles) near('pile', o.id, o.x, o.y, 12);
  for (const o of this.gear) near('gear', o.id, o.x, o.y, 9);
  if (best) return best;
  for (const g of this.graves) near('grave', g.id, g.x, g.y - 4, 10);
  for (const o of this.statues) near('statue', o.id, o.x, o.y - 8, 14);
  for (const o of this.caches) near('cache', o.id, o.x, o.y, 14);
  for (const o of this.camps) near('camp', this.tileOf(o.x, o.y), o.x, o.y, 20);
  const mw = this.w.map.w;
  for (const p of this.parties) {
    const k = p.camp ?? -1;
    if (k >= 0) near('fire', p.id, (k % mw) * TILE + 8, Math.floor(k / mw) * TILE + 12, 12);
  }
  return best;
}

/** 選んだ物の位置（カメラと情報パネルの基準。無くなっていれば null） */
export function thingPos(this: Ecology, s: Thing): { x: number; y: number } | null {
  const mw = this.w.map.w;
  switch (s.t) {
    case 'cr': {
      const c = this.byId.get(s.id);
      return c && !c.dead && !c.away ? c : null;
    }
    case 'corpse': {
      const c = this.byId.get(s.id);
      return c && c.dead === 1 && !c.away && !FLEETING.includes(c.k) ? { x: c.x, y: c.y + 6 } : null;
    }
    case 'gear': {
      const o = this.gear.find((q) => q.id === s.id);
      return o ? { x: o.x, y: o.y + 12 } : null;
    }
    case 'pile': {
      const o = this.piles.find((q) => q.id === s.id);
      return o ? { x: o.x, y: o.y + 10 } : null;
    }
    case 'grave': {
      const o = this.graves.find((q) => q.id === s.id);
      return o ? { x: o.x, y: o.y + 8 } : null;
    }
    case 'statue': {
      const o = this.statues.find((q) => q.id === s.id);
      return o ? { x: o.x, y: o.y } : null;
    }
    case 'cache': {
      const o = this.caches.find((q) => q.id === s.id);
      return o ? { x: o.x, y: o.y + 12 } : null;
    }
    case 'camp': {
      const o = this.camps.find((q) => this.tileOf(q.x, q.y) === s.id);
      return o ? { x: o.x, y: o.y + 2 } : null;
    }
    case 'fire': {
      const p = this.parties.find((q) => q.id === s.id);
      const k = p ? (p.camp ?? -1) : -1;
      return k >= 0 ? { x: (k % mw) * TILE + 8, y: Math.floor(k / mw) * TILE + 16 } : null;
    }
  }
}

/** 種の名前（まだ照らされていない種は伏せる） */
function kindName(e: Ecology, k: number): string {
  return e.discovered[k] ? NAMES[k] : UNKNOWN;
}

/** 覚え書きの持ち主の呼び方（「冒険者（戦士）」「熟練の戦士アルド」「オーク」など） */
export function whoName(e: Ecology, n: Note): string {
  const k = n.who ?? -1;
  if (k < 0) return '';
  if (!e.discovered[k]) return UNKNOWN;
  if (k === Kind.Adventurer) return n.name ? (n.job !== undefined && !n.name.includes(JOB_NAMES[n.job]) ? `${JOB_NAMES[n.job]}${n.name}` : n.name) : `冒険者（${JOB_NAMES[n.job ?? 0]}）`;
  if (k === Kind.Dwarf) return `ドワーフ（${DWARF_JOBS[n.job ?? 0]}）`;
  return n.name ? `${NAMES[k]}「${n.name}」` : NAMES[k];
}

/** 倒した相手の呼び方 */
function byName(e: Ecology, n: Note): string {
  const k = n.by ?? -1;
  if (k < 0) return '';
  if (!e.discovered[k]) return UNKNOWN;
  if (k === Kind.Adventurer) return n.bn ? `冒険者${n.bn}` : '冒険者';
  return n.bn ? `${NAMES[k]}「${n.bn}」` : NAMES[k];
}

/** どのくらい前か（ゲーム内の時間。1日は DAY_TICKS_ECO tick、1時間はその24分の1） */
function ago(e: Ecology, t: number): string {
  const d = e.w.tick - t;
  const hour = DAY_TICKS_ECO / 24;
  if (d < hour) return 'ついさっき';
  if (d < DAY_TICKS_ECO) return `${Math.floor(d / hour)}時間ほど前`;
  return `${Math.floor(d / DAY_TICKS_ECO)}日ほど前`;
}

/** 死んだ理由の一文 */
function causeLine(e: Ecology, n: Note): string {
  const by = byName(e, n);
  switch (n.cause) {
    case 'eaten':
    case 'fight':
    case 'killed':
      return by ? `${by}に倒された` : '何者かに倒された';
    case 'starve':
      return '飢えて力尽きた';
    case 'burned':
      return '炎に焼かれた';
    case 'crushed':
      return '崩れた岩の下敷きになった';
    case 'dried':
      return '干からびた';
    case 'petrified':
      return '石になりかけて、崩れ落ちた';
    default:
      return by ? `${by}に倒された` : '力尽きた';
  }
}

/** 死骸の呼び方（「ゴブリンの死骸」「熟練の戦士アルドの亡骸」など） */
function corpseTitle(e: Ecology, c: Cr, n: Note | undefined): string {
  if (!e.discovered[c.k]) return `${UNKNOWN}の死骸`;
  if (c.k === Kind.Adventurer || c.k === Kind.Dwarf) {
    const who = n ? whoName(e, n) : '';
    return `${who || NAMES[c.k]}の亡骸`;
  }
  return n?.name ? `${NAMES[c.k]}「${n.name}」の死骸` : `${NAMES[c.k]}の死骸`;
}

/** 選んだ物（生き物以外）の名前と、いきさつと、いまの様子 */
export function describeThing(this: Ecology, s: Thing): { title: string; lines: string[] } {
  const n = this.notes.get(s.id);
  const lines: string[] = [];
  switch (s.t) {
    case 'corpse': {
      const c = this.byId.get(s.id)!;
      if (n) lines.push(`${causeLine(this, n)}（${ago(this, n.t)}）`);
      else lines.push('いきさつはわからない');
      const r = c.init > 0 ? c.units / c.init : 0;
      lines.push(c.units <= 0 ? '骨だけが残っている' : r > 0.66 ? 'まだ新しい' : r > 0.33 ? '腐りはじめている' : 'ほとんど骨になっている');
      const eaters = this.list.filter((o) => !o.dead && o.feed === c.id);
      if (eaters.length) lines.push(`${kindName(this, eaters[0].k)}${eaters.length > 1 ? `たち（${eaters.length}匹）` : ''}が食べている`);
      return { title: corpseTitle(this, c, n), lines };
    }
    case 'gear': {
      const o = this.gear.find((q) => q.id === s.id)!;
      const title = o.kind === ItemKind.Trophy ? (TROPHY[o.fuel]?.[0] ?? '戦利品') : (ITEM_NAMES[o.kind] ?? '道具');
      if (o.kind === ItemKind.Torch) lines.push('床に落ちたまま燃えている');
      else if (o.kind === ItemKind.Stub) lines.push('燃え尽きた松明');
      const who = n ? whoName(this, n) : '';
      const when = n ? `（${ago(this, n.t)}）` : '';
      if (o.kind === ItemKind.Trophy) lines.push(`${n?.name ? `${n.name}の一行` : 'ある一行'}が持ち帰れなかった戦利品${when}`);
      else if (who && n?.cause === 'spent') lines.push(`${who}が捨てていった${when}`);
      else if (who) lines.push(`倒れた${who}が残していった${when}`);
      else lines.push('いきさつはわからない');
      // 持ち主の未練（マナ）が宿っている（src/eco/armor.ts）
      if (o.kind >= ItemKind.Sword && o.kind <= ItemKind.Greatsword && o.fuel > 0) lines.push(o.fuel >= 12 ? '持ち主の未練が宿り、青白くかすかに光っている' : '持ち主の未練が、薄れかけて残っている');
      return { title, lines };
    }
    case 'pile': {
      const o = this.piles.find((q) => q.id === s.id)!;
      const who = n ? whoName(this, n) : '';
      if (!n) lines.push('昔からここに積まれている');
      else if (n.cause === 'stash') lines.push(`${who || '何者か'}が運び込んだ（${ago(this, n.t)}）`);
      else lines.push(`倒れた${who || '何者か'}が落としていった（${ago(this, n.t)}）`);
      return { title: `金貨${o.gold}枚`, lines };
    }
    case 'grave': {
      const g = this.graves.find((q) => q.id === s.id)!;
      return this.describeGrave(g);
    }
    case 'statue': {
      const o = this.statues.find((q) => q.id === s.id)!;
      const known = !!this.discovered[o.k];
      const title = `${known ? NAMES[o.k] : UNKNOWN}${known && n?.name && o.k !== Kind.Adventurer ? `「${n.name}」` : ''}の石像`;
      if (known && n?.name && o.k === Kind.Adventurer) lines.push(`${whoName(this, n)}が石になった姿`);
      lines.push(n ? `石になったのは${ago(this, n.t)}` : 'いつ石になったのかはわからない');
      if (o.blocks) lines.push('通り道をふさいでいる');
      return { title, lines };
    }
    case 'cache': {
      const o = this.caches.find((q) => q.id === s.id)!;
      lines.push(`${n?.name ? `${n.name}の一行` : 'ある一行'}が深部の探索のために残した（${ago(this, o.at)}）`);
      lines.push(o.food <= 0 ? '空になっている' : o.food < 60 ? '食料が少し残っている' : '食料が積まれている');
      return { title: '物資の置き場', lines };
    }
    case 'camp': {
      const o = this.camps.find((q) => this.tileOf(q.x, q.y) === s.id)!;
      if (o.kind === 1) {
        lines.push((o.dry ?? 0) > 0 ? 'まわりの水が涸れかけている' : '水辺に建っている');
        return { title: `${kindName(this, Kind.Lizardman)}の小屋`, lines };
      }
      const name = `${kindName(this, Kind.Goblin)}の集落`;
      if (o.id < 0) return { title: `${name}の跡`, lines: ['もう誰も住んでいない'] };
      const n2 = this.campMembers(o).length;
      lines.push(n2 > 0 ? `${n2}匹が暮らしている` : '住む者がいない');
      if (o.hide) lines.push('みな暗がりに散って、身をひそめている');
      lines.push((o.fuel ?? 0) > 0 ? 'かがり火が燃えている' : 'かがり火は消えている');
      const st = o.store ?? 0;
      const fr = st / Math.max(1, this.campStoreGoal(o));
      lines.push(st <= 0 ? '蓄えは尽きている' : fr >= 0.67 ? '蓄えがたっぷりある' : fr >= 0.34 ? '蓄えがいくらかある' : '蓄えは少ない');
      if (o.lx || o.ly) lines.push(`${kindName(this, Kind.Orc)}に従っている`);
      if ((o.raids ?? 0) > 0) lines.push(`近ごろ${o.raids}回襲われた`);
      return { title: name, lines };
    }
    case 'fire': {
      const p = this.parties.find((q) => q.id === s.id)!;
      const t = this.partyTitle(p);
      lines.push(`${t ? `${t}の一行` : '冒険者の一行'}が休んでいる`);
      return { title: '焚き火', lines };
    }
    default:
      return { title: '', lines };
  }
}

declare module '../ecology' {
  interface Ecology {
    pickThing: typeof pickThing;
    thingPos: typeof thingPos;
    describeThing: typeof describeThing;
  }
}

Object.assign(Ecology.prototype, { pickThing, thingPos, describeThing });
