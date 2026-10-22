/**
 * Two independent bridge-bot enable layers. Do not collapse them into one flag.
 *
 * 1. Global `botsEnabled` — default ON. A missing flag means enabled (fail open).
 *    When off, bridge bots do not run, even if a site is enabled.
 * 2. Per-site `sites[].enabled` — independently adjustable. Same meaning as a
 *    channel-map row `enabled` flag. Turning a site on or off does not change
 *    the global flag, and changing the global flag does not rewrite site rows.
 *
 * A bridge bot runs for a site only when global is on AND that site is on.
 */
export type SiteEnable = {
  /** Installer site key (channel snowflake or other site id). */
  siteId: string;
  /** Per-site on/off. Not owned by `botsEnabled`. */
  enabled: boolean;
};

export type FleetEnableConfig = {
  /**
   * Global bridge-bot on/off.
   * Omit, or pass a non-boolean, to mean enabled. Explicit false turns bots
   * off even when a site is enabled. Never inferred from site flags.
   */
  botsEnabled?: boolean;
  /** Per-site enable flags. The global flag does not own this list. */
  sites: SiteEnable[];
};

export const FLEET_ENABLE_KEYS = {
  global: "botsEnabled",
  sites: "sites",
  siteId: "siteId",
  siteEnabled: "enabled",
} as const;

/** JSON Schema. Site flags are a sibling store, not nested under the global flag. */
export const FLEET_ENABLE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "FleetEnableConfig",
  type: "object",
  additionalProperties: false,
  properties: {
    botsEnabled: {
      type: "boolean",
      description:
        "Global bridge-bot on/off. Default ON when omitted. Independent of sites.",
      default: true,
    },
    sites: {
      type: "array",
      description:
        "Per-site enable flags. Changing a site does not write botsEnabled.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["siteId", "enabled"],
        properties: {
          siteId: { type: "string", minLength: 1 },
          enabled: { type: "boolean" },
        },
      },
    },
  },
  required: ["sites"],
} as const;

export const BOT_ENABLE_EVALUATION_ORDER = [
  "Read botsEnabled from the global store. If the flag is missing or not a boolean, treat it as ON.",
  "Read that site's enabled flag from the separate site store. A missing site is OFF.",
  "The bridge bot runs for the site only when global is ON and that site is ON.",
  "Writing one store copies the other unchanged. Neither write rewrites the other.",
] as const;

export function defaultFleetEnableConfig(): FleetEnableConfig {
  return { botsEnabled: true, sites: [] };
}

/** Missing config or missing/non-boolean flag => enabled (default on). */
export function resolveGlobalBotsEnabled(
  config: { botsEnabled?: boolean } | null | undefined,
): boolean {
  if (config == null || typeof config.botsEnabled !== "boolean") return true;
  return config.botsEnabled;
}

function cloneSites(sites: readonly SiteEnable[] | undefined): SiteEnable[] {
  if (!sites) return [];
  return sites.map((s) => ({ siteId: s.siteId, enabled: s.enabled }));
}

export function normalizeFleetEnableConfig(
  input:
    | {
        botsEnabled?: boolean;
        sites?: readonly { siteId?: unknown; enabled?: unknown }[];
      }
    | null
    | undefined,
): FleetEnableConfig {
  const sites: SiteEnable[] = [];
  for (const row of input?.sites ?? []) {
    const siteId = typeof row.siteId === "string" ? row.siteId.trim() : "";
    if (!siteId || typeof row.enabled !== "boolean") continue;
    const next: SiteEnable = { siteId, enabled: row.enabled };
    const idx = sites.findIndex((s) => s.siteId === siteId);
    if (idx >= 0) sites[idx] = next;
    else sites.push(next);
  }
  const config: FleetEnableConfig = { sites };
  if (input != null && typeof input.botsEnabled === "boolean") {
    config.botsEnabled = input.botsEnabled;
  }
  return config;
}

/** Missing site, or enabled not strictly true, is OFF. */
export function resolveSiteEnabled(
  sites: readonly SiteEnable[] | undefined,
  siteId: string,
): boolean {
  const id = siteId.trim();
  if (!id) return false;
  const row = (sites ?? []).find((s) => s.siteId === id);
  return row?.enabled === true;
}

/** Bridge bot runs for a site only when global is on AND that site is on. */
export function bridgeBotRunsForSite(
  config: FleetEnableConfig | null | undefined,
  siteId: string,
): boolean {
  return (
    resolveGlobalBotsEnabled(config) &&
    resolveSiteEnabled(config?.sites, siteId)
  );
}

/** Sets the global flag only. Site rows are copied unchanged. */
export function setGlobalBotsEnabled(
  config: FleetEnableConfig,
  botsEnabled: boolean,
): FleetEnableConfig {
  return {
    botsEnabled,
    sites: cloneSites(config.sites),
  };
}

/**
 * Sets one site flag only.
 * Preserves `botsEnabled` exactly, including when the global flag was omitted.
 */
export function setSiteEnabled(
  config: FleetEnableConfig,
  siteId: string,
  enabled: boolean,
): FleetEnableConfig {
  const id = siteId.trim();
  if (!id) throw new Error("siteId is required");
  const sites = cloneSites(config.sites);
  const idx = sites.findIndex((s) => s.siteId === id);
  if (idx >= 0) sites[idx] = { siteId: id, enabled };
  else sites.push({ siteId: id, enabled });
  const next: FleetEnableConfig = { sites };
  if (typeof config.botsEnabled === "boolean") next.botsEnabled = config.botsEnabled;
  return next;
}
