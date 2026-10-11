#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! gh auth status >/dev/null 2>&1; then
  echo "Login first: gh auth login -h github.com -p https -w"
  exit 1
fi
gh repo create willnien10005914/DeepSeaFall --public --source=. --remote=origin --push 2>/dev/null \
  || git push -u origin main
git push -u origin cursor/deep-sea-fall-252b || true
echo "Done: https://github.com/willnien10005914/DeepSeaFall"
