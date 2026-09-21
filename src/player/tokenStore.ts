// The ONLY thing this site ever persists, and only if the user ticks "Keep me unlocked if I refresh".
// sessionStorage = this tab only, cleared when the tab closes. Never localStorage, cookies or IndexedDB.
export interface Session { token: string; expAt: number }
type St = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const KEY = "sakkol.player.session";

export function saveSession(st: St, s: Session) {
  try { st.setItem(KEY, JSON.stringify({ token: s.token, expAt: s.expAt })); } catch { /* storage blocked: memory only */ }
}
export function clearSession(st: St) {
  try { st.removeItem(KEY); } catch { /* ignore */ }
}
/** Returns a stored session only if it is well-formed and still valid for at least 30 s; otherwise deletes it. */
export function loadSession(st: St, now: number): Session | null {
  try {
    const raw = st.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.token === "string" && v.token.length >= 10 && v.token.length <= 2000 && typeof v?.expAt === "number" && v.expAt > now + 30_000) return { token: v.token, expAt: v.expAt };
    st.removeItem(KEY);
  } catch { clearSession(st); }
  return null;
}
