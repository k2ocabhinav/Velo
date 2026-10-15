#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.demo-runtime"

if [[ ! -d "$RUNTIME_DIR" ]]; then
  printf 'No Velo demo runtime state found.\n'
  exit 0
fi

stop_tree() {
  local pid="$1"
  local children child
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return
  fi
  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  for child in $children; do
    stop_tree "$child"
  done
  kill -TERM "$pid" >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      return
    fi
    sleep 0.25
  done
  kill -KILL "$pid" >/dev/null 2>&1 || true
}

process_matches_job() {
  local name="$1"
  local pid="$2"
  local command_line
  command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  case "$name:$command_line" in
    backend:*mvnw*|backend:*spring-boot:run*) return 0 ;;
    landing:*http.server*) return 0 ;;
    admin:*start-standalone.mjs\ admin\ *) return 0 ;;
    rider:*start-standalone.mjs\ rider\ *) return 0 ;;
    driver:*start-standalone.mjs\ driver\ *) return 0 ;;
    *) return 1 ;;
  esac
}

for name in driver rider admin landing backend; do
  pid_file="$RUNTIME_DIR/$name.pid"
  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file")"
    if process_matches_job "$name" "$pid"; then
      stop_tree "$pid"
      printf 'Stopped %s (pid %s).\n' "$name" "$pid"
    else
      printf 'Skipped %s pid %s because it no longer matches the recorded demo process.\n' "$name" "$pid"
    fi
  fi
done

if [[ -f "$RUNTIME_DIR/postgres.started" ]]; then
  docker compose -f "$ROOT_DIR/velo-platform/docker-compose.yml" stop postgres
  printf 'Stopped the Postgres container started by demo-up. Its volume was kept.\n'
fi

if [[ -f "$RUNTIME_DIR/redis.started" ]]; then
  docker compose -f "$ROOT_DIR/velo-platform/docker-compose.yml" stop redis
  printf 'Stopped the Redis container started by demo-up. Its volume was kept.\n'
fi

rm -rf "$RUNTIME_DIR"
printf 'Velo local demo stopped.\n'
