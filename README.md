# Sakkol Web Player

The Spotify web player for Sakkol Workspace. It is a **separate site on a separate origin** on purpose: it loads Spotify's player script (`sdk.scdn.co`), so it must never share an origin with the workspace that holds your Gmail session.

**Setup:** follow `SETUP-STEPS-v2.1.md` in the workspace repo (create a free GitHub *organization*, put this repo in it, enable Pages).

## What it does
1. Shows a QR code + 6-digit code (same secure link flow as the workspace, with a claim secret only this tab knows).
2. You scan with your phone, type the code, approve on Spotify's own page.
3. This tab claims a Spotify access token **once**. The Relay keeps nothing (no session, no token, no refresh token, no account data).
4. Spotify's player starts inside this tab. Search and play songs. DONE locks it.

## Security properties
- The token lives in JavaScript memory of this tab. Optional: mirrored to this tab's `sessionStorage` if you tick "Keep me unlocked if I refresh" (default off).
- Locks itself when the token expires, after 30 minutes without a click/key press, or when you press DONE.
- CSP limits where the page can send data: only the Relay and Spotify hosts.
- Spotify's script is loaded only after unlock, never on the QR or phone pages.
- No cookies, no localStorage, no IndexedDB written by this code.

## Files copied from the workspace repo
`src/core/dom.ts`, `src/core/crypto.ts`, `test/crypto.test.ts` are copies. If you change them in one repo, change the other.

## Commands
```bash
npm ci
npm test
VITE_RELAY_URL=https://sakkol-relay.YOURSUBDOMAIN.workers.dev npm run build
```
