---
name: discord-fleet-bridge-setup
description: use this when the user explicitly asks to set up, deploy, or verify the Discord wake bridge (operator-driven; not silent postinstall)
---

# Discord fleet bridge setup

## When to use

Only when the user **explicitly** asks to set up, deploy, or verify the Discord wake bridge. This plugin is **not** the wake path — do not run this skill on marketplace install, postinstall, or as a silent side effect.

## Hard rules (anti-jobs)

- Do **not** merge wake into marketplace postinstall or any install hook.
- Do **not** use `curl | bash` or any third-party delivery pipe.
- Do **not** put secrets in git, chat logs, or this plugin tree. Never print tokens.
- Do **not** invent wake / `sendPrompt` calls from this plugin's MCP tools.
- Env comes from host vault — never paste token values into commits or skill output.

## How

1. **Confirm intent + host** — Ask which host (hint: servergen1 path `/opt/sites/discord-fleet-wake`, Diablo owns). Proceed only after explicit yes for that host.
2. **Clone / pull the bridge** — Repo: `matthew-rutledge-dev/grok-bot-discord-bridge`. On the target host, clone or `git pull` into the agreed path (servergen1: `/opt/sites/discord-fleet-wake`). Follow that repo's README — not this plugin.
3. **Env from vault** — Load bot token and related secrets from host vault / local `.env` only. Vault key hint: `DISCORD_FLEET_WAKE`. Use `.env.example` names; never commit real `.env` or echo secret values.
4. **Deploy / run** — Start or update per bridge README (Compose / process on the host). Keep service stopped until a real token is configured if the bridge docs say so.
5. **Verify health** — Bridge HTTP is loopback-only. On the host: `GET http://127.0.0.1:18083/healthz`. From a laptop, open an SSH tunnel first, then probe the tunneled URL. Expect liveness / `discordReady` fields from bridge docs — treat missing token or stopped Compose as evidence, not failure to invent.
6. **Point the plugin at health** — After tunnel/setup, set plugin env / variable `DISCORD_BRIDGE_HEALTH_URL` to the full `/healthz` URL (e.g. `http://127.0.0.1:18083/healthz` via tunnel). Status MCP can then probe; still no wake from this plugin.
7. **Hand-off on servergen1** — If the host is servergen1, note wake ownership stays with **Diablo** (`/opt/sites/discord-fleet-wake`). Do not take over that path from this plugin; report what was done and leave ongoing wake ops to Diablo.

## Evidence expected

- Explicit user confirmation of host + setup intent
- Bridge clone/pull path used
- Health probe result for `GET /healthz` (or clear note that service/token/tunnel is missing)
- Confirmation that `DISCORD_BRIDGE_HEALTH_URL` was set (value may be shown; **never** the bot token)
- Ownership note when on servergen1

## Related

- Boundary: skill `discord-fleet-boundary`
- After setup: skill `discord-fleet-status` + status MCP `fleet_health`
- Bridge SoT: [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge)
