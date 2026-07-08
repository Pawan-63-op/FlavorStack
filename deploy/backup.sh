set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONGO_CONTAINER="${MONGO_CONTAINER:-deploy-mongo-1}"
MONGO_DB="${MONGO_DB:-flavorstack}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
KEEP="${KEEP:-7}"

log()  { printf '  • %s\n' "$*"; }
head() { printf '\n=== %s ===\n' "$*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

docker exec "$MONGO_CONTAINER" true 2>/dev/null || die "container '$MONGO_CONTAINER' not running (is the prod stack up? deploy/deploy.sh)."

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/${MONGO_DB}-${STAMP}.gz"

head "Dumping '$MONGO_DB' from $MONGO_CONTAINER"
if docker exec "$MONGO_CONTAINER" mongodump --db "$MONGO_DB" --archive --gzip >"$OUT" 2>/dev/null; then
  log "wrote $OUT ($(du -h "$OUT" | cut -f1))"
else
  rm -f "$OUT"
  die "mongodump failed."
fi

head "Pruning old backups (keeping $KEEP)"
mapfile -t OLD < <(ls -1t "$BACKUP_DIR/${MONGO_DB}-"*.gz 2>/dev/null | tail -n "+$((KEEP + 1))")
if [ "${#OLD[@]}" -gt 0 ]; then
  for f in "${OLD[@]}"; do rm -f "$f" && log "removed $(basename "$f")"; done
else
  log "nothing to prune"
fi

head "Done"
log "Restore with: deploy/rollback.sh $OUT"
