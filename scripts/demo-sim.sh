#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.demo-runtime"

usage() {
  printf 'Usage: ./scripts/demo-sim.sh status|pause|resume|speed <1-20>\n' >&2
  exit 1
}

if (( $# < 1 )); then
  usage
fi

if [[ ! -f "$RUNTIME_DIR/sim.port" ]]; then
  printf 'The demo simulator is not running. Start the demo with ./scripts/demo-up.sh first.\n' >&2
  exit 1
fi
CONTROL_URL="http://127.0.0.1:$(cat "$RUNTIME_DIR/sim.port")"

control_request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl --silent --show-error --fail --request "$method" --header 'Content-Type: application/json' --data "$body" "$CONTROL_URL$path"
  else
    curl --silent --show-error --fail --request "$method" "$CONTROL_URL$path"
  fi
  printf '\n'
}

case "$1" in
  status)
    (( $# == 1 )) || usage
    control_request GET /status
    ;;
  pause)
    (( $# == 1 )) || usage
    control_request POST /pause
    ;;
  resume)
    (( $# == 1 )) || usage
    control_request POST /resume
    ;;
  speed)
    (( $# == 2 )) || usage
    if ! [[ "$2" =~ ^([1-9]|1[0-9]|20)$ ]]; then
      printf 'The speed factor must be a whole number between 1 and 20.\n' >&2
      exit 1
    fi
    control_request POST /speed "{\"factor\": $2}"
    ;;
  *)
    usage
    ;;
esac
