import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { loginCodes, users } from "@/db/schema";
import { MailError, type Mail, type Mailer } from "@/lib/mail";
import { resetDb, testDb } from "@/test/db";
import { CODE_TTL_MS, LIMITS, MAX_TRIES, codeState, startLogin, verifyLogin } from "./login";

const MIN = 60_000;
const IP = "203.0.113.7";
const t0 = new Date("2026-01-01T12:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

/** A mailer that keeps what it was asked to send. */
function inbox() {
  const sent: Mail[] = [];
  const mailer: Mailer = { send: async (m) => void sent.push(m) };
  const code = () => sent.at(-1)!.text.match(/^\d{6}$/m)![0];
  return { sent, mailer, code };
}

const failing: Mailer = {
  send: async () => {
    throw new MailError("down", 503);
  },
};

const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

beforeEach(resetDb);

describe("sending a code", () => {
  it("mails a 6-digit code in the body, never the subject, and stores only a hash", async () => {
    const box = inbox();
    const r = await startLogin(testDb(), box.mailer, { email: " Ada@Example.com ", ip: IP, now: t0 });
    expect(r).toMatchObject({ ok: true, email: "ada@example.com" });
    expect(box.sent).toHaveLength(1);
    const mail = box.sent[0];
    expect(mail.to).toBe("ada@example.com");
    const code = box.code();
    expect(mail.subject).not.toMatch(/\d/);
    expect(mail.html).toContain(code);

    const rows = await testDb().select().from(loginCodes);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(code);
    expect(rows[0].expiresAt.getTime() - t0.getTime()).toBe(CODE_TTL_MS);
  });

  it("refuses something that is not an email address", async () => {
    const box = inbox();
    expect(await startLogin(testDb(), box.mailer, { email: "nope", ip: IP, now: t0 })).toEqual({ ok: false, error: "invalid_email" });
    expect(box.sent).toHaveLength(0);
  });

  it("ends the previous code when a new one is sent", async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    const first = box.code();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: at(MIN) });
    const second = box.code();
    if (first !== second) {
      expect(await verifyLogin(testDb(), { email: "ada@example.com", code: first, ip: IP, now: at(MIN + 1) })).toMatchObject({ error: "wrong_code" });
    }
    expect(await verifyLogin(testDb(), { email: "ada@example.com", code: second, ip: IP, now: at(MIN + 2) })).toMatchObject({ ok: true });
  });

  it("says when the mail failed, and leaves no open code", async () => {
    const r = await startLogin(testDb(), failing, { email: "ada@example.com", ip: IP, now: t0 });
    expect(r).toEqual({ ok: false, error: "mail_failed", email: "ada@example.com" });
    const [row] = await testDb().select().from(loginCodes);
    expect(row.endedReason).toBe("mail_failed");
    expect((await codeState(testDb(), "ada@example.com", at(1))).state).toBe("none");
    // A failed mail does not make them wait a minute to try again.
    expect(await startLogin(testDb(), inbox().mailer, { email: "ada@example.com", ip: IP, now: at(1000) })).toMatchObject({ ok: true });
  });
});

describe("rate limits", () => {
  it("allows one code a minute per address", async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    const again = await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: at(30_000) });
    expect(again).toMatchObject({ ok: false, error: "rate_limited", scope: "email", reason: "resend_wait" });
    if (!again.ok && again.error === "rate_limited") expect(again.retryAt).toEqual(at(MIN));
    expect(box.sent).toHaveLength(1);
    expect(await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: at(MIN) })).toMatchObject({ ok: true });
  });

  it("does not hold up a new code after the last one was used", async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    await verifyLogin(testDb(), { email: "ada@example.com", code: box.code(), ip: IP, now: at(5000) });
    expect(await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: at(10_000) })).toMatchObject({ ok: true });
  });

  it(`allows ${LIMITS.email.perWindow} codes per address in 15 minutes and ${LIMITS.email.perDay} a day`, async () => {
    const box = inbox();
    const send = (ms: number) => startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: `198.51.100.${ms % 250}`, now: at(ms) });
    for (let i = 0; i < LIMITS.email.perWindow; i++) expect(await send(i * MIN)).toMatchObject({ ok: true });
    expect(await send(LIMITS.email.perWindow * MIN)).toMatchObject({ error: "rate_limited", scope: "email", reason: "window" });
    // After the window, five more; then the day is full.
    for (let i = 0; i < LIMITS.email.perDay - LIMITS.email.perWindow; i++) expect(await send(20 * MIN + i * MIN)).toMatchObject({ ok: true });
    const full = await send(60 * MIN);
    expect(full).toMatchObject({ error: "rate_limited", reason: "day" });
    if (!full.ok && full.error === "rate_limited") expect(full.retryAt).toEqual(at(24 * 60 * MIN));
  });

  it(`allows ${LIMITS.ip.perWindow} codes per IP in 15 minutes, across addresses`, async () => {
    const box = inbox();
    for (let i = 0; i < LIMITS.ip.perWindow; i++) {
      expect(await startLogin(testDb(), box.mailer, { email: `p${i}@example.com`, ip: IP, now: at(i) })).toMatchObject({ ok: true });
    }
    expect(await startLogin(testDb(), box.mailer, { email: "next@example.com", ip: IP, now: at(100) })).toMatchObject({ error: "rate_limited", scope: "ip" });
    expect(await startLogin(testDb(), box.mailer, { email: "next@example.com", ip: "203.0.113.8", now: at(100) })).toMatchObject({ ok: true });
  });

  it(`stops verifying from an IP after ${LIMITS.ip.missesPerWindow} wrong codes in 15 minutes`, async () => {
    const box = inbox();
    let n = 0;
    for (let i = 0; n < LIMITS.ip.missesPerWindow; i++) {
      const email = `v${i}@example.com`;
      await startLogin(testDb(), box.mailer, { email, ip: `192.0.2.${i}`, now: t0 });
      const code = box.code();
      for (let k = 0; k < MAX_TRIES && n < LIMITS.ip.missesPerWindow; k++, n++) {
        await verifyLogin(testDb(), { email, code: wrong(code), ip: IP, now: at(n) });
      }
    }
    await startLogin(testDb(), box.mailer, { email: "last@example.com", ip: "192.0.2.200", now: t0 });
    const r = await verifyLogin(testDb(), { email: "last@example.com", code: box.code(), ip: IP, now: at(n + 1) });
    expect(r).toMatchObject({ ok: false, error: "rate_limited", scope: "ip" });
    // Another network is not held up.
    expect(await verifyLogin(testDb(), { email: "last@example.com", code: box.code(), ip: "192.0.2.201", now: at(n + 2) })).toMatchObject({ ok: true });
  });
});

describe("checking a code", () => {
  it("makes an account on the first right code, and finds it after", async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    const first = await verifyLogin(testDb(), { email: "ADA@example.com", code: box.code(), ip: IP, now: at(1000) });
    expect(first).toMatchObject({ ok: true, created: true, user: { email: "ada@example.com", name: null } });

    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: at(2 * MIN) });
    const second = await verifyLogin(testDb(), { email: "ada@example.com", code: box.code(), ip: IP, now: at(2 * MIN + 1) });
    expect(second).toMatchObject({ ok: true, created: false });
    if (first.ok && second.ok) expect(second.user.id).toBe(first.user.id);
    expect(await testDb().select().from(users)).toHaveLength(1);
  });

  it("accepts a code typed with a space", async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    const c = box.code();
    expect(await verifyLogin(testDb(), { email: "ada@example.com", code: `${c.slice(0, 3)} ${c.slice(3)}`, ip: IP, now: at(1) })).toMatchObject({ ok: true });
  });

  it("works once", async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    const code = box.code();
    expect(await verifyLogin(testDb(), { email: "ada@example.com", code, ip: IP, now: at(1) })).toMatchObject({ ok: true });
    expect(await verifyLogin(testDb(), { email: "ada@example.com", code, ip: IP, now: at(2) })).toEqual({ ok: false, error: "no_code" });
  });

  it("expires after 10 minutes", async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    const code = box.code();
    expect((await codeState(testDb(), "ada@example.com", at(CODE_TTL_MS - 1))).state).toBe("open");
    expect((await codeState(testDb(), "ada@example.com", at(CODE_TTL_MS))).state).toBe("expired");
    expect(await verifyLogin(testDb(), { email: "ada@example.com", code, ip: IP, now: at(CODE_TTL_MS) })).toEqual({ ok: false, error: "expired" });
  });

  it(`dies after ${MAX_TRIES} wrong tries, even for the right code`, async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    const code = box.code();
    for (let i = 1; i < MAX_TRIES; i++) {
      expect(await verifyLogin(testDb(), { email: "ada@example.com", code: wrong(code), ip: IP, now: at(i) })).toEqual({ ok: false, error: "wrong_code", triesLeft: MAX_TRIES - i });
    }
    expect(await verifyLogin(testDb(), { email: "ada@example.com", code: wrong(code), ip: IP, now: at(10) })).toEqual({ ok: false, error: "too_many_tries" });
    expect(await verifyLogin(testDb(), { email: "ada@example.com", code, ip: IP, now: at(11) })).toEqual({ ok: false, error: "too_many_tries" });
    expect((await codeState(testDb(), "ada@example.com", at(12))).state).toBe("too_many_tries");
    const [row] = await testDb().select().from(loginCodes).where(eq(loginCodes.email, "ada@example.com"));
    expect(row.tries).toBe(MAX_TRIES);
  });

  it("does not count a malformed code as a try", async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    expect(await verifyLogin(testDb(), { email: "ada@example.com", code: "12a456", ip: IP, now: at(1) })).toEqual({ ok: false, error: "invalid_code" });
    const [row] = await testDb().select().from(loginCodes);
    expect(row.tries).toBe(0);
  });

  it("answers no_code for an address with no code", async () => {
    expect(await verifyLogin(testDb(), { email: "nobody@example.com", code: "123456", ip: IP, now: t0 })).toEqual({ ok: false, error: "no_code" });
  });

  it("lets only one of two tries at once use a code", async () => {
    const box = inbox();
    await startLogin(testDb(), box.mailer, { email: "ada@example.com", ip: IP, now: t0 });
    const code = box.code();
    const both = await Promise.all([1, 2].map((n) => verifyLogin(testDb(), { email: "ada@example.com", code, ip: IP, now: at(n) })));
    expect(both.filter((r) => r.ok)).toHaveLength(1);
  });
});
