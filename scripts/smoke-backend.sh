#!/usr/bin/env bash
set -Eeuo pipefail

API_ORIGIN="${API_ORIGIN:-http://localhost:3001}"
API_BASE="${API_ORIGIN%/}/api/v1"
EXPECTED_COVER_FILE="${EXPECTED_COVER_FILE:-storage/covers/typescript-w-praktyce.epub.jpg}"
KEEP_ENV="${KEEP_ENV:-0}"

COMPOSE=(docker compose)
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ebookstore-smoke.XXXXXX")"
LAST_BODY=""
LAST_HEADERS=""
TEST_COUNT=0
SETUP_COUNT=0
ENV_TOUCHED=0
COVER_FILE_EXISTED=0
COVER_BACKUP="$TMP_DIR/original-cover"

log() { printf '\n==> %s\n' "$1"; }
setup_pass() { SETUP_COUNT=$((SETUP_COUNT + 1)); printf 'SETUP PASS %02d: %s\n' "$SETUP_COUNT" "$1"; }
test_pass() { TEST_COUNT=$((TEST_COUNT + 1)); printf 'TEST  PASS %02d: %s\n' "$TEST_COUNT" "$1"; }

fail() {
  printf '\nFAIL: %s\n' "$1" >&2
  if [[ -f "${LAST_BODY:-}" ]]; then
    printf '%s\n' '--- response body ---' >&2
    cat "$LAST_BODY" >&2
    printf '\n' >&2
  fi
  exit 1
}

require() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

restore_cover_fixture() {
  if [[ "$COVER_FILE_EXISTED" == "1" ]]; then
    cp "$COVER_BACKUP" "$EXPECTED_COVER_FILE"
  else
    rm -f "$EXPECTED_COVER_FILE"
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  set +e

  if [[ "$exit_code" -ne 0 && "$ENV_TOUCHED" == "1" ]]; then
    printf '\n--- Docker diagnostics ---\n' >&2
    "${COMPOSE[@]}" ps >&2
    "${COMPOSE[@]}" logs --no-color --tail=120 postgres api >&2
  fi

  restore_cover_fixture

  if [[ "$ENV_TOUCHED" == "1" ]]; then
    if [[ "$KEEP_ENV" == "1" ]]; then
      printf '\nCLEANUP SKIPPED: KEEP_ENV=1; Docker environment is still running.\n'
    else
      log "Removing Docker Compose environment"
      "${COMPOSE[@]}" down -v --remove-orphans
      printf 'CLEANUP PASS: containers, networks and named volumes removed.\n'
    fi
  fi

  rm -rf "$TMP_DIR"

  if [[ "$exit_code" -eq 0 ]]; then
    printf '\nSUCCESS: %d setup steps and %d test assertions passed.\n' "$SETUP_COUNT" "$TEST_COUNT"
  else
    printf '\nFAILED: smoke test exited with code %d; cleanup completed.\n' "$exit_code" >&2
  fi

  exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT TERM

cat > "$TMP_DIR/check.py" <<'PY'
import json
import sys

mode, path = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    payload = json.load(handle)

def error(code):
    assert payload["code"] == code, payload
    assert isinstance(payload.get("message"), str) and payload["message"], payload
    assert isinstance(payload.get("requestId"), str) and payload["requestId"], payload
    assert isinstance(payload.get("details"), list), payload

def private(value):
    forbidden = {"coverKey", "priceMinor", "status", "publishedAt", "createdAt", "updatedAt"}
    if isinstance(value, dict):
        leaked = forbidden.intersection(value)
        assert not leaked, f"private fields leaked: {sorted(leaked)}"
        for child in value.values():
            private(child)
    elif isinstance(value, list):
        for child in value:
            private(child)

if mode == "health":
    assert payload == {"status": "ok"}, payload
elif mode == "ready":
    assert payload == {"status": "ready", "checks": {"database": "ok"}}, payload
elif mode == "authors":
    assert {"marcin-kowalski", "anna-nowak", "piotr-zielinski"} <= {
        item["slug"] for item in payload["items"]
    }, payload
elif mode == "categories":
    assert {"programowanie", "architektura-oprogramowania", "bezpieczenstwo"} <= {
        item["slug"] for item in payload["items"]
    }, payload
elif mode == "list":
    slugs = {item["slug"] for item in payload["items"]}
    assert {"typescript-w-praktyce", "architektura-aplikacji-node-js"} <= slugs, payload
    assert {"bezpieczne-api-w-nestjs", "refaktoryzacja-javascript"}.isdisjoint(slugs), payload
    assert payload["pagination"]["page"] == 1, payload
    assert payload["pagination"]["pageSize"] == 20, payload
    private(payload)
elif mode == "search":
    assert payload["items"][0]["slug"] == "typescript-w-praktyce", payload
elif mode == "filtered":
    expected = ["typescript-w-praktyce", "architektura-aplikacji-node-js"]
    selected = [item["slug"] for item in payload["items"] if item["slug"] in expected]
    assert selected == expected, payload
    assert all(
        any(category["slug"] == "architektura-oprogramowania" for category in item["categories"])
        for item in payload["items"]
    ), payload
elif mode == "author":
    assert payload["items"], payload
    assert all(
        any(author["slug"] == "marcin-kowalski" for author in item["authors"])
        for item in payload["items"]
    ), payload
    assert all(item["slug"] != "refaktoryzacja-javascript" for item in payload["items"]), payload
elif mode == "details":
    assert payload["slug"] == "typescript-w-praktyce", payload
    assert payload["isbn"] == "9780000000002", payload
    assert payload["price"] == {"amountMinor": 7990, "currency": "PLN"}, payload
    assert payload["format"] == "EPUB", payload
    assert len(payload["authors"]) == 2 and len(payload["categories"]) == 2, payload
    assert payload["coverUrl"].startswith("/api/v1/books/"), payload
    assert payload["coverUrl"].endswith("/cover"), payload
    private(payload)
elif mode == "book404":
    error("BOOK_NOT_FOUND")
elif mode == "cover404":
    error("BOOK_COVER_NOT_FOUND")
elif mode == "validation":
    error("VALIDATION_ERROR")
elif mode == "unauthorized":
    error("UNAUTHORIZED")
else:
    raise AssertionError(f"unknown check mode: {mode}")
PY

request() {
  local name="$1" path="$2" expected="$3" safe status
  safe="$(printf '%s' "$name" | tr ' /' '__' | tr -cd '[:alnum:]_.-')"
  LAST_BODY="$TMP_DIR/$safe.body"
  LAST_HEADERS="$TMP_DIR/$safe.headers"

  if ! status="$(
    curl -sS --connect-timeout 3 --max-time 15 \
      -D "$LAST_HEADERS" \
      -o "$LAST_BODY" \
      -w '%{http_code}' \
      "${API_ORIGIN%/}${path}"
  )"; then
    fail "$name could not connect to ${API_ORIGIN%/}${path}"
  fi

  [[ "$status" == "$expected" ]] || fail "$name returned HTTP $status; expected $expected"
  test_pass "$name returned HTTP $status"
}

check_json() {
  python3 -S "$TMP_DIR/check.py" "$1" "$LAST_BODY" || fail "JSON contract failed: $1"
  test_pass "JSON contract: $1"
}

wait_for_postgres() {
  local container_id status
  container_id="$("${COMPOSE[@]}" ps -q postgres)"
  [[ -n "$container_id" ]] || fail "PostgreSQL container was not created"

  for _ in $(seq 1 60); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$container_id" 2>/dev/null || true)"
    [[ "$status" == "healthy" ]] && return
    sleep 1
  done

  fail "PostgreSQL did not become healthy"
}

wait_for_api() {
  for _ in $(seq 1 60); do
    curl -fsS --max-time 2 "$API_BASE/ready" >/dev/null 2>&1 && return
    sleep 1
  done

  fail "API did not become ready at $API_BASE/ready"
}

create_cover_fixture() {
  mkdir -p "$(dirname "$EXPECTED_COVER_FILE")"

  if [[ -e "$EXPECTED_COVER_FILE" ]]; then
    [[ -f "$EXPECTED_COVER_FILE" && ! -L "$EXPECTED_COVER_FILE" ]] \
      || fail "Expected cover path must be a regular file: $EXPECTED_COVER_FILE"
    cp "$EXPECTED_COVER_FILE" "$COVER_BACKUP"
    COVER_FILE_EXISTED=1
  fi

  python3 - "$EXPECTED_COVER_FILE" <<'PY'
from base64 import b64decode
from pathlib import Path
import sys

jpeg = b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////"
    "2wBDAf//////////////////////////////////////////////////////////////////////////////////////"
    "wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/"
    "9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAA"
    "AAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAA"
    "AAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/"
    "xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//"
    "xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q=="
)
path = Path(sys.argv[1])
path.write_bytes(jpeg)
print(f"Created {path} ({path.stat().st_size} bytes)")
PY
}

require docker
require curl
require python3
require cmp
[[ -f compose.yaml || -f docker-compose.yml || -f docker-compose.yaml ]] \
  || fail "Run this script from the repository root containing Compose configuration"
[[ -f package.json ]] || fail "Run this script from the repository root containing package.json"
docker info >/dev/null 2>&1 || fail "Docker daemon is not available"

printf 'Ebookstore backend clean-room smoke test\nAPI: %s\n' "$API_BASE"

log "Resetting previous Docker Compose environment"
ENV_TOUCHED=1
"${COMPOSE[@]}" down -v --remove-orphans
setup_pass "previous containers, networks and volumes removed"

log "Building workspace and API images"
"${COMPOSE[@]}" build workspace api
setup_pass "Docker images built"

log "Starting PostgreSQL"
"${COMPOSE[@]}" up -d postgres
wait_for_postgres
setup_pass "PostgreSQL is healthy"

log "Installing dependencies into the Compose volume"
"${COMPOSE[@]}" run --rm workspace npm ci
setup_pass "npm dependencies installed"

log "Applying database migrations"
"${COMPOSE[@]}" run --rm workspace \
  npm run db:migrate:deploy --workspace @ebookstore/api
setup_pass "database migrations applied"

log "Seeding deterministic test data"
"${COMPOSE[@]}" run --rm workspace \
  npm run db:seed --workspace @ebookstore/api
setup_pass "database seed completed"

log "Creating deterministic cover fixture"
create_cover_fixture
setup_pass "cover fixture created"

log "Starting API"
"${COMPOSE[@]}" up -d api
wait_for_api
"${COMPOSE[@]}" ps
setup_pass "API readiness reached"

log "Checking HTTP endpoints"
request "health" "/api/v1/health" 200
check_json health

request "readiness" "/api/v1/ready" 200
check_json ready

request "authors" "/api/v1/authors" 200
check_json authors

request "categories" "/api/v1/categories" 200
check_json categories

request "book list" "/api/v1/books?page=1&pageSize=20" 200
check_json list

request "title search" "/api/v1/books?query=typescript" 200
check_json search

request "category and price sort" \
  "/api/v1/books?category=architektura-oprogramowania&sortBy=price&sortOrder=asc" 200
check_json filtered

request "author filter" "/api/v1/books?author=marcin-kowalski" 200
check_json author

request "book details" "/api/v1/books/typescript-w-praktyce" 200
check_json details

COVER_URL="$(
  python3 -S -c \
    'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["coverUrl"])' \
    "$LAST_BODY"
)"

request "draft hidden" "/api/v1/books/bezpieczne-api-w-nestjs" 404
check_json book404

request "withdrawn hidden" "/api/v1/books/refaktoryzacja-javascript" 404
check_json book404

request "missing book" "/api/v1/books/definitely-missing-book" 404
check_json book404

request "invalid query" "/api/v1/books?pageSize=101" 400
check_json validation

request "auth guard" "/api/v1/auth/me" 401
check_json unauthorized

request "cover stream" "$COVER_URL" 200
CONTENT_TYPE="$(
  awk -F ': *' 'tolower($1)=="content-type"{gsub("\r","",$2);print tolower($2)}' \
    "$LAST_HEADERS" | tail -1
)"
CONTENT_LENGTH="$(
  awk -F ': *' 'tolower($1)=="content-length"{gsub("\r","",$2);print $2}' \
    "$LAST_HEADERS" | tail -1
)"
RESPONSE_LENGTH="$(wc -c < "$LAST_BODY" | tr -d ' ')"

[[ "$CONTENT_TYPE" == image/jpeg* ]] || fail "cover Content-Type is '$CONTENT_TYPE'"
test_pass "cover Content-Type is image/jpeg"
[[ -n "$CONTENT_LENGTH" && "$CONTENT_LENGTH" == "$RESPONSE_LENGTH" ]] \
  || fail "cover Content-Length mismatch"
test_pass "cover Content-Length matches response bytes"
[[ "$RESPONSE_LENGTH" -gt 0 ]] || fail "cover response is empty"
test_pass "cover response is not empty"
cmp "$EXPECTED_COVER_FILE" "$LAST_BODY" || fail "cover bytes differ from fixture"
test_pass "cover bytes match fixture"

request "invalid cover UUID" "/api/v1/books/not-a-uuid/cover" 400
check_json validation

request "missing cover book" \
  "/api/v1/books/11111111-1111-4111-8111-111111111111/cover" 404
check_json cover404
