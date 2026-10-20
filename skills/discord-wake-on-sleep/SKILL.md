---
name: discord-wake-on-sleep
description: use when installer wants Discord messages to wake a hibernated Grok Bot box (bridge wake hook → webhook-triggered routine → ensure sendPrompt tunnel), or when held Discord messages red-X after the bridge hold window
---

# Discord wake on sleep

## When to use

- Grok Bot boxes hibernate for hours; while asleep the sendPrompt tunnel is down, the bridge holds the Discord message (default 15 min, `SENDPROMPT_HOLD_MAX_SECONDS`) and then red-Xes it.
- Operator explicitly asks to set up wake-on-sleep, or asks why Discord messages fail while the box sleeps.

Operator-driven only. Never run as silent postinstall.

## How it works

1. A Discord message arrives; the bridge's sendPrompt hits a retryable tunnel error (530, 1033, 502–504, or a network error).
2. The bridge POSTs **once per outage** to `SENDPROMPT_WAKE_URL` (a Grok Bot webhook-triggered routine), with the key in a header only. It is debounced until the next successful sendPrompt.
3. The routine wakes the box and runs `scripts/ensure-sendprompt-tunnel.sh`; the tunnel comes up and the bridge delivers the held messages.

## Hard rules

- **One routine per Grok Bot account.** All bots on an account share one box, so one routine is enough. Before creating, **check whether a wake routine already exists** (list routines; look for a webhook-triggered routine whose prompt runs `ensure-sendprompt-tunnel.sh`). If it exists, reuse it — do not create a second one.
- **Never see, ask for, paste, or store the sender key.** The operator copies it from the routine panel straight into the bridge `.env`. Never put the key or the webhook URL in git, chat, logs, or evidence lines.
- Do not edit the bridge host or its `.env` from this skill; the operator does that.

## Steps

### a. Check for an existing routine
List the account's routines. If a webhook-triggered wake routine already exists, skip to **c**.

### b. Create the routine (only if none exists)
- Trigger: **webhook**.
- Name: e.g. `discord-wake-on-sleep`.
- Prompt (keep it short):

  > Box woke for a held Discord message. Run `bash <plugin-root>/scripts/ensure-sendprompt-tunnel.sh` to bring the sendPrompt tunnel up. Then end quietly — do not message the user.

  `<plugin-root>` is the installed plugin directory (`${GROK_PLUGIN_ROOT}` under Grok, `${CURSOR_PLUGIN_ROOT}` under Cursor); the script is at `scripts/ensure-sendprompt-tunnel.sh` relative to it. Use the absolute path of the install on this box. The script needs `SENDPROMPT_TUNNEL_URL` (and any other `SENDPROMPT_*` settings) available in the routine's environment, e.g. via Bot Secrets.

### c. Hand off to the operator
Tell the operator (no values):
- Open the routine panel, copy the **webhook URL** and **sender key**.
- In the bridge `.env` set `SENDPROMPT_WAKE_URL=<webhook URL>` and `SENDPROMPT_WAKE_KEY=<sender key>`; optionally `SENDPROMPT_WAKE_HEADER` (default sends `Authorization: Bearer <key>`; confirm the header shape against the bridge release). Restart the bridge.

### d. Verify (no secrets)
- Let the box sleep (or stop the tunnel connector), send a Discord message, and confirm: the routine ran once, the tunnel came back, the held message was delivered.
- Evidence line: routine name + run time + `ensure-sendprompt-tunnel` status line. Never the URL or key.

## Turn it off

- Blank `SENDPROMPT_WAKE_URL` / `SENDPROMPT_WAKE_KEY` in the bridge `.env` and restart the bridge, **or**
- Pause (or delete) the routine. Messages then fall back to hold-then-fail.
