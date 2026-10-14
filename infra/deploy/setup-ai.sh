#!/usr/bin/env bash
set -euo pipefail
base=/home/ubuntu/ping-shen-me
exec 9>"$base/shared/.deploy.lock"
flock 9
test -f "$base/current/apps/ai/requirements.txt"
bash "$base/current/infra/deploy/prepare-ai-runtime.sh" "$base/current/apps/ai/requirements.txt"
hash=$(sha256sum "$base/current/apps/ai/requirements.txt" | cut -d ' ' -f 1)
api_backup=$(mktemp)
ai_backup=$(mktemp)
unit=$(mktemp)
cp "$base/shared/api.env" "$api_backup"
ai_existed=false
if [[ -f "$base/shared/ai.env" ]]; then
  cp "$base/shared/ai.env" "$ai_backup"
  ai_existed=true
fi
success=false
services_touched=false
cleanup() {
  if [[ $success != true ]]; then
    install -m 600 "$api_backup" "$base/shared/api.env"
    if [[ $ai_existed == true ]]; then
      install -m 600 "$ai_backup" "$base/shared/ai.env"
    fi
    if [[ $services_touched == true ]]; then
      sudo systemctl restart ping-shen-me-ai.service || true
      sudo systemctl restart ping-shen-me-api.service || true
    fi
  fi
  rm -f "$api_backup" "$ai_backup" "$unit"
}
trap cleanup EXIT
"$base/runtime/ai/$hash/bin/python" "$base/current/infra/deploy/configure-ai-server.py"
install -m 755 "$base/current/infra/deploy/start-ai.sh" "$base/shared/start-ai.sh"
cat >"$unit" <<'UNIT'
[Unit]
Description=Ping Shen Me Python AI service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ping-shen-me/current/apps/ai
EnvironmentFile=/home/ubuntu/ping-shen-me/shared/ai.env
ExecStart=/home/ubuntu/ping-shen-me/shared/start-ai.sh
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
sudo install -m 644 "$unit" /etc/systemd/system/ping-shen-me-ai.service
sudo systemctl daemon-reload
services_touched=true
sudo systemctl enable ping-shen-me-ai.service
sudo -n systemctl restart ping-shen-me-ai.service
sudo systemctl restart ping-shen-me-api.service
for _ in $(seq 1 15); do
  if curl -fsS --max-time 3 http://127.0.0.1:8105/api/v1/health/ready | grep -q '"ai_service":"connected"'; then
    # 就绪检查通过后，后续 main 发布才会同时更新和重启 Python 服务。
    install -m 755 "$base/current/infra/deploy/receive-release.sh" "$base/shared/receive-release.sh"
    touch "$base/shared/.ai-enabled"
    success=true
    echo 'Python AI service and API are ready'
    exit
  fi
  sleep 2
done
echo 'AI readiness failed; restoring original service configuration. Check shared/ai.env and systemd logs.' >&2
exit 1
