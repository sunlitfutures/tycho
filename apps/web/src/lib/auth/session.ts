import { and, eq, gt, lte } from "drizzle-orm";
import type { Db } from "@/db";
import { sessions, users, type Session, type User } from "@/db/schema";
import { hashToken, newSessionToken } from "./crypto";

/** 30 days, sliding: every visit pushes the end out again. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
/** A visit moves the end at most once an hour, to keep writes down. */
export const SESSION_TOUCH_MS = 60 * 60_000;

export async function createSession(
  db: Db,
  userId: string,
  meta: { ip?: string; userAgent?: string; now?: Date } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const now = meta.now ?? new Date();
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent?.slice(0, 300),
  });
  return { token, expiresAt };
}

/** The session and its user for a cookie's token, or null. Slides the expiry forward. */
export async function readSession(db: Db, token: string | undefined, now = new Date()): Promise<{ session: Session; user: User } | null> {
  if (!token || token.length > 100) return null;
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  if (!row) return null;
  if (row.session.expiresAt <= now) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }
  if (now.getTime() - row.session.lastSeenAt.getTime() >= SESSION_TOUCH_MS) {
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt })
      .where(and(eq(sessions.id, row.session.id), gt(sessions.expiresAt, now)));
    row.session = { ...row.session, lastSeenAt: now, expiresAt };
  }
  return row;
}

/** Sign out: the session row is deleted, so the token is dead everywhere. */
export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Clears out sessions past their end. Safe to run any time. */
export async function deleteExpiredSessions(db: Db, now = new Date()): Promise<void> {
  await db.delete(sessions).where(lte(sessions.expiresAt, now));
}
