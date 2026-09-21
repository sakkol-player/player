import { describe, expect, it } from "vitest";
import { clearSession, loadSession, saveSession } from "../src/player/tokenStore";

const fake = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
};

describe("token store (sessionStorage mirror)", () => {
  it("round-trips a valid session", () => {
    const st = fake(); const now = 1_000_000;
    saveSession(st, { token: "BQ-token-value-123", expAt: now + 3_000_000 });
    expect(loadSession(st, now)).toEqual({ token: "BQ-token-value-123", expAt: now + 3_000_000 });
  });
  it("deletes and ignores an expired or nearly expired session", () => {
    const st = fake(); const now = 1_000_000;
    saveSession(st, { token: "BQ-token-value-123", expAt: now + 10_000 });
    expect(loadSession(st, now)).toBeNull();
    expect(st.m.size).toBe(0);
  });
  it("rejects malformed content and cleans it up", () => {
    for (const raw of ["not json", '{"token":1,"expAt":9999999999999}', '{"token":"short","expAt":9999999999999}', '{"token":"x".repeat(5000)}', "null"]) {
      const st = fake(); st.m.set("sakkol.player.session", raw);
      expect(loadSession(st, 1)).toBeNull();
      expect(st.m.size).toBe(0);
    }
  });
  it("clearSession removes it, and a blocked storage never throws", () => {
    const st = fake(); saveSession(st, { token: "BQ-token-value-123", expAt: 9e12 });
    clearSession(st); expect(st.m.size).toBe(0);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(() => saveSession(blocked, { token: "BQ-token-value-123", expAt: 1 })).not.toThrow();
    expect(loadSession(blocked, 0)).toBeNull();
    expect(() => clearSession(blocked)).not.toThrow();
  });
});
