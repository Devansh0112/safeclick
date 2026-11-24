#!/usr/bin/env bash
# Usage: bash tests/build-visibility.sh present|absent [dist-dir]
# Checks that the Neon City page and its nav/home links are present or absent in a build.
set -u
expect="${1:-}"; dist="${2:-dist}"
case "$expect" in present|absent) ;; *) echo "usage: $0 present|absent [dist]" >&2; exit 2;; esac
page=no; link=no
[ -f "$dist/games/neon-city/index.html" ] && page=yes
grep -q 'href="/games/"' "$dist/index.html" 2>/dev/null && link=yes
want=no; [ "$expect" = present ] && want=yes
if [ "$page" = "$want" ] && [ "$link" = "$want" ]; then
  echo "PASS: game page=$page, home link=$link (expected $expect)"; exit 0
fi
echo "FAIL: game page=$page, home link=$link (expected $expect)"; exit 1
