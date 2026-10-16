#!/usr/bin/env bash
# Idempotent entry point for the sendPrompt tunnel: starts the watchdog (once), starts the supervisor if
# down, kicks a stale connector, prints one status line. Never prints tokens. Same env as the watchdog plus:
#   SENDPROMPT_SUPERVISOR     command that keeps the connector running (optional; holds $STATE/supervise.lock).
#                             Word-split on spaces (command + args), so paths in it cannot contain spaces.
#   SENDPROMPT_SKIP_KILL      set by the watchdog after it already killed the connector; skips the second kill/wait
#   SENDPROMPT_CONNECTOR_LOG  connector log to count recent registrations (optional)
set -uo pipefail
HOST=${SENDPROMPT_TUNNEL_URL:?set SENDPROMPT_TUNNEL_URL}
STATE=${SENDPROMPT_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/grokbot-sendprompt}
MATCH=${SENDPROMPT_CONNECTOR_MATCH:-grok-bot-sendprompt-tunnel}
PROC=${SENDPROMPT_CONNECTOR_PROC:-cloudflared}
SUP=${SENDPROMPT_SUPERVISOR:-}
CLOG=${SENDPROMPT_CONNECTOR_LOG:-}
WATCHDOG=$(dirname "$0")/sendprompt-tunnel-watchdog.sh
mkdir -p "$STATE"; LOCK=$STATE/supervise.lock; WLOG=$STATE/ensure.log
action=none
classify() { local c="$1"; [[ "$c" =~ ^[0-9]{3}$ ]] || c=000; echo "$c"; }
healthy() { [[ "$1" != 000 && "$1" != 401 && "$1" != 403 ]] && (( 10#$1 < 500 )); }
probe() { classify "$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$HOST" 2>/dev/null)"; }
conn_pids() { local p; for p in $(pgrep -x "$PROC"); do tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null | grep -qF -- "$MATCH" && echo "$p"; done; }
sup_running() { ! flock -n "$LOCK" true 2>/dev/null; }
if [[ -z "${WATCHDOG_CHILD:-}" ]] && flock -n "$STATE/watchdog.lock" true 2>/dev/null; then
  setsid nohup "$WATCHDOG" >/dev/null 2>&1 </dev/null &
fi
if [[ -n "$SUP" ]] && ! sup_running; then setsid nohup $SUP >/dev/null 2>&1 </dev/null & action=started-supervisor; sleep 20; fi
pids=$(conn_pids); n=$(echo "$pids" | grep -c . || true)
code=$(probe)
if ! healthy "$code" && [[ "$action" == none && -z "${SENDPROMPT_SKIP_KILL:-}" ]]; then
  [[ -n "$pids" ]] && kill $pids 2>/dev/null
  action=restarted-connector; sleep 25
  pids=$(conn_pids); n=$(echo "$pids" | grep -c . || true); code=$(probe)
fi
regs=0; [[ -n "$CLOG" ]] && regs=$(tail -n 200 "$CLOG" 2>/dev/null | grep -c 'Registered tunnel connection' || true)
ok=FAIL; healthy "$code" && (( n >= 1 )) && ok=OK
sup=n/a; [[ -n "$SUP" ]] && { sup_running && sup=up || sup=down; }
echo "$(date -Is) sendprompt-tunnel $ok public=$code connectors=$n supervisor=$sup recent_registrations=$regs action=$action" | tee -a "$WLOG"
[[ $ok == OK ]]
