set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
COMPOSE=(docker compose -f "$COMPOSE_FILE")
MONGO_CONTAINER="${MONGO_CONTAINER:-deploy-mongo-1}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://localhost}"

RUN_SEED=0
for arg in "$@"; do
  case "$arg" in
    --seed) RUN_SEED=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '  • %s\n' "$*"; }
head() { printf '\n=== %s ===\n' "$*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

head "Preflight"
command -v docker >/dev/null 2>&1 || die "docker not found on PATH."
docker info >/dev/null 2>&1 || die "docker daemon not reachable (is Docker running?)."
[ -f "$REPO_ROOT/server_2/.env" ] || die "server_2/.env missing — it holds the prod secrets (RS256 JWT keypair, RESEND_API_KEY). See server_2/.env.example + deploy/.env.production.example."
if [ ! -f "$SCRIPT_DIR/nginx/certs/fullchain.pem" ]; then
  log "no TLS cert found — generating a self-signed one (LOCAL only)"
  "$SCRIPT_DIR/nginx/gen-cert.sh"
fi
log "docker OK · server_2/.env present · TLS cert present"
log "public origin: $PUBLIC_ORIGIN"

head "Build + start the production stack"
"${COMPOSE[@]}" up -d --build
log "compose up -d --build issued"

head "Waiting for Mongo replica set rs0"
for i in $(seq 1 30); do
  if docker exec "$MONGO_CONTAINER" mongosh --quiet --eval 'rs.status().ok' 2>/dev/null | grep -q '^1$'; then
    log "replica set rs0 ready (rs.status().ok === 1)"
    break
  fi
  [ "$i" -eq 30 ] && die "Mongo replica set did not become ready. Inspect: ${COMPOSE[*]} logs mongo mongo-init"
  sleep 2
done

head "Waiting for services to become healthy"
for i in $(seq 1 30); do
  if "$SCRIPT_DIR/healthcheck.sh" >/dev/null 2>&1; then
    log "all health checks passed"
    break
  fi
  [ "$i" -eq 30 ] && { echo; "$SCRIPT_DIR/healthcheck.sh" || true; die "Stack did not become healthy in time (see checks above)."; }
  sleep 4
done

if [ "$RUN_SEED" -eq 1 ]; then
  head "Seeding demo accounts (prod stack)"
  MONGO_CONTAINER="$MONGO_CONTAINER" API_BASE="$PUBLIC_ORIGIN" CURL_INSECURE=1 "$REPO_ROOT/ops/seed-demo.sh"
fi

head "Production stack up"
log "App:      $PUBLIC_ORIGIN/"
log "API:      $PUBLIC_ORIGIN/api/v1"
log "Health:   deploy/healthcheck.sh   |   Snapshot: MONGO_CONTAINER=$MONGO_CONTAINER ops/monitor.sh"
log "Backup:   deploy/backup.sh        |   Stop: ${COMPOSE[*]} down"
