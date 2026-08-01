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

check_react_document() {
  grep -Fq '<div id="root"' "$LAST_BODY" ||
    fail "$1 does not contain the React root element"

  pass "$1 contains the React root element"
}

check_error_code() {
  if ! node - "$LAST_BODY" "$1" <<'NODE'
const fs = require("node:fs");

const [, , path, expectedCode] = process.argv;
const payload = JSON.parse(fs.readFileSync(path, "utf8"));

if (
  payload.code !== expectedCode ||
  typeof payload.message !== "string" ||
  payload.message.length === 0 ||
  typeof payload.requestId !== "string" ||
  payload.requestId.length === 0 ||
  !Array.isArray(payload.details)
) {
  process.exit(1);
}
NODE
  then
    fail "JSON error contract does not match code $1"
  fi

  pass "JSON error contract contains code $1"
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

log "Stopping services that share the dependency volume"
"${COMPOSE[@]}" stop web api >/dev/null 2>&1 || true
pass "API and web services stopped before dependency installation"

log "Installing locked dependencies into the Compose volume"
"${COMPOSE[@]}" run --rm -T workspace \
  npm ci --include=optional \
  </dev/null
pass "npm dependencies installed"

log "Verifying API and web runtime dependencies"
"${COMPOSE[@]}" run --rm -T workspace \
  node --input-type=module \
  --eval 'await import("@nestjs/common"); await import("vite");' \
  </dev/null
pass "API and web runtime dependencies are resolvable"

log "Generating the Prisma client"
"${COMPOSE[@]}" run --rm -T workspace \
  npm run db:generate --workspace @ebookstore/api \
  </dev/null
pass "Prisma client generated"

log "Starting API and web services"
"${COMPOSE[@]}" up -d api web
wait_for_health api
wait_for_health web

log "Checking frontend SPA entry points"
request "frontend document" "/" "200"
check_react_document "frontend document"

request "admin users direct route" "/admin/users?page=2" "200"
check_react_document "admin users direct route"

request   "admin user details direct route"   "/admin/users/11111111-1111-4111-8111-111111111111?page=2"   "200"
check_react_document "admin user details direct route"

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

request   "proxied admin authentication guard"   "/api/v1/admin/users?page=1&pageSize=20"   "401"
check_error_code "UNAUTHORIZED"

printf '\nSUCCESS: web health, SPA fallbacks and /api proxy guards passed.\n'
