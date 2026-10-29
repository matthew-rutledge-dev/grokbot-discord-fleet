---
name: discord-wake-on-sleep
description: Wake on sleep (recommended) — standard setup step right after bridge + callback setup so Discord messages can wake a sleeping Grok Bot computer (host bridge wake hook → webhook-triggered routine → ensure sendPrompt tunnel); also use when held Discord messages red-X after the bridge hold window
---

# Discord wake on sleep (recommended)

**Why:** Grok Bot computers sleep a lot when idle, and Discord messages alone can't wake them. Without this step, messages sent while the bot is asleep can fail after the bridge's hold window (shown as a red X in Discord). Run this right after bridge setup and `discord-fleet-callback-setup`. Skipping is allowed but **not recommended**.

## When to use

- Grok Bot boxes hibernate for hours; while asleep the sendPrompt tunnel is down, the bridge holds the Discord message (reference host bridge: `hold.maxSec`, default 1800 s) and then red-Xes it. Bridge-side keys: `wake.urlRef` / `wake.keyRef` / `wake.header` ([example config](https://github.com/matthew-rutledge-dev/grok-bot-universal-bridge/blob/main/config/bridge.example.json), [Discord adapter README](https://github.com/matthew-rutledge-dev/grok-bot-universal-bridge/blob/main/adapters/discord/README.md)).
- As the standard next step after bridge setup and callback setup (offer it; the operator confirms).
- Operator asks to set up wake-on-sleep, or asks why Discord messages fail while the box sleeps.
- If the operator declines, note that it's not recommended and that messages sent while asleep can red-X; don't push further.

Operator-driven only. Never run as silent postinstall.

## How it works

1. A Discord message arrives; the host bridge's delivery hits a retryable error (502/503/504/530, Cloudflare 1033, a timeout or a network error) and holds the message.
2. On the first hold of an outage the bridge POSTs **once** to the wake URL (its `wake.urlRef`, a Grok Bot webhook-triggered routine), with the key in a header only (never the body). Body: `{reason, heldCount, firstHeldAt}`. It re-arms after a successful delivery or when nothing is held; a failed wake never drops the hold.
3. The routine wakes the box and runs `scripts/ensure-sendprompt-tunnel.sh`; the tunnel comes up and the bridge delivers the held messages.

## Hard rules

- **One routine per Grok Bot account.** All bots on an account share one box, so one routine is enough. Before creating, **check whether a wake routine already exists** (list routines; look for a webhook-triggered routine whose prompt runs `ensure-sendprompt-tunnel.sh`). If it exists, reuse it — do not create a second one.
- **Never see or print the key.** Ask for it only through a masked secret-request card, so it lands as a box env var (e.g. `BRIDGE_WAKE_KEY`) without passing through chat. Never ask for it in plain chat, and never echo, log, or commit it.
- The webhook URL is not secret unless it embeds a token in its path; then treat it like the key (masked card, never in chat). Either way, keep it and any real automation/folder ID out of git and public evidence lines.
- Writing the bridge `.env` is done by the bot or whoever owns the bridge host, via a script that reads the env var. The user hand-editing `.env` is a fallback, not the default.

## Steps

### a. Check for an existing routine
List the account's routines. If a webhook-triggered wake routine already exists, skip to **c**.

### b. Create the routine (only if none exists)
- Trigger: **webhook**.
- Name: e.g. `discord-wake-on-sleep`.
- Prompt (keep it short):

  > Box woke for a held Discord message. Run `bash <plugin-root>/scripts/ensure-sendprompt-tunnel.sh` to bring the sendPrompt tunnel up. Then end quietly — do not message the user.

  `<plugin-root>` is the installed plugin directory; the script is at `scripts/ensure-sendprompt-tunnel.sh` relative to it. Resolve `<plugin-root>` **once** and put the absolute path into the routine prompt (routines don't expand plugin variables). The Grok Bot desktop app keeps its own plugin copy, separate from `~/.grok/plugins` and the Cursor folder, so don't assume either. On the Grok Bot computer:

  ```bash
  echo "${GROK_PLUGIN_ROOT:-}"   # if set in this session, use it
  find / -path '*/grokbot-discord-fleet/scripts/ensure-sendprompt-tunnel.sh' -not -path '*/node_modules/*' 2>/dev/null
  ```

  If several copies turn up, pick the one whose `plugin.json` `version` matches the installed plugin, and use its directory (minus `/scripts/ensure-sendprompt-tunnel.sh`). Re-resolve after a plugin reinstall moves it.

- **Set `SENDPROMPT_TUNNEL_URL` (required).** `SENDPROMPT_TUNNEL_URL` is **required**: `scripts/ensure-sendprompt-tunnel.sh` exits without it. Set it to the public URL of this computer's sendPrompt tunnel (e.g. `https://sendprompt.example.com/`) as a box env var / Bot Secret so the routine sees it. Also set any other `SENDPROMPT_*` connector settings you use (`SENDPROMPT_CONNECTOR_MATCH`, `SENDPROMPT_SUPERVISOR`; see the README **Durable sendPrompt tunnel** section). Ask for them with a secret card if the URL embeds a token.

### c. Point the user at the routine fields (deep links first)
The routine panel shows three fields: the **POST URL**, the **key**, and an **Authorization header** field.

First, give the user direct deep links to each field, labeled plainly as links. Take them from the routine's line in your automation status (`<folder id>` is the routine's automation folder id; never paste a real id into docs or git):

- Webhook URL link: `grokbot://app/v1/sidebar?target=webhook-url&automation=<folder id>`
- Webhook key link: `grokbot://app/v1/sidebar?target=webhook-key&automation=<folder id>`
- Webhook header link: `grokbot://app/v1/sidebar?target=webhook-header&automation=<folder id>`

Only if the links don't work, give the menu path: click the bot's name in the chat header (or press **Cmd+Shift+I**), then pick the routine under **Routines**.

### d. Collect the values (least user work)
- **Key (default):** ask with a masked secret-request card targeting a box env var such as `BRIDGE_WAKE_KEY`. You only verify present or missing; you never see or print the value.
- **URL:** the user pastes the POST URL in chat. It is not secret unless it embeds a token in its path; then treat it like the key and collect it with a masked card too.
- **Header:** the default bridge `wake.header` of `Authorization` (sends `Authorization: Bearer <key>`) is verified against the Grok Bot routine webhook, so leave it unset. It stays configurable: any other header name sends the raw key, e.g. `X-Webhook-Key: <key>`.

### e. Write the bridge `.env` (no echo)
The reference host bridge reads the wake URL and key through secret refs in its host-only bridge config: `"wake": { "urlRef": "env:BRIDGE_WAKE_URL", "keyRef": "env:BRIDGE_WAKE_KEY" }` (literal values are refused at startup). Make sure those refs exist, then the bot (if it can reach the bridge host) or whoever owns the bridge server writes the values into the bridge `.env` with a script that reads the env var, so the key never appears on screen or in logs. For example, on the bridge host with `BRIDGE_WAKE_KEY` and `BRIDGE_WAKE_URL` exported:

```bash
set -euo pipefail; umask 077
f=<bridge-host-dir>/.env; cp -p "$f" "$f.bak.$(date +%Y%m%d%H%M%S)"
{ grep -vE '^(BRIDGE_WAKE_URL|BRIDGE_WAKE_KEY)=' "$f" || true
  printf 'BRIDGE_WAKE_URL=%s\nBRIDGE_WAKE_KEY=%s\n' "$BRIDGE_WAKE_URL" "$BRIDGE_WAKE_KEY"
} > "$f.new" && cat "$f.new" > "$f" && rm "$f.new"   # in place: keeps inode, owner, mode
grep -cE '^BRIDGE_WAKE_(URL|KEY)=.+' "$f"   # prints 2; never cat the file
```

- **Why in place:** the bridge `.env` is often a single-file bind mount and root-owned/read-only to the container. `mv` would swap in a new inode (the mount keeps pointing at the old file) and reset the owner and mode. `cat > "$f"` rewrites the same inode. `umask 077` keeps `$f.new` private (0600), and `cp -p` keeps the backup's mode. Run it as the file's owner (e.g. root via sudo).
- Keep `hold.maxSec` at its default (1800) or higher so held messages outlast the wake. Leave `wake.header` at its verified default.
- Keep the deploy rules: host-only files (`.env`, bridge and adapter configs, `registry.json`) live outside the checkout, back them up first, compare checksums, and keep them read-only where they're bind-mounted. Never run `docker compose config` in shared logs.
- If the bridge host is remote, send the values over stdin (e.g. ssh), never as command-line arguments.
- Then recreate the bridge container with `docker compose up -d` (`docker restart` and `docker compose restart` do not re-read `env_file`). Check with `docker compose run --rm -T <service> node dist/src/main.js --check` (reference host bridge; `-T` so it doesn't swallow the rest of a script).
- **Fallback only:** the user copies the URL and key from the routine panel and edits the bridge `.env` by hand.

### f. Verify end to end (no secrets)
- **DM test:** DM the bot in Discord and confirm a reply arrives.
- **Sleep test (optional):** let the computer idle or hibernate, send a message, then confirm the wake routine ran and the reply arrived within the hold window (`hold.maxSec`).
- Expected wake POST response: HTTP 200 with JSON `{success:true, runUuid}`. Anything else (401/403, 404) means the key, header or URL is wrong.
- Let the box sleep (or stop the tunnel connector), send a Discord message, and confirm: the bridge got HTTP 200 with JSON `{success:true, runUuid}`, the routine ran once, the tunnel came back, the held message was delivered.
- Evidence line: routine name + run time + `ensure-sendprompt-tunnel` status line. Never the URL or key.

## Turn it off

- Blank `BRIDGE_WAKE_URL` / `BRIDGE_WAKE_KEY` in the bridge `.env` (or remove `wake.urlRef` from the bridge config) and recreate the bridge container with `docker compose up -d` (`docker restart` and `docker compose restart` do not re-read `env_file`), **or**
- Pause (or delete) the routine. Messages then fall back to hold-then-fail.
