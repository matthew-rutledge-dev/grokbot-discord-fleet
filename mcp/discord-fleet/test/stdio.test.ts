/**
 * Starts the real server over stdio (same command as the plugin MCP config)
 * and checks tools/list + call gating in both modes. No Discord token needed:
 * only dry-run / no-network paths are called.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function connect(extraEnv: Record<string, string>) {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string" && !k.startsWith("DISCORD_")) env[k] = v;
  }
  Object.assign(env, extraEnv);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["./node_modules/tsx/dist/cli.mjs", "src/index.ts"],
    cwd: pkgDir,
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

test("stdio: normal mode lists all 16 tools; write tool without confirm is a dry run", async () => {
  const client = await connect({});
  try {
    const info = client.getServerVersion();
    assert.equal(info?.name, "discord-fleet");
    const { tools } = await client.listTools();
    assert.equal(tools.length, 16);
    assert.ok(tools.some((t) => t.name === "post_channel_message"));
    assert.ok(tools.some((t) => t.name === "fleet_health"));

    const res = await client.callTool({
      name: "post_channel_message",
      arguments: { channelId: "000000000000000000", content: "hello" },
    });
    const body = textOf(res);
    assert.equal(body.dryRun, true);
    assert.equal(body.discordWrites, false);

    const refused = textOf(
      await client.callTool({
        name: "kick_member",
        arguments: { guildId: "000000000000000000", userId: "000000000000000001" },
      }),
    );
    assert.equal(refused.dryRun, true);

    const boundary = textOf(
      await client.callTool({ name: "describe_manage_boundary", arguments: {} }),
    );
    assert.equal(boundary.readOnly, false);
    assert.equal(boundary.server, "discord-fleet");
  } finally {
    await client.close();
  }
});

test("stdio: DISCORD_FLEET_READ_ONLY=1 hides and refuses write tools", async () => {
  const client = await connect({ DISCORD_FLEET_READ_ONLY: "1" });
  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    assert.equal(names.length, 9);
    for (const w of [
      "post_channel_message",
      "timeout_member",
      "kick_member",
      "ban_member",
      "unban_member",
      "delete_message",
      "purge_channel_messages",
    ]) {
      assert.ok(!names.includes(w), `${w} hidden`);
    }
    const res = await client.callTool({
      name: "post_channel_message",
      arguments: { channelId: "000000000000000000", content: "hello", confirm: true },
    });
    assert.equal((res as { isError?: boolean }).isError, true);
    assert.equal(textOf(res).readOnly, true);

    const boundary = textOf(
      await client.callTool({ name: "describe_manage_boundary", arguments: {} }),
    );
    assert.equal(boundary.readOnly, true);
  } finally {
    await client.close();
  }
});
