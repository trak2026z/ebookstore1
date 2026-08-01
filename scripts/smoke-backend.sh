#!/usr/bin/env bash
set -Eeuo pipefail

API_ORIGIN="${API_ORIGIN:-http://localhost:3001}"
API_BASE="${API_ORIGIN%/}/api/v1"
EXPECTED_COVER_FILE="${EXPECTED_COVER_FILE:-storage/covers/typescript-w-praktyce.epub.jpg}"
KEEP_ENV="${KEEP_ENV:-0}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin.smoke@example.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Correct-Admin-42}"
ADMIN_DISPLAY_NAME="${ADMIN_DISPLAY_NAME:-Smoke Administrator}"
SMOKE_USER_PASSWORD="${SMOKE_USER_PASSWORD:-Correct-User-42}"

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

    if [[ "$KEEP_ENV" == "1" ]]; then
      printf '\nADMIN LOGIN (local smoke environment):\n'
      printf '  email: %s\n' "$ADMIN_EMAIL"
      printf '  password: %s\n' "$ADMIN_PASSWORD"
    fi
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
email = sys.argv[3] if len(sys.argv) > 3 else None

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

def public_user(user, role="USER"):
    assert email is not None and user["email"] == email, user
    assert user["role"] == role, user
    assert isinstance(user["id"], str) and user["id"], user
    assert isinstance(user["createdAt"], str) and user["createdAt"], user

    forbidden = {
        "password",
        "passwordHash",
        "isActive",
        "updatedAt",
    }
    leaked = forbidden.intersection(user)
    assert not leaked, f"private user fields leaked: {sorted(leaked)}"

def admin_user(user, expected_email, role, is_active):
    assert user["email"] == expected_email, user
    assert user["role"] == role, user
    assert user["isActive"] is is_active, user
    assert isinstance(user["id"], str) and user["id"], user
    assert isinstance(user["createdAt"], str) and user["createdAt"], user
    assert isinstance(user["updatedAt"], str) and user["updatedAt"], user

    forbidden = {"password", "passwordHash"}
    leaked = forbidden.intersection(user)
    assert not leaked, f"private user fields leaked: {sorted(leaked)}"

SMOKE_USER_EMAILS = {
    f"smoke.user.{index:02d}@example.test"
    for index in range(1, 21)
}

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
    assert len(payload["items"]) == 20, payload
    assert payload["pagination"] == {
        "page": 1,
        "pageSize": 20,
        "totalItems": 20,
        "totalPages": 1,
    }, payload
    private(payload)
elif mode == "page1":
    assert len(payload["items"]) == 12, payload
    assert payload["pagination"] == {
        "page": 1,
        "pageSize": 12,
        "totalItems": 20,
        "totalPages": 2,
    }, payload
    private(payload)
elif mode == "page2":
    assert len(payload["items"]) == 8, payload
    assert payload["pagination"] == {
        "page": 2,
        "pageSize": 12,
        "totalItems": 20,
        "totalPages": 2,
    }, payload
    private(payload)
elif mode == "search":
    expected = {
        "typescript-w-praktyce",
        "testowanie-aplikacji-typescript",
        "wzorce-projektowe-w-typescript",
        "refaktoryzacja-typescript",
    }
    actual = {item["slug"] for item in payload["items"]}

    assert actual == expected, payload
    assert payload["pagination"]["totalItems"] == len(expected), payload
    private(payload)
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
elif mode == "register":
    public_user(payload)
    expected_display_name = f"Smoke User {email.split('.')[2].split('@')[0]}"
    assert payload["displayName"] == expected_display_name, payload
elif mode == "login":
    assert payload["tokenType"] == "Bearer", payload
    assert isinstance(payload["expiresIn"], int) and payload["expiresIn"] > 0, payload
    assert isinstance(payload["accessToken"], str) and payload["accessToken"], payload
    public_user(payload["user"])
elif mode == "me":
    public_user(payload)
elif mode == "admin_login":
    assert payload["tokenType"] == "Bearer", payload
    assert isinstance(payload["expiresIn"], int) and payload["expiresIn"] > 0, payload
    assert isinstance(payload["accessToken"], str) and payload["accessToken"], payload
    public_user(payload["user"], "ADMIN")
elif mode == "admin_page1":
    assert payload["pagination"] == {
        "page": 1,
        "pageSize": 20,
        "total": 21,
        "totalPages": 2,
    }, payload
    assert len(payload["items"]) == 20, payload
    assert {item["email"] for item in payload["items"]} == SMOKE_USER_EMAILS, payload
    for item in payload["items"]:
        admin_user(item, item["email"], "USER", True)
elif mode == "admin_page2":
    assert payload["pagination"] == {
        "page": 2,
        "pageSize": 20,
        "total": 21,
        "totalPages": 2,
    }, payload
    assert len(payload["items"]) == 1, payload
    admin_user(payload["items"][0], email, "ADMIN", True)
elif mode == "admin_filtered_user":
    assert payload["pagination"] == {
        "page": 1,
        "pageSize": 20,
        "total": 1,
        "totalPages": 1,
    }, payload
    assert len(payload["items"]) == 1, payload
    admin_user(payload["items"][0], email, "USER", True)
elif mode == "admin_filtered_admin":
    assert payload["pagination"] == {
        "page": 1,
        "pageSize": 20,
        "total": 1,
        "totalPages": 1,
    }, payload
    assert len(payload["items"]) == 1, payload
    admin_user(payload["items"][0], email, "ADMIN", True)
elif mode == "admin_filtered_empty":
    assert payload["pagination"] == {
        "page": 1,
        "pageSize": 20,
        "total": 0,
        "totalPages": 0,
    }, payload
    assert payload["items"] == [], payload
elif mode == "admin_sorted_email_desc":
    assert payload["pagination"] == {
        "page": 1,
        "pageSize": 100,
        "total": 21,
        "totalPages": 1,
    }, payload
    expected_emails = sorted([*SMOKE_USER_EMAILS, email], reverse=True)
    assert [item["email"] for item in payload["items"]] == expected_emails, payload

    for item in payload["items"]:
        expected_role = "ADMIN" if item["email"] == email else "USER"
        admin_user(item, item["email"], expected_role, True)
elif mode == "admin_details":
    admin_user(payload, email, "USER", True)
elif mode == "admin_role_admin":
    admin_user(payload, email, "ADMIN", True)
elif mode == "admin_role_user":
    admin_user(payload, email, "USER", True)
elif mode == "admin_status_inactive":
    admin_user(payload, email, "USER", False)
elif mode == "admin_status_active":
    admin_user(payload, email, "USER", True)
elif mode == "forbidden":
    error("FORBIDDEN")
elif mode == "not_found":
    error("NOT_FOUND")
elif mode == "conflict":
    error("CONFLICT")
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

request_with_method() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected="$4"
  local safe
  local status

  shift 4

  safe="$(printf '%s' "$name" | tr ' /' '__' | tr -cd '[:alnum:]_.-')"
  LAST_BODY="$TMP_DIR/$safe.body"
  LAST_HEADERS="$TMP_DIR/$safe.headers"

  if ! status="$(
    curl -sS       --connect-timeout 3       --max-time 15       -X "$method"       -D "$LAST_HEADERS"       -o "$LAST_BODY"       -w '%{http_code}'       "$@"       "${API_BASE%/}${path}"
  )"; then
    fail "$name could not connect to ${API_BASE%/}${path}"
  fi

  [[ "$status" == "$expected" ]] ||
    fail "$name returned HTTP $status; expected $expected"

  test_pass "$name returned HTTP $status"
}

check_auth_json() {
  python3 -S     "$TMP_DIR/check.py"     "$1"     "$LAST_BODY"     "$2" ||
    fail "JSON contract failed: $1"

  test_pass "JSON contract: $1"
}

check_admin_pagination_pair() {
  if ! python3 -S - "$1" "$2" "$3" <<'PY'
import json
import sys

page_one_path, page_two_path, admin_email = sys.argv[1:4]

with open(page_one_path, encoding="utf-8") as handle:
    page_one = json.load(handle)

with open(page_two_path, encoding="utf-8") as handle:
    page_two = json.load(handle)

page_one_emails = {item["email"] for item in page_one["items"]}
page_two_emails = {item["email"] for item in page_two["items"]}
expected_users = {
    f"smoke.user.{index:02d}@example.test"
    for index in range(1, 21)
}

assert page_one_emails.isdisjoint(page_two_emails), {
    "pageOne": sorted(page_one_emails),
    "pageTwo": sorted(page_two_emails),
}
assert page_one_emails == expected_users, page_one
assert page_two_emails == {admin_email}, page_two
PY
  then
    fail "Admin user pagination pages overlap or are incomplete"
  fi

  test_pass "admin pages are disjoint and contain 20 users plus the administrator"
}

check_pagination_pair() {
  python3 -S - "$1" "$2" <<'PY' || fail "Pagination pages overlap or are incomplete"
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    page_one = json.load(handle)

with open(sys.argv[2], encoding="utf-8") as handle:
    page_two = json.load(handle)

page_one_slugs = {item["slug"] for item in page_one["items"]}
page_two_slugs = {item["slug"] for item in page_two["items"]}

assert page_one_slugs.isdisjoint(page_two_slugs), {
    "pageOne": sorted(page_one_slugs),
    "pageTwo": sorted(page_two_slugs),
}

assert len(page_one_slugs | page_two_slugs) == 20, {
    "pageOne": sorted(page_one_slugs),
    "pageTwo": sorted(page_two_slugs),
}
PY

  test_pass "pagination pages are disjoint and contain all 20 published books"
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

printf 'Ebookstore backend and authentication clean-room smoke test\nAPI: %s\n' "$API_BASE"

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

log "Generating Prisma client"
"${COMPOSE[@]}" run --rm workspace \
  npm run db:generate --workspace @ebookstore/api

if [[ \
  ! -f apps/api/src/generated/prisma/enums.ts && \
  ! -f apps/api/src/generated/prisma/enums.js \
 ]]; then
  fail "Prisma client generation did not create catalog enums"
fi

setup_pass "Prisma client generated"

log "Applying database migrations"
"${COMPOSE[@]}" run --rm workspace \
  npm run db:migrate:deploy --workspace @ebookstore/api
setup_pass "database migrations applied"

log "Seeding deterministic catalog data and administrator"
"${COMPOSE[@]}" run --rm \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ADMIN_DISPLAY_NAME="$ADMIN_DISPLAY_NAME" \
  workspace \
  npm run db:seed --workspace @ebookstore/api
setup_pass "catalog and administrator seed completed"

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

request "pagination page 1" "/api/v1/books?page=1&pageSize=12" 200
check_json page1
PAGE_ONE_BODY="$LAST_BODY"

request "pagination page 2" "/api/v1/books?page=2&pageSize=12" 200
check_json page2
PAGE_TWO_BODY="$LAST_BODY"

check_pagination_pair "$PAGE_ONE_BODY" "$PAGE_TWO_BODY"

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

log "Creating 20 deterministic USER accounts"

FIRST_USER_EMAIL="smoke.user.01@example.test"

for ((user_number = 1; user_number <= 20; user_number += 1)); do
  index="$(printf '%02d' "$user_number")"
  EMAIL="smoke.user.${index}@example.test"
  DISPLAY_NAME="Smoke User ${index}"
  REGISTER_FILE="$TMP_DIR/register-${index}.json"

  cat > "$REGISTER_FILE" <<JSON
{
  "email": "$EMAIL",
  "displayName": "$DISPLAY_NAME",
  "password": "$SMOKE_USER_PASSWORD"
}
JSON

  request_with_method \
    "registration user ${index}" \
    POST \
    "/auth/register" \
    201 \
    -H 'Content-Type: application/json' \
    --data-binary "@$REGISTER_FILE"
  check_auth_json register "$EMAIL"
done

log "Checking authentication endpoints"

cat > "$TMP_DIR/login.json" <<JSON
{
  "email": "$FIRST_USER_EMAIL",
  "password": "$SMOKE_USER_PASSWORD"
}
JSON

cat > "$TMP_DIR/bad-login.json" <<JSON
{
  "email": "$FIRST_USER_EMAIL",
  "password": "Definitely-Wrong-42"
}
JSON

request_with_method \
  "login" \
  POST \
  "/auth/login" \
  200 \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/login.json"
check_auth_json login "$FIRST_USER_EMAIL"

TOKEN="$(
  python3 -S -c \
    'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["accessToken"])' \
    "$LAST_BODY"
)"

[[ -n "$TOKEN" ]] ||
  fail "login response did not contain an access token"

request_with_method \
  "current user" \
  GET \
  "/auth/me" \
  200 \
  -H "Authorization: Bearer $TOKEN"
check_auth_json me "$FIRST_USER_EMAIL"

request_with_method \
  "duplicate registration" \
  POST \
  "/auth/register" \
  409 \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/register-01.json"
check_auth_json conflict "$FIRST_USER_EMAIL"

request_with_method \
  "invalid credentials" \
  POST \
  "/auth/login" \
  401 \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/bad-login.json"
check_auth_json unauthorized "$FIRST_USER_EMAIL"

request_with_method \
  "missing Bearer token" \
  GET \
  "/auth/me" \
  401
check_auth_json unauthorized "$FIRST_USER_EMAIL"

log "Checking administrator endpoints"

cat > "$TMP_DIR/admin-login.json" <<JSON
{
  "email": "$ADMIN_EMAIL",
  "password": "$ADMIN_PASSWORD"
}
JSON

request_with_method \
  "administrator login" \
  POST \
  "/auth/login" \
  200 \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/admin-login.json"
check_auth_json admin_login "$ADMIN_EMAIL"

ADMIN_TOKEN="$(
  python3 -S -c \
    'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["accessToken"])' \
    "$LAST_BODY"
)"

ADMIN_USER_ID="$(
  python3 -S -c \
    'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["user"]["id"])' \
    "$LAST_BODY"
)"

[[ -n "$ADMIN_TOKEN" ]] ||
  fail "administrator login response did not contain an access token"

[[ -n "$ADMIN_USER_ID" ]] ||
  fail "administrator login response did not contain the administrator ID"

request_with_method \
  "admin list missing token" \
  GET \
  "/admin/users?page=1&pageSize=20" \
  401
check_auth_json unauthorized "$ADMIN_EMAIL"

request_with_method \
  "admin list regular user guard" \
  GET \
  "/admin/users?page=1&pageSize=20" \
  403 \
  -H "Authorization: Bearer $TOKEN"
check_auth_json forbidden "$FIRST_USER_EMAIL"

request_with_method \
  "admin users page 1" \
  GET \
  "/admin/users?page=1&pageSize=20" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_auth_json admin_page1 "$ADMIN_EMAIL"
ADMIN_PAGE_ONE_BODY="$LAST_BODY"

request_with_method \
  "admin users page 2" \
  GET \
  "/admin/users?page=2&pageSize=20" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_auth_json admin_page2 "$ADMIN_EMAIL"
ADMIN_PAGE_TWO_BODY="$LAST_BODY"

check_admin_pagination_pair \
  "$ADMIN_PAGE_ONE_BODY" \
  "$ADMIN_PAGE_TWO_BODY" \
  "$ADMIN_EMAIL"

request_with_method \
  "admin combined user filters" \
  GET \
  "/admin/users?page=1&pageSize=20&query=SMOKE.USER.01&role=USER&status=active" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_auth_json admin_filtered_user "$FIRST_USER_EMAIL"

request_with_method \
  "admin role filter" \
  GET \
  "/admin/users?page=1&pageSize=20&role=ADMIN" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_auth_json admin_filtered_admin "$ADMIN_EMAIL"

request_with_method \
  "admin inactive status filter" \
  GET \
  "/admin/users?page=1&pageSize=20&status=inactive" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_auth_json admin_filtered_empty "$ADMIN_EMAIL"

request_with_method \
  "admin email descending sort" \
  GET \
  "/admin/users?page=1&pageSize=100&sortBy=email&order=desc" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_auth_json admin_sorted_email_desc "$ADMIN_EMAIL"

request_with_method \
  "admin invalid sort field" \
  GET \
  "/admin/users?page=1&pageSize=20&sortBy=passwordHash" \
  400 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_json validation

request_with_method \
  "admin invalid sort order" \
  GET \
  "/admin/users?page=1&pageSize=20&order=sideways" \
  400 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_json validation

request_with_method \
  "admin invalid filter" \
  GET \
  "/admin/users?page=1&pageSize=20&role=OWNER" \
  400 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_json validation

MANAGED_USER_ID="$(
  python3 -S -c '
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)

for item in payload["items"]:
    if item["email"] == sys.argv[2]:
        print(item["id"])
        break
else:
    raise SystemExit("managed user was not found")
' "$ADMIN_PAGE_ONE_BODY" "$FIRST_USER_EMAIL"
)"

[[ -n "$MANAGED_USER_ID" ]] ||
  fail "admin list did not contain the managed user ID"

request_with_method \
  "admin user details" \
  GET \
  "/admin/users/$MANAGED_USER_ID" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_auth_json admin_details "$FIRST_USER_EMAIL"

request_with_method \
  "admin invalid user UUID" \
  GET \
  "/admin/users/not-a-uuid" \
  400 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_json validation

request_with_method \
  "admin missing user" \
  GET \
  "/admin/users/11111111-1111-4111-8111-111111111111" \
  404 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
check_auth_json not_found "$FIRST_USER_EMAIL"

cat > "$TMP_DIR/role-admin.json" <<'JSON'
{
  "role": "ADMIN"
}
JSON

cat > "$TMP_DIR/role-user.json" <<'JSON'
{
  "role": "USER"
}
JSON

cat > "$TMP_DIR/status-inactive.json" <<'JSON'
{
  "isActive": false
}
JSON

cat > "$TMP_DIR/status-active.json" <<'JSON'
{
  "isActive": true
}
JSON

request_with_method \
  "admin self demotion guard" \
  PATCH \
  "/admin/users/$ADMIN_USER_ID/role" \
  409 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/role-user.json"
check_auth_json conflict "$ADMIN_EMAIL"

request_with_method \
  "admin self deactivation guard" \
  PATCH \
  "/admin/users/$ADMIN_USER_ID/status" \
  409 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/status-inactive.json"
check_auth_json conflict "$ADMIN_EMAIL"

request_with_method \
  "admin promote user" \
  PATCH \
  "/admin/users/$MANAGED_USER_ID/role" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/role-admin.json"
check_auth_json admin_role_admin "$FIRST_USER_EMAIL"

request_with_method \
  "admin restore user role" \
  PATCH \
  "/admin/users/$MANAGED_USER_ID/role" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/role-user.json"
check_auth_json admin_role_user "$FIRST_USER_EMAIL"

request_with_method \
  "admin deactivate user" \
  PATCH \
  "/admin/users/$MANAGED_USER_ID/status" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/status-inactive.json"
check_auth_json admin_status_inactive "$FIRST_USER_EMAIL"

request_with_method \
  "admin reactivate user" \
  PATCH \
  "/admin/users/$MANAGED_USER_ID/status" \
  200 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/status-active.json"
check_auth_json admin_status_active "$FIRST_USER_EMAIL"
