#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.demo-runtime"
BACKEND_DIR="$ROOT_DIR/velo-platform"
FRONTEND_DIR="$ROOT_DIR/velo-frontend"
HEALTH_TIMEOUT_SECONDS="${DEMO_HEALTH_TIMEOUT_SECONDS:-180}"
API_PORT="${VELO_DEMO_API_PORT:-8080}"
WEB_PORT_BASE="${VELO_DEMO_WEB_PORT_BASE:-4100}"

mkdir -p "$RUNTIME_DIR"

port_is_open() {
  local port="$1"
  ( : >/dev/tcp/127.0.0.1/"$port" ) >/dev/null 2>&1
}

if compgen -G "$RUNTIME_DIR/*.pid" >/dev/null; then
  printf 'Demo PID files already exist. Run ./scripts/demo-down.sh first.\n' >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  printf 'Python 3 is required to keep the demo services running after startup.\n' >&2
  exit 1
fi

if port_is_open "$API_PORT"; then
  if [[ -n "${VELO_DEMO_API_PORT:-}" ]]; then
    printf 'Configured API port %s is already in use.\n' "$API_PORT" >&2
    exit 1
  fi
  API_PORT=""
  for candidate in $(seq 8081 8090); do
    if ! port_is_open "$candidate"; then
      API_PORT="$candidate"
      break
    fi
  done
  if [[ -z "$API_PORT" ]]; then
    printf 'API port 8080 and fallback ports 8081–8090 are all in use. Set VELO_DEMO_API_PORT to a free port.\n' >&2
    exit 1
  fi
  printf 'Port 8080 is occupied; using API port %s for this demo.\n' "$API_PORT"
fi
API_BASE_URL="http://localhost:$API_PORT"

web_ports_available() {
  local base="$1"
  local port
  for offset in 0 1 2 3; do
    port=$((base + offset))
    if port_is_open "$port"; then
      printf 'Port %s is already in use.\n' "$port" >&2
      return 1
    fi
  done
}

if ! web_ports_available "$WEB_PORT_BASE"; then
  if [[ -n "${VELO_DEMO_WEB_PORT_BASE:-}" ]]; then
    printf 'Configured web port block %s–%s is not free.\n' "$WEB_PORT_BASE" "$((WEB_PORT_BASE + 3))" >&2
    exit 1
  fi
  WEB_PORT_BASE=5700
  if ! web_ports_available "$WEB_PORT_BASE"; then
    printf 'Default and fallback web port blocks are busy. Set VELO_DEMO_WEB_PORT_BASE to four free consecutive ports.\n' >&2
    exit 1
  fi
  printf 'Ports 4100–4103 are occupied; using web port block %s–%s for this demo.\n' \
    "$WEB_PORT_BASE" "$((WEB_PORT_BASE + 3))"
fi
LANDING_PORT="$WEB_PORT_BASE"
ADMIN_PORT=$((WEB_PORT_BASE + 1))
RIDER_PORT=$((WEB_PORT_BASE + 2))
DRIVER_PORT=$((WEB_PORT_BASE + 3))

if [[ ! -x "$FRONTEND_DIR/node_modules/.bin/next" ]]; then
  printf 'Installing frontend dependencies for the first local demo run...\n'
  (cd "$FRONTEND_DIR" && npm ci)
fi

cleanup_on_failure() {
  local exit_code=$?
  if (( exit_code != 0 )); then
    "$ROOT_DIR/scripts/demo-down.sh" >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}
trap cleanup_on_failure EXIT

if ! port_is_open 5432; then
  if ! command -v docker >/dev/null 2>&1; then
    printf 'PostgreSQL is not reachable on localhost:5432 and Docker is unavailable.\n' >&2
    exit 1
  fi
  docker compose -f "$BACKEND_DIR/docker-compose.yml" up -d postgres
  : > "$RUNTIME_DIR/postgres.started"
  db_ready=0
  for _ in $(seq 1 60); do
    if port_is_open 5432; then
      db_ready=1
      break
    fi
    sleep 1
  done
  if (( db_ready == 0 )); then
    printf 'PostgreSQL did not become reachable on localhost:5432.\n' >&2
    exit 1
  fi
fi

DEMO_SIMPLE_CACHE=0
if ! port_is_open 6379; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker compose -f "$BACKEND_DIR/docker-compose.yml" up -d redis >/dev/null; then
      : > "$RUNTIME_DIR/redis.started"
      redis_ready=0
      for _ in $(seq 1 30); do
        if port_is_open 6379; then
          redis_ready=1
          break
        fi
        sleep 1
      done
      if (( redis_ready == 0 )); then
        docker compose -f "$BACKEND_DIR/docker-compose.yml" stop redis >/dev/null 2>&1 || true
        rm -f "$RUNTIME_DIR/redis.started"
      fi
    fi
  fi
  if ! port_is_open 6379; then
    DEMO_SIMPLE_CACHE=1
    printf 'Redis is unavailable; using local in-memory cache and rate limiting.\n'
  fi
fi

start_job() {
  local name="$1"
  local directory="$2"
  shift 2
  python3 - "$name" "$directory" "$RUNTIME_DIR/$name.log" "$RUNTIME_DIR/$name.pid" \
    "$API_BASE_URL" "$API_PORT" "$ADMIN_PORT" "$RIDER_PORT" "$DRIVER_PORT" "$DEMO_SIMPLE_CACHE" "$@" <<'PY'
import os
import subprocess
import sys

name, directory, log_path, pid_path, api_base, api_port, admin_port, rider_port, driver_port, simple_cache, *command = sys.argv[1:]
environment = os.environ.copy()
environment.update({
    "VELO_API_BASE_URL": api_base,
    "NEXT_PUBLIC_API_BASE_URL": api_base,
    "VELO_DEFAULT_TENANT_SLUG": "default",
    "VELO_ADMIN_PORTAL_URL": f"http://localhost:{admin_port}",
    "VELO_RIDER_PORTAL_URL": f"http://localhost:{rider_port}",
    "VELO_DRIVER_PORTAL_URL": f"http://localhost:{driver_port}",
})
if name == "backend":
    environment.update({
        "SPRING_PROFILES_ACTIVE": "local",
        "SERVER_PORT": api_port,
    })
    if simple_cache == "1":
        environment.update({
            "SPRING_CACHE_TYPE": "simple",
            "MANAGEMENT_HEALTH_REDIS_ENABLED": "false",
            "APP_AUTH_RATE_LIMIT_REDIS_ENABLED": "false",
        })

with open(log_path, "ab", buffering=0) as log_file:
    process = subprocess.Popen(
        command,
        cwd=directory,
        env=environment,
        stdin=subprocess.DEVNULL,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
with open(pid_path, "w", encoding="utf-8") as pid_file:
    pid_file.write(f"{process.pid}\n")
PY
}

start_job backend "$BACKEND_DIR" ./mvnw -B spring-boot:run
start_job landing "$FRONTEND_DIR/apps/landing" npx next dev -p "$LANDING_PORT"
start_job admin "$FRONTEND_DIR/apps/admin" npx next dev -p "$ADMIN_PORT"
start_job rider "$FRONTEND_DIR/apps/rider" npx next dev -p "$RIDER_PORT"
start_job driver "$FRONTEND_DIR/apps/driver" npx next dev -p "$DRIVER_PORT"

wait_for_http() {
  local name="$1"
  local url="$2"
  local ready=0
  for _ in $(seq 1 "$HEALTH_TIMEOUT_SECONDS"); do
    if curl --silent --show-error --fail --location "$url" >/dev/null 2>&1; then
      ready=1
      break
    fi
    if ! kill -0 "$(cat "$RUNTIME_DIR/$name.pid")" >/dev/null 2>&1; then
      printf '%s stopped before becoming healthy. Check %s.\n' "$name" "$RUNTIME_DIR/$name.log" >&2
      return 1
    fi
    sleep 1
  done
  if (( ready == 0 )); then
    printf '%s did not become healthy within %s seconds. Check %s.\n' \
      "$name" "$HEALTH_TIMEOUT_SECONDS" "$RUNTIME_DIR/$name.log" >&2
    return 1
  fi
}

wait_for_http backend "$API_BASE_URL/actuator/health"
wait_for_http landing "http://localhost:$LANDING_PORT/"
wait_for_http admin "http://localhost:$ADMIN_PORT/"
wait_for_http rider "http://localhost:$RIDER_PORT/"
wait_for_http driver "http://localhost:$DRIVER_PORT/"

trap - EXIT

cat <<'EOF'
Velo local demo is ready.

EOF
printf 'Landing:  http://localhost:%s\n' "$LANDING_PORT"
printf 'Backend:  %s/actuator/health\n\n' "$API_BASE_URL"
cat <<'EOF'

Velo Business (default tenant):
EOF
printf '  Admin:   http://default.localhost:%s\n' "$ADMIN_PORT"
printf '  Rider:   http://default.localhost:%s\n' "$RIDER_PORT"
printf '  Driver:  http://default.localhost:%s\n\n' "$DRIVER_PORT"
cat <<'EOF'

Saffron Routes (second tenant):
EOF
printf '  Admin:   http://saffron-routes.localhost:%s\n' "$ADMIN_PORT"
printf '  Rider:   http://saffron-routes.localhost:%s\n' "$RIDER_PORT"
printf '  Driver:  http://saffron-routes.localhost:%s\n\n' "$DRIVER_PORT"
cat <<'EOF'

All demo accounts use password: password123
Velo Business: admin@velo-platform.com | henry@example.com | bob.driver@example.com
Saffron Routes: owner@saffronroutes.demo | guest@saffronroutes.demo | chauffeur1@saffronroutes.demo

Tenant branding follows the hostname. Use default.localhost or saffron-routes.localhost;
the unqualified localhost host uses the default tenant. Logs are in .demo-runtime/.
Stop only these demo services with ./scripts/demo-down.sh
EOF
