# Grok Bot Discord Fleet (Cursor Plugin)

Cursor plugin home for **Discord fleet manage/status** MCP servers + skills.

**This is NOT the wake path.** Runtime wake (Zion Gateway → `sendPrompt` / webhook) lives in a separate repo:

- Bridge: [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge)
- Host hint (servergen1, Diablo owns): `/opt/sites/discord-fleet-wake`

Do not merge this plugin into the general/Betty catalog. Do not put secrets in git.

## What this plugin is

| Piece | Role |
|-------|------|
| `discord-fleet-status` MCP | Stub health / channel-map status tools |
| `discord-fleet-manage` MCP | Stub dry-run manage / boundary tools |
| Skills | Boundary, status checks, manage planning |

Stubs are placeholders. Real Discord manage APIs are TBD — wire later; no tokens required to start stubs.

## Local install

Copy or symlink this tree to:

```text
~/.cursor/plugins/local/grokbot-discord-fleet/
```

Example (from a working copy):

```bash
mkdir -p ~/.cursor/plugins/local
cp -a /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
# or: ln -s /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
```

Primary manifest: `.cursor-plugin/plugin.json` (optional root `plugin.json` duplicates key fields for discovery).

## MCP servers (`mcp.json`)

Two local stdio stubs (no Discord tokens, empty `env`):

- `discord-fleet-status` → `npx -y tsx mcp/status/src/index.ts`
- `discord-fleet-manage` → `npx -y tsx mcp/manage/src/index.ts`

**Paths are relative to the plugin root.** When Cursor loads the plugin it should run with that cwd. If relative cwd is unreliable on your setup, operators may need to switch `args` to absolute paths under the plugin install dir — do not invent tokens or add secrets to `mcp.json`.

### Status tools

- `fleet_health` — stub health JSON (points at bridge repo / wake host hint only)
- `list_channel_map_stub` — empty read-only stub map

### Manage tools

- `describe_manage_boundary` — this plugin does **not** wake bots
- `plan_channel_binding` — dry-run plan from optional `agentAlias` / `channelId` (no Discord API calls)

## Skills

- `discord-fleet-boundary` — always on for fleet work; manage/status vs wake path
- `discord-fleet-status` — health/status checks via status MCP
- `discord-fleet-manage` — channel-binding plans / manage ops (dry-run until wired)

## Tree

```text
grokbot-discord-fleet/
  .cursor-plugin/plugin.json
  plugin.json                 # optional duplicate for discovery
  mcp.json
  README.md
  LICENSE
  CHANGELOG.md
  .gitignore
  skills/
    discord-fleet-status/SKILL.md
    discord-fleet-manage/SKILL.md
    discord-fleet-boundary/SKILL.md
  mcp/
    status/                   # @modelcontextprotocol/sdk stdio stub
    manage/
```

## Secrets

None. No `.env`, no bot tokens, no webhook URLs in this repo. Keep credentials on the bridge host / operator secrets store, never in the plugin tree.

## License

MIT — Copyright (c) 2026 Matthew Rutledge
