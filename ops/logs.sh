set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/server_2"
FE_LOG="$REPO_ROOT/.dev-frontend.log"

if [ "${1:-}" = "frontend" ]; then
  [ -f "$FE_LOG" ] || { echo "No frontend log at $FE_LOG (start with ops/dev-start.sh)"; exit 1; }
  exec tail -f "$FE_LOG"
fi

exec docker compose \
  -f "$SERVER_DIR/docker-compose.yml" \
  -f "$SERVER_DIR/docker-compose.dev.yml" \
  logs -f --tail=100 "$@"
