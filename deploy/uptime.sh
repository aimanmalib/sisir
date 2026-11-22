#!/usr/bin/env bash
# Health watch for the public demo (run from cron every 15 minutes until the judging ends).
# GET / and /healthz through the public URL. Two failures in a row = one alert through NOTIFY_CMD ("<text>" warn);
# the first success after that = one recovery line ("<text>" info). Nothing is sent while the state does not change.
# Host values come from deploy/hos.env (SISIR_DOMAIN, NOTIFY_CMD). State: deploy/.uptime-state (not tracked).
# Overrides (tests): UPTIME_URL, UPTIME_STATE, UPTIME_NOTIFY, UPTIME_FAILS (failures before an alert, default 2).
set -uo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
# shellcheck disable=SC1091
[ -r "$ROOT/deploy/hos.env" ] && . "$ROOT/deploy/hos.env"
URL=${UPTIME_URL:-https://${SISIR_DOMAIN:-localhost}}
STATE=${UPTIME_STATE:-$ROOT/deploy/.uptime-state}
NOTIFY=${UPTIME_NOTIFY:-${NOTIFY_CMD:-}}
LIMIT=${UPTIME_FAILS:-2}

# State file: one line "<up|down> <failures in a row>".
prev=up; fails=0
[ -f "$STATE" ] && read -r prev fails < "$STATE"
[[ "${fails:-}" =~ ^[0-9]+$ ]] || fails=0
[ "$prev" = down ] || prev=up

send() { [ -n "$NOTIFY" ] && "$NOTIFY" "$1" "$2" >/dev/null 2>&1; return 0; }

bad=""
for p in / /healthz; do
  c=$(curl -s -o /dev/null -w '%{http_code}' -m 25 "$URL$p" || true)
  [ "${c:-000}" = 200 ] || bad="$bad $p=${c:-000}"
done
ctr=missing
if command -v docker >/dev/null; then
  ctr=$(docker inspect -f '{{.State.Status}}/{{.State.Health.Status}}' sisir 2>/dev/null | head -1) || ctr=""
  [[ "$ctr" == */* ]] || ctr=missing
fi

if [ -z "$bad" ]; then
  [ "$prev" = down ] && send "Sisir playground ($URL) is back: the page and /healthz answer 200 (container $ctr). Nothing to do." info
  prev=up; fails=0
else
  fails=$((fails + 1))
  if [ "$fails" -ge "$LIMIT" ] && [ "$prev" = up ]; then
    send "Sisir playground ($URL) failed $fails health checks in a row:$bad (container $ctr). Judges cannot open the playground. Check the container log; undo the last deploy with deploy/deploy.sh --rollback." warn
    prev=down
  fi
fi

printf '%s %s\n' "$prev" "$fails" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
exit 0
