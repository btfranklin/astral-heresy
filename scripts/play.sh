#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
  PYTHON_MAJOR=3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
  PYTHON_MAJOR=$("$PYTHON" -c "import sys; print(sys.version_info[0])" 2>/dev/null || echo 0)
else
  echo "Python is required to run a local server." >&2
  exit 1
fi

port_is_available() {
  "$PYTHON" - "$1" <<'PY'
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    sock.bind(("127.0.0.1", port))
except OSError:
    raise SystemExit(1)
finally:
    sock.close()
PY
}

find_fallback_port() {
  "$PYTHON" - <<'PY'
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(("127.0.0.1", 0))
print(sock.getsockname()[1])
sock.close()
PY
}

if [[ -n "${PORT:-}" ]]; then
  if ! port_is_available "$PORT"; then
    echo "Port $PORT is already in use. Set PORT to a free port and try again." >&2
    exit 1
  fi
else
  # A fresh origin prevents Safari from combining native ES modules cached
  # during different source revisions.
  PORT=$(find_fallback_port)
fi

URL="http://127.0.0.1:${PORT}/"
OPEN_URL="${URL}?play_run=$(date +%s)"

if [[ "$PYTHON_MAJOR" != "3" ]]; then
  echo "Python 3 is required to run the cache-safe local server." >&2
  exit 1
fi

"$PYTHON" "$ROOT_DIR/scripts/serve_local.py" "$PORT" --directory "$ROOT_DIR" >/dev/null 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 0.3

OPENED_BROWSER=false

if command -v open >/dev/null 2>&1; then
  if open "$OPEN_URL"; then
    OPENED_BROWSER=true
  fi
elif command -v xdg-open >/dev/null 2>&1; then
  if xdg-open "$OPEN_URL"; then
    OPENED_BROWSER=true
  fi
fi

echo "Server running at $URL"
if [[ "$OPENED_BROWSER" == "true" ]]; then
  echo "If a browser tab did not appear, open this URL manually:"
else
  echo "Open this URL in your browser:"
fi
echo "$URL"
echo "Press Ctrl+C to stop."
wait "$SERVER_PID"
