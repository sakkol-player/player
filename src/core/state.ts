import type { Session } from "../player/tokenStore";

/** The Spotify token lives here, in memory (and optionally mirrored to sessionStorage, see tokenStore.ts). */
export let session: Session | null = null;
export const setSession = (s: Session | null) => { session = s; };

export type View = { n: "unlock" } | { n: "player" } | { n: "phone"; id: string; sub: string };
export let view: View = { n: "unlock" };
let renderer: () => void = () => {};
export const setRenderer = (f: () => void) => { renderer = f; };
export function go(v: View) { view = v; renderer(); }

let timers: number[] = [];
let leaves: Array<() => void> = [];
export const every = (fn: () => void, ms: number) => { timers.push(window.setInterval(fn, ms)); };
export const onLeave = (fn: () => void) => { leaves.push(fn); };
export function resetView() {
  timers.forEach((t) => clearInterval(t)); timers = [];
  const l = leaves; leaves = []; l.forEach((f) => { try { f(); } catch { /* ignore */ } });
}

let notice = "";
export const setNotice = (s: string) => { notice = s; };
export const takeNotice = () => { const n = notice; notice = ""; return n; };
