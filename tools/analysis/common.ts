/** 分析ツールで共通に使うもの（種などの名前、引数の解析、PNG の書き出し） */
import { deflateSync } from 'node:zlib';
import { NAMES } from '../../src/names';

export const KIND_NAMES = NAMES;

/**
 * 足踏みの記録（sim.ts の stuck.jsonl）のうち、数えるもの。次の二つは、引っかかっているのではなく、その場にいるのが本来の姿なので除く：
 * その場で漂う種（ウィスプ 0、ゴースト 7）と、足踏みの間の半分以上をクモの巣に捕まってもがいていた者（web。記録を始める前の実行結果には無いので 0 とみなす）。
 * 記録そのものは全部残し、数えるときにここで除く（前のバージョンの実行結果とも同じ基準で比べられるように）
 */
export const countsAsStuck = (x: { k: number; web?: number }): boolean => x.k !== 0 && x.k !== 7 && !((x.web ?? 0) >= 0.5);
export const CAUSE_NAMES: Record<string, string> = {
  eaten: '食べられた', fight: '打ち合いで倒れた', starve: '飢えた', burned: '焼けた', crushed: '押しつぶされた',
  petrified: '石になった', killed: '襲われた', dried: '干からびた', faded: '消えた', planted: 'キノコになった', crumbled: '崩れて消えた', crumble: '崩れて消えた', sipped: '吸われた', other: 'その他',
};
export const ORIGIN_NAMES: Record<string, string> = { entrance: '正面の入口から来た', mouth: '地表の横穴から来た', fissure: '地底の裂け目から来た', river: '川の口から来た', shaft: '天井の裂け目から来た', soil: '土の養分から湧いた', mana: 'マナから湧いた', raised: '亡骸から起き上がった', gear: '床の武具から立ち上がった', born: '中で生まれた' };

export function parseArgs(argv: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      o[a.slice(2)] = v;
    }
  }
  return o;
}

/** 依存なしの PNG 書き出し（RGBA） */
export function encodePng(w: number, h: number, rgba: Uint8Array): Buffer {
  const crcTable = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (buf: Buffer) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
