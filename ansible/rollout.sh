#!/usr/bin/env bash
# Roll a Compose service onto the image currently tagged for it, one container
# at a time, without dropping below the desired replica count.
#
# Usage:
#   rollout.sh <service> <replicas> <app-dir> <project> <compose-file> [timeout-seconds]
#
# The caller must build/tag the new image first. The service must not publish
# host ports or set container_name, otherwise Compose cannot run overlapping
# containers.

set -euo pipefail

if (( $# < 5 )); then
  echo "Usage: $0 <service> <replicas> <app-dir> <project> <compose-file> [timeout-seconds]" >&2
  exit 2
fi

service="$1"
replicas="$2"
app_dir="$3"
project="$4"
compose_file="$5"
timeout_seconds="${6:-180}"

if ! [[ "$replicas" =~ ^[1-9][0-9]*$ ]]; then
  echo "Replicas must be a positive integer, got: $replicas" >&2
  exit 2
fi

compose() {
  docker compose --project-directory "$app_dir" -p "$project" -f "$compose_file" "$@"
}

container_health() {
  local id="$1"
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo missing
}

wait_until_healthy() {
  local deadline=$((SECONDS + timeout_seconds))
  local ids
  local id
  local status
  local count
  local healthy

  while (( SECONDS < deadline )); do
    ids="$(compose ps -q "$service")"
    count=0
    healthy=0
    for id in $ids; do
      count=$((count + 1))
      status="$(container_health "$id")"
      if [[ "$status" == "healthy" || "$status" == "running" ]]; then
        healthy=$((healthy + 1))
      fi
    done
    if (( count == replicas && healthy == replicas )); then
      return 0
    fi
    sleep 2
  done

  echo "Timed out waiting for $service to reach $replicas healthy containers." >&2
  compose ps "$service" >&2 || true
  compose logs --tail=80 "$service" >&2 || true
  return 1
}

# Remove containers that failed to start or failed their healthcheck, so the
# scale-up below can replace them with the current image.
existing_ids="$(compose ps -a -q "$service")"
for id in $existing_ids; do
  status="$(container_health "$id")"
  if [[ "$status" != "healthy" && "$status" != "running" ]]; then
    echo "Removing $service container ${id:0:12} (status: $status)."
    docker rm -f "$id" >/dev/null 2>&1 || true
  fi
done

# Capture the containers that still run the previous image. Anything created
# after this point already uses the current image.
old_ids="$(compose ps -q "$service")"
old_count=0
for id in $old_ids; do
  old_count=$((old_count + 1))
done

# Bring the service up to full capacity before replacing anything, so there is
# always spare capacity while a container is being recreated.
compose up -d --no-deps --no-recreate --scale "$service=$replicas" "$service"
if ! wait_until_healthy; then
  echo "$service is not healthy before the rollout started." >&2
  exit 1
fi

if (( old_count == 0 )); then
  echo "$service had no existing containers; started $replicas new container(s)."
  exit 0
fi

echo "Rolling $service: replacing $old_count existing container(s), one at a time."

for id in $old_ids; do
  if ! docker inspect "$id" >/dev/null 2>&1; then
    continue
  fi

  echo "Replacing $service container ${id:0:12}..."
  # SIGTERM first so the process can finish in-flight requests; SIGKILL after 15s.
  docker stop --time 15 "$id" >/dev/null 2>&1 || true
  docker rm "$id" >/dev/null 2>&1 || true
  compose up -d --no-deps --no-recreate --scale "$service=$replicas" "$service"

  if ! wait_until_healthy; then
    echo "$service rollout failed while replacing ${id:0:12}." >&2
    exit 1
  fi
done

echo "$service rollout complete: $replicas healthy container(s)."
