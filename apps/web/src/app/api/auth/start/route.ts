import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { clientIp, forbidden, json, PENDING_COOKIE, readJson, sameOrigin, setPendingCookie } from "@/lib/auth/http";
import { startLogin } from "@/lib/auth/login";
import { getMailer } from "@/lib/mail";

/**
 * Sends a sign-in code. Body: {"email": "..."}, or {"resend": true} to send a
 * new code to the address the code page is showing.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return forbidden();
  const body = await readJson(req);
  if (!body) return json({ error: "bad_request" }, 400);
  const resend = body.resend === true;
  const email = resend ? req.cookies.get(PENDING_COOKIE)?.value : body.email;
  if (resend && !email) return json({ error: "no_email" }, 400);

  const now = Date.now();
  const result = await startLogin(getDb(), getMailer(), { email, ip: clientIp(req.headers) });
  if (result.ok) {
    const res = json({ ok: true, resendInMs: result.resendAt.getTime() - now });
    setPendingCookie(res, req.headers, result.email);
    return res;
  }
  switch (result.error) {
    case "invalid_email":
      return json({ error: "invalid_email" }, 400);
    case "rate_limited": {
      const retryInMs = result.retryAt.getTime() - now;
      // A code went out to this address under a minute ago and still works:
      // go on to the code page rather than stop here.
      if (!resend && result.reason === "resend_wait") {
        const res = json({ ok: true, resendInMs: retryInMs, recent: true });
        setPendingCookie(res, req.headers, result.email);
        return res;
      }
      return json({ error: "rate_limited", scope: result.scope, retryInMs }, 429);
    }
    case "mail_failed":
      return json({ error: "mail_failed" }, 502);
  }
}
