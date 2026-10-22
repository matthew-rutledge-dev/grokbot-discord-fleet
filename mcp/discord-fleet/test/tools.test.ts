import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALL_TOOLS,
  WRITE_TOOL_NAMES,
  listTools,
  parseReadOnly,
} from "../src/tools.js";

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

test("normal mode lists every status + manage tool", () => {
  const names = listTools(false).map((t) => t.name).sort();
  assert.deepEqual(names, [...READ_TOOLS, ...WRITE_TOOLS].sort());
  assert.equal(names.length, 16);
  assert.equal(new Set(names).size, names.length, "no duplicate tool names");
});

test("read-only mode hides every write/moderation tool", () => {
  const names = listTools(true).map((t) => t.name).sort();
  assert.deepEqual(names, [...READ_TOOLS].sort());
  for (const w of WRITE_TOOLS) assert.ok(!names.includes(w), `${w} hidden`);
});

test("write tool set matches the confirm-gated writers", () => {
  assert.deepEqual([...WRITE_TOOL_NAMES].sort(), [...WRITE_TOOLS].sort());
  for (const name of WRITE_TOOLS) {
    const tool = ALL_TOOLS.find((t) => t.name === name);
    assert.ok(tool, `${name} defined`);
    const props = (tool!.inputSchema as { properties?: Record<string, unknown> })
      .properties;
    assert.ok(props && "confirm" in props, `${name} keeps confirm`);
  }
});

test("parseReadOnly fails closed: only unset/empty/off values are off", () => {
  for (const v of ["1", "true", "TRUE", " yes ", "on", "enabled", "2", "readonly"])
    assert.equal(parseReadOnly(v), true, v);
  for (const v of [undefined, "", "  ", "0", "false", "FALSE", " no ", "off", "Off"])
    assert.equal(parseReadOnly(v as string | undefined), false, String(v));
});

test("read tools never require confirm; write tools keep confirm", () => {
  for (const name of READ_TOOLS) {
    const tool = ALL_TOOLS.find((t) => t.name === name)!;
    const required = (tool.inputSchema as { required?: string[] }).required ?? [];
    assert.ok(!required.includes("confirm"), `${name} must not require confirm`);
  }
  for (const name of WRITE_TOOLS) {
    const tool = ALL_TOOLS.find((t) => t.name === name)!;
    const props = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    assert.ok("confirm" in props, `${name} keeps a confirm argument`);
  }
});
