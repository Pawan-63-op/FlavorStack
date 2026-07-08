set -uo pipefail   # NOTE: no -e; run all checks and aggregate the result.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
COMPOSE=(docker compose -f "$COMPOSE_FILE")
MONGO_CONTAINER="${MONGO_CONTAINER:-deploy-mongo-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-deploy-redis-1}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://localhost}"

FAIL=0
ok()   { printf '  [ OK ] %s\n' "$*"; }
bad()  { printf '  [FAIL] %s\n' "$*"; FAIL=1; }
head() { printf '\n=== %s ===\n' "$*"; }

head "MongoDB replica set"
if docker exec "$MONGO_CONTAINER" mongosh --quiet --eval 'rs.status().ok' 2>/dev/null | grep -q '^1$'; then
  ok "rs0 initiated (rs.status().ok === 1)"
else
  bad "rs0 not healthy"
fi

head "Redis"
if docker exec "$REDIS_CONTAINER" redis-cli PING 2>/dev/null | grep -q PONG; then
  ok "PING → PONG"
else
  bad "Redis not responding"
fi

head "Containers running"
RUNNING="$("${COMPOSE[@]}" ps --status running --services 2>/dev/null || true)"
for svc in api worker-outbox worker-email worker-notification worker-fulfillment my-app nginx; do
  if grep -Fxq "$svc" <<<"$RUNNING"; then ok "$svc running"; else bad "$svc not running"; fi
done

head "App reachable through nginx (no /health endpoint — probing a mounted route)"
CODE="$(curl -sk -o /dev/null -w '%{http_code}' "$PUBLIC_ORIGIN/api/v1/catalog/restaurants" 2>/dev/null || echo 000)"
if [ "$CODE" = "200" ]; then
  ok "GET $PUBLIC_ORIGIN/api/v1/catalog/restaurants → 200"
else
  bad "GET $PUBLIC_ORIGIN/api/v1/catalog/restaurants → $CODE (expected 200)"
fi

head "Result"
if [ "$FAIL" -eq 0 ]; then
  echo "  All checks passed."
else
  echo "  One or more checks FAILED — see above."
fi
exit "$FAIL"
