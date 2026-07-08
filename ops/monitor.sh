set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/server_2"
MONGO_CONTAINER="${MONGO_CONTAINER:-server_2-mongo-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-server_2-redis-1}"
MONGO_DB="${MONGO_DB:-flavorstack}"

QUEUES=(email-queue notification-queue dead-letter-queue commerce-queue \
        fulfillment-queue search-reindex-queue ordering-queue payments-queue)

head() { printf '\n=== %s ===\n' "$*"; }
log()  { printf '  • %s\n' "$*"; }

head "Containers"
docker compose -f "$SERVER_DIR/docker-compose.yml" -f "$SERVER_DIR/docker-compose.dev.yml" ps \
  || log "compose ps failed — is the stack up? (ops/dev-start.sh)"

head "MongoDB replica set"
if docker exec "$MONGO_CONTAINER" mongosh --quiet --eval 'rs.status().ok' 2>/dev/null | grep -q '^1$'; then
  PRIMARY="$(docker exec "$MONGO_CONTAINER" mongosh --quiet --eval \
    'rs.status().members.filter(m=>m.stateStr==="PRIMARY").map(m=>m.name).join(",")' 2>/dev/null || true)"
  log "rs0 OK (ok=1), primary=${PRIMARY:-unknown}"
else
  log "rs0 NOT healthy — check: docker compose logs mongo mongo-init"
fi

head "Redis"
if docker exec "$REDIS_CONTAINER" redis-cli PING 2>/dev/null | grep -q PONG; then
  log "PING → PONG"
else
  log "Redis not responding"
fi

head "BullMQ queue depths (waiting / active / delayed / failed)"
for q in "${QUEUES[@]}"; do
  waiting=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN "bull:$q:wait" 2>/dev/null || echo '?')
  active=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN "bull:$q:active" 2>/dev/null || echo '?')
  delayed=$(docker exec "$REDIS_CONTAINER" redis-cli ZCARD "bull:$q:delayed" 2>/dev/null || echo '?')
  failed=$(docker exec "$REDIS_CONTAINER" redis-cli ZCARD "bull:$q:failed" 2>/dev/null || echo '?')
  printf '  • %-24s w=%s a=%s d=%s f=%s\n' "$q" "$waiting" "$active" "$delayed" "$failed"
done

head "Outbox backlog (outbox collection)"
PENDING=$(docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DB" --quiet --eval \
  'try { db.outbox.countDocuments({status:"PENDING"}) } catch(e){ print("n/a") }' 2>/dev/null || echo 'n/a')
log "PENDING rows awaiting relay: $PENDING"
