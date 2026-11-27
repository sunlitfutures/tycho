import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** A 6-digit code from the CSPRNG, zero-padded ("004219" is a valid code). */
export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

/** SHA-256 of salt and code, hex. The code itself is never stored. */
export function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(salt).update(":").update(code).digest("hex");
}

/** Constant-time check of a typed code against a stored hash. */
export function codeMatches(code: string, salt: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(code, salt), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A session token: 32 random bytes, base64url. Only its hash is stored. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
