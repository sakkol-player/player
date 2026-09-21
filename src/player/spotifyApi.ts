// Direct calls to Spotify's Web API with the token held in this tab. Only fixed endpoints; ids are validated.
export class AuthError extends Error {}
export interface Track { uri: string; title: string; artist: string; album: string; art: string }

const TRACK = /^spotify:track:[A-Za-z0-9]{22}$/;
const DEV = /^[\w-]{1,80}$/;

async function sp(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch("https://api.spotify.com/v1" + path, {
    method, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
    headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  if (r.status === 401) throw new AuthError();
  if (r.status === 403) throw new Error("Spotify refused this. Premium is required, or your account is not on the app's allowed-users list.");
  if (r.status === 404) throw new Error("The player is not active yet. Press “Start player” first.");
  if (r.status === 429) throw new Error("Spotify asked us to slow down. Try again shortly.");
  if (!r.ok) throw new Error("Spotify is unavailable right now.");
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const art = (images?: Array<{ url?: string }>) => {
  const u = (images?.[1] ?? images?.[0])?.url;
  return typeof u === "string" && u.startsWith("https://i.scdn.co/") ? u : "";
};

export async function search(token: string, q: string): Promise<Track[]> {
  if (!q || q.length > 100) throw new Error("Enter 1 to 100 characters.");
  const d = await sp(token, "GET", "/search?" + new URLSearchParams({ q, type: "track", limit: "10" }));
  return (d?.tracks?.items ?? []).map((x: any) => ({
    uri: String(x.uri), title: String(x.name ?? ""), artist: (x.artists ?? []).map((a: any) => a.name).join(", "),
    album: String(x.album?.name ?? ""), art: art(x.album?.images),
  })).filter((t: Track) => TRACK.test(t.uri));
}
export async function playUri(token: string, deviceId: string, uri: string) {
  if (!DEV.test(deviceId) || !TRACK.test(uri)) throw new Error("Invalid track or device.");
  await sp(token, "PUT", "/me/player/play?device_id=" + encodeURIComponent(deviceId), { uris: [uri] });
}
export async function transfer(token: string, deviceId: string, play: boolean) {
  if (!DEV.test(deviceId)) throw new Error("Invalid device.");
  await sp(token, "PUT", "/me/player", { device_ids: [deviceId], play });
}
