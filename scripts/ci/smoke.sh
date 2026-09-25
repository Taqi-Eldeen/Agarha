#!/usr/bin/env bash
# Post-deploy smoke test (staging after every merge, production after every release).
#   scripts/ci/smoke.sh https://staging.agarha.com https://api.staging.agarha.com
set -euo pipefail
WEB="${1:?web base url}"
API="${2:?api base url}"
fail=0
check() {
  local name="$1" url="$2" expect="$3"
  local body code
  body="$(curl -sS -m 15 -w '\n%{http_code}' "$url")" || { echo "✗ $name: request failed"; fail=1; return; }
  code="${body##*$'\n'}"
  if [ "$code" != "200" ] || ! grep -q -- "$expect" <<<"$body"; then echo "✗ $name ($code)"; fail=1; else echo "✓ $name"; fi
}
check "api health" "$API/v1/health" '"status"'
check "catalog" "$API/v1/catalog/cities" '"items"'
check "search" "$API/v1/search?city=cairo&limit=1" '"items"'
check "home (ar, rtl)" "$WEB/ar" 'dir="rtl"'
check "home (en)" "$WEB/en" 'lang="en"'
check "for dealers" "$WEB/ar/for-dealers" '<h1'
check "robots" "$WEB/robots.txt" 'Sitemap'
check "web health" "$WEB/api/health" '"ok"'
exit $fail
