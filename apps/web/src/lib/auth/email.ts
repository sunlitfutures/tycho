/** Lowercased and trimmed, or null when it is not an email address. */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  // One @, something before it, a dot in the domain, no spaces or control characters.
  if (!/^[^\s@\p{Cc}]+@[^\s@\p{Cc}]+\.[^\s@\p{Cc}]+$/u.test(email)) return null;
  if (/[<>"',;\\]/.test(email)) return null;
  return email;
}

export const NAME_MAX = 60;

/** A display name: trimmed, inner whitespace collapsed, or null when empty or too long. */
export function normalizeName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.replace(/[\p{Cc}\u202A-\u202E\u2066-\u2069]/gu, "").replace(/\s+/g, " ").trim();
  if (!name || name.length > NAME_MAX) return null;
  return name;
}
