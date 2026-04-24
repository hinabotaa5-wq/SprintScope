#!/usr/bin/env bash
# 生成した deploy/ フォルダをそのままホスティングのルートにアップロードすれば動きます。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy"
rm -rf "$OUT"
mkdir -p "$OUT"

cp "$ROOT/index.html" "$OUT/"
cp "$ROOT/account.html" "$OUT/"
cp "$ROOT/supabase-client.js" "$OUT/"
cp -R "$ROOT/board" "$OUT/"
cp -R "$ROOT/question-box" "$OUT/"

echo "OK: $OUT (index.html, account.html, supabase-client.js, board/, question-box/)"
