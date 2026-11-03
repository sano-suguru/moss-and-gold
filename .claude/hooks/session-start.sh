#!/bin/bash
# SessionStart フック（クラウドのセッションだけ）：main のシミュレーションのキャッシュを、GitHub の Release「sim-cache」から取得する。
# Actions の simcache.yml が main へのマージごとに作って置いている。まだ置かれていなければ何もしない（手元で実行する）。
# 取ってくるのは裏で行い、セッションの始まりを待たせない。様子は runs/.cache/fetched/log.txt。
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
mkdir -p runs/.cache/fetched

(
  # ツールのビルドに esbuild が要る
  if [ ! -d node_modules/esbuild ]; then
    npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1
  fi
  # A/B 比較のベースになる main のバージョンで取得する（作業中のブランチの src ではなく。ツールは作業ツリーのもの）
  git fetch -q origin main 2>/dev/null || true
  repo=$(git remote get-url origin | sed -E 's#(\.git)?$##' | awk -F/ '{print $(NF-1)"/"$NF}')
  echo "--- $(date -u +%FT%TZ)"
  GITHUB_REPOSITORY="$repo" node tools/analysis/simcache.mjs fetch --ref origin/main
) >> runs/.cache/fetched/log.txt 2>&1 &
disown 2>/dev/null || true

exit 0
