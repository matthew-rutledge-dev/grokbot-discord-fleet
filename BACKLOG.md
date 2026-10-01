# Backlog — grokbot-discord-fleet

No secrets in this file.

## Marketplace / connector add-ons (candidates)

### GovInfo / api.data.gov MCP
- **Status:** todo (not started)
- **Ask:** marketplace/plugin-style add-on on the Discord fleet connector track — not ad-hoc `AddMcpServer` on the Cursor account (Matthew skipped that).
- **MCP endpoint:** `https://api.govinfo.gov/mcp`
- **Auth:** header `x-api-key` = api.data.gov key (vaulted; never paste in chat/git)
- **Vault (Diablo / infra):** title `api.data.gov / GovInfo`; url `https://api.data.gov`; mcp `https://api.govinfo.gov/mcp`; accessors `Get-InfraSecret GOVINFO` / `Get-InfraApiKey` (`api_key`). Canonical on servergen1 + Windows replica.
- **Signup:** done for `Matthew.Rutledge@cdccentral.com` (free api.data.gov key)
- **Owners:** Plug_discord owns marketplace add-on scaffold/wire plan; Shion_career does **not** own the MCP wire (career/resume only). Pull key via vault when wiring.
- **Source:** handoff 2026-09-30 via Shion_career

## Done

- Discord media docs (0.3.10): inbound thin-JSON `a:` CDN refs + outbound `/callback` attachments (JSON/multipart); marketplace placeholders only; plugin still not wake owner

- Plugin layout + Discord manage/status MCP (0.2.0): Discord REST + optional bridge `/healthz`; dry-run / confirm-gated manage; skills; pushed to `matthew-rutledge-dev/grokbot-discord-fleet`
- Still **not** on the wake path; no deploy to `/opt/sites/discord-fleet-wake`

## Follow-ups (optional)

- SSH-tunnel recipe for `DISCORD_BRIDGE_HEALTH_URL` from laptop
- Optional read of a *local copy* of channel-map.json path via env (still never write from plugin)

## Operator notes (Matthew fleet — not marketplace)

- Live wake DMs route via bridge `security.dm.defaultAgentId` (orchestrator); guild channel maps unchanged. Do not hardcode agent ids into marketplace-facing README/skills.
