#!/usr/bin/env bash
set -euo pipefail
base=/home/ubuntu/ping-shen-me
hash=$(sha256sum "$base/current/apps/ai/requirements.txt" | cut -d ' ' -f 1)
cd "$base/current/apps/ai"
exec "$base/runtime/ai/$hash/bin/python" -m uvicorn ai_service.main:app --host 127.0.0.1 --port 8002
