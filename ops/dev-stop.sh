set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/server_2"
FE_PID_FILE="$REPO_ROOT/.dev-frontend.pid"

DOWN_VOLUMES=0
for arg in "$@"; do
  case "$arg" in
    --volumes|-v) DOWN_VOLUMES=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '  • %s\n' "$*"; }
head() { printf '\n=== %s ===\n' "$*"; }

kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

head "Frontend dev server"
if [ -f "$FE_PID_FILE" ]; then
  PID="$(cat "$FE_PID_FILE")"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill_tree "$PID"
    log "stopped frontend (PID $PID + descendants)"
  else
    log "frontend PID ${PID:-<empty>} not running"
  fi
  rm -f "$FE_PID_FILE"
else
  log "no frontend PID file — nothing to stop"
fi

head "Backend stack (docker compose down)"
DOWN_ARGS=(-f "$SERVER_DIR/docker-compose.yml" -f "$SERVER_DIR/docker-compose.dev.yml" down)
[ "$DOWN_VOLUMES" -eq 1 ] && DOWN_ARGS+=(--volumes)
docker compose "${DOWN_ARGS[@]}"
[ "$DOWN_VOLUMES" -eq 1 ] && log "dropped mongo-data + redis-data volumes" || log "data volumes preserved"

head "Dev stack down"
