#!/bin/bash
# セッションの始まり（クラウドのセッションだけ）：main の版の検証の保存庫を、GitHub の Release「sim-cache」から取ってくる。
# Actions の simcache.yml が main へのマージごとに作って置いている。まだ置かれていなければ何もしない（いまどおり手元で回す）。
# 取ってくるのは裏で行い、セッションの始まりを待たせない。様子は runs/.cache/fetched/log.txt。
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
mkdir -p runs/.cache/fetched

(
  # 道具を組み立てるのに esbuild が要る
  if [ ! -d node_modules/esbuild ]; then
    npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1
  fi
  # 比べる土台になる main の版の名前で取る（作業中のブランチの src ではなく。道具はいまのもの）
  git fetch -q origin main 2>/dev/null || true
  repo=$(git remote get-url origin | sed -E 's#(\.git)?$##' | awk -F/ '{print $(NF-1)"/"$NF}')
  echo "--- $(date -u +%FT%TZ)"
  GITHUB_REPOSITORY="$repo" node tools/analysis/simcache.mjs fetch --ref origin/main
) >> runs/.cache/fetched/log.txt 2>&1 &
disown 2>/dev/null || true

exit 0
