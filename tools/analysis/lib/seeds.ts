/** 比較に使う決まったシードの組 */
export const SEEDS8 = ['abc', 'かしたれ', 'はじまりの洞窟', 'seed4', 'seed5', 'seed6', 'seed7', 'seed8'];
export const SEEDS16 = [...SEEDS8, 'seed40', 'seed41', 'seed18', 'seed27', 'seed23', 'seed35', 'seed17', 'seed30'];
/** 早めの確かめ（npm run check）と、手直しの効き目を見る標準（quick）、最終確認（final） */
export const PRESETS: Record<string, { seeds: string[]; days: number; fork?: number }> = {
  /** 8シード、前の版の10日目の状態から18日目まで（対にした比較。いまの版は8日ぶんだけ回す） */
  quick: { seeds: SEEDS8, days: 18, fork: 10 },
  /** 16シード×25日、最初から（最終確認） */
  final: { seeds: SEEDS16, days: 25 },
};
export function parseSeeds(s: string | undefined, def: string[]): string[] {
  if (!s) return def;
  if (s === '8') return SEEDS8;
  if (s === '16') return SEEDS16;
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}
