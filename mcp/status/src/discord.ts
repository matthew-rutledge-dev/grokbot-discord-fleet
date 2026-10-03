/**
 * Minimal Discord REST helpers (read-only). Token from env only — never hardcoded.
 */
const API = "https://discord.com/api/v10";
const UA =
  "DiscordBot (https://github.com/matthew-rutledge-dev/grokbot-discord-fleet, 0.3.25)";

export class DiscordApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "DiscordApiError";
  }
}

export function requireBotToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "DISCORD_BOT_TOKEN is not set. Set it via plugin variables or your host vault/runtime environment. Never commit tokens.",
    );
  }
  return token;
}

export function hasBotToken(): boolean {
  return Boolean(process.env.DISCORD_BOT_TOKEN?.trim());
}

export async function discordGet<T = unknown>(
  path: string,
  token: string,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bot ${token}`,
      "User-Agent": UA,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new DiscordApiError(
      `Discord GET ${path} failed: HTTP ${res.status}`,
      res.status,
      text.slice(0, 500),
    );
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export type DiscordUser = {
  id: string;
  username: string;
  discriminator?: string;
  bot?: boolean;
  global_name?: string | null;
};

export type DiscordGuildPartial = {
  id: string;
  name: string;
  owner?: boolean;
  permissions?: string;
};

export type DiscordChannel = {
  id: string;
  type: number;
  name?: string;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
};

export type DiscordRole = {
  id: string;
  name: string;
  managed?: boolean;
  position?: number;
};

export type DiscordGuild = {
  id: string;
  name: string;
  owner_id?: string;
  approximate_member_count?: number;
};

const CHANNEL_TYPE_NAMES: Record<number, string> = {
  0: "GUILD_TEXT",
  2: "GUILD_VOICE",
  4: "GUILD_CATEGORY",
  5: "GUILD_ANNOUNCEMENT",
  13: "GUILD_STAGE_VOICE",
  15: "GUILD_FORUM",
  16: "GUILD_MEDIA",
};

export function channelTypeName(type: number): string {
  return CHANNEL_TYPE_NAMES[type] ?? `TYPE_${type}`;
}
