set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/server_2"
MONGO_CONTAINER="${MONGO_CONTAINER:-server_2-mongo-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-server_2-redis-1}"
MONGO_DB="${MONGO_DB:-flavorstack}"

# Two queues, one reason each: outbound HTTP that must retry (email), and delayed execution
# with no alternative (fulfillment — rider-offer expiry / SLA timeouts). Phase 8 removed
# dead-letter-queue; commerce/search-reindex/ordering/payments never existed in code.
QUEUES=(email-queue fulfillment-queue)

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

# f= is the dead-letter queue's replacement: `removeOnFail: false` retains an exhausted job in
# bull:<queue>:failed with its payload and failedReason. A non-zero f= is what to investigate.
head "BullMQ queue depths (waiting / active / delayed / failed-retained)"
for q in "${QUEUES[@]}"; do
  waiting=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN "bull:$q:wait" 2>/dev/null || echo '?')
  active=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN "bull:$q:active" 2>/dev/null || echo '?')
  delayed=$(docker exec "$REDIS_CONTAINER" redis-cli ZCARD "bull:$q:delayed" 2>/dev/null || echo '?')
  failed=$(docker exec "$REDIS_CONTAINER" redis-cli ZCARD "bull:$q:failed" 2>/dev/null || echo '?')
  printf '  • %-24s w=%s a=%s d=%s f=%s\n' "$q" "$waiting" "$active" "$delayed" "$failed"
done

# Since Phase 7.3 the relay is the *only* delivery path for `OrderRequested`, so a growing PENDING
# backlog means orders are not reaching restaurants — the single most informative number here.
# PROCESSING counts rows the relay has claimed; a non-zero count that does not drain means a relay
# died mid-batch (reclaimStale returns them to PENDING on the next boot). The oldest PENDING
# createdAt is the actual customer-visible lag; a count alone cannot tell a burst from a stall.
head "Outbox backlog (outbox collection)"
mongo_eval() {
  docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DB" --quiet --eval "$1" 2>/dev/null || echo 'n/a'
}
PENDING=$(mongo_eval 'try { db.outbox.countDocuments({status:"PENDING"}) } catch(e){ print("n/a") }')
PROCESSING=$(mongo_eval 'try { db.outbox.countDocuments({status:"PROCESSING"}) } catch(e){ print("n/a") }')
OLDEST=$(mongo_eval 'try {
  const r = db.outbox.find({status:"PENDING"}).sort({createdAt:1}).limit(1).toArray()[0];
  print(r ? r.createdAt.toISOString() + " (" + Math.round((Date.now() - r.createdAt.getTime())/1000) + "s ago)" : "none");
} catch(e){ print("n/a") }')
log "PENDING rows awaiting relay:   $PENDING"
log "PROCESSING (claimed by relay): $PROCESSING"
log "oldest PENDING createdAt:      $OLDEST"
