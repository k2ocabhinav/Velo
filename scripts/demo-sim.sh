#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.demo-runtime"

usage() {
  cat >&2 <<'EOF'
Usage:
  ./scripts/demo-sim.sh status|pause|resume|speed <1-20>
  ./scripts/demo-sim.sh preset <quiet|steady|busy|airport-rush> [tenant]
  ./scripts/demo-sim.sh set <tenant> <key> <value>
  ./scripts/demo-sim.sh do <action> [tenant] [key=value ...]
  ./scripts/demo-sim.sh open
EOF
  exit 1
}

if (( $# < 1 )); then usage; fi
if [[ ! -f "$RUNTIME_DIR/sim.port" ]]; then
  printf 'The demo simulator is not running. Start the demo with ./scripts/demo-up.sh first.\n' >&2
  exit 1
fi
CONTROL_URL="http://127.0.0.1:$(cat "$RUNTIME_DIR/sim.port")"

control_request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local response status response_body
  if [[ -n "$body" ]]; then
    response="$(curl --silent --show-error --request "$method" \
      --header 'Content-Type: application/json' --header 'X-Velo-Sim: 1' --data "$body" \
      --write-out $'\n%{http_code}' "$CONTROL_URL$path")"
  else
    response="$(curl --silent --show-error --request "$method" \
      --write-out $'\n%{http_code}' "$CONTROL_URL$path")"
  fi
  status="${response##*$'\n'}"
  response_body="${response%$'\n'*}"
  if (( status >= 400 )); then
    local error_message
    error_message="$(python3 -c 'import json,sys
try:
    body=json.loads(sys.argv[1])
except (json.JSONDecodeError, TypeError):
    body=None
message=body.get("error") if isinstance(body, dict) else None
print(message or f"Request failed with status {sys.argv[2]}")' "$response_body" "$status")"
    printf 'Simulator control request failed (HTTP %s): %s\n' "$status" "$error_message" >&2
    return 1
  fi
  printf '%s\n' "$response_body"
}

patch_body() {
  python3 - "$@" <<'PY'
import json
import sys

tenant, key, raw = sys.argv[1:]
tenant_fields = {
    "onlineDrivers", "requestIntervalSec", "airportShare", "declineProbability",
    "pickupWaitSec", "idleRepositionProbability", "hotspots",
}
if key not in tenant_fields | {"paused", "speedFactor", "seed"}:
    raise SystemExit(f"Unknown config key: {key}")
try:
    value = json.loads(raw)
except json.JSONDecodeError:
    value = raw
patch = {key: value} if key in {"paused", "speedFactor", "seed"} else {"tenants": {tenant: {key: value}}}
print(json.dumps(patch, separators=(",", ":")))
PY
}

action_body() {
  python3 - "$@" <<'PY'
import json
import sys

action, tenant, *arguments = sys.argv[1:]
body = {"tenant": tenant}
for argument in arguments:
    key, separator, raw = argument.partition("=")
    if not separator or not key:
        raise SystemExit(f"Action values must use key=value: {argument}")
    if key in body:
        raise SystemExit(f"Duplicate action field: {key}")
    try:
        body[key] = json.loads(raw)
    except json.JSONDecodeError:
        body[key] = raw
print(json.dumps(body, separators=(",", ":")))
PY
}

case "$1" in
  status)
    (( $# == 1 )) || usage
    control_request GET /status
    ;;
  pause)
    (( $# == 1 )) || usage
    control_request PATCH /config '{"paused":true}'
    ;;
  resume)
    (( $# == 1 )) || usage
    control_request PATCH /config '{"paused":false}'
    ;;
  speed)
    (( $# == 2 )) || usage
    if ! [[ "$2" =~ ^([1-9]|1[0-9]|20)$ ]]; then
      printf 'The speed factor must be a whole number between 1 and 20.\n' >&2
      exit 1
    fi
    control_request PATCH /config "{\"speedFactor\":$2}"
    ;;
  preset)
    (( $# == 2 || $# == 3 )) || usage
    preset_name="$2"
    tenant="${3:-}"
    if [[ -n "$tenant" ]]; then
      body="$(python3 - "$preset_name" "$tenant" <<'PY'
import json
import sys
print(json.dumps({"name": sys.argv[1], "tenant": sys.argv[2]}, separators=(",", ":")))
PY
)"
    else
      body="$(python3 - "$preset_name" <<'PY'
import json
import sys
print(json.dumps({"name": sys.argv[1]}, separators=(",", ":")))
PY
)"
    fi
    control_request POST /preset "$body"
    ;;
  set)
    (( $# == 4 )) || usage
    body="$(patch_body "$2" "$3" "$4")"
    control_request PATCH /config "$body"
    ;;
  do)
    (( $# >= 2 )) || usage
    action="$2"
    shift 2
    tenant=default
    if (( $# > 0 )) && [[ "$1" != *=* ]]; then
      tenant="$1"
      shift
    fi
    body="$(action_body "$action" "$tenant" "$@")"
    control_request POST "/actions/$action" "$body"
    ;;
  open)
    (( $# == 1 )) || usage
    if command -v open >/dev/null 2>&1; then
      open "$CONTROL_URL/"
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$CONTROL_URL/"
    else
      printf 'Control panel: %s/\n' "$CONTROL_URL"
    fi
    ;;
  *)
    usage
    ;;
esac
