/**
 * Minimal Discord REST helpers (manage). Token from env only — never hardcoded.
 * Gated reads + confirm-gated writes (post / moderation). No wake / sendPrompt.
 */
const API = "https://discord.com/api/v10";
const UA =
  "DiscordBot (https://github.com/matthew-rutledge-dev/grokbot-discord-fleet, 0.3.24)";

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

async function discordRequest<T = unknown>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
  auditReason?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bot ${token}`,
    "User-Agent": UA,
    Accept: "application/json",
  };
  if (auditReason?.trim()) {
    // Discord audit-log reason header (URL-encoded, max 512)
    headers["X-Audit-Log-Reason"] = encodeURIComponent(
      auditReason.trim().slice(0, 512),
    );
  }
  let payload: string | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: payload,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new DiscordApiError(
      `Discord ${method} ${path} failed: HTTP ${res.status}`,
      res.status,
      text.slice(0, 500),
    );
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function discordGet<T = unknown>(
  path: string,
  token: string,
): Promise<T> {
  return discordRequest<T>("GET", path, token);
}

export async function discordPost<T = unknown>(
  path: string,
  token: string,
  body: unknown,
  auditReason?: string,
): Promise<T> {
  return discordRequest<T>("POST", path, token, body, auditReason);
}

export async function discordPatch<T = unknown>(
  path: string,
  token: string,
  body: unknown,
  auditReason?: string,
): Promise<T> {
  return discordRequest<T>("PATCH", path, token, body, auditReason);
}

export async function discordPut<T = unknown>(
  path: string,
  token: string,
  body?: unknown,
  auditReason?: string,
): Promise<T> {
  return discordRequest<T>("PUT", path, token, body ?? {}, auditReason);
}

export async function discordDelete<T = unknown>(
  path: string,
  token: string,
  auditReason?: string,
): Promise<T> {
  return discordRequest<T>("DELETE", path, token, undefined, auditReason);
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

export type DiscordPermissionOverwrite = {
  id: string;
  type: number;
  allow: string;
  deny: string;
};

export type DiscordChannel = {
  id: string;
  type: number;
  name?: string;
  guild_id?: string | null;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
  permission_overwrites?: DiscordPermissionOverwrite[];
};

export type DiscordRole = {
  id: string;
  name: string;
  permissions?: string;
  managed?: boolean;
  position?: number;
};

export type DiscordGuild = {
  id: string;
  name: string;
  owner_id?: string;
  approximate_member_count?: number;
};

export type DiscordGuildMember = {
  user?: DiscordUser;
  roles: string[];
  nick?: string | null;
  communication_disabled_until?: string | null;
};

export type DiscordMessage = {
  id: string;
  channel_id: string;
  author?: DiscordUser;
  content?: string;
  timestamp?: string;
  type?: number;
  attachments?: Array<{ id: string; filename?: string; url?: string }>;
};

/** Discord permission bitflags used for fleet ops. */
export const Perm = {
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  ADD_REACTIONS: 1n << 6n,
  MODERATE_MEMBERS: 1n << 40n,
} as const;

const CHANNEL_TYPE_NAMES: Record<number, string> = {
  0: "GUILD_TEXT",
  1: "DM",
  2: "GUILD_VOICE",
  3: "GROUP_DM",
  4: "GUILD_CATEGORY",
  5: "GUILD_ANNOUNCEMENT",
  10: "ANNOUNCEMENT_THREAD",
  11: "PUBLIC_THREAD",
  12: "PRIVATE_THREAD",
  13: "GUILD_STAGE_VOICE",
  15: "GUILD_FORUM",
  16: "GUILD_MEDIA",
};

export function channelTypeName(type: number): string {
  return CHANNEL_TYPE_NAMES[type] ?? `TYPE_${type}`;
}

function applyOverwrite(base: bigint, allow: string, deny: string): bigint {
  let perms = base;
  perms &= ~BigInt(deny || "0");
  perms |= BigInt(allow || "0");
  return perms;
}

/**
 * Compute channel permissions for a guild member (Discord docs algorithm).
 * @everyone role id === guild id.
 */
export function computeChannelPermissions(opts: {
  guildId: string;
  memberRoleIds: string[];
  roles: DiscordRole[];
  overwrites: DiscordPermissionOverwrite[];
}): bigint {
  const roleById = new Map(opts.roles.map((r) => [r.id, r]));
  const everyone = roleById.get(opts.guildId);
  let perms = BigInt(everyone?.permissions ?? "0");

  for (const roleId of opts.memberRoleIds) {
    const role = roleById.get(roleId);
    if (role?.permissions) perms |= BigInt(role.permissions);
  }

  if ((perms & Perm.ADMINISTRATOR) === Perm.ADMINISTRATOR) {
    return Perm.ADMINISTRATOR; // caller treats ADMINISTRATOR as all
  }

  const overs = opts.overwrites ?? [];
  const everyoneOw = overs.find((o) => o.id === opts.guildId && o.type === 0);
  if (everyoneOw) {
    perms = applyOverwrite(perms, everyoneOw.allow, everyoneOw.deny);
  }

  let allow = 0n;
  let deny = 0n;
  for (const roleId of opts.memberRoleIds) {
    const ow = overs.find((o) => o.id === roleId && o.type === 0);
    if (ow) {
      allow |= BigInt(ow.allow || "0");
      deny |= BigInt(ow.deny || "0");
    }
  }
  perms &= ~deny;
  perms |= allow;

  return perms;
}

export function permissionFlags(perms: bigint): {
  can_view: boolean;
  can_send: boolean;
  can_read_history: boolean;
  can_attach_files: boolean;
  can_embed_links: boolean;
  can_add_reactions: boolean;
  can_manage_messages: boolean;
  can_kick_members: boolean;
  can_ban_members: boolean;
  can_moderate_members: boolean;
  administrator: boolean;
  raw: string;
  named: string[];
} {
  const admin = (perms & Perm.ADMINISTRATOR) === Perm.ADMINISTRATOR;
  const has = (bit: bigint) => admin || (perms & bit) === bit;
  const named: string[] = [];
  if (admin) named.push("ADMINISTRATOR");
  if (has(Perm.VIEW_CHANNEL)) named.push("VIEW_CHANNEL");
  if (has(Perm.SEND_MESSAGES)) named.push("SEND_MESSAGES");
  if (has(Perm.READ_MESSAGE_HISTORY)) named.push("READ_MESSAGE_HISTORY");
  if (has(Perm.ATTACH_FILES)) named.push("ATTACH_FILES");
  if (has(Perm.EMBED_LINKS)) named.push("EMBED_LINKS");
  if (has(Perm.ADD_REACTIONS)) named.push("ADD_REACTIONS");
  if (has(Perm.MANAGE_MESSAGES)) named.push("MANAGE_MESSAGES");
  if (has(Perm.KICK_MEMBERS)) named.push("KICK_MEMBERS");
  if (has(Perm.BAN_MEMBERS)) named.push("BAN_MEMBERS");
  if (has(Perm.MODERATE_MEMBERS)) named.push("MODERATE_MEMBERS");
  return {
    can_view: has(Perm.VIEW_CHANNEL),
    can_send: has(Perm.SEND_MESSAGES),
    can_read_history: has(Perm.READ_MESSAGE_HISTORY),
    can_attach_files: has(Perm.ATTACH_FILES),
    can_embed_links: has(Perm.EMBED_LINKS),
    can_add_reactions: has(Perm.ADD_REACTIONS),
    can_manage_messages: has(Perm.MANAGE_MESSAGES),
    can_kick_members: has(Perm.KICK_MEMBERS),
    can_ban_members: has(Perm.BAN_MEMBERS),
    can_moderate_members: has(Perm.MODERATE_MEMBERS),
    administrator: admin,
    raw: perms.toString(),
    named,
  };
}

/** Apply member-specific overwrite after role overwrites (Discord step 5). */
export function applyMemberOverwrite(
  perms: bigint,
  memberId: string,
  overwrites: DiscordPermissionOverwrite[],
): bigint {
  if ((perms & Perm.ADMINISTRATOR) === Perm.ADMINISTRATOR) return perms;
  const ow = overwrites.find((o) => o.id === memberId && o.type === 1);
  if (!ow) return perms;
  return applyOverwrite(perms, ow.allow, ow.deny);
}

/** Snowflake → approximate creation time (ms since epoch). */
export function snowflakeToMs(id: string): number | null {
  try {
    const n = BigInt(id);
    return Number((n >> 22n) + 1420070400000n);
  } catch {
    return null;
  }
}

/** Discord bulk-delete: messages must be younger than 14 days. */
export const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function isBulkDeleteEligible(messageId: string, nowMs = Date.now()): boolean {
  const created = snowflakeToMs(messageId);
  if (created == null) return false;
  return nowMs - created < BULK_DELETE_MAX_AGE_MS;
}
