/** 比較に使う固定のシードの組 */
export const SEEDS8 = ['abc', 'かしたれ', 'はじまりの洞窟', 'seed4', 'seed5', 'seed6', 'seed7', 'seed8'];
export const SEEDS16 = [...SEEDS8, 'seed40', 'seed41', 'seed18', 'seed27', 'seed23', 'seed35', 'seed17', 'seed30'];
/** ab のプリセット：変更の効果を見る標準（quick）と、最終確認（final） */
export const PRESETS: Record<string, { seeds: string[]; days: number; fork?: number }> = {
  /** 8シード、ベースの10日目のスナップショットから18日目まで（A/B 比較。作業ツリーは8日分だけ実行する） */
  quick: { seeds: SEEDS8, days: 18, fork: 10 },
  /** 16シード×25日、0日目から（最終確認） */
  final: { seeds: SEEDS16, days: 25 },
};
export function parseSeeds(s: string | undefined, def: string[]): string[] {
  if (!s) return def;
  if (s === '8') return SEEDS8;
  if (s === '16') return SEEDS16;
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}
