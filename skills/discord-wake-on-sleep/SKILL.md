---
name: discord-wake-on-sleep
description: use when installer wants Discord messages to wake a hibernated Grok Bot box (bridge wake hook → webhook-triggered routine → ensure sendPrompt tunnel), or when held Discord messages red-X after the bridge hold window
---

# Discord wake on sleep

## When to use

- Grok Bot boxes hibernate for hours; while asleep the sendPrompt tunnel is down, the bridge holds the Discord message (default 900 s, `SENDPROMPT_HOLD_MAX_SEC`; 1800 recommended with the wake hook) and then red-Xes it.
- Operator explicitly asks to set up wake-on-sleep, or asks why Discord messages fail while the box sleeps.

Operator-driven only. Never run as silent postinstall.

## How it works

1. A Discord message arrives; the bridge's sendPrompt hits a retryable tunnel error (530, 1033, 502–504, or a network error).
2. The bridge POSTs **once per outage** to `SENDPROMPT_WAKE_URL` (a Grok Bot webhook-triggered routine), with the key in a header only (never the body). Body: `{reason, heldCount, firstHeldAt}`. It is debounced until the next successful sendPrompt.
3. The routine wakes the box and runs `scripts/ensure-sendprompt-tunnel.sh`; the tunnel comes up and the bridge delivers the held messages.

## Hard rules

- **One routine per Grok Bot account.** All bots on an account share one box, so one routine is enough. Before creating, **check whether a wake routine already exists** (list routines; look for a webhook-triggered routine whose prompt runs `ensure-sendprompt-tunnel.sh`). If it exists, reuse it — do not create a second one.
- **Never see or print the key.** Ask for it only through a masked secret-request card, so it lands as a box env var (e.g. `SENDPROMPT_WAKE_KEY`) without passing through chat. Never ask for it in plain chat, and never echo, log, or commit it.
- The webhook URL is not secret, so the user can paste it in chat. Still keep it (and any real automation/folder ID) out of git and public evidence lines.
- Writing the bridge `.env` is done by the bot or whoever owns the bridge host, via a script that reads the env var. The user hand-editing `.env` is a fallback, not the default.

## Steps

### a. Check for an existing routine
List the account's routines. If a webhook-triggered wake routine already exists, skip to **c**.

### b. Create the routine (only if none exists)
- Trigger: **webhook**.
- Name: e.g. `discord-wake-on-sleep`.
- Prompt (keep it short):

  > Box woke for a held Discord message. Run `bash <plugin-root>/scripts/ensure-sendprompt-tunnel.sh` to bring the sendPrompt tunnel up. Then end quietly — do not message the user.

  `<plugin-root>` is the installed plugin directory (`${GROK_PLUGIN_ROOT}` under Grok, `${CURSOR_PLUGIN_ROOT}` under Cursor); the script is at `scripts/ensure-sendprompt-tunnel.sh` relative to it. Use the absolute path of the install on this box. The plugin's generic `ensure-sendprompt-tunnel.sh` reads `SENDPROMPT_TUNNEL_URL` (plus any other `SENDPROMPT_*` settings) from the routine's environment, e.g. via Bot Secrets. That variable is only a fallback: if your setup's own ensure script already knows its tunnel URL, point the routine at that script instead and leave `SENDPROMPT_TUNNEL_URL` unset.

### c. Point the user at the routine fields (deep links first)
The routine panel shows three fields: the **POST URL**, the **key**, and an **Authorization header** field.

First, give the user direct deep links to each field, labeled plainly as links. Take them from the routine's line in your automation status (`<folder id>` is the routine's automation folder id; never paste a real id into docs or git):

- Webhook URL link: `grokbot://app/v1/sidebar?target=webhook-url&automation=<folder id>`
- Webhook key link: `grokbot://app/v1/sidebar?target=webhook-key&automation=<folder id>`
- Webhook header link: `grokbot://app/v1/sidebar?target=webhook-header&automation=<folder id>`

Only if the links don't work, give the menu path: click the bot's name in the chat header (or press **Cmd+Shift+I**), then pick the routine under **Routines**.

### d. Collect the values (least user work)
- **Key (default):** ask with a masked secret-request card targeting a box env var such as `SENDPROMPT_WAKE_KEY`. You only verify present or missing; you never see or print the value.
- **URL:** the user pastes the non-secret POST URL in chat.
- **Header:** the Authorization header field shows the shape the routine expects. Header shape: confirm on first setup, then set `SENDPROMPT_WAKE_HEADER` to match. The default is `Authorization`, which sends `Bearer <key>`; any other header name sends the raw key, e.g. `X-Webhook-Key: <key>`.

### e. Write the bridge `.env` (no echo)
The bot (if it can reach the bridge host) or whoever owns the bridge server writes the values with a script that reads the env var, so the key never appears on screen or in logs. For example, on the bridge host with `SENDPROMPT_WAKE_KEY` and `SENDPROMPT_WAKE_URL` exported:

```bash
set -euo pipefail; umask 077
f=<bridge-dir>/.env; cp -p "$f" "$f.bak.$(date +%Y%m%d%H%M%S)"
{ grep -vE '^(SENDPROMPT_WAKE_URL|SENDPROMPT_WAKE_KEY|SENDPROMPT_HOLD_MAX_SEC)=' "$f" || true
  printf 'SENDPROMPT_WAKE_URL=%s\nSENDPROMPT_WAKE_KEY=%s\nSENDPROMPT_HOLD_MAX_SEC=1800\n' "$SENDPROMPT_WAKE_URL" "$SENDPROMPT_WAKE_KEY"
} > "$f.new" && mv "$f.new" "$f"
grep -cE '^SENDPROMPT_WAKE_(URL|KEY)=.+' "$f"   # prints 2; never cat the file
```

- Set `SENDPROMPT_HOLD_MAX_SEC=1800` so held messages outlast the wake, and `SENDPROMPT_WAKE_HEADER` if the header shape differs from the default.
- Keep the deploy rules: the runtime `.env` stays out of the rsync, back it up first, compare checksums, and keep it root-owned and read-only where it's bind-mounted. Never run `docker compose config` in shared logs.
- If the bridge host is remote, send the values over stdin (e.g. ssh), never as command-line arguments.
- Restart the bridge. Names per bridge 0.2.12 (https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge/pull/9).
- **Fallback only:** the user copies the URL and key from the routine panel and edits the bridge `.env` by hand.

### f. Verify (no secrets)
- Let the box sleep (or stop the tunnel connector), send a Discord message, and confirm: the routine ran once, the tunnel came back, the held message was delivered.
- Evidence line: routine name + run time + `ensure-sendprompt-tunnel` status line. Never the URL or key.

## Turn it off

- Blank `SENDPROMPT_WAKE_URL` / `SENDPROMPT_WAKE_KEY` in the bridge `.env` and restart the bridge, **or**
- Pause (or delete) the routine. Messages then fall back to hold-then-fail.
