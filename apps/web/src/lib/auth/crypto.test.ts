import { describe, expect, it } from "vitest";
import { codeMatches, hashCode, hashToken, newCode, newSalt, newSessionToken } from "./crypto";
import { normalizeEmail, normalizeName } from "./email";

describe("codes", () => {
  it("are six digits, zero-padded, and vary", () => {
    const codes = Array.from({ length: 2000 }, newCode);
    for (const c of codes) expect(c).toMatch(/^\d{6}$/);
    expect(new Set(codes).size).toBeGreaterThan(1990);
  });

  it("hash with a salt, so one code gives different hashes", () => {
    const a = newSalt();
    const b = newSalt();
    expect(a).not.toBe(b);
    expect(hashCode("123456", a)).not.toBe(hashCode("123456", b));
    expect(hashCode("123456", a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode("123456", a)).not.toContain("123456");
  });

  it("match only the right code", () => {
    const salt = newSalt();
    const stored = hashCode("004219", salt);
    expect(codeMatches("004219", salt, stored)).toBe(true);
    expect(codeMatches("004218", salt, stored)).toBe(false);
    expect(codeMatches("4219", salt, stored)).toBe(false);
    expect(codeMatches("004219", newSalt(), stored)).toBe(false);
    expect(codeMatches("004219", salt, "not-hex")).toBe(false);
  });
});

describe("session tokens", () => {
  it("are 32 random bytes, and only a hash is kept", () => {
    const t = newSessionToken();
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(newSessionToken()).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
  });
});

describe("input", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeEmail("no-at-sign")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("a b@c.de")).toBeNull();
    expect(normalizeEmail("a@b.c\r\nBcc: x@y.z")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });

  it("normalizes names", () => {
    expect(normalizeName("  Ada   Lovelace ")).toBe("Ada Lovelace");
    expect(normalizeName("   ")).toBeNull();
    expect(normalizeName("x".repeat(61))).toBeNull();
    expect(normalizeName("Ada‮")).toBe("Ada");
  });
});
