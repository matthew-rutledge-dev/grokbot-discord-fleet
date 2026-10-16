#!/usr/bin/env bash
# sendPrompt tunnel watchdog (generic). Probes a public tunnel URL and restarts the local connector when the
# edge goes stale. Single instance via flock. Never prints tokens.
#   - any probe result that is not a 3-digit HTTP code becomes 000; 000 or any 5xx = unhealthy
#   - probe every INTERVAL (60s); restart after FAIL_LIMIT (2) misses in a row
#   - wall-clock jump > JUMP_SECS (180s) between loops (hibernate/resume) => immediate restart
#   - daily forced restart at DAILY_HOUR (06) local, tracked by a date file (catches up on wake)
#   - lock fd is not inherited by children; every non-HEALTHY_CODE probe and every restart is logged
# Usage: sendprompt-tunnel-watchdog.sh [--selftest]
# Env:
#   SENDPROMPT_TUNNEL_URL     public URL to probe (required unless --selftest)
#   SENDPROMPT_STATE_DIR      logs/lock/stamp dir (default ${XDG_STATE_HOME:-$HOME/.local/state}/grokbot-sendprompt)
#   SENDPROMPT_CONNECTOR_MATCH  substring of the connector's cmdline used to find it (default: grok-bot-sendprompt-tunnel)
#   SENDPROMPT_CONNECTOR_PROC process name of the connector (default: cloudflared)
#   SENDPROMPT_ENSURE         optional command run after a kill to bring the connector back (default: sibling ensure script)
#   SENDPROMPT_HEALTHY_CODE   expected healthy code, logged quietly (default 404)
#   SENDPROMPT_INTERVAL / SENDPROMPT_FAIL_LIMIT / SENDPROMPT_JUMP_SECS / SENDPROMPT_DAILY_HOUR (60 / 2 / 180 / 6; empty hour disables)
set -uo pipefail
INTERVAL=${SENDPROMPT_INTERVAL:-60}
FAIL_LIMIT=${SENDPROMPT_FAIL_LIMIT:-2}
JUMP_SECS=${SENDPROMPT_JUMP_SECS:-180}
DAILY_HOUR=${SENDPROMPT_DAILY_HOUR-6}
OKCODE=${SENDPROMPT_HEALTHY_CODE:-404}

classify() { local c="$1"; [[ "$c" =~ ^[0-9]{3}$ ]] || c=000; echo "$c"; }
healthy() { [[ "$1" != 000 ]] && (( 10#$1 < 500 )); }

if [[ "${1:-}" == --selftest ]]; then
  rc=0
  for t in "404 healthy" "200 healthy" "301 healthy" "530 UNHEALTHY" "502 UNHEALTHY" "000 UNHEALTHY" \
           "000000 UNHEALTHY" "_ UNHEALTHY" "abc UNHEALTHY" "5300 UNHEALTHY"; do
    raw=${t% *}; want=${t#* }; [[ "$raw" == _ ]] && raw=""
    x=$(classify "$raw"); healthy "$x" && r=healthy || r=UNHEALTHY
    [[ "$r" == "$want" ]] && s=PASS || { s=FAIL; rc=1; }
    echo "$s raw='$raw' -> $x $r"
  done
  exit $rc
fi

HOST=${SENDPROMPT_TUNNEL_URL:?set SENDPROMPT_TUNNEL_URL}
STATE=${SENDPROMPT_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/grokbot-sendprompt}
MATCH=${SENDPROMPT_CONNECTOR_MATCH:-grok-bot-sendprompt-tunnel}
PROC=${SENDPROMPT_CONNECTOR_PROC:-cloudflared}
ENSURE=${SENDPROMPT_ENSURE:-$(dirname "$0")/ensure-sendprompt-tunnel.sh}
mkdir -p "$STATE"
LOCK=$STATE/watchdog.lock; WLOG=$STATE/watchdog.log; STAMP=$STATE/daily-restart.last

exec 9>"$LOCK"; flock -n 9 || exit 0
log() { echo "$(date -Is) $*" >> "$WLOG"; }
probe() { classify "$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$HOST" 9>&- 2>/dev/null)"; }
kill_conn() { local p; for p in $(pgrep -x "$PROC"); do tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null | grep -qF -- "$MATCH" && kill "$p" 2>/dev/null; done; }
force_restart() { # $1 = reason
  log "restart reason=$1: killing connector"; kill_conn; sleep 8 9>&-
  [[ -x "$ENSURE" ]] && WATCHDOG_CHILD=1 "$ENSURE" 9>&- >/dev/null 2>&1
  local i c=000; for i in $(seq 1 12); do c=$(probe); [[ "$c" == "$OKCODE" ]] && break; sleep 10 9>&-; done
  log "restart reason=$1 done public=$c attempts=$i"
}

log "watchdog started pid=$$ interval=${INTERVAL}s fail_limit=$FAIL_LIMIT"
fails=0; last=$(date +%s)
while true; do
  now=$(date +%s); today=$(date +%F)
  if (( now - last > JUMP_SECS )); then log "clock jump $((now-last))s (hibernate/resume?)"; force_restart resume; fails=0; fi
  if [[ -n "$DAILY_HOUR" ]] && (( 10#$(date +%H) >= 10#$DAILY_HOUR )) && [[ "$(cat "$STAMP" 2>/dev/null)" != "$today" ]]; then
    echo "$today" > "$STAMP"; force_restart "daily-$(printf %02d "$DAILY_HOUR")00"; fails=0
  fi
  code=$(probe)
  [[ "$code" != "$OKCODE" ]] && log "probe public=$code"
  if healthy "$code"; then fails=0; else fails=$((fails+1)); log "probe unhealthy public=$code fails=$fails"; fi
  if (( fails >= FAIL_LIMIT )); then force_restart "public=$code-x$fails"; fails=0; fi
  last=$(date +%s)
  sleep "$INTERVAL" 9>&-
done
