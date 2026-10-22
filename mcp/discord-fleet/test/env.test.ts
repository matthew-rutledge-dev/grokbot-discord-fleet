import assert from "node:assert/strict";
import { test } from "node:test";
import { isUnsetValue, readEnv } from "../src/env.js";
import { readOnlyFromEnv } from "../src/readonly.js";

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
