set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
COMPOSE=(docker compose -f "$COMPOSE_FILE")
MONGO_CONTAINER="${MONGO_CONTAINER:-deploy-mongo-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-deploy-redis-1}"
MONGO_DB="${MONGO_DB:-flavorstack}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"

ASSUME_YES=0
BACKUP_FILE=""
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    -*) echo "Unknown flag: $arg" >&2; exit 2 ;;
    *)  BACKUP_FILE="$arg" ;;
  esac
done

log()  { printf '  • %s\n' "$*"; }
head() { printf '\n=== %s ===\n' "$*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE="$(ls -1t "$BACKUP_DIR/${MONGO_DB}-"*.gz 2>/dev/null | head -1 || true)"
  [ -n "$BACKUP_FILE" ] || die "no backups found in $BACKUP_DIR — run deploy/backup.sh first."
fi
[ -f "$BACKUP_FILE" ] || die "backup file not found: $BACKUP_FILE"

head "Rollback plan"
log "restore : $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
log "target  : $MONGO_DB @ $MONGO_CONTAINER  (collections DROPPED then reloaded)"
log "redis   : FLUSHALL @ $REDIS_CONTAINER   (sessions/cache cleared)"

if [ "$ASSUME_YES" -ne 1 ]; then
  printf '\nThis REPLACES the live database. Continue? [y/N] '
  read -r reply
  case "$reply" in y|Y|yes|YES) ;; *) die "aborted." ;; esac
fi

head "Ensuring Mongo replica set is up"
"${COMPOSE[@]}" up -d mongo mongo-init
for i in $(seq 1 30); do
  if docker exec "$MONGO_CONTAINER" mongosh --quiet --eval 'rs.status().ok' 2>/dev/null | grep -q '^1$'; then
    log "replica set rs0 ready"
    break
  fi
  [ "$i" -eq 30 ] && die "Mongo replica set did not become ready."
  sleep 2
done

head "Restoring database (mongorestore --drop)"
if docker exec -i "$MONGO_CONTAINER" mongorestore --archive --gzip --drop --quiet <"$BACKUP_FILE"; then
  log "restore complete"
else
  die "mongorestore failed — the database may be partially restored."
fi

head "Flushing Redis (stale cache/sessions after a data rollback)"
if docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL >/dev/null 2>&1; then
  log "redis FLUSHALL done"
else
  log "WARNING: could not flush Redis (is it up?) — stale cache may persist"
fi

head "Restarting the rest of the stack (current images)"
"${COMPOSE[@]}" up -d
log "compose up -d issued"

head "Rollback done — verifying"
"$SCRIPT_DIR/healthcheck.sh" || die "post-rollback health check FAILED."
