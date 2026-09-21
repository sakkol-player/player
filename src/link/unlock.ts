import QRCode from "qrcode";
import { h, mmss, set } from "../core/dom";
import { relay, errText, ApiError } from "../core/api";
import { randomB64u, sha256b64u } from "../core/crypto";
import { every, go, onLeave, setSession, takeNotice } from "../core/state";
import { saveSession } from "../player/tokenStore";

/**
 * Unlock the Spotify web player: QR + code here, approval on the phone, then this tab CLAIMS the token (one time, with a
 * secret only this tab knows). The Relay keeps nothing afterwards: no session, no token, no refresh token, no account data.
 */
export async function unlockView(root: HTMLElement) {
  let alive = true, txId = "";
  const claimSecret = randomB64u(32); // lives in this closure only; never shown, stored or put in the QR
  const auth = { "X-Claim-Secret": claimSecret };
  const notice = takeNotice();
  const keep = h("input", { type: "checkbox", id: "keep" }) as HTMLInputElement;
  onLeave(() => {
    alive = false;
    if (txId) relay("/link/cancel/" + txId, { method: "POST" }, auth).catch(() => {}); // no-op if already claimed
  });

  const retry = () => go({ n: "unlock" });
  const fail = (text: string) => set(root, h("h2", {}, "Spotify web player"), h("p", {}, text), h("div", { cls: "row" }, h("button", { cls: "pri", onclick: retry }, "Try again")));

  set(root, notice ? h("p", { cls: "notice", role: "status" }, notice) : null, h("p", { cls: "mut" }, "Preparing secure link…"));
  let tx: { id: string; code: string; ttlMs: number };
  try {
    tx = await relay("/link/start", { method: "POST", body: JSON.stringify({ app: "spotify", access: "stream", claimHash: await sha256b64u(claimSecret) }) });
  } catch (e) { return alive && fail(errText(e)); }
  if (!alive) { relay("/link/cancel/" + tx.id, { method: "POST" }, auth).catch(() => {}); return; }
  txId = tx.id;

  const expAt = Date.now() + tx.ttlMs;
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, `${location.origin}${location.pathname}#/p/${tx.id}`, { width: 240, margin: 2 });
  if (!alive) return;
  const left = h("span");
  set(root, notice ? h("p", { cls: "notice", role: "status" }, notice) : null, h("div", { cls: "center" },
    h("h2", {}, "Spotify web player"),
    canvas,
    h("div", { cls: "code", "aria-label": "verification code" }, tx.code),
    h("p", {}, "1. Scan the QR code with your phone.", h("br"), "2. Type this code on your phone when asked.", h("br"), "3. Approve on Spotify's own page."),
    h("p", { cls: "mut small" }, "Your Spotify password is never typed on this computer. Only continue if you started this yourself."),
    h("label", { cls: "checkrow", for: "keep" }, keep, h("span", {}, "Keep me unlocked if I refresh this tab. (Stores the token in this tab's session storage until you lock or close the tab. Leave this off on shared computers.)")),
    h("p", { cls: "mut" }, "Expires in ", left)));
  const tick = () => { left.textContent = mmss(expAt - Date.now()); };
  tick(); every(tick, 1000);

  let busy = false;
  every(async () => {
    if (busy || !alive) return;
    busy = true;
    try {
      const { status } = await relay("/link/status/" + tx.id, {}, auth);
      if (!alive) return;
      if (status === "approved") {
        alive = false;
        set(root, h("p", { cls: "mut" }, "Signing in…"));
        try {
          const r = await relay("/link/claim/" + tx.id, { method: "POST" }, auth); // {token, ttlMs}: the only time the token is sent
          txId = "";
          const s = { token: String(r.token), expAt: Date.now() + Number(r.ttlMs) };
          setSession(s);
          if (keep.checked) saveSession(sessionStorage, s);
          go({ n: "player" });
        } catch (e) { fail(e instanceof ApiError && e.status === 409 ? "This link was already used or expired." : errText(e)); }
      } else if (status === "expired") { alive = false; txId = ""; fail("This code expired or was cancelled."); }
      else if (status === "cancelled") { alive = false; txId = ""; fail("Approval was cancelled, the wrong code was entered too often, or authorization failed."); }
      else if (status === "consumed") { alive = false; txId = ""; fail("This link was already used."); }
    } catch { /* network blip: keep polling */ }
    finally { busy = false; }
  }, 2000);
}
