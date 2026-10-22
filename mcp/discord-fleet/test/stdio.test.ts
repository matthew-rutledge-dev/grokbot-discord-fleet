/**
 * Starts the built server over stdio the way hosts do: `node <root>/mcp/discord-fleet/dist/index.js`
 * with an absolute path, from a neutral cwd (some hosts ignore the MCP `cwd`
 * field), and with unset plugin variables passed through as literal ${...}
 * strings. Checks tools/list in both modes, write gating, and that read tools
 * run without confirm. No Discord token needed: no call reaches Discord.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(pkgDir, "dist", "index.js");

const READ_TOOLS = [
  "fleet_health",
  "list_channel_map",
  "describe_manage_boundary",
  "plan_channel_binding",
  "inspect_guild",
  "resolve_channel",
  "list_channel_messages",
  "check_bot_channel_permissions",
  "evaluate_bridge_bot_enable",
];
const WRITE_TOOLS = [
  "post_channel_message",
  "timeout_member",
  "kick_member",
  "ban_member",
  "unban_member",
  "delete_message",
  "purge_channel_messages",
];

async function connect(extraEnv: Record<string, string>) {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string" && !k.startsWith("DISCORD_")) env[k] = v;
  }
  // Unexpanded host placeholders, as some hosts pass them.
  env.DISCORD_BOT_TOKEN = "${DISCORD_BOT_TOKEN}";
  env.DISCORD_GUILD_ID = "${DISCORD_GUILD_ID}";
  env.DISCORD_BRIDGE_HEALTH_URL = "${DISCORD_BRIDGE_HEALTH_URL}";
  env.DISCORD_FLEET_READ_ONLY = "${DISCORD_FLEET_READ_ONLY}";
  Object.assign(env, extraEnv);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    cwd: os.tmpdir(),
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "discord-fleet-test", version: "0.0.0" });
  await client.connect(transport);
  return client;
}

function textOf(res: unknown): Record<string, unknown> {
  const content = (res as { content: Array<{ text: string }> }).content;
  return JSON.parse(content[0].text) as Record<string, unknown>;
}

test("stdio (neutral cwd, placeholder env): all 16 tools; writes dry-run without confirm", async () => {
  const client = await connect({});
  try {
    assert.equal(client.getServerVersion()?.name, "discord-fleet");
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...READ_TOOLS, ...WRITE_TOOLS].sort());

    for (const [name, args] of [
      ["post_channel_message", { channelId: "000000000000000000", content: "hello" }],
      ["kick_member", { guildId: "000000000000000000", userId: "000000000000000001" }],
    ] as const) {
      const body = textOf(await client.callTool({ name, arguments: { ...args } }));
      assert.equal(body.dryRun, true, `${name} dry-run`);
      assert.equal(body.discordWrites, false, `${name} no write`);
    }

    const boundary = textOf(
      await client.callTool({ name: "describe_manage_boundary", arguments: {} }),
    );
    assert.equal(boundary.readOnly, false, "placeholder READ_ONLY is off");

    const health = textOf(await client.callTool({ name: "fleet_health", arguments: {} }));
    assert.deepEqual(health.envHints, {
      DISCORD_BOT_TOKEN: "missing",
      DISCORD_BRIDGE_HEALTH_URL: "missing",
      DISCORD_GUILD_ID: "missing",
    });
  } finally {
    await client.close();
  }
});

test("stdio: read tools run without confirm (clean token-missing, never a 400)", async () => {
  const client = await connect({});
  try {
    const calls: Array<[string, Record<string, unknown>]> = [
      ["inspect_guild", {}],
      ["inspect_guild", { guildId: "000000000000000000" }],
      ["resolve_channel", { channelId: "000000000000000000" }],
      ["list_channel_messages", { channelId: "000000000000000000" }],
      ["check_bot_channel_permissions", { channelId: "000000000000000000" }],
    ];
    for (const [name, args] of calls) {
      const res = await client.callTool({ name, arguments: args });
      const text = JSON.stringify(textOf(res));
      assert.ok(!/requires confirm/i.test(text), `${name} must not demand confirm: ${text}`);
      assert.ok(!/HTTP 400|snowflake/i.test(text), `${name} must not reach Discord: ${text}`);
      assert.ok(
        /DISCORD_BOT_TOKEN is not set|guildId required/.test(text),
        `${name} clean missing-config error: ${text}`,
      );
    }
  } finally {
    await client.close();
  }
});

test("stdio: DISCORD_FLEET_READ_ONLY=1 hides and refuses write tools", async () => {
  const client = await connect({ DISCORD_FLEET_READ_ONLY: "1" });
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...READ_TOOLS].sort());
    const res = await client.callTool({
      name: "post_channel_message",
      arguments: { channelId: "000000000000000000", content: "hello", confirm: true },
    });
    assert.equal((res as { isError?: boolean }).isError, true);
    assert.equal(textOf(res).readOnly, true);
  } finally {
    await client.close();
  }
});
