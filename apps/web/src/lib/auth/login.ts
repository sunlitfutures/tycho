import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { loginCodeMisses, loginCodes, users, type User } from "@/db/schema";
import { signInCodeMail } from "@/lib/mail/sign-in-code";
import type { Mailer } from "@/lib/mail";
import { codeMatches, hashCode, newCode, newSalt } from "./crypto";
import { normalizeEmail } from "./email";

const MINUTE = 60_000;

/** A code lives 10 minutes, works once, and dies after 5 wrong tries. */
export const CODE_TTL_MS = 10 * MINUTE;
export const MAX_TRIES = 5;

/**
 * Rate limits. Per address they are tight, since one person rarely needs more; per IP they are
 * looser, since many people can share one network (an office, a campus).
 */
export const LIMITS = {
  email: {
    /** One code a minute; the code page counts this down before "Send a new code". */
    resendAfterMs: MINUTE,
    perWindow: 5,
    windowMs: 15 * MINUTE,
    perDay: 10,
  },
  ip: {
    perWindow: 20,
    windowMs: 15 * MINUTE,
    perDay: 100,
    /** Wrong codes from one IP, across every address. */
    missesPerWindow: 30,
  },
} as const;

const DAY = 24 * 60 * MINUTE;

export type StartResult =
  | { ok: true; email: string; resendAt: Date }
  | { ok: false; error: "invalid_email" }
  | { ok: false; error: "rate_limited"; scope: "email" | "ip"; reason: LimitReason; email: string; retryAt: Date }
  | { ok: false; error: "mail_failed"; email: string };

/** resend_wait: a code went out under a minute ago, and it still works. */
export type LimitReason = "resend_wait" | "window" | "day";

export type VerifyResult =
  | { ok: true; user: User; created: boolean }
  | { ok: false; error: "invalid_code" }
  | { ok: false; error: "wrong_code"; triesLeft: number }
  | { ok: false; error: "expired" }
  | { ok: false; error: "too_many_tries" }
  | { ok: false; error: "no_code" }
  | { ok: false; error: "rate_limited"; scope: "ip"; retryAt: Date };

/** Where the latest code for an address stands, for the code page. */
export type CodeState = {
  state: "open" | "expired" | "too_many_tries" | "none";
  resendAt: Date;
};

/** A lock per address for the length of a transaction, so two requests cannot race the limits. */
function lockEmail(tx: Pick<Db, "execute">, email: string) {
  return tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"login:" + email}, 0))`);
}

/**
 * Makes a code for an address and mails it. Any address works: a new one
 * becomes an account when its code is entered. A new code ends the one before.
 */
export async function startLogin(
  db: Db,
  mailer: Mailer,
  input: { email: unknown; ip: string; now?: Date },
): Promise<StartResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "invalid_email" };
  const now = input.now ?? new Date();
  const ip = input.ip;

  const made = await db.transaction(async (tx) => {
    await lockEmail(tx, email);

    const limited = await checkSendLimits(tx as unknown as Db, email, ip, now);
    if (limited) return limited;

    await tx
      .update(loginCodes)
      .set({ endedAt: now, endedReason: "replaced" })
      .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt), isNull(loginCodes.endedAt)));

    const code = newCode();
    const salt = newSalt();
    const [row] = await tx
      .insert(loginCodes)
      .values({ email, codeHash: hashCode(code, salt), salt, ip, createdAt: now, expiresAt: new Date(now.getTime() + CODE_TTL_MS) })
      .returning({ id: loginCodes.id });
    return { id: row.id, code };
  });

  if ("error" in made) return made;

  try {
    await mailer.send(signInCodeMail(email, made.code, CODE_TTL_MS / MINUTE));
  } catch (err) {
    await db
      .update(loginCodes)
      .set({ endedAt: new Date(), endedReason: "mail_failed" })
      .where(eq(loginCodes.id, made.id));
    log("mail_failed", { reason: (err as Error).message });
    return { ok: false, error: "mail_failed", email };
  }

  log("code_sent", { ip });
  return { ok: true, email, resendAt: new Date(now.getTime() + LIMITS.email.resendAfterMs) };
}

async function checkSendLimits(db: Db, email: string, ip: string, now: Date) {
  const t = now.getTime();
  const windowStart = new Date(t - LIMITS.email.windowMs);
  const dayStart = new Date(t - DAY);

  // Per address. A code that was used, or whose mail failed, does not hold up
  // the next one, but every code counts toward the window and the day.
  const byEmail = await db
    .select({ createdAt: loginCodes.createdAt, endedReason: loginCodes.endedReason, usedAt: loginCodes.usedAt })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gt(loginCodes.createdAt, dayStart)))
    .orderBy(desc(loginCodes.createdAt));

  const last = byEmail[0] && !byEmail[0].usedAt && byEmail[0].endedReason !== "mail_failed" ? byEmail[0] : undefined;
  if (last && t - last.createdAt.getTime() < LIMITS.email.resendAfterMs) {
    return limited(email, "email", "resend_wait", last.createdAt.getTime() + LIMITS.email.resendAfterMs);
  }
  const inWindow = byEmail.filter((c) => c.createdAt > windowStart);
  if (inWindow.length >= LIMITS.email.perWindow) {
    return limited(email, "email", "window", oldest(inWindow) + LIMITS.email.windowMs);
  }
  if (byEmail.length >= LIMITS.email.perDay) {
    return limited(email, "email", "day", oldest(byEmail) + DAY);
  }

  // Per IP.
  const byIp = await db
    .select({ createdAt: loginCodes.createdAt })
    .from(loginCodes)
    .where(and(eq(loginCodes.ip, ip), gt(loginCodes.createdAt, dayStart)));
  const ipWindow = byIp.filter((c) => c.createdAt > windowStart);
  if (ipWindow.length >= LIMITS.ip.perWindow) return limited(email, "ip", "window", oldest(ipWindow) + LIMITS.ip.windowMs);
  if (byIp.length >= LIMITS.ip.perDay) return limited(email, "ip", "day", oldest(byIp) + DAY);
  return null;
}

function oldest(rows: { createdAt: Date }[]) {
  return Math.min(...rows.map((r) => r.createdAt.getTime()));
}

function limited(email: string, scope: "email" | "ip", reason: LimitReason, retryAt: number) {
  log("rate_limited", { scope, reason });
  return { ok: false as const, error: "rate_limited" as const, scope, reason, email, retryAt: new Date(retryAt) };
}

/**
 * Checks a typed code against the latest code for the address. On the right
 * code the code is used up and the account is found or made.
 */
export async function verifyLogin(
  db: Db,
  input: { email: unknown; code: unknown; ip: string; now?: Date },
): Promise<VerifyResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "no_code" };
  const code = typeof input.code === "string" ? input.code.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "invalid_code" };
  const now = input.now ?? new Date();
  const ip = input.ip;

  const misses = await db
    .select({ createdAt: loginCodeMisses.createdAt })
    .from(loginCodeMisses)
    .where(and(eq(loginCodeMisses.ip, ip), gt(loginCodeMisses.createdAt, new Date(now.getTime() - LIMITS.ip.windowMs))));
  if (misses.length >= LIMITS.ip.missesPerWindow) {
    log("rate_limited", { scope: "ip_misses" });
    return { ok: false, error: "rate_limited", scope: "ip", retryAt: new Date(oldest(misses) + LIMITS.ip.windowMs) };
  }

  return db.transaction(async (tx): Promise<VerifyResult> => {
    await lockEmail(tx, email);
    const [row] = await tx
      .select()
      .from(loginCodes)
      .where(and(eq(loginCodes.email, email), sql`${loginCodes.endedReason} is distinct from 'mail_failed'`))
      .orderBy(desc(loginCodes.createdAt))
      .limit(1)
      .for("update");

    if (!row || row.usedAt) return { ok: false, error: "no_code" };
    if (row.endedReason === "too_many_tries") return { ok: false, error: "too_many_tries" };
    if (row.endedAt) return { ok: false, error: "no_code" };
    if (row.expiresAt <= now) return { ok: false, error: "expired" };

    if (!codeMatches(code, row.salt, row.codeHash)) {
      const tries = row.tries + 1;
      const dead = tries >= MAX_TRIES;
      await tx
        .update(loginCodes)
        .set({ tries, ...(dead ? { endedAt: now, endedReason: "too_many_tries" } : {}) })
        .where(eq(loginCodes.id, row.id));
      await tx.insert(loginCodeMisses).values({ email, ip, createdAt: now });
      log("wrong_code", { ip, tries });
      return dead ? { ok: false, error: "too_many_tries" } : { ok: false, error: "wrong_code", triesLeft: MAX_TRIES - tries };
    }

    await tx.update(loginCodes).set({ usedAt: now, usedIp: ip }).where(eq(loginCodes.id, row.id));
    const [inserted] = await tx.insert(users).values({ email, createdAt: now }).onConflictDoNothing().returning();
    const user = inserted ?? (await tx.select().from(users).where(eq(users.email, email)))[0];
    log("signed_in", { ip, created: Boolean(inserted) });
    return { ok: true, user, created: Boolean(inserted) };
  });
}

/** The latest code's state and when a new one may be sent. */
export async function codeState(db: Db, emailInput: unknown, now = new Date()): Promise<CodeState> {
  const email = normalizeEmail(emailInput);
  if (!email) return { state: "none", resendAt: now };
  const [row] = await db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gte(loginCodes.createdAt, new Date(now.getTime() - DAY)), sql`${loginCodes.endedReason} is distinct from 'mail_failed'`))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (!row) return { state: "none", resendAt: now };
  const resendAt = new Date(Math.max(now.getTime(), row.createdAt.getTime() + LIMITS.email.resendAfterMs));
  if (row.endedReason === "too_many_tries") return { state: "too_many_tries", resendAt };
  if (row.usedAt) return { state: "none", resendAt: now };
  if (row.endedAt) return { state: "none", resendAt };
  if (row.expiresAt <= now) return { state: "expired", resendAt };
  return { state: "open", resendAt };
}

/** One JSON line per event. Never the code, never the address. */
function log(event: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") return;
  console.log(JSON.stringify({ at: new Date().toISOString(), scope: "auth", event, ...data }));
}
