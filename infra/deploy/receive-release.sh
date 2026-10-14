#!/usr/bin/env bash
set -euo pipefail

base=/home/ubuntu/ping-shen-me
service=ping-shen-me-api.service
health=http://127.0.0.1:8105/api/v1/health/ready

if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^check-deps\ ([0-9a-f]{64})$ ]]; then
  expected=${BASH_REMATCH[1]}
  test -d "$base/current/apps/api/node_modules"
  test -f "$base/current/.dependency-hash"
  test "$(cat "$base/current/.dependency-hash")" = "$expected"
  exit
fi

if [[ ! ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})\ (full|reuse)\ ([0-9a-f]{64})$ ]]; then
  echo 'Unsupported deploy command' >&2
  exit 2
fi
sha=${BASH_REMATCH[1]}
mode=${BASH_REMATCH[2]}
lock_hash=${BASH_REMATCH[3]}

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
  test "$(cat "$incoming/.dependency-hash")" = "$lock_hash"
  if [[ $mode == reuse ]]; then
    test "$(cat "$base/current/.dependency-hash")" = "$lock_hash"
    cp -a "$base/current/apps/api/node_modules" "$incoming/apps/api/"
  fi
  test -f "$incoming/apps/api/dist/server.js"
  test -d "$incoming/apps/api/node_modules"
  test -d "$incoming/apps/api/drizzle"
  test -f "$incoming/apps/web/dist/index.html"
  # mktemp creates a 0700 directory; Nginx must be able to traverse the release root.
  chmod 755 "$incoming"
  mv "$incoming" "$release"
  trap - EXIT
fi

previous=$(readlink "$base/current")
if [[ -f "$base/shared/.ai-enabled" ]]; then
  test -f "$release/apps/ai/requirements.txt"
  bash "$release/infra/deploy/prepare-ai-runtime.sh" "$release/apps/ai/requirements.txt"
fi
ln -s "releases/$sha" "$base/.current-next"
mv -Tf "$base/.current-next" "$base/current"

healthy=false
services_started=true
if [[ -f "$base/shared/.ai-enabled" ]]; then
  if ! sudo -n systemctl restart ping-shen-me-ai.service; then
    services_started=false
  fi
fi
if [[ $services_started == true ]] && sudo -n systemctl restart "$service"; then
  for _ in $(seq 1 20); do
    if curl -fsS --max-time 3 "$health" | grep -q '"status":"ok"' \
      && curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:8105/welcome \
      && curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:8105/assets/pixel/orchard.webp; then
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
  if [[ -f "$base/shared/.ai-enabled" ]]; then
    sudo -n systemctl restart ping-shen-me-ai.service || echo 'AI rollback restart failed; manual attention required' >&2
  fi
  sudo -n systemctl restart "$service" || echo 'API rollback restart failed; manual attention required' >&2
  exit 1
fi

echo "Deployed $sha"
