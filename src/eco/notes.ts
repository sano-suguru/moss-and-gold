/**
 * Ecology のメソッド：死骸・落とし物・金貨の山・石像・物資の置き場の「いきさつ」を覚えておく（src/ecology.ts のクラスに、prototype で足す）。
 *
 * 画面で見えること：死骸や宝に触れると、情報パネルに「何に倒されたか」「誰が落としたか」「いつからそこにあるか」が出る。
 * 覚え書き（Ecology.notes）は情報パネルのためだけのもので、シミュレーションの判断には使わない。セーブには入れる（ロードし直しても同じ説明が出るように）。
 * 物が消えても覚え書きはすぐには消さず、数が増えたときに、もう無い物の分をまとめて捨てる（いつ捨てるかは覚え書きの数だけで決まるので、決定的）。
 */
import { Cr, Ecology, Kind, Note, Party } from '../ecology';
import { heroTitle } from './roster';

/** 覚え書きの数がこれを超えたら、もう無い物の分を捨てる */
const NOTES_MAX = 900;

/** 生き物の呼び名（名のある冒険者は位と名前、一行の頭は一行の名前、特別な個体はその名前）。無ければ空。ここで新しい名前は作らない */
export function noteName(this: Ecology, c: Cr): string {
  if (c.k === Kind.Adventurer) {
    const h = this.heroOf(c);
    if (h) return heroTitle(h);
    const p = this.parties.find((o) => o.id === c.party);
    if (p && p.members[0] === c.id && p.name) return p.name;
    return '';
  }
  if (c.elite) return this.names.get(c.id) ?? '';
  return '';
}

/** 物の番号に、いきさつを覚えさせる */
export function note(this: Ecology, id: number, n: Note): void {
  this.notes.set(id, n);
  if (this.notes.size > NOTES_MAX) this.pruneNotes();
}

/**
 * 持ち主（倒れた者、落とした者）を表す覚え書き。how はどうしてそこにあるか：
 * 'fell' 倒れた（石になった）ときに残した、'spent' 燃え尽きた松明を捨てた、'shed' リビングアーマーが打たれて手の武器を落とした、'stash' 金貨を寝床や集落へ運び込んだ
 */
export function ownerNote(this: Ecology, c: Cr | undefined, how?: string): Note {
  const n: Note = { t: this.w.tick };
  if (how) n.cause = how;
  if (!c) return n;
  n.who = c.k;
  if (c.k === Kind.Adventurer || c.k === Kind.Dwarf) n.job = c.sp;
  const nm = this.noteName(c);
  if (nm) n.name = nm;
  return n;
}

/** 倒れた生き物の死骸に、死んだ理由と倒した相手を覚えさせる（die と eat から） */
export function noteDeath(this: Ecology, c: Cr, cause: string, by: number, killer?: Cr): void {
  const n = this.ownerNote(c, cause);
  if (by >= 0) {
    n.by = by;
    // 倒した者（わからなければ最後に襲ってきた相手で、倒した種と同じもの）の名前も
    const f = killer ?? this.byId.get(c.foe);
    if (f && f.k === by) {
      const nm = this.noteName(f);
      if (nm) n.bn = nm;
    }
  }
  this.note(c.id, n);
}

/** 一行が置いた物（物資の置き場、全滅した一行の戦利品） */
export function partyNote(this: Ecology, p: Party): Note {
  const nm = this.partyTitle(p);
  return nm ? { t: this.w.tick, who: Kind.Adventurer, name: nm } : { t: this.w.tick, who: Kind.Adventurer };
}

/** もう無い物の覚え書きを捨てる */
export function pruneNotes(this: Ecology): void {
  const live = new Set<number>();
  for (const c of this.list) if (c.dead === 1) live.add(c.id);
  for (const o of this.gear) live.add(o.id);
  for (const o of this.piles) live.add(o.id);
  for (const o of this.statues) live.add(o.id);
  for (const o of this.caches) live.add(o.id);
  for (const id of [...this.notes.keys()]) if (!live.has(id)) this.notes.delete(id);
}

declare module '../ecology' {
  interface Ecology {
    noteName: typeof noteName;
    note: typeof note;
    ownerNote: typeof ownerNote;
    noteDeath: typeof noteDeath;
    partyNote: typeof partyNote;
    pruneNotes: typeof pruneNotes;
  }
}

Object.assign(Ecology.prototype, { noteName, note, ownerNote, noteDeath, partyNote, pruneNotes });
