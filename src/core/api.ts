export const RELAY = ((import.meta.env.VITE_RELAY_URL as string) || "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

/** Relay call. The player only uses the linking endpoints; it never sends any credential to the Relay. */
export async function relay(path: string, init: RequestInit = {}, extra: Record<string, string> = {}) {
  let r: Response;
  try {
    r = await fetch(RELAY + path, {
      ...init, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...extra },
    });
  } catch { throw new ApiError(0, "network"); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, typeof body?.error === "string" ? body.error : "error");
  return body;
}

const MESSAGES: Record<string, string> = {
  network: "Network problem. Check the connection and try again.",
  rate_limited: "Too many requests. Wait a moment and try again.",
  app_not_configured: "Spotify is not set up on the Relay yet (see SETUP-STEPS-v2.1.md).",
  player_not_configured: "The web player is not enabled on the Relay (PLAYER_ORIGIN / PLAYER_URL are empty).",
  player_not_isolated: "The Relay refuses the web player because it is on the same origin as the workspace. Host it in a separate GitHub organization.",
  wrong_origin: "The Relay does not accept this site. Check PLAYER_ORIGIN in the Relay config.",
  forbidden_origin: "The Relay does not accept this site. Check PLAYER_ORIGIN in the Relay config.",
  busy: "The Relay is busy. Try again in a minute.",
  server_misconfigured: "The Relay is missing configuration (TOKEN_KEY). See SETUP-STEPS.md.",
};
export const errText = (e: unknown) => (e instanceof ApiError ? MESSAGES[e.code] ?? "Something went wrong." : "Something went wrong.");
