import { setSession, setNotice, go } from "../core/state";
import { clearSession } from "./tokenStore";

/** Forget the token everywhere (memory + sessionStorage), stop the player (leave handlers) and return to the unlock screen. */
export function lock(why = "") {
  setSession(null);
  clearSession(sessionStorage);
  setNotice(why);
  go({ n: "unlock" });
}
