#!/usr/bin/env bash
set -euo pipefail

base=/home/ubuntu/ping-shen-me
service=ping-shen-me-api.service
health=http://127.0.0.1:8105/api/v1/health/ready

if [[ ! ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  echo 'Unsupported deploy command' >&2
  exit 2
fi
sha=${BASH_REMATCH[1]}

exec 9>"$base/shared/.deploy.lock"
flock 9

release="$base/releases/$sha"
if [[ -d $release ]]; then
  # Re-running the same commit reuses its existing, verified release.
  cat >/dev/null
else
  incoming=$(mktemp -d "$base/releases/.incoming-$sha.XXXXXX")
  trap 'rm -rf "$incoming"' EXIT
  tar -xzf - -C "$incoming" --no-same-owner
  test -f "$incoming/apps/api/dist/server.js"
  test -d "$incoming/apps/api/node_modules"
  test -d "$incoming/apps/api/drizzle"
  test -f "$incoming/apps/web/dist/index.html"
  mv "$incoming" "$release"
  trap - EXIT
fi

previous=$(readlink "$base/current")
ln -s "releases/$sha" "$base/.current-next"
mv -Tf "$base/.current-next" "$base/current"

healthy=false
if sudo -n systemctl restart "$service"; then
  for _ in $(seq 1 20); do
    if curl -fsS --max-time 3 "$health" | grep -q '"status":"ok"'; then
      healthy=true
      break
    fi
    sleep 2
  done
fi

if [[ $healthy != true ]]; then
  echo 'Health check failed; restoring previous release' >&2
  ln -s "$previous" "$base/.current-next"
  mv -Tf "$base/.current-next" "$base/current"
  sudo -n systemctl restart "$service"
  exit 1
fi

echo "Deployed $sha"
