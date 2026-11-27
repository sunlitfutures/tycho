import { beforeEach, describe, expect, it } from "vitest";
import { sessions, users } from "@/db/schema";
import { resetDb, testDb } from "@/test/db";
import { hashToken } from "./crypto";
import { SESSION_TOUCH_MS, SESSION_TTL_MS, createSession, deleteExpiredSessions, deleteSession, readSession } from "./session";

const t0 = new Date("2026-01-01T12:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);
const DAY = 24 * 60 * 60_000;

async function makeUser() {
  const [u] = await testDb().insert(users).values({ email: "ada@example.com", name: "Ada" }).returning();
  return u;
}

beforeEach(resetDb);

describe("sessions", () => {
  it("store only the token's hash", async () => {
    const u = await makeUser();
    const { token, expiresAt } = await createSession(testDb(), u.id, { now: t0 });
    expect(expiresAt).toEqual(at(SESSION_TTL_MS));
    const rows = await testDb().select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("read back the user for the right token only", async () => {
    const u = await makeUser();
    const { token } = await createSession(testDb(), u.id, { now: t0 });
    expect((await readSession(testDb(), token, at(1)))?.user.id).toBe(u.id);
    expect(await readSession(testDb(), token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"), at(1))).toBeNull();
    expect(await readSession(testDb(), undefined, at(1))).toBeNull();
    expect(await readSession(testDb(), "x".repeat(500), at(1))).toBeNull();
  });

  it("slide: each visit after an hour pushes the end out 30 days", async () => {
    const u = await makeUser();
    const { token } = await createSession(testDb(), u.id, { now: t0 });
    // Within the hour nothing is written.
    expect((await readSession(testDb(), token, at(SESSION_TOUCH_MS - 1)))?.session.expiresAt).toEqual(at(SESSION_TTL_MS));
    // 20 days on, a visit moves the end to 50 days.
    expect((await readSession(testDb(), token, at(20 * DAY)))?.session.expiresAt).toEqual(at(50 * DAY));
    // So day 40 still works, though it is past the first 30.
    expect(await readSession(testDb(), token, at(40 * DAY))).not.toBeNull();
  });

  it("end after 30 days without a visit, and the row goes", async () => {
    const u = await makeUser();
    const { token } = await createSession(testDb(), u.id, { now: t0 });
    expect(await readSession(testDb(), token, at(SESSION_TTL_MS))).toBeNull();
    expect(await testDb().select().from(sessions)).toHaveLength(0);
  });

  it("end on sign out, only that one", async () => {
    const u = await makeUser();
    const a = await createSession(testDb(), u.id, { now: t0 });
    const b = await createSession(testDb(), u.id, { now: t0 });
    await deleteSession(testDb(), a.token);
    expect(await readSession(testDb(), a.token, at(1))).toBeNull();
    expect(await readSession(testDb(), b.token, at(1))).not.toBeNull();
  });

  it("past their end are cleared in bulk", async () => {
    const u = await makeUser();
    await createSession(testDb(), u.id, { now: t0 });
    await createSession(testDb(), u.id, { now: at(10 * DAY) });
    await deleteExpiredSessions(testDb(), at(SESSION_TTL_MS + 1));
    expect(await testDb().select().from(sessions)).toHaveLength(1);
  });
});
