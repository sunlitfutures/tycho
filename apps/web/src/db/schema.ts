import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** A person with an account. Made on their first correct code. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Lowercased and trimmed. */
  email: text("email").notNull().unique(),
  /** Asked on first sign-in. Their agent shows as "<name>'s agent". */
  name: text("name"),
  createdAt: createdAt(),
});

/**
 * One sign-in code. Only a salted SHA-256 hash of the code is stored.
 * A code is open while used_at and ended_at are null and expires_at is ahead.
 */
export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    salt: text("salt").notNull(),
    tries: integer("tries").notNull().default(0),
    ip: text("ip").notNull(),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedIp: text("used_ip"),
    /** Set when a newer code replaced it, the tries ran out, or the mail failed. */
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedReason: text("ended_reason"),
  },
  (t) => [index("login_codes_email_created").on(t.email, t.createdAt), index("login_codes_ip_created").on(t.ip, t.createdAt)],
);

/** One wrong code. Counted for the per-IP verify limit. */
export const loginCodeMisses = pgTable(
  "login_code_misses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_code_misses_ip_created").on(t.ip, t.createdAt), index("login_code_misses_email_created").on(t.email, t.createdAt)],
);

/** A signed-in browser. Only a SHA-256 hash of the cookie's token is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
