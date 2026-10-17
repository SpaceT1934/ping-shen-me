#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 || ! $2 =~ ^(full|reuse)$ || ! $3 =~ ^[0-9a-f]{64}$ ]]; then
  echo 'Usage: package-release.sh OUTPUT.tar.gz full|reuse LOCK_HASH' >&2
  exit 2
fi

output="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

mkdir -p "$work_dir/release/apps/api" "$work_dir/release/apps/web" "$work_dir/release/apps/ai" "$work_dir/release/infra/deploy"
if [[ $2 == full ]]; then
  pnpm --filter @apple/api deploy --prod --legacy "$work_dir/api"
  cp -a "$work_dir/api/node_modules" "$work_dir/release/apps/api/"
fi
cp -a apps/api/dist apps/api/drizzle apps/api/package.json "$work_dir/release/apps/api/"
cp -a apps/web/dist "$work_dir/release/apps/web/"
cp -a apps/ai/ai_service "$work_dir/release/apps/ai/"
find "$work_dir/release/apps/ai" -type d -name __pycache__ -prune -exec rm -r {} +
cp apps/ai/requirements.txt apps/ai/.env.example "$work_dir/release/apps/ai/"
cp infra/deploy/receive-release.sh infra/deploy/prepare-ai-runtime.sh infra/deploy/start-ai.sh infra/deploy/setup-ai.sh infra/deploy/configure-ai-server.py "$work_dir/release/infra/deploy/"
printf '%s\n' "$3" > "$work_dir/release/.dependency-hash"

# Only runtime asset URLs are checked. A generated share-card download may be named .png.
png_asset_pattern="/assets/[^\"'[:space:]<>)]*\\.png"
if grep -qE "$png_asset_pattern" "$work_dir/release/apps/web/dist/index.html" "$work_dir/release/apps/web/dist/assets/"*.css "$work_dir/release/apps/web/dist/assets/"*.js; then
  echo 'Built pages still reference PNG assets; update the package list first' >&2
  exit 1
fi
find "$work_dir/release/apps/web/dist/assets/pixel" -maxdepth 1 -type f -name '*.png' -delete

# Only these runtime paths enter the artifact. In particular, local .env and .data never do.
tar -C "$work_dir/release" -czf "$output" .
echo "Release artifact: $output"
