---
name: discord-fleet-bridge-setup
description: use this when the user explicitly asks to set up, deploy, or verify the Discord wake bridge (operator-driven; not silent postinstall)
---

# Discord fleet bridge setup

## When to use

Only when the user **explicitly** asks to set up, deploy, or verify the Discord wake bridge. This plugin is **not** the wake path — do not run this skill on marketplace install, postinstall, or as a silent side effect.

**Optional self-host:** Marketplace installers who want wake run the bridge on **their own** machine / guild with **their own** bot token. They are not joining Matthew's Discord or infra. Skip this skill entirely if they only need Discord REST status/manage via plugin variables.

## Hard rules (anti-jobs)

- Do **not** merge wake into marketplace postinstall or any install hook.
- Do **not** use `curl | bash` or any third-party delivery pipe.
- Do **not** put secrets in git, chat logs, or this plugin tree. Never print tokens.
- Do **not** invent wake / `sendPrompt` calls from this plugin's MCP tools.
- Prefer **plugin variables** / vault → runtime env for `DISCORD_BOT_TOKEN` (and related). Discourage plaintext `.env` on disk when a vault or host secret injection path exists; if a local `.env` is unavoidable for the bridge process, keep it off git, mode-restricted, and never echo values.

## Credentials model

| Audience | How secrets are supplied |
|----------|--------------------------|
| **Marketplace installer** | Plugin variables (`DISCORD_BOT_TOKEN`, optional `DISCORD_GUILD_ID`, optional `DISCORD_BRIDGE_HEALTH_URL`) pointing at **their** bot / **their** self-hosted `/healthz`. |
| **Matthew operator only** | Host vault key `DISCORD_FLEET_WAKE` → runtime env on Matthew's wake host. Not a shared provider for other installers. |

## Windows vs Linux (operators)

| Topic | Notes |
|-------|--------|
| Env / plugin vars | Same names on both: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_BRIDGE_HEALTH_URL` (plugin vars or vault→env — never commit). |
| Health URL | Self-hosted bridge typically listens loopback-only (e.g. `http://127.0.0.1:18083/healthz`). From another machine, open an **SSH tunnel** (or WSL → SSH), then set `DISCORD_BRIDGE_HEALTH_URL` to the local tunnel end. Example: `ssh -L 18083:127.0.0.1:18083 user@your-host`. |
| Matthew host path | `/opt/sites/discord-fleet-wake` on **servergen1** is **Matthew/Diablo operator-only** (Linux). Marketplace installers pick **their own** deploy path on **their** machine — do not send them to servergen1. |
| Windows local | Fine for **local smoke** of this plugin's MCP/skills and optional local bridge. Prefer plugin vars over plaintext `.env` when avoidable. |
| Delivery | Never `curl \| bash` or third-party install pipes. No secrets in git, chat, or this tree. |

## How

1. **Confirm intent + host** — Ask which host (marketplace: **their** machine; Matthew operator may name servergen1 `/opt/sites/discord-fleet-wake`). Proceed only after explicit yes for that host. Clarify they will use **their own** Discord bot / guild unless they are Matthew operating Matthew's fleet.
2. **Clone / pull the bridge** — Repo: `matthew-rutledge-dev/grok-bot-discord-bridge`. On the target host, clone or `git pull` into the agreed path. Follow that repo's README — not this plugin.
3. **Env: prefer plugin vars / vault → runtime** — Load bot token and related secrets from plugin variables or host vault injection into process env. Discourage writing a long-lived plaintext `.env` when avoidable. If the bridge docs require a host `.env`, use `.env.example` names only; never commit real `.env` or echo secret values. Matthew operator vault hint: `DISCORD_FLEET_WAKE` (operator-only).
4. **Deploy / run** — Start or update per bridge README (Compose / process on **their** host). Keep service stopped until a real token is configured if the bridge docs say so.
5. **Verify health** — Bridge HTTP is usually loopback-only. On the host: `GET http://127.0.0.1:18083/healthz` (or the port in bridge docs). From a laptop, open an SSH tunnel first, then probe the tunneled URL. Expect liveness / `discordReady` fields from bridge docs — treat missing token or stopped Compose as evidence, not failure to invent.
6. **Point the plugin at health** — Set plugin variable / env `DISCORD_BRIDGE_HEALTH_URL` to the full `/healthz` URL. Status MCP can then probe; still no wake from this plugin.
7. **Ownership** — Marketplace: user owns their bridge and guild. If the host is Matthew's servergen1, note wake ownership stays with **Diablo** (`/opt/sites/discord-fleet-wake`); do not take over that path from this plugin.

## Evidence expected

- Explicit user confirmation of host + setup intent (and that credentials are **theirs**, unless Matthew-operator context)
- Bridge clone/pull path used
- Health probe result for `GET /healthz` (or clear note that service/token/tunnel is missing)
- Confirmation that `DISCORD_BRIDGE_HEALTH_URL` was set (value may be shown; **never** the bot token)
- Note on credential path used (plugin vars / vault→env vs unavoidable local `.env` — without printing secrets)

## Related

- Boundary: skill `discord-fleet-boundary`
- After setup: skill `discord-fleet-status` + status MCP `fleet_health`
- Bridge SoT: [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge)
