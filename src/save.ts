const KEY = 'dungeon-aquarium-v2';
const OLD_KEY = 'dungeon-aquarium-v1';

export interface SaveData {
  v: 5;
  seed: string;
  tick: number;
  cam: { x: number; y: number; zoom: number };
  speed: number;
  /** 以下は base64 */
  seen: string;
  water?: string;
  nutr?: string;
  moss?: string;
  fungus?: string;
  burn?: string;
  ash?: string;
  mat?: string;
  mana?: string;
  manaBorn?: number;
  manaLeaked?: number;
  manaFaded?: number;
  born?: number;
  washed?: number;
  /** 掘られたマスの順番 */
  digs?: number[];
  /** 生き物たち */
  eco?: object;
}

function bytesToB64(b: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < b.length; i += CH) s += String.fromCharCode(...b.subarray(i, i + CH));
  return btoa(s);
}

function b64ToBytes(s: string): Uint8Array | undefined {
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return undefined;
  }
}

export function packBits(a: Uint8Array): string {
  const b = new Uint8Array(Math.ceil(a.length / 8));
  for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7);
  return bytesToB64(b);
}

export function unpackBits(s: string, n: number): Uint8Array | undefined {
  const b = b64ToBytes(s);
  if (!b) return undefined;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = ((b[i >> 3] ?? 0) >> (i & 7)) & 1;
  return out;
}

export function packI32(a: Int32Array): string {
  return bytesToB64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
}
export function unpackI32(s: string | undefined, n: number): Int32Array | undefined {
  if (!s) return undefined;
  const b = b64ToBytes(s);
  if (!b || b.length !== n * 4) return undefined;
  return new Int32Array(b.buffer.slice(0));
}
export function packU8(a: Uint8Array): string {
  return bytesToB64(a);
}
export function unpackU8(s: string | undefined, n: number): Uint8Array | undefined {
  if (!s) return undefined;
  const b = b64ToBytes(s);
  return b && b.length === n ? b : undefined;
}

/** セーブデータを読む。段階1のセーブデータしかない場合は、シードとカメラだけを引き継ぐ */
export function load(): SaveData | undefined {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const d = JSON.parse(s) as SaveData;
      if (d && (d as { v: number }).v === 5 && typeof d.seed === 'string' && typeof d.tick === 'number') return d;
      // 地形の作り方が変わる前のセーブデータ（v2：段階7a まで、v3：迷路の区画があったころ、v4：床へ1マスだけ突き出た岩があったころ）は、
      // 同じ言葉から新しいダンジョンとして始める（地形はセーブせず、ロードのたびにシードから作り直すので、古い生き物や水を新しい地形に載せられない）
      if (d && [2, 3, 4].includes((d as { v: number }).v) && typeof d.seed === 'string') return { v: 5, seed: d.seed, tick: 0, cam: d.cam, speed: d.speed ?? 1, seen: '' };
    }
    const o = localStorage.getItem(OLD_KEY);
    if (o) {
      const d = JSON.parse(o);
      if (d && typeof d.seed === 'string') return { v: 5, seed: d.seed, tick: 0, cam: d.cam, speed: d.speed ?? 1, seen: '' };
    }
  } catch {
    /* 読めない場合は新しく始める */
  }
  return undefined;
}

export function save(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* セーブできない環境（localStorage が使えないなど）では何もしない */
  }
}
