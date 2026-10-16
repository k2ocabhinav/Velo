#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.demo-runtime"

if [[ ! -d "$RUNTIME_DIR" ]]; then
  printf 'No Velo demo runtime state found.\n'
  exit 0
fi

# demo-up.sh starts every job with start_new_session, so the recorded pid is the
# leader of its own process group and the group id is that pid. Stopping the whole
# group is what reliably reaches the children a job forks: the Maven wrapper execs
# the JVM, which forks the Spring Boot app, and the node launchers fork their
# Next.js servers. A job is only stopped when a process in its group still matches
# the command it was started with, so a reused pid can never take down an unrelated
# process.

process_matches_job() {
  local name="$1"
  local command_line="$2"
  case "$name:$command_line" in
    sim:*src/main.ts*) return 0 ;;
    backend:*mvnw*|backend:*spring-boot:run*|backend:*VeloPlatformApplication*) return 0 ;;
    landing:*http.server*) return 0 ;;
    admin:*start-standalone.mjs*admin*|admin:*apps/admin*) return 0 ;;
    rider:*start-standalone.mjs*rider*|rider:*apps/rider*) return 0 ;;
    driver:*start-standalone.mjs*driver*|driver:*apps/driver*) return 0 ;;
    *) return 1 ;;
  esac
}

group_holds_job() {
  local name="$1"
  local pgid="$2"
  local command_line
  while IFS= read -r command_line; do
    if process_matches_job "$name" "$command_line"; then
      return 0
    fi
  done < <(ps -A -o pgid=,command= 2>/dev/null | awk -v group="$pgid" '$1 == group { $1 = ""; sub(/^ +/, ""); print }')
  return 1
}

group_exists() {
  local pgid="$1"
  ps -A -o pgid= 2>/dev/null | awk -v group="$pgid" '$1 == group { found = 1 } END { exit found ? 0 : 1 }'
}

stop_group() {
  local pgid="$1"
  local wait_seconds="${2:-5}"
  local _attempt
  kill -TERM -- "-$pgid" >/dev/null 2>&1 || true
  for _attempt in $(seq 1 "$((wait_seconds * 4))"); do
    if ! group_exists "$pgid"; then
      return 0
    fi
    sleep 0.25
  done
  kill -KILL -- "-$pgid" >/dev/null 2>&1 || true
}

for name in sim driver rider admin landing backend; do
  pid_file="$RUNTIME_DIR/$name.pid"
  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file")"
    if group_holds_job "$name" "$pid"; then
      if [[ "$name" == sim ]]; then
        stop_group "$pid" 70
      else
        stop_group "$pid"
      fi
      printf 'Stopped %s (pid %s).\n' "$name" "$pid"
    else
      printf 'Skipped %s (pid %s): no matching process is running.\n' "$name" "$pid"
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

find "$RUNTIME_DIR" -mindepth 1 -maxdepth 1 ! -name sim-state.json -exec rm -rf {} +
rmdir "$RUNTIME_DIR" 2>/dev/null || true
printf 'Velo local demo stopped.\n'
