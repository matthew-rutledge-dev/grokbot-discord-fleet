# Changelog

## 0.3.39

- **GrokBuild setup lives in grokbuild-grokbots.** README ("What this plugin is", channel-map note, Wake on sleep), the `discord-fleet-boundary`, `discord-fleet-bridge-setup` and `discord-wake-on-sleep` skills now cross-link [grokbuild-grokbots](https://github.com/matthew-rutledge-dev/grokbuild-grokbots) as the single source for waking or prompting a Grok Bot from Grok Build, Cursor or a script (`GROKBOTS_*` variables, roster file). The old "operators use their own send script" line is replaced by that link. Discord-only wake docs (bridge, wake on sleep, channel map, callback) stay here.
- **One webhook routine can serve both.** Wake on sleep notes how to reuse a GrokBuild webhook routine for Discord bridge wakes (GrokBuild bodies carry `kind`; the bridge's `{reason, heldCount, firstHeldAt}` doesn't). The skill's **Reuse path** still runs step b's plugin-root resolution and `SENDPROMPT_TUNNEL_URL` setup, and appends the literal `bash <absolute-plugin-root>/scripts/ensure-sendprompt-tunnel.sh` command, so the existing-routine check finds the shared routine later.
- Boundary skill's manual bootstrap line says `npm ci --omit=dev` (matches 0.3.38).
- No tool behavior changes. Bump manifests, MCP package, serverInfo, and Discord User-Agent to `0.3.39`.

## 0.3.38

- `tsx` moved to `devDependencies` (only the `dev` and `test` scripts use it; hosts launch the built `dist/index.js` with plain `node`). The bootstrap scripts now run `npm ci --omit=dev`, so a plugin install no longer installs `tsx` / `esbuild` and runs no package install scripts. `typescript` and `@types/node` stay in `dependencies` because the bootstrap builds with `tsc`. README bootstrap lines updated.
- No tool behavior changes. Bump manifests, MCP package, serverInfo, and Discord User-Agent to `0.3.38`.

## 0.3.37

- **Wake on sleep (recommended): bridge-side links.** README **Wake on sleep (recommended)** and the `discord-wake-on-sleep` skill now link the reference host bridge's example config (`wake.urlRef` / `wake.keyRef` / `wake.header`), its design notes and its Discord adapter README (which now also marks the wake hook as recommended), and say that blank `BRIDGE_WAKE_URL` / `BRIDGE_WAKE_KEY` turn the hook off.
- No tool behavior changes. Bump manifests, MCP package, serverInfo, and Discord User-Agent to `0.3.37`.

## 0.3.36

- **Dependency security update.** `@modelcontextprotocol/sdk` floor raised to `^1.32.2` (lockfile 1.32.2) and `npm audit fix` applied to the transitive deps: `zod` 4.6.7, `ip-address` 10.7.5, `body-parser` 2.4.0, `qs` 6.17.1, `fast-uri` 3.1.9. `npm audit` reports 0 vulnerabilities (was 6: 3 high, 3 moderate).
- No tool behavior changes. Bump manifests, MCP package, serverInfo, and Discord User-Agent to `0.3.36`.

## 0.3.35

- **Install link to the reference host bridge.** Now that it is public, README, the `discord-fleet-bridge-setup` and `discord-fleet-boundary` skills, and the MCP's informational `bridgeRepo` string link to [grok-bot-universal-bridge](https://github.com/matthew-rutledge-dev/grok-bot-universal-bridge) (enable its Discord adapter) as the recommended wake runtime. The older standalone Discord bridge is superseded; historical changelog entries that mention it are unchanged.
- No tool behavior changes. Bump manifests, MCP package, serverInfo, and Discord User-Agent to `0.3.35`.

## 0.3.34

- **Host bridge pointer.** Docs, skills, manifest variable descriptions and the MCP's informational `bridgeRepo` / wake-path strings now name the reference host bridge as `grok-bot-universal-bridge` (its Discord adapter), or any compatible host bridge, instead of the previous named Discord bridge. No clickable link (that repo is not public). The wake path is unchanged: Discord → host bridge → Gateway `sendPrompt` / webhook routine; this plugin is not on it.
- **Callback contract aligned with the reference host bridge:** path `POST /discord/callback` (example placeholder `https://callback.example.com/discord/callback`; a base URL gets `/discord/callback` appended); header-only auth (`Authorization: Bearer` or `x-callback-token`), `?token=` refused with 400, 503 `callback_disabled` when no callback token is configured, 429 `rate_limited` with `retry-after`; DM replies send `channelId` = the wake trailer's `c` (no `userId` callback); JSON only (no multipart); up to 10 files, 8 MiB each, 25 MiB total, enforced while streaming; `url` items https only with at most 3 re-checked redirects and no private/loopback/link-local targets; `.exe`/`.msi`/`.dmg`/`.iso`/`.appimage`/`.bat`/`.cmd`/`.scr`/`.com` refused whatever the MIME type; same MIME allowlist; full error table (`channel_not_allowlisted`, `invalid_attachment(_url)`, `discord_send_failed`, 404 wrong path). Optional `statusMessageId` / `threadContent` and the `local-planner` handler documented.
- Wake docs: the reference host bridge sends the compact format only (legacy decode kept for older host bridges); compact header grammar fixed to `Discord #<channel> from <label>[ (N attachment[s])]: <text>`. DMs are a `{dm: "true"}` route with `allowActors` and an `agent`. `/healthz` is `{ok, adapters, held}` (example port 18090). Host timing lines replaced by the JSONL audit description.
- Wake on sleep: bridge config `wake.urlRef` / `wake.keyRef` / `wake.header` / `wake.timeoutMs` and `hold.maxSec` (default 1800) replace the old `SENDPROMPT_WAKE_*` / `SENDPROMPT_HOLD_MAX_SEC` env table; the no-echo `.env` writer uses `BRIDGE_WAKE_URL` / `BRIDGE_WAKE_KEY`. Box-side `SENDPROMPT_TUNNEL_URL` and the tunnel scripts are unchanged.
- Callback-setup smoke probe sends an explicit User-Agent and maps 503 / 404 / 1010.
- No tool behavior changes. Bump manifests, MCP package, serverInfo, and Discord User-Agent to `0.3.34`.

## 0.3.33

- **One MCP server.** The two stdio servers `discord-fleet-status` and `discord-fleet-manage` are merged into a single server, `discord-fleet` (`mcp/discord-fleet`), with all 16 tools. Tool names and arguments are unchanged, so skills and prompts that call tools by name keep working. One `npm ci`, one entry in `.mcp.json` (Grok Build) and `mcp.json` (Cursor), env vars merged.
- **Read-only mode.** New optional plugin variable / env `DISCORD_FLEET_READ_ONLY` (`1` / `true` / `yes` / `on`). When on, `tools/list` hides every Discord write/moderation tool (`post_channel_message`, `timeout_member`, `kick_member`, `ban_member`, `unban_member`, `delete_message`, `purge_channel_messages`) and calls to them are refused with no Discord call. `describe_manage_boundary` reports `readOnly`. The `confirm=true` gate on every write tool is unchanged.
- Tests: `npm test` in `mcp/discord-fleet` checks the tool list in both modes (unit) and starts the server over stdio to check `tools/list`, dry-run writes, and read-only refusals. `npm run build` / `npm run typecheck` run `tsc`.
- Bootstrap scripts (`bootstrap-mcp.sh`, `bootstrap-mcp.ps1`) install the one package. Upgrading: run bootstrap once, then reload MCP servers or restart the host so it drops the two old servers.
- README (layout, install, handshake troubleshooting, variables table, new **Read-only mode** section, tool list), skills (`discord-fleet-status`, `discord-fleet-manage`, `discord-fleet-boundary`, `discord-fleet-bridge-setup`), manifest descriptions + keywords updated.
- Bump manifests, MCP package, serverInfo, and Discord User-Agent to `0.3.33`.
- Fixes from a live Grok Build test on Windows (still 0.3.33):
  - **Launch no longer depends on `cwd`.** Grok Build ignores the MCP `cwd` field, so the old cwd-relative `./node_modules/tsx/dist/cli.mjs src/index.ts` failed with `Cannot find module`. Both MCP configs now run `node <plugin-root>/mcp/discord-fleet/dist/index.js` with an absolute path (`${GROK_PLUGIN_ROOT}` in `.mcp.json`, `${CURSOR_PLUGIN_ROOT}` in `mcp.json`). Both bootstrap scripts now run `npm run build` after `npm ci` and check that `dist/index.js` exists. `typescript` / `@types/node` moved to `dependencies` so the build also works with `--omit=dev`.
  - **Unexpanded placeholders are treated as unset.** Hosts can pass unset variables through literally (e.g. `DISCORD_GUILD_ID=${DISCORD_GUILD_ID}`), which sent the placeholder to Discord and got HTTP 400 "not snowflake" from `inspect_guild`. One env reader now treats empty values and any value matching `^\$\{[^}]*\}$` as unset, for the token, guild id, bridge health URL and `DISCORD_FLEET_READ_ONLY` (a literal placeholder reads as off).
  - **Read tools no longer need `confirm`.** `inspect_guild`, `resolve_channel`, `list_channel_messages` and `check_bot_channel_permissions` dropped their `confirm=true` requirement (the argument is still accepted and ignored). All 9 read tools run without confirm; all 7 write tools still need `confirm=true`.
  - Tests: env-reader unit tests (incl. placeholder `DISCORD_FLEET_READ_ONLY` = off), a schema audit (no read tool requires confirm; every write tool keeps it), and stdio tests that start `dist/index.js` by absolute path from a neutral cwd with literal `${...}` env values. `npm test` builds first.
- Review fixes (still 0.3.33):
  - **Read-only fails closed.** `DISCORD_FLEET_READ_ONLY` is off only when unset, empty, an unexpanded `${...}` placeholder, or an explicit off value (`0`, `false`, `no`, `off`, any case). `1` / `true` / `yes` / `on` turn it on, and **any other non-empty value also turns it on** (e.g. `enabled`, `2`), with one stderr warning at start. Before, unrecognised values left all 16 tools on.
  - `describe_manage_boundary` reports the server's resolved read-only value (resolved once at start) instead of re-reading env.
  - Cursor `mcp.json` no longer passes `DISCORD_BRIDGE_CALLBACK_TOKEN` / `DISCORD_BRIDGE_CALLBACK_URL` to the MCP server, which never read them (least privilege). They stay declared in the manifests for the callback / dual-deliver skills.
  - Docs: README upgrade note marked **BREAKING** (server names `discord-fleet-status` / `discord-fleet-manage` → `discord-fleet`; update allowlists / permission prefixes; launch needs `dist/index.js` from bootstrap). README states read tools (incl. `list_channel_messages`, up to 50 messages per call) run without confirm and stay available in read-only mode, with a fail-closed value table. Stale "confirm-gated reads" wording removed from the boundary and manage skills and the README.
  - CI: `.github/workflows/ci.yml` runs `npm ci`, typecheck, build and test in `mcp/discord-fleet` on ubuntu-latest and windows-latest with Node 20 (no secrets, read-only token).
  - Tests: fail-closed read-only unit tests, plus stdio tests that `enabled` hides write tools with exactly one stderr warning and `off` lists all 16 tools with no warning.
- `describe_manage_boundary` now reports the real read-only state instead of always saying `DISCORD_FLEET_READ_ONLY=1`: the server keeps the flag's value (trimmed, max 32 chars) and its classification when it resolves read-only at start, and returns `readOnlyStatus` (e.g. `read-only ON (DISCORD_FLEET_READ_ONLY="enabled", unrecognised value treated as ON)`, `read-only ON (DISCORD_FLEET_READ_ONLY="1")`, `read-only OFF (DISCORD_FLEET_READ_ONLY unset: not set)`) plus `readOnlySource` (`on` / `unrecognised` / `off` / `unset`). Only this flag's value is echoed. Hardcoded `=1` wording removed from the boundary output, README, skills and package description. Tests cover `enabled`, `1` and unset.

## 0.3.32

- Logo: remove a stray internal design comment from `assets/logo.svg` (no visual change).
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.32`.

## 0.3.31

- New skill `discord-bridge-dual-deliver`: the only skill a Discord wake loads, cut to about 2 KB of wake-path essentials (decode the compact trailer or the legacy `d:<slug>:<msgId>` line + thin JSON, `DISCORD_BRIDGE_CALLBACK_URL` / `DISCORD_BRIDGE_CALLBACK_TOKEN`, required headers incl. a non-default User-Agent, channel `channelId` vs DM `userId` body, short error table). Fewer tokens per Discord reply.
- Everything else moves to `skills/discord-bridge-dual-deliver/reference.md`, read only on errors or setup: full envelope spec and examples, decode/absorb steps, Guild vs DM routing, attachment contract and MIME allowlist, full error table (adds `content_or_attachment_required`, `user_not_allowlisted`, `dm_open_failed`, `discord_not_ready`, 415), local handler output, encode, hop timing, setup and ops notes.
- Parses both wake formats: the bridge 0.2.14 compact format (`Discord DM from <label>: <text>` / `Discord #<channel> from <label>: <text>` plus a last-line trailer `⟂ d:<slug>:<msgId> u=… c=… [g=…] [map=…] [a=…]…`, bridge flag `WAKE_PROMPT_FORMAT=compact|legacy`, default compact) and the legacy 0.2.13 `d:` + thin JSON format. Full grammar, key table and samples are in `reference.md`; the callback contract does not change.
- `discord-fleet-hop-shorthand` is now encode-only (agent-to-agent hop context) and no longer triggers on inbound wakes; its decode, MIME, timing and delivery content moved to the new skill's `reference.md`.
- Docs: DM callbacks send `userId` and omit `channelId` (README DM section, boundary, bridge-setup); cross-references point at `discord-bridge-dual-deliver`.
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.31`.

## 0.3.30

- Wake on sleep is now a standard, **recommended** setup step (was "optional"). README install steps, the `discord-fleet-bridge-setup` skill and the `discord-wake-on-sleep` skill put it right after bridge setup and callback setup. The README section is now **Wake on sleep (recommended)** and sits next to the bridge sections instead of at the end.
- Up-front note: Grok Bot computers sleep a lot when idle and Discord messages alone can't wake them; without this step, messages sent while the bot is asleep can fail after the hold window (red X in Discord). Skipping is allowed but not recommended.
- Newcomer-audit fixes:
  - Wake is now a numbered step right after callback in both install checklists, and the skill list drops the "operator-driven" framing.
  - `SENDPROMPT_TUNNEL_URL` is documented as **required**, matching `ensure-sendprompt-tunnel.sh`, and setting it is part of the routine setup.
  - New **Durable sendPrompt tunnel** section: named Cloudflare tunnel create/route/run with placeholders, `--protocol http2` where UDP is blocked, and a supervisor example for `SENDPROMPT_SUPERVISOR` / `SENDPROMPT_CONNECTOR_MATCH`.
  - Bridge PR links are replaced with the bridge README wake section, and the minimum bridge version (>= 0.2.12) is stated.
  - The wake skill explains how to resolve the absolute plugin install path (the desktop app keeps its own copy) once and put it in the routine prompt.
  - End-to-end check added: DM reply, plus an optional sleep test.
  - Marketplace PR status line rechecked.
  - Intents now include **Guild Voice States** (non-privileged; used by the bridge's voice features).
- Public-repo hygiene: removed operator and host names from an old changelog line.
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.30`.

## 0.3.29

- New skill `discord-wake-on-sleep`: one idempotent webhook-triggered routine per Grok Bot account that runs `scripts/ensure-sendprompt-tunnel.sh` on wake and ends quietly; the key comes in through a masked secret card and the bot never sees it. Includes turn-off steps.
- Docs: README **Wake on sleep (optional)** — flow, bridge env (`SENDPROMPT_WAKE_URL`, `SENDPROMPT_WAKE_KEY`, `SENDPROMPT_WAKE_HEADER` default `Authorization` → `Bearer <key>`, other names send the raw key; `SENDPROMPT_HOLD_MAX_SEC` default 900, 1800 recommended with wake), body `{reason, heldCount, firstHeldAt}`, once-per-outage firing, troubleshooting. Names match bridge 0.2.12 (https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge/pull/9). Default header `Authorization: Bearer <key>` verified live: HTTP 200 with JSON `{success:true, runUuid}`. `SENDPROMPT_TUNNEL_URL` documented as an optional fallback for the routine.
- Wake setup UX from live setup: the routine panel has POST URL, key, and Authorization header fields. The bot gives deep links first (`grokbot://app/v1/sidebar?target=webhook-url|webhook-key|webhook-header&automation=<folder id>`), with the menu path (chat-header bot name or Cmd+Shift+I → Routines) as a fallback. The key is collected by a masked secret-request card into a box env var, the URL is pasted in chat, and a no-echo script writes the bridge `.env` (backup and exclude rules kept, `SENDPROMPT_HOLD_MAX_SEC=1800`). Hand-editing is a fallback. The expected wake response is HTTP 200 with JSON `{success:true, runUuid}`, used for verification and troubleshooting.
- Review fixes: the `.env` writer rewrites in place (`cat "$f.new" > "$f"`, private temp file, `cp -p` backup), so the inode, owner and mode survive single-file bind mounts. Apply with `docker compose up -d` (`docker restart` and `docker compose restart` don't re-read `env_file`). The webhook URL is not secret unless it embeds a token in its path; then treat it like the key.
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.29`.

## 0.3.28

- New `scripts/sendprompt-tunnel-watchdog.sh` and `scripts/ensure-sendprompt-tunnel.sh` (generic, env-configured, no hosts baked in).
- Fix: a curl timeout produced `000000` (`-w '%{http_code}' || echo 000`) and counted as healthy. Any non-3-digit status is now `000`; `000` and any 5xx are unhealthy.
- Probe every 60s, restart after 2 misses in a row; restart immediately on a >3 min wall-clock jump (hibernate/resume); daily forced restart at 06:00 local tracked by a date file (runs on wake if asleep).
- Lock fd no longer inherited by children; every non-404 probe and every restart is logged with its reason. `--selftest` checks the status classifier.
- Watchdog: daily-restart stamp is seeded on first start, so starting after 06:00 does not force an immediate restart.
- Watchdog: `force_restart` no longer double-kills the connector / double-waits; ensure skips its kill when called from the watchdog (`SENDPROMPT_SKIP_KILL`).
- 401 and 403 now count as unhealthy (usually a misconfigured URL/auth); selftest updated.
- Docs: `SENDPROMPT_SUPERVISOR` is word-split (no spaces in its paths); generic bridge operator notes (User-Agent, DM `userId`, optional hop `c`, error table, connector restart / `--protocol http2`, deploy hygiene).
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.28`.

## 0.3.27

- Docs: Grok Build and the Grok Bot desktop app keep separate plugin copies. Every deploy installs the same commit in both.
- Docs: channel-map example adds optional `primary_llm`, `wake_agent`, `handler`, `local_handler`, `harness`, and `profile`, with placeholder values only. Real agent ids stay in the operator's local roster, not this repo.
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.27`.

## 0.3.26

- Two independent bridge-bot enable layers. Do not collapse them into one flag.
  - Global `botsEnabled` (default ON). A missing flag means enabled. When off, bridge bots do not run even if a site is enabled.
  - Per-site `sites[].enabled` (same meaning as channel-map `channels[].enabled`). Turning a site on or off does not change the global flag, and changing the global flag does not rewrite site rows.
- Pure evaluation: `bridgeBotRunsForSite` — a bridge bot runs for a site only when global is on AND that site is on. `setGlobalBotsEnabled` / `setSiteEnabled` each copy the other store unchanged. Manage MCP `evaluate_bridge_bot_enable` (no Discord call, no writes).
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.26`.


## 0.3.25

- Docs: a bridge hop that starts a local handler must pass the real inbound Discord message id and the callback URL so the handler can POST the result (text and/or image) back. Header auth only (`Authorization: Bearer` or `x-callback-token`); do not put the callback token in the query string.
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.25`.

## 0.3.24

- Align Grok-primary marketplace documentation with the open xAI catalog PR (#1088) and post-merge install commands.
- Clarify that `DISCORD_BOT_TOKEN` is required for Discord REST status/manage functionality; bridge health alone is only an optional liveness probe.
- Remove unused callback secret/url injection from `.mcp.json`; callback variables remain available in manifests for operator-driven skills.
- Sync plugin manifests, MCP packages, server metadata, and Discord User-Agent to `0.3.24`.

## 0.3.23

- Manage MCP moderation slice (confirm-gated Discord REST; dry-run without `confirm=true`): `timeout_member`, `kick_member`, `ban_member`, `unban_member`, `delete_message`, `purge_channel_messages` (bulk-delete when Discord allows; cap 100; notes <14d / count limits).
- Update `describe_manage_boundary` managePolicy; skills `discord-fleet-manage` / `discord-fleet-boundary`.
- Docs: README **Discord bot permissions** (messaging + moderation checklist, OAuth2 URL Generator scopes/`bot`, permission integers `117760` / `125952` / `1099511753734`, role hierarchy, token ≠ channel access, how to add perms later). Expand bot-create checklist step 4.
- Still no wake / sendPrompt / Gateway listen / bridge channel-map or security.json writes.
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.23`.

## 0.3.22

- Manage MCP first action slice (confirm-gated Discord REST): `list_channel_messages`, `post_channel_message` (dry-run without confirm; refuses empty content; returns message id), `check_bot_channel_permissions` (computed View/Send/History + related flags).
- Update `describe_manage_boundary` managePolicy; skills `discord-fleet-manage` / `discord-fleet-boundary`; README manage tools list.
- Still no wake / sendPrompt / Gateway listen / bridge channel-map or security.json writes.
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.22`.

## 0.3.21

- Align callback auth docs with bridge **0.2.4+** header-only `/callback`: `Authorization: Bearer <token>` or `x-callback-token` only; query `?token=` rejected (**401**).
- Update README, `discord-fleet-callback-setup`, `discord-fleet-bridge-setup`, `discord-fleet-hop-shorthand`.
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.21`.


## 0.3.20

- Docs: add README **Discord bot token & invite** checklist (Developer Portal → bot token → intents → OAuth2 invite → optional guild/health/callback).
- Clarify privileged Gateway Intents: this plugin's REST MCP needs none; optional self-hosted wake bridge needs Message Content (+ Guilds / Guild Messages / Direct Messages for DM wake).
- Prefer Bearer / `x-callback-token` headers for bridge `POST /callback`; note query `?token=` removal on bridge next release.
- Skills `discord-fleet-callback-setup`, `discord-fleet-bridge-setup`, `discord-fleet-boundary`, `discord-fleet-hop-shorthand`: point at the checklist / header preference.
- Bump manifests, MCP packages, serverInfo, and Discord User-Agent to `0.3.20`.

## 0.3.19

- **Windows + Linux marketplace readiness:** add `scripts/bootstrap-mcp.ps1`; harden `scripts/bootstrap-mcp.sh` (no hard `pipefail` dependency; node/npm presence checks; Git Bash friendly).
- Force LF for `*.sh` / `*.ps1` via `.gitattributes` to avoid CRLF shebang / `set -o` breakage under Git Bash.
- MCP configs (`.mcp.json` / `mcp.json`) start with portable `node ./node_modules/tsx/dist/cli.mjs src/index.ts` (cwd per package) instead of bare `npm start` — avoids Windows stdio hangs when `npm` is not fully resolved.
- Align MCP `serverInfo`, Discord User-Agent, package.json, and manifests to `0.3.19`.
- README: dual bootstrap docs, Windows notes for Cursor/Git Bash/`npm.cmd`, document node+tsx launch.

## 0.3.18

- Marketplace logo from Flux public-site preview (`assets/logo.svg`).
- Bump MCP `package.json` versions toward plugin semver `0.3.18` (serverInfo alignment completed in `0.3.19`).

## 0.3.17

- **First-time install fix:** document and ship `scripts/bootstrap-mcp.sh` (`npm ci` in `mcp/status` + `mcp/manage`). README Cursor/Grok install paths require this before MCP start.
- MCP configs (`.mcp.json` / `mcp.json`) start via `npm start` in each package cwd (local `tsx` + SDK) instead of `npx -y tsx`.
- Move `tsx` to MCP `dependencies` so runtime start does not rely on omit-dev installs.
- Add `assets/logo.svg` and `logo` on `.cursor-plugin` / root / `.grok-plugin` manifests.
- README: blank line before Skills; Cursor Marketplace submit blurb (`cursor.com/marketplace/publish` + checklist).
- Align MCP `serverInfo` / Discord User-Agent with plugin semver `0.3.17`.
- Skills: note required MCP bootstrap after clone.

## 0.3.16

- Scrub remaining personal/portfolio framing for public general use: drop operator-specific catalog and host/agent shorthand from docs and skills; keep installer-neutral wording.
- Bump plugin manifests to `0.3.16`.


## 0.3.15

- First-class **self-callback setup** without host vault hop: optional plugin vars `DISCORD_BRIDGE_CALLBACK_TOKEN` (Bearer for YOUR bridge `POST /callback`) and `DISCORD_BRIDGE_CALLBACK_URL` (full URL or base ending in `/callback`; placeholder `https://callback.example.com/callback` only).
- Pass both vars through `.mcp.json` / `mcp.json` env maps for status and manage servers (consistency / future use).
- New skill `discord-fleet-callback-setup`: operator-driven verify + safe curl smoke (`callback_setup http=<code> token_set=… url_set=…`); per-bot Secrets required for multi-agent fleets.
- Skills: `discord-fleet-boundary`, `discord-fleet-bridge-setup`, `discord-fleet-hop-shorthand` — prefer env callback token/URL for dual-deliver; do not require a host-vault hop; never ask another agent to deliver.
- Bump plugin manifests to `0.3.15`.

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
