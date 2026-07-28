#!/usr/bin/env bash
set -Eeuo pipefail

WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:5173}"
KEEP_ENV="${KEEP_ENV:-0}"

COMPOSE=(docker compose)
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ebookstore-web-smoke.XXXXXX")"
PREEXISTING_SERVICES=""
LAST_BODY=""

log() {
  printf "\n==> %s\n" "$1"
}

pass() {
  printf "PASS: %s\n" "$1"
}

fail() {
  printf "\nFAIL: %s\n" "$1" >&2

  if [[ -n "$LAST_BODY" && -f "$LAST_BODY" ]]; then
    printf '%s\n' "--- response body ---" >&2
    cat "$LAST_BODY" >&2
    printf "\n" >&2
  fi

  exit 1
}

require() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

was_running_before() {
  printf '%s\n' "$PREEXISTING_SERVICES" | grep -Fxq "$1"
}

cleanup() {
  local exit_code=$?

  trap - EXIT INT TERM
  set +e

  if [[ "$exit_code" -ne 0 ]]; then
    printf '\n--- Docker diagnostics ---\n' >&2
    "${COMPOSE[@]}" ps >&2
    "${COMPOSE[@]}" logs --no-color --tail=120 web api postgres >&2
  fi

  if [[ "$KEEP_ENV" == "1" ]]; then
    printf '\nCleanup skipped: KEEP_ENV=1.\n'
  else
    for service in web api postgres; do
      if ! was_running_before "$service"; then
        "${COMPOSE[@]}" stop "$service" >/dev/null 2>&1 || true
        "${COMPOSE[@]}" rm -f "$service" >/dev/null 2>&1 || true
      fi
    done
  fi

  rm -rf "$TMP_DIR"
  exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT TERM

wait_for_health() {
  local service="$1"
  local container_id status

  container_id="$("${COMPOSE[@]}" ps -q "$service")"
  [[ -n "$container_id" ]] || fail "Service $service has no container."

  for _ in $(seq 1 60); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$container_id" 2>/dev/null || true)"

    case "$status" in
      healthy)
        pass "$service container is healthy"
        return
        ;;
      unhealthy)
        fail "$service container became unhealthy"
        ;;
    esac

    sleep 1
  done

  fail "$service did not become healthy within 60 seconds"
}

request() {
  local name="$1"
  local path="$2"
  local expected_status="$3"
  local safe_name status

  safe_name="$(printf '%s' "$name" | tr ' /' '__' | tr -cd '[:alnum:]_.-')"
  LAST_BODY="$TMP_DIR/$safe_name.body"

  status="$(
    curl -sS       --connect-timeout 3       --max-time 15       -o "$LAST_BODY"       -w '%{http_code}'       "${WEB_ORIGIN%/}${path}"
  )" || fail "$name could not connect to ${WEB_ORIGIN%/}${path}"

  [[ "$status" == "$expected_status" ]] ||
    fail "$name returned HTTP $status; expected $expected_status"

  pass "$name returned HTTP $status"
}

require docker
require curl
require node
require grep
require seq

[[ -f compose.yaml ]] || fail "Run this script from the repository root."
[[ -f package.json ]] || fail "Repository package.json was not found."
docker info >/dev/null 2>&1 || fail "Docker daemon is not available."

PREEXISTING_SERVICES="$("${COMPOSE[@]}" ps --services --status running 2>/dev/null || true)"

printf 'Ebookstore web Compose smoke test\nWeb origin: %s\n' "$WEB_ORIGIN"

log "Building development images"
"${COMPOSE[@]}" build workspace api web
pass "workspace, API and web images built"

log "Starting PostgreSQL"
"${COMPOSE[@]}" up -d postgres

log "Installing locked dependencies into the Compose volume"
"${COMPOSE[@]}" run --rm workspace npm ci
pass "npm dependencies installed"

log "Generating the Prisma client"
"${COMPOSE[@]}" run --rm workspace   npm run db:generate --workspace @ebookstore/api
pass "Prisma client generated"

log "Starting API and web services"
"${COMPOSE[@]}" up -d api web
wait_for_health api
wait_for_health web

log "Checking the frontend document"
request "frontend document" "/" "200"
grep -Fq '<div id="root"' "$LAST_BODY" ||
  fail "frontend document does not contain the React root element"
pass "frontend document contains the React root element"

log "Checking the Vite API proxy"
request "proxied API health" "/api/v1/health" "200"
node -e '
  const fs = require("node:fs");
  const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));

  if (payload.status !== "ok") {
    process.exit(1);
  }
' "$LAST_BODY" || fail "proxied API health response does not match { status: \"ok\" }"
pass "Vite proxy returned the API health contract"

printf '\nSUCCESS: web service, healthcheck and /api proxy passed.\n'
