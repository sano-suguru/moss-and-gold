/**
 * 状態（ゲームのセーブデータと同じ形の JSON）のシリアライズと読み書き。checkpoint.json と、スナップショットのキャッシュ（*.json.gz）で使う。
 */
import { gunzipSync, gzipSync } from 'node:zlib';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { World } from './engine';

const b64 = (u: Uint8Array) => Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString('base64');
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));
const bits = (a: Uint8Array) => {
  const b = new Uint8Array(Math.ceil(a.length / 8));
  for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7);
  return b64(b);
};
const unbits = (s: string, n: number) => {
  const b = unb64(s);
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = (b[i >> 3] >> (i & 7)) & 1;
  return a;
};
const i32 = (s: string) => {
  const u = unb64(s);
  return new Int32Array(u.buffer, u.byteOffset, u.byteLength / 4).slice();
};

/** セーブデータの形（JSON にできるもの） */
export type Saved = Record<string, any> & { seed: string; tick: number; n: number };

export function encodeState(w: World): Saved {
  return {
    v: 5, n: w.map.w * w.map.h, seed: w.map.seed, tick: w.tick, cam: { x: w.map.entrance.x * 16, y: 200, zoom: 2 }, speed: 1,
    seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus),
    burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, mana: b64(new Uint8Array(w.mana.buffer)), manaBorn: w.manaBorn, manaLeaked: w.manaLeaked, manaFaded: w.manaFaded, digs: w.digs.slice(), eco: w.eco.serialize(),
  };
}

export function decodeState(s: Saved): World {
  const N = s.n;
  return new World(s.seed, {
    tick: s.tick, seen: unbits(s.seen, N), water: i32(s.water), nutr: i32(s.nutr),
    moss: unb64(s.moss), fungus: unb64(s.fungus), burn: unb64(s.burn), ash: unb64(s.ash), mat: unb64(s.mat), born: s.born, washed: s.washed, mana: s.mana ? i32(s.mana) : undefined, manaBorn: s.manaBorn, manaLeaked: s.manaLeaked, manaFaded: s.manaFaded, digs: s.digs, eco: s.eco,
  });
}

/** 状態を読む（.json.gz でも .json でも） */
export function readState(path: string): Saved {
  const b = readFileSync(path);
  return JSON.parse((path.endsWith('.gz') ? gunzipSync(b) : b).toString('utf8'));
}

/** 状態を書き出す（途中で止まっても壊れたファイルが残らないよう、一時ファイルに書いてからリネームする） */
export function writeState(path: string, s: Saved | string): void {
  const txt = typeof s === 'string' ? s : JSON.stringify(s);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, path.endsWith('.gz') ? gzipSync(txt, { level: 4 }) : txt);
  renameSync(tmp, path);
}

export const stateExists = (p: string) => existsSync(p);
