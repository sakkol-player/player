import { h, mmss, set } from "../core/dom";
import { session, every, onLeave } from "../core/state";
import { lock } from "./lock";
import { drmAvailable, loadSdk } from "./sdk";
import { AuthError, playUri, playContext, search, transfer, Track, getLibrary, LibraryItem } from "./spotifyApi";

const IDLE_LOCK_MS = 30 * 60_000;
const artOk = (u?: string) => !!u && u.startsWith("https://i.scdn.co/");
const fmt = (ms: number) => mmss(ms);

interface Now { title: string; artist: string; album: string; art: string; paused: boolean; pos: number; dur: number; t0: number }

export async function playerView(root: HTMLElement) {
  const s0 = session;
  if (!s0) return lock();

  let player: any = null, deviceId = "", cur: Now | null = null, lastAct = Date.now();
  let tracks: Track[] = [], library: LibraryItem[] = [], libraryLoaded = false, libraryBusy = false;
  let libraryFilter = "all";

  onLeave(() => { try { player?.disconnect(); } catch { /* ignore */ } });

  const tok = () => session?.token ?? "";
  const cd = h("span");
  const msg = h("p", { cls: "err", role: "alert" });
  const stat = h("span", { cls: "status-pill" }, "Checking browser…");
  const start = h("button", { cls: "start-btn", disabled: true }, "▶ Start player") as HTMLButtonElement;
  const nowEl = h("section", { cls: "player-card" });
  const results = h("div", { cls: "results" });
  const q = h("input", { type: "search", placeholder: "What do you want to play?", "aria-label": "Search Spotify", autocomplete: "off", maxlength: "100", disabled: true }) as HTMLInputElement;
  const libQ = h("input", { type: "search", placeholder: "Search your library", "aria-label": "Search your saved library", autocomplete: "off" }) as HTMLInputElement;
  const libResults = h("div", { cls: "library-grid" });
  const content = h("main", { cls: "content" });
  const searchSection = h("section", { cls: "content-section" });
  const librarySection = h("section", { cls: "content-section hidden" });

  set(root,
    h("div", { cls: "app-shell" },
      h("aside", { cls: "sidebar" },
        h("div", { cls: "sidebar-brand" }, h("span", { cls: "brand-mark" }, "●"), h("strong", {}, "Sakkol")),
        h("nav", { cls: "side-nav", "aria-label": "Main navigation" },
          h("button", { cls: "nav-item active", id: "nav-search" }, h("span", { cls: "nav-icon" }, "⌕"), "Search"),
          h("button", { cls: "nav-item", id: "nav-library" }, h("span", { cls: "nav-icon" }, "▦"), "Your Library")),
        h("div", { cls: "side-note" }, h("span", { cls: "mut" }, "Spotify Web Player"), h("span", { cls: "small muted" }, "Secure session · ", cd)),
        h("button", { cls: "lock-btn", onclick: () => lock("Locked.") }, "Lock player")),
      h("div", { cls: "main-wrap" },
        h("header", { cls: "topbar" },
          h("div", { cls: "nav-arrows" }, h("button", { cls: "circle-btn", "aria-label": "Back" }, "‹"), h("button", { cls: "circle-btn", "aria-label": "Forward" }, "›")),
          h("div", { cls: "top-actions" }, stat, start)),
        content,
        h("footer", { cls: "nowbar" }, nowEl)),
    ),
    searchSection, librarySection
  );
  set(content, searchSection, librarySection);

  const fail = (e: unknown) => {
    if (e instanceof AuthError) return lock("Spotify rejected the token. Unlock again.");
    msg.textContent = e instanceof Error ? e.message : "Something went wrong.";
  };

  const act = () => { lastAct = Date.now(); };
  document.addEventListener("pointerdown", act); document.addEventListener("keydown", act);
  onLeave(() => { document.removeEventListener("pointerdown", act); document.removeEventListener("keydown", act); });
  every(() => {
    const c = session; if (!c) return;
    cd.textContent = mmss(c.expAt - Date.now());
    if (Date.now() >= c.expAt) lock("Session ended (token expired). Unlock again.");
    else if (Date.now() - lastAct > IDLE_LOCK_MS) lock("Locked after 30 minutes without activity.");
  }, 1000);

  const progFill = h("div", { cls: "progress-fill" }), time = h("span", { cls: "time-label" });
  const drawNow = () => {
    if (!cur) {
      set(nowEl, h("div", { cls: "empty-player" }, h("div", { cls: "mini-disc" }, "♪"), h("div", {}, h("strong", {}, "Nothing playing"), h("span", {}, deviceId ? "Pick a song from Search." : "Start the player to begin."))));
      return;
    }
    const c = cur;
    const vol = h("input", { type: "range", min: "0", max: "100", value: 60, "aria-label": "Volume" }) as HTMLInputElement;
    let vt = 0;
    vol.oninput = () => { clearTimeout(vt); vt = window.setTimeout(() => player?.setVolume(Number(vol.value) / 100), 200); };
    set(nowEl, h("div", { cls: "nowbar-inner" },
      artOk(c.art) ? h("img", { cls: "now-art", src: c.art, alt: "", width: "56", height: "56", referrerpolicy: "no-referrer" }) : h("div", { cls: "now-art placeholder" }, "♪"),
      h("div", { cls: "now-meta" }, h("strong", {}, c.title || "Unknown"), h("span", {}, c.artist || "Unknown artist"), h("small", {}, c.album || "")),
      h("div", { cls: "transport" },
        h("div", { cls: "transport-buttons" },
          h("button", { class: "icon-btn", onclick: () => player?.previousTrack(), "aria-label": "Previous" }, "⏮"),
          h("button", { cls: "play-btn", onclick: () => player?.togglePlay(), "aria-label": c.paused ? "Play" : "Pause" }, c.paused ? "▶" : "Ⅱ"),
          h("button", { cls: "icon-btn", onclick: () => player?.nextTrack(), "aria-label": "Next" }, "⏭")),
        h("div", { cls: "progress-row" }, h("span", { cls: "time-label" }, "0:00"), h("div", { cls: "progress" }, progFill), time)),
      h("div", { cls: "volume" }, h("span", {}, "🔊"), vol)
    ));
  };

  every(() => {
    if (!cur) return;
    const pos = Math.min(cur.dur, cur.pos + (cur.paused ? 0 : Date.now() - cur.t0));
    progFill.style.width = (cur.dur ? (pos / cur.dur) * 100 : 0) + "%";
    time.textContent = fmt(pos);
  }, 1000);
  drawNow();

  const resultTitle = h("h1", {}, "Search");
  set(searchSection,
    h("div", { cls: "section-heading" }, h("div", {}, resultTitle, h("p", {}, "Find tracks to play in this tab."))),
    h("div", { cls: "search-box" }, h("span", {}, "⌕"), q),
    msg, results
  );

  const renderLibrary = () => {
    const term = libQ.value.trim().toLowerCase();
    const visible = library.filter((x) => (libraryFilter === "all" || x.type === libraryFilter) &&
      (!term || x.name.toLowerCase().includes(term) || x.subtitle.toLowerCase().includes(term)));
    set(libResults, ...visible.map((x) => h("button", { cls: "library-card", onclick: async () => {
      if (!deviceId) { msg.textContent = "Start the player in this tab first."; return; }
      msg.textContent = "";
      try { await playContext(tok(), deviceId, x.uri); } catch (e) { fail(e); }
    }},
      artOk(x.art) ? h("img", { src: x.art, alt: "", width: "160", height: "160", referrerpolicy: "no-referrer" }) : h("div", { cls: "library-art placeholder" }, x.type === "album" ? "♫" : "▦"),
      h("strong", {}, x.name),
      h("span", {}, x.subtitle),
      h("small", {}, x.type === "album" ? "Album" : "Playlist")
    )));
    if (!visible.length) set(libResults, h("div", { cls: "empty-library" }, "No matches in your library."));
  };

  const loadLibrary = async () => {
    if (libraryBusy || libraryLoaded) return;
    libraryBusy = true;
    try {
      library = await getLibrary(tok());
      libraryLoaded = true;
      renderLibrary();
    } catch (e) { fail(e); }
    finally { libraryBusy = false; }
  };

  const setTab = async (tab: "search" | "library") => {
    const isSearch = tab === "search";
    searchSection.classList.toggle("hidden", !isSearch);
    librarySection.classList.toggle("hidden", isSearch);
    document.getElementById("nav-search")?.classList.toggle("active", isSearch);
    document.getElementById("nav-library")?.classList.toggle("active", !isSearch);
    if (!isSearch) await loadLibrary();
  };
  document.getElementById("nav-search")!.onclick = () => void setTab("search");
  document.getElementById("nav-library")!.onclick = () => void setTab("library");
  libQ.oninput = renderLibrary;

  const filterButtons = h("div", { cls: "filter-row" },
    ...(["all", "playlist", "album"] as const).map((f) => h("button", { cls: `filter-btn${f === "all" ? " active" : ""}`, onclick: (e: Event) => {
      libraryFilter = f;
      filterButtons.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      (e.currentTarget as HTMLElement).classList.add("active");
      renderLibrary();
    } }, f === "all" ? "All" : f === "playlist" ? "Playlists" : "Albums"))
  );
  set(librarySection,
    h("div", { cls: "section-heading library-heading" }, h("div", {}, h("h1", {}, "Your Library"), h("p", {}, "Your saved albums and playlists."))),
    h("div", { cls: "library-tools" }, h("div", { cls: "search-box" }, h("span", {}, "⌕"), libQ), filterButtons),
    libResults
  );

  const drawResults = () => set(results, ...tracks.map((t) => h("div", { cls: "track-row" },
    artOk(t.art) ? h("img", { src: t.art, alt: "", width: "56", height: "56", referrerpolicy: "no-referrer" }) : h("div", { cls: "track-art placeholder" }, "♪"),
    h("div", { cls: "track-info" }, h("strong", {}, t.title), h("span", {}, t.artist), h("small", {}, t.album)),
    h("button", { cls: "track-play", "aria-label": `Play ${t.title}`, onclick: async () => {
      msg.textContent = "";
      if (!deviceId) { msg.textContent = "Start the player in this tab first."; return; }
      try { await playUri(tok(), deviceId, t.uri); } catch (e) { fail(e); }
    } }, "▶"))));

  q.onkeydown = async (e) => {
    if (e.key !== "Enter") return;
    const term = q.value.trim(); if (!term) return;
    msg.textContent = "";
    try { tracks = await search(tok(), term); drawResults(); if (!tracks.length) set(results, h("p", { cls: "empty-library" }, "No results. Try another search.")); } catch (err) { fail(err); }
  };

  if (!(await drmAvailable())) {
    stat.textContent = "";
    msg.textContent = "This browser window cannot play Spotify: DRM (Widevine) is not available. Use Chrome or Edge, or use the workspace's remote-control mode.";
    return;
  }
  try { stat.textContent = "Loading Spotify…"; await loadSdk(); }
  catch { stat.textContent = ""; msg.textContent = "Could not load Spotify's player script. Check your connection or content blockers."; return; }
  stat.textContent = "Ready";
  start.disabled = false;

  start.onclick = () => {
    start.disabled = true; msg.textContent = "";
    player = new window.Spotify!.Player({
      name: "Sakkol Web Player", volume: 0.6,
      getOAuthToken: (cb: (t: string) => void) => { const c = session; if (c && Date.now() < c.expAt) cb(c.token); else lock("Session ended (token expired). Unlock again."); },
    });
    player.activateElement?.();
    player.addListener("ready", async ({ device_id }: { device_id: string }) => {
      deviceId = device_id; q.disabled = false; stat.textContent = "Playing on this tab";
      try { await transfer(tok(), deviceId, false); } catch (e) { fail(e); }
      drawNow();
    });
    player.addListener("not_ready", () => { deviceId = ""; stat.textContent = "Player offline"; });
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
