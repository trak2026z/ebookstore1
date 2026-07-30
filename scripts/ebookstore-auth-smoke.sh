#!/usr/bin/env bash
set -Eeuo pipefail

API_ORIGIN="${API_ORIGIN:-http://localhost:3001}"
API_BASE="${API_ORIGIN%/}/api/v1"
KEEP_ENV="${KEEP_ENV:-0}"

COMPOSE=(docker compose)
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ebookstore-auth-smoke.XXXXXX")"
LAST_BODY=""
ENV_TOUCHED=0
BACKEND_READY=0
TEST_COUNT=0

log() {
  printf '\n==> %s\n' "$1"
}

test_pass() {
  TEST_COUNT=$((TEST_COUNT + 1))
  printf 'TEST PASS %02d: %s\n' "$TEST_COUNT" "$1"
}

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

cleanup() {
  local exit_code=$?

  trap - EXIT INT TERM
  set +e

  if [[ "$exit_code" -ne 0 && "$BACKEND_READY" == "1" ]]; then
    printf '\n--- Docker diagnostics ---\n' >&2
    "${COMPOSE[@]}" ps >&2
    "${COMPOSE[@]}" logs --no-color --tail=120 postgres api >&2
  fi

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
    printf '\nSUCCESS: %d authentication assertions passed.\n' "$TEST_COUNT"
  else
    printf '\nFAILED: authentication smoke exited with code %d.\n' "$exit_code" >&2
  fi

  exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT TERM

cat > "$TMP_DIR/check.py" <<'PY'
import json
import sys

mode, path, email = sys.argv[1:4]

with open(path, encoding="utf-8") as handle:
    payload = json.load(handle)


def assert_public_user(user):
    assert user["email"] == email, user
    assert user["role"] == "USER", user
    assert isinstance(user["id"], str) and user["id"], user
    assert isinstance(user["createdAt"], str) and user["createdAt"], user

    forbidden = {"password", "passwordHash", "isActive", "updatedAt"}
    leaked = forbidden.intersection(user)
    assert not leaked, f"private user fields leaked: {sorted(leaked)}"


def assert_error(code):
    assert payload["code"] == code, payload
    assert isinstance(payload["message"], str) and payload["message"], payload
    assert isinstance(payload["requestId"], str) and payload["requestId"], payload
    assert isinstance(payload["details"], list), payload


if mode == "register":
    assert_public_user(payload)
    assert payload["displayName"] == "Smoke User", payload
elif mode == "login":
    assert payload["tokenType"] == "Bearer", payload
    assert isinstance(payload["expiresIn"], int) and payload["expiresIn"] > 0, payload
    assert isinstance(payload["accessToken"], str) and payload["accessToken"], payload
    assert_public_user(payload["user"])
elif mode == "me":
    assert_public_user(payload)
elif mode == "conflict":
    assert_error("CONFLICT")
elif mode == "unauthorized":
    assert_error("UNAUTHORIZED")
else:
    raise AssertionError(f"unknown check mode: {mode}")
PY

request() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_status="$4"
  local safe_name
  local status

  shift 4

  safe_name="$(printf '%s' "$name" | tr ' /' '__' | tr -cd '[:alnum:]_.-')"
  LAST_BODY="$TMP_DIR/$safe_name.body"

  if ! status="$(
    curl -sS       --connect-timeout 3       --max-time 15       -X "$method"       -o "$LAST_BODY"       -w '%{http_code}'       "$@"       "${API_BASE%/}${path}"
  )"; then
    fail "$name could not connect to ${API_BASE%/}${path}"
  fi

  [[ "$status" == "$expected_status" ]] ||
    fail "$name returned HTTP $status; expected $expected_status"

  test_pass "$name returned HTTP $status"
}

check_json() {
  local mode="$1"
  local email="$2"

  python3 -S "$TMP_DIR/check.py" "$mode" "$LAST_BODY" "$email" ||
    fail "JSON contract failed: $mode"

  test_pass "JSON contract: $mode"
}

require docker
require curl
require python3

[[ -f scripts/smoke-backend.sh ]] ||
  fail "Run this script from the repository root containing scripts/smoke-backend.sh"

[[ -f compose.yaml || -f docker-compose.yml || -f docker-compose.yaml ]] ||
  fail "Run this script from the repository root containing Compose configuration"

docker info >/dev/null 2>&1 || fail "Docker daemon is not available"

printf 'Ebookstore authentication clean-room smoke test\nAPI: %s\n' "$API_BASE"

log "Preparing a clean backend environment through smoke-backend.sh"
ENV_TOUCHED=1
KEEP_ENV=1 API_ORIGIN="$API_ORIGIN" bash scripts/smoke-backend.sh
BACKEND_READY=1
printf 'SETUP PASS: backend clean-room smoke completed and environment retained.\n'

EMAIL="smoke.$(date +%s).$$@example.test"
PASSWORD='Correct-Horse-42'
DISPLAY_NAME='Smoke User'

cat > "$TMP_DIR/register.json" <<JSON
{
  "email": "$EMAIL",
  "displayName": "$DISPLAY_NAME",
  "password": "$PASSWORD"
}
JSON

cat > "$TMP_DIR/login.json" <<JSON
{
  "email": "$EMAIL",
  "password": "$PASSWORD"
}
JSON

cat > "$TMP_DIR/bad-login.json" <<JSON
{
  "email": "$EMAIL",
  "password": "Definitely-Wrong-42"
}
JSON

log "Checking authentication endpoints"

request   "registration"   POST   "/auth/register"   201   -H 'Content-Type: application/json'   --data-binary "@$TMP_DIR/register.json"
check_json register "$EMAIL"

request   "login"   POST   "/auth/login"   200   -H 'Content-Type: application/json'   --data-binary "@$TMP_DIR/login.json"
check_json login "$EMAIL"

TOKEN="$(
  python3 -S -c     'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["accessToken"])'     "$LAST_BODY"
)"

[[ -n "$TOKEN" ]] || fail "login response did not contain an access token"

request   "current user"   GET   "/auth/me"   200   -H "Authorization: Bearer $TOKEN"
check_json me "$EMAIL"

request   "duplicate registration"   POST   "/auth/register"   409   -H 'Content-Type: application/json'   --data-binary "@$TMP_DIR/register.json"
check_json conflict "$EMAIL"

request   "invalid credentials"   POST   "/auth/login"   401   -H 'Content-Type: application/json'   --data-binary "@$TMP_DIR/bad-login.json"
check_json unauthorized "$EMAIL"

request   "missing Bearer token"   GET   "/auth/me"   401
check_json unauthorized "$EMAIL"
