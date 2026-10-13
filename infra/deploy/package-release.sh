#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo 'Usage: package-release.sh OUTPUT.tar.gz' >&2
  exit 2
fi

output="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

pnpm --filter @apple/api deploy --prod --legacy "$work_dir/api"

mkdir -p "$work_dir/release/apps/api" "$work_dir/release/apps/web" "$work_dir/release/infra/deploy"
cp -a "$work_dir/api/dist" "$work_dir/api/drizzle" "$work_dir/api/node_modules" "$work_dir/api/package.json" "$work_dir/release/apps/api/"
cp -a apps/web/dist "$work_dir/release/apps/web/"
cp infra/deploy/receive-release.sh "$work_dir/release/infra/deploy/"

# Only these runtime paths enter the artifact. In particular, local .env and .data never do.
tar -C "$work_dir/release" -czf "$output" apps infra
echo "Release artifact: $output"
