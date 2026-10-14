#!/usr/bin/env bash
set -euo pipefail
base=/home/ubuntu/ping-shen-me
requirements=$(realpath "${1:?Missing requirements path}")
case "$requirements" in "$base/"*/apps/ai/requirements.txt) ;; *) echo 'Unexpected requirements path' >&2; exit 2 ;; esac
hash=$(sha256sum "$requirements" | cut -d ' ' -f 1)
runtime="$base/runtime/ai/$hash"
if [[ ! -f "$runtime/.ready" ]]; then
  python3 -c 'import sys; assert sys.version_info >= (3, 10), "Python 3.10+ is required"'
  mkdir -p "$base/runtime/ai"
  python3 -m venv "$runtime"
  "$runtime/bin/python" -m pip install --disable-pip-version-check -r "$requirements"
  touch "$runtime/.ready"
fi
echo "AI runtime prepared: $hash"
