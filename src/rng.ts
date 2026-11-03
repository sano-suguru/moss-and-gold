// 決定的な乱数。整数演算だけを使うので、どのブラウザでも同じ列になる。

export function hashSeed(str: string): number {
  let h = (1779033703 ^ str.length) | 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 乱数生成器（sfc32） */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    this.a = seed | 0;
    this.b = 0x9e3779b9 | 0;
    this.c = 0x243f6a88 | 0;
    this.d = 0xb7e15162 | 0;
    for (let i = 0; i < 16; i++) this.u32();
  }

  u32(): number {
    let { a, b, c, d } = this;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    return t >>> 0;
  }

  /** 0 以上 n 未満の整数 */
  int(n: number): number {
    return this.u32() % n;
  }

  /** lo 以上 hi 以下の整数 */
  range(lo: number, hi: number): number {
    return lo + this.int(hi - lo + 1);
  }

  chance(p: number): boolean {
    return this.u32() / 4294967296 < p;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
}
