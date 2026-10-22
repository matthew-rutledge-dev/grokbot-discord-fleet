import assert from "node:assert/strict";
import { test } from "node:test";
import { isUnsetValue, readEnv } from "../src/env.js";
import { describeReadOnly, readOnlyFromEnv, resolveReadOnly } from "../src/readonly.js";

test("readEnv treats empty and literal ${...} placeholders as unset", () => {
  const env = {
    EMPTY: "",
    SPACES: "   ",
    PLACEHOLDER: "${DISCORD_GUILD_ID}",
    PLACEHOLDER_SPACED: "  ${DISCORD_GUILD_ID}  ",
    EMPTY_PLACEHOLDER: "${}",
    REAL: " 123456789012345678 ",
    PARTIAL: "prefix-${X}",
  } as NodeJS.ProcessEnv;
  assert.equal(readEnv("MISSING", env), undefined);
  assert.equal(readEnv("EMPTY", env), undefined);
  assert.equal(readEnv("SPACES", env), undefined);
  assert.equal(readEnv("PLACEHOLDER", env), undefined);
  assert.equal(readEnv("PLACEHOLDER_SPACED", env), undefined);
  assert.equal(readEnv("EMPTY_PLACEHOLDER", env), undefined);
  assert.equal(readEnv("REAL", env), "123456789012345678");
  assert.equal(readEnv("PARTIAL", env), "prefix-${X}");
  assert.equal(isUnsetValue("${DISCORD_BOT_TOKEN}"), true);
  assert.equal(isUnsetValue(undefined), true);
});

test("DISCORD_FLEET_READ_ONLY placeholder or empty reads as off", () => {
  assert.equal(readOnlyFromEnv({ DISCORD_FLEET_READ_ONLY: "${DISCORD_FLEET_READ_ONLY}" }), false);
  assert.equal(readOnlyFromEnv({ DISCORD_FLEET_READ_ONLY: "" }), false);
  assert.equal(readOnlyFromEnv({}), false);
  assert.equal(readOnlyFromEnv({ DISCORD_FLEET_READ_ONLY: "1" }), true);
});

test("token and guild placeholders read as unset in process env", async () => {
  const saved = { ...process.env };
  try {
    process.env.DISCORD_BOT_TOKEN = "${DISCORD_BOT_TOKEN}";
    process.env.DISCORD_GUILD_ID = "${DISCORD_GUILD_ID}";
    process.env.DISCORD_BRIDGE_HEALTH_URL = "${DISCORD_BRIDGE_HEALTH_URL}";
    const { hasBotToken, requireBotToken } = await import("../src/discord.js");
    assert.equal(hasBotToken(), false);
    assert.throws(() => requireBotToken(), /DISCORD_BOT_TOKEN is not set/);
    assert.equal(readEnv("DISCORD_GUILD_ID"), undefined);
    assert.equal(readEnv("DISCORD_BRIDGE_HEALTH_URL"), undefined);
  } finally {
    process.env = saved;
  }
});

test("read-only fails closed on unrecognised values, with one warning", () => {
  for (const v of ["enabled", "2", "readonly", "y"]) {
    const r = resolveReadOnly(v);
    assert.equal(r.readOnly, true, v);
    assert.ok(r.warning && /not a recognised value; treating it as ON/.test(r.warning), v);
  }
  for (const v of ["1", "true", "yes", "on", "ON"]) {
    const r = resolveReadOnly(v);
    assert.deepEqual(r, { readOnly: true, source: "on", raw: v }, v);
  }
  for (const v of ["0", "false", "no", "off", "OFF"]) {
    const r = resolveReadOnly(v);
    assert.deepEqual(r, { readOnly: false, source: "off", raw: v }, v);
  }
  for (const v of ["", "  ", undefined, "${DISCORD_FLEET_READ_ONLY}"]) {
    const r = resolveReadOnly(v);
    assert.equal(r.readOnly, false, String(v));
    assert.equal(r.source, "unset", String(v));
    assert.equal(r.warning, undefined, String(v));
  }
  assert.equal(readOnlyFromEnv({ DISCORD_FLEET_READ_ONLY: "enabled" }), true);
  assert.equal(readOnlyFromEnv({ DISCORD_FLEET_READ_ONLY: "2" }), true);
  assert.equal(readOnlyFromEnv({ DISCORD_FLEET_READ_ONLY: "off" }), false);
  assert.equal(readOnlyFromEnv({ DISCORD_FLEET_READ_ONLY: "${DISCORD_FLEET_READ_ONLY}" }), false);
});

test("describeReadOnly reflects the real value and classification", () => {
  assert.equal(
    describeReadOnly(resolveReadOnly("enabled")),
    'read-only ON (DISCORD_FLEET_READ_ONLY="enabled", unrecognised value treated as ON)',
  );
  assert.equal(describeReadOnly(resolveReadOnly("1")), 'read-only ON (DISCORD_FLEET_READ_ONLY="1")');
  assert.equal(describeReadOnly(resolveReadOnly(" TRUE ")), 'read-only ON (DISCORD_FLEET_READ_ONLY="TRUE")');
  assert.equal(
    describeReadOnly(resolveReadOnly("off")),
    'read-only OFF (DISCORD_FLEET_READ_ONLY="off", explicit off value)',
  );
  assert.equal(describeReadOnly(resolveReadOnly(undefined)), "read-only OFF (DISCORD_FLEET_READ_ONLY unset: not set)");
  assert.equal(describeReadOnly(resolveReadOnly("")), "read-only OFF (DISCORD_FLEET_READ_ONLY unset: empty)");
  assert.equal(
    describeReadOnly(resolveReadOnly("${DISCORD_FLEET_READ_ONLY}")),
    "read-only OFF (DISCORD_FLEET_READ_ONLY unset: unexpanded placeholder)",
  );
  const long = "x".repeat(100);
  assert.ok(describeReadOnly(resolveReadOnly(long)).includes(`"${"x".repeat(32)}"`), "value capped at 32 chars");
  for (const v of [undefined, "", "0", "enabled"]) {
    assert.ok(!describeReadOnly(resolveReadOnly(v)).includes('="1"'), `no hardcoded "1" for ${String(v)}`);
  }
});
