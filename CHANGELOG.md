# Changelog

## 0.3.14

- Scrub operator host paths, vault key names, and unrelated GovInfo backlog from the marketplace surface.

## 0.3.13

- Document bridge-host hop timing telemetry for bottleneck diagnosis: one `[timing] key=val …` line per stage, with `stage`, `msg`, `hop=d:<slug>:<id>`, `ms`, `ok`, `attachments`, `chunks`, and optional `idle_ms` (from `sendPrompt` acceptance to callback via `replyToMessageId`). Stages are `authz`, `build_wake`, `sendPrompt`, `callback_auth`, `callback_resolve`, `callback_deliver`, and `callback_total`.
- Timing logs live on the self-hosted bridge, not the marketplace MCP. Agents may still report `callback <status> attachments=N` evidence; they must not invent timing values.
- Bump plugin manifests to `0.3.13`.


## 0.3.12

- Outbound `POST /callback` MIME support adds zip/tar/gz/tgz/7z/rar mappings, matching bridge `48e6b699ef39273d23f4bf70b7a4299989b34f9e`; `.tar.gz` maps to `application/gzip` and `.tgz` to `application/x-gtar`.
- Keep caps unchanged: ≤10 attachments, 8 MiB/file, 25 MiB total; executable and disk-image denials (`.exe`, `.msi`, `.dmg`, `.iso`, `.appimage`) remain unchanged.
- Update callback MIME guidance in the README, bridge-setup, hop-shorthand, and dual-deliver skill docs; bump plugin manifests to `0.3.12`.


## 0.3.11

- Widen outbound `POST /callback` MIME support to office formats plus text/code types, matching bridge `b34f315fe416b12dee33cd843082cb2e3436974b`; when `contentType` is missing or `application/octet-stream`, use the documented filename-extension fallback.
- Keep caps unchanged: ≤10 attachments, 8 MiB/file, 25 MiB total; `.zip`, `.exe`, `.dmg`, and `.iso` remain denied.
- Update callback MIME guidance in the README, bridge-setup, hop-shorthand, and dual-deliver skill docs; bump plugin manifests to `0.3.11`.


## 0.3.10

- Document Discord **media** for marketplace installers (optional self-hosted bridge; this plugin still does not own wake)
- **Outbound** `POST /callback`: JSON `attachments` (≤10; base64 `data` XOR https `url`) or multipart `files` / `files[]`; `content` optional when ≥1 attachment; limits 8 MiB/file, 25 MiB total; MIME allowlist; text-only bodies remain backward compatible
- **Inbound** wake: thin JSON may include optional `a:[{url,filename?,contentType?,size?}]` Discord CDN URL refs (not base64); also on `sendPrompt` `metadata.attachments`; attachment-only wakes OK; fetch CDN URLs promptly
- Skills: `discord-fleet-hop-shorthand`, `discord-fleet-bridge-setup`, `discord-fleet-boundary` — media notes with placeholders only
- Bump plugin manifests to `0.3.10`


## 0.3.9

- Document Discord **DMs** for marketplace installers: bridge `security.dm` policy / allowFrom / `!pair` / `defaultAgentId` (or `dm_no_agent`); same `POST /callback` with DM channel snowflake; hop `d:dm:<msgId>` (or `security.dm.slug`) with thin JSON `g: null`; no `send_dm` MCP
- Skills: `discord-fleet-bridge-setup`, `discord-fleet-hop-shorthand`, `discord-fleet-boundary` — DM notes with placeholders only (installers use their own bot/guild/bridge agent ids)
- Bump plugin manifests to `0.3.9`


## 0.3.8

- `discord-fleet-hop-shorthand`: after decode/map into context, strip `d:<slug>:<msgId>` + thin JSON from the visible Grok chat transcript — present **human message content only**; callback out with plain content still required
- Brief README skills-list note for absorb/strip behavior
- Bump plugin manifests to `0.3.8`

## 0.3.7

- Require dual delivery after decoding a short hop: bridge `CALLBACK` to Discord with plain `body.content` is mandatory; a Grok chat reply is optional and chat-only is incomplete
- Bump plugin manifests to `0.3.7`

## 0.3.6

- Align `discord-fleet-hop-shorthand` with bridge commit `a6a26fb`: inbound wake is exactly `d:<slug>:<msgId>`, thin JSON `{id,g,u,map}`, then human content; the obsolete `[discord-bridge]` compatibility line is removed
- Update README, boundary, and bridge-setup guidance to document the three-line wake shape
- Bump plugin manifests to `0.3.6`

## 0.3.5

- Add skill `discord-fleet-hop-shorthand`: decode/encode short wake envelope (`d:<slug>:<message.id>` + thin JSON `{id,g,u,map}`); Discord OUT is plain `body.content` only; bridge mints, bots decode
- README skills list + brief pointers from `discord-fleet-boundary` and `discord-fleet-bridge-setup`

## 0.3.4

- Skill `discord-fleet-bridge-setup`: document optional durable named Cloudflare Tunnels for self-hosted callback + `sendPrompt` wake, with placeholder hostnames only; keep the loopback bridge private, rotate `CALLBACK_TOKEN`, and retain SSH tunnel notes for `/healthz`
- README: briefly note durable named-tunnel configuration and the public `CALLBACK_BASE_URL` / `GROK_BOT_SENDPROMPT_URL` settings

## 0.3.3

- Marketplace-friendly **plugin variables**: declare `variables` on `.grok-plugin/plugin.json` (and sync root / `.cursor-plugin`); `DISCORD_BOT_TOKEN` required; optional `DISCORD_GUILD_ID`, `DISCORD_BRIDGE_HEALTH_URL`
- Docs: each installer uses **their own** Discord bot token / guild and host vault or plugin variables; users are not joining another installer's Discord or infrastructure
- Skill `discord-fleet-bridge-setup`: prefer plugin vars / vault→runtime env; discourage plaintext `.env` when avoidable; optional self-host for **their** machine/guild
- Skill `discord-fleet-boundary` (+ status): clarify per-installer credentials and host-specific paths

## 0.3.2

- Skill `discord-fleet-bridge-setup`: short Windows vs Linux operator notes (same env vars; SSH/WSL tunnel to your host's `127.0.0.1:18083/healthz`; wake path Linux-only; Windows local smoke only; no curl|bash; no secrets in git)

## 0.3.1

- Add skill `discord-fleet-bridge-setup`: operator-driven Discord wake bridge setup (explicit user ask only; not postinstall)
- Document host vault / plugin variables, loopback `GET /healthz` on `127.0.0.1:18083`, and plugin env `DISCORD_BRIDGE_HEALTH_URL`
- README: mention new skill; anti-jobs (no curl|bash, no secrets in git, no silent wake merge)

## 0.3.0

- Align to Grok Build / xAI plugin-marketplace conventions
- Add `.grok-plugin/plugin.json` (Grok-canonical manifest)
- Add `.mcp.json` with `${GROK_PLUGIN_ROOT}` paths + env map for `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_BRIDGE_HEALTH_URL`
- Keep Cursor dual-support: `.cursor-plugin/plugin.json` + `mcp.json` with `${CURSOR_PLUGIN_ROOT}`
- README: Grok install paths (`grok plugin install`, local `~/.grok/plugins/`, marketplace PR later); declare Discord API + optional bridge health network endpoints
- No secrets; guild id remains a placeholder via env / plugin variables

## 0.2.0

- Wire real manage/status: Discord REST reads + optional bridge `GET /healthz`
- Status: `fleet_health`, `list_channel_map` (replaces stub tools)
- Manage: keep `describe_manage_boundary` + dry-run `plan_channel_binding`; add `inspect_guild` and `resolve_channel` (require `confirm=true`)
- `mcp.json` uses `${CURSOR_PLUGIN_ROOT}`; plugin variables for `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_BRIDGE_HEALTH_URL`
- Docs/skills updated; still no wake / sendPrompt / secrets in git

## 0.1.0

- Initial local scaffold: plugin manifest, MCP stubs (status + manage), three skills

## Unreleased

- Keep follow-ups focused on Discord fleet manage/status and optional self-hosted bridge support.
