set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
# Mongo access for the 7 privileged mutations the HTTP API deliberately does not expose.
# Set MONGO_URI (e.g. an Atlas `mongodb+srv://…/flavorstack` string) to talk to a remote
# cluster directly; unset, the script falls back to `docker exec` against the local stack.
MONGO_URI="${MONGO_URI:-}"
MONGO_CONTAINER="${MONGO_CONTAINER:-server_2-mongo-1}"
MONGO_DB="${MONGO_DB:-flavorstack}"

CURL_OPTS=()
if [[ "$API_BASE" == https://* || "${CURL_INSECURE:-0}" == "1" ]]; then
  CURL_OPTS=(-k)
fi

CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-testcustomer@flavorstack.local}"
CUSTOMER_PASSWORD="${CUSTOMER_PASSWORD:-Test@1234}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@flavorstack.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@1234}"
OWNER_EMAIL="${OWNER_EMAIL:-owner@flavorstack.local}"
OWNER_PASSWORD="${OWNER_PASSWORD:-Owner@1234}"
DRIVER_EMAIL="${DRIVER_EMAIL:-driver@flavorstack.local}"
DRIVER_PASSWORD="${DRIVER_PASSWORD:-Driver@1234}"

LAT=12.9716
LNG=77.5946

log()  { printf '  • %s\n' "$*"; }
head() { printf '\n=== %s ===\n' "$*"; }

require() {
  local missing=0 tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: required tool not found: $tool" >&2; missing=1; }
  done
  [ "$missing" -eq 0 ] || { echo "Install the missing tool(s) and re-run." >&2; exit 1; }
}
# `docker` is only needed for the local fallback; a MONGO_URI run needs `mongosh` on PATH.
if [ -n "$MONGO_URI" ]; then
  require curl jq mongosh
else
  require curl jq docker
fi

# The single chokepoint for every privileged mutation below — the only thing that has to
# change to point the seed at a managed cluster instead of the local compose container.
# MONGO_URI is expected to carry the database name in its path.
mongo_eval() {
  if [ -n "$MONGO_URI" ]; then
    mongosh "$MONGO_URI" --quiet --eval "$1"
  else
    docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DB" --quiet --eval "$1"
  fi
}

api_post() {
  local path="$1" body="$2" auth="${3:-}"
  local args=(-s "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' -X POST "$API_BASE$path"
              -H 'Content-Type: application/json' -d "$body")
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  curl "${args[@]}"
}

api_post_body() {
  local path="$1" body="$2" auth="${3:-}"
  local args=(-s "${CURL_OPTS[@]}" -X POST "$API_BASE$path" -H 'Content-Type: application/json' -d "$body")
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  curl "${args[@]}"
}

login() { # email password -> accessToken (or empty)
  api_post_body /api/v1/auth/login "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.accessToken // empty'
}

register_customer() { # email password name phone
  local code
  code=$(api_post /api/v1/auth/register "$(jq -nc \
    --arg n "$3" --arg e "$1" --arg p "$2" --arg ph "$4" \
    --argjson lat "$LAT" --argjson lng "$LNG" \
    '{role:"CUSTOMER",customer:{name:$n,email:$e,phone:$ph,password:$p,
      address:{street:"123 MG Road",city:"Bengaluru",state:"Karnataka",pinCode:"560001",lat:$lat,lng:$lng}}}')")
  log "register CUSTOMER $1 -> HTTP $code"
}

register_driver() { # email password name phone
  local code
  code=$(api_post /api/v1/auth/register "$(jq -nc \
    --arg n "$3" --arg e "$1" --arg p "$2" --arg ph "$4" \
    '{role:"DRIVER",driver:{name:$n,email:$e,phone:$ph,password:$p,
      vehicle:{type:"BIKE",brand:"Honda",model:"Activa",licensePlate:"KA01AB1234",
        rcDocumentUrl:"https://example.com/rc.pdf",insuranceUrl:"https://example.com/ins.pdf"}}}')")
  log "register DRIVER $1 -> HTTP $code"
}

verify_email() { # email
  local n; n=$(mongo_eval "db.users.updateOne({email:\"$1\"},{\$set:{isEmailVerified:true}}).matchedCount")
  log "verify $1 (matched=$n)"
}

promote_admin() { # email
  local n
  n=$(mongo_eval "db.users.updateOne({email:\"$1\"},{\$set:{role:\"ADMIN\",department:\"ops\",isSuperAdmin:true,managedBy:null,permissions:[],twoFactorEnabled:false,twoFactorSecret:null,auditLog:[],lastActivityAt:null,isEmailVerified:true}}).modifiedCount")
  log "promote ADMIN $1 (modified=$n)"
}

verify_driver() { # email
  local did status admin_tok code
  did="$(mongo_eval "const d=db.users.findOne({email:\"$1\",role:\"DRIVER\"}); print(d?d._id:\"\")")"
  if [ -z "$did" ]; then log "WARN: driver $1 not found — cannot verify"; return; fi
  status="$(mongo_eval "const d=db.users.findOne({email:\"$1\"}); print(d?d.driverStatus:\"\")")"
  if [ "$status" != "PENDING_VERIFICATION" ]; then
    log "verify driver $1 — already verified (driverStatus=$status), skipping API call"
    return
  fi
  admin_tok="$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
  if [ -z "$admin_tok" ]; then log "WARN: admin login failed (rate-limited?) — cannot verify driver via API"; return; fi
  code=$(api_post "/api/v1/admin/drivers/$did/verify" '{}' "$admin_tok")
  log "verify driver $1 (API POST /admin/drivers/$did/verify) -> HTTP $code"
}

driver_go_online() { # email password
  local tok code
  tok="$(login "$1" "$2")"
  if [ -z "$tok" ]; then log "WARN: driver login failed (rate-limited?) — cannot go online"; return; fi
  code=$(curl -s "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' -X PATCH "$API_BASE/api/v1/users/me/availability" \
    -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' -d '{"available":true}')
  log "driver go-online $1 (API PATCH /users/me/availability) -> HTTP $code"
}

head "Customer"
register_customer "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD" "Test Customer" "+919876500001"
verify_email "$CUSTOMER_EMAIL"

head "Admin"
register_customer "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "Platform Admin" "+919876500002"
promote_admin "$ADMIN_EMAIL"

head "Driver"
register_driver "$DRIVER_EMAIL" "$DRIVER_PASSWORD" "Demo Driver" "+919876500003"
verify_email "$DRIVER_EMAIL"
verify_driver "$DRIVER_EMAIL"
driver_go_online "$DRIVER_EMAIL" "$DRIVER_PASSWORD"

head "Restaurant Owner + restaurant"
register_customer "$OWNER_EMAIL" "$OWNER_PASSWORD" "Demo Owner" "+919876500004"
verify_email "$OWNER_EMAIL"

OWNER_TOKEN="$(login "$OWNER_EMAIL" "$OWNER_PASSWORD")"
if [ -z "$OWNER_TOKEN" ]; then
  log "WARN: owner login failed (rate-limited?) — skipping restaurant seed"
else
  EXISTING="$(mongo_eval "const d=db.restaurants.findOne({name:\"Demo Diner\"}); print(d?d._id:\"\")")"
  if [ -n "$EXISTING" ]; then
    log "owner already owns restaurant $EXISTING — skipping create"
  else
    RID="$(api_post_body /api/v1/catalog/restaurants "$(jq -nc --argjson lat "$LAT" --argjson lng "$LNG" \
      '{name:"Demo Diner",cuisineTypes:["ITALIAN"],phone:"+919876500004",
        address:{street:"123 MG Road",city:"Bengaluru",state:"Karnataka",pinCode:"560001",coordinates:{lat:$lat,lng:$lng}},
        location:{lat:$lat,lng:$lng}}')" "$OWNER_TOKEN" | jq -r '.id // empty')"
    if [ -z "$RID" ]; then log "WARN: restaurant create failed"; else
      log "created restaurant $RID"
      CID="$(api_post_body "/api/v1/catalog/restaurants/$RID/categories" '{"label":"Mains","sortOrder":0}' "$OWNER_TOKEN" \
        | jq -r '.categories[-1].id // empty')"
      log "category $CID"
      api_post "/api/v1/catalog/restaurants/$RID/items" "$(jq -nc --arg c "$CID" \
        '{categoryId:$c,name:"Margherita Pizza",description:"Classic",basePrice:{amount:29999,currency:"INR"},dietary:["VEG"]}')" "$OWNER_TOKEN" >/dev/null
      api_post "/api/v1/catalog/restaurants/$RID/zones" "$(jq -nc --argjson lat "$LAT" --argjson lng "$LNG" '
        {action:"ADD",
         polygon:[{lat:($lat-0.05),lng:($lng-0.05)},{lat:($lat-0.05),lng:($lng+0.05)},
                  {lat:($lat+0.05),lng:($lng+0.05)},{lat:($lat+0.05),lng:($lng-0.05)}],
         feeMatrix:{tiers:[{maxDistanceMeters:50000,fee:{amount:4000,currency:"INR"}}]},
         minOrder:{amount:10000,currency:"INR"}}')" "$OWNER_TOKEN" >/dev/null
      api_post "/api/v1/catalog/restaurants/$RID/publish" '{}' "$OWNER_TOKEN" >/dev/null
      curl -s "${CURL_OPTS[@]}" -o /dev/null -X PATCH "$API_BASE/api/v1/catalog/restaurants/$RID/visibility" \
        -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
        -d '{"visibility":"PUBLIC"}'
      log "published + PUBLIC restaurant $RID"
    fi
  fi
fi

head "Seeded demo accounts (role / verified / driver online state)"
mongo_eval "db.users.find({email:{\$in:[\"$CUSTOMER_EMAIL\",\"$ADMIN_EMAIL\",\"$OWNER_EMAIL\",\"$DRIVER_EMAIL\"]}},{email:1,role:1,isEmailVerified:1,driverStatus:1,isAvailable:1,_id:0}).forEach(u=>print('  '+u.email+'  role='+u.role+'  verified='+u.isEmailVerified+(u.role==='DRIVER'?('  driverStatus='+u.driverStatus+'  isAvailable='+u.isAvailable):'')))"

printf '\nDemo credentials:\n'
printf '  Customer : %s / %s\n' "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD"
printf '  Admin    : %s / %s\n' "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
printf '  Owner    : %s / %s\n' "$OWNER_EMAIL" "$OWNER_PASSWORD"
printf '  Driver   : %s / %s\n' "$DRIVER_EMAIL" "$DRIVER_PASSWORD"
