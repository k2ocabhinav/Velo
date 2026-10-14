#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="${VELO_DOCKER_SMOKE_TAG:-docker-smoke}"
BACKEND_IMAGE="velo-backend:${IMAGE_TAG}"
ADMIN_IMAGE="velo-admin:${IMAGE_TAG}"
RIDER_IMAGE="velo-rider:${IMAGE_TAG}"
DRIVER_IMAGE="velo-driver:${IMAGE_TAG}"
LANDING_IMAGE="velo-landing:${IMAGE_TAG}"
SMOKE_DB="velo_docker_smoke"
PGHOST="${VELO_DOCKER_SMOKE_PGHOST:-localhost}"
PGPORT="${VELO_DOCKER_SMOKE_PGPORT:-5432}"
PGUSER="${VELO_DOCKER_SMOKE_PGUSER:-postgres}"
PGPASSWORD="${VELO_DOCKER_SMOKE_PGPASSWORD:-user}"
JWT_SECRET="${VELO_DOCKER_SMOKE_JWT_SECRET:-docker-smoke-only-secret-change-before-use-1234567890}"
NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8080}"
RUN_ID="$$"
BACKEND_CONTAINER="velo-docker-smoke-backend-${RUN_ID}"
ADMIN_CONTAINER="velo-docker-smoke-admin-${RUN_ID}"
BACKEND_STARTED=0
ADMIN_STARTED=0

cleanup() {
  if [[ "$ADMIN_STARTED" == "1" ]]; then
    docker rm -f "$ADMIN_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [[ "$BACKEND_STARTED" == "1" ]]; then
    docker rm -f "$BACKEND_CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

for command_name in docker curl psql createdb dropdb; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$command_name" >&2
    exit 1
  fi
done

docker info >/dev/null

export PGPASSWORD
PG_ARGS=(--host="$PGHOST" --port="$PGPORT" --username="$PGUSER")
printf 'Recreating the smoke database %s on %s:%s...\n' "$SMOKE_DB" "$PGHOST" "$PGPORT"
dropdb "${PG_ARGS[@]}" --if-exists "$SMOKE_DB"
createdb "${PG_ARGS[@]}" --template=template0 --encoding=UTF8 "$SMOKE_DB"
psql "${PG_ARGS[@]}" --dbname="$SMOKE_DB" --set=ON_ERROR_STOP=1 \
  --command='CREATE EXTENSION postgis;'

printf 'Building backend image %s...\n' "$BACKEND_IMAGE"
docker build --tag "$BACKEND_IMAGE" "$ROOT_DIR/velo-platform"

for app in admin rider driver landing; do
  image="velo-${app}:${IMAGE_TAG}"
  printf 'Building frontend image %s...\n' "$image"
  docker build \
    --build-arg "APP=${app}" \
    --build-arg "NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}" \
    --tag "$image" \
    "$ROOT_DIR/velo-frontend"
done

docker run --detach \
  --name "$BACKEND_CONTAINER" \
  --publish 127.0.0.1::8080 \
  --env SPRING_PROFILES_ACTIVE=local \
  --env SPRING_DATASOURCE_URL="jdbc:postgresql://host.docker.internal:5432/${SMOKE_DB}" \
  --env SPRING_DATASOURCE_USERNAME="$PGUSER" \
  --env SPRING_DATASOURCE_PASSWORD="$PGPASSWORD" \
  --env SPRING_DATA_REDIS_HOST=host.docker.internal \
  --env SPRING_DATA_REDIS_PORT=6379 \
  --env JWT_SECRET="$JWT_SECRET" \
  --env CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 \
  --env MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS=always \
  "$BACKEND_IMAGE" >/dev/null
BACKEND_STARTED=1
BACKEND_BINDING="$(docker port "$BACKEND_CONTAINER" 8080/tcp | head -n 1)"
BACKEND_PORT="${BACKEND_BINDING##*:}"
if [[ -z "$BACKEND_PORT" || "$BACKEND_PORT" == "$BACKEND_BINDING" ]]; then
  printf 'Could not determine the backend host port from: %s\n' "$BACKEND_BINDING" >&2
  exit 1
fi

printf 'Waiting for backend readiness at http://127.0.0.1:%s/actuator/health/readiness...\n' "$BACKEND_PORT"
BACKEND_HEALTH_READY=0
for attempt in $(seq 1 90); do
  HEALTH_HTTP_CODE="$(curl --silent --show-error --max-time 3 \
    --output /dev/null --write-out '%{http_code}' \
    "http://127.0.0.1:${BACKEND_PORT}/actuator/health/readiness" 2>/dev/null || true)"
  if [[ "$HEALTH_HTTP_CODE" == "200" ]]; then
    printf 'Backend readiness returned HTTP 200.\n'
    BACKEND_HEALTH_READY=1
    break
  fi

  if (( attempt % 15 == 0 )); then
    printf 'Still waiting for backend health (%s/90)...\n' "$attempt"
  fi
  sleep 2
done

if [[ "$BACKEND_HEALTH_READY" != "1" ]]; then
  docker logs "$BACKEND_CONTAINER" >&2 || true
  printf 'Backend did not reach readiness; last status: %s\n' "${HEALTH_HTTP_CODE:-<none>}" >&2
  exit 1
fi

docker run --detach \
  --name "$ADMIN_CONTAINER" \
  --publish 127.0.0.1::3000 \
  --env "VELO_API_BASE_URL=http://host.docker.internal:${BACKEND_PORT}" \
  --env VELO_AUTH_COOKIE_SECURE=false \
  "$ADMIN_IMAGE" >/dev/null
ADMIN_STARTED=1
ADMIN_BINDING="$(docker port "$ADMIN_CONTAINER" 3000/tcp | head -n 1)"
ADMIN_PORT="${ADMIN_BINDING##*:}"
if [[ -z "$ADMIN_PORT" || "$ADMIN_PORT" == "$ADMIN_BINDING" ]]; then
  printf 'Could not determine the admin host port from: %s\n' "$ADMIN_BINDING" >&2
  exit 1
fi

printf 'Waiting for admin /login at http://127.0.0.1:%s/login...\n' "$ADMIN_PORT"
ADMIN_LOGIN_READY=0
for attempt in $(seq 1 45); do
  LOGIN_HTTP_CODE="$(curl --silent --show-error --max-time 3 \
    --output /dev/null --write-out '%{http_code}' \
    "http://127.0.0.1:${ADMIN_PORT}/login" 2>/dev/null || true)"
  if [[ "$LOGIN_HTTP_CODE" == "200" ]]; then
    printf 'Admin /login returned HTTP 200.\n'
    ADMIN_LOGIN_READY=1
    break
  fi
  sleep 2
done

if [[ "$ADMIN_LOGIN_READY" != "1" ]]; then
  docker logs "$ADMIN_CONTAINER" >&2 || true
  printf 'Admin /login did not return HTTP 200; last status: %s\n' "${LOGIN_HTTP_CODE:-<none>}" >&2
  exit 1
fi

printf '\nBuilt image sizes (local architecture):\n'
for image in "$BACKEND_IMAGE" "$ADMIN_IMAGE" "$RIDER_IMAGE" "$DRIVER_IMAGE" "$LANDING_IMAGE"; do
  size_bytes="$(docker image inspect --format '{{.Size}}' "$image")"
  size_mib="$(awk -v bytes="$size_bytes" 'BEGIN { printf "%.1f", bytes / 1048576 }')"
  printf '  %-32s %8s MiB\n' "$image" "$size_mib"
done
printf '\nSmoke checks passed. Containers will be removed; images and %s are retained.\n' "$SMOKE_DB"
