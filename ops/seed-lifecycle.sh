#!/usr/bin/env bash
#
# Lifecycle seed — everything `seed-showcase.sh` cannot produce from the catalog API alone:
# item variants, opening hours, real DELIVERED orders, the reviews those orders unlock, and
# admin moderation of those reviews.
#
#   MONGO_URI="<atlas-uri>" API_BASE="https://flavorstack-api.onrender.com" ./ops/seed-lifecycle.sh
#
# Run AFTER seed-demo.sh and seed-showcase.sh.
#
# Why an order lifecycle is unavoidable here: `submitReviewSchema` requires a `fulfillmentId`,
# and `SubmitReview` rejects anything whose fulfillment has no `deliveredAt` or belongs to a
# different customer. Reviews are verified-purchase only, so they cannot be faked into the
# `reviews` collection without also faking a delivered fulfillment.
#
# Login budget: `/auth/login` allows 5 per 15 min PER IP (`rateLimiter.ts:7` keys unauthenticated
# routes on `req.context.ip`). This script spends exactly 4 — one per role, reused throughout —
# and access tokens live 900s, so the whole run must finish inside 15 minutes. It does.
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
MONGO_URI="${MONGO_URI:-}"
MONGO_CONTAINER="${MONGO_CONTAINER:-server_2-mongo-1}"
MONGO_DB="${MONGO_DB:-flavorstack}"

OWNER_EMAIL="${OWNER_EMAIL:-owner@flavorstack.local}";      OWNER_PASSWORD="${OWNER_PASSWORD:-Owner@1234}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@flavorstack.local}";      ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@1234}"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-testcustomer@flavorstack.local}"; CUSTOMER_PASSWORD="${CUSTOMER_PASSWORD:-Test@1234}"
DRIVER_EMAIL="${DRIVER_EMAIL:-driver@flavorstack.local}";   DRIVER_PASSWORD="${DRIVER_PASSWORD:-Driver@1234}"

CURL_OPTS=(); [[ "$API_BASE" == https://* ]] && CURL_OPTS=(-k)

log()  { printf '  • %s\n' "$*"; }
section() { printf '\n=== %s ===\n' "$*"; }

require() { local m=0 t; for t in "$@"; do command -v "$t" >/dev/null 2>&1 || { echo "missing: $t" >&2; m=1; }; done; [ "$m" -eq 0 ] || exit 1; }
require curl jq mongosh

mongo_eval() {
  if [ -n "$MONGO_URI" ]; then mongosh "$MONGO_URI" --quiet --eval "$1"
  else docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DB" --quiet --eval "$1"; fi
}

api() { # METHOD path [body] [token] [extraHeader] -> response body
  local m="$1" p="$2" b="${3:-}" t="${4:-}" h="${5:-}"
  local a=(-s "${CURL_OPTS[@]}" -X "$m" "$API_BASE$p" -H 'Content-Type: application/json')
  [ -n "$b" ] && a+=(-d "$b")
  [ -n "$t" ] && a+=(-H "Authorization: Bearer $t")
  [ -n "$h" ] && a+=(-H "$h")
  curl "${a[@]}"
}
code() { # METHOD path [body] [token] [extraHeader] -> http status
  local m="$1" p="$2" b="${3:-}" t="${4:-}" h="${5:-}"
  local a=(-s "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' -X "$m" "$API_BASE$p" -H 'Content-Type: application/json')
  [ -n "$b" ] && a+=(-d "$b")
  [ -n "$t" ] && a+=(-H "Authorization: Bearer $t")
  [ -n "$h" ] && a+=(-H "$h")
  curl "${a[@]}"
}

# `POST /checkout` sits behind `requireIdempotencyKey`, which rejects anything without a
# valid-UUID `Idempotency-Key` header. Each order needs a FRESH key — replaying one returns
# the first order's result instead of placing a new one.
new_uuid() { cat /proc/sys/kernel/random/uuid; }
login() { api POST /api/v1/auth/login "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.accessToken // empty'; }

section "Logins (4 of the 5-per-15-min budget)"
OWNER_TOKEN="$(login "$OWNER_EMAIL" "$OWNER_PASSWORD")";       [ -n "$OWNER_TOKEN" ]  || { echo "owner login failed (rate-limited? wait 15 min)" >&2; exit 1; }
CUST_TOKEN="$(login "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD")";  [ -n "$CUST_TOKEN" ]   || { echo "customer login failed" >&2; exit 1; }
DRIVER_TOKEN="$(login "$DRIVER_EMAIL" "$DRIVER_PASSWORD")";    [ -n "$DRIVER_TOKEN" ] || { echo "driver login failed" >&2; exit 1; }
ADMIN_TOKEN="$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")";       [ -n "$ADMIN_TOKEN" ]  || { echo "admin login failed" >&2; exit 1; }
log "owner / customer / driver / admin authenticated"

# ---------------------------------------------------------------------------
# STAGE 1 — variants
#
# Keyed by item NAME so the spec stays readable; ids are resolved from each restaurant's live
# menu below. `PUT /catalog/items/:id/variants` REPLACES the group list, so re-running is
# idempotent rather than additive.
# ---------------------------------------------------------------------------
read -r -d '' VARIANT_SPEC <<'JSON' || true
{
 "_pizza": [
   {"label":"Size","selectionType":"SINGLE","required":true,"minSelect":1,"maxSelect":1,"options":[
     {"label":"Regular (8\")","priceDelta":{"amount":0,"currency":"INR"},"isDefault":true},
     {"label":"Medium (10\")","priceDelta":{"amount":7000,"currency":"INR"}},
     {"label":"Large (12\")","priceDelta":{"amount":14000,"currency":"INR"}}]},
   {"label":"Extra Toppings","selectionType":"MULTI","required":false,"minSelect":0,"maxSelect":3,"options":[
     {"label":"Extra Cheese","priceDelta":{"amount":5000,"currency":"INR"}},
     {"label":"Black Olives","priceDelta":{"amount":3500,"currency":"INR"}},
     {"label":"Jalapenos","priceDelta":{"amount":3000,"currency":"INR"}}]}],
 "_biryani": [
   {"label":"Portion","selectionType":"SINGLE","required":true,"minSelect":1,"maxSelect":1,"options":[
     {"label":"Half","priceDelta":{"amount":0,"currency":"INR"},"isDefault":true},
     {"label":"Full","priceDelta":{"amount":9000,"currency":"INR"}}]},
   {"label":"Add-ons","selectionType":"MULTI","required":false,"minSelect":0,"maxSelect":2,"options":[
     {"label":"Extra Raita","priceDelta":{"amount":2500,"currency":"INR"}},
     {"label":"Boiled Egg","priceDelta":{"amount":3000,"currency":"INR"}}]}],
 "_burger": [
   {"label":"Meal Upgrade","selectionType":"SINGLE","required":true,"minSelect":1,"maxSelect":1,"options":[
     {"label":"Burger only","priceDelta":{"amount":0,"currency":"INR"},"isDefault":true},
     {"label":"+ Fries & Drink","priceDelta":{"amount":8000,"currency":"INR"}}]},
   {"label":"Add-ons","selectionType":"MULTI","required":false,"minSelect":0,"maxSelect":3,"options":[
     {"label":"Extra Patty","priceDelta":{"amount":6000,"currency":"INR"}},
     {"label":"Cheese Slice","priceDelta":{"amount":2500,"currency":"INR"}}]}],
 "_spice": [
   {"label":"Spice Level","selectionType":"SINGLE","required":true,"minSelect":1,"maxSelect":1,"options":[
     {"label":"Mild","priceDelta":{"amount":0,"currency":"INR"},"isDefault":true},
     {"label":"Medium","priceDelta":{"amount":0,"currency":"INR"}},
     {"label":"Fiery","priceDelta":{"amount":0,"currency":"INR"}}]}],
 "_dosa": [
   {"label":"Size","selectionType":"SINGLE","required":true,"minSelect":1,"maxSelect":1,"options":[
     {"label":"Regular","priceDelta":{"amount":0,"currency":"INR"},"isDefault":true},
     {"label":"Jumbo","priceDelta":{"amount":5000,"currency":"INR"}}]},
   {"label":"Sides","selectionType":"MULTI","required":false,"minSelect":0,"maxSelect":2,"options":[
     {"label":"Extra Sambar","priceDelta":{"amount":2000,"currency":"INR"}},
     {"label":"Coconut Chutney","priceDelta":{"amount":1500,"currency":"INR"}}]}],

 "Margherita":"_pizza","Four Cheese":"_pizza","Peri Peri Chicken Pizza":"_pizza",
 "Hyderabadi Chicken Biryani":"_biryani","Mutton Handi Biryani":"_biryani","Veg Dum Biryani":"_biryani",
 "Crispy Veg Burger":"_burger","Chicken Zinger Burger":"_burger",
 "Hakka Veg Noodles":"_spice","Schezwan Chicken Fried Rice":"_spice","Chilli Paneer (Dry)":"_spice",
 "Masala Dosa":"_dosa","Mysore Masala Dosa":"_dosa"
}
JSON

section "Stage 1 — item variants"
RIDS="$(api GET "/api/v1/catalog/restaurants?limit=50" | jq -r '.items[].id')"
VAR_COUNT=0
for rid in $RIDS; do
  MENU="$(api GET "/api/v1/catalog/restaurants/$rid/menu")"
  while IFS=$'\t' read -r iid iname; do
    # NOT `GROUPS` — that is a bash builtin array holding the current user's group ids.
    # Assigning to it is silently ignored, so the variable read back as the primary GID
    # ("1000") for every item, and `{groups:1000}` 422'd on every single request.
    VGROUPS="$(jq -c --arg n "$iname" '(.[$n] // empty) as $k | if ($k|type)=="string" then .[$k] else empty end' <<<"$VARIANT_SPEC")"
    [ -n "$VGROUPS" ] || continue
    c=$(code PUT "/api/v1/catalog/items/$iid/variants" "$(jq -nc --argjson g "$VGROUPS" '{groups:$g}')" "$OWNER_TOKEN")
    if [ "$c" = "200" ] || [ "$c" = "204" ]; then
      VAR_COUNT=$((VAR_COUNT+1)); log "$iname — variants set"
    else
      log "WARN: $iname — variants HTTP $c"
    fi
  done < <(jq -r '.categories[].items[] | "\(.id)\t\(.name)"' <<<"$MENU")
done
log "$VAR_COUNT items now carry variant groups"

# ---------------------------------------------------------------------------
# STAGE 2 — opening hours
#
# Deliberately 00:00–23:59 on all seven days. Real trading hours would render the demo
# "Closed" to anyone opening the link at the wrong time of day, which reads as a broken
# app rather than a working feature.
# ---------------------------------------------------------------------------
section "Stage 2 — opening hours (always open, for the demo)"
SCHEDULE="$(jq -nc '[ "MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY" ]
  | map({key:., value:[{open:"00:00",close:"23:59"}]}) | from_entries | {schedule:.}')"
for rid in $RIDS; do
  c=$(code PUT "/api/v1/catalog/restaurants/$rid/opening-hours" "$SCHEDULE" "$OWNER_TOKEN")
  [ "$c" = "200" ] || [ "$c" = "204" ] || log "WARN: $rid — opening-hours HTTP $c"
done
log "schedule applied to all restaurants"

# ---------------------------------------------------------------------------
# STAGE 3 — orders driven to DELIVERED
#
# Only ONE driver is left online for this stage. The rider offer goes to a driver chosen by
# `AvailableDriversProvider`; with several online, the offer could land on a rider whose token
# this script does not hold and `accept` would 403. The others are restored in stage 5.
# ---------------------------------------------------------------------------
section "Stage 3 — orders through the full lifecycle"
mongo_eval "db.users.updateMany({role:'DRIVER',email:{\$ne:'$DRIVER_EMAIL'}},{\$set:{isAvailable:false}})" >/dev/null
mongo_eval "db.users.updateOne({email:'$DRIVER_EMAIL'},{\$set:{driverStatus:'ACTIVE',isAvailable:true}})" >/dev/null
log "parked other drivers offline so the offer is deterministic"

CUSTOMER_ID="$(mongo_eval "const u=db.users.findOne({email:'$CUSTOMER_EMAIL'}); print(u?u._id:'')")"
ADDRESS_ID="$(mongo_eval "const u=db.users.findOne({email:'$CUSTOMER_EMAIL'}); const a=(u.addresses||[]).find(x=>x.city==='Dhanbad'); print(a?a.id:'')")"
[ -n "$ADDRESS_ID" ] || { echo "no Dhanbad address — run seed-showcase.sh first" >&2; exit 1; }
log "customer $CUSTOMER_ID delivering to $ADDRESS_ID"

# name → (rating, comment) for the review left after delivery
order_and_review() { # restaurantName restaurantRating deliveryRating comment
  local rname="$1" rrating="$2" drating="$3" comment="$4"
  local rid iid1 iid2 p1 p2 menu orid fid offer status

  rid="$(jq -r --arg n "$rname" '.items[] | select(.name==$n) | .id' <<<"$ALL_RESTAURANTS")"
  [ -n "$rid" ] || { log "WARN: $rname not found"; return 0; }

  # Re-runnable: if this customer already has a DELIVERED order from this restaurant that was
  # never reviewed, review THAT instead of placing another one. Without this, every re-run
  # stacks four more orders onto the demo data.
  fid="$(mongo_eval "
    const f = db.fulfillments.findOne({customerId:'$CUSTOMER_ID', restaurantId:'$rid', fulfillmentStatus:'DELIVERED'});
    print(f ? f._id : '');")"
  if [ -n "$fid" ]; then
    if [ -n "$(mongo_eval "print(db.reviews.countDocuments({fulfillmentId:'$fid'})>0?'y':'')")" ]; then
      log "$rname — already ordered and reviewed, skipping"; return 0
    fi
    log "$rname — reusing delivered fulfillment $fid"
    submit_review "$rid" "$fid" "$rrating" "$drating" "$comment"
    return 0
  fi

  menu="$(api GET "/api/v1/catalog/restaurants/$rid/menu")"
  read -r iid1 p1 <<<"$(jq -r '[.categories[].items[]][0] | "\(.id) \(.basePriceAmount)"' <<<"$menu")"
  read -r iid2 p2 <<<"$(jq -r '[.categories[].items[]][1] | "\(.id) \(.basePriceAmount)"' <<<"$menu")"

  api DELETE /api/v1/cart "" "$CUST_TOKEN" >/dev/null
  code POST /api/v1/cart/items "$(jq -nc --arg r "$rid" --arg i "$iid1" --argjson p "$p1" \
    '{restaurantId:$r,menuItemId:$i,quantity:2,unitPrice:{amount:$p,currency:"INR"}}')" "$CUST_TOKEN" >/dev/null
  code POST /api/v1/cart/items "$(jq -nc --arg r "$rid" --arg i "$iid2" --argjson p "$p2" \
    '{restaurantId:$r,menuItemId:$i,quantity:1,unitPrice:{amount:$p,currency:"INR"}}')" "$CUST_TOKEN" >/dev/null

  local co; co="$(api POST /api/v1/checkout "$(jq -nc --arg a "$ADDRESS_ID" '{paymentMethod:"COD",addressId:$a}')" \
    "$CUST_TOKEN" "Idempotency-Key: $(new_uuid)")"
  orid="$(jq -r '[.. | objects | .orderRequestId? // .id? // empty] | first // empty' <<<"$co")"
  # `cut`, not `head` — this script defines a `section()` helper precisely because an earlier
  # version called its own `head()` function here instead of the binary, which silently ate
  # the error body and printed "=== -c 200 ===".
  if [ -z "$orid" ]; then log "WARN: $rname — checkout failed: $(cut -c1-300 <<<"$co")"; return 0; fi
  log "$rname — checked out ($orid)"

  # The fulfillment is created asynchronously by the outbox relay (2s poll), so this waits on
  # the aggregate itself rather than assuming checkout produced it synchronously.
  for _ in $(seq 1 30); do
    fid="$(mongo_eval "const f=db.fulfillments.findOne({orderRequestId:'$orid'}); print(f?f._id:'')")"
    [ -n "$fid" ] && break
    sleep 2
  done
  if [ -z "$fid" ]; then log "WARN: $rname — no fulfillment after 60s (outbox relay down?)"; return 0; fi
  log "  fulfillment $fid"

  code POST "/api/v1/fulfillments/$fid/preparing" '{}' "$OWNER_TOKEN" >/dev/null
  code POST "/api/v1/fulfillments/$fid/ready" '{}' "$OWNER_TOKEN" >/dev/null
  log "  owner: preparing -> ready for pickup"

  # Offer TTL is 60s, so poll tightly rather than sleeping a fixed amount.
  for _ in $(seq 1 20); do
    offer="$(api GET /api/v1/riders/me/queue "" "$DRIVER_TOKEN" | jq -r --arg f "$fid" '[.. | objects | select((.fulfillmentId? // .id?) == $f)] | length')"
    [ "${offer:-0}" != "0" ] && break
    sleep 2
  done
  local ac; ac=$(code POST "/api/v1/fulfillments/$fid/accept" '{}' "$DRIVER_TOKEN")
  if [ "$ac" != "200" ] && [ "$ac" != "201" ]; then log "WARN: $rname — rider accept HTTP $ac"; return 0; fi

  code POST "/api/v1/fulfillments/$fid/pickup" '{}' "$DRIVER_TOKEN" >/dev/null
  code POST "/api/v1/fulfillments/$fid/out-for-delivery" '{}' "$DRIVER_TOKEN" >/dev/null
  local dc; dc=$(code POST "/api/v1/fulfillments/$fid/deliver" '{}' "$DRIVER_TOKEN")
  # `fulfillmentStatus`, NOT `status` — the aggregate carries `fulfillmentStatus` and
  # `deliveryStatus` and has no plain `status` field. Reading the wrong name returned empty,
  # which made this look like "not DELIVERED" even though every deliver call returned 200.
  status="$(mongo_eval "const f=db.fulfillments.findOne({_id:'$fid'}); print(f?f.fulfillmentStatus:'')")"
  log "  rider: accept -> pickup -> OFD -> deliver (HTTP $dc, status=$status)"

  if [ "$status" != "DELIVERED" ]; then log "WARN: $rname — not DELIVERED, skipping review"; return 0; fi
  submit_review "$rid" "$fid" "$rrating" "$drating" "$comment"
}

submit_review() { # restaurantId fulfillmentId restaurantRating deliveryRating comment
  local rc; rc=$(code POST "/api/v1/restaurants/$1/reviews" "$(jq -nc --arg f "$2" --argjson rr "$3" --argjson dr "$4" --arg c "$5" \
    '{fulfillmentId:$f,restaurantRating:$rr,deliveryRating:$dr,comment:$c}')" "$CUST_TOKEN")
  log "  review $3★ -> HTTP $rc"
}

ALL_RESTAURANTS="$(api GET "/api/v1/catalog/restaurants?limit=50")"
order_and_review "Coal City Pizzeria"        5 5 "Margherita arrived hot and the base was perfectly crisp. Delivery to the ISM campus took barely 20 minutes."
order_and_review "Dhanbad Biryani House"     4 5 "Proper dum biryani — the mutton was tender. Slightly heavy on the oil but genuinely good."
order_and_review "Sagar South Indian Corner" 5 4 "Best masala dosa near campus. Sambar was fresh and the chutney generous."
order_and_review "Wok & Roll Dhanbad"        4 4 "Hakka noodles were spot on. Rider called ahead, which I appreciated."

# ---------------------------------------------------------------------------
# STAGE 4 — moderation
#
# Ratings stay invisible until an admin APPROVES: reviews land as PENDING and the restaurant
# aggregate rating is only recomputed on approval.
# ---------------------------------------------------------------------------
section "Stage 4 — admin approves the reviews"
PENDING="$(api GET "/api/v1/admin/reviews?status=PENDING&limit=50" "" "$ADMIN_TOKEN")"
APPROVED=0
# `reviewId`, not `id` — `ReviewResponse` names the identifier `reviewId`, so selecting `.id`
# yielded null and every approval POSTed to /admin/reviews/null/approve and 404'd.
for rvid in $(jq -r '[.. | objects | .reviewId? // empty] | unique | .[]' <<<"$PENDING" 2>/dev/null); do
  c=$(code POST "/api/v1/admin/reviews/$rvid/approve" '{}' "$ADMIN_TOKEN")
  if [ "$c" = "200" ] || [ "$c" = "201" ]; then APPROVED=$((APPROVED+1)); else log "WARN: review $rvid approve HTTP $c"; fi
done
log "approved $APPROVED review(s)"

# ---------------------------------------------------------------------------
section "Stage 5 — restore drivers, refresh projections"
mongo_eval "db.users.updateMany({role:'DRIVER'},{\$set:{driverStatus:'ACTIVE',isAvailable:true}})" >/dev/null
# `menu_item_search.hasVariants` is set by the projector going forward, but documents projected
# before the variants above were added read back falsy and would skip the picker in search
# results. Same fix as ops/backfill-has-variants.sh, against the configured cluster.
mongo_eval "
  const ids = db.menu_items.find({'variantGroups.0':{\$exists:true}},{_id:1}).toArray().map(d=>d._id);
  db.menu_item_search.updateMany({_id:{\$in:ids}},{\$set:{hasVariants:true}});
  db.menu_item_search.updateMany({_id:{\$nin:ids}},{\$set:{hasVariants:false}});
  print('  • hasVariants backfilled for '+ids.length+' item(s)');
"
mongo_eval "db.users.find({role:'DRIVER'},{email:1,isAvailable:1,_id:0}).forEach(u=>print('  • '+u.email+' online='+u.isAvailable))"

section "Result"
mongo_eval "
  print('  • delivered fulfillments : '+db.fulfillments.countDocuments({fulfillmentStatus:'DELIVERED'}));
  print('  • reviews (approved)     : '+db.reviews.countDocuments({moderationStatus:'APPROVED'}));
  print('  • reviews (pending)      : '+db.reviews.countDocuments({moderationStatus:'PENDING'}));
  print('  • items with variants    : '+db.menu_items.countDocuments({'variantGroups.0':{\$exists:true}}));
"
