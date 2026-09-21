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


## Updated player UI

The player now uses a Spotify-inspired dark layout with:
- left navigation for **Search** and **Your Library**
- fixed bottom now-playing controls
- responsive mobile navigation
- Spotify-style album artwork cards and track rows
- search across tracks
- searchable **saved/followed playlists and saved albums**
- one-click playback of a selected saved playlist or album in the active tab

### Library authorization

The new library view calls Spotify's `/me/playlists` and `/me/albums` endpoints. The access token therefore needs the corresponding Spotify library permissions in addition to streaming. In the Relay authorization configuration, include:

- `user-library-read` for saved albums
- `playlist-read-private` for private/followed playlists
- `playlist-read-collaborative` if collaborative playlists should be included

The exact Relay configuration is intentionally not changed here because the Relay source/configuration is not part of this player ZIP. If those scopes are not granted, playback/search will continue to work but **Your Library** will show a Spotify permission error until the authorization flow is updated and the user unlocks again.

The UI loads up to 50 playlists and 50 saved albums per library refresh.


## Relay scope update

For the library view to work through the existing unlock flow, deploy the companion Relay update in `sakkol-relay-spotify-library-update-v1.1.0.zip`. Then unlock Spotify again in the player so Spotify grants a token containing the new library scopes.
