#!/usr/bin/env bash
#
# Phase 10-4.3 — backfill `hasVariants` onto the `menu_item_search` projection.
#
# The customer variant picker decides whether to open a dialog from `hasVariants` on the
# list views. The projector sets it from now on, but documents projected before this
# field existed read back `undefined` (falsy) — a variant item would silently skip the
# picker until its restaurant is next reprojected. This copies the flag from the catalog
# source of truth (`menu_items.variantGroups`) onto every existing projected document.
#
# Idempotent: re-running it recomputes the same value. Safe to run with the stack up.
#
#   ./ops/backfill-has-variants.sh
#
set -euo pipefail

MONGO_CONTAINER="${MONGO_CONTAINER:-server_2-mongo-1}"
MONGO_DB="${MONGO_DB:-flavorstack}"

echo "=== backfill menu_item_search.hasVariants (${MONGO_CONTAINER}/${MONGO_DB}) ==="

# `--eval` with the whole script as one argument: piping to mongosh's stdin runs the
# REPL line-by-line, which breaks any multi-line statement.
read -r -d '' SCRIPT <<'JS' || true
const withVariants = db.menu_items
  .find({ variantGroups: { $exists: true, $ne: [] } }, { _id: 1 })
  .toArray()
  .map((d) => d._id);

const setTrue = withVariants.length
  ? db.menu_item_search.updateMany({ _id: { $in: withVariants } }, { $set: { hasVariants: true } })
  : { matchedCount: 0, modifiedCount: 0 };

const setFalse = db.menu_item_search.updateMany(
  { _id: { $nin: withVariants } },
  { $set: { hasVariants: false } }
);

print(`items with variant groups      : ${withVariants.length}`);
print(`projected -> hasVariants=true  : matched ${setTrue.matchedCount}, modified ${setTrue.modifiedCount}`);
print(`projected -> hasVariants=false : matched ${setFalse.matchedCount}, modified ${setFalse.modifiedCount}`);
print(`remaining without the field    : ${db.menu_item_search.countDocuments({ hasVariants: { $exists: false } })}`);
JS

docker exec -i "$MONGO_CONTAINER" mongosh --quiet "$MONGO_DB" --eval "$SCRIPT"

echo "=== done ==="
