import { h, set } from "./core/dom";
import { go, resetView, setRenderer, setSession, view } from "./core/state";
import { unlockView } from "./link/unlock";
import { phoneView } from "./link/phone";
import { playerView } from "./player/view";
import { clearSession, loadSession } from "./player/tokenStore";

// This page must never be shown inside another site (GitHub Pages cannot send frame-ancestors headers).
if (window.top !== window.self) {
  document.body.textContent = "This page cannot be shown inside another site.";
  throw new Error("framed");
}

const root = document.getElementById("app")!;

function render() {
  resetView(); // clears timers and runs leave handlers (which stop the player)
  const body = h("section");
  set(root, h("h1", { cls: "brand" }, "Sakkol Web Player"), body);
  switch (view.n) {
    case "unlock": return void unlockView(body);
    case "player": return void playerView(body);
    case "phone": return void phoneView(body, view.id, view.sub);
  }
}
setRenderer(render);

function route() {
  const m = location.hash.match(/^#\/p\/([\w-]+)\/?(.*)$/);
  if (m) { setSession(null); clearSession(sessionStorage); go({ n: "phone", id: m[1], sub: m[2] }); return; } // the phone page never holds a token
  if (view.n === "phone") { go({ n: "unlock" }); return; }
  render();
}
window.addEventListener("hashchange", route);

// Resume after a refresh ONLY if the user ticked "Keep me unlocked" (sessionStorage mirror, still valid)
const restored = location.hash.startsWith("#/p/") ? null : loadSession(sessionStorage, Date.now());
if (restored) { setSession(restored); go({ n: "player" }); } else route();
