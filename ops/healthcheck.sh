set -uo pipefail   # NOTE: no -e; we want to run all checks and aggregate.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/server_2"
MONGO_CONTAINER="${MONGO_CONTAINER:-server_2-mongo-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-server_2-redis-1}"
API_BASE="${API_BASE:-http://localhost:3000}"

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
for svc in api worker-relay worker-jobs; do
  state="$(docker compose -f "$SERVER_DIR/docker-compose.yml" -f "$SERVER_DIR/docker-compose.dev.yml" \
           ps --status running --services 2>/dev/null | grep -Fx "$svc" || true)"
  [ -n "$state" ] && ok "$svc running" || bad "$svc not running"
done

head "API readiness (/health)"
BODY="$(curl -s -w '\n%{http_code}' "$API_BASE/health" 2>/dev/null || printf '\n000')"
CODE="$(printf '%s' "$BODY" | tail -n1)"
if [ "$CODE" = "200" ]; then
  ok "GET /health → 200"
else
  bad "GET /health → $CODE (expected 200)"
fi
# The body is identical on 200 and 503, so the dependency rows are always meaningful.
for dep in mongo redis; do
  if printf '%s' "$BODY" | grep -q "\"$dep\":true"; then
    ok "checks.$dep = true"
  else
    bad "checks.$dep not ok"
  fi
done

head "Result"
if [ "$FAIL" -eq 0 ]; then
  echo "  All checks passed."
else
  echo "  One or more checks FAILED — see above."
fi
exit "$FAIL"
