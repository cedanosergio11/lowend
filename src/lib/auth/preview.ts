/**
 * Live-preview OAuth client placeholders (auth disabled for LOWEND).
 * Real values come from env when auth is turned on — never commit secrets.
 */
export const PREVIEW_CLIENT_ID =
  process.env.GROK_PREVIEW_CLIENT_ID ?? "grok_preview";
export const PREVIEW_CLIENT_SECRET =
  process.env.GROK_PREVIEW_CLIENT_SECRET ?? "";
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
