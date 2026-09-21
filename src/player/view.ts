import { h, mmss, set } from "../core/dom";
import { session, every, onLeave } from "../core/state";
import { lock } from "./lock";
import { drmAvailable, loadSdk } from "./sdk";
import { AuthError, playUri, search, transfer, Track } from "./spotifyApi";

const IDLE_LOCK_MS = 30 * 60_000; // no click/key for 30 min: forget the token and stop (so nobody can pick up an abandoned tab)
const artOk = (u?: string) => !!u && u.startsWith("https://i.scdn.co/");
const fmt = (ms: number) => mmss(ms);

interface Now { title: string; artist: string; album: string; art: string; paused: boolean; pos: number; dur: number; t0: number }

export async function playerView(root: HTMLElement) {
  const s0 = session;
  if (!s0) return lock();
  let player: any = null, deviceId = "", cur: Now | null = null, lastAct = Date.now(), tracks: Track[] = [];
  onLeave(() => { try { player?.disconnect(); } catch { /* ignore */ } });

  const tok = () => session?.token ?? "";
  const cd = h("span");
  const msg = h("p", { cls: "err", role: "alert" });
  const stat = h("p", { cls: "mut" }, "Checking this browser…");
  const start = h("button", { cls: "pri", disabled: true }, "▶ Start player in this tab") as HTMLButtonElement;
  const nowEl = h("div", { cls: "np" });
  const results = h("div", { cls: "results" });
  const q = h("input", { type: "search", placeholder: "Search songs…", "aria-label": "Search songs", autocomplete: "off", maxlength: "100", disabled: true }) as HTMLInputElement;

  set(root,
    h("div", { cls: "bar" },
      h("div", {}, h("strong", {}, "🎵 Spotify web player"), h("div", { cls: "mut small" }, "Token valid for ", cd, " · locks itself after 30 min without a click or key press")),
      h("div", { cls: "row-r" }, h("button", { cls: "done", onclick: () => lock("Locked.") }, "DONE — lock"))),
    stat, start, msg, nowEl, q, results);

  const fail = (e: unknown) => {
    if (e instanceof AuthError) return lock("Spotify rejected the token. Unlock again.");
    msg.textContent = e instanceof Error ? e.message : "Something went wrong.";
  };

  // ---- housekeeping: countdown, idle lock, expiry ----
  const act = () => { lastAct = Date.now(); };
  document.addEventListener("pointerdown", act); document.addEventListener("keydown", act);
  onLeave(() => { document.removeEventListener("pointerdown", act); document.removeEventListener("keydown", act); });
  every(() => {
    const c = session; if (!c) return;
    cd.textContent = mmss(c.expAt - Date.now());
    if (Date.now() >= c.expAt) lock("Session ended (token expired). Unlock again.");
    else if (Date.now() - lastAct > IDLE_LOCK_MS) lock("Locked after 30 minutes without activity.");
  }, 1000);

  // ---- now playing ----
  const progFill = h("div", { cls: "progfill" }), time = h("span", { cls: "mut small" });
  const drawNow = () => {
    if (!cur) return set(nowEl, h("div", { cls: "mut" }, deviceId ? "Nothing is playing in this tab. Search for a song below." : "Player not started."));
    const c = cur;
    const vol = h("input", { type: "range", min: "0", max: "100", value: 60, "aria-label": "Volume" }) as HTMLInputElement;
    let vt = 0;
    vol.oninput = () => { clearTimeout(vt); vt = window.setTimeout(() => player?.setVolume(Number(vol.value) / 100), 200); };
    set(nowEl, h("div", { cls: "npmain" },
      artOk(c.art) ? h("img", { src: c.art, alt: "", width: "96", height: "96", referrerpolicy: "no-referrer" }) : h("div", { cls: "noart" }, "♪"),
      h("div", { cls: "npinfo" }, h("strong", {}, c.title || "Unknown"), h("div", { cls: "mut" }, [c.artist, c.album].filter(Boolean).join(" · ")),
        h("div", { cls: "prog" }, progFill), time,
        h("div", { cls: "row-l" },
          h("button", { onclick: () => player?.previousTrack(), "aria-label": "Previous" }, "⏮"),
          h("button", { cls: "pri", onclick: () => player?.togglePlay(), "aria-label": c.paused ? "Play" : "Pause" }, c.paused ? "▶" : "⏸"),
          h("button", { onclick: () => player?.nextTrack(), "aria-label": "Next" }, "⏭")),
        h("label", { cls: "small" }, "Volume ", vol))));
  };
  every(() => {
    if (!cur) return;
    const pos = Math.min(cur.dur, cur.pos + (cur.paused ? 0 : Date.now() - cur.t0));
    progFill.style.width = (cur.dur ? (pos / cur.dur) * 100 : 0) + "%"; // CSSOM: allowed by the CSP
    time.textContent = `${fmt(pos)} / ${fmt(cur.dur)}`;
  }, 1000);
  drawNow();

  // ---- search ----
  const drawResults = () => set(results, ...tracks.map((t) => h("div", { cls: "track" },
    artOk(t.art) ? h("img", { src: t.art, alt: "", width: "40", height: "40", referrerpolicy: "no-referrer" }) : h("div", { cls: "noart sm" }, "♪"),
    h("div", { cls: "trackinfo" }, h("div", {}, t.title), h("div", { cls: "mut small" }, `${t.artist} · ${t.album}`)),
    h("button", { cls: "pri", "aria-label": `Play ${t.title}`, onclick: async () => {
      msg.textContent = "";
      if (!deviceId) { msg.textContent = "Press “Start player in this tab” first."; return; }
      try { await playUri(tok(), deviceId, t.uri); } catch (e) { fail(e); }
    } }, "▶"))));
  q.onkeydown = async (e) => {
    if (e.key !== "Enter") return;
    const term = q.value.trim(); if (!term) return;
    msg.textContent = "";
    try { tracks = await search(tok(), term); drawResults(); if (!tracks.length) set(results, h("p", { cls: "mut" }, "No results.")); } catch (err) { fail(err); }
  };

  // ---- start the SDK (only after unlock, and only if this browser can play DRM audio) ----
  if (!(await drmAvailable())) {
    stat.textContent = "";
    msg.textContent = "This browser window cannot play Spotify: DRM (Widevine) is not available. Firefox private windows disable it. Use Chrome or Edge (an incognito / InPrivate window is fine), or use the workspace's Spotify “Remote control” mode instead.";
    return;
  }
  try { stat.textContent = "Loading Spotify's player…"; await loadSdk(); }
  catch { stat.textContent = ""; msg.textContent = "Could not load Spotify's player script. Check your connection and any content blockers."; return; }
  stat.textContent = "Ready. Press the button to start the player in this tab (browsers need a click before playing audio).";
  start.disabled = false;

  start.onclick = () => {
    start.disabled = true; msg.textContent = "";
    player = new window.Spotify!.Player({
      name: "Sakkol Web Player", volume: 0.6,
      getOAuthToken: (cb: (t: string) => void) => { const c = session; if (c && Date.now() < c.expAt) cb(c.token); else lock("Session ended (token expired). Unlock again."); },
    });
    player.activateElement?.();
    player.addListener("ready", async ({ device_id }: { device_id: string }) => {
      deviceId = device_id; q.disabled = false; stat.textContent = "Player is running in this tab.";
      try { await transfer(tok(), deviceId, false); } catch (e) { fail(e); }
      drawNow();
    });
    player.addListener("not_ready", () => { deviceId = ""; stat.textContent = "The player went offline."; });
    player.addListener("player_state_changed", (st: any) => {
      const t = st?.track_window?.current_track;
      cur = t ? { title: String(t.name ?? ""), artist: (t.artists ?? []).map((a: any) => a.name).join(", "), album: String(t.album?.name ?? ""),
        art: (t.album?.images ?? []).map((i: any) => i.url).find((u: string) => artOk(u)) ?? "", paused: !!st.paused, pos: st.position ?? 0, dur: st.duration ?? 0, t0: Date.now() } : null;
      drawNow();
    });
    player.addListener("initialization_error", ({ message }: any) => { msg.textContent = "This browser cannot run the Spotify player: " + message; start.disabled = false; });
    player.addListener("authentication_error", () => lock("Spotify rejected the token. Unlock again."));
    player.addListener("account_error", () => { msg.textContent = "Spotify Premium is required for the web player."; });
    player.addListener("playback_error", ({ message }: any) => { msg.textContent = "Playback error: " + message; });
    player.addListener("autoplay_failed", () => { msg.textContent = "Your browser blocked autoplay. Press play."; });
    player.connect().then((ok: boolean) => { if (!ok) { msg.textContent = "Could not connect the player."; start.disabled = false; } });
  };
}
