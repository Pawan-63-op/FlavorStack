#!/usr/bin/env bash
#
# Showcase seed — a browsable catalog around IIT (ISM) Dhanbad, plus extra drivers
# and customers, so a visitor landing on the public demo sees a populated app.
#
# Layered ON TOP of `seed-demo.sh`, which creates the four base accounts. Run that first:
#
#   MONGO_URI="<atlas-uri>" API_BASE="https://flavorstack-api.onrender.com" ./ops/seed-demo.sh
#   MONGO_URI="<atlas-uri>" API_BASE="https://flavorstack-api.onrender.com" ./ops/seed-showcase.sh
#
# Idempotent and self-healing. Restaurants are skipped once they exist; drivers and customers
# are re-applied every run (register is allowed to 409), so a run interrupted between register
# and activation is repaired by re-running rather than skipped over.
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
MONGO_URI="${MONGO_URI:-}"
MONGO_CONTAINER="${MONGO_CONTAINER:-server_2-mongo-1}"
MONGO_DB="${MONGO_DB:-flavorstack}"

# IIT (ISM) Dhanbad main campus. Every restaurant below sits within ~2 km of this, and
# every delivery zone is a ±0.05° box around its own restaurant, so the whole campus
# area is deliverable from all of them.
CAMPUS_LAT=23.8143
CAMPUS_LNG=86.4412

OWNER_EMAIL="${OWNER_EMAIL:-owner@flavorstack.local}"
OWNER_PASSWORD="${OWNER_PASSWORD:-Owner@1234}"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-testcustomer@flavorstack.local}"
CUSTOMER_PASSWORD="${CUSTOMER_PASSWORD:-Test@1234}"

CURL_OPTS=()
if [[ "$API_BASE" == https://* || "${CURL_INSECURE:-0}" == "1" ]]; then
  CURL_OPTS=(-k)
fi

log()  { printf '  • %s\n' "$*"; }
head() { printf '\n=== %s ===\n' "$*"; }

require() {
  local missing=0 tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: required tool not found: $tool" >&2; missing=1; }
  done
  [ "$missing" -eq 0 ] || { echo "Install the missing tool(s) and re-run." >&2; exit 1; }
}
if [ -n "$MONGO_URI" ]; then require curl jq mongosh; else require curl jq docker; fi

# Same single chokepoint as `seed-demo.sh`: the only thing that differs between a local
# compose stack and a managed cluster.
mongo_eval() {
  if [ -n "$MONGO_URI" ]; then
    mongosh "$MONGO_URI" --quiet --eval "$1"
  else
    docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DB" --quiet --eval "$1"
  fi
}

api_post() { # path body [token] -> http code
  local path="$1" body="$2" auth="${3:-}"
  local args=(-s "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' -X POST "$API_BASE$path"
              -H 'Content-Type: application/json' -d "$body")
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  curl "${args[@]}"
}

api_post_body() { # path body [token] -> response body
  local path="$1" body="$2" auth="${3:-}"
  local args=(-s "${CURL_OPTS[@]}" -X POST "$API_BASE$path" -H 'Content-Type: application/json' -d "$body")
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  curl "${args[@]}"
}

api_patch() { # path body token -> http code
  curl -s "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' -X PATCH "$API_BASE$1" \
    -H "Authorization: Bearer $3" -H 'Content-Type: application/json' -d "$2"
}

login() { api_post_body /api/v1/auth/login "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.accessToken // empty'; }

verify_email() { mongo_eval "db.users.updateOne({email:\"$1\"},{\$set:{isEmailVerified:true}})" >/dev/null; }


# ---------------------------------------------------------------------------
# Catalog. Prices are in paise (the API's minor unit): 18000 = ₹180.00.
# ---------------------------------------------------------------------------
read -r -d '' RESTAURANTS <<'JSON' || true
[
 {"name":"ISM Cafe Junction","cuisine":"FAST_FOOD","phone":"+919876511001","lat":23.8155,"lng":86.4425,
  "street":"Near Main Gate, IIT (ISM) Campus","landmark":"Opposite Penman Auditorium",
  "image":"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1080&q=80",
  "categories":[
    {"label":"Burgers & Rolls","items":[
      {"name":"Crispy Veg Burger","desc":"Spiced potato patty, lettuce, mint mayo","price":12000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80"},
      {"name":"Chicken Zinger Burger","desc":"Fried chicken fillet, coleslaw, chilli sauce","price":18500,"diet":["NON_VEG"],"img":"https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80"},
      {"name":"Paneer Kathi Roll","desc":"Tandoori paneer in a flaky paratha","price":14000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1633945274309-2c16c9682a3d?auto=format&fit=crop&w=800&q=80"}]},
    {"label":"Sides & Shakes","items":[
      {"name":"Peri Peri Fries","desc":"Hand-cut fries tossed in peri peri","price":9000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80"},
      {"name":"Cold Coffee Shake","desc":"Double-shot cold brew blended with ice cream","price":11000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80"}]}]},

 {"name":"Dhanbad Biryani House","cuisine":"NORTH_INDIAN","phone":"+919876511002","lat":23.8120,"lng":86.4390,
  "street":"Saraidhela Main Road","landmark":"Near Saraidhela Market",
  "image":"https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1080&q=80",
  "categories":[
    {"label":"Biryani","items":[
      {"name":"Hyderabadi Chicken Biryani","desc":"Dum-cooked basmati, saffron, fried onions","price":24000,"diet":["NON_VEG"],"img":"https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80"},
      {"name":"Mutton Handi Biryani","desc":"Slow-cooked mutton on the bone","price":32000,"diet":["NON_VEG","HALAL"],"img":"https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=800&q=80"},
      {"name":"Veg Dum Biryani","desc":"Seasonal vegetables, whole spices, mint","price":19000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80"}]},
    {"label":"Curries & Breads","items":[
      {"name":"Butter Chicken","desc":"Tandoori chicken in a tomato-cream gravy","price":28000,"diet":["NON_VEG"],"img":"https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80"},
      {"name":"Dal Makhani","desc":"Black lentils simmered overnight","price":17000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80"},
      {"name":"Butter Naan (2 pc)","desc":"Tandoor-baked, brushed with butter","price":7000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80"}]}]},

 {"name":"Coal City Pizzeria","cuisine":"ITALIAN","phone":"+919876511003","lat":23.8168,"lng":86.4401,
  "street":"Hirapur Main Road","landmark":"Near Hirapur Chowk",
  "image":"https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1080&q=80",
  "categories":[
    {"label":"Pizzas","items":[
      {"name":"Margherita","desc":"San Marzano tomato, fior di latte, basil","price":22000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80"},
      {"name":"Peri Peri Chicken Pizza","desc":"Grilled chicken, peppers, peri peri drizzle","price":32000,"diet":["NON_VEG"],"img":"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80"},
      {"name":"Four Cheese","desc":"Mozzarella, cheddar, parmesan, gorgonzola","price":34000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=800&q=80"}]},
    {"label":"Pasta & Garlic Bread","items":[
      {"name":"Alfredo Penne","desc":"Penne in a parmesan cream sauce","price":24000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80"},
      {"name":"Cheesy Garlic Bread","desc":"Stuffed with mozzarella and herbs","price":13000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?auto=format&fit=crop&w=800&q=80"}]}]},

 {"name":"Wok & Roll Dhanbad","cuisine":"CHINESE","phone":"+919876511004","lat":23.8102,"lng":86.4438,
  "street":"Bank More, Dhanbad","landmark":"Near Bank More Bus Stand",
  "image":"https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=1080&q=80",
  "categories":[
    {"label":"Noodles & Rice","items":[
      {"name":"Hakka Veg Noodles","desc":"Wok-tossed with julienned vegetables","price":15000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80"},
      {"name":"Schezwan Chicken Fried Rice","desc":"Fiery schezwan, spring onion, egg","price":19000,"diet":["NON_VEG"],"img":"https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80"}]},
    {"label":"Starters","items":[
      {"name":"Chilli Paneer (Dry)","desc":"Crisp paneer, bell pepper, soy-chilli glaze","price":18000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=800&q=80"},
      {"name":"Chicken Momos (8 pc)","desc":"Steamed, served with fiery red chutney","price":14000,"diet":["NON_VEG"],"img":"https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80"},
      {"name":"Honey Chilli Potato","desc":"Crisp potato batons, honey-chilli toss","price":13000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80"}]}]},

 {"name":"Sagar South Indian Corner","cuisine":"SOUTH_INDIAN","phone":"+919876511005","lat":23.8190,"lng":86.4455,
  "street":"Sardar Patel Nagar","landmark":"Near ISM Housing Colony",
  "image":"https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=1080&q=80",
  "categories":[
    {"label":"Dosa & Uttapam","items":[
      {"name":"Masala Dosa","desc":"Crisp dosa, spiced potato, sambar and chutney","price":12000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80"},
      {"name":"Mysore Masala Dosa","desc":"Red chilli chutney smeared inside","price":14000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1694849789325-914b71ab4ee2?auto=format&fit=crop&w=800&q=80"},
      {"name":"Onion Uttapam","desc":"Thick rice pancake, onion and green chilli","price":11000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80"}]},
    {"label":"Idli & Vada","items":[
      {"name":"Idli Sambar (3 pc)","desc":"Steamed rice cakes with lentil sambar","price":9000,"diet":["VEG","VEGAN"],"img":"https://images.unsplash.com/photo-1589301773859-bb024d3ad558?auto=format&fit=crop&w=800&q=80"},
      {"name":"Medu Vada (2 pc)","desc":"Crisp lentil doughnuts, coconut chutney","price":8000,"diet":["VEG","VEGAN"],"img":"https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80"}]}]},

 {"name":"Bengal Sweets & Bakery","cuisine":"BAKERY","phone":"+919876511006","lat":23.8131,"lng":86.4372,
  "street":"Jharia Road","landmark":"Near Dhanbad Railway Station",
  "image":"https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1080&q=80",
  "categories":[
    {"label":"Bengali Sweets","items":[
      {"name":"Rasgulla (4 pc)","desc":"Spongy chhena in light sugar syrup","price":9000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?auto=format&fit=crop&w=800&q=80"},
      {"name":"Kesar Rasmalai (2 pc)","desc":"Saffron-infused thickened milk","price":11000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1605197161470-5d2a9af0ac7e?auto=format&fit=crop&w=800&q=80"}]},
    {"label":"Cakes & Bakes","items":[
      {"name":"Belgian Chocolate Pastry","desc":"Dark chocolate ganache, single slice","price":13000,"diet":["EGG"],"img":"https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80"},
      {"name":"Veg Puff","desc":"Flaky pastry, spiced potato and peas","price":4000,"diet":["VEG"],"img":"https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80"},
      {"name":"Red Velvet Jar Cake","desc":"Cream cheese frosting, served chilled","price":16000,"diet":["EGG"],"img":"https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=800&q=80"}]}]}
]
JSON

# ---------------------------------------------------------------------------
# `/auth/login` is rate-limited to 5 per 15 min keyed by **IP**, not by account
# (`rateLimiter.ts:7` falls back to `req.context.ip` for unauthenticated routes), so every
# login in this script comes out of one shared budget for the whole machine. Everything that
# can be done without a token is therefore done in Mongo, and the two that genuinely need one
# are acquired lazily — a fully-seeded re-run spends zero logins.
OWNER_TOKEN=""
ensure_owner_token() {
  [ -n "$OWNER_TOKEN" ] && return 0
  OWNER_TOKEN="$(login "$OWNER_EMAIL" "$OWNER_PASSWORD")"
  [ -n "$OWNER_TOKEN" ] || { echo "ERROR: owner login failed (rate-limited? wait 15 min) — or run ops/seed-demo.sh first." >&2; exit 1; }
  log "authenticated as $OWNER_EMAIL"
}

head "Catalog around IIT (ISM) Dhanbad"
while IFS= read -r r; do
  RNAME=$(jq -r '.name' <<<"$r")

  if [ -n "$(mongo_eval "const d=db.restaurants.findOne({name:\"$RNAME\"}); print(d?d._id:'')")" ]; then
    log "$RNAME — already seeded, skipping"
    continue
  fi

  ensure_owner_token
  RID="$(api_post_body /api/v1/catalog/restaurants "$(jq -c '{
      name, cuisineTypes:[.cuisine], phone, imageUrl:.image,
      address:{street:.street, city:"Dhanbad", state:"Jharkhand", pinCode:"826004",
               landmark:.landmark, coordinates:{lat:.lat, lng:.lng}},
      location:{lat:.lat, lng:.lng}}' <<<"$r")" "$OWNER_TOKEN" | jq -r '.id // empty')"

  if [ -z "$RID" ]; then log "WARN: $RNAME — create failed"; continue; fi
  log "$RNAME -> $RID"

  # Categories are appended to one document, so the new id is always the last element.
  SORT=0
  while IFS= read -r c; do
    CLABEL=$(jq -r '.label' <<<"$c")
    CID="$(api_post_body "/api/v1/catalog/restaurants/$RID/categories" \
      "$(jq -nc --arg l "$CLABEL" --argjson s "$SORT" '{label:$l,sortOrder:$s}')" "$OWNER_TOKEN" \
      | jq -r '.categories[-1].id // empty')"
    SORT=$((SORT+1))
    if [ -z "$CID" ]; then log "    WARN: category $CLABEL failed"; continue; fi

    N=0
    while IFS= read -r i; do
      code=$(api_post "/api/v1/catalog/restaurants/$RID/items" "$(jq -c --arg c "$CID" '{
        categoryId:$c, name:.name, description:.desc, imageUrl:.img,
        basePrice:{amount:.price, currency:"INR"}, dietary:.diet}' <<<"$i")" "$OWNER_TOKEN")
      if [ "$code" = "201" ] || [ "$code" = "200" ]; then
        N=$((N+1))
      else
        log "    WARN: item $(jq -r .name <<<"$i") -> HTTP $code"
      fi
    done < <(jq -c '.items[]' <<<"$c")
    log "    $CLABEL — $N items"
  done < <(jq -c '.categories[]' <<<"$r")

  # A ±0.05° box (~5.5 km) around the restaurant, so the whole campus is deliverable.
  api_post "/api/v1/catalog/restaurants/$RID/zones" "$(jq -c '
    {action:"ADD",
     polygon:[{lat:(.lat-0.05),lng:(.lng-0.05)},{lat:(.lat-0.05),lng:(.lng+0.05)},
              {lat:(.lat+0.05),lng:(.lng+0.05)},{lat:(.lat+0.05),lng:(.lng-0.05)}],
     feeMatrix:{tiers:[{maxDistanceMeters:50000,fee:{amount:3000,currency:"INR"}}]},
     minOrder:{amount:9900,currency:"INR"}}' <<<"$r")" "$OWNER_TOKEN" >/dev/null
  api_post "/api/v1/catalog/restaurants/$RID/publish" '{}' "$OWNER_TOKEN" >/dev/null
  api_patch "/api/v1/catalog/restaurants/$RID/visibility" '{"visibility":"PUBLIC"}' "$OWNER_TOKEN" >/dev/null
  log "    zone + published + PUBLIC"
done < <(jq -c '.[]' <<<"$RESTAURANTS")

# ---------------------------------------------------------------------------
head "Extra drivers (verified + online)"

# Verification and go-online are applied directly, not through
# `POST /admin/drivers/:id/verify` + `PATCH /users/me/availability`, because that path costs
# three logins (admin + one per driver) out of a five-per-15-min budget.
#
# The two fields below are the whole of what offer-eligibility reads: `AvailableDriversProvider`
# keeps a driver only when `isOnline && !isBusy`, and both are **derived** on the entity —
# `isOnline = isAvailable && driverStatus === ACTIVE` and `isBusy = activeOrderId != null`
# (`Driver.ts:54-55`). Nothing else is stored, which is why this is equivalent to the API path
# rather than an approximation of it; the shape was confirmed against the driver that
# `seed-demo.sh` verified through the real endpoint.
# Deliberately NOT guarded by "skip if the user exists": a run interrupted between register
# and activation leaves a driver at PENDING_VERIFICATION, and an exists-guard would skip it
# forever. Register is allowed to 409, and the `$set` below is idempotent, so re-running
# repairs a half-seeded driver instead of stepping over it.
seed_driver() { # email password name phone plate
  api_post /api/v1/auth/register "$(jq -nc --arg n "$3" --arg e "$1" --arg p "$2" --arg ph "$4" --arg lp "$5" \
    '{role:"DRIVER",driver:{name:$n,email:$e,phone:$ph,password:$p,
      vehicle:{type:"BIKE",brand:"Hero",model:"Splendor",licensePlate:$lp,
        rcDocumentUrl:"https://example.com/rc.pdf",insuranceUrl:"https://example.com/ins.pdf"}}}')" >/dev/null

  # matchedCount, not modifiedCount — a driver already in the target state modifies 0 rows
  # but is perfectly seeded, and reporting that as a failure would be wrong.
  local n
  n=$(mongo_eval "db.users.updateOne({email:\"$1\",role:\"DRIVER\"},{\$set:{isEmailVerified:true,driverStatus:\"ACTIVE\",isAvailable:true}}).matchedCount")
  if [ "$n" = "1" ]; then
    log "$1 — verified + online"
  else
    log "WARN: $1 — driver not found after register (matched=$n)"
  fi
}

seed_driver "rider.amit@flavorstack.local"  "Driver@1234" "Amit Kumar"  "+919876512001" "JH10AB2001"
seed_driver "rider.suresh@flavorstack.local" "Driver@1234" "Suresh Das" "+919876512002" "JH10AB2002"

# ---------------------------------------------------------------------------
head "Extra customers (Dhanbad addresses)"
seed_customer() { # email password name phone   (self-healing, as seed_driver above)
  api_post /api/v1/auth/register "$(jq -nc --arg n "$3" --arg e "$1" --arg p "$2" --arg ph "$4" \
    --argjson lat "$CAMPUS_LAT" --argjson lng "$CAMPUS_LNG" \
    '{role:"CUSTOMER",customer:{name:$n,email:$e,phone:$ph,password:$p,
      address:{street:"IIT (ISM) Campus, Sardar Patel Nagar",city:"Dhanbad",state:"Jharkhand",
               pinCode:"826004",lat:$lat,lng:$lng}}}')" >/dev/null
  local n
  n=$(mongo_eval "db.users.updateOne({email:\"$1\"},{\$set:{isEmailVerified:true}}).matchedCount")
  if [ "$n" = "1" ]; then log "$1 — registered + verified"; else log "WARN: $1 — not found (matched=$n)"; fi
}

seed_customer "priya@flavorstack.local" "Test@1234" "Priya Sharma" "+919876513001"
seed_customer "rahul@flavorstack.local" "Test@1234" "Rahul Verma"  "+919876513002"

# The base demo customer was registered by `seed-demo.sh` with a Bengaluru address —
# ~1,500 km from Dhanbad, which puts every restaurant above outside its delivery zone.
# Give it a campus address and make that the default so checkout works out of the box.
head "Campus address for $CUSTOMER_EMAIL"
CUST_TOKEN="$(login "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD")"
if [ -z "$CUST_TOKEN" ]; then
  log "WARN: customer login failed — skipping address"
else
  # The list response shape is not pinned here on purpose — `..|.city?` finds the field at
  # whatever depth it sits, so a wrapper change cannot make this silently re-add duplicates.
  HAS_DHN="$(curl -s "${CURL_OPTS[@]}" "$API_BASE/api/v1/users/me/addresses" \
    -H "Authorization: Bearer $CUST_TOKEN" \
    | jq -r '[.. | .city? // empty | select(. == "Dhanbad")] | length' 2>/dev/null || echo 0)"
  if [ "${HAS_DHN:-0}" != "0" ]; then
    log "already has a Dhanbad address, skipping"
  else
    # The endpoint answers with the customer's full address LIST, not the created address,
    # so `.id` would be indexing an array. Pick the Dhanbad entry back out of the response.
    AID="$(api_post_body /api/v1/users/me/addresses "$(jq -nc \
      --argjson lat "$CAMPUS_LAT" --argjson lng "$CAMPUS_LNG" \
      '{label:"Campus",recipientName:"Test Customer",phone:"+919876500001",
        street:"IIT (ISM) Campus, Sardar Patel Nagar",city:"Dhanbad",state:"Jharkhand",
        pinCode:"826004",landmark:"Near Penman Auditorium",lat:$lat,lng:$lng,isDefault:true}')" \
      "$CUST_TOKEN" | jq -r '[.. | objects | select(.city? == "Dhanbad") | .id] | last // empty')"
    log "added Dhanbad default address${AID:+ ($AID)}"
  fi
fi

# ---------------------------------------------------------------------------
head "Seeded catalog"
mongo_eval "db.restaurants.find({},{name:1,status:1,visibility:1,_id:0}).forEach(r=>print('  '+r.name+'  status='+r.status+'  visibility='+r.visibility))"

printf '\nExtra logins (password in brackets):\n'
printf '  Customer : priya@flavorstack.local [Test@1234]\n'
printf '  Customer : rahul@flavorstack.local [Test@1234]\n'
printf '  Driver   : rider.amit@flavorstack.local [Driver@1234]\n'
printf '  Driver   : rider.suresh@flavorstack.local [Driver@1234]\n'
