set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/server_2"
APP_DIR="$REPO_ROOT/my-app"
FE_PID_FILE="$REPO_ROOT/.dev-frontend.pid"
FE_LOG="$REPO_ROOT/.dev-frontend.log"
FE_PORT="${FE_PORT:-3100}"
MONGO_CONTAINER="${MONGO_CONTAINER:-server_2-mongo-1}"

START_FRONTEND=1
RUN_SEED=0
for arg in "$@"; do
  case "$arg" in
    --no-frontend) START_FRONTEND=0 ;;
    --seed)        RUN_SEED=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '  • %s\n' "$*"; }
head() { printf '\n=== %s ===\n' "$*"; }

head "Backend stack (docker compose: base + dev override)"
docker compose \
  -f "$SERVER_DIR/docker-compose.yml" \
  -f "$SERVER_DIR/docker-compose.dev.yml" \
  up -d --build --remove-orphans
log "compose up -d issued"

head "Waiting for Mongo replica set rs0"
for i in $(seq 1 30); do
  if docker exec "$MONGO_CONTAINER" mongosh --quiet --eval 'rs.status().ok' 2>/dev/null | grep -q '^1$'; then
    log "replica set rs0 is ready (rs.status().ok === 1)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Mongo replica set did not become ready in time." >&2
    echo "       Inspect with: docker compose -f $SERVER_DIR/docker-compose.yml logs mongo mongo-init" >&2
    exit 1
  fi
  sleep 2
done

if [ "$START_FRONTEND" -eq 1 ]; then
  head "Frontend dev server (:$FE_PORT)"
  if [ -f "$FE_PID_FILE" ] && kill -0 "$(cat "$FE_PID_FILE")" 2>/dev/null; then
    log "frontend already running (PID $(cat "$FE_PID_FILE")) — leaving it"
  else
    ( cd "$APP_DIR" && nohup npm run dev -- --port "$FE_PORT" >"$FE_LOG" 2>&1 & echo $! >"$FE_PID_FILE" )
    log "started Next.js dev on http://localhost:$FE_PORT (PID $(cat "$FE_PID_FILE"))"
    log "frontend logs → $FE_LOG"
  fi
fi

if [ "$RUN_SEED" -eq 1 ]; then
  head "Seeding demo accounts"
  "$REPO_ROOT/ops/seed-demo.sh"
fi

head "Dev stack up"
log "API:        http://localhost:3000/api/v1"
[ "$START_FRONTEND" -eq 1 ] && log "Frontend:   http://localhost:$FE_PORT"
log "Inspect:    ops/monitor.sh   |   Stop: ops/dev-stop.sh"
